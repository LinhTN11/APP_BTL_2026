import type { FastifyInstance, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { Domain, fail, hash, uid } from "../../domain.js";
import { transaction } from "../../db/database.js";
import { enumString, object, str, uuid } from "../../schemas.js";
import { mediaPayload } from "./keywords.js";

function requireModerator(req: FastifyRequest, d: Domain) {
  const configured = process.env.DEMO_MODERATOR_TOKEN;
  const supplied = req.headers["x-demo-moderator-token"];
  if (!d.config.demoMode || !configured || typeof supplied !== "string" || !timingSafeEqual(Buffer.from(hash(configured), "hex"), Buffer.from(hash(supplied), "hex"))) fail(403, "MODERATOR_REQUIRED", "Cần quyền kiểm duyệt demo được cấu hình riêng");
}
const ownCase = (row: any) => ({ id: row.id, messageId: row.message_id, status: row.status, mode: "demo", createdAt: row.created_at });
export function registerReview(app: FastifyInstance, d: Domain) {
  app.get("/v1/me/moderation-cases", async req => ({ data: d.all("SELECT * FROM moderation_cases WHERE owner_id=? ORDER BY created_at DESC,id DESC LIMIT 50", req.actor).map(ownCase) }));
  app.get("/v1/me/reports", async req => ({ data: d.all("SELECT r.id,r.reason_code AS reasonCode,r.created_at AS createdAt,coalesce(s.status,'open') AS status FROM reports r LEFT JOIN safety_report_reviews s ON s.report_id=r.id WHERE r.reporter_id=? ORDER BY r.created_at DESC,r.id DESC LIMIT 50", req.actor) }));
  app.get("/v1/moderation/reports", async req => {
    requireModerator(req, d);
    return { data: {
      mode: "demo", notice: "Quy trình thủ công; không phải AI xác minh. Không có thao tác cấm vĩnh viễn.",
      mediaCases: d.all("SELECT * FROM moderation_cases ORDER BY created_at DESC,id DESC LIMIT 50").map(row => ({ ...ownCase(row), matchId: row.match_id })),
      reports: d.all("SELECT r.id,r.reason_code AS reasonCode,r.detail,r.created_at AS createdAt,coalesce(s.status,'open') AS status FROM reports r LEFT JOIN safety_report_reviews s ON s.report_id=r.id ORDER BY r.created_at DESC,r.id DESC LIMIT 50"),
      appeals: d.all("SELECT id,subject_id AS subjectId,subject_type AS subjectType,reason,status,created_at AS createdAt FROM moderation_appeals ORDER BY created_at DESC,id DESC LIMIT 50"),
    } };
  });
  app.post<{Params: {id: string}}>("/v1/moderation/reports/:id/decision", { schema: { body: object({ decision: enumString(["allowed", "blurred", "rejected", "reviewing", "resolved", "dismissed"]), reason: str(1000) }) } }, async req => {
    requireModerator(req, d);
    const body = req.body as {decision: string; reason: string};
    if (!body.reason.trim()) fail(400, "REASON_INVALID", "Cần lý do quyết định");
    const media = d.one("SELECT * FROM moderation_cases WHERE id=?", req.params.id);
    const report = media ? null : d.one("SELECT * FROM reports WHERE id=?", req.params.id);
    if (!media && !report) fail(404, "NOT_FOUND", "Không tìm thấy hồ sơ kiểm duyệt");
    const allowed = media ? ["allowed", "blurred", "rejected"] : ["reviewing", "resolved", "dismissed"];
    if (!allowed.includes(body.decision)) fail(422, "DECISION_INVALID", "Quyết định không áp dụng cho loại hồ sơ này");
    transaction(d.db, () => {
      if (media) {
        d.run("UPDATE moderation_cases SET status=? WHERE id=?", body.decision, media.id);
        const payload = mediaPayload({...media, status: body.decision});
        d.run("UPDATE messages SET content_json=? WHERE id=?", JSON.stringify({payload}), media.message_id);
      } else d.run("INSERT INTO safety_report_reviews VALUES(?,?,?) ON CONFLICT(report_id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at", req.params.id, body.decision, d.date());
      d.run("INSERT INTO moderation_decisions VALUES(?,?,?,?,?,?,?)", uid(), req.params.id, media ? "media" : "report", req.actor, body.decision, body.reason.trim(), d.date());
    });
    return { data: { id: req.params.id, status: body.decision, mode: "demo" } };
  });
  app.get("/v1/moderation/appeals", async req => ({ data: d.all("SELECT id,subject_id AS subjectId,subject_type AS subjectType,status,reason,created_at AS createdAt FROM moderation_appeals WHERE actor_id=? ORDER BY created_at DESC,id DESC LIMIT 50", req.actor) }));
  app.post("/v1/moderation/appeals", { schema: { body: object({ caseId: uuid, reportId: uuid, reason: str(1000) }, ["reason"]) } }, async req => {
    const body = req.body as {caseId?: string; reportId?: string; reason: string};
    if (!!body.caseId === !!body.reportId || !body.reason.trim()) fail(400, "APPEAL_INVALID", "Cần đúng một caseId hoặc reportId và lý do");
    const type = body.caseId ? "media" : "report", id = body.caseId ?? body.reportId!;
    const subject = body.caseId ? d.one("SELECT owner_id AS owner,status FROM moderation_cases WHERE id=?", id)
      : d.one("SELECT reporter_id AS owner FROM reports WHERE id=?", id);
    if (!subject || subject.owner !== req.actor) fail(404, "NOT_FOUND", "Không tìm thấy hồ sơ của bạn");
    if (type === "media" && !["blurred", "rejected"].includes(subject.status)) fail(409, "APPEAL_NOT_ELIGIBLE", "Ảnh chưa có quyết định cần khiếu nại");
    if (d.one("SELECT 1 FROM moderation_appeals WHERE actor_id=? AND subject_id=? AND subject_type=?", req.actor, id, type)) fail(409, "APPEAL_EXISTS", "Khiếu nại đã được tiếp nhận");
    const appealId = uid();
    d.run("INSERT INTO moderation_appeals(id,actor_id,subject_id,subject_type,reason,created_at) VALUES(?,?,?,?,?,?)", appealId, req.actor, id, type, body.reason.trim(), d.date());
    return { data: { id: appealId, subjectId: id, subjectType: type, status: "received" } };
  });
}
