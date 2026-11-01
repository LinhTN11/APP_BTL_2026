import type { FastifyInstance } from "fastify";
import type { Socket } from "socket.io";
import { FirestoreContext, ApiError, fail, hash, uid } from "./context.js";
import { authenticate } from "./auth.js";
import { messageBody, object, uuid } from "../schemas.js";
import {
  requireActiveFirestoreMatch,
  requireTransactionSession,
  pagination,
  encodePageCursor,
} from "./matching.js";

export const catalog = {
  gifs: ["coffee", "hello", "celebrate"],
  stickers: ["heart", "wave", "smile"],
};
function messageContent(body: any) {
  if (body.kind === "text") {
    if (
      typeof body.text !== "string" ||
      !body.text.trim() ||
      body.payload !== undefined
    )
      fail(
        400,
        "MESSAGE_INVALID",
        "Tin nhắn text cần nội dung, không có payload"
      );
    return { text: body.text };
  }
  const payload = body.payload;
  if (body.kind === "location") {
    if (
      body.text !== undefined ||
      !payload ||
      Object.keys(payload).sort().join(",") !== "latitude,longitude" ||
      typeof payload.latitude !== "number" ||
      typeof payload.longitude !== "number" ||
      !Number.isFinite(payload.latitude) ||
      !Number.isFinite(payload.longitude) ||
      Math.abs(payload.latitude) > 90 ||
      Math.abs(payload.longitude) > 180
    )
      fail(400, "LOCATION_INVALID", "Cần vị trí do chính người gửi chia sẻ");
    return {
      payload: { latitude: payload.latitude, longitude: payload.longitude },
    };
  }
  const allowed = body.kind === "gif" ? catalog.gifs : catalog.stickers;
  if (
    body.text !== undefined ||
    !payload ||
    Object.keys(payload).join(",") !== "catalogId" ||
    !allowed.includes(payload.catalogId)
  )
    fail(400, "CATALOG_INVALID", "Chọn catalogId từ danh mục local");
  return { payload: { catalogId: payload.catalogId } };
}
function messageDto(message: any) {
  const { id, matchId, senderId, clientMessageId, kind, createdAt } = message;
  return {
    id,
    matchId,
    senderId,
    clientMessageId,
    kind,
    ...(message.text !== undefined
      ? { text: message.text }
      : { payload: message.payload }),
    createdAt,
  };
}
async function pruneExpiredSockets(ctx: FirestoreContext) {
  await Promise.all(
    [...ctx.io.sockets.sockets.values()].map(async (socket) => {
      try {
        await authenticate(ctx, socket.data.token);
      } catch {
        socket.disconnect(true);
      }
    })
  );
}
export function registerFirestoreChat(
  app: FastifyInstance,
  ctx: FirestoreContext
) {
  app.get("/v1/chat/catalog", async () => ({ data: catalog }));
  app.get<{ Params: { id: string } }>(
    "/v1/matches/:id/messages",
    async (req) => {
      const { limit, cursor } = pagination(req.query);
      // The read transaction rejects a concurrent lifecycle update before returning history.
      const rows = await ctx.db.runTransaction(async (tx) => {
        await requireActiveFirestoreMatch(ctx, req.actor, req.params.id, tx);
        await requireTransactionSession(ctx, tx, req.actor, req.sessionId);
        let query = ctx
          .collection("messages")
          .where("matchId", "==", req.params.id)
          .orderBy("createdAt")
          .orderBy("id")
          .limit(limit + 1);
        if (cursor) query = query.startAfter(...cursor);
        return (await tx.get(query)).docs.map((document) => document.data());
      });
      const page = rows.slice(0, limit);
      return {
        data: page.map(messageDto),
        meta: {
          nextCursor:
            rows.length > limit && page.length
              ? encodePageCursor(page.at(-1)!)
              : null,
        },
      };
    }
  );
  app.post<{ Params: { id: string } }>(
    "/v1/matches/:id/messages",
    { schema: { body: messageBody } },
    async (req) => {
      const body = req.body as any,
        content = messageContent(body),
        contentKey = JSON.stringify({ kind: body.kind, ...content });
      const key = hash(`${req.actor}:${body.clientMessageId}`),
        messageId = uid();
      const result = await ctx.db.runTransaction(async (tx) => {
        const match = await requireActiveFirestoreMatch(
          ctx,
          req.actor,
          req.params.id,
          tx
        );
        await requireTransactionSession(ctx, tx, req.actor, req.sessionId);
        const existing = (await tx.get(ctx.ref("messageKeys", key))).data();
        if (existing) {
          if (
            existing.matchId !== req.params.id ||
            existing.contentKey !== contentKey
          )
            fail(
              409,
              "MESSAGE_RETRY_CONFLICT",
              "clientMessageId đã có nội dung khác"
            );
          const saved = (
            await tx.get(ctx.ref("messages", existing.messageId))
          ).data();
          if (!saved)
            fail(
              500,
              "MESSAGE_STORAGE_ERROR",
              "Không tìm thấy tin nhắn đã ghi"
            );
          return { message: saved, created: false };
        }
        const createdAt = new Date(
          Math.max(
            ctx.config.now(),
            match.lastMessageAt ? Date.parse(match.lastMessageAt) + 1 : 0
          )
        ).toISOString();
        const message = {
          id: messageId,
          matchId: req.params.id,
          senderId: req.actor,
          clientMessageId: body.clientMessageId,
          kind: body.kind,
          ...content,
          createdAt,
        };
        tx.create(ctx.ref("messages", messageId), message);
        tx.create(ctx.ref("messageKeys", key), {
          messageId,
          matchId: req.params.id,
          contentKey,
        });
        tx.update(ctx.ref("matches", req.params.id), {
          lastMessageAt: createdAt,
        });
        return { message, created: true };
      });
      if (result.created) {
        await pruneExpiredSockets(ctx);
        try {
          await requireActiveFirestoreMatch(ctx, req.actor, req.params.id);
          ctx.io
            .to(`match:${req.params.id}`)
            .emit("message:created", messageDto(result.message));
        } catch (error) {
          if (!(error instanceof ApiError) || error.code !== "MATCH_INACTIVE")
            throw error;
        }
      }
      return { data: messageDto(result.message) };
    }
  );
  app.post<{ Params: { id: string } }>(
    "/v1/matches/:id/read",
    { schema: { body: object({ messageId: uuid }, []) } },
    async (req) => {
      const messageId = (req.body as any)?.messageId;
      await ctx.db.runTransaction(async (tx) => {
        await requireActiveFirestoreMatch(ctx, req.actor, req.params.id, tx);
        await requireTransactionSession(ctx, tx, req.actor, req.sessionId);
        if (messageId) {
          const message = (await tx.get(ctx.ref("messages", messageId))).data();
          if (message?.matchId !== req.params.id)
            fail(404, "NOT_FOUND", "Không tìm thấy tin nhắn");
        }
        tx.set(ctx.ref("readCursors", `${req.actor}_${req.params.id}`), {
          userId: req.actor,
          matchId: req.params.id,
          messageId: messageId ?? null,
          readAt: ctx.date(),
        });
      });
      return { data: { read: true } };
    }
  );
}

export function configureFirestoreSocket(ctx: FirestoreContext) {
  const io = ctx.io;
  io.use((socket, next) => {
    void authenticate(ctx, socket.handshake.auth.token)
      .then((session) => {
        socket.data.userId = session.userId;
        socket.data.sessionId = session.sessionKey;
        socket.data.token = socket.handshake.auth.token;
        socket.data.expiresAt = session.expiresAt;
        next();
      })
      .catch((error) =>
        next(
          Object.assign(new Error("UNAUTHORIZED"), {
            data: { code: "UNAUTHORIZED", message: error.message },
          })
        )
      );
  });
  io.on("connection", (socket) => {
    const expiry = setTimeout(
      () => socket.disconnect(true),
      Math.max(1, socket.data.expiresAt - ctx.config.now())
    );
    expiry.unref();
    const subscriptions = new Map<string, () => void>();
    let closed = false;
    socket.on("disconnect", () => {
      closed = true;
      clearTimeout(expiry);
      for (const unsubscribe of subscriptions.values()) unsubscribe();
      subscriptions.clear();
    });
    socket.on("match:subscribe", (body: any, ack: any) => {
      if (typeof ack !== "function") return;
      void (async () => {
        await authenticate(ctx, socket.data.token);
        if (
          !body ||
          typeof body.matchId !== "string" ||
          !/^[\da-f-]{36}$/i.test(body.matchId) ||
          Object.keys(body).some((key) => key !== "matchId")
        )
          fail(400, "VALIDATION_ERROR", "Thiếu matchId hợp lệ");
        if (!subscriptions.has(body.matchId) && subscriptions.size >= 50)
          fail(429, "SUBSCRIPTION_LIMIT", "Quá nhiều kết nối hội thoại");
        await requireActiveFirestoreMatch(
          ctx,
          socket.data.userId,
          body.matchId
        );
        const room = `match:${body.matchId}`;
        if (closed || !socket.connected) {
          await socket.leave(room);
          return;
        }
        await socket.join(room);
        if (closed || !socket.connected) {
          await socket.leave(room);
          return;
        }
        // Joining is asynchronous; recheck after joining so a concurrent end cannot retain the room.
        await requireActiveFirestoreMatch(
          ctx,
          socket.data.userId,
          body.matchId
        );
        if (closed || !socket.connected) {
          await socket.leave(room);
          return;
        }
        if (!subscriptions.has(body.matchId)) {
          const unsubscribe = ctx.ref("matches", body.matchId).onSnapshot(
            (snapshot) => {
              if (snapshot.data()?.status !== "active") {
                // A listener can observe commit before the HTTP post-commit callback.
                // Deliver lifecycle before leaving, including for another backend's commit.
                socket.emit("match:ended", {
                  matchId: body.matchId,
                  reason:
                    snapshot.data()?.endedReason === "blocked"
                      ? "blocked"
                      : "unmatched",
                });
                void socket.leave(room);
                subscriptions.get(body.matchId)?.();
                subscriptions.delete(body.matchId);
              }
            },
            () => {
              void socket.leave(room);
              subscriptions.get(body.matchId)?.();
              subscriptions.delete(body.matchId);
            }
          );
          subscriptions.set(body.matchId, unsubscribe);
        }
        ack({ ok: true });
      })().catch((error) => {
        if (body?.matchId) void socket.leave(`match:${body.matchId}`);
        if (closed || !socket.connected) return;
        ack({
          ok: false,
          error: { code: error.code ?? "FORBIDDEN", message: error.message },
        });
        if (error.status === 401) socket.disconnect(true);
      });
    });
  });
  let sweeping: Promise<void> | undefined;
  const timer = setInterval(() => {
    if (!sweeping) {
      sweeping = pruneExpiredSockets(ctx)
        .catch(() => {})
        .finally(() => {
          sweeping = undefined;
        });
    }
  }, 1000);
  timer.unref();
  return async () => {
    clearInterval(timer);
    await sweeping;
  };
}
