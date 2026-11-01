import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { createFirestoreApp } from "../apps/api/src/firestore/app.ts";

const temporary = await mkdtemp(join(tmpdir(), "gap-http-smoke-"));
let app;
try {
  if (
    process.env.DATABASE_MODE !== "firestore-emulator" ||
    process.env.FIREBASE_PROJECT_ID !== "demo-app-cuoi-ky" ||
    process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8089"
  )
    throw new Error(
      "Smoke writes are restricted to the explicit local Firestore emulator lane."
    );
  app = await createFirestoreApp({
    projectId: "demo-app-cuoi-ky",
    namespace: `smoke-${randomUUID()}`,
    emulatorHost: "127.0.0.1:8089",
    dataDir: temporary,
    demoMode: true,
    seedDemo: true,
    logger: false,
  });
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  const base = `http://127.0.0.1:${address.port}`;
  async function request(
    path,
    { method = "GET", body, token, expected = 200 } = {}
  ) {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const payload = await response.json();
    assert.equal(
      response.status,
      expected,
      `${method} ${path}: ${JSON.stringify(payload)}`
    );
    return payload.data;
  }
  const health = await request("/health");
  assert.equal(health.status, "ok");
  const a = await request("/v1/demo/sessions", {
    method: "POST",
    body: { account: "A" },
  });
  const b = await request("/v1/demo/sessions", {
    method: "POST",
    body: { account: "B" },
  });
  const c = await request("/v1/demo/sessions", {
    method: "POST",
    body: { account: "C" },
  });
  const profile = await request("/v1/me/profile", { token: a.token });
  assert.equal(profile.userId, a.user.id);
  const discover = await request("/v1/discovery", { token: a.token });
  assert.ok(
    discover.some((p) => p.userId === b.user.id),
    "B must be discoverable by A"
  );
  await request("/v1/swipes", {
    method: "POST",
    token: a.token,
    body: { targetUserId: b.user.id, action: "like" },
  });
  const result = await request("/v1/swipes", {
    method: "POST",
    token: b.token,
    body: { targetUserId: a.user.id, action: "like" },
  });
  assert.ok(result.match?.id, "mutual likes create a match");
  const matchId = result.match.id;
  const sent = await request(`/v1/matches/${matchId}/messages`, {
    method: "POST",
    token: a.token,
    body: {
      clientMessageId: randomUUID(),
      kind: "text",
      text: "Xin chào từ HTTP smoke",
    },
  });
  const history = await request(`/v1/matches/${matchId}/messages`, {
    token: b.token,
  });
  assert.ok(history.some((m) => m.id === sent.id));
  const denied = await fetch(`${base}/v1/matches/${matchId}/messages`, {
    headers: { authorization: `Bearer ${c.token}` },
  });
  assert.ok([403, 404].includes(denied.status), "C must be denied");
  await request("/v1/blocks", {
    method: "POST",
    token: a.token,
    body: { targetUserId: b.user.id },
  });
  const blocked = await fetch(`${base}/v1/matches/${matchId}/messages`, {
    headers: { authorization: `Bearer ${b.token}` },
  });
  assert.ok(
    [403, 404].includes(blocked.status),
    "blocked match must be inaccessible"
  );
  console.log(
    "Firestore EMULATOR HTTP smoke PASS: health → A/B login → discovery → mutual match → persisted chat → C denied → block revokes access. Temporary namespace only; not cloud verification."
  );
} finally {
  if (app) {
    const ctx = app.firestore;
    assert.equal(ctx.database.mode, "emulator");
    assert.ok(ctx.database.namespace.startsWith("smoke-"));
    await ctx.db.recursiveDelete(ctx.root);
    await app.close();
  }
  const safe = resolve(temporary);
  assert.ok(
    safe.startsWith(resolve(tmpdir()) + sep) &&
      safe.split(sep).at(-1).startsWith("gap-http-smoke-")
  );
  await rm(safe, { recursive: true, force: true });
}
