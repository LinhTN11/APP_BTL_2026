import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";
import { registerApiDocs } from "../src/api-docs.js";

test("Swagger serves local UI, assets and OpenAPI without making business routes public", async (t) => {
  const app = Fastify();
  t.after(() => app.close());
  app.addHook("onRequest", async (req, reply) => {
    if (
      (req.method === "GET" || req.method === "HEAD") &&
      req.routeOptions.config.publicDocumentation === true
    ) return;
    return reply.code(401).send({ error: { code: "UNAUTHORIZED" } });
  });
  await registerApiDocs(app);
  app.get("/v1/me/profile", async () => ({ private: true }));

  const page = await app.inject("/docs/");
  assert.equal(page.statusCode, 200);
  assert.match(page.headers["content-type"]!, /text\/html/);
  assert.match(page.body, /Swagger UI/);
  assert.doesNotMatch(page.body, /https?:\/\/(?:unpkg|cdn|petstore)/);
  assert.doesNotMatch(page.headers["content-security-policy"]!, /upgrade-insecure/);

  const schema = await app.inject("/docs/json");
  assert.equal(schema.statusCode, 200);
  assert.equal(schema.json().openapi, "3.1.0");
  assert.ok(schema.json().paths["/v1/auth/firebase"]);
  assert.ok(schema.json().components.securitySchemes.bearerAuth);

  for (const path of ["/docs/static/swagger-ui-bundle.js", "/docs/static/swagger-ui.css", "/docs/yaml"]) {
    const response = await app.inject(path);
    assert.equal(response.statusCode, 200, path);
    assert.ok(response.body.length > 0, path);
  }
  const initializer = await app.inject("/docs/static/swagger-initializer.js");
  assert.equal(initializer.statusCode, 200);
  assert.match(initializer.body, /"persistAuthorization":false/);
  assert.match(initializer.body, /"validatorUrl":null/);
  assert.equal((await app.inject("/v1/me/profile")).statusCode, 401);
  assert.equal((await app.inject("/v1/me/profile?next=/docs/json")).statusCode, 401);
  assert.equal((await app.inject("/docs-missing")).statusCode, 401);
});
