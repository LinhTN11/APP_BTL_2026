import type { FastifyInstance, FastifyRequest } from "fastify";
import { createReadStream } from "node:fs";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { Domain, fail, uid } from "../domain.js";
import { object, uuid } from "../schemas.js";
import { transaction } from "../db/database.js";

async function image(req: FastifyRequest) {
  let result: { bytes: Buffer; type: string } | undefined;
  for await (const part of req.parts()) {
    if (part.type !== "file" || part.fieldname !== "file" || result)
      return fail(400, "FILE_REQUIRED", "Dùng đúng một multipart field file");
    const bytes = await part.toBuffer();
    if (part.file.truncated) fail(413, "UPLOAD_TOO_LARGE", "Ảnh tối đa 10MB");
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
export function registerMedia(app: FastifyInstance, d: Domain) {
  app.post("/v1/me/media", async (req) => {
    const { bytes, type } = await image(req);
    const id = uid(),
      storage = `${id}.bin`;
    const path = join(d.config.dataDir, "media", storage);
    await writeFile(path, bytes, { flag: "wx" });
    try {
      transaction(d.db, () => {
        const count = d.one(
          "SELECT count(*) AS count FROM profile_media WHERE user_id=?",
          req.actor
        ).count;
        if (count >= 9) fail(422, "MEDIA_LIMIT", "Tối đa 9 ảnh");
        const pos = d.one(
          "SELECT coalesce(max(position),-1)+1 AS pos FROM profile_media WHERE user_id=?",
          req.actor
        ).pos;
        d.run(
          "INSERT INTO profile_media VALUES(?,?,?,?,?,?)",
          id,
          req.actor,
          storage,
          "image",
          type,
          pos
        );
      });
    } catch (e) {
      await unlink(path).catch(() => {});
      throw e;
    }
    return { data: d.profile(req.actor, true).media.find((m) => m.id === id) };
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
      transaction(d.db, () => {
        const old = d
          .all("SELECT id FROM profile_media WHERE user_id=?", req.actor)
          .map((x) => x.id);
        if (ids.length !== old.length || ids.some((id) => !old.includes(id)))
          fail(422, "MEDIA_ORDER_INVALID", "Cần đủ đúng các ảnh của bạn");
        d.run(
          "UPDATE profile_media SET position=position+100 WHERE user_id=?",
          req.actor
        );
        ids.forEach((id, i) =>
          d.run(
            "UPDATE profile_media SET position=? WHERE id=? AND user_id=?",
            i,
            id,
            req.actor
          )
        );
      });
      return { data: d.profile(req.actor, true).media };
    }
  );
  app.delete<{ Params: { id: string } }>("/v1/me/media/:id", async (req) => {
    const m = d.one(
      "SELECT * FROM profile_media WHERE id=? AND user_id=?",
      req.params.id,
      req.actor
    );
    if (!m) fail(404, "NOT_FOUND", "Không tìm thấy ảnh");
    d.run("DELETE FROM profile_media WHERE id=?", m.id);
    await unlink(join(d.config.dataDir, "media", m.storage_key)).catch(
      () => {}
    );
    return { data: { deleted: true } };
  });
  app.get<{ Params: { id: string } }>(
    "/v1/media/:id/content",
    async (req, reply) => {
      const m = d.one("SELECT * FROM profile_media WHERE id=?", req.params.id);
      if (!m) fail(404, "NOT_FOUND", "Không tìm thấy ảnh");
      if (m.user_id !== req.actor) {
        const ended = d.one(
          "SELECT 1 FROM matches WHERE ((user_low=? AND user_high=?) OR (user_low=? AND user_high=?)) AND status='ended'",
          req.actor,
          m.user_id,
          m.user_id,
          req.actor
        );
        if (d.blocked(req.actor, m.user_id) || ended || !d.complete(m.user_id))
          fail(404, "NOT_FOUND", "Không tìm thấy ảnh");
        // Profile images are visible to discovery; no access to private verification images exists.
      }
      reply.header("Cache-Control", "private, no-store").type(m.mime);
      return reply.send(
        createReadStream(join(d.config.dataDir, "media", m.storage_key))
      );
    }
  );
  app.post("/v1/me/verification/selfie", async (req) => {
    if (!d.config.demoMode)
      fail(503, "PROVIDER_UNAVAILABLE", "Quy trình selfie demo đã tắt");
    const { bytes } = await image(req);
    const id = uid(),
      storage = `selfie-${id}.bin`,
      path = join(d.config.dataDir, "media", storage);
    await writeFile(path, bytes, { flag: "wx" });
    try {
      d.run(
        "INSERT INTO verification_requests(id,user_id,storage_key,submitted_at) VALUES(?,?,?,?)",
        id,
        req.actor,
        storage,
        d.date()
      );
    } catch (e) {
      await unlink(path).catch(() => {});
      throw e;
    }
    return { data: { status: "pending", mode: "demo", submittedAt: d.date() } };
  });
  app.get("/v1/me/verification", async (req) => {
    const v = d.one(
      "SELECT status,mode,submitted_at AS submittedAt FROM verification_requests WHERE user_id=? ORDER BY submitted_at DESC,id DESC LIMIT 1",
      req.actor
    );
    return { data: v ?? { status: "not_submitted", mode: "demo" } };
  });
}
