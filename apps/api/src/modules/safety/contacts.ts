import { createHmac, randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { Domain, fail } from "../../domain.js";
import { object, str } from "../../schemas.js";
import { transaction } from "../../db/database.js";
import { hasSafetyTable } from "./keywords.js";

export function normalizePhone(phone: string) {
  const normalized = phone.normalize("NFKC").trim().replace(/[\s()-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) fail(400, "PHONE_INVALID", "Dùng số quốc tế E.164 bắt đầu bằng +; không tự suy đoán mã quốc gia");
  return normalized;
}
function phoneHmac(d: Domain, actor: string, phone: string) {
  const key = d.one("SELECT value FROM safety_settings WHERE key='contact_hmac_key'")?.value;
  if (!key) throw new Error("Missing installation contact key");
  return createHmac("sha256", Buffer.from(key, "hex")).update(`${actor}:${phone}`).digest("hex");
}
export function initializeContactKey(d: Domain) {
  d.run("INSERT OR IGNORE INTO safety_settings VALUES('contact_hmac_key',?)", randomBytes(32).toString("hex"));
}
/** Both directions, only for accounts with a linked phone. No identity lookup API. */
export function isContactBlocked(d: Domain, actor: string, target: string) {
  if (!hasSafetyTable(d, "contact_blocks")) return false;
  for (const [owner, other] of [[actor, target], [target, actor]]) {
    const phone = d.one("SELECT phone FROM users WHERE id=?", other)?.phone;
    if (!phone || !/^\+[1-9]\d{7,14}$/.test(phone)) continue;
    if (d.one("SELECT 1 FROM contact_blocks WHERE user_id=? AND phone_hmac=?", owner, phoneHmac(d, owner, phone))) return true;
  }
  return false;
}
export function registerContacts(app: FastifyInstance, d: Domain) {
  app.post("/v1/me/contact-blocks", { schema: { body: object({ phones: { type: "array", maxItems: 100, items: str(40) }, consent: { type: "boolean", const: true } }) } }, async req => {
    const phones = (req.body as {phones: string[]}).phones.map(normalizePhone);
    if (new Set(phones).size !== phones.length) fail(422, "CONTACT_DUPLICATE", "Số liên hệ trùng sau chuẩn hóa");
    const ended: string[] = [];
    transaction(d.db, () => {
      // Explicit replacement; only opted-in numbers are uploaded, never an automatic address-book import.
      d.run("DELETE FROM contact_blocks WHERE user_id=?", req.actor);
      for (const phone of phones) d.run("INSERT INTO contact_blocks VALUES(?,?,?)", req.actor, phoneHmac(d, req.actor, phone), d.date());
      for (const match of d.all("SELECT * FROM matches WHERE status='active' AND (user_low=? OR user_high=?)", req.actor, req.actor)) {
        if (isContactBlocked(d, match.user_low, match.user_high)) {
          d.run("UPDATE matches SET status='ended',ended_at=? WHERE id=? AND status='active'", d.date(), match.id);
          ended.push(match.id);
        }
      }
    });
    for (const matchId of ended) {
      d.io.to(`match:${matchId}`).emit("match:ended", { matchId, reason: "blocked" });
      d.io.in(`match:${matchId}`).socketsLeave(`match:${matchId}`);
    }
    return { data: { count: phones.length, storage: "installation-keyed HMAC; không phải ẩn danh hoàn toàn", consent: true } };
  });
  app.get("/v1/me/contact-blocks", async req => ({ data: { count: d.one("SELECT count(*) n FROM contact_blocks WHERE user_id=?", req.actor).n } }));
  app.delete("/v1/me/contact-blocks", async req => {
    d.run("DELETE FROM contact_blocks WHERE user_id=?", req.actor);
    return { data: { count: 0 } };
  });
}
export function recordUnmatchFeedback(d: Domain, actor: string, matchId: string, reasonCode?: string) {
  if (!reasonCode || !hasSafetyTable(d, "unmatch_feedback")) return;
  d.matchAccess(actor, matchId);
  if (typeof reasonCode !== "string" || !reasonCode.trim() || reasonCode.length > 80) fail(400, "REASON_INVALID", "Lý do tối đa 80 ký tự");
  d.run("INSERT OR IGNORE INTO unmatch_feedback VALUES(?,?,?,?)", actor, matchId, reasonCode.trim(), d.date());
}
