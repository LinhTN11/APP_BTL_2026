import type { FastifyInstance } from "fastify";
import { Domain, fail } from "../../domain.js";
import { object, str } from "../../schemas.js";

export const normalizeKeyword = (text: string) => text.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("vi");
export function hasSafetyTable(d: Domain, name: string) {
  return !!d.one("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", name);
}
export function mediaPayload(row: any) {
  return {
    mediaId: row.id, status: row.status, mode: "demo",
    url: `/v1/moderation/media/${row.id}/${row.status === "allowed" ? "content" : "preview"}`,
    notice: "Kiểm duyệt demo thủ công; không phải kết quả AI hoặc chứng nhận an toàn.",
  };
}
/** Apply on each REST/socket recipient; never change the stored original text. */
export function filterMessageForViewer<T extends { senderId: string; kind: string; text?: string; payload?: any }>(d: Domain, viewerId: string, message: T): T {
  if (message.kind === "image" && hasSafetyTable(d, "moderation_cases")) {
    const row = d.one("SELECT * FROM moderation_cases WHERE id=?", message.payload?.mediaId ?? "");
    if (row) return { ...message, payload: mediaPayload(row) };
  }
  if (message.senderId === viewerId || message.kind !== "text" || !message.text || !hasSafetyTable(d, "safety_keywords")) return message;
  const row = d.one("SELECT keywords_json FROM safety_keywords WHERE user_id=?", viewerId);
  const keywords: string[] = row ? JSON.parse(row.keywords_json) : [];
  const text = normalizeKeyword(message.text);
  return keywords.some(keyword => text.includes(keyword))
    ? { ...message, text: "[Nội dung được ẩn theo từ khóa cá nhân]", filtered: true }
    : message;
}
export function registerKeywords(app: FastifyInstance, d: Domain) {
  app.get("/v1/me/safety-keywords", async req => {
    const row = d.one("SELECT keywords_json FROM safety_keywords WHERE user_id=?", req.actor);
    return { data: { keywords: row ? JSON.parse(row.keywords_json) : [], matching: "NFKC, chữ thường, giữ dấu, chứa cụm từ; không dùng regex" } };
  });
  app.put("/v1/me/safety-keywords", { schema: { body: object({ keywords: { type: "array", maxItems: 50, items: str(120) } }) } }, async req => {
    const keywords = (req.body as {keywords: string[]}).keywords.map(normalizeKeyword);
    if (keywords.some(k => !k || [...k].length > 40)) fail(400, "KEYWORD_INVALID", "Mỗi từ khóa sau chuẩn hóa cần 1–40 ký tự");
    if (new Set(keywords).size !== keywords.length) fail(422, "KEYWORD_DUPLICATE", "Từ khóa trùng sau chuẩn hóa");
    d.run("INSERT INTO safety_keywords VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET keywords_json=excluded.keywords_json,updated_at=excluded.updated_at", req.actor, JSON.stringify(keywords), d.date());
    return { data: { keywords } };
  });
  app.get("/v1/safety/resources", async () => ({ data: {
    mode: "real", title: "Trung tâm an toàn", articles: [
      { id: "privacy", title: "Bảo vệ thông tin cá nhân", text: "Chỉ chia sẻ địa chỉ, vị trí và liên hệ khi bạn chủ động đồng ý. Có thể dừng cuộc trò chuyện bất cứ lúc nào." },
      { id: "report", title: "Chặn và báo cáo", text: "Chặn sẽ kết thúc kết nối. Báo cáo được lưu riêng để người kiểm duyệt xem xét; không tự động kết luận người bị báo cáo vi phạm." },
      { id: "meeting", title: "Gặp ở nơi công cộng", text: "Chọn nơi công cộng, tự sắp xếp việc di chuyển và chủ động chia sẻ kế hoạch với người bạn tin tưởng." },
      { id: "urgent", title: "Khi cảm thấy không an toàn", text: "Rời khỏi tình huống nếu có thể, tìm hỗ trợ tại chỗ và liên hệ dịch vụ khẩn cấp tại địa phương. Ứng dụng không cung cấp dịch vụ cứu hộ." },
    ], moderation: { mode: "demo", notice: "Ảnh chờ duyệt thủ công; từ khóa cá nhân là quy tắc chứa chuỗi, không phải AI. Không tự cấm tài khoản." },
  } }));
}
