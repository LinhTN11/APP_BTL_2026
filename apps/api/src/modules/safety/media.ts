import type { FastifyInstance, FastifyRequest } from "fastify";
import { createReadStream } from "node:fs";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { Domain, fail, hash, uid } from "../../domain.js";
import { transaction } from "../../db/database.js";
import { mediaPayload } from "./keywords.js";

async function readImage(req: FastifyRequest) {
  let result: {bytes: Buffer; mime: string} | undefined;
  for await (const part of req.parts()) {
    if (part.type !== "file" || part.fieldname !== "file" || result) fail(400, "FILE_REQUIRED", "Dùng đúng một multipart field file");
    if (part.type !== "file") continue;
    const bytes = await part.toBuffer();
    if (part.file.truncated || bytes.length > 10 * 1024 * 1024) fail(413, "UPLOAD_TOO_LARGE", "Ảnh tối đa 10MB");
    const mime = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? "image/png"
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? "image/jpeg"
      : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" ? "image/webp" : null;
    if (!mime || mime !== part.mimetype) fail(422, "MEDIA_UNSUPPORTED", "Chỉ nhận ảnh JPEG, PNG, WebP khớp chữ ký");
    result = { bytes, mime: mime! };
  }
  if (!result) return fail(400, "FILE_REQUIRED", "Dùng multipart field file");
  return result;
}
export function registerModeratedMedia(app: FastifyInstance, d: Domain) {
  app.post<{Params: {id: string}}>("/v1/matches/:id/message-media", async req => {
    d.matchAccess(req.actor, req.params.id);
    if (!d.config.demoMode) fail(503, "PROVIDER_UNAVAILABLE", "Chưa cấu hình provider kiểm duyệt thật; không phát ảnh chưa kiểm tra");
    const rawClientId = req.headers["x-client-message-id"] ?? uid();
    if (typeof rawClientId !== "string" || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(rawClientId)) return fail(400, "MESSAGE_ID_INVALID", "x-client-message-id cần UUID");
    const clientId = rawClientId;
    const image = await readImage(req);
    // Recheck after awaiting upload so unmatch/block during upload fails closed.
    d.matchAccess(req.actor, req.params.id);
    const fingerprint = hash(image.bytes.toString("base64"));
    const old = d.one("SELECT * FROM messages WHERE sender_id=? AND client_message_id=?", req.actor, clientId);
    if (old) {
      const existingCase = d.one("SELECT * FROM moderation_cases WHERE message_id=?", old.id);
      if (old.match_id !== req.params.id || old.kind !== "image" || existingCase?.content_hash !== fingerprint || existingCase.mime !== image.mime) fail(409, "MESSAGE_RETRY_CONFLICT", "clientMessageId đã có nội dung khác");
      return { data: { ...d.message(old), payload: mediaPayload(existingCase) } };
    }
    const id = uid(), caseId = uid(), storageKey = `${caseId}.bin`;
    const directory = join(d.config.dataDir, "quarantine");
    await mkdir(directory, { recursive: true });
    const filePath = join(directory, storageKey);
    await writeFile(filePath, image.bytes, { flag: "wx" });
    let message: any;
    try {
      transaction(d.db, () => {
        d.matchAccess(req.actor, req.params.id);
        const latest = d.one("SELECT max(created_at) latest FROM messages WHERE match_id=?", req.params.id).latest;
        const createdAt = new Date(Math.max(d.config.now(), latest ? Date.parse(latest) + 1 : 0)).toISOString();
        const payload = mediaPayload({ id: caseId, status: "pending" });
        d.run("INSERT INTO messages VALUES(?,?,?,?,?,?,?)", id, req.params.id, req.actor, clientId, "image", JSON.stringify({payload}), createdAt);
        // Demo fixture rule: every upload enters manual review. No inference or automatic approval.
        d.run("INSERT INTO moderation_cases(id,message_id,owner_id,match_id,storage_key,mime,content_hash,created_at) VALUES(?,?,?,?,?,?,?,?)", caseId, id, req.actor, req.params.id, storageKey, image.mime, fingerprint, createdAt);
        message = d.message(d.one("SELECT * FROM messages WHERE id=?", id));
      });
    } catch (error) {
      await unlink(filePath).catch(() => {});
      throw error;
    }
    for (const socket of d.io.sockets.sockets.values()) {
      try {
        const session = d.authenticate(socket.data.token);
        d.matchAccess(session.user_id, req.params.id);
        if (socket.rooms.has(`match:${req.params.id}`)) socket.emit("message:created", message);
      } catch { /* No media delivery to unrelated, inactive or expired sessions. */ }
    }
    return { data: message };
  });
  app.get<{Params: {id: string}}>("/v1/moderation/media/:id/preview", async (req, reply) => {
    const row = d.one("SELECT * FROM moderation_cases WHERE id=?", req.params.id);
    if (!row) fail(404, "NOT_FOUND", "Không tìm thấy ảnh");
    d.matchAccess(req.actor, row.match_id);
    // A generated placeholder, never the original image or a client-only CSS blur.
    reply.header("Cache-Control", "private, no-store").header("X-Content-Type-Options", "nosniff").type("image/svg+xml");
    return reply.send('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="400" height="240" fill="#252c36"/><text x="24" y="120" fill="white" font-size="18">Ảnh cách ly · kiểm duyệt demo</text></svg>');
  });
  app.get<{Params: {id: string}}>("/v1/moderation/media/:id/content", async (req, reply) => {
    const row = d.one("SELECT * FROM moderation_cases WHERE id=?", req.params.id);
    if (!row) fail(404, "NOT_FOUND", "Không tìm thấy ảnh");
    d.matchAccess(req.actor, row.match_id);
    if (row.status !== "allowed") fail(403, "MEDIA_QUARANTINED", "Ảnh chưa được phép hiển thị");
    reply.header("Cache-Control", "private, no-store").header("X-Content-Type-Options", "nosniff").type(row.mime);
    return reply.send(createReadStream(join(d.config.dataDir, "quarantine", row.storage_key)));
  });
}
