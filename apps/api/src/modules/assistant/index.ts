import { readFileSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { Domain, fail, uid, cursorPage, encodeCursor } from '../../domain.js';
import { transaction } from '../../db/database.js';
import { object, uuid, str, enumString } from '../../schemas.js';
import { isIncognitoHidden } from '../billing/entitlements.js';
import { assistantNotice, localTemplateProvider } from './provider.js';
import { registerExplore } from './explore.js';

const consent = { type: 'boolean', const: true };
function limits(d: Domain, userId: string) {
  if (d.one('SELECT count(*) n FROM assistant_usage WHERE user_id=? AND created_at>=?', userId, new Date(d.config.now() - 60_000).toISOString()).n >= 10)
    fail(429, 'ASSISTANT_RATE_LIMIT', 'Tối đa 10 yêu cầu mẫu hội thoại mỗi phút');
  if (d.one('SELECT count(*) n FROM assistant_usage WHERE user_id=? AND created_at>=?', userId, `${d.date().slice(0, 10)}T00:00:00.000Z`).n >= 60)
    fail(429, 'ASSISTANT_BUDGET_EXCEEDED', 'Đã dùng 60 yêu cầu mẫu hội thoại trong ngày UTC');
}
function usage(d: Domain, actor: string, kind: string, count = 0) {
  d.run('INSERT INTO assistant_usage VALUES(?,?,?,?,?)', uid(), actor, kind, count, d.date());
}
function ownedSession(d: Domain, actor: string, id: string) {
  const s = d.one('SELECT * FROM ai_sessions WHERE id=? AND user_id=?', id, actor);
  if (!s) fail(404, 'NOT_FOUND', 'Không tìm thấy phiên luyện tập');
  return s;
}
const envelope = (suggestions: string[]) => ({ mode: 'demo', provider: 'local-template', suggestions, notice: assistantNotice });
export function registerAssistant(app: FastifyInstance, d: Domain) {
  transaction(d.db, () => d.db.exec(readFileSync(new URL('../../db/migrations/005_assistant.sql', import.meta.url), 'utf8')));
  app.post('/v1/ai/openers', { schema: { body: object({ targetUserId: uuid, consent }) } }, async req => {
    const { targetUserId } = req.body as any;
    d.target(req.actor, targetUserId);
    if (d.blocked(req.actor, targetUserId) || isIncognitoHidden(d, req.actor, targetUserId) || !d.complete(targetUserId)) fail(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ công khai');
    limits(d, req.actor);
    const own = d.profile(req.actor), other = d.profile(targetUserId);
    const shared = own.interests.filter((x: string) => other.interests.some((y: string) => x.normalize('NFKC').toLowerCase() === y.normalize('NFKC').toLowerCase())).slice(0, 3);
    usage(d, req.actor, 'opener');
    return { data: envelope(localTemplateProvider.suggest('opener', { sharedInterests: shared, messageCount: 0 })) };
  });
  app.post('/v1/ai/reply-suggestions', { schema: { body: object({ matchId: uuid, consent }) } }, async req => {
    const { matchId } = req.body as any; d.matchAccess(req.actor, matchId); limits(d, req.actor);
    // Fetch at most 10 text messages, 500 characters each; never location/media/other conversations.
    const context = d.all("SELECT content_json FROM messages WHERE match_id=? AND kind='text' ORDER BY created_at DESC,id DESC LIMIT 10", matchId)
      .map(m => String(JSON.parse(m.content_json).text ?? '').slice(0, 500));
    usage(d, req.actor, 'reply', context.length);
    return { data: { ...envelope(localTemplateProvider.suggest('reply', { sharedInterests: [], messageCount: context.length })), contextMessageCount: context.length } };
  });
  app.post('/v1/ai/practice/sessions', { schema: { body: object({ consent, persona: enumString(['friendly-peer']) }, ['consent']) } }, async req => {
    if (d.one('SELECT count(*) n FROM ai_sessions WHERE user_id=?', req.actor).n >= 10) fail(409, 'PRACTICE_SESSION_LIMIT', 'Xóa một phiên cũ trước khi tạo phiên mới');
    limits(d, req.actor); const id = uid();
    transaction(d.db, () => { d.run('INSERT INTO ai_sessions VALUES(?,?,?,?)', id, req.actor, 'friendly-peer', d.date()); usage(d, req.actor, 'practice-create'); });
    return { data: { id, persona: 'friendly-peer', synthetic: true, mode: 'demo', provider: 'local-template', createdAt: d.date(), notice: assistantNotice } };
  });
  app.get('/v1/ai/practice/sessions', async req => {
    const { limit, cursor } = cursorPage(req.query);
    const rows = d.all('SELECT id,persona,created_at FROM ai_sessions WHERE user_id=? ORDER BY created_at,id', req.actor)
      .filter(s => !cursor || s.created_at > cursor[0] || (s.created_at === cursor[0] && s.id > cursor[1]));
    const page = rows.slice(0, limit), last = page.at(-1);
    return { data: page.map(s => ({ id: s.id, persona: s.persona, createdAt: s.created_at, synthetic: true, mode: 'demo' })), meta: { nextCursor: rows.length > limit && last ? encodeCursor([last.created_at, last.id]) : null } };
  });
  app.get<{ Params: { id: string } }>('/v1/ai/practice/sessions/:id', async req => {
    const s = ownedSession(d, req.actor, req.params.id);
    // Bounded by the persisted 40-turn cap, independent of cursor input.
    const messages = d.all('SELECT * FROM ai_messages WHERE session_id=? ORDER BY rowid', s.id)
      .map(m => ({ clientMessageId: m.client_message_id, text: m.text, ...JSON.parse(m.response_json), createdAt: m.created_at }));
    return { data: { id: s.id, persona: s.persona, mode: 'demo', synthetic: true, messages, notice: assistantNotice } };
  });
  app.post<{ Params: { id: string } }>('/v1/ai/practice/sessions/:id/messages', { schema: { body: object({ clientMessageId: uuid, text: str(1000) }) } }, async req => {
    ownedSession(d, req.actor, req.params.id);
    const { clientMessageId, text } = req.body as any;
    if (!text.trim()) fail(400, 'VALIDATION_ERROR', 'Nội dung không được trống');
    return { data: transaction(d.db, () => {
      const prior = d.one('SELECT * FROM ai_messages WHERE session_id=? AND client_message_id=?', req.params.id, clientMessageId);
      if (prior) {
        if (prior.text !== text.trim()) fail(409, 'REQUEST_CONFLICT', 'Mã tin nhắn đã dùng với nội dung khác');
        return JSON.parse(prior.response_json);
      }
      limits(d, req.actor);
      const count = Number(d.one('SELECT count(*) n FROM ai_messages WHERE session_id=?', req.params.id).n);
      if (count >= 40) fail(409, 'PRACTICE_TURN_LIMIT', 'Phiên luyện tập giới hạn 40 lượt');
      const responses = ['Mình thường đọc sách hoặc đi dạo lúc rảnh. Còn bạn thích làm gì?', 'Nghe thú vị đấy. Bạn thích điểm nào nhất ở sở thích đó?', 'Cảm ơn bạn đã chia sẻ. Bạn có một câu hỏi mở nào muốn hỏi mình không?'];
      const response = { id: uid(), mode: 'demo', provider: 'local-template', synthetic: true, reply: responses[count % responses.length],
        feedback: text.includes('?') ? 'Bạn đã dùng câu hỏi; hãy giữ quyền lựa chọn và sự thoải mái cho người đối thoại.' : 'Bạn có thể thêm một câu hỏi mở để người đối thoại dễ tiếp tục.', notice: assistantNotice };
      d.run('INSERT INTO ai_messages VALUES(?,?,?,?,?,?)', response.id, req.params.id, clientMessageId, text.trim(), JSON.stringify(response), d.date());
      usage(d, req.actor, 'practice-turn'); return response;
    }) };
  });
  app.delete<{ Params: { id: string } }>('/v1/ai/practice/sessions/:id', async req => {
    ownedSession(d, req.actor, req.params.id); d.run('DELETE FROM ai_sessions WHERE id=? AND user_id=?', req.params.id, req.actor);
    return { data: { deleted: true } };
  });
  registerExplore(app, d);
}
