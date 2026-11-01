import type { FastifyInstance, FastifyRequest } from "fastify";
import { createReadStream } from "node:fs";
import { writeFile, unlink, stat } from "node:fs/promises";
import { join } from "node:path";
import { FirestoreContext, fail, uid } from "./context.js";
import { object, uuid } from "./schemas.js";
import { pairDocumentId, requireTransactionSession } from "./matching.js";

async function image(req: FastifyRequest) {
  let result: { bytes: Buffer; type: string } | undefined;
  for await (const part of req.parts()) {
    if (part.type !== "file" || part.fieldname !== "file" || result)
      return fail(400, "FILE_REQUIRED", "Dùng đúng một multipart field file");
    const bytes = await part.toBuffer();
    if (part.file.truncated || bytes.length > 10 * 1024 * 1024)
      fail(413, "UPLOAD_TOO_LARGE", "Ảnh tối đa 10MB");
    const type = bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? "image/png"
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      ? "image/jpeg"
      : bytes.toString("ascii", 0, 4) === "RIFF" &&
        bytes.toString("ascii", 8, 12) === "WEBP"
      ? "image/webp"
      : null;
    if (!type || type !== part.mimetype)
      return fail(
        422,
        "MEDIA_UNSUPPORTED",
        "Chỉ hỗ trợ JPEG, PNG, WebP có chữ ký hợp lệ; video chưa có xác thực thời lượng"
      );
    result = { bytes, type };
  }
  if (!result) return fail(400, "FILE_REQUIRED", "Dùng multipart field file");
  return result;
}
function mediaPath(ctx: FirestoreContext, key: string) {
  if (!/^(?:seed-[ABCD]\.png|(?:selfie-)?[a-f0-9-]{36}\.bin)$/.test(key))
    return fail(404, "NOT_FOUND", "Không tìm thấy ảnh");
  return join(ctx.config.dataDir, "media", key);
}
export function registerFirestoreMedia(
  app: FastifyInstance,
  ctx: FirestoreContext
) {
  app.post("/v1/me/media", async (req) => {
    const { bytes, type } = await image(req),
      id = uid(),
      storageKey = `${id}.bin`,
      path = mediaPath(ctx, storageKey);
    await writeFile(path, bytes, { flag: "wx" });
    try {
      const position = await ctx.db.runTransaction(async (tx) => {
        const ref = ctx.ref("profiles", req.actor),
          p = (await tx.get(ref)).data();
        await requireTransactionSession(ctx, tx, req.actor, req.sessionId);
        if (!p) return fail(404, "NOT_FOUND", "Không tìm thấy hồ sơ");
        const ids: string[] = p.mediaIds ?? [];
        if (ids.length >= 9) fail(422, "MEDIA_LIMIT", "Tối đa 9 ảnh");
        // Profile document is the shared lock for quota, removal and ordering.
        tx.update(ref, { mediaIds: [...ids, id] });
        tx.create(ctx.ref("media", id), {
          userId: req.actor,
          storageKey,
          kind: "image",
          mime: type,
          position: ids.length,
          scope: "profile",
          createdAt: ctx.date(),
        });
        return ids.length;
      });
      return {
        data: { id, kind: "image", url: `/v1/media/${id}/content`, position },
      };
    } catch (error) {
      await unlink(path).catch(() => {});
      throw error;
    }
  });
  app.patch(
    "/v1/me/media/order",
    {
      schema: {
        body: object({
          mediaIds: {
            type: "array",
            maxItems: 9,
            uniqueItems: true,
            items: uuid,
          },
        }),
      },
    },
    async (req) => {
      const ids = (req.body as any).mediaIds as string[];
      await ctx.db.runTransaction(async (tx) => {
        const ref = ctx.ref("profiles", req.actor),
          p = (await tx.get(ref)).data(),
          old: string[] = p?.mediaIds ?? [];
        await requireTransactionSession(ctx, tx, req.actor, req.sessionId);
        if (
          !p ||
          ids.length !== old.length ||
          ids.some((id) => !old.includes(id))
        )
          fail(422, "MEDIA_ORDER_INVALID", "Cần đủ đúng các ảnh của bạn");
        const docs = ids.length
          ? await tx.getAll(...ids.map((id) => ctx.ref("media", id)))
          : [];
        if (
          docs.some(
            (d) =>
              !d.exists ||
              d.data()!.userId !== req.actor ||
              d.data()!.scope !== "profile"
          )
        )
          fail(422, "MEDIA_ORDER_INVALID", "Cần đủ đúng các ảnh của bạn");
        tx.update(ref, { mediaIds: ids });
        ids.forEach((id, position) =>
          tx.update(ctx.ref("media", id), { position })
        );
      });
      return { data: (await ctx.profile(req.actor, true)).media };
    }
  );
  app.delete<{ Params: { id: string } }>("/v1/me/media/:id", async (req) => {
    const storageKey = await ctx.db.runTransaction(async (tx) => {
      const ref = ctx.ref("media", req.params.id),
        pRef = ctx.ref("profiles", req.actor),
        [m, p] = await tx.getAll(ref, pRef),
        data = m.data();
      if (!data || data.userId !== req.actor || data.scope !== "profile")
        return fail(404, "NOT_FOUND", "Không tìm thấy ảnh");
      const ids: string[] = (p.data()?.mediaIds ?? []).filter(
        (id: string) => id !== req.params.id
      );
      const rest = ids.length
        ? await tx.getAll(...ids.map((id) => ctx.ref("media", id)))
        : [];
      await requireTransactionSession(ctx, tx, req.actor, req.sessionId);
      tx.update(pRef, { mediaIds: ids });
      tx.delete(ref);
      rest.forEach((d, i) => {
        if (d.exists) tx.update(d.ref, { position: i });
      });
      return data.storageKey as string;
    });
    await unlink(mediaPath(ctx, storageKey)).catch(() => {});
    return { data: { deleted: true } };
  });
  app.get<{ Params: { id: string } }>(
    "/v1/media/:id/content",
    async (req, reply) => {
      const m = await ctx.db.runTransaction(async (tx) => {
        const media = (await tx.get(ctx.ref("media", req.params.id))).data();
        if (!media || media.scope !== "profile")
          return fail(404, "NOT_FOUND", "Không tìm thấy ảnh");
        if (media.userId !== req.actor) {
          const pair = pairDocumentId(req.actor, media.userId);
          const [user, p, b1, b2, match] = await tx.getAll(
            ctx.ref("users", media.userId),
            ctx.ref("profiles", media.userId),
            ctx.ref("blocks", `${req.actor}_${media.userId}`),
            ctx.ref("blocks", `${media.userId}_${req.actor}`),
            ctx.ref("matches", pair)
          );
          const profile = p.data();
          if (
            user.data()?.accountStatus !== "active" ||
            !profile ||
            profile.visibility !== "public" ||
            b1.exists ||
            b2.exists ||
            match.data()?.status === "ended" ||
            !profile.dateOfBirth ||
            ctx.age(profile.dateOfBirth) < 18 ||
            !profile.displayName.trim() ||
            !profile.bio.trim() ||
            !(profile.mediaIds ?? []).includes(req.params.id)
          )
            fail(404, "NOT_FOUND", "Không tìm thấy ảnh");
        }
        return media;
      });
      const path = mediaPath(ctx, m.storageKey);
      try {
        await stat(path);
      } catch {
        return fail(404, "NOT_FOUND", "Tệp ảnh không còn trên máy chủ media");
      }
      reply.header("Cache-Control", "private, no-store").type(m.mime);
      return reply.send(createReadStream(path));
    }
  );
  app.post("/v1/me/verification/selfie", async (req) => {
    if (!ctx.config.demoMode)
      fail(503, "PROVIDER_UNAVAILABLE", "Quy trình selfie demo đã tắt");
    const { bytes } = await image(req),
      id = uid(),
      storageKey = `selfie-${id}.bin`,
      path = mediaPath(ctx, storageKey),
      submittedAt = ctx.date();
    await writeFile(path, bytes, { flag: "wx" });
    try {
      await ctx.db.runTransaction(async (tx) => {
        const profile = ctx.ref("profiles", req.actor);
        if (!(await tx.get(profile)).exists)
          return fail(404, "NOT_FOUND", "Không tìm thấy hồ sơ");
        await requireTransactionSession(ctx, tx, req.actor, req.sessionId);
        tx.create(ctx.ref("verificationRequests", id), {
          userId: req.actor,
          storageKey,
          status: "pending",
          mode: "demo",
          submittedAt,
        });
        tx.update(profile, {
          verification: { status: "pending", mode: "demo", submittedAt },
        });
      });
    } catch (error) {
      await unlink(path).catch(() => {});
      throw error;
    }
    return { data: { status: "pending", mode: "demo", submittedAt } };
  });
  app.get("/v1/me/verification", async (req) => {
    const p = (await ctx.ref("profiles", req.actor).get()).data();
    return {
      data: p?.verification ?? { status: "not_submitted", mode: "demo" },
    };
  });
}
