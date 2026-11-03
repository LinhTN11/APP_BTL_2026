import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { environment, firestoreConfiguration, root } from "./common.mjs";

// T01.02 / T05.02: explicitly opt-in cloud evidence, never a reset/cleanup tool.
const usage =
  "Usage: node --import tsx scripts/firestore-cloud-smoke.mjs --project EXPECTED_PROJECT_ID";
let app;
let namespace;
let stage = "preflight";
class PreflightError extends Error {}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--project")
    throw new PreflightError(usage);
  const expectedProject = args[1];
  const env = environment();
  if (
    !/^[a-z][a-z0-9-]{4,62}$/.test(expectedProject) ||
    env.FIREBASE_PROJECT_ID !== expectedProject
  )
    throw new PreflightError(
      "--project must exactly equal the configured FIREBASE_PROJECT_ID."
    );
  if (env.DATABASE_MODE !== "firestore" || env.FIRESTORE_EMULATOR_HOST)
    throw new PreflightError(
      "Cloud smoke requires DATABASE_MODE=firestore and no FIRESTORE_EMULATOR_HOST."
    );
  if (env.DEMO_MODE !== "true")
    throw new PreflightError("Cloud smoke requires DEMO_MODE=true.");
  try {
    firestoreConfiguration(env);
  } catch {
    throw new PreflightError(
      "Firestore configuration is invalid; check backend credential configuration locally."
    );
  }

  // No SDK import, credential loading, network connection or write precedes preflight.
  namespace = `cloud-qa-${randomUUID()}`;
  const dataDir = join(root, "data", "cloud-qa", namespace);
  Object.assign(process.env, env, { FIRESTORE_NAMESPACE: namespace });
  console.log(
    `Cloud smoke target: project=${expectedProject}, namespace=${namespace}. Synthetic fixtures only; this namespace and its local media will be retained.`
  );
  const { createFirestoreApp } = await import(
    "../apps/api/src/firestore/app.ts"
  );
  const { seedFirestoreDemo } = await import(
    "../apps/api/src/firestore/seed.ts"
  );
  let base;
  async function open() {
    app = await createFirestoreApp({
      projectId: expectedProject,
      namespace,
      dataDir,
      demoMode: true,
      seedDemo: false,
      logger: false,
    });
    assert.equal(app.firestore.database.mode, "cloud", "Cloud mode required");
    assert.equal(app.firestore.database.projectId, expectedProject);
    assert.equal(app.firestore.database.namespace, namespace);
    await app.listen({ port: 0, host: "127.0.0.1" });
    base = `http://127.0.0.1:${app.server.address().port}`;
  }
  async function request(
    path,
    { method = "GET", body, token, statuses = [200] } = {}
  ) {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30_000),
    });
    // Never include response bodies/headers: a session response contains a token.
    assert.ok(
      statuses.includes(response.status),
      `${method} ${path}: unexpected HTTP ${response.status}`
    );
    const payload = await response.json();
    return payload.data;
  }
  async function concurrent(jobs) {
    // Await every request even if one fails, before closing the SDK on error.
    const results = await Promise.allSettled(jobs);
    for (const result of results)
      if (result.status === "rejected") throw result.reason;
    return results.map((result) => result.value);
  }
  async function like(actor, target) {
    return request("/v1/swipes", {
      method: "POST",
      token: actor.token,
      body: { targetUserId: target.user.id, action: "like" },
    });
  }
  async function denyChat(matchId, actor) {
    await request(`/v1/matches/${matchId}/messages`, {
      token: actor.token,
      statuses: [403, 404],
    });
    await request(`/v1/matches/${matchId}/messages`, {
      method: "POST",
      token: actor.token,
      body: {
        clientMessageId: randomUUID(),
        kind: "text",
        text: "Synthetic cloud QA: access must be denied",
      },
      statuses: [403, 404],
    });
  }

  stage = "connect and reserve fresh namespace";
  await open();
  const ctx = app.firestore;
  assert.equal((await ctx.root.get()).exists, false, "Namespace must be fresh");
  assert.equal(
    (await ctx.root.listCollections()).length,
    0,
    "Namespace must have no existing subcollections"
  );
  // Atomic create-only claim; failure stops before seed or API mutations.
  await ctx.root.create({
    purpose: "isolated-cloud-qa",
    createdAt: new Date().toISOString(),
    retainedForConsoleEvidence: true,
  });

  stage = "create-only seed and cloud health";
  await seedFirestoreDemo(ctx);
  const health = await request("/health");
  assert.equal(health.status, "ok");
  assert.equal(health.database.mode, "cloud");
  assert.equal(health.database.projectId, expectedProject);
  assert.equal(health.database.namespace, namespace);
  const sessions = [];
  for (const account of ["A", "B", "C", "D"])
    sessions.push(
      await request("/v1/demo/sessions", {
        method: "POST",
        body: { account },
      })
    );
  const [a, b, c, d] = sessions;

  stage = "profile write/read and non-destructive reseed";
  const bio = `Synthetic cloud QA profile ${namespace}`;
  await request("/v1/me/profile", {
    method: "PATCH",
    token: a.token,
    body: { bio },
  });
  await seedFirestoreDemo(ctx);
  assert.equal(
    (await request("/v1/me/profile", { token: a.token })).bio,
    bio,
    "Repeated create-only seed must preserve profile changes"
  );
  const discover = await request("/v1/discovery", { token: a.token });
  assert.ok(discover.some((profile) => profile.userId === b.user.id));

  stage = "concurrent mutual likes and retry yield one match";
  await concurrent([like(a, b), like(b, a)]);
  const retriedLikes = await concurrent([like(a, b), like(b, a)]);
  const matchId = retriedLikes[0].match?.id;
  assert.ok(matchId, "Mutual likes must create a match");
  assert.equal(retriedLikes[1].match?.id, matchId);
  const matches = await ctx.collection("matches").limit(2).get();
  assert.equal(matches.size, 1, "Exactly one match document must exist");
  assert.equal(matches.docs[0].id, matchId);
  for (const actor of [a, b]) {
    const listed = await request("/v1/matches", { token: actor.token });
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, matchId);
  }

  stage = "message retry, persisted history and third-user denial";
  const messageBody = {
    clientMessageId: randomUUID(),
    kind: "text",
    text: `Synthetic cloud QA message ${namespace}`,
  };
  const send = () =>
    request(`/v1/matches/${matchId}/messages`, {
      method: "POST",
      token: a.token,
      body: messageBody,
    });
  const sent = await concurrent([send(), send()]);
  assert.equal(sent[0].id, sent[1].id, "Message retry must reuse saved ID");
  const history = await request(`/v1/matches/${matchId}/messages`, {
    token: b.token,
  });
  assert.equal(history.length, 1, "Retry must not duplicate history");
  assert.equal(history[0].id, sent[0].id);
  assert.equal(history[0].text, messageBody.text);
  const messageDocs = await ctx.collection("messages").limit(2).get();
  assert.equal(messageDocs.size, 1, "Retry must not duplicate documents");
  await denyChat(matchId, c);

  stage = "close/reopen API and SDK, then verify cloud persistence";
  await app.close();
  app = undefined;
  await open();
  assert.equal(
    (await request("/v1/me/profile", { token: a.token })).bio,
    bio,
    "Profile and session must survive app/context recreation"
  );
  const reopenedMatches = await request("/v1/matches", { token: b.token });
  assert.equal(reopenedMatches.length, 1);
  assert.equal(reopenedMatches[0].id, matchId);
  const reopenedHistory = await request(`/v1/matches/${matchId}/messages`, {
    token: b.token,
  });
  assert.equal(reopenedHistory.length, 1);
  assert.equal(reopenedHistory[0].id, sent[0].id);
  assert.equal(reopenedHistory[0].text, messageBody.text);
  await denyChat(matchId, c);

  stage = "block revokes both members' read/send access";
  await request("/v1/blocks", {
    method: "POST",
    token: a.token,
    body: { targetUserId: b.user.id },
  });
  await denyChat(matchId, a);
  await denyChat(matchId, b);

  stage = "separate A/D match and unmatch revocation";
  await concurrent([like(a, d), like(d, a)]);
  const ad = await like(a, d);
  assert.ok(ad.match?.id, "Separate A/D match must exist");
  // This DELETE is the existing API lifecycle transition, not a document deletion.
  await request(`/v1/matches/${ad.match.id}`, {
    method: "DELETE",
    token: d.token,
  });
  await denyChat(ad.match.id, a);
  await denyChat(ad.match.id, d);
  const finalMatches = await app.firestore.collection("matches").limit(3).get();
  assert.equal(finalMatches.size, 2, "Ended matches must remain as evidence");
  assert.ok(finalMatches.docs.every((doc) => doc.data().status === "ended"));
  await app.firestore.root.update({
    smokeStatus: "passed",
    verifiedAt: new Date().toISOString(),
    matchIds: [matchId, ad.match.id],
    messageId: sent[0].id,
  });
  stage = "close verified API and SDK";
  await app.close();
  app = undefined;
  console.log(
    `Cloud HTTP smoke PASS: project=${expectedProject}, namespace=${namespace}; create-only seed, profile, discovery, concurrent likes, retry, persisted chat, C denied, API/SDK reopen, block and unmatch revocation. No documents deleted.`
  );
  console.log(
    `Console evidence: projects/${namespace}; local fixture media: ${dataDir}. Demo sessions are synthetic; no tokens are printed. API/SDK recreation is not a separate OS-process/device test.`
  );
}

try {
  await main();
} catch (error) {
  // SDK error messages/stacks can contain local credential paths or request details.
  console.error(
    error instanceof PreflightError
      ? error.message
      : `Cloud smoke FAIL at ${stage}. Check local project permissions/index readiness and the retained namespace; response bodies, tokens and SDK details are suppressed.`
  );
  if (namespace) console.error(`Retained namespace: projects/${namespace}`);
  process.exitCode = 1;
} finally {
  if (app) {
    try {
      await app.close();
    } catch {
      console.error("Cloud smoke could not close its API/SDK cleanly.");
      process.exitCode = 1;
    }
  }
}
