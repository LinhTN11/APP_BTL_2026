import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const specPath = resolve(import.meta.dirname, "../../../docs/api/openapi.yaml");
const spec = JSON.parse(readFileSync(specPath, "utf8"));
const expectedOperations = [
  "GET /health",
  "GET /v1/capabilities",
  "GET /v1/demo/accounts",
  "POST /v1/demo/sessions",
  "POST /v1/auth/otp/request",
  "POST /v1/auth/otp/verify",
  "GET /v1/auth/methods",
  "POST /v1/auth/firebase",
  "GET /v1/auth/google/config",
  "POST /v1/auth/register",
  "POST /v1/auth/login",
  "POST /v1/auth/google",
  "POST /v1/auth/google/challenge",
  "POST /v1/auth/logout",
  "GET /v1/me",
  "GET /v1/me/profile",
  "PATCH /v1/me/profile",
  "GET /v1/profiles/{id}",
  "POST /v1/me/media",
  "PATCH /v1/me/media/order",
  "DELETE /v1/me/media/{id}",
  "GET /v1/media/{id}/content",
  "POST /v1/me/verification/selfie",
  "GET /v1/me/verification",
  "GET /v1/me/preferences",
  "PATCH /v1/me/preferences",
  "GET /v1/me/location",
  "PUT /v1/me/location",
  "DELETE /v1/me/location",
  "GET /v1/discovery",
  "POST /v1/swipes",
  "GET /v1/matches",
  "DELETE /v1/matches/{id}",
  "GET /v1/matches/{id}/messages",
  "POST /v1/matches/{id}/messages",
  "POST /v1/matches/{id}/read",
  "GET /v1/chat/catalog",
  "POST /v1/blocks",
  "GET /v1/blocks",
  "DELETE /v1/blocks/{userId}",
  "POST /v1/reports",
].sort();

test("OpenAPI contract matches current routes and has valid operation metadata", () => {
  assert.equal(spec.openapi, "3.1.0");
  assert.deepEqual(spec.servers.map((server: any) => server.url), ["/"]);
  assert.ok(spec.tags.length > 0);
  assert.deepEqual(spec.security, [{ bearerAuth: [] }]);

  const operations: string[] = [];
  const operationIds = new Set<string>();
  for (const [path, methods] of Object.entries<any>(spec.paths)) {
    for (const [method, operation] of Object.entries<any>(methods)) {
      operations.push(`${method.toUpperCase()} ${path}`);
      assert.ok(operation.operationId, `${method} ${path} needs operationId`);
      assert.ok(!operationIds.has(operation.operationId), `duplicate operationId: ${operation.operationId}`);
      operationIds.add(operation.operationId);
      assert.equal(operation.tags?.length, 1, `${method} ${path} needs one group`);
      assert.ok(spec.tags.some((tag: any) => tag.name === operation.tags[0]));
      for (const match of path.matchAll(/\{(\w+)\}/g)) {
        assert.ok(
          operation.parameters?.some((parameter: any) => parameter.in === "path" && parameter.name === match[1] && parameter.required),
          `${method} ${path} is missing required path parameter ${match[1]}`
        );
      }
    }
  }
  assert.deepEqual(operations.sort(), expectedOperations);
});

test("auth, retired routes, uploads and errors describe current behavior", () => {
  assert.deepEqual(spec.paths["/health"].get.security, []);
  assert.deepEqual(spec.paths["/v1/auth/firebase"].post.security, []);
  assert.equal(spec.components.schemas.FirebaseExchange.properties.idToken.writeOnly, true);
  for (const path of ["/v1/auth/register", "/v1/auth/login", "/v1/auth/google", "/v1/auth/google/challenge"]) {
    const operation = spec.paths[path].post;
    assert.ok(operation.responses["410"]);
    assert.ok(!operation.responses["200"]);
  }
  assert.ok(spec.paths["/v1/me/media"].post.requestBody.content["multipart/form-data"]);
  assert.equal(spec.paths["/v1/media/{id}/content"].get.responses["200"].content["image/webp"].schema.format, "binary");
  assert.ok(spec.paths["/v1/matches/{id}/messages"].post.responses["409"]);
  assert.ok(spec.paths["/v1/chat/catalog"].get.responses["503"]);

  const examples = JSON.stringify(spec.paths);
  assert.doesNotMatch(examples, /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\./);
  assert.doesNotMatch(examples, /"(?:token|idToken)"\s*:/i);
});

test("all local schema references resolve", () => {
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    const object = value as Record<string, unknown>;
    if (typeof object.$ref === "string") {
      assert.ok(object.$ref.startsWith("#/components/"), `unexpected external ref ${object.$ref}`);
      const target = object.$ref.slice(2).split("/").reduce<any>((current, key) => current?.[key], spec);
      assert.ok(target, `unresolved ref ${object.$ref}`);
    }
    Object.values(object).forEach(visit);
  };
  visit(spec.paths);
  visit(spec.components.schemas);
});
