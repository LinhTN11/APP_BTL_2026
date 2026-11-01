import { readFileSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { Domain, fail, uid, cursorPage, encodeCursor } from '../../domain.js';
import { transaction } from '../../db/database.js';
import { object, str, uuid, enumString } from '../../schemas.js';
import { products } from './catalog.js';
import { readEntitlements, demoPolicy, utcDay, isIncognitoHidden } from './entitlements.js';
export { readEntitlements, assertLikeAllowed, recordLikeUsage, isIncognitoHidden, boostWeight, assertAdvancedFilterAllowed } from './entitlements.js';

/** Must be synchronous, validate core eligibility/gates, and must NOT open a nested transaction. */
export type CoreLike = (actorId: string, targetUserId: string, gateAnswer?: string) => { swipeId: string; match: unknown };
export interface BillingHooks { like?: CoreLike; validateLike?: (actorId: string, targetUserId: string, gateAnswer?: string) => void }
const key = str(128);
function nonBlank(value: string) { if (!value.trim()) fail(400, 'VALIDATION_ERROR', 'Khóa yêu cầu không được trống'); }
function requireGold(d: Domain, actor: string) {
  if (readEntitlements(d, actor).plan !== 'gold') fail(403, 'ENTITLEMENT_REQUIRED', 'Cần Gold demo còn hạn');
}
function actionRetry(d: Domain, actor: string, kind: string, idempotencyKey: string, request: string) {
  const row = d.one('SELECT * FROM billing_actions WHERE user_id=? AND kind=? AND idempotency_key=?', actor, kind, idempotencyKey);
  if (!row) return null;
  if (row.request_json !== request) fail(409, 'REQUEST_CONFLICT', 'Khóa đã được dùng với dữ liệu khác');
  return JSON.parse(row.response_json);
}
function saveAction(d: Domain, actor: string, kind: string, idempotencyKey: string, request: string, response: unknown) {
  d.run('INSERT INTO billing_actions VALUES(?,?,?,?,?,?,?,?)', uid(), actor, kind, idempotencyKey, request, JSON.stringify(response), utcDay(d), d.date());
}
export function registerBilling(app: FastifyInstance, d: Domain, hooks: BillingHooks = {}) {
  transaction(d.db, () => d.db.exec(readFileSync(new URL('../../db/migrations/006_billing.sql', import.meta.url), 'utf8')));
  app.get('/v1/plans', async () => ({ data: { mode: 'demo', products, policy: demoPolicy,
    notice: 'Mô phỏng, giá chưa cấu hình, không có tiền thật. Gold kế thừa Plus; noAds là cờ quyền lợi, chưa tích hợp mạng quảng cáo.' } }));
  app.get('/v1/me/entitlements', async req => ({ data: readEntitlements(d, req.actor) }));
  app.patch('/v1/me/incognito', { schema: { body: object({ enabled: { type: 'boolean' } }) } }, async req => {
    if (!readEntitlements(d, req.actor).incognitoAvailable) fail(403, 'ENTITLEMENT_REQUIRED', 'Cần Plus/Gold demo còn hạn');
    d.run('UPDATE entitlements SET incognito=? WHERE user_id=?', (req.body as any).enabled ? 1 : 0, req.actor);
    return { data: readEntitlements(d, req.actor) };
  });
  app.post('/v1/demo/purchases', { schema: { body: object({ productId: enumString(products.map(p => p.id)),
    outcome: enumString(['success', 'failure', 'cancel']), idempotencyKey: key }) } }, async req => {
    if (!d.config.demoMode) fail(403, 'DEMO_DISABLED', 'Mua mô phỏng đã tắt');
    const { productId, outcome, idempotencyKey } = req.body as any; nonBlank(idempotencyKey);
    return { data: transaction(d.db, () => {
      const prior = d.one('SELECT * FROM demo_purchases WHERE user_id=? AND idempotency_key=?', req.actor, idempotencyKey);
      if (prior) {
        if (prior.product_id !== productId || prior.outcome !== outcome) fail(409, 'REQUEST_CONFLICT', 'Khóa đã được dùng với dữ liệu khác');
        return JSON.parse(prior.response_json);
      }
      const id = uid(), now = d.config.now();
      let expiresAt: string | null = null;
      if (outcome === 'success' && (productId === 'plus' || productId === 'gold')) {
        const expiry = now + demoPolicy.subscriptionDays * 86_400_000; expiresAt = new Date(expiry).toISOString();
        // An explicit successful purchase replaces the current plan and starts a fresh demo term.
        d.run('INSERT INTO entitlements VALUES(?,?,?,0) ON CONFLICT(user_id) DO UPDATE SET plan=excluded.plan,expires_at=excluded.expires_at,incognito=0', req.actor, productId, expiry);
      }
      const response = { id, mode: 'demo', productId, outcome, granted: outcome === 'success', expiresAt, createdAt: d.date(), notice: 'Mô phỏng; không thu tiền.' };
      d.run('INSERT INTO demo_purchases VALUES(?,?,?,?,?,?,?)', id, req.actor, idempotencyKey, productId, outcome, JSON.stringify(response), d.date());
      return response;
    }) };
  });
  app.post('/v1/boosts', { schema: { body: object({ productId: enumString(['boost', 'super-boost']), idempotencyKey: key }) } }, async req => {
    if (!d.config.demoMode) fail(403, 'DEMO_DISABLED', 'Boost mô phỏng đã tắt');
    const { productId, idempotencyKey } = req.body as any; nonBlank(idempotencyKey);
    return { data: transaction(d.db, () => {
      const prior = d.one('SELECT * FROM boosts WHERE user_id=? AND idempotency_key=?', req.actor, idempotencyKey);
      if (prior) {
        if (prior.product_id !== productId) fail(409, 'REQUEST_CONFLICT', 'Khóa đã được dùng với sản phẩm khác');
        return JSON.parse(prior.response_json);
      }
      if (d.one('SELECT 1 FROM boosts WHERE user_id=? AND expires_at>?', req.actor, d.config.now())) fail(409, 'BOOST_ACTIVE', 'Đã có Boost đang hoạt động');
      const credit = d.one("SELECT p.id FROM demo_purchases p WHERE p.user_id=? AND p.product_id=? AND p.outcome='success' AND NOT EXISTS(SELECT 1 FROM boosts b WHERE b.purchase_id=p.id) ORDER BY p.created_at,p.id LIMIT 1", req.actor, productId);
      if (!credit) fail(403, 'BOOST_CREDIT_REQUIRED', 'Chưa có lượt Boost mô phỏng');
      const duration = productId === 'boost' ? demoPolicy.boostMinutes : demoPolicy.superBoostMinutes;
      const weight = productId === 'boost' ? demoPolicy.boostWeight : demoPolicy.superBoostWeight;
      const expires = d.config.now() + duration * 60_000, id = uid();
      const response = { id, mode: 'demo', productId, weight, expiresAt: new Date(expires).toISOString(), notice: 'Chỉ tăng trọng số hiển thị; không đảm bảo lượt xem hoặc Match.' };
      d.run('INSERT INTO boosts VALUES(?,?,?,?,?,?,?,?,?)', id, req.actor, credit.id, productId, weight, expires, idempotencyKey, JSON.stringify(response), d.date());
      return response;
    }) };
  });
  app.post('/v1/swipes/rewind', { schema: { body: object({ idempotencyKey: key }) } }, async req => {
    const { idempotencyKey } = req.body as any; nonBlank(idempotencyKey);
    return { data: transaction(d.db, () => {
      const prior = actionRetry(d, req.actor, 'rewind', idempotencyKey, '{}'); if (prior) return prior;
      if (readEntitlements(d, req.actor).rewindsRemaining < 1) fail(403, 'REWIND_UNAVAILABLE', 'Cần Plus/Gold còn hạn và lượt Rewind trong ngày UTC');
      const swipe = d.one('SELECT * FROM swipes WHERE actor_id=? ORDER BY rowid DESC LIMIT 1', req.actor);
      if (!swipe) fail(404, 'NOT_FOUND', 'Chưa có thao tác để hoàn tác');
      const [low, high] = [req.actor, swipe.target_id].sort();
      if (d.one('SELECT 1 FROM matches WHERE user_low=? AND user_high=?', low, high)) fail(409, 'REWIND_MATCH_EXISTS', 'Không thể hoàn tác thao tác có Match, kể cả đã kết thúc');
      // Like usage intentionally has no FK cascade: deleting a swipe never refunds a Like.
      d.run('DELETE FROM swipes WHERE id=? AND actor_id=?', swipe.id, req.actor);
      const response = { swipeId: swipe.id, rewound: true };
      saveAction(d, req.actor, 'rewind', idempotencyKey, '{}', response); return response;
    }) };
  });
  app.post('/v1/super-likes', { schema: { body: object({ targetUserId: uuid, idempotencyKey: key, gateAnswer: str(100) }, ['targetUserId', 'idempotencyKey']) } }, async req => {
    const { targetUserId, idempotencyKey, gateAnswer } = req.body as any; nonBlank(idempotencyKey);
    if (!hooks.like || !hooks.validateLike) fail(503, 'CORE_LIKE_UNAVAILABLE', 'Chưa đăng ký xử lý Like thống nhất');
    const request = JSON.stringify({ targetUserId, gateAnswer: gateAnswer ?? null });
    const retried = actionRetry(d, req.actor, 'super-like', idempotencyKey, request);
    if (retried) return { data: retried };
    // Validation stays outside the transaction so failed gate attempts remain rate limited.
    hooks.validateLike!(req.actor, targetUserId, gateAnswer);
    return { data: transaction(d.db, () => {
      const prior = actionRetry(d, req.actor, 'super-like', idempotencyKey, request); if (prior) return prior;
      if (readEntitlements(d, req.actor).superLikesRemaining < 1) fail(403, 'SUPER_LIKE_UNAVAILABLE', 'Cần Gold còn hạn và lượt Super Like trong ngày UTC');
      if (d.one('SELECT 1 FROM swipes WHERE actor_id=? AND target_id=?', req.actor, targetUserId)) fail(409, 'SWIPE_EXISTS', 'Đã chọn hồ sơ này; thử lại bằng cùng khóa');
      const response = { ...hooks.like!(req.actor, targetUserId, gateAnswer), superLike: true };
      saveAction(d, req.actor, 'super-like', idempotencyKey, request, response); return response;
    }) };
  });
  app.get('/v1/me/sent-likes', async req => {
    requireGold(d, req.actor);
    const { limit, cursor } = cursorPage(req.query);
    const rows = d.all("SELECT s.* FROM swipes s JOIN users u ON u.id=s.target_id WHERE s.actor_id=? AND s.action='like' AND u.account_status='active' ORDER BY s.created_at,s.id", req.actor)
      .filter(s => (!cursor || s.created_at > cursor[0] || (s.created_at === cursor[0] && s.id > cursor[1])) && !d.blocked(req.actor, s.target_id) && !isIncognitoHidden(d, req.actor, s.target_id) && d.complete(s.target_id));
    const page = rows.slice(0, limit), last = page.at(-1);
    return { data: page.map(s => ({ swipeId: s.id, createdAt: s.created_at, profile: d.profile(s.target_id) })), meta: { nextCursor: rows.length > limit && last ? encodeCursor([last.created_at, last.id]) : null } };
  });
  app.get('/v1/me/curated-picks', async req => {
    requireGold(d, req.actor); const { limit } = cursorPage(req.query);
    const response = await app.inject({ method: 'GET', url: `/v1/discovery?limit=${limit}`, headers: { authorization: req.headers.authorization! } });
    if (response.statusCode !== 200) fail(response.statusCode, 'DISCOVERY_UNAVAILABLE', 'Không thể tải danh sách hiện tại');
    const result = response.json();
    return { ...result, meta: { ...result.meta, mode: 'demo', explanation: 'Danh sách đủ điều kiện theo thứ tự discovery; không phải dự đoán AI.' } };
  });
}
