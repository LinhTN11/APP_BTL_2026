import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { createFirestoreApp } from "../src/firestore/app.js";

const host = process.env.FIRESTORE_EMULATOR_HOST;
test("Firestore Swagger: docs are public while API operations still require a session", {
  skip: host ? false : "Explicit Firestore emulator required; no cloud fallback.",
}, async () => {
  const dir = await mkdtemp(join(tmpdir(), "gap-swagger-"));
  const app = await createFirestoreApp({
    projectId: "demo-app-cuoi-ky",
    emulatorHost: host,
    namespace: `test-${randomUUID()}`,
    dataDir: dir,
    demoMode: true,
    seedDemo: true,
  });
  try {
    for (const path of ["/docs", "/docs/", "/docs/json", "/docs/static/swagger-ui.css"]) {
      assert.equal((await app.inject(path)).statusCode, 200, path);
    }
    const spec = (await app.inject("/docs/json")).json();
    assert.deepEqual(spec.servers.map((server: { url: string }) => server.url), ["/"]);
    for (const [path, operations] of Object.entries<Record<string, unknown>>(spec.paths)) {
      for (const method of Object.keys(operations)) {
        assert.ok(app.hasRoute({
          method: method.toUpperCase() as "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
          url: path.replace(/\{(\w+)\}/g, ":$1"),
        }), `${method} ${path} must exist in the API`);
      }
    }
    assert.deepEqual(spec.paths["/v1/me/profile"].get.security ?? spec.security, [{ bearerAuth: [] }]);
    assert.equal((await app.inject("/v1/me/profile")).statusCode, 401);
    assert.equal((await app.inject("/v1/me/profile?next=/docs/")).statusCode, 401);
    const login = await app.inject({
      method: "POST",
      url: "/v1/demo/sessions",
      payload: { account: "A" },
    });
    assert.equal(login.statusCode, 200);
    const authorized = await app.inject({
      method: "GET",
      url: "/v1/me/profile",
      headers: { authorization: `Bearer ${login.json().data.token}` },
    });
    assert.equal(authorized.statusCode, 200);
  } finally {
    await app.firestore.db.recursiveDelete(app.firestore.root);
    await app.close();
    assert.equal(dirname(resolve(dir)), resolve(tmpdir()));
    assert.ok(basename(dir).startsWith("gap-swagger-"));
    await rm(dir, { recursive: true, force: true });
  }
});
