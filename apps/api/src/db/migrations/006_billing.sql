CREATE TABLE IF NOT EXISTS entitlements (
  user_id TEXT PRIMARY KEY REFERENCES users(id), plan TEXT NOT NULL CHECK(plan IN ('plus','gold')),
  expires_at INTEGER NOT NULL, incognito INTEGER NOT NULL DEFAULT 0 CHECK(incognito IN (0,1))
);
CREATE TABLE IF NOT EXISTS demo_purchases (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), idempotency_key TEXT NOT NULL,
  product_id TEXT NOT NULL, outcome TEXT NOT NULL CHECK(outcome IN ('success','failure','cancel')),
  response_json TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(user_id,idempotency_key)
);
CREATE TABLE IF NOT EXISTS like_usage (
  swipe_id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), day TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS like_usage_day ON like_usage(user_id,day);
CREATE TABLE IF NOT EXISTS boosts (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), purchase_id TEXT NOT NULL UNIQUE REFERENCES demo_purchases(id),
  product_id TEXT NOT NULL, weight INTEGER NOT NULL, expires_at INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL, response_json TEXT NOT NULL, created_at TEXT NOT NULL,
  UNIQUE(user_id,idempotency_key)
);
CREATE TABLE IF NOT EXISTS billing_actions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL,
  idempotency_key TEXT NOT NULL, request_json TEXT NOT NULL, response_json TEXT NOT NULL,
  day TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(user_id,kind,idempotency_key)
);
CREATE INDEX IF NOT EXISTS billing_actions_day ON billing_actions(user_id,kind,day);
INSERT OR IGNORE INTO migrations(version,applied_at) VALUES(6,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
