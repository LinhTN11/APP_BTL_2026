CREATE TABLE IF NOT EXISTS personalizations (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  advanced_json TEXT NOT NULL DEFAULT '{}',
  filters_json TEXT NOT NULL DEFAULT '{}',
  personality_json TEXT,
  mood_text TEXT,
  mood_expires_at INTEGER,
  gate_question TEXT,
  gate_version INTEGER NOT NULL DEFAULT 0,
  gate_salt TEXT,
  gate_answer_hash TEXT
);
CREATE TABLE IF NOT EXISTS personality_answers (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  version TEXT NOT NULL,
  answers_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS like_gate_attempts (
  actor_id TEXT NOT NULL REFERENCES users(id),
  target_id TEXT NOT NULL REFERENCES users(id),
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL,
  PRIMARY KEY(actor_id,target_id)
);
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id),
  creator_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK(kind IN ('truth-or-dare','twenty-questions')),
  status TEXT NOT NULL CHECK(status IN ('invited','active','ended')),
  version INTEGER NOT NULL DEFAULT 0,
  prompt_index INTEGER NOT NULL DEFAULT 0,
  next_actor_id TEXT NOT NULL REFERENCES users(id),
  request_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(creator_id,request_id)
);
CREATE TABLE IF NOT EXISTS game_turns (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id),
  actor_id TEXT NOT NULL REFERENCES users(id),
  request_id TEXT NOT NULL,
  request_json TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(actor_id,request_id)
);
INSERT OR IGNORE INTO migrations(version,applied_at) VALUES(2,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
