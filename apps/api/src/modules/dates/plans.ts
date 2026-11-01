import type { FastifyInstance } from 'fastify';
import { Domain, fail, uid } from '../../domain.js';
import { access, once, plan, venue } from './service.js';
import { body, dateTime, text, timezone, version } from './validation.js';
import { calendar } from './calendar.js';

export function registerPlans(app: FastifyInstance, d: Domain) {
  app.get('/v1/date-plans', async req => ({
    data: d.all('SELECT p.* FROM dates_plans p JOIN dates_members m ON m.plan_id=p.id WHERE m.user_id=? ORDER BY p.created_at DESC,p.id DESC LIMIT 100', req.actor).map(p => plan(d, p)),
  }));
  app.get<{ Params: { id: string } }>('/v1/date-plans/:id', async req => ({ data: plan(d, access(d, req.actor, req.params.id)) }));
  app.post('/v1/date-plans', async req => {
    const b = body(req.body, ['requestId', 'matchId', 'venueId', 'title', 'startsAt', 'endsAt', 'timezone']);
    // Revalidate active membership even on a retry after unmatch/block.
    const m = d.matchAccess(req.actor, text(b.matchId));
    const result = once(d, req.actor, b.requestId, 'create-plan', b, () => {
      const title = text(b.title, 120), startsAt = dateTime(b.startsAt), endsAt = dateTime(b.endsAt), tz = timezone(b.timezone);
      venue(d, text(b.venueId));
      if (Date.parse(startsAt) <= d.config.now()) fail(422, 'DATE_IN_PAST', 'Buổi hẹn phải bắt đầu trong tương lai');
      if (endsAt <= startsAt || Date.parse(endsAt) - Date.parse(startsAt) > 24 * 3600000)
        fail(422, 'DATE_RANGE_INVALID', 'Buổi hẹn cần thời lượng dương, tối đa 24 giờ');
      const id = uid(), now = d.date();
      d.run('INSERT INTO dates_plans VALUES(?,?,?,?,?,?,?,?,\'proposed\',1,?,?)', id, m.id, req.actor, b.venueId, title, startsAt, endsAt, tz, now, now);
      d.run('INSERT INTO dates_members VALUES(?,?),(?,?)', id, m.user_low, id, m.user_high);
      return plan(d, access(d, req.actor, id));
    });
    d.io.to(`match:${m.id}`).emit('date-plan:updated', { planId: result.id, matchId: m.id, version: result.version, status: result.status });
    return { data: result };
  });
  app.patch<{ Params: { id: string } }>('/v1/date-plans/:id', async req => {
    const b = body(req.body, ['requestId', 'version', 'status']);
    const p = access(d, req.actor, req.params.id);
    const expected = version(b.version), status = text(b.status, 20);
    if (!['accepted', 'cancelled', 'completed'].includes(status)) fail(400, 'VALIDATION_ERROR', 'Trạng thái không hỗ trợ');
    // Cancellation remains available after unmatch. Acceptance requires active match.
    if (status === 'accepted') d.matchAccess(req.actor, p.match_id);
    const result = once(d, req.actor, b.requestId, `patch-plan:${p.id}`, b, () => {
      if (p.version !== expected) fail(409, 'VERSION_CONFLICT', 'Kế hoạch đã thay đổi');
      const ended = Date.parse(p.ends_at) <= d.config.now();
      const canAccept = p.status === 'proposed' && p.proposer_id !== req.actor && Date.parse(p.starts_at) > d.config.now();
      const canCancel = ['proposed', 'accepted'].includes(p.status) && !ended;
      const canComplete = p.status === 'accepted' && ended;
      if (!(status === 'accepted' ? canAccept : status === 'cancelled' ? canCancel : canComplete))
        fail(409, 'STATE_CONFLICT', 'Không thể chuyển trạng thái kế hoạch');
      d.run('UPDATE dates_plans SET status=?,version=version+1,updated_at=? WHERE id=? AND version=?', status, d.date(), p.id, expected);
      return plan(d, access(d, req.actor, p.id));
    });
    d.io.to(`match:${p.match_id}`).emit('date-plan:updated', { planId: result.id, matchId: p.match_id, version: result.version, status: result.status });
    return { data: result };
  });
  app.get<{ Params: { id: string } }>('/v1/date-plans/:id/calendar.ics', async (req, reply) => {
    const p = plan(d, access(d, req.actor, req.params.id));
    return reply.header('Cache-Control', 'private, no-store')
      .header('Content-Disposition', `attachment; filename="date-${p.id}.ics"`)
      .type('text/calendar; charset=utf-8').send(calendar(p));
  });
}
