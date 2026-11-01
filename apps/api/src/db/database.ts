import { DatabaseSync } from "node:sqlite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deflateSync } from "node:zlib";

export function transaction<T>(db: DatabaseSync, action: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const value = action();
    db.exec("COMMIT");
    return value;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function setupDatabase({
  dbPath,
  dataDir,
  demoMode = true,
}: {
  dbPath: string;
  dataDir: string;
  demoMode?: boolean;
}) {
  mkdirSync(dataDir, { recursive: true });
  if (dbPath !== ":memory:") mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, phone TEXT UNIQUE, demo_account TEXT UNIQUE, account_status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS profiles(user_id TEXT PRIMARY KEY REFERENCES users(id), display_name TEXT NOT NULL, date_of_birth TEXT, gender TEXT NOT NULL DEFAULT 'other', bio TEXT NOT NULL DEFAULT '', dating_goal TEXT NOT NULL DEFAULT 'relationship', interests_json TEXT NOT NULL DEFAULT '[]', lifestyle_json TEXT NOT NULL DEFAULT '{}');
    CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL, revoked_at INTEGER);
    CREATE TABLE IF NOT EXISTS otp_challenges(id TEXT PRIMARY KEY, phone TEXT NOT NULL, code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, consumed_at INTEGER);
    CREATE TABLE IF NOT EXISTS profile_media(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), storage_key TEXT NOT NULL UNIQUE, kind TEXT NOT NULL CHECK(kind IN ('image','video')), mime TEXT NOT NULL, position INTEGER NOT NULL, UNIQUE(user_id,position));
    CREATE TABLE IF NOT EXISTS discovery_preferences(user_id TEXT PRIMARY KEY REFERENCES users(id), genders_json TEXT NOT NULL DEFAULT '["female","male","other"]', min_age INTEGER NOT NULL DEFAULT 18, max_age INTEGER NOT NULL DEFAULT 100, radius_km REAL NOT NULL DEFAULT 100);
    CREATE TABLE IF NOT EXISTS locations(user_id TEXT PRIMARY KEY REFERENCES users(id), latitude REAL NOT NULL, longitude REAL NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS swipes(id TEXT NOT NULL UNIQUE, actor_id TEXT NOT NULL REFERENCES users(id), target_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL CHECK(action IN ('like','pass')), created_at TEXT NOT NULL, PRIMARY KEY(actor_id,target_id), CHECK(actor_id<>target_id));
    CREATE TABLE IF NOT EXISTS matches(id TEXT PRIMARY KEY, user_low TEXT NOT NULL REFERENCES users(id), user_high TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL CHECK(status IN ('active','ended')), created_at TEXT NOT NULL, ended_at TEXT, UNIQUE(user_low,user_high), CHECK(user_low<user_high));
    CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY, match_id TEXT NOT NULL REFERENCES matches(id), sender_id TEXT NOT NULL REFERENCES users(id), client_message_id TEXT NOT NULL, kind TEXT NOT NULL, content_json TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(sender_id,client_message_id));
    CREATE TABLE IF NOT EXISTS blocks(actor_id TEXT NOT NULL REFERENCES users(id), target_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, PRIMARY KEY(actor_id,target_id), CHECK(actor_id<>target_id));
    CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY, reporter_id TEXT NOT NULL REFERENCES users(id), target_id TEXT NOT NULL REFERENCES users(id), match_id TEXT REFERENCES matches(id), reason_code TEXT NOT NULL, detail TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS verification_requests(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), storage_key TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'pending', mode TEXT NOT NULL DEFAULT 'demo', submitted_at TEXT NOT NULL);
    INSERT OR IGNORE INTO migrations VALUES(1, strftime('%Y-%m-%dT%H:%M:%fZ','now'));`);
  if (demoMode) seedDemo(db, dataDir);
  return db;
}

// Original synthetic geometric avatars, generated as valid PNGs (no external person/photo).
function png(color: number[]) {
  const crc = (data: Buffer) => {
    let n = 0xffffffff;
    for (const b of data) {
      n ^= b;
      for (let k = 0; k < 8; k++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0);
    }
    return (n ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const t = Buffer.from(type);
    const out = Buffer.alloc(data.length + 12);
    out.writeUInt32BE(data.length);
    t.copy(out, 4);
    data.copy(out, 8);
    out.writeUInt32BE(crc(Buffer.concat([t, data])), data.length + 8);
    return out;
  };
  const width = 128,
    height = 160;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const head = (x - 64) ** 2 + (y - 53) ** 2 < 26 ** 2;
      const body = ((x - 64) / 47) ** 2 + ((y - 136) / 51) ** 2 < 1;
      const pos = y * (width * 3 + 1) + 1 + x * 3;
      for (let c = 0; c < 3; c++) raw[pos + c] = head || body ? color[c] : 240;
    }
  const hdr = Buffer.alloc(13);
  hdr.writeUInt32BE(width);
  hdr.writeUInt32BE(height, 4);
  hdr[8] = 8;
  hdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", hdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
export const demoIds = Object.fromEntries(
  ["A", "B", "C", "D"].map((a, i) => [
    a,
    `00000000-0000-4000-8000-00000000000${i + 1}`,
  ])
);
export function seedDemo(db: DatabaseSync, dataDir: string) {
  mkdirSync(join(dataDir, "media"), { recursive: true });
  transaction(db, () => {
    for (const [i, a] of ["A", "B", "C", "D"].entries()) {
      const id = demoIds[a];
      const mid = `10000000-0000-4000-8000-00000000000${i + 1}`;
      const storage = `seed-${a}.png`;
      db.prepare(
        "INSERT OR IGNORE INTO users(id,demo_account,created_at) VALUES(?,?,?)"
      ).run(id, a, new Date().toISOString());
      db.prepare(
        "INSERT OR IGNORE INTO profiles(user_id,display_name,date_of_birth,gender,bio,interests_json) VALUES(?,?,?,?,?,?)"
      ).run(
        id,
        `Bạn ${a} (hư cấu)`,
        "2000-05-15",
        i % 2 ? "male" : "female",
        "Hồ sơ demo hư cấu. Thích cà phê và đi dạo.",
        JSON.stringify(["coffee", "music"])
      );
      db.prepare(
        "INSERT OR IGNORE INTO discovery_preferences(user_id) VALUES(?)"
      ).run(id);
      // Never replace deleted/edited media on later starts.
      if (
        !db.prepare("SELECT 1 FROM profile_media WHERE id=?").get(mid) &&
        !db.prepare("SELECT 1 FROM migrations WHERE version=?").get(100 + i)
      ) {
        db.prepare("INSERT INTO profile_media VALUES(?,?,?,?,?,?)").run(
          mid,
          id,
          storage,
          "image",
          "image/png",
          0
        );
      }
      db.prepare("INSERT OR IGNORE INTO migrations VALUES(?,?)").run(
        100 + i,
        new Date().toISOString()
      );
      // Deleted seed media must not reappear as a row or orphan on restart.
      if (db.prepare("SELECT 1 FROM profile_media WHERE id=?").get(mid)) {
        writeFileSync(
          join(dataDir, "media", storage),
          png(
            [
              [121, 93, 175],
              [206, 120, 105],
              [70, 146, 148],
              [194, 158, 80],
            ][i]
          )
        );
      }
    }
  });
}
