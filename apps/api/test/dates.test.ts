import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../src/app.js';
import { demoIds } from '../src/db/database.js';
import { Domain } from '../src/domain.js';
import { registerDates } from '../src/modules/dates/index.js';
import { migrateDates } from '../src/modules/dates/service.js';

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'gap-dates-'));
  let now = Date.parse('2026-11-01T08:00:00Z');
  let app = await createApp({ dataDir: dir, dbPath: join(dir, 'test.sqlite'), now: () => now });
  function register() {
    const d = new Domain(app.db, app.config); d.io = app.io;
    // Root integrates this registration into createApp; retain standalone worker test support.
    if (!app.hasRoute({ method: 'GET', url: '/v1/date-plans' })) registerDates(app, d);
    return d;
  }
  let d = register();
  const call = (method: any, url: string, token?: string, payload?: any) => app.inject({ method, url,
    headers: token ? { authorization: `Bearer ${token}` } : {}, ...(payload === undefined ? {} : { payload }) });
  const login = async (account: string) => (await call('POST', '/v1/demo/sessions', undefined, { account })).json().data.token as string;
  const a = await login('A'), b = await login('B'), c = await login('C');
  await call('POST', '/v1/swipes', a, { targetUserId: demoIds.B, action: 'like' });
  const matchId = (await call('POST', '/v1/swipes', b, { targetUserId: demoIds.A, action: 'like' })).json().data.match.id;
  let serial = 0;
  const creation = (extra: any = {}) => ({ requestId: `plan-${++serial}`, matchId, venueId: 'demo-cafe-lotus', title: 'Cà phê cùng nhau',
    startsAt: '2026-11-01T16:00:00+07:00', endsAt: '2026-11-01T17:00:00+07:00', timezone: 'Asia/Ho_Chi_Minh', ...extra });
  const create = async (extra: any = {}) => {
    const response = await call('POST', '/v1/date-plans', a, creation(extra));
    assert.equal(response.statusCode, 200, response.body); return response.json().data;
  };
  return { a, b, c, call, create, creation, matchId, get app() { return app; }, get d() { return d; },
    clock: (value: number) => { now = value; },
    restart: async () => { await app.close(); app = await createApp({ dataDir: dir, dbPath: join(dir, 'test.sqlite'), now: () => now }); d = register(); },
    close: async () => { await app.close(); await rm(dir, { recursive: true, force: true }); },
  };
}

test('dates: auth, active-match creation and outsider denial on every plan surface', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.call('GET', '/v1/venues')).statusCode, 401);
    const p = await f.create();
    assert.deepEqual(p.memberIds, [demoIds.A, demoIds.B].sort());
    assert.equal(p.status, 'proposed'); assert.equal(p.mode, 'real'); assert.equal(p.venue.mode, 'demo');
    assert.equal(JSON.stringify(p).includes('phone'), false);
    assert.equal((await f.call('GET', '/v1/date-plans', f.c)).json().data.length, 0);
    const outsiders: [string, string, any?][] = [
      ['GET', `/v1/date-plans/${p.id}`], ['GET', `/v1/date-plans/${p.id}/calendar.ics`],
      ['POST', `/v1/date-plans/${p.id}/share`, {}], ['POST', `/v1/date-plans/${p.id}/sos-preview`, { confirmed: true }],
      ['PATCH', `/v1/date-plans/${p.id}`, { requestId: 'outsider', version: 1, status: 'accepted' }],
      ['POST', `/v1/date-plans/${p.id}/feedback`, { attended: true, tags: [] }],
    ];
    for (const [method, url, payload] of outsiders) assert.equal((await f.call(method, url, f.c, payload)).statusCode, 404, url);
    assert.equal((await f.call('POST', '/v1/date-plans', f.c, f.creation())).statusCode, 404);
    await f.call('DELETE', `/v1/matches/${f.matchId}`, f.a);
    const response = await f.call('POST', '/v1/date-plans', f.a, f.creation());
    assert.equal(response.statusCode, 403); assert.equal(response.json().error.code, 'MATCH_INACTIVE');
    assert.equal((await f.call('PATCH', `/v1/date-plans/${p.id}`, f.b, { requestId: 'after-end', version: 1, status: 'accepted' })).statusCode, 403);
    assert.equal((await f.call('PATCH', `/v1/date-plans/${p.id}`, f.a, { requestId: 'cancel-ended-match', version: 1, status: 'cancelled' })).statusCode, 200);
  } finally { await f.close(); }
});

test('dates: temporal validation, bounds, unknown fields and ICS injection rejected', async () => {
  const f = await fixture();
  try {
    for (const extra of [
      { startsAt: '2026-11-01T09:00:00' }, { startsAt: '2026-02-30T09:00:00Z' },
      { startsAt: '2026-11-01T24:00:00Z' }, { timezone: 'Wrong/Zone' },
      { title: 'Meeting\r\nATTENDEE:attacker@example.test' }, { title: 'Meeting\u0000' },
      { endsAt: '2026-11-01T08:30:00Z' }, { endsAt: '2026-11-04T10:00:00Z' },
      { startsAt: '2026-10-01T09:00:00Z' }, { venueId: 'missing' }, { arbitraryGps: true },
    ]) {
      const response = await f.call('POST', '/v1/date-plans', f.a, f.creation(extra));
      assert.ok([400, 404, 422].includes(response.statusCode), response.body);
    }
    assert.equal(f.d.one('SELECT count(*) n FROM dates_plans').n, 0);
  } finally { await f.close(); }
});

test('dates: lifecycle membership, optimistic version and idempotent replay', async () => {
  const f = await fixture();
  try {
    const payload = f.creation();
    const p = (await f.call('POST', '/v1/date-plans', f.a, payload)).json().data;
    assert.deepEqual((await f.call('POST', '/v1/date-plans', f.a, payload)).json().data, p);
    assert.equal((await f.call('POST', '/v1/date-plans', f.a, { ...payload, title: 'Changed' })).statusCode, 409);
    const patch = (actor: string, requestId: string, version: number, status: string) => f.call('PATCH', `/v1/date-plans/${p.id}`, actor, { requestId, version, status });
    assert.equal((await patch(f.a, 'self-accept', 1, 'accepted')).statusCode, 409);
    const accept = await patch(f.b, 'accept', 1, 'accepted');
    assert.equal(accept.statusCode, 200); assert.equal(accept.json().data.version, 2);
    assert.deepEqual((await patch(f.b, 'accept', 1, 'accepted')).json(), accept.json());
    assert.equal((await patch(f.a, 'stale', 1, 'cancelled')).json().error.code, 'VERSION_CONFLICT');
    assert.equal((await patch(f.b, 'repeat', 2, 'accepted')).statusCode, 409);
    assert.equal((await patch(f.a, 'early', 2, 'completed')).statusCode, 409);
    f.clock(Date.parse('2026-11-01T10:01:00Z'));
    assert.equal((await patch(f.a, 'late-cancel', 2, 'cancelled')).statusCode, 409);
    assert.equal((await patch(f.b, 'done', 2, 'completed')).json().data.status, 'completed');
    assert.equal((await patch(f.a, 'reopen', 3, 'accepted')).statusCode, 409);
    assert.equal(f.d.one('SELECT count(*) n FROM dates_plans').n, 1);
  } finally { await f.close(); }
});

test('dates: eligible venue reviews and attendance feedback are once-only, private and reportable', async () => {
  const f = await fixture();
  try {
    const p = await f.create();
    const review = { planId: p.id, rating: 4, text: 'Đông người, có nhân viên hỗ trợ.', crowded: true, staffSupport: true };
    const url = '/v1/venues/demo-cafe-lotus/reviews', feedbackUrl = `/v1/date-plans/${p.id}/feedback`;
    assert.equal((await f.call('POST', url, f.a, review)).statusCode, 409);
    await f.call('PATCH', `/v1/date-plans/${p.id}`, f.b, { requestId: 'accept', version: 1, status: 'accepted' });
    assert.equal((await f.call('POST', feedbackUrl, f.a, { attended: true, tags: [] })).statusCode, 409);
    f.clock(Date.parse('2026-11-01T10:01:00Z'));
    assert.equal((await f.call('POST', url, f.c, review)).statusCode, 404);
    assert.equal((await f.call('POST', '/v1/venues/demo-library-garden/reviews', f.a, review)).statusCode, 422);
    assert.equal((await f.call('POST', url, f.a, { ...review, rating: 6 })).statusCode, 400);
    const r = (await f.call('POST', url, f.a, review)).json().data;
    assert.equal(r.rating, 4); assert.equal(r.actorId, undefined); assert.equal(r.planId, undefined);
    assert.equal((await f.call('POST', url, f.a, review)).json().data.id, r.id);
    assert.equal((await f.call('POST', url, f.a, { ...review, rating: 3 })).statusCode, 409);
    assert.equal((await f.call('GET', url, f.c)).json().data.length, 1);
    const feedback = { attended: true, tags: ['respectful', 'on_time'] };
    assert.equal((await f.call('POST', feedbackUrl, f.a, feedback)).json().data.visibility, 'private');
    assert.equal((await f.call('POST', feedbackUrl, f.a, { ...feedback, tags: ['on_time', 'respectful'] })).statusCode, 200);
    assert.equal((await f.call('POST', feedbackUrl, f.a, { attended: false, tags: [] })).statusCode, 409);
    assert.equal((await f.call('POST', feedbackUrl, f.b, { attended: false, tags: ['respectful'] })).statusCode, 400);
    assert.equal((await f.call('POST', feedbackUrl, f.b, { attended: true, tags: ['safe_forever'] })).statusCode, 400);
    assert.equal((await f.call('POST', `${url}/${r.id}/report`, f.c, { reason: 'Nội dung cần xem xét' })).statusCode, 200);
    assert.equal((await f.call('GET', url, f.c)).json().data.length, 0);
    assert.equal(f.d.one('SELECT count(*) n FROM dates_feedback').n, 1);
    assert.equal(f.d.one('SELECT account_status FROM users WHERE id=?', demoIds.A).account_status, 'active');
  } finally { await f.close(); }
});

test('dates: venue seed labeling, voluntary midpoint, no profile GPS inference and expired offers', async () => {
  const f = await fixture();
  try {
    const result = (await f.call('GET', '/v1/venues', f.a)).json();
    assert.equal(result.data.length, 3); assert.equal(result.meta.mode, 'demo');
    assert.equal(result.data[0].distanceKm, undefined);
    assert.equal((await f.call('GET', '/v1/venues?area=nonexistent', f.a)).json().data.length, 0);
    assert.equal((await f.call('GET', '/v1/venues?latitude=10&longitude=106', f.a)).statusCode, 422);
    assert.equal((await f.call('GET', '/v1/venues?latitude=91&longitude=106&ownConsent=true', f.a)).statusCode, 400);
    assert.equal((await f.call('GET', '/v1/venues?latitude=10&longitude=106&ownConsent=true&sharedLatitude=10&sharedLongitude=107', f.a)).statusCode, 422);
    const query = '/v1/venues?latitude=10.77&longitude=106.7&ownConsent=true&sharedLatitude=10.79&sharedLongitude=106.71&sharedConsent=true';
    const ranked = (await f.call('GET', query, f.a)).json();
    assert.equal(typeof ranked.data[0].distanceKm, 'number');
    assert.equal(ranked.meta.sharedLatitude, undefined); assert.equal(ranked.meta.latitude, undefined);
    assert.equal((await f.call('GET', '/v1/venues/demo-cafe-lotus', f.a)).json().data.vouchers[0].redeemable, false);
    f.d.run('UPDATE dates_vouchers SET expires_at=?', '2020-01-01T00:00:00Z');
    assert.equal((await f.call('GET', '/v1/venues/demo-cafe-lotus', f.a)).json().data.vouchers[0].expired, true);
    f.d.run('UPDATE dates_venues SET name=? WHERE id=?', 'Local custom name', 'demo-cafe-lotus');
    migrateDates(f.d);
    assert.equal(f.d.one('SELECT name FROM dates_venues WHERE id=?', 'demo-cafe-lotus').name, 'Local custom name');
    assert.equal(f.d.one('SELECT count(*) n FROM migrations WHERE version=3').n, 1);
  } finally { await f.close(); }
});

test('dates: share/SOS previews have no delivery side effects or stored private GPS', async () => {
  const f = await fixture();
  try {
    const p = await f.create(), url = `/v1/date-plans/${p.id}`;
    const share = (await f.call('POST', `${url}/share`, f.a, {})).json().data;
    assert.equal(share.delivery, 'prepared'); assert.equal(share.channel, 'system_share_sheet'); assert.equal(share.url, undefined);
    assert.equal((await f.call('POST', `${url}/sos-preview`, f.a, { confirmed: false })).statusCode, 422);
    const preview = (await f.call('POST', `${url}/sos-preview`, f.a, { confirmed: true })).json().data;
    assert.equal(preview.status, 'no_location'); assert.equal(preview.mode, 'demo'); assert.equal(preview.location, null);
    const location = { latitude: 10.75, longitude: 106.72, capturedAt: '2026-11-01T08:00:00Z' };
    assert.equal((await f.call('POST', `${url}/sos-preview`, f.a, { confirmed: true, location })).statusCode, 422);
    const payload = { confirmed: true, locationConsent: true, location };
    const own = (await f.call('POST', `${url}/sos-preview`, f.a, payload)).json().data;
    assert.equal(own.status, 'prepared'); assert.equal(own.delivery, 'prepared'); assert.equal(own.location.latitude, 10.75);
    assert.deepEqual((await f.call('POST', `${url}/sos-preview`, f.a, payload)).json().data, own);
    assert.equal((await f.call('POST', `${url}/sos-preview`, f.a, { ...payload, location: { ...location, capturedAt: '2026-10-01T08:00:00Z' } })).statusCode, 422);
    assert.equal((await f.call('POST', `${url}/sos-preview`, f.a, { ...payload, userId: demoIds.B })).statusCode, 400);
    const other = (await f.call('POST', `${url}/sos-preview`, f.b, { confirmed: true })).json().data;
    assert.equal(other.location, null);
    assert.equal(f.d.one('SELECT count(*) n FROM messages').n, 0);
    assert.equal(f.d.one('SELECT count(*) n FROM dates_operations').n, 1);
    assert.equal(JSON.stringify((await f.call('GET', url, f.b)).json()).includes('10.75'), false);
  } finally { await f.close(); }
});

test('dates: ICS UID/version escaping and Unicode folding; SQLite plan and review persistence', async () => {
  const f = await fixture();
  try {
    const p = await f.create({ title: 'Cà phê, trà; \\ cùng nhau '.repeat(4) });
    const url = `/v1/date-plans/${p.id}/calendar.ics`;
    const first = await f.call('GET', url, f.a), replay = await f.call('GET', url, f.b);
    assert.equal(first.statusCode, 200); assert.match(first.headers['content-type']!, /text\/calendar/);
    assert.equal(first.body, replay.body); assert.match(first.body, new RegExp(`UID:${p.id}@dates.local`));
    assert.match(first.body, /SEQUENCE:0/); assert.match(first.body, /DTSTART:20261101T090000Z/);
    assert.ok(first.body.includes('\\,')); assert.ok(first.body.includes('\\;')); assert.ok(first.body.includes('\\\\'));
    for (const line of first.body.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
    assert.equal(first.body.replaceAll('\r\n', '').includes('\n'), false);
    await f.call('PATCH', `/v1/date-plans/${p.id}`, f.b, { requestId: 'accept', version: 1, status: 'accepted' });
    assert.match((await f.call('GET', url, f.a)).body, /SEQUENCE:1/);
    f.clock(Date.parse('2026-11-01T10:01:00Z'));
    const review = { planId: p.id, rating: 4, text: 'Ổn', crowded: true, staffSupport: false };
    assert.equal((await f.call('POST', '/v1/venues/demo-cafe-lotus/reviews', f.a, review)).statusCode, 200);
    await f.restart();
    assert.equal((await f.call('GET', `/v1/date-plans/${p.id}`, f.a)).json().data.status, 'accepted');
    assert.match((await f.call('GET', url, f.a)).body, new RegExp(`UID:${p.id}@dates.local`));
    assert.equal((await f.call('GET', '/v1/venues/demo-cafe-lotus/reviews', f.a)).json().data.length, 1);
    f.d.run('UPDATE dates_plans SET title=? WHERE id=?', 'Bad\r\nATTENDEE:evil', p.id);
    assert.equal((await f.call('GET', url, f.a)).statusCode, 400);
  } finally { await f.close(); }
});
