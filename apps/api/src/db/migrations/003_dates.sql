CREATE TABLE IF NOT EXISTS dates_venues(
  id TEXT PRIMARY KEY, name TEXT NOT NULL, area TEXT NOT NULL, address TEXT NOT NULL,
  latitude REAL NOT NULL, longitude REAL NOT NULL, hours TEXT NOT NULL,
  criteria_json TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS dates_vouchers(
  id TEXT PRIMARY KEY, venue_id TEXT NOT NULL REFERENCES dates_venues(id),
  code TEXT NOT NULL, conditions TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS dates_plans(
  id TEXT PRIMARY KEY, match_id TEXT NOT NULL REFERENCES matches(id),
  proposer_id TEXT NOT NULL REFERENCES users(id), venue_id TEXT NOT NULL REFERENCES dates_venues(id),
  title TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, timezone TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('proposed','accepted','cancelled','completed')),
  version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS dates_members(
  plan_id TEXT NOT NULL REFERENCES dates_plans(id), user_id TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY(plan_id,user_id)
);
CREATE TABLE IF NOT EXISTS dates_operations(
  actor_id TEXT NOT NULL REFERENCES users(id), request_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL, response_json TEXT NOT NULL, PRIMARY KEY(actor_id,request_id)
);
CREATE TABLE IF NOT EXISTS dates_reviews(
  id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES dates_plans(id),
  venue_id TEXT NOT NULL REFERENCES dates_venues(id), actor_id TEXT NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), text TEXT NOT NULL,
  crowded INTEGER NOT NULL, staff_support INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('published','pending_review')),
  created_at TEXT NOT NULL, UNIQUE(plan_id,actor_id)
);
CREATE TABLE IF NOT EXISTS dates_review_reports(
  review_id TEXT NOT NULL REFERENCES dates_reviews(id), actor_id TEXT NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(review_id,actor_id)
);
CREATE TABLE IF NOT EXISTS dates_feedback(
  plan_id TEXT NOT NULL REFERENCES dates_plans(id), actor_id TEXT NOT NULL REFERENCES users(id),
  attended INTEGER NOT NULL, tags_json TEXT NOT NULL, created_at TEXT NOT NULL,
  PRIMARY KEY(plan_id,actor_id)
);
CREATE INDEX IF NOT EXISTS dates_members_user ON dates_members(user_id,plan_id);
CREATE INDEX IF NOT EXISTS dates_reviews_venue ON dates_reviews(venue_id,status,created_at,id);
INSERT OR IGNORE INTO dates_venues VALUES
('demo-cafe-lotus','Quán Sen Minh Họa','demo-centre','12 Đường Mẫu, khu vực minh họa',10.776,106.701,'08:00–21:00 (giả lập)','["public_space","staff_present"]','2026-11-01T00:00:00.000Z'),
('demo-library-garden','Vườn Sách Minh Họa','demo-centre','24 Đường Mẫu, khu vực minh họa',10.781,106.697,'09:00–20:00 (giả lập)','["public_space","well_lit"]','2026-11-01T00:00:00.000Z'),
('demo-river-cafe','Quán Bờ Sông Minh Họa','demo-east','36 Đường Mẫu, khu vực minh họa',10.805,106.735,'07:00–22:00 (giả lập)','["staff_present"]','2026-11-01T00:00:00.000Z');
INSERT OR IGNORE INTO dates_vouchers VALUES
('demo-lotus-offer','demo-cafe-lotus','DEMO-COFFEE','Minh họa giảm 10%; không đổi tại quán, không có đối tác thật','2027-01-01T00:00:00.000Z');
