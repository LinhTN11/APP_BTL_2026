import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DecodedIdToken } from "firebase-admin/auth";
import { createFirestoreApp } from "../src/firestore/app.js";
import { emptyProfile } from "../src/firestore/auth.js";
import { hash } from "../src/shared.js";
import { createFirestoreContext } from "../src/firestore/context.js";

const host = process.env.FIRESTORE_EMULATOR_HOST;
const opts = { skip: host ? false : "Requires explicit local Firestore emulator; never runs against cloud." };
const projectId = "demo-app-cuoi-ky";
const configKeys = ["FIREBASE_API_KEY", "FIREBASE_APP_ID", "FIREBASE_AUTH_DOMAIN", "GOOGLE_WEB_CLIENT_ID"] as const;
test("Firebase Auth emulator cannot downgrade cloud signature verification or accept remote/invalid emulator host", async () => {
  const before = { mode: process.env.DATABASE_MODE, auth: process.env.FIREBASE_AUTH_EMULATOR_HOST };
  try {
    process.env.DATABASE_MODE = "firestore";
    process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
    await assert.rejects(createFirestoreContext({ projectId }), /requires explicit Firestore emulator mode/);
    process.env.DATABASE_MODE = "firestore-emulator";
    for (const authHost of ["0.0.0.0:9099", "attacker.example:9099", "127.0.0.1:0", "127.0.0.1:99999"]) {
      process.env.FIREBASE_AUTH_EMULATOR_HOST = authHost;
      await assert.rejects(createFirestoreContext({ projectId, emulatorHost: "127.0.0.1:8089" }), /must be an explicit loopback/);
    }
  } finally {
    if (before.mode === undefined) delete process.env.DATABASE_MODE; else process.env.DATABASE_MODE = before.mode;
    if (before.auth === undefined) delete process.env.FIREBASE_AUTH_EMULATOR_HOST; else process.env.FIREBASE_AUTH_EMULATOR_HOST = before.auth;
  }
});
async function fixture() {
  const old = Object.fromEntries(configKeys.map(k => [k, process.env[k]]));
  process.env.FIREBASE_API_KEY = "test-public-config-key";
  process.env.FIREBASE_APP_ID = "1:123:web:test";
  process.env.FIREBASE_AUTH_DOMAIN = `${projectId}.firebaseapp.com`;
  process.env.GOOGLE_WEB_CLIENT_ID = "test.apps.googleusercontent.com";
  const dir = await mkdtemp(join(tmpdir(), "gap-firebase-auth-"));
  const app = await createFirestoreApp({ projectId, namespace: `test-${randomUUID()}`, emulatorHost: host, dataDir: dir, demoMode: false });
  const verifier = mock.method(app.firestore.firebaseAuth, "verifyIdToken", async (token: string, revoked?: boolean) => {
    assert.equal(revoked, true, "production exchange must check disabled/revoked identities");
    if (["invalid", "expired", "revoked", "disabled"].includes(token)) throw new Error(`private credential ${token}`);
    const now = Math.floor(Date.now() / 1000);
    return { uid: token, sub: token, aud: projectId, iss: `https://securetoken.google.com/${projectId}`, exp: now + 3600, iat: now, auth_time: now,
      name: "Thành viên Firebase", email: "same@example.com", firebase: { sign_in_provider: "password", identities: {} } } as DecodedIdToken;
  });
  const post = (url: string, payload?: object, token?: string) => app.inject({ method: "POST", url, payload, headers: token ? { authorization: `Bearer ${token}` } : {} });
  const exchange = (idToken: string) => post("/v1/auth/firebase", { idToken });
  return { app, post, exchange, verifier, close: async () => {
    verifier.mock.restore();
    await app.firestore.db.recursiveDelete(app.firestore.root);
    await app.close();
    await rm(dir, { recursive: true, force: true });
    for (const key of configKeys) { if (old[key] === undefined) delete process.env[key]; else process.env[key] = old[key]; }
  } };
}

test("Firebase exchange uses Admin SDK revocation verification, serializes UID registration and hashes sessions", opts, async () => {
  const f = await fixture();
  try {
    const methods = (await f.app.inject("/v1/auth/methods")).json().data;
    assert.equal(methods.firebase.config.projectId, projectId);
    assert.equal(methods.email.mode, "real");
    assert.equal(methods.google.mode, "real");
    const races = await Promise.all([f.exchange("firebase-user-one"), f.exchange("firebase-user-one")]);
    assert.ok(races.every(r => r.statusCode === 200));
    const session = races[0].json().data;
    assert.equal(races[1].json().data.user.id, session.user.id);
    assert.equal((await f.app.firestore.collection("users").get()).size, 1);
    assert.equal((await f.app.firestore.collection("firebaseIdentities").get()).size, 1);
    assert.equal((await f.app.firestore.collection("emailIdentities").get()).size, 0);
    const stored = (await f.app.firestore.ref("sessions", hash(session.token)).get()).data()!;
    assert.equal(stored.userId, session.user.id);
    assert.equal(JSON.stringify(stored).includes(session.token), false);
    assert.equal(JSON.stringify(stored).includes("firebase-user-one"), false);
    assert.equal((await f.post("/v1/auth/logout", undefined, session.token)).statusCode, 200);
    assert.equal((await f.app.inject({ url: "/v1/me", headers: { authorization: `Bearer ${session.token}` } })).statusCode, 401);
    await f.app.firestore.ref("users", session.user.id).update({ accountStatus: "disabled" });
    assert.equal((await f.exchange("firebase-user-one")).statusCode, 401);
  } finally { await f.close(); }
});

test("Firebase rejects invalid tokens and legacy paths, fails closed without config and never links email claims", opts, async () => {
  const f = await fixture();
  try {
    for (const token of ["invalid", "expired", "revoked", "disabled"]) {
      const response = await f.exchange(token);
      assert.equal(response.statusCode, 401);
      assert.equal(response.json().error.code, "FIREBASE_TOKEN_INVALID");
      assert.equal(response.json().error.message.includes(token), false);
    }
    assert.equal((await f.post("/v1/auth/firebase", { idToken: "valid", userId: randomUUID() })).statusCode, 400);
    assert.equal((await f.app.firestore.collection("users").get()).size, 0);
    for (const path of ["register", "login", "google", "google/challenge"])
      assert.equal((await f.post(`/v1/auth/${path}`, { email: "same@example.com", password: "never stored" })).statusCode, 410);
    const oldId = randomUUID();
    await f.app.firestore.ref("users", oldId).create({ id: oldId, email: "same@example.com", accountStatus: "active" });
    await f.app.firestore.ref("profiles", oldId).create(emptyProfile(oldId));
    const first = (await f.exchange("uid-one")).json().data;
    const second = (await f.exchange("uid-two")).json().data;
    assert.notEqual(first.user.id, oldId);
    assert.notEqual(first.user.id, second.user.id);
    delete process.env.FIREBASE_API_KEY;
    assert.equal((await f.app.inject("/v1/auth/methods")).json().data.firebase.mode, "unavailable");
    assert.equal((await f.exchange("uid-one")).statusCode, 503);
  } finally { await f.close(); }
});

test("Firebase refuses mismatched project, anonymous provider and expired decoded identity", opts, async () => {
  const f = await fixture();
  try {
    const now = Math.floor(Date.now() / 1000);
    const valid = { uid: "uid", aud: projectId, iss: `https://securetoken.google.com/${projectId}`, exp: now + 3600, auth_time: now, firebase: { sign_in_provider: "password" } };
    for (const change of [{ aud: "wrong-project" }, { iss: "https://attacker.example" }, { exp: now - 1 }, { auth_time: now + 300 }, { firebase: { sign_in_provider: "anonymous" } }]) {
      f.verifier.mock.mockImplementation(async () => ({ ...valid, ...change }) as DecodedIdToken);
      assert.equal((await f.exchange("rejected")).statusCode, 401);
    }
  } finally { await f.close(); }
});
