import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, GeoPoint } from 'firebase-admin/firestore';
import { planCleanup, validateManifest, applyManifest, inventory, encode, decode } from '../firestore-cleanup.mjs';

const id = '00000000-0000-4000-8000-000000000001';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const row = (ns, collection, key, data) => ({ path: `projects/${ns}/${collection}/${key}`, data, updateTime: [1, 0] });
function seeded(ns) {
  return [row(ns, 'users', id, { id, demoAccount: 'A' }), row(ns, 'demoAccounts', 'A', { userId: id }),
    row(ns, 'seedMarkers', 'core-A', {}), row(ns, 'profiles', id, { userId: id }), row(ns, 'sessions', 'hash', { userId: id })];
}
function manifest(documents, projectId = 'demo-app-cuoi-ky') {
  const plan = planCleanup(documents);
  return { version: 1, projectId, documents, plan, inventoryHash: hash(documents), planHash: hash(plan) };
}
test('exact seed provenance selects owned data and preserves Firebase user', () => {
  const docs = [...seeded('main'), row('main', 'users', 'real', { firebaseUid: 'uid' }), row('main', 'sessions', 'real-session', { userId: 'real' })];
  assert.equal(planCleanup(docs).targets.length, 5);
  assert.ok(planCleanup(docs).targets.every(d => !d.path.endsWith('/real') && !d.path.endsWith('/real-session')));
  assert.equal(planCleanup(docs.filter(d => !d.path.includes('/seedMarkers/'))).targets.length, 0);
});
test('missing firebaseUid, demo-looking names, and QA prefix alone never select data', () => {
  const ns = `cloud-qa-${randomUUID()}`;
  assert.deepEqual(planCleanup([row(ns, 'users', 'unknown', { displayName: 'test' })]).targets, []);
  assert.equal(planCleanup([row('main', 'users', id, { id, demoAccount: 'A' })]).targets.length, 0);
});
test('mixed real-user relationships preserve seed user and descendants', () => {
  const docs = [...seeded('main'), row('main', 'matches', 'mixed', { memberIds: [id, 'real'] }),
    { path: `projects/main/profiles/${id}/private/child`, data: { userId: id }, updateTime: [1, 0] }];
  const plan = planCleanup(docs);
  assert.equal(plan.targets.length, 0);
  assert.ok(plan.retainedMixed.length);
});
test('namespace scope and nested documents obey selected parent provenance', () => {
  const docs = [...seeded('main'), row('other', 'profiles', id, { userId: id }),
    { path: `projects/main/profiles/${id}/private/child`, data: {}, updateTime: [1, 0] }];
  const plan = planCleanup(docs);
  assert.equal(plan.targets.length, 6);
  assert.ok(plan.targets.every(d => d.path.startsWith('projects/main/')));
});
test('nested real-user data protects its synthetic parent from inheritance deletion', () => {
  const docs = [...seeded('main'), { path: `projects/main/profiles/${id}/private/child`, data: { userId: 'real' }, updateTime: [1, 0] }];
  assert.equal(planCleanup(docs).targets.length, 0);
  for (const collection of ['media', 'sessions', 'reports']) {
    const generic = [...seeded('main'), row('main', collection, 'owned', { userId: id }),
      { path: `projects/main/${collection}/owned/private/child`, data: { userId: 'real' }, updateTime: [1, 0] }];
    assert.equal(planCleanup(generic).targets.length, 0, `${collection} descendants must protect parent`);
  }
  assert.equal(planCleanup([...seeded('main'), { path: 'projects/main/seedMarkers/core-A/private/child', data: { userId: 'real' }, updateTime: [1, 0] }]).targets.length, 0);
});
test('isolated QA needs root marker and only proven synthetic users', () => {
  const ns = `cloud-qa-${randomUUID()}`, root = { path: `projects/${ns}`, data: { purpose: 'isolated-cloud-qa', retainedForConsoleEvidence: true }, updateTime: [1, 0] };
  assert.equal(planCleanup([...seeded(ns), root]).targets.length, 6);
  const withReal = planCleanup([...seeded(ns), root, row(ns, 'users', 'real', { firebaseUid: 'uid' })]);
  assert.ok(!withReal.targets.some(d => d.path === root.path));
  const unknown = row(ns, 'newCollection', 'unknown', { content: 'not proven test' });
  const unknownPlan = planCleanup([...seeded(ns), root, unknown]);
  assert.ok(!unknownPlan.targets.some(d => d.path === root.path || d.path === unknown.path));
});
test('manifest rejects tampering, target mismatch and oversized atomic apply', () => {
  const m = manifest(seeded('main'));
  assert.doesNotThrow(() => validateManifest(m, 'demo-app-cuoi-ky'));
  assert.throws(() => validateManifest(m, 'other-project'), /mismatch/);
  m.plan.targets.pop();
  assert.throws(() => validateManifest(m, 'demo-app-cuoi-ky'), /mismatch/);
});
test('snapshot codec preserves stored Firestore values for recovery', () => {
  const data = { timestamp: new Timestamp(123, 456), point: new GeoPoint(10, 20), bytes: Buffer.from('image'), nested: [null, false, 'value'] };
  const restored = decode(JSON.parse(JSON.stringify(encode(data))));
  assert.ok(restored.timestamp.isEqual(data.timestamp));
  assert.ok(restored.point.isEqual(data.point));
  assert.deepEqual(restored.bytes, data.bytes);
  assert.deepEqual(restored.nested, data.nested);
});
test('emulator atomic cleanup, recovery, preconditions and idempotent rerun', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST, /^(127\.0\.0\.1|localhost):\d+$/);
  const admin = initializeApp({ projectId: 'demo-app-cuoi-ky' }, `cleanup-test-${randomUUID()}`), db = getFirestore(admin);
  const ns = `cleanup-${randomUUID()}`, other = `retain-${randomUUID()}`;
  // Dedicated isolated emulator database ID makes inventory independent of concurrently running API tests.
  const { getFirestore: getDatabase } = await import('firebase-admin/firestore');
  const isolated = getDatabase(admin, `cleanup-${randomUUID()}`);
  try {
    const docs = [...seeded(ns), row(ns, 'users', 'real', { firebaseUid: 'real-uid' }), row(other, 'users', 'other', { firebaseUid: 'other-uid' }),
      { path: `projects/${ns}/profiles/${id}/private/child`, data: { timestamp: encode(new Timestamp(1, 2)) }, updateTime: [1, 0] }];
    for (const doc of docs) await isolated.doc(doc.path).set(decode(doc.data, isolated));
    const before = await inventory(isolated), m = manifest(before);
    await isolated.doc(`projects/${ns}/profiles/${id}`).update({ bio: 'changed after snapshot' });
    await assert.rejects(() => applyManifest(isolated, m, 'demo-app-cuoi-ky'), /changed/);
    const latest = manifest(await inventory(isolated));
    assert.equal((await applyManifest(isolated, latest, 'demo-app-cuoi-ky')).deleted, 6);
    assert.equal((await isolated.doc(`projects/${ns}/users/real`).get()).exists, true);
    assert.equal((await isolated.doc(`projects/${other}/users/other`).get()).exists, true);
    assert.equal((await applyManifest(isolated, latest, 'demo-app-cuoi-ky')).deleted, 0);
    // Restore from the exact JSON backup, then compare recovered values.
    for (const doc of JSON.parse(JSON.stringify(latest.plan.targets))) await isolated.doc(doc.path).create(decode(doc.data, isolated));
    const restored = await inventory(isolated);
    assert.deepEqual(restored.map(d => ({ path: d.path, data: d.data })), latest.documents.map(d => ({ path: d.path, data: d.data })));
  } finally {
    await isolated.recursiveDelete(isolated.collection('projects').doc(ns));
    await isolated.recursiveDelete(isolated.collection('projects').doc(other));
    await isolated.terminate(); await db.terminate(); await deleteApp(admin);
  }
});
