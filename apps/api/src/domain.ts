import {
  randomBytes,
  createHash,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { Server } from "socket.io";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}
export const fail = (status: number, code: string, message: string): never => {
  throw new ApiError(status, code, message);
};
export const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const uid = () => randomUUID();
export interface Config {
  dbPath: string;
  dataDir: string;
  demoMode: boolean;
  sessionTtlMs: number;
  otpTtlMs: number;
  now: () => number;
}
export class Domain {
  io!: Server;
  constructor(public db: DatabaseSync, public config: Config) {}
  one(sql: string, ...args: SQLInputValue[]): any {
    return this.db.prepare(sql).get(...args);
  }
  all(sql: string, ...args: SQLInputValue[]): any[] {
    return this.db.prepare(sql).all(...args);
  }
  run(sql: string, ...args: SQLInputValue[]) {
    return this.db.prepare(sql).run(...args);
  }
  date() {
    return new Date(this.config.now()).toISOString();
  }
  user(id: string) {
    const row = this.one(
      "SELECT user_id,display_name FROM profiles WHERE user_id=?",
      id
    );
    return { id: row.user_id, displayName: row.display_name };
  }
  session(userId: string) {
    const token = randomBytes(32).toString("base64url");
    const expires = this.config.now() + this.config.sessionTtlMs;
    this.run(
      "INSERT INTO sessions VALUES(?,?,?,?,NULL)",
      uid(),
      userId,
      hash(token),
      expires
    );
    return {
      token,
      expiresAt: new Date(expires).toISOString(),
      user: this.user(userId),
    };
  }
  authenticate(token?: string) {
    if (!token) return fail(401, "UNAUTHORIZED", "Vui lòng đăng nhập");
    const row = this.one(
      "SELECT s.*,u.account_status FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?",
      hash(token)
    );
    if (
      !row ||
      row.revoked_at !== null ||
      row.expires_at <= this.config.now() ||
      row.account_status !== "active"
    )
      return fail(401, "SESSION_EXPIRED", "Phiên đăng nhập không còn hiệu lực");
    return row;
  }
  blocked(a: string, b: string) {
    return !!this.one(
      "SELECT 1 FROM blocks WHERE (actor_id=? AND target_id=?) OR (actor_id=? AND target_id=?)",
      a,
      b,
      b,
      a
    );
  }
  target(actor: string, id: string) {
    if (actor === id) fail(422, "SELF_ACTION", "Không thể chọn chính mình");
    if (
      !this.one(
        "SELECT 1 FROM users WHERE id=? AND account_status='active'",
        id
      )
    )
      fail(404, "NOT_FOUND", "Không tìm thấy hồ sơ");
  }
  age(dob: string) {
    const now = new Date(this.config.now());
    let years = now.getUTCFullYear() - Number(dob.slice(0, 4));
    if (now.toISOString().slice(5, 10) < dob.slice(5)) years--;
    return years;
  }
  personalization(id: string) {
    // Core seed and older databases remain readable before the extension registers.
    if (
      !this.one(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='personalizations'"
      )
    )
      return null;
    return (
      this.one("SELECT * FROM personalizations WHERE user_id=?", id) ?? null
    );
  }
  verifyLikeGate(actor: string, target: string, answer?: string) {
    const p = this.personalization(target);
    if (!p?.gate_question) return;
    const now = this.config.now();
    const attempt = this.one(
      "SELECT * FROM like_gate_attempts WHERE actor_id=? AND target_id=?",
      actor,
      target
    );
    const active = attempt && attempt.window_start > now - 900_000;
    if (active && attempt.attempts >= 5)
      fail(429, "GATE_RATE_LIMIT", "Vui lòng thử lại sau 15 phút");
    const actual = hash(`${p.gate_salt}:${normalizeAnswer(answer ?? "")}`);
    if (
      !answer ||
      !timingSafeEqual(Buffer.from(actual), Buffer.from(p.gate_answer_hash))
    ) {
      this.run(
        "INSERT INTO like_gate_attempts(actor_id,target_id,window_start,attempts) VALUES(?,?,?,1) ON CONFLICT(actor_id,target_id) DO UPDATE SET window_start=excluded.window_start,attempts=?",
        actor,
        target,
        active ? attempt.window_start : now,
        active ? attempt.attempts + 1 : 1
      );
      fail(422, "GATE_ANSWER_INVALID", "Câu trả lời chưa đúng");
    }
    this.run(
      "DELETE FROM like_gate_attempts WHERE actor_id=? AND target_id=?",
      actor,
      target
    );
  }
  profile(id: string, own = false) {
    const p = this.one("SELECT * FROM profiles WHERE user_id=?", id);
    if (!p) return fail(404, "NOT_FOUND", "Không tìm thấy hồ sơ");
    const v = this.one(
      "SELECT status,mode FROM verification_requests WHERE user_id=? ORDER BY submitted_at DESC,id DESC LIMIT 1",
      id
    );
    const extra = this.personalization(id);
    const result = extra?.personality_json
      ? JSON.parse(extra.personality_json)
      : null;
    return {
      userId: id,
      displayName: p.display_name,
      ...(own && p.date_of_birth ? { dateOfBirth: p.date_of_birth } : {}),
      age: p.date_of_birth ? this.age(p.date_of_birth) : 0,
      gender: p.gender,
      bio: p.bio,
      datingGoal: p.dating_goal,
      interests: JSON.parse(p.interests_json),
      lifestyle: JSON.parse(p.lifestyle_json),
      advanced: {
        children: null,
        heightCm: null,
        education: null,
        religion: null,
        hometown: null,
        ...JSON.parse(extra?.advanced_json ?? "{}"),
      },
      personality:
        result && (result.visible || own)
          ? {
              code: result.code,
              version: result.version,
              ...(own ? { visible: result.visible } : {}),
            }
          : null,
      mood:
        extra?.mood_expires_at > this.config.now()
          ? {
              text: extra.mood_text,
              expiresAt: new Date(extra.mood_expires_at).toISOString(),
            }
          : null,
      media: this.all(
        "SELECT id,kind,position FROM profile_media WHERE user_id=? ORDER BY position",
        id
      ).map((m) => ({ ...m, url: `/v1/media/${m.id}/content` })),
      verification: v || { status: "not_submitted", mode: "demo" },
    };
  }
  complete(id: string) {
    const p = this.profile(id);
    return (
      p.age >= 18 &&
      !!p.displayName.trim() &&
      !!p.bio.trim() &&
      p.media.length > 0
    );
  }
  matchAccess(actor: string, id: string) {
    const m = this.one("SELECT * FROM matches WHERE id=?", id);
    if (!m || ![m.user_low, m.user_high].includes(actor))
      return fail(404, "NOT_FOUND", "Không tìm thấy kết nối");
    if (m.status !== "active" || this.blocked(m.user_low, m.user_high))
      return fail(403, "MATCH_INACTIVE", "Kết nối đã kết thúc");
    return m;
  }
  match(m: any, actor: string) {
    return {
      id: m.id,
      otherUser: this.user(m.user_low === actor ? m.user_high : m.user_low),
      status: m.status,
      createdAt: m.created_at,
    };
  }
  message(m: any) {
    return {
      id: m.id,
      matchId: m.match_id,
      senderId: m.sender_id,
      clientMessageId: m.client_message_id,
      kind: m.kind,
      ...JSON.parse(m.content_json),
      createdAt: m.created_at,
    };
  }
  endMatch(id: string, reason: "blocked" | "unmatched") {
    this.run(
      "UPDATE matches SET status='ended',ended_at=? WHERE id=? AND status='active'",
      this.date(),
      id
    );
    if (
      this.one(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='games'"
      )
    )
      this.run(
        "UPDATE games SET status='ended',version=version+1 WHERE match_id=? AND status<>'ended'",
        id
      );
    this.io.to(`match:${id}`).emit("match:ended", { matchId: id, reason });
    this.io.in(`match:${id}`).socketsLeave(`match:${id}`);
  }
}
export const normalizeAnswer = (value: string) =>
  value.normalize("NFKC").trim().toLocaleLowerCase("vi");
export function cursorPage(query: any) {
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50)
    fail(400, "VALIDATION_ERROR", "limit phải từ 1 đến 50");
  let cursor: any = null;
  if (query.cursor) {
    try {
      cursor = JSON.parse(Buffer.from(query.cursor, "base64url").toString());
      if (
        !Array.isArray(cursor) ||
        cursor.length !== 2 ||
        cursor.some((x) => typeof x !== "string")
      )
        throw Error();
    } catch {
      fail(400, "INVALID_CURSOR", "Cursor không hợp lệ");
    }
  }
  return { limit, cursor };
}
export const encodeCursor = (values: string[]) =>
  Buffer.from(JSON.stringify(values)).toString("base64url");
