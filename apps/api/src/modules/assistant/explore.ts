import type { FastifyInstance } from 'fastify';
import { Domain, fail, cursorPage } from '../../domain.js';
import { object, enumString } from '../../schemas.js';

export const vibes = ['relaxed', 'active', 'curious'] as const;
export const topics = [
  { id: 'coffee', title: 'Cà phê', interests: ['coffee', 'cà phê'] },
  { id: 'music', title: 'Âm nhạc', interests: ['music', 'âm nhạc', 'nhạc'] },
  { id: 'travel', title: 'Du lịch', interests: ['travel', 'du lịch'] },
  { id: 'reading', title: 'Đọc sách', interests: ['reading', 'đọc sách', 'sách'] },
] as const;
export const vibeNotice = 'Vibe do người dùng tự chọn: relaxed (thư giãn), active (năng động), curious (ham khám phá); không suy luận từ chat, ảnh hay thuộc tính nhạy cảm.';

/** SQL predicate runs only AFTER the core discovery eligibility policy has selected a candidate. */
export function exploreUserMatches(d: Domain, userId: string, topicId?: string, vibe?: string) {
  const topic = topics.find(t => t.id === topicId);
  if (topicId && !topic) fail(400, 'VALIDATION_ERROR', 'Chủ đề không hợp lệ');
  if (vibe && !vibes.includes(vibe as any)) fail(400, 'VALIDATION_ERROR', 'Vibe không hợp lệ');
  if (topic && !d.one(`SELECT 1 FROM profiles p,json_each(p.interests_json) j WHERE p.user_id=? AND lower(trim(j.value)) IN (${topic.interests.map(() => '?').join(',')}) LIMIT 1`, userId, ...topic.interests)) return false;
  if (vibe && !d.one('SELECT 1 FROM profile_vibes WHERE user_id=? AND vibe=?', userId, vibe)) return false;
  return true;
}
export function registerExplore(app: FastifyInstance, d: Domain) {
  app.get('/v1/explore/topics', async () => ({ data: { mode: 'real', topics: topics.map(({ id, title }) => ({ id, title })), vibes, notice: vibeNotice,
    music: { mode: 'unavailable', reason: 'Chưa có OAuth nhà cung cấp; chủ đề nhạc chỉ dùng thẻ sở thích khai báo.' },
    personalityRanking: { mode: 'unavailable', reason: 'Chưa có thuật toán ghép tính cách được duyệt; không giả điểm AI.' } } }));
  app.get('/v1/me/vibe', async req => ({ data: { vibe: d.one('SELECT vibe FROM profile_vibes WHERE user_id=?', req.actor)?.vibe ?? null, source: 'user-declared', notice: vibeNotice } }));
  app.put('/v1/me/vibe', { schema: { body: object({ vibe: enumString([...vibes]) }) } }, async req => {
    const { vibe } = req.body as any;
    d.run('INSERT INTO profile_vibes VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET vibe=excluded.vibe,updated_at=excluded.updated_at', req.actor, vibe, d.date());
    return { data: { vibe, source: 'user-declared', notice: vibeNotice } };
  });
  app.delete('/v1/me/vibe', async req => { d.run('DELETE FROM profile_vibes WHERE user_id=?', req.actor); return { data: null }; });
  app.get('/v1/explore', async req => {
    const query = req.query as any;
    if (Object.keys(query).some(k => !['topicId', 'vibe', 'limit', 'cursor'].includes(k))) fail(400, 'VALIDATION_ERROR', 'Tham số không hợp lệ');
    const { limit } = cursorPage(query);
    if (query.topicId && !topics.some(t => t.id === query.topicId)) fail(400, 'VALIDATION_ERROR', 'Chủ đề không hợp lệ');
    if (query.vibe && !vibes.includes(query.vibe)) fail(400, 'VALIDATION_ERROR', 'Vibe không hợp lệ');
    const params = new URLSearchParams({ limit: String(limit) });
    if (query.cursor) params.set('cursor', query.cursor);
    // Fixed internal endpoint and original Authorization: no alternative eligibility implementation or arbitrary URL fetch.
    const response = await app.inject({ method: 'GET', url: `/v1/discovery?${params}`, headers: { authorization: req.headers.authorization! } });
    if (response.statusCode !== 200) fail(response.statusCode, 'DISCOVERY_UNAVAILABLE', 'Không thể tải khám phá hiện tại');
    const result = response.json();
    return { data: result.data.filter((p: any) => exploreUserMatches(d, p.userId, query.topicId, query.vibe)),
      meta: { ...result.meta, mode: 'real', source: 'declared-profile-fields', notice: 'Bộ lọc SQL theo khai báo, không phải AI. Mỗi trang lọc trên một trang discovery; trang có thể trống và vẫn có nextCursor.', topicId: query.topicId ?? null, vibe: query.vibe ?? null } };
  });
}
