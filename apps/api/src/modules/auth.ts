import type { FastifyInstance } from "fastify";
import { Domain, fail, hash, uid } from "../domain.js";
import { object, str, enumString } from "../schemas.js";
import { randomInt } from "node:crypto";
import { transaction } from "../db/database.js";
export function registerAuth(app: FastifyInstance, d: Domain) {
  app.get("/v1/demo/accounts", async () => {
    if (!d.config.demoMode) fail(404, "NOT_FOUND", "Demo đã tắt");
    return {
      data: d
        .all(
          "SELECT demo_account AS account,id FROM users WHERE demo_account IS NOT NULL ORDER BY demo_account"
        )
        .map((u) => ({
          account: u.account,
          displayName: d.user(u.id).displayName,
        })),
    };
  });
  app.post(
    "/v1/demo/sessions",
    { schema: { body: object({ account: enumString(["A", "B", "C", "D"]) }) } },
    async (req) => {
      if (!d.config.demoMode) fail(404, "NOT_FOUND", "Demo đã tắt");
      const u = d.one(
        "SELECT id FROM users WHERE demo_account=?",
        (req.body as any).account
      );
      if (!u) fail(404, "NOT_FOUND", "Chưa có tài khoản mẫu");
      return { data: d.session(u.id) };
    }
  );
  app.post(
    "/v1/auth/otp/request",
    {
      schema: {
        body: object({
          phone: { ...str(16), pattern: "^\\+[1-9][0-9]{7,14}$" },
        }),
      },
    },
    async (req, reply) => {
      if (!d.config.demoMode)
        fail(
          503,
          "PROVIDER_UNAVAILABLE",
          "SMS chưa được cấu hình; không tự gửi OTP demo"
        );
      const { phone } = req.body as any;
      const now = d.config.now();
      if (
        d.one(
          "SELECT count(*) AS count FROM otp_challenges WHERE phone=? AND created_at>?",
          phone,
          now - 15 * 60_000
        ).count >= 5
      ) {
        reply.header("Retry-After", "900");
        fail(429, "OTP_RATE_LIMIT", "Tối đa 5 yêu cầu trong 15 phút");
      }
      const id = uid(),
        code = String(randomInt(100000, 1000000)),
        expires = now + d.config.otpTtlMs;
      d.run(
        "INSERT INTO otp_challenges(id,phone,code_hash,expires_at,created_at) VALUES(?,?,?,?,?)",
        id,
        phone,
        hash(id + code),
        expires,
        now
      );
      return {
        data: {
          challengeId: id,
          expiresAt: new Date(expires).toISOString(),
          mode: "demo",
          demoCode: code,
        },
      };
    }
  );
  app.post(
    "/v1/auth/otp/verify",
    {
      schema: {
        body: object({
          challengeId: { type: "string", format: "uuid" },
          code: { type: "string", pattern: "^[0-9]{6}$" },
        }),
      },
    },
    async (req) => {
      if (!d.config.demoMode)
        fail(503, "PROVIDER_UNAVAILABLE", "SMS chưa được cấu hình");
      const { challengeId, code } = req.body as any;
      const c = d.one("SELECT * FROM otp_challenges WHERE id=?", challengeId);
      if (
        !c ||
        c.consumed_at !== null ||
        c.expires_at <= d.config.now() ||
        c.attempts >= 5
      )
        fail(400, "OTP_INVALID", "OTP đã hết hạn, đã dùng hoặc hết lượt thử");
      d.run(
        "UPDATE otp_challenges SET attempts=attempts+1 WHERE id=?",
        challengeId
      );
      if (hash(challengeId + code) !== c.code_hash)
        fail(400, "OTP_INVALID", "Mã OTP không đúng");
      return {
        data: transaction(d.db, () => {
          d.run(
            "UPDATE otp_challenges SET consumed_at=? WHERE id=?",
            d.config.now(),
            challengeId
          );
          let user = d.one("SELECT id FROM users WHERE phone=?", c.phone);
          if (!user) {
            user = { id: uid() };
            d.run(
              "INSERT INTO users(id,phone,created_at) VALUES(?,?,?)",
              user.id,
              c.phone,
              d.date()
            );
            d.run(
              "INSERT INTO profiles(user_id,display_name) VALUES(?,?)",
              user.id,
              "Thành viên mới"
            );
            d.run(
              "INSERT INTO discovery_preferences(user_id) VALUES(?)",
              user.id
            );
          }
          return d.session(user.id);
        }),
      };
    }
  );
  app.get("/v1/me", async (req) => ({ data: d.user(req.actor) }));
  app.post("/v1/auth/logout", async (req) => {
    d.run(
      "UPDATE sessions SET revoked_at=? WHERE id=?",
      d.config.now(),
      req.sessionId
    );
    for (const socket of d.io.sockets.sockets.values()) {
      if (socket.data.sessionId === req.sessionId) socket.disconnect(true);
    }
    return { data: { revoked: true } };
  });
}
