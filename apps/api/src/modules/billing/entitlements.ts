import { Domain, fail } from '../../domain.js';

export const demoPolicy = { freeLikesPerDay: 20, plusRewindsPerDay: 5, goldSuperLikesPerDay: 5,
  subscriptionDays: 30, boostMinutes: 30, superBoostMinutes: 60, boostWeight: 5, superBoostWeight: 10 } as const;
export const billingTablesReady = (d: Domain) => !!d.one("SELECT 1 FROM sqlite_master WHERE type='table' AND name='entitlements'");
export const utcDay = (d: Domain) => d.date().slice(0, 10);

export function readEntitlements(d: Domain, userId: string) {
  const ready = billingTablesReady(d);
  const row = ready && d.config.demoMode ? d.one('SELECT * FROM entitlements WHERE user_id=? AND expires_at>?', userId, d.config.now()) : null;
  const plan: 'free' | 'plus' | 'gold' = row?.plan ?? 'free';
  const paid = plan !== 'free', gold = plan === 'gold';
  const used = ready ? Number(d.one('SELECT count(*) n FROM like_usage WHERE user_id=? AND day=?', userId, utcDay(d)).n) : 0;
  const count = (kind: string) => ready ? Number(d.one('SELECT count(*) n FROM billing_actions WHERE user_id=? AND kind=? AND day=?', userId, kind, utcDay(d)).n) : 0;
  return { mode: 'demo' as const, plan, expiresAt: row ? new Date(row.expires_at).toISOString() : null,
    unlimitedLikes: paid, likesRemaining: paid ? null : Math.max(0, demoPolicy.freeLikesPerDay - used),
    rewindsRemaining: paid ? Math.max(0, demoPolicy.plusRewindsPerDay - count('rewind')) : 0,
    superLikesRemaining: gold ? Math.max(0, demoPolicy.goldSuperLikesPerDay - count('super-like')) : 0,
    incognitoAvailable: paid, incognito: paid && row.incognito === 1, noAds: paid,
    advancedFilters: gold, curatedPicks: gold, sentLikes: gold,
    notice: 'Quyền lợi và hạn mức cấu hình demo; không phải giá/gói kinh doanh đã duyệt. Không xử lý tiền thật.' };
}
export function assertLikeAllowed(d: Domain, actorId: string) {
  if (readEntitlements(d, actorId).likesRemaining === 0)
    fail(429, 'LIKE_QUOTA_EXCEEDED', 'Đã hết lượt Like demo trong ngày UTC');
}
export function recordLikeUsage(d: Domain, actorId: string, swipeId: string) {
  if (!billingTablesReady(d)) return;
  d.run('INSERT OR IGNORE INTO like_usage VALUES(?,?,?,?)', swipeId, actorId, utcDay(d), d.date());
}
export function assertAdvancedFilterAllowed(d: Domain, actorId: string) {
  if (!readEntitlements(d, actorId).advancedFilters)
    fail(403, 'ENTITLEMENT_REQUIRED', 'Bộ lọc nâng cao cần quyền Gold demo còn hạn');
}
export function isIncognitoHidden(d: Domain, viewer: string, target: string) {
  if (viewer === target || !readEntitlements(d, target).incognito) return false;
  return !d.one("SELECT 1 FROM swipes WHERE actor_id=? AND target_id=? AND action='like'", target, viewer);
}
export function boostWeight(d: Domain, userId: string) {
  if (!d.config.demoMode || !billingTablesReady(d)) return 1;
  return Math.max(1, Number(d.one('SELECT max(weight) weight FROM boosts WHERE user_id=? AND expires_at>?', userId, d.config.now())?.weight ?? 1));
}
