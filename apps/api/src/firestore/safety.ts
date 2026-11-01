import type { FastifyInstance } from "fastify";
import { FirestoreContext, fail, uid } from "./context.js";
import { object, uuid, str } from "../schemas.js";
import {
  pairDocumentId,
  assertMatchMember,
  endFirestoreMatchRooms,
  requireTransactionSession,
  pagination,
  encodePageCursor,
} from "./matching.js";

export function registerFirestoreSafety(
  app: FastifyInstance,
  ctx: FirestoreContext
) {
  app.post(
    "/v1/blocks",
    { schema: { body: object({ targetUserId: uuid }) } },
    async (req) => {
      const { targetUserId } = req.body as any,
        actor = req.actor;
      if (actor === targetUserId)
        fail(422, "SELF_ACTION", "Không thể chọn chính mình");
      const matchId = pairDocumentId(actor, targetUserId);
      const ended = await ctx.db.runTransaction(async (tx) => {
        const [user, block, match] = await tx.getAll(
          ctx.ref("users", targetUserId),
          ctx.ref("blocks", `${actor}_${targetUserId}`),
          ctx.ref("matches", matchId)
        );
        await requireTransactionSession(ctx, tx, actor, req.sessionId);
        if (user.data()?.accountStatus !== "active")
          fail(404, "NOT_FOUND", "Không tìm thấy hồ sơ");
        if (!block.exists)
          tx.create(ctx.ref("blocks", `${actor}_${targetUserId}`), {
            id: targetUserId,
            actorId: actor,
            targetUserId,
            createdAt: ctx.date(),
          });
        // Always touch an active match, the same document used by the send transaction.
        if (match.data()?.status === "active") {
          tx.update(ctx.ref("matches", matchId), {
            status: "ended",
            endedAt: ctx.date(),
            endedReason: "blocked",
          });
          return true;
        }
        return false;
      });
      if (ended) endFirestoreMatchRooms(ctx, matchId, "blocked");
      return { data: { blocked: true } };
    }
  );
  app.delete<{ Params: { userId: string } }>(
    "/v1/blocks/:userId",
    async (req) => {
      await ctx.db.runTransaction(async (tx) => {
        await requireTransactionSession(ctx, tx, req.actor, req.sessionId);
        tx.delete(ctx.ref("blocks", `${req.actor}_${req.params.userId}`));
      });
      return { data: { blocked: false } };
    }
  );
  app.get("/v1/blocks", async (req) => {
    const { limit, cursor } = pagination(req.query);
    let query = ctx
      .collection("blocks")
      .where("actorId", "==", req.actor)
      .orderBy("createdAt")
      .orderBy("id")
      .limit(limit + 1);
    if (cursor) query = query.startAfter(...cursor);
    const rows = (await query.get()).docs.map((document) => document.data()),
      page = rows.slice(0, limit);
    return {
      data: page.map((row) => ({
        targetUserId: row.targetUserId,
        createdAt: row.createdAt,
      })),
      meta: {
        nextCursor:
          rows.length > limit && page.length
            ? encodePageCursor(page.at(-1)!)
            : null,
      },
    };
  });
  app.post(
    "/v1/reports",
    {
      schema: {
        body: object(
          {
            targetUserId: uuid,
            reasonCode: str(80),
            detail: { type: "string", maxLength: 2000 },
            matchId: uuid,
          },
          ["targetUserId", "reasonCode"]
        ),
      },
    },
    async (req) => {
      const body = req.body as any,
        id = uid();
      if (body.targetUserId === req.actor)
        fail(422, "SELF_ACTION", "Không thể chọn chính mình");
      await ctx.db.runTransaction(async (tx) => {
        const user = (await tx.get(ctx.ref("users", body.targetUserId))).data();
        await requireTransactionSession(ctx, tx, req.actor, req.sessionId);
        if (user?.accountStatus !== "active")
          fail(404, "NOT_FOUND", "Không tìm thấy hồ sơ");
        if (body.matchId) {
          const match = (await tx.get(ctx.ref("matches", body.matchId))).data();
          assertMatchMember(match, req.actor);
          if (!match.memberIds.includes(body.targetUserId))
            fail(404, "NOT_FOUND", "Không tìm thấy kết nối");
        }
        tx.create(ctx.ref("reports", id), {
          id,
          reporterId: req.actor,
          targetUserId: body.targetUserId,
          matchId: body.matchId ?? null,
          reasonCode: body.reasonCode,
          detail: body.detail ?? null,
          status: "received",
          createdAt: ctx.date(),
        });
      });
      return { data: { id, status: "received" } };
    }
  );
}
