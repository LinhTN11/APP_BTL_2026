import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { Server } from "socket.io";
import type { DatabaseSync } from "node:sqlite";
import { resolve, join } from "node:path";
import { setupDatabase } from "./db/database.js";
import { ApiError, Domain, type Config } from "./domain.js";
import { registerAuth } from "./modules/auth.js";
import { registerProfiles } from "./modules/profiles.js";
import { registerMedia } from "./modules/media.js";
import { registerDiscovery } from "./modules/discovery.js";
import { registerChat } from "./modules/chat.js";
import { registerPersonalization } from "./modules/personalization/index.js";
import { registerDates } from "./modules/dates/index.js";
declare module "fastify" {
  interface FastifyRequest {
    actor: string;
    sessionId: string;
  }
  interface FastifyInstance {
    db: DatabaseSync;
    io: Server;
    config: Config;
  }
}
export interface AppOptions {
  dbPath?: string;
  dataDir?: string;
  demoMode?: boolean;
  sessionTtlMs?: number;
  otpTtlMs?: number;
  now?: () => number;
  logger?: boolean;
}
export async function createApp(options: AppOptions = {}) {
  const dataDir = resolve(options.dataDir ?? process.env.DATA_DIR ?? "data");
  const config: Config = {
    dataDir,
    dbPath:
      options.dbPath ?? process.env.DB_PATH ?? join(dataDir, "demo.sqlite"),
    demoMode: options.demoMode ?? process.env.DEMO_MODE !== "false",
    sessionTtlMs: options.sessionTtlMs ?? 86_400_000,
    otpTtlMs: options.otpTtlMs ?? 300_000,
    now: options.now ?? Date.now,
  };
  const app = Fastify({
    logger: options.logger
      ? {
          redact: [
            "req.headers.authorization",
            "req.headers.cookie",
            "body.phone",
            "body.code",
            "body.token",
          ],
        }
      : false,
    bodyLimit: 11 * 1024 * 1024,
    requestIdHeader: false,
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false } },
  });
  const db = setupDatabase(config),
    d = new Domain(db, config);
  const io = new Server(app.server, {
    cors: { origin: false },
    maxHttpBufferSize: 16 * 1024,
  });
  d.io = io;
  app.decorate("db", db);
  app.decorate("io", io);
  app.decorate("config", config);
  app.decorateRequest("actor", "");
  app.decorateRequest("sessionId", "");
  await app.register(cors, { origin: false });
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
  });
  app.setErrorHandler((error: any, req, reply) => {
    const status =
      error instanceof ApiError ? error.status : error.statusCode ?? 500;
    reply.code(status).send({
      error: {
        code:
          error instanceof ApiError
            ? error.code
            : status === 400
            ? "VALIDATION_ERROR"
            : status === 413
            ? "UPLOAD_TOO_LARGE"
            : status >= 500
            ? "INTERNAL_ERROR"
            : "REQUEST_ERROR",
        message:
          status >= 500 && !(error instanceof ApiError)
            ? "Lỗi máy chủ"
            : error.message,
        requestId: req.id,
        ...(error.validation
          ? { fieldErrors: { body: "Dữ liệu không hợp lệ" } }
          : {}),
      },
    });
  });
  app.setNotFoundHandler((req, reply) =>
    reply.code(404).send({
      error: {
        code: "NOT_FOUND",
        message: "Không tìm thấy endpoint",
        requestId: req.id,
      },
    })
  );
  const rates = new Map<string, { count: number; until: number }>();
  app.addHook("onRequest", async (req, reply) => {
    const key = req.ip;
    const now = config.now();
    let rate = rates.get(key);
    if (!rate || now >= rate.until) {
      rate = { count: 0, until: now + 60_000 };
      rates.set(key, rate);
    }
    if (++rate.count > 300) {
      reply.header("Retry-After", "60");
      throw new ApiError(429, "RATE_LIMIT", "Quá nhiều yêu cầu");
    }
    if (rates.size > 10000) {
      for (const [k, v] of rates) if (v.until <= now) rates.delete(k);
    }
    const path = req.url.split("?")[0];
    if (
      path === "/health" ||
      path === "/v1/capabilities" ||
      path === "/v1/demo/accounts" ||
      path === "/v1/demo/sessions" ||
      path === "/v1/auth/otp/request" ||
      path === "/v1/auth/otp/verify"
    )
      return;
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    const s = d.authenticate(token);
    req.actor = s.user_id;
    req.sessionId = s.id;
  });
  app.get("/health", async () => ({
    data: { status: "ok", database: "ready", version: "0.1.0" },
  }));
  app.get("/v1/capabilities", async () => ({
    data: [
      { name: "core", mode: "real" },
      { name: "profile-images", mode: "real" },
      { name: "location", mode: "real" },
      {
        name: "otp",
        mode: config.demoMode ? "demo" : "unavailable",
        reason: "Không gửi SMS; demo không xác nhận sở hữu số điện thoại",
      },
      {
        name: "selfie",
        mode: config.demoMode ? "demo" : "unavailable",
        reason: "Chỉ nhận ảnh chờ duyệt; không cấp xác minh thật",
      },
      {
        name: "video",
        mode: "unavailable",
        reason: "Chưa có bộ xác thực thời lượng video",
      },
      { name: "oauth", mode: "unavailable", reason: "Chưa cấu hình provider" },
      { name: "ai", mode: "unavailable", reason: "Ngoài phạm vi core" },
    ],
  }));
  registerPersonalization(app, d);
  registerDates(app, d);
  registerAuth(app, d);
  registerProfiles(app, d);
  registerMedia(app, d);
  registerDiscovery(app, d);
  registerChat(app, d);
  io.use((socket, next) => {
    try {
      const s = d.authenticate(socket.handshake.auth.token);
      socket.data.userId = s.user_id;
      socket.data.sessionId = s.id;
      socket.data.token = socket.handshake.auth.token;
      next();
    } catch (error) {
      next(
        Object.assign(new Error("UNAUTHORIZED"), {
          data: { code: "UNAUTHORIZED", message: (error as Error).message },
        })
      );
    }
  });
  io.on("connection", (socket) => {
    const s = d.authenticate(socket.data.token);
    const timer = setTimeout(
      () => socket.disconnect(true),
      Math.max(1, s.expires_at - config.now())
    );
    timer.unref();
    socket.on("disconnect", () => clearTimeout(timer));
    socket.on("match:subscribe", (body, ack) => {
      if (typeof ack !== "function") return;
      try {
        d.authenticate(socket.data.token);
        if (!body || typeof body.matchId !== "string")
          throw new ApiError(400, "VALIDATION_ERROR", "Thiếu matchId");
        d.matchAccess(socket.data.userId, body.matchId);
        void socket.join(`match:${body.matchId}`);
        ack({ ok: true });
      } catch (error) {
        const e = error as ApiError;
        ack({
          ok: false,
          error: { code: e.code ?? "FORBIDDEN", message: e.message },
        });
        if (e.status === 401) socket.disconnect(true);
      }
    });
  });
  // Recheck wall clock and account/revocation state even for idle connected sockets.
  const expiry = setInterval(() => {
    for (const socket of io.sockets.sockets.values()) {
      try {
        d.authenticate(socket.data.token);
      } catch {
        socket.disconnect(true);
      }
    }
  }, 1000);
  expiry.unref();
  app.addHook("onClose", async () => {
    clearInterval(expiry);
    await new Promise<void>((r) => io.close(() => r()));
    db.close();
  });
  return app;
}
export { setupDatabase, seedDemo } from "./db/database.js";
