import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { Domain, uid } from '../src/domain.js';
import { demoIds } from '../src/db/database.js';
import { registerAssistant } from '../src/modules/assistant/index.js';
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'gap-assistant-'));
  const app = await createApp({ dataDir: dir, dbPath: ':memory:' });
  const d = new Domain(app.db, app.config); d.io = app.io;
  if (!app.hasRoute({ method: 'POST', url: '/v1/ai/openers' })) registerAssistant(app, d);
  const call = (method: any, url: string, token: string, payload?: any) => app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, ...(payload === undefined ? {} : { payload }) });
  const login = async (account: string) => (await app.inject({ method: 'POST', url: '/v1/demo/sessions', payload: { account } })).json().data.token;
  return { app, d, call, a: await login('A'), b: await login('B'), c: await login('C'), close: async () => { await app.close(); await rm(dir, { recursive: true, force: true }); } };
}
test('assistant: consent, public target and active match membership are mandatory', async () => {
  const f = await fixture(); try {
    assert.equal((await f.call('POST', '/v1/ai/openers', f.a, { targetUserId: demoIds.B, consent: false })).statusCode, 400);
    const opener = await f.call('POST', '/v1/ai/openers', f.a, { targetUserId: demoIds.B, consent: true });
    assert.equal(opener.statusCode, 200); assert.equal(opener.json().data.mode, 'demo'); assert.equal(opener.json().data.provider, 'local-template');
    const match = uid(); f.d.run("INSERT INTO matches(id,user_low,user_high,status,created_at) VALUES(?,?,?,'active',?)", match, demoIds.A, demoIds.B, f.d.date());
    assert.equal((await f.call('POST', '/v1/ai/reply-suggestions', f.c, { matchId: match, consent: true })).statusCode, 404);
    assert.equal((await f.call('POST', '/v1/ai/reply-suggestions', f.a, { matchId: match, consent: true })).statusCode, 200);
    f.d.run("UPDATE matches SET status='ended' WHERE id=?", match);
    assert.equal((await f.call('POST', '/v1/ai/reply-suggestions', f.a, { matchId: match, consent: true })).statusCode, 403);
    f.d.run('INSERT INTO blocks VALUES(?,?,?)', demoIds.B, demoIds.A, f.d.date());
    assert.equal((await f.call('POST', '/v1/ai/openers', f.a, { targetUserId: demoIds.B, consent: true })).statusCode, 404);
  } finally { await f.close(); }
});
test('assistant: private synthetic practice has duplicate-safe turns and owner-only cascade delete', async () => {
  const f = await fixture(); try {
    const session = (await f.call('POST', '/v1/ai/practice/sessions', f.a, { consent: true })).json().data;
    const url = `/v1/ai/practice/sessions/${session.id}`, payload = { clientMessageId: uid(), text: 'Bạn thích làm gì?' };
    assert.equal((await f.call('GET', url, f.c)).statusCode, 404);
    assert.equal((await f.call('DELETE', url, f.c)).statusCode, 404);
    const first = await f.call('POST', `${url}/messages`, f.a, payload); assert.equal(first.statusCode, 200);
    assert.deepEqual((await f.call('POST', `${url}/messages`, f.a, payload)).json(), first.json());
    assert.equal((await f.call('POST', `${url}/messages`, f.a, { ...payload, text: 'Khác' })).statusCode, 409);
    assert.equal((await f.call('GET', url, f.a)).json().data.messages.length, 1);
    assert.equal(f.d.one('SELECT count(*) n FROM messages').n, 0); assert.equal(f.d.one('SELECT count(*) n FROM matches').n, 0);
    assert.equal((await f.call('DELETE', url, f.a)).statusCode, 200); assert.equal(f.d.one('SELECT count(*) n FROM ai_messages').n, 0);
  } finally { await f.close(); }
});
test('Explore: SQL declared topic/vibe preserves core discovery blocks and pagination', async () => {
  const f = await fixture(); try {
    assert.equal((await f.call('PUT', '/v1/me/vibe', f.b, { vibe: 'curious' })).statusCode, 200);
    const url = '/v1/explore?topicId=coffee&vibe=curious&limit=50';
    assert.deepEqual((await f.call('GET', url, f.a)).json().data.map((p: any) => p.userId), [demoIds.B]);
    f.d.run('INSERT INTO blocks VALUES(?,?,?)', demoIds.B, demoIds.A, f.d.date());
    assert.equal((await f.call('GET', url, f.a)).json().data.length, 0);
    assert.equal((await f.call('GET', '/v1/explore?vibe=imaginary', f.a)).statusCode, 400);
    const page = (await f.call('GET', '/v1/explore?topicId=travel&limit=1', f.a)).json();
    assert.equal(page.data.length, 0); assert.ok(page.meta.nextCursor);
  } finally { await f.close(); }
});
