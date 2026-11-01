import type { FastifyInstance } from 'fastify';
import { Domain, fail, uid } from '../../domain.js';
import { transaction } from '../../db/database.js';
import { eligible, venue } from './service.js';
import { body, bool, text } from './validation.js';

function review(r: any) {
  return { id: r.id, venueId: r.venue_id, rating: r.rating, text: r.text,
    crowded: !!r.crowded, staffSupport: !!r.staff_support, createdAt: r.created_at,
    source: 'participant_report', mode: 'real', notice: 'Đánh giá chủ quan; không bảo đảm an toàn' };
}
export function registerReviews(app: FastifyInstance, d: Domain) {
  app.get<{ Params: { id: string } }>('/v1/venues/:id/reviews', async req => {
    venue(d, req.params.id);
    return { data: d.all('SELECT * FROM dates_reviews WHERE venue_id=? AND status=\'published\' ORDER BY created_at DESC,id DESC LIMIT 50', req.params.id).map(review) };
  });
  app.post<{ Params: { id: string } }>('/v1/venues/:id/reviews', async req => {
    const b = body(req.body, ['planId', 'rating', 'text', 'crowded', 'staffSupport']);
    const p = eligible(d, req.actor, text(b.planId));
    if (p.venue_id !== req.params.id) fail(422, 'VENUE_MISMATCH', 'Địa điểm không thuộc kế hoạch này');
    if (!Number.isInteger(b.rating) || b.rating < 1 || b.rating > 5) fail(400, 'VALIDATION_ERROR', 'rating từ 1 đến 5');
    const message = text(b.text, 1000, true), crowded = bool(b.crowded), staffSupport = bool(b.staffSupport);
    return transaction(d.db, () => {
      const prior = d.one('SELECT * FROM dates_reviews WHERE plan_id=? AND actor_id=?', p.id, req.actor);
      if (prior) {
        if (prior.rating !== b.rating || prior.text !== message || !!prior.crowded !== crowded || !!prior.staff_support !== staffSupport)
          fail(409, 'ALREADY_REVIEWED', 'Mỗi thành viên chỉ đánh giá một lần cho buổi hẹn');
        return { data: review(prior) };
      }
      const id = uid();
      d.run('INSERT INTO dates_reviews VALUES(?,?,?,?,?,?,?,?,\'published\',?)', id, p.id, p.venue_id, req.actor, b.rating, message, Number(crowded), Number(staffSupport), d.date());
      return { data: review(d.one('SELECT * FROM dates_reviews WHERE id=?', id)) };
    });
  });
  app.post<{ Params: { id: string; reviewId: string } }>('/v1/venues/:id/reviews/:reviewId/report', async req => {
    const b = body(req.body, ['reason']);
    const reason = text(b.reason, 300);
    const r = d.one('SELECT id FROM dates_reviews WHERE id=? AND venue_id=?', req.params.reviewId, req.params.id);
    if (!r) fail(404, 'NOT_FOUND', 'Không tìm thấy đánh giá');
    transaction(d.db, () => {
      d.run('INSERT OR IGNORE INTO dates_review_reports VALUES(?,?,?,?)', req.params.reviewId, req.actor, reason, d.date());
      d.run('UPDATE dates_reviews SET status=\'pending_review\' WHERE id=?', req.params.reviewId);
    });
    return { data: { status: 'pending_review', mode: 'real', notice: 'Đã ẩn nội dung chờ người vận hành xem xét; không tự khóa tài khoản' } };
  });
  app.post<{ Params: { id: string } }>('/v1/date-plans/:id/feedback', async req => {
    const b = body(req.body, ['attended', 'tags']);
    eligible(d, req.actor, req.params.id);
    const attended = bool(b.attended), allowed = ['on_time', 'resembles_photos', 'respectful'];
    if (!Array.isArray(b.tags) || b.tags.length > 3 || new Set(b.tags).size !== b.tags.length || b.tags.some((t: unknown) => !allowed.includes(t as string)) || (!attended && b.tags.length))
      fail(400, 'VALIDATION_ERROR', 'Chỉ dùng nhãn hỗ trợ, không trùng; vắng mặt không có nhãn');
    const tags = JSON.stringify([...b.tags].sort());
    return transaction(d.db, () => {
      const prior = d.one('SELECT * FROM dates_feedback WHERE plan_id=? AND actor_id=?', req.params.id, req.actor);
      if (prior && (prior.attended !== Number(attended) || prior.tags_json !== tags))
        fail(409, 'ALREADY_REVIEWED', 'Đã gửi feedback cho buổi hẹn');
      if (!prior) d.run('INSERT INTO dates_feedback VALUES(?,?,?,?,?)', req.params.id, req.actor, Number(attended), tags, d.date());
      return { data: { recorded: true, visibility: 'private', mode: 'real' } };
    });
  });
}
