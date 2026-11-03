// Explicit owner-requested synthetic-data cleanup. Default is read-only inventory.
import { initializeApp, applicationDefault, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, GeoPoint } from 'firebase-admin/firestore';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, realpath, copyFile, unlink } from 'node:fs/promises';
import { resolve, relative, isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { environment, root, isPortAvailable } from './common.mjs';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const stamp = time => time ? [time.seconds, time.nanoseconds] : null;
export function encode(value) {
  if (value instanceof Timestamp) return { $firestore: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds };
  if (value instanceof GeoPoint) return { $firestore: 'geopoint', latitude: value.latitude, longitude: value.longitude };
  if (Buffer.isBuffer(value)) return { $firestore: 'bytes', base64: value.toString('base64') };
  if (value instanceof Date) return { $firestore: 'date', iso: value.toISOString() };
  if (value?.constructor?.name === 'DocumentReference') return { $firestore: 'reference', path: value.path };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)]));
  return value;
}
export function decode(value, db) {
  if (value?.$firestore === 'timestamp') return new Timestamp(value.seconds, value.nanoseconds);
  if (value?.$firestore === 'geopoint') return new GeoPoint(value.latitude, value.longitude);
  if (value?.$firestore === 'bytes') return Buffer.from(value.base64, 'base64');
  if (value?.$firestore === 'date') return new Date(value.iso);
  if (value?.$firestore === 'reference') return db.doc(value.path);
  if (Array.isArray(value)) return value.map(v => decode(v, db));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decode(v, db)]));
  return value;
}
const seedId = i => `00000000-0000-4000-8000-00000000000${i + 1}`;
const actorKeys = new Set(['userId', 'actorId', 'senderId', 'reporterId', 'targetUserId', 'memberIds', 'ownerId', 'createdBy']);
function actors(value) {
  const result = [];
  for (const [key, item] of Object.entries(value ?? {})) {
    if (actorKeys.has(key)) result.push(...(Array.isArray(item) ? item : [item]).filter(x => typeof x === 'string'));
  }
  return result;
}
export function planCleanup(documents) {
  const byPath = new Map(documents.map(d => [d.path, d]));
  const namespaces = [...new Set(documents.map(d => d.path.split('/')[1]))];
  const targets = new Map(), syntheticUsers = new Set(), retainedMixed = [], isolatedRoots = [];
  for (const ns of namespaces) {
    const base = `projects/${ns}`, subset = documents.filter(d => d.path === base || d.path.startsWith(`${base}/`));
    const relatedActors = doc => {
      const parts = doc.path.split('/'), refs = [];
      for (let depth = 4; depth <= parts.length; depth += 2) {
        const ancestor = byPath.get(parts.slice(0, depth).join('/'));
        if (!ancestor) continue;
        refs.push(...actors(ancestor.data));
        if (ancestor.data.matchId) refs.push(...(byPath.get(`${base}/matches/${ancestor.data.matchId}`)?.data.memberIds ?? []));
        if (depth === 4 && ['users', 'profiles', 'preferences', 'locations'].includes(parts[2])) refs.push(parts[3]);
        if (depth === 4 && parts[2] === 'seedMarkers' && /^core-[ABCD]$/.test(parts[3])) refs.push(seedId('ABCD'.indexOf(parts[3].at(-1))));
      }
      return refs;
    };
    const known = new Set();
    for (const [i, label] of ['A', 'B', 'C', 'D'].entries()) {
      const id = seedId(i), u = byPath.get(`${base}/users/${id}`)?.data;
      if (u?.id === id && u.demoAccount === label && !u.firebaseUid &&
          byPath.get(`${base}/demoAccounts/${label}`)?.data.userId === id &&
          byPath.has(`${base}/seedMarkers/core-${label}`)) known.add(id);
    }
    // Preserve the complete connected component when it touches a non-seed user.
    let changed = true;
    while (changed) {
      changed = false;
      for (const doc of subset) {
        const refs = relatedActors(doc);
        if (refs.some(id => known.has(id)) && refs.some(id => !known.has(id))) {
          retainedMixed.push(doc.path);
          for (const id of refs) if (known.delete(id)) changed = true;
        }
      }
    }
    const users = subset.filter(d => d.path.split('/').length === 4 && d.path.split('/')[2] === 'users');
    const marker = byPath.get(base)?.data;
    const isolated = /^cloud-qa-[a-f0-9-]{36}$/.test(ns) && marker?.purpose === 'isolated-cloud-qa' &&
      marker.retainedForConsoleEvidence === true && known.size > 0 && users.every(d => known.has(d.path.split('/')[3]));
    for (const id of known) syntheticUsers.add(`${base}/users/${id}`);
    if (isolated) {
      isolatedRoots.push(base);
    }
    const selectedMatches = new Set(subset.filter(d => d.path.split('/')[2] === 'matches' &&
      Array.isArray(d.data.memberIds) && d.data.memberIds.length === 2 && d.data.memberIds.every(id => known.has(id))).map(d => d.path.split('/')[3]));
    for (const doc of subset) {
      const [, , collection, id] = doc.path.split('/');
      const refs = actors(doc.data), allKnown = refs.length > 0 && refs.every(ref => known.has(ref));
      const mixed = refs.some(ref => known.has(ref)) && !allKnown;
      if (mixed) { retainedMixed.push(doc.path); continue; }
      let reason;
      if (['users', 'profiles', 'preferences', 'locations'].includes(collection) && known.has(id)) reason = 'owned by proven seed account';
      else if (collection === 'demoAccounts' && known.has(doc.data.userId)) reason = 'seed account mapping';
      else if (collection === 'seedMarkers' && /^core-[ABCD]$/.test(id) && known.has(seedId('ABCD'.indexOf(id.at(-1))))) reason = 'seed creation marker';
      else if (['media', 'sessions', 'verificationRequests', 'swipes', 'blocks', 'reports', 'unmatchFeedback'].includes(collection) && allKnown) reason = 'synthetic account relation';
      else if (collection === 'matches' && selectedMatches.has(id)) reason = 'both match members are proven seed accounts';
      else if (['messages', 'messageKeys', 'readCursors'].includes(collection) && selectedMatches.has(doc.data.matchId) && (!refs.length || allKnown)) reason = 'synthetic match relation';
      if (reason) targets.set(doc.path, { ...doc, reason });
    }
  }
  // Children inherit provenance only when their owning document is selected.
  for (const doc of documents) {
    if (doc.path.split('/').length > 4 && [...targets.keys()].some(p => doc.path.startsWith(`${p}/`)))
      targets.set(doc.path, { ...doc, reason: 'subcollection of selected synthetic document' });
  }
  for (const base of isolatedRoots) {
    if (documents.filter(d => d.path.startsWith(`${base}/`)).every(d => targets.has(d.path)))
      targets.set(base, { ...byPath.get(base), reason: 'isolated QA marker with every descendant individually proven synthetic' });
  }
  return { targets: [...targets.values()].sort((a, b) => a.path.localeCompare(b.path)), syntheticUsers: [...syntheticUsers], retainedMixed };
}
export async function inventory(db, maxDocuments = 5000) {
  const documents = [];
  async function visit(ref) {
    const snap = await ref.get();
    if (snap.exists) documents.push({ path: ref.path, data: encode(snap.data()), updateTime: stamp(snap.updateTime) });
    if (documents.length > maxDocuments) throw new Error('Inventory limit reached; no changes made.');
    for (const collection of await ref.listCollections())
      for (const child of await collection.listDocuments()) await visit(child);
  }
  for (const ref of await db.collection('projects').listDocuments()) await visit(ref);
  return documents.sort((a, b) => a.path.localeCompare(b.path));
}
export function validateManifest(manifest, projectId) {
  if (manifest.version !== 1 || manifest.projectId !== projectId || digest(manifest.documents) !== manifest.inventoryHash ||
      digest(manifest.plan) !== manifest.planHash || digest(planCleanup(manifest.documents)) !== manifest.planHash)
    throw new Error('Manifest project/hash/provenance mismatch.');
  if (manifest.plan.targets.length > 400) throw new Error('More than 400 targets: split reviewed atomic batches before apply.');
  for (const doc of manifest.plan.targets)
    if (!/^projects\/[a-z0-9-]{1,48}\/(?:[^/]+\/[^/]+)(?:\/[^/]+\/[^/]+)*$/.test(doc.path) &&
        !/^projects\/cloud-qa-[a-f0-9-]{36}$/.test(doc.path)) throw new Error('Invalid target path.');
}
export async function applyManifest(db, manifest, projectId) {
  validateManifest(manifest, projectId);
  const current = await inventory(db);
  const deleted = new Set(manifest.plan.targets.map(d => d.path));
  const retained = manifest.documents.filter(d => !deleted.has(d.path));
  if (digest(current) === digest(retained)) return { deleted: 0, remaining: current.length, preservedUsers: current.filter(d => /^projects\/[^/]+\/users\/[^/]+$/.test(d.path)).length };
  if (digest(current) !== manifest.inventoryHash) throw new Error('Inventory changed since snapshot; regenerate before applying.');
  // Read every existing collection query inside the deleting transaction, so new
  // relationships and changed retained records in those collections conflict.
  if (manifest.plan.targets.length) await db.runTransaction(async tx => {
    const collectionPaths = [...new Set(manifest.documents.filter(d => d.path.split('/').length > 2).map(d => d.path.split('/').slice(0, -1).join('/')))];
    const observed = new Map();
    for (const path of collectionPaths) {
      for (const doc of (await tx.get(db.collection(path))).docs)
        observed.set(doc.ref.path, { path: doc.ref.path, data: encode(doc.data()), updateTime: stamp(doc.updateTime) });
    }
    for (const doc of manifest.documents.filter(d => d.path.split('/').length === 2)) {
      const snap = await tx.get(db.doc(doc.path));
      if (snap.exists) observed.set(doc.path, { path: doc.path, data: encode(snap.data()), updateTime: stamp(snap.updateTime) });
    }
    if (digest([...observed.values()].sort((a,b) => a.path.localeCompare(b.path))) !== manifest.inventoryHash)
      throw new Error('Transactional inventory changed; cleanup stopped.');
    for (const doc of manifest.plan.targets) tx.delete(db.doc(doc.path), { lastUpdateTime: new Timestamp(...doc.updateTime) });
  });
  const after = await inventory(db);
  if (digest(after) !== digest(retained)) throw new Error('Post-cleanup inventory mismatch; inspect retained snapshot.');
  return { deleted: deleted.size, remaining: after.length, preservedUsers: after.filter(d => /^projects\/[^/]+\/users\/[^/]+$/.test(d.path)).length };
}
async function cleanFiles(manifest, env, output) {
  const remaining = manifest.documents.filter(d => !manifest.plan.targets.some(t => t.path === d.path));
  const result = [];
  for (const doc of manifest.plan.targets.filter(d => d.path.split('/')[2] === 'media')) {
    const key = doc.data.storageKey;
    if (typeof key !== 'string' || remaining.some(d => d.data.storageKey === key)) continue;
    const namespace = doc.path.split('/')[1];
    const directory = namespace === env.FIRESTORE_NAMESPACE ? join(env.DATA_DIR, 'media') :
      /^cloud-qa-[a-f0-9-]{36}$/.test(namespace) ? join(root, 'data', 'cloud-qa', namespace, 'media') : null;
    if (!directory) continue;
    let mediaDir;
    try { mediaDir = await realpath(directory); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    const candidate = resolve(mediaDir, key), rel = relative(mediaDir, candidate);
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Media path escapes intended directory.');
    let actual;
    try { actual = await realpath(candidate); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    const actualRel = relative(mediaDir, actual);
    if (actualRel.startsWith('..') || isAbsolute(actualRel)) throw new Error('Media symlink escapes intended directory.');
    const backup = join(output, `media-${digest(doc.path)}.bin`);
    await copyFile(actual, backup);
    await unlink(actual);
    result.push({ storageKey: key, backup });
  }
  return result;
}
async function main() {
  const args = process.argv.slice(2), command = args[0] ?? 'inventory';
  if (!['inventory', 'apply'].includes(command)) throw new Error('Usage: firestore-cleanup.mjs inventory|apply --project PROJECT [--manifest PATH]');
  const value = flag => args[args.indexOf(flag) + 1];
  const env = environment(), expected = args.includes('--project') && value('--project');
  if (expected !== env.FIREBASE_PROJECT_ID || env.DATABASE_MODE !== 'firestore' || env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_AUTH_EMULATOR_HOST)
    throw new Error('Explicit configured cloud project required; emulator hosts must be absent.');
  Object.assign(process.env, env);
  const admin = initializeApp({ credential: applicationDefault(), projectId: expected }, `cleanup-${randomUUID()}`), db = getFirestore(admin);
  try {
    const output = join(root, '.local', 'real-data-cleanup');
    await mkdir(output, { recursive: true });
    if (command === 'inventory') {
      const documents = await inventory(db), plan = planCleanup(documents);
      const manifest = { version: 1, projectId: expected, createdAt: new Date().toISOString(), documents, inventoryHash: digest(documents), plan, planHash: digest(plan) };
      const path = join(output, `manifest-${Date.now()}.json`);
      await writeFile(path, JSON.stringify(manifest, null, 2), { flag: 'wx' });
      const counts = {};
      for (const d of documents) { const ns = d.path.split('/')[1]; counts[ns] = (counts[ns] ?? 0) + 1; }
      console.log(JSON.stringify({ mode: 'read-only', projectId: expected, namespaces: counts, proposedDeletes: plan.targets.length, syntheticUsers: plan.syntheticUsers.length, retainedMixed: plan.retainedMixed.length, manifest: path }));
    } else {
      if (!args.includes('--manifest')) throw new Error('Exact manifest path required.');
      const manifest = JSON.parse(await readFile(value('--manifest'), 'utf8'));
      if (!(await isPortAvailable(Number(env.PORT)))) throw new Error('Stop the local API before applying cleanup.');
      const result = await applyManifest(db, manifest, expected);
      const files = await cleanFiles(manifest, env, output);
      const report = { projectId: expected, manifestHash: manifest.planHash, ...result, mediaDeleted: files.length, files, completedAt: new Date().toISOString() };
      await writeFile(join(output, `result-${Date.now()}.json`), JSON.stringify(report, null, 2));
      console.log(JSON.stringify({ ...result, mediaDeleted: files.length, projectId: expected }));
    }
  } finally { await db.terminate(); await deleteApp(admin); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch(() => { console.error('Cleanup stopped. No secrets printed; inspect local manifest/config and retry inventory.'); process.exitCode = 1; });
