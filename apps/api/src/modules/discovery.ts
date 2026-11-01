import type { FastifyInstance } from "fastify";
import { Domain, fail, uid, cursorPage, encodeCursor } from "../domain.js";
import { object, uuid, enumString } from "../schemas.js";
import { transaction } from "../db/database.js";
import { prefs } from "./profiles.js";
const distance = (a: any, b: any) => {
  const r = Math.PI / 180;
  const x =
    Math.sin(((b.latitude - a.latitude) * r) / 2) ** 2 +
    Math.cos(a.latitude * r) *
      Math.cos(b.latitude * r) *
      Math.sin(((b.longitude - a.longitude) * r) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(x));
};
export function registerDiscovery(app: FastifyInstance, d: Domain) {
  app.get("/v1/discovery", async (req) => {
    const { limit, cursor } = cursorPage(req.query),
      p = prefs(d, req.actor);
    const ownLoc = d.one("SELECT * FROM locations WHERE user_id=?", req.actor);
    const candidates = d
      .all(
        "SELECT u.id,u.created_at FROM users u WHERE u.id<>? AND u.account_status='active' AND NOT EXISTS(SELECT 1 FROM swipes s WHERE s.actor_id=? AND s.target_id=u.id) AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.actor_id=? AND b.target_id=u.id) OR (b.target_id=? AND b.actor_id=u.id)) AND NOT EXISTS(SELECT 1 FROM matches m WHERE (m.user_low=? AND m.user_high=u.id) OR (m.user_high=? AND m.user_low=u.id)) ORDER BY u.created_at,u.id",
        req.actor,
        req.actor,
        req.actor,
        req.actor,
        req.actor,
        req.actor
      )
      .filter(
        (u) =>
          !cursor ||
          u.created_at > cursor[0] ||
          (u.created_at === cursor[0] && u.id > cursor[1])
      )
      .filter((u) => {
        const profile = d.profile(u.id);
        if (
          !d.complete(u.id) ||
          !p.genders.includes(profile.gender) ||
          profile.age < p.minAge ||
          profile.age > p.maxAge
        )
          return false;
        const loc = d.one("SELECT * FROM locations WHERE user_id=?", u.id);
        return !ownLoc || !loc || distance(ownLoc, loc) <= p.radiusKm;
      });
    const page = candidates.slice(0, limit),
      last = page.at(-1);
    return {
      data: page.map((u) => d.profile(u.id)),
      meta: {
        nextCursor:
          candidates.length > limit && last
            ? encodeCursor([last.created_at, last.id])
            : null,
        radiusAvailable: !!ownLoc,
        reason: ownLoc
          ? "Chỉ lọc bán kính với hồ sơ có vị trí được đồng ý"
          : "Chưa có quyền vị trí; bán kính chưa áp dụng, không giả khoảng cách",
      },
    };
  });
  app.post(
    "/v1/swipes",
    {
      schema: {
        body: object({
          targetUserId: uuid,
          action: enumString(["like", "pass"]),
        }),
      },
    },
    async (req) => {
      const { targetUserId, action } = req.body as any;
      d.target(req.actor, targetUserId);
      if (
        d.blocked(req.actor, targetUserId) ||
        !d.complete(targetUserId) ||
        !d.complete(req.actor)
      )
        fail(
          422,
          "PROFILE_UNAVAILABLE",
          "Hồ sơ chưa đầy đủ hoặc không khả dụng"
        );
      return {
        data: transaction(d.db, () => {
          const [low, high] = [req.actor, targetUserId].sort();
          let m = d.one(
            "SELECT * FROM matches WHERE user_low=? AND user_high=?",
            low,
            high
          );
          if (m?.status === "ended")
            fail(409, "MATCH_ENDED", "Kết nối đã kết thúc; không tự match lại");
          let swipe = d.one(
            "SELECT * FROM swipes WHERE actor_id=? AND target_id=?",
            req.actor,
            targetUserId
          );
          if (swipe && swipe.action !== action)
            fail(409, "SWIPE_CONFLICT", "Đã chọn hồ sơ này");
          if (!swipe) {
            swipe = { id: uid() };
            d.run(
              "INSERT INTO swipes VALUES(?,?,?,?,?)",
              swipe.id,
              req.actor,
              targetUserId,
              action,
              d.date()
            );
          }
          if (
            action === "like" &&
            d.one(
              "SELECT 1 FROM swipes WHERE actor_id=? AND target_id=? AND action='like'",
              targetUserId,
              req.actor
            )
          ) {
            d.run(
              "INSERT OR IGNORE INTO matches(id,user_low,user_high,status,created_at) VALUES(?,?,?,'active',?)",
              uid(),
              low,
              high,
              d.date()
            );
            m = d.one(
              "SELECT * FROM matches WHERE user_low=? AND user_high=?",
              low,
              high
            );
          }
          return { swipeId: swipe.id, match: m ? d.match(m, req.actor) : null };
        }),
      };
    }
  );
  app.get("/v1/matches", async (req) => ({
    data: d
      .all(
        "SELECT * FROM matches WHERE status='active' AND (user_low=? OR user_high=?) ORDER BY created_at,id",
        req.actor,
        req.actor
      )
      .filter((m) => !d.blocked(m.user_low, m.user_high))
      .map((m) => d.match(m, req.actor)),
  }));
  app.delete<{ Params: { id: string } }>("/v1/matches/:id", async (req) => {
    const body = req.body as any;
    if (
      body !== undefined &&
      (!body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        Object.keys(body).some((k) => k !== "reasonCode") ||
        (body.reasonCode !== undefined &&
          (typeof body.reasonCode !== "string" || body.reasonCode.length > 80)))
    )
      fail(400, "VALIDATION_ERROR", "reasonCode không hợp lệ");
    d.matchAccess(req.actor, req.params.id);
    d.endMatch(req.params.id, "unmatched");
    return { data: { ended: true } };
  });
}
