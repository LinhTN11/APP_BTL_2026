import type { FastifyInstance } from "fastify";
import { Domain, fail, uid, cursorPage, encodeCursor } from "../domain.js";
import { object, uuid, str, messageBody, coords } from "../schemas.js";
export const catalog = {
  gifs: ["coffee", "hello", "celebrate"],
  stickers: ["heart", "wave", "smile"],
};
export function registerChat(app: FastifyInstance, d: Domain) {
  app.get("/v1/chat/catalog", async () => ({ data: catalog }));
  app.get<{ Params: { id: string } }>(
    "/v1/matches/:id/messages",
    async (req) => {
      d.matchAccess(req.actor, req.params.id);
      const { limit, cursor } = cursorPage(req.query);
      const rows = d
        .all(
          "SELECT * FROM messages WHERE match_id=? ORDER BY created_at,id",
          req.params.id
        )
        .filter(
          (m) =>
            !cursor ||
            m.created_at > cursor[0] ||
            (m.created_at === cursor[0] && m.id > cursor[1])
        );
      const page = rows.slice(0, limit),
        last = page.at(-1);
      return {
        data: page.map((m) => d.message(m)),
        meta: {
          nextCursor:
            rows.length > limit && last
              ? encodeCursor([last.created_at, last.id])
              : null,
        },
      };
    }
  );
  app.post<{ Params: { id: string } }>(
    "/v1/matches/:id/messages",
    { schema: { body: messageBody } },
    async (req) => {
      d.matchAccess(req.actor, req.params.id);
      const b = req.body as any;
      let content: any = {};
      if (b.kind === "text") {
        if (
          typeof b.text !== "string" ||
          !b.text.trim() ||
          b.payload !== undefined
        )
          fail(
            400,
            "MESSAGE_INVALID",
            "Tin nhắn text cần nội dung, không có payload"
          );
        content = { text: b.text };
      } else if (b.kind === "location") {
        const p = b.payload;
        if (
          b.text !== undefined ||
          !p ||
          Object.keys(p).sort().join(",") !== "latitude,longitude" ||
          typeof p.latitude !== "number" ||
          typeof p.longitude !== "number" ||
          !Number.isFinite(p.latitude) ||
          !Number.isFinite(p.longitude) ||
          Math.abs(p.latitude) > 90 ||
          Math.abs(p.longitude) > 180
        )
          fail(
            400,
            "LOCATION_INVALID",
            "Cần vị trí do chính người gửi chia sẻ"
          );
        content = { payload: { latitude: p.latitude, longitude: p.longitude } };
      } else {
        const allowed = b.kind === "gif" ? catalog.gifs : catalog.stickers;
        if (
          b.text !== undefined ||
          !b.payload ||
          Object.keys(b.payload).join(",") !== "catalogId" ||
          !allowed.includes(b.payload.catalogId)
        )
          fail(400, "CATALOG_INVALID", "Chọn catalogId từ danh mục local");
        content = { payload: { catalogId: b.payload.catalogId } };
      }
      const json = JSON.stringify(content);
      const existing = d.one(
        "SELECT * FROM messages WHERE sender_id=? AND client_message_id=?",
        req.actor,
        b.clientMessageId
      );
      if (existing) {
        if (
          existing.match_id !== req.params.id ||
          existing.kind !== b.kind ||
          existing.content_json !== json
        )
          fail(
            409,
            "MESSAGE_RETRY_CONFLICT",
            "clientMessageId đã có nội dung khác"
          );
        return { data: d.message(existing) };
      }
      const id = uid();
      const last = d.one(
        "SELECT max(created_at) AS latest FROM messages WHERE match_id=?",
        req.params.id
      ).latest;
      // Monotonic timestamps keep forward cursors valid when messages arrive in the same millisecond.
      const createdAt = new Date(
        Math.max(d.config.now(), last ? Date.parse(last) + 1 : 0)
      ).toISOString();
      d.run(
        "INSERT INTO messages VALUES(?,?,?,?,?,?,?)",
        id,
        req.params.id,
        req.actor,
        b.clientMessageId,
        b.kind,
        json,
        createdAt
      );
      const message = d.message(d.one("SELECT * FROM messages WHERE id=?", id));
      for (const socket of d.io.sockets.sockets.values()) {
        try {
          d.authenticate(socket.data.token);
        } catch {
          socket.disconnect(true);
        }
      }
      d.io.to(`match:${req.params.id}`).emit("message:created", message);
      return { data: message };
    }
  );
  app.post(
    "/v1/blocks",
    { schema: { body: object({ targetUserId: uuid }) } },
    async (req) => {
      const id = (req.body as any).targetUserId;
      d.target(req.actor, id);
      d.run(
        "INSERT OR IGNORE INTO blocks VALUES(?,?,?)",
        req.actor,
        id,
        d.date()
      );
      for (const m of d.all(
        "SELECT id FROM matches WHERE status='active' AND ((user_low=? AND user_high=?) OR (user_low=? AND user_high=?))",
        req.actor,
        id,
        id,
        req.actor
      ))
        d.endMatch(m.id, "blocked");
      return { data: { blocked: true } };
    }
  );
  app.delete<{ Params: { userId: string } }>(
    "/v1/blocks/:userId",
    async (req) => {
      d.run(
        "DELETE FROM blocks WHERE actor_id=? AND target_id=?",
        req.actor,
        req.params.userId
      );
      return { data: { blocked: false } };
    }
  );
  app.get("/v1/blocks", async (req) => ({
    data: d.all(
      "SELECT target_id AS targetUserId,created_at AS createdAt FROM blocks WHERE actor_id=? ORDER BY created_at,target_id",
      req.actor
    ),
  }));
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
      const b = req.body as any;
      d.target(req.actor, b.targetUserId);
      if (b.matchId) {
        const m = d.one("SELECT * FROM matches WHERE id=?", b.matchId);
        if (
          !m ||
          ![m.user_low, m.user_high].includes(req.actor) ||
          ![m.user_low, m.user_high].includes(b.targetUserId)
        )
          fail(404, "NOT_FOUND", "Không tìm thấy kết nối");
      }
      const id = uid();
      d.run(
        "INSERT INTO reports VALUES(?,?,?,?,?,?,?)",
        id,
        req.actor,
        b.targetUserId,
        b.matchId ?? null,
        b.reasonCode,
        b.detail ?? null,
        d.date()
      );
      return { data: { id, status: "received" } };
    }
  );
}
