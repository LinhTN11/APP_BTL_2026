import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { Server } from "socket.io";
import {
  ApiError,
  createFirestoreContext,
  type FirestoreContext,
  type FirestoreOptions,
} from "./context.js";
import { authenticate, registerFirestoreAuth } from "./auth.js";
import { googleConfig, firebaseConfig } from "./firebase-auth.js";
import { registerFirestoreProfiles } from "./profiles.js";
import { registerFirestoreMedia } from "./media.js";
import { registerFirestoreMatching } from "./matching.js";
import { registerFirestoreChat, configureFirestoreSocket } from "./chat.js";
import { registerFirestoreSafety } from "./safety.js";
import { registerApiDocs } from "../api-docs.js";

declare module "fastify" {
  interface FastifyInstance {
    firestore: FirestoreContext;
  }
  interface FastifyRequest {
    actor: string;
    sessionId: string;
  }
}

export async function createFirestoreApp(options: FirestoreOptions = {}) {
  const ctx = await createFirestoreContext(options);
  const app = Fastify({
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false } },
    bodyLimit: 11 * 1024 * 1024,
    requestIdHeader: false,
    logger: options.logger
      ? {
          redact: [
            "req.headers.authorization",
            "req.body.password",
            "req.body.idToken",
            'req.headers["x-demo-moderator-token"]',
          ],
        }
      : false,
  });
  ctx.io = new Server(app.server, {
    cors: { origin: false },
    maxHttpBufferSize: 16 * 1024,
  });
  app.decorate("firestore", ctx);
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
  const anonymous = new Set([
    "/health",
    "/v1/capabilities",
    "/v1/demo/accounts",
    "/v1/demo/sessions",
    "/v1/auth/otp/request",
    "/v1/auth/otp/verify",
    "/v1/auth/google/config",
    "/v1/auth/google/challenge",
    "/v1/auth/google",
    "/v1/auth/methods",
    "/v1/auth/register",
    "/v1/auth/login",
    "/v1/auth/firebase",
  ]);
  const rates = new Map<string, { count: number; expiresAt: number }>();
  app.addHook("onRequest", async (req, reply) => {
    const now = ctx.config.now();
    let record = rates.get(req.ip);
    if (!record || record.expiresAt <= now) {
      record = { count: 0, expiresAt: now + 60_000 };
      rates.set(req.ip, record);
    }
    if (++record.count > 300) {
      reply.header("Retry-After", "60");
      throw new ApiError(429, "RATE_LIMIT", "Quá nhiều yêu cầu");
    }
    if (rates.size > 10_000)
      for (const [key, value] of rates)
        if (value.expiresAt <= now) rates.delete(key);
    if (
      anonymous.has(req.url.split("?")[0]) ||
      ((req.method === "GET" || req.method === "HEAD") &&
        req.routeOptions.config.publicDocumentation === true)
    ) return;
    const session = await authenticate(
      ctx,
      req.headers.authorization?.match(/^Bearer (.+)$/)?.[1]
    );
    req.actor = session.userId;
    req.sessionId = session.sessionKey;
  });
  app.get("/health", async () => {
    await ctx.root.get();
    return { data: { status: "ok", database: ctx.database, version: "0.2.0" } };
  });
  app.get("/v1/capabilities", async () => ({
    data: [
      {
        name: "database",
        mode: ctx.database.mode === "emulator" ? "demo" : "real",
        provider: ctx.database.provider,
        databaseMode: ctx.database.mode,
        projectId: ctx.database.projectId,
        namespace: ctx.database.namespace,
        reason:
          ctx.database.mode === "emulator"
            ? "Firestore Emulator: chưa phải kết nối cloud"
            : "Cloud Firestore",
      },
      { name: "core", mode: "real" },
      {
        name: "profile-images",
        mode: "real",
        storage: "backend-filesystem",
        notice: "Metadata trong Firestore; ảnh chưa lưu cloud storage",
      },
      { name: "location", mode: "real" },
      { name: "gif-sticker", mode: ctx.config.demoMode ? "demo" : "unavailable", reason: "No real GIF/sticker provider configured" },
      {
        name: "otp",
        mode: ctx.config.demoMode ? "demo" : "unavailable",
        reason: "Không gửi SMS; không xác minh sở hữu số điện thoại",
      },
      {
        name: "selfie",
        mode: ctx.config.demoMode ? "demo" : "unavailable",
        reason: "Chỉ tiếp nhận ảnh; không xác minh khuôn mặt thật",
      },
      {
        name: "video",
        mode: "unavailable",
        reason: "Chưa có xác thực thời lượng video",
      },
      {
        name: "oauth",
        ...googleConfig(ctx),
      },
      { name: "firebase-auth", ...firebaseConfig(ctx) },
      {
        name: "advanced",
        mode: "unavailable",
        reason: "Các tính năng nâng cao chưa được triển khai trong core Firestore",
      },
    ],
  }));
  try {
    await registerApiDocs(app);
    registerFirestoreAuth(app, ctx);
    registerFirestoreProfiles(app, ctx);
    registerFirestoreMedia(app, ctx);
    registerFirestoreMatching(app, ctx);
    registerFirestoreChat(app, ctx);
    registerFirestoreSafety(app, ctx);
    const stopSockets = configureFirestoreSocket(ctx);
    app.addHook("onClose", async () => {
      await stopSockets?.();
      await new Promise<void>((resolve) => ctx.io.close(() => resolve()));
      await ctx.close();
    });
    return app;
  } catch (error) {
    await new Promise<void>((resolve) => ctx.io.close(() => resolve()));
    await ctx.close();
    throw error;
  }
}
