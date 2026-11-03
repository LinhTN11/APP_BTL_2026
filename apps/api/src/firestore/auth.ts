import type { FastifyInstance } from "fastify";
import { randomBytes, randomInt } from "node:crypto";
import { FirestoreContext, fail, hash, uid } from "./context.js";
import { object, enumString, str, uuid } from "../schemas.js";
import { registerFirebaseAuth } from "./firebase-auth.js";

export const defaultPreferences = () => ({
  genders: ["female", "male", "other"],
  minAge: 18,
  maxAge: 100,
  radiusKm: 100,
  advancedFilters: {},
});
export const emptyProfile = (id: string) => ({
  userId: id,
  displayName: "Thành viên mới",
  dateOfBirth: null,
  gender: "other",
  bio: "",
  datingGoal: "relationship",
  interests: [],
  lifestyle: {},
  advanced: {},
  mediaIds: [],
  visibility: "public",
});
export async function authenticate(ctx: FirestoreContext, token?: string) {
  if (!token || token.length > 512)
    return fail(401, "UNAUTHORIZED", "Vui lòng đăng nhập");
  const sessionKey = hash(token),
    session = (await ctx.ref("sessions", sessionKey).get()).data();
  if (
    !session ||
    session.revokedAt !== null ||
    session.expiresAt <= ctx.config.now()
  )
    return fail(401, "SESSION_EXPIRED", "Phiên đăng nhập không còn hiệu lực");
  const user = (await ctx.ref("users", session.userId).get()).data();
  if (!ctx.availableUser(user) || (!ctx.config.demoMode && session.mode === "demo"))
    return fail(401, "SESSION_EXPIRED", "Phiên đăng nhập không còn hiệu lực");
  return {
    userId: session.userId as string,
    sessionKey,
    expiresAt: session.expiresAt as number,
  };
}
async function session(ctx: FirestoreContext, userId: string) {
  const token = randomBytes(32).toString("base64url"),
    key = hash(token),
    expiresAt = ctx.config.now() + ctx.config.sessionTtlMs;
  const user = await ctx.db.runTransaction(async (tx) => {
    const [u, p] = await tx.getAll(
      ctx.ref("users", userId),
      ctx.ref("profiles", userId)
    );
    if (!u.exists || u.data()!.accountStatus !== "active" || !p.exists)
      return fail(401, "SESSION_EXPIRED", "Tài khoản không còn hiệu lực");
    tx.create(ctx.ref("sessions", key), {
      userId,
      expiresAt,
      revokedAt: null,
      createdAt: ctx.date(),
      mode: "demo",
    });
    return { id: userId, displayName: p.data()!.displayName };
  });
  return { token, expiresAt: new Date(expiresAt).toISOString(), user };
}
export function registerFirestoreAuth(
  app: FastifyInstance,
  ctx: FirestoreContext
) {
  registerFirebaseAuth(app, ctx);
  app.get("/v1/demo/accounts", async () => {
    if (!ctx.config.demoMode) fail(404, "NOT_FOUND", "Demo đã tắt");
    const result = [];
    for (const account of ["A", "B", "C", "D"]) {
      const demo = (await ctx.ref("demoAccounts", account).get()).data();
      if (demo) {
        const u = (await ctx.ref("users", demo.userId).get()).data();
        if (u?.accountStatus === "active")
          result.push({
            account,
            displayName: (await ctx.user(demo.userId)).displayName,
          });
      }
    }
    return { data: result };
  });
  app.post(
    "/v1/demo/sessions",
    { schema: { body: object({ account: enumString(["A", "B", "C", "D"]) }) } },
    async (req) => {
      if (!ctx.config.demoMode) fail(404, "NOT_FOUND", "Demo đã tắt");
      const demo = (
        await ctx.ref("demoAccounts", (req.body as any).account).get()
      ).data();
      if (!demo)
        return fail(
          404,
          "NOT_FOUND",
          "Chưa có tài khoản mẫu; chạy seed demo tường minh"
        );
      return { data: await session(ctx, demo.userId) };
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
      if (!ctx.config.demoMode)
        fail(
          503,
          "PROVIDER_UNAVAILABLE",
          "SMS chưa được cấu hình; không tự gửi OTP demo"
        );
      const { phone } = req.body as any,
        now = ctx.config.now(),
        id = uid(),
        code = String(randomInt(100000, 1000000)),
        expiresAt = now + ctx.config.otpTtlMs;
      const allowed = await ctx.db.runTransaction(async (tx) => {
        const rateRef = ctx.ref("otpRates", hash(phone)),
          rate = (await tx.get(rateRef)).data();
        const requests = (rate?.requests ?? []).filter(
          (n: number) => n > now - 900_000
        );
        if (requests.length >= 5) return false;
        tx.set(rateRef, { requests: [...requests, now] });
        tx.create(ctx.ref("otpChallenges", id), {
          phone,
          codeHash: hash(id + code),
          expiresAt,
          createdAt: now,
          attempts: 0,
          consumedAt: null,
          mode: "demo",
        });
        return true;
      });
      if (!allowed) {
        reply.header("Retry-After", "900");
        fail(429, "OTP_RATE_LIMIT", "Tối đa 5 yêu cầu trong 15 phút");
      }
      return {
        data: {
          challengeId: id,
          expiresAt: new Date(expiresAt).toISOString(),
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
          challengeId: uuid,
          code: { type: "string", pattern: "^[0-9]{6}$" },
        }),
      },
    },
    async (req) => {
      if (!ctx.config.demoMode)
        fail(503, "PROVIDER_UNAVAILABLE", "SMS chưa được cấu hình");
      const { challengeId, code } = req.body as any,
        token = randomBytes(32).toString("base64url"),
        sessionKey = hash(token),
        expiresAt = ctx.config.now() + ctx.config.sessionTtlMs,
        newUserId = uid();
      const result = await ctx.db.runTransaction(async (tx) => {
        const challengeRef = ctx.ref("otpChallenges", challengeId),
          c = (await tx.get(challengeRef)).data();
        if (
          !c ||
          c.consumedAt !== null ||
          c.expiresAt <= ctx.config.now() ||
          c.attempts >= 5
        )
          return { error: true as const };
        if (hash(challengeId + code) !== c.codeHash) {
          tx.update(challengeRef, { attempts: c.attempts + 1 });
          return { error: true as const };
        }
        const identityRef = ctx.ref("phoneIdentities", hash(c.phone)),
          identity = (await tx.get(identityRef)).data();
        const userId = identity?.userId ?? newUserId;
        const [u, p] = await tx.getAll(
          ctx.ref("users", userId),
          ctx.ref("profiles", userId)
        );
        if (
          identity &&
          (!u.exists || u.data()!.accountStatus !== "active" || !p.exists)
        )
          return { error: true as const };
        // Every read precedes writes; the phone identity document serializes distinct challenges for the same phone.
        if (!identity) {
          tx.create(identityRef, { userId, createdAt: ctx.date() });
          tx.create(ctx.ref("users", userId), {
            id: userId,
            phone: c.phone,
            accountStatus: "active",
            createdAt: ctx.date(),
          });
          tx.create(ctx.ref("profiles", userId), emptyProfile(userId));
          tx.create(ctx.ref("preferences", userId), defaultPreferences());
        }
        tx.update(challengeRef, {
          consumedAt: ctx.config.now(),
          attempts: c.attempts + 1,
        });
        tx.create(ctx.ref("sessions", sessionKey), {
          userId,
          expiresAt,
          mode: "demo",
          revokedAt: null,
          createdAt: ctx.date(),
        });
        return {
          error: false as const,
          user: {
            id: userId,
            displayName: p.data()?.displayName ?? "Thành viên mới",
          },
        };
      });
      if (result.error)
        return fail(
          400,
          "OTP_INVALID",
          "OTP không đúng, đã hết hạn, đã dùng hoặc hết lượt thử"
        );
      return {
        data: {
          token,
          expiresAt: new Date(expiresAt).toISOString(),
          user: result.user,
        },
      };
    }
  );
  app.get("/v1/me", async (req) => ({ data: await ctx.user(req.actor) }));
  app.post("/v1/auth/logout", async (req) => {
    await ctx
      .ref("sessions", req.sessionId)
      .update({ revokedAt: ctx.config.now() });
    if (ctx.io)
      for (const socket of ctx.io.sockets.sockets.values())
        if (
          socket.data.sessionKey === req.sessionId ||
          socket.data.sessionId === req.sessionId
        )
          socket.disconnect(true);
    return { data: { revoked: true } };
  });
}
