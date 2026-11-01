import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { Domain, uid } from '../src/domain.js';
import { demoIds } from '../src/db/database.js';
import { registerBilling, readEntitlements, recordLikeUsage, assertLikeAllowed, isIncognitoHidden, boostWeight } from '../src/modules/billing/index.js';

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'gap-billing-')); let now = Date.parse('2026-11-01T08:00:00Z');
  const app = await createApp({ dataDir: dir, dbPath: ':memory:', now: () => now });
  const d = new Domain(app.db, app.config); d.io = app.io;
  if (!app.hasRoute({ method: 'GET', url: '/v1/plans' })) registerBilling(app, d);
  const call = (method: any, url: string, token: string, payload?: any) => app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, ...(payload === undefined ? {} : { payload }) });
  const login = async (account: string) => (await app.inject({ method: 'POST', url: '/v1/demo/sessions', payload: { account } })).json().data.token;
  return { app, d, call, a: await login('A'), b: await login('B'), advance: (ms: number) => { now += ms; }, close: async () => { await app.close(); await rm(dir, { recursive: true, force: true }); } };
}
test('billing: exact purchase retries, changed payload, failure and actor scope', async () => {
  const f = await fixture(); try {
    const buy = { productId: 'gold', outcome: 'success', idempotencyKey: uid() };
    const first = await f.call('POST', '/v1/demo/purchases', f.a, buy); assert.equal(first.statusCode, 200);
    assert.deepEqual((await f.call('POST', '/v1/demo/purchases', f.a, buy)).json(), first.json());
    assert.equal((await f.call('POST', '/v1/demo/purchases', f.a, { ...buy, outcome: 'failure' })).statusCode, 409);
    assert.equal(readEntitlements(f.d, demoIds.B).plan, 'free');
    await f.call('POST', '/v1/demo/purchases', f.b, { ...buy, outcome: 'failure' });
    assert.equal(readEntitlements(f.d, demoIds.B).plan, 'free');
    assert.equal(readEntitlements(f.d, demoIds.A).plan, 'gold');
    f.advance(30 * 86_400_000); assert.equal(readEntitlements(f.d, demoIds.A).plan, 'free');
    f.app.config.demoMode = false;
    assert.equal((await f.call('POST', '/v1/demo/purchases', f.a, { ...buy, idempotencyKey: uid() })).statusCode, 401); // session has expired too
  } finally { await f.close(); }
});
test('billing: like ledger survives rewind; quota UTC, match preservation and incognito', async () => {
  const f = await fixture(); try {
    for (let i = 0; i < 20; i++) recordLikeUsage(f.d, demoIds.A, `prior-${i}`);
    recordLikeUsage(f.d, demoIds.A, 'prior-0');
    assert.equal(readEntitlements(f.d, demoIds.A).likesRemaining, 0);
    assert.throws(() => assertLikeAllowed(f.d, demoIds.A), /Like/);
    await f.call('POST', '/v1/demo/purchases', f.a, { productId: 'plus', outcome: 'success', idempotencyKey: uid() });
    await f.call('PATCH', '/v1/me/incognito', f.a, { enabled: true });
    assert.equal(isIncognitoHidden(f.d, demoIds.B, demoIds.A), true);
    const swipe = uid(); f.d.run("INSERT INTO swipes VALUES(?,?,?,'like',?)", swipe, demoIds.A, demoIds.B, f.d.date());
    assert.equal(isIncognitoHidden(f.d, demoIds.B, demoIds.A), false);
    const rewind = { idempotencyKey: uid() };
    assert.equal((await f.call('POST', '/v1/swipes/rewind', f.a, rewind)).statusCode, 200);
    assert.equal((await f.call('POST', '/v1/swipes/rewind', f.a, rewind)).statusCode, 200);
    assert.equal(f.d.one('SELECT count(*) n FROM like_usage WHERE user_id=?', demoIds.A).n, 20);
    f.d.run("INSERT INTO swipes VALUES(?,?,?,'like',?)", uid(), demoIds.A, demoIds.B, f.d.date());
    f.d.run("INSERT INTO matches(id,user_low,user_high,status,created_at) VALUES(?,?,?,'ended',?)", uid(), demoIds.A, demoIds.B, f.d.date());
    assert.equal((await f.call('POST', '/v1/swipes/rewind', f.a, { idempotencyKey: uid() })).statusCode, 409);
    assert.equal(f.d.one('SELECT count(*) n FROM matches').n, 1);
    f.app.config.demoMode = false;
    assert.equal(readEntitlements(f.d, demoIds.A).plan, 'free');
    assert.equal((await f.call('POST', '/v1/demo/purchases', f.a, { productId: 'gold', outcome: 'success', idempotencyKey: uid() })).statusCode, 403);
    f.advance(86_400_000); assert.equal(readEntitlements(f.d, demoIds.A).likesRemaining, 20);
  } finally { await f.close(); }
});
test('billing: Boost credit cannot be stolen or stacked and expires by server clock', async () => {
  const f = await fixture(); try {
    await f.call('POST', '/v1/demo/purchases', f.a, { productId: 'boost', outcome: 'success', idempotencyKey: uid() });
    const activation = { productId: 'boost', idempotencyKey: uid() };
    assert.equal((await f.call('POST', '/v1/boosts', f.b, activation)).statusCode, 403);
    const first = await f.call('POST', '/v1/boosts', f.a, activation); assert.equal(first.statusCode, 200);
    assert.deepEqual((await f.call('POST', '/v1/boosts', f.a, activation)).json(), first.json());
    assert.equal((await f.call('POST', '/v1/boosts', f.a, { ...activation, idempotencyKey: uid() })).statusCode, 409);
    assert.equal(boostWeight(f.d, demoIds.A), 5); f.advance(30 * 60_000); assert.equal(boostWeight(f.d, demoIds.A), 1);
  } finally { await f.close(); }
});
