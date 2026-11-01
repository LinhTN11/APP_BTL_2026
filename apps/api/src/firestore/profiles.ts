import type { FastifyInstance } from "fastify";
import { FirestoreContext, fail } from "./context.js";
import { object, profilePatch, preferencesPatch, coords } from "./schemas.js";
import { defaultPreferences } from "./auth.js";
import { requireTransactionSession } from "./matching.js";

export async function firestoreProfile(
  ctx: FirestoreContext,
  id: string,
  own = false
) {
  const p = (await ctx.ref("profiles", id).get()).data();
  if (!p) return fail(404, "NOT_FOUND", "Không tìm thấy hồ sơ");
  const ids = (p.mediaIds as string[]) ?? [];
  const media = ids.length
    ? (await ctx.db.getAll(...ids.map((x) => ctx.ref("media", x))))
        .filter(
          (x) =>
            x.exists && x.data()!.userId === id && x.data()!.scope === "profile"
        )
        .map((x) => ({
          id: x.id,
          kind: x.data()!.kind,
          url: `/v1/media/${x.id}/content`,
          position: x.data()!.position,
        }))
        .sort((a, b) => a.position - b.position)
    : [];
  return {
    userId: id,
    displayName: p.displayName,
    ...(own && p.dateOfBirth ? { dateOfBirth: p.dateOfBirth } : {}),
    age: p.dateOfBirth ? ctx.age(p.dateOfBirth) : 0,
    gender: p.gender,
    bio: p.bio,
    datingGoal: p.datingGoal,
    interests: p.interests ?? [],
    lifestyle: p.lifestyle ?? {},
    advanced: {
      children: null,
      heightCm: null,
      education: null,
      religion: null,
      hometown: null,
      ...p.advanced,
    },
    personality: null,
    mood: null,
    media,
    verification: p.verification
      ? { status: p.verification.status, mode: p.verification.mode }
      : { status: "not_submitted", mode: "demo" },
  };
}
export const profile = firestoreProfile;
export async function prefs(ctx: FirestoreContext, id: string) {
  return (
    (await ctx.ref("preferences", id).get()).data() ?? defaultPreferences()
  );
}
export function registerFirestoreProfiles(
  app: FastifyInstance,
  ctx: FirestoreContext
) {
  app.get("/v1/me/profile", async (req) => ({
    data: await firestoreProfile(ctx, req.actor, true),
  }));
  app.patch(
    "/v1/me/profile",
    { schema: { body: profilePatch } },
    async (req) => {
      const body = req.body as any;
      if (body.dateOfBirth) {
        const date = new Date(body.dateOfBirth + "T00:00:00Z");
        if (
          Number.isNaN(date.getTime()) ||
          date.toISOString().slice(0, 10) !== body.dateOfBirth ||
          ctx.age(body.dateOfBirth) < 18 ||
          ctx.age(body.dateOfBirth) > 120
        )
          fail(
            422,
            "AGE_INVALID",
            "Ngày sinh hợp lệ và đủ 18 tuổi là bắt buộc"
          );
      }
      if (body.displayName !== undefined && !body.displayName.trim())
        fail(400, "VALIDATION_ERROR", "Tên không được trống");
      if (body.advanced)
        for (const v of Object.values(body.advanced))
          if (typeof v === "string" && !v.trim())
            fail(400, "VALIDATION_ERROR", "Trường mở rộng không được trống");
      await ctx.db.runTransaction(async (tx) => {
        const ref = ctx.ref("profiles", req.actor),
          p = (await tx.get(ref)).data();
        await requireTransactionSession(ctx, tx, req.actor, req.sessionId);
        if (!p) return fail(404, "NOT_FOUND", "Không tìm thấy hồ sơ");
        const changes = {
          ...body,
          ...(body.advanced
            ? { advanced: { ...p.advanced, ...body.advanced } }
            : {}),
        };
        if (Object.keys(changes).length) tx.update(ref, changes);
      });
      return { data: await firestoreProfile(ctx, req.actor, true) };
    }
  );
  app.get<{ Params: { id: string } }>("/v1/profiles/:id", async (req) => {
    await ctx.target(req.actor, req.params.id);
    const raw = (await ctx.ref("profiles", req.params.id).get()).data();
    if (
      raw?.visibility !== "public" ||
      (await ctx.blocked(req.actor, req.params.id)) ||
      !(await ctx.complete(req.params.id))
    )
      fail(404, "NOT_FOUND", "Không tìm thấy hồ sơ");
    return { data: await firestoreProfile(ctx, req.params.id) };
  });
  app.get("/v1/me/preferences", async (req) => ({
    data: await prefs(ctx, req.actor),
  }));
  app.patch(
    "/v1/me/preferences",
    { schema: { body: preferencesPatch } },
    async (req) => {
      const data = await ctx.db.runTransaction(async (tx) => {
        const ref = ctx.ref("preferences", req.actor),
          old = (await tx.get(ref)).data() ?? defaultPreferences(),
          body = req.body as any;
        await requireTransactionSession(ctx, tx, req.actor, req.sessionId);
        const p = {
          ...old,
          ...body,
          advancedFilters: { ...old.advancedFilters, ...body.advancedFilters },
        };
        if (p.minAge > p.maxAge)
          fail(422, "AGE_RANGE_INVALID", "minAge không được lớn hơn maxAge");
        const f = p.advancedFilters;
        if (
          f.minHeightCm != null &&
          f.maxHeightCm != null &&
          f.minHeightCm > f.maxHeightCm
        )
          fail(422, "HEIGHT_RANGE_INVALID", "Khoảng chiều cao không hợp lệ");
        for (const v of Object.values(f))
          if (typeof v === "string" && !v.trim())
            fail(400, "VALIDATION_ERROR", "Bộ lọc không được trống");
        tx.set(ref, p);
        return p;
      });
      return { data };
    }
  );
  app.put(
    "/v1/me/location",
    {
      schema: {
        body: object({
          ...coords.properties,
          consent: { type: "boolean", const: true },
        }),
      },
    },
    async (req) => {
      const updatedAt = ctx.date();
      await ctx.db.runTransaction(async (tx) => {
        await requireTransactionSession(ctx, tx, req.actor, req.sessionId);
        tx.set(ctx.ref("locations", req.actor), {
          ...(req.body as object),
          updatedAt,
        });
      });
      return { data: { consent: true, updatedAt } };
    }
  );
  app.delete("/v1/me/location", async (req) => {
    await ctx.db.runTransaction(async (tx) => {
      await requireTransactionSession(ctx, tx, req.actor, req.sessionId);
      tx.delete(ctx.ref("locations", req.actor));
    });
    return { data: { consent: false } };
  });
}
