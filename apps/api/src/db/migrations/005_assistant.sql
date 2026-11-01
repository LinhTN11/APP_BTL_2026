CREATE TABLE IF NOT EXISTS ai_sessions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
  persona TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_sessions_owner ON ai_sessions(user_id,created_at,id);
CREATE TABLE IF NOT EXISTS ai_messages (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
  client_message_id TEXT NOT NULL, text TEXT NOT NULL, response_json TEXT NOT NULL,
  created_at TEXT NOT NULL, UNIQUE(session_id,client_message_id)
);
CREATE TABLE IF NOT EXISTS assistant_usage (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL, context_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS assistant_usage_owner ON assistant_usage(user_id,created_at);
CREATE TABLE IF NOT EXISTS profile_vibes (
  user_id TEXT PRIMARY KEY REFERENCES users(id), vibe TEXT NOT NULL, updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO migrations(version,applied_at) VALUES(5,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
