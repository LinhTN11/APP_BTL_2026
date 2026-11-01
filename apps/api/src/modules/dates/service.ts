import { readFileSync } from 'node:fs';
import { Domain, fail, hash } from '../../domain.js';
import { transaction } from '../../db/database.js';
import { text } from './validation.js';

export function migrateDates(d: Domain) {
  transaction(d.db, () => {
    if (d.one('SELECT 1 FROM migrations WHERE version=3')) return;
    d.db.exec(readFileSync(new URL('../../db/migrations/003_dates.sql', import.meta.url), 'utf8'));
    d.run('INSERT INTO migrations VALUES(3,?)', d.date());
  });
}
export function venue(d: Domain, id: string) {
  const row = d.one('SELECT * FROM dates_venues WHERE id=?', id);
  if (!row) return fail(404, 'NOT_FOUND', 'Không tìm thấy địa điểm');
  return {
    id: row.id, name: row.name, area: row.area, address: row.address,
    location: { latitude: row.latitude, longitude: row.longitude }, hours: row.hours,
    criteria: JSON.parse(row.criteria_json), updatedAt: row.updated_at,
    mode: 'demo', source: 'synthetic', safetyNotice: 'Dữ liệu minh họa; không bảo đảm an toàn',
    vouchers: d.all('SELECT * FROM dates_vouchers WHERE venue_id=? ORDER BY id', id).map(v => ({
      id: v.id, code: v.code, conditions: v.conditions, expiresAt: v.expires_at,
      expired: Date.parse(v.expires_at) <= d.config.now(), mode: 'demo', redeemable: false,
    })),
  };
}
export function access(d: Domain, actor: string, id: string) {
  const row = d.one('SELECT p.* FROM dates_plans p JOIN dates_members m ON m.plan_id=p.id WHERE p.id=? AND m.user_id=?', id, actor);
  if (!row) return fail(404, 'NOT_FOUND', 'Không tìm thấy kế hoạch');
  return row;
}
export function plan(d: Domain, p: any) {
  return {
    id: p.id, matchId: p.match_id, proposerId: p.proposer_id,
    memberIds: d.all('SELECT user_id FROM dates_members WHERE plan_id=? ORDER BY user_id', p.id).map(r => r.user_id),
    title: p.title, venue: venue(d, p.venue_id), startsAt: p.starts_at, endsAt: p.ends_at,
    timezone: p.timezone, status: p.status, version: p.version,
    createdAt: p.created_at, updatedAt: p.updated_at, mode: 'real',
  };
}
export function eligible(d: Domain, actor: string, id: string) {
  const p = access(d, actor, id);
  if (!['accepted', 'completed'].includes(p.status) || Date.parse(p.ends_at) > d.config.now())
    fail(409, 'DATE_NOT_ELIGIBLE', 'Chỉ đánh giá sau buổi hẹn đã được chấp nhận và kết thúc');
  return p;
}
// Namespace each operation and persist its response in the same write transaction.
export function once<T>(d: Domain, actor: string, requestId: unknown, operation: string, payload: unknown, action: () => T): T {
  const key = text(requestId, 100), fingerprint = hash(JSON.stringify({ operation, payload }));
  return transaction(d.db, () => {
    const prior = d.one('SELECT * FROM dates_operations WHERE actor_id=? AND request_id=?', actor, key);
    if (prior) {
      if (prior.fingerprint !== fingerprint) fail(409, 'IDEMPOTENCY_CONFLICT', 'requestId đã dùng cho nội dung khác');
      return JSON.parse(prior.response_json) as T;
    }
    const result = action();
    d.run('INSERT INTO dates_operations VALUES(?,?,?,?)', actor, key, fingerprint, JSON.stringify(result));
    return result;
  });
}
