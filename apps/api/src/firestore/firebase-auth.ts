import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { FirestoreContext, fail, hash, uid } from "./context.js";
import { defaultPreferences, emptyProfile } from "./auth.js";
import { object, str } from "../schemas.js";

export const firebaseExchangeSchema = object({ idToken: str(16384) });

/** These are client configuration values, never an Admin credential. */
export function firebaseConfig(ctx: FirestoreContext) {
  const apiKey = process.env.FIREBASE_API_KEY?.trim();
  const appId = process.env.FIREBASE_APP_ID?.trim();
  const authDomain = process.env.FIREBASE_AUTH_DOMAIN?.trim();
  if (!apiKey || !appId || !authDomain || !/^[a-zA-Z0-9.-]+$/.test(authDomain))
    return { mode: "unavailable" as const, reason: "Chưa cấu hình Firebase Authentication cho ứng dụng." };
  return {
    mode: "real" as const,
    config: { apiKey, appId, authDomain, projectId: ctx.database.projectId },
  };
}

export function googleConfig(ctx: FirestoreContext) {
  const firebase = firebaseConfig(ctx);
  if (firebase.mode !== "real") return firebase;
  const webClientId = process.env.GOOGLE_WEB_CLIENT_ID?.trim();
  if (!webClientId || !/^[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(webClientId))
    return { mode: "unavailable" as const, reason: "Đăng nhập Google chưa được cấu hình trên máy chủ." };
  return { mode: "real" as const, webClientId };
}

export function registerFirebaseAuth(app: FastifyInstance, ctx: FirestoreContext) {
  app.get("/v1/auth/methods", async () => {
    const firebase = firebaseConfig(ctx);
    return { data: { firebase, email: { mode: firebase.mode, ...(firebase.mode === "unavailable" ? { reason: firebase.reason } : {}) }, google: googleConfig(ctx) } };
  });
  app.get("/v1/auth/google/config", async () => ({ data: googleConfig(ctx) }));
  // No passwords reach this API, and no parallel custom identity source remains.
  for (const path of ["/v1/auth/register", "/v1/auth/login", "/v1/auth/google", "/v1/auth/google/challenge"])
    app.post(path, async () => fail(410, "AUTH_SDK_REQUIRED", "Vui lòng cập nhật ứng dụng để đăng nhập bằng Firebase Authentication."));

  app.post("/v1/auth/firebase", { schema: { body: firebaseExchangeSchema } }, async req => {
    if (firebaseConfig(ctx).mode !== "real")
      return fail(503, "PROVIDER_UNAVAILABLE", "Chưa cấu hình Firebase Authentication cho ứng dụng.");
    const { idToken } = req.body as { idToken: string };
    let decoded;
    try {
      // true also rejects disabled users and tokens issued before revocation.
      decoded = await ctx.firebaseAuth.verifyIdToken(idToken, true);
      if (!decoded.uid || decoded.uid.length > 128 || decoded.aud !== ctx.database.projectId ||
        decoded.iss !== `https://securetoken.google.com/${ctx.database.projectId}` ||
        decoded.exp * 1000 <= ctx.config.now() || decoded.auth_time * 1000 > ctx.config.now() + 60_000 ||
        !["password", "google.com"].includes(decoded.firebase?.sign_in_provider))
        throw new Error("Invalid Firebase identity");
    } catch {
      return fail(401, "FIREBASE_TOKEN_INVALID", "Không xác thực được tài khoản. Vui lòng đăng nhập lại.");
    }
    const identityUid = decoded.uid;
    const displayName = typeof decoded.name === "string" ? decoded.name.trim().slice(0, 80) || "Thành viên mới" : "Thành viên mới";
    const token = randomBytes(32).toString("base64url"), newUserId = uid();
    const expiresAt = ctx.config.now() + ctx.config.sessionTtlMs;
    const user = await ctx.db.runTransaction(async tx => {
      // Firebase UID is the only identity key. Email/provider labels never link users.
      const identityRef = ctx.ref("firebaseIdentities", hash(`firebase:${identityUid}`));
      const existing = (await tx.get(identityRef)).data();
      const userId = existing?.userId ?? newUserId;
      const [u, profile] = await tx.getAll(ctx.ref("users", userId), ctx.ref("profiles", userId));
      if (existing && (!u.exists || u.data()!.accountStatus !== "active" || !profile.exists))
        return fail(401, "ACCOUNT_UNAVAILABLE", "Tài khoản không còn khả dụng.");
      if (!existing) {
        tx.create(identityRef, { firebaseUid: identityUid, userId, createdAt: ctx.date() });
        tx.create(ctx.ref("users", userId), { id: userId, firebaseUid: identityUid, accountStatus: "active", createdAt: ctx.date() });
        tx.create(ctx.ref("profiles", userId), { ...emptyProfile(userId), displayName });
        tx.create(ctx.ref("preferences", userId), defaultPreferences());
      }
      tx.create(ctx.ref("sessions", hash(token)), { userId, expiresAt, revokedAt: null, createdAt: ctx.date() });
      return { id: userId, displayName: profile.data()?.displayName ?? displayName };
    });
    return { data: { token, expiresAt: new Date(expiresAt).toISOString(), user } };
  });
}
