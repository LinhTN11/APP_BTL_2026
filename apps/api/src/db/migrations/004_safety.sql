CREATE TABLE IF NOT EXISTS safety_keywords (
  user_id TEXT PRIMARY KEY REFERENCES users(id), keywords_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS safety_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS contact_blocks (
  user_id TEXT NOT NULL REFERENCES users(id), phone_hmac TEXT NOT NULL,
  created_at TEXT NOT NULL, PRIMARY KEY(user_id,phone_hmac)
);
CREATE TABLE IF NOT EXISTS moderation_cases (
  id TEXT PRIMARY KEY, message_id TEXT NOT NULL UNIQUE REFERENCES messages(id),
  owner_id TEXT NOT NULL REFERENCES users(id), match_id TEXT NOT NULL REFERENCES matches(id),
  storage_key TEXT NOT NULL UNIQUE, mime TEXT NOT NULL, content_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','allowed','blurred','rejected')),
  mode TEXT NOT NULL DEFAULT 'demo' CHECK(mode='demo'), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS safety_report_reviews (
  report_id TEXT PRIMARY KEY REFERENCES reports(id),
  status TEXT NOT NULL CHECK(status IN ('reviewing','resolved','dismissed')), updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS moderation_decisions (
  id TEXT PRIMARY KEY, subject_id TEXT NOT NULL, subject_type TEXT NOT NULL CHECK(subject_type IN ('media','report')),
  reviewer_id TEXT NOT NULL REFERENCES users(id), decision TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS moderation_appeals (
  id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id),
  subject_id TEXT NOT NULL, subject_type TEXT NOT NULL CHECK(subject_type IN ('media','report')),
  reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'received', created_at TEXT NOT NULL,
  UNIQUE(actor_id,subject_id,subject_type)
);
CREATE TABLE IF NOT EXISTS unmatch_feedback (
  actor_id TEXT NOT NULL REFERENCES users(id), match_id TEXT NOT NULL REFERENCES matches(id),
  reason_code TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(actor_id,match_id)
);
INSERT OR IGNORE INTO migrations(version,applied_at) VALUES(4,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
