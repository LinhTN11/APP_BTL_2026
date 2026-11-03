// Explicit emulator-only end-to-end SDK -> Admin SDK -> Firestore verification.
// Start Auth emulator on 9099 and Firestore emulator on 8089 first. No cloud writes.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createFirestoreApp } from "../apps/api/src/firestore/app.ts";

if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8089" || process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099")
  throw new Error("Explicit FIRESTORE_EMULATOR_HOST=127.0.0.1:8089 and FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 are required; no cloud execution.");
process.env.DATABASE_MODE = "firestore-emulator";
const projectId = "demo-app-cuoi-ky";
const mobileRequire = createRequire(new URL("../apps/mobile/package.json", import.meta.url));
const { initializeApp, deleteApp } = await import(pathToFileURL(mobileRequire.resolve("firebase/app")).href);
const { initializeAuth, inMemoryPersistence, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, deleteUser, GoogleAuthProvider, signInWithCredential } = await import(pathToFileURL(mobileRequire.resolve("firebase/auth")).href);
process.env.FIREBASE_API_KEY = "emulator-only-key";
process.env.FIREBASE_APP_ID = "1:123:web:emulator";
process.env.FIREBASE_AUTH_DOMAIN = `${projectId}.firebaseapp.com`;
const dir = await mkdtemp(join(tmpdir(), "gap-real-firebase-sdk-"));
const clientApp = initializeApp({ apiKey: "emulator-only-key", appId: process.env.FIREBASE_APP_ID, authDomain: process.env.FIREBASE_AUTH_DOMAIN, projectId }, `test-${randomUUID()}`);
const auth = initializeAuth(clientApp, { persistence: inMemoryPersistence });
connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
const app = await createFirestoreApp({ projectId, namespace: `test-${randomUUID()}`, emulatorHost: "127.0.0.1:8089", dataDir: dir, demoMode: false });
const exchange = idToken => app.inject({ method: "POST", url: "/v1/auth/firebase", payload: { idToken } });
const email = `sdk-${randomUUID()}@example.test`, password = "Emulator password 42!";
let firebaseUid;
try {
  const registered = await createUserWithEmailAndPassword(auth, email, password);
  firebaseUid = registered.user.uid;
  const first = await exchange(await registered.user.getIdToken());
  assert.equal(first.statusCode, 200, first.body);
  const firstSession = first.json().data;
  await signOut(auth);
  const returning = await signInWithEmailAndPassword(auth, email, password);
  const second = await exchange(await returning.user.getIdToken());
  assert.equal(second.statusCode, 200, second.body);
  assert.equal(second.json().data.user.id, firstSession.user.id);
  await assert.rejects(signInWithEmailAndPassword(auth, email, "Wrong password 42!"));
  assert.equal((await exchange("not-a-firebase-token")).statusCode, 401);
  await app.inject({ method: "POST", url: "/v1/auth/logout", headers: { authorization: `Bearer ${firstSession.token}` } });
  assert.equal((await app.inject({ url: "/v1/me", headers: { authorization: `Bearer ${firstSession.token}` } })).statusCode, 401);
  const idToken = await returning.user.getIdToken();
  await app.firestore.firebaseAuth.updateUser(firebaseUid, { disabled: true });
  assert.equal((await exchange(idToken)).statusCode, 401);
  await app.firestore.firebaseAuth.updateUser(firebaseUid, { disabled: false });
  // Auth's revocation timestamp has second precision; cross the issuance second.
  await new Promise(resolve => setTimeout(resolve, 1100));
  await app.firestore.firebaseAuth.revokeRefreshTokens(firebaseUid);
  assert.equal((await exchange(idToken)).statusCode, 401);
  // The emulator accepts unsigned Google fixtures. This checks SDK plumbing only,
  // not Google's cryptography, Console OAuth setup or a real Google account.
  const now = Math.floor(Date.now() / 1000);
  const googleJwt = `${Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: `google-${randomUUID()}`, email: `google-${randomUUID()}@example.test`, email_verified: true, name: "SDK Google Emulator", iss: "https://accounts.google.com", aud: "emulator-client", iat: now, exp: now + 3600 })).toString("base64url")}.`;
  await signOut(auth);
  const google = await signInWithCredential(auth, GoogleAuthProvider.credential(googleJwt));
  try {
    const googleSession = await exchange(await google.user.getIdToken());
    assert.equal(googleSession.statusCode, 200, googleSession.body);
    assert.notEqual(googleSession.json().data.user.id, firstSession.user.id);
  } finally { await deleteUser(google.user); }
  console.log("PASS: real Firebase JS SDK + Auth emulator + Admin verifyIdToken(checkRevoked=true) + Firestore emulator: email register/login/wrong password, stable UID, invalid token, disabled account, revoked token, logout, Google credential plumbing. No cloud account or Google real-account proof.");
} finally {
  if (firebaseUid) await app.firestore.firebaseAuth.deleteUser(firebaseUid).catch(() => {});
  await signOut(auth);
  await deleteApp(clientApp);
  await app.firestore.db.recursiveDelete(app.firestore.root);
  await app.close();
  await rm(dir, { recursive: true, force: true });
}
