import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  object,
  str,
  uuid,
  enumString,
  profilePatch,
  preferencesPatch,
  coords,
  messageBody,
} from "../src/schemas.js";
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const array = (items: any) => ({ type: "array", items });
const date = { type: "string", format: "date-time" };
const user = object({ id: uuid, displayName: str(80) });
const media = object({
  id: uuid,
  kind: enumString(["image", "video"]),
  url: str(300),
  position: { type: "integer" },
});
const profileProps = {
  userId: uuid,
  displayName: str(80),
  age: { type: "integer" },
  gender: profilePatch.properties.gender,
  bio: { type: "string" },
  datingGoal: profilePatch.properties.datingGoal,
  interests: array(str(40)),
  lifestyle: profilePatch.properties.lifestyle,
  media: array(ref("Media")),
  verification: object({
    status: str(),
    mode: enumString(["demo", "real", "unavailable"]),
  }),
};
const schemas: Record<string, any> = {
  User: user,
  Media: media,
  PublicProfile: object(
    profileProps,
    Object.keys(profileProps).filter((k) => k !== "verification")
  ),
  Profile: object(
    { ...profileProps, dateOfBirth: { type: "string", format: "date" } },
    Object.keys(profileProps).filter((k) => k !== "verification")
  ),
  Session: object({ token: str(100), expiresAt: date, user: ref("User") }),
  Preferences: object(preferencesPatch.properties),
  Match: object({
    id: uuid,
    otherUser: ref("User"),
    status: enumString(["active", "ended"]),
    createdAt: date,
  }),
  Message: object(
    {
      id: uuid,
      matchId: uuid,
      senderId: uuid,
      clientMessageId: uuid,
      kind: enumString(["text", "gif", "sticker", "location"]),
      text: str(2000),
      payload: { type: "object" },
      createdAt: date,
    },
    ["id", "matchId", "senderId", "clientMessageId", "kind", "createdAt"]
  ),
  Verification: object(
    {
      status: enumString(["not_submitted", "pending"]),
      mode: { const: "demo", type: "string" },
      submittedAt: date,
    },
    ["status", "mode"]
  ),
  Error: object({
    error: object(
      {
        code: str(),
        message: { type: "string" },
        fieldErrors: {
          type: "object",
          additionalProperties: { type: "string" },
        },
        requestId: str(),
      },
      ["code", "message", "requestId"]
    ),
  }),
};
const paths: Record<string, any> = {};
function route(
  method: string,
  path: string,
  summary: string,
  response: any,
  body?: any,
  options: { public?: boolean; multipart?: boolean; page?: boolean } = {}
) {
  const parameters: any[] = [];
  for (const match of path.matchAll(/\{(\w+)\}/g))
    parameters.push({
      name: match[1],
      in: "path",
      required: true,
      schema: uuid,
    });
  if (options.page)
    parameters.push(
      {
        name: "limit",
        in: "query",
        schema: { type: "integer", minimum: 1, maximum: 50, default: 20 },
      },
      {
        name: "cursor",
        in: "query",
        schema: { type: "string" },
        description:
          "Opaque ascending (createdAt,id) cursor; omit for oldest page. Read nextCursor until null.",
      }
    );
  const success = object({
    data: response,
    ...(options.page
      ? {
          meta: object(
            {
              nextCursor: { type: ["string", "null"] },
              radiusAvailable: { type: "boolean" },
              reason: { type: "string" },
            },
            ["nextCursor"]
          ),
        }
      : {}),
  });
  paths[path] ??= {};
  paths[path][method] = {
    summary,
    operationId: method + path.replace(/[^a-zA-Z0-9]/g, "_"),
    ...(options.public ? { security: [] } : {}),
    ...(parameters.length ? { parameters } : {}),
    ...(body
      ? {
          requestBody: {
            required: method !== "delete",
            content: {
              [options.multipart ? "multipart/form-data" : "application/json"]:
                { schema: body },
            },
          },
        }
      : {}),
    responses: {
      "200": {
        description: "Success",
        content: { "application/json": { schema: success } },
      },
      ...Object.fromEntries(
        [400, 401, 403, 404, 409, 413, 422, 429, 503].map((code) => [
          code,
          {
            description: "Structured error; requestId supports debugging",
            content: { "application/json": { schema: ref("Error") } },
          },
        ])
      ),
    },
  };
}
route(
  "get",
  "/health",
  "Runtime and database status",
  object({
    status: { const: "ok" },
    database: { const: "ready" },
    version: str(),
  }),
  undefined,
  { public: true }
);
route(
  "get",
  "/v1/capabilities",
  "Provider modes; demo does not mean a live provider",
  array(
    object(
      {
        name: str(),
        mode: enumString(["real", "demo", "unavailable"]),
        reason: { type: "string" },
      },
      ["name", "mode"]
    )
  ),
  undefined,
  { public: true }
);
route(
  "get",
  "/v1/demo/accounts",
  "Fictional account allowlist; 404 outside demo",
  array(
    object({ account: enumString(["A", "B", "C", "D"]), displayName: str() })
  ),
  undefined,
  { public: true }
);
route(
  "post",
  "/v1/demo/sessions",
  "Create demo session, 24h by default",
  ref("Session"),
  object({ account: enumString(["A", "B", "C", "D"]) }),
  { public: true }
);
route(
  "post",
  "/v1/auth/otp/request",
  "Demo OTP; 5 requests / phone / 15 minutes; no SMS",
  object({
    challengeId: uuid,
    expiresAt: date,
    mode: { const: "demo" },
    demoCode: { type: "string", pattern: "^[0-9]{6}$" },
  }),
  object({ phone: { type: "string", pattern: "^\\+[1-9][0-9]{7,14}$" } }),
  { public: true }
);
route(
  "post",
  "/v1/auth/otp/verify",
  "One-time OTP; 5 minute TTL, 5 attempts",
  ref("Session"),
  object({
    challengeId: uuid,
    code: { type: "string", pattern: "^[0-9]{6}$" },
  }),
  { public: true }
);
route(
  "post",
  "/v1/auth/logout",
  "Revoke token and disconnect its sockets",
  object({ revoked: { const: true } })
);
route("get", "/v1/me", "Authenticated current user", ref("User"));
route(
  "get",
  "/v1/me/profile",
  "Own profile includes birth date",
  ref("Profile")
);
route(
  "patch",
  "/v1/me/profile",
  "Update known profile fields only; server checks adult age",
  ref("Profile"),
  profilePatch
);
route(
  "get",
  "/v1/profiles/{id}",
  "Public profile omits birth date, phone and location",
  ref("PublicProfile")
);
const file = object({ file: { type: "string", format: "binary" } });
route(
  "post",
  "/v1/me/media",
  "JPEG/PNG/WebP with matching magic bytes, max 10MB and 9 images. Video rejected (duration validation unavailable)",
  ref("Media"),
  file,
  { multipart: true }
);
route(
  "patch",
  "/v1/me/media/order",
  "Order must include every current owned media ID exactly once",
  array(ref("Media")),
  object({
    mediaIds: { type: "array", maxItems: 9, uniqueItems: true, items: uuid },
  })
);
route(
  "delete",
  "/v1/me/media/{id}",
  "Delete owned media",
  object({ deleted: { const: true } })
);
route(
  "get",
  "/v1/media/{id}/content",
  "Authenticated discovery-visible profile image; blocked/ended denied",
  {}
);
paths["/v1/media/{id}/content"].get.responses["200"] = {
  description: "Private image bytes, Cache-Control private no-store",
  content: {
    "image/png": { schema: { type: "string", format: "binary" } },
    "image/jpeg": { schema: { type: "string", format: "binary" } },
    "image/webp": { schema: { type: "string", format: "binary" } },
  },
};
route(
  "post",
  "/v1/me/verification/selfie",
  "Private selfie upload; pending demo only, never verified badge",
  ref("Verification"),
  file,
  { multipart: true }
);
route(
  "get",
  "/v1/me/verification",
  "Own demo verification workflow state",
  ref("Verification")
);
route("get", "/v1/me/preferences", "Discovery preferences", ref("Preferences"));
route(
  "patch",
  "/v1/me/preferences",
  "Known filter fields; minAge <= maxAge",
  ref("Preferences"),
  preferencesPatch
);
route(
  "put",
  "/v1/me/location",
  "Store own private coordinate with explicit consent",
  object({ consent: { const: true }, updatedAt: date }),
  object({ ...coords.properties, consent: { type: "boolean", const: true } })
);
route(
  "delete",
  "/v1/me/location",
  "Revoke stored private coordinate",
  object({ consent: { const: false } })
);
route(
  "get",
  "/v1/discovery",
  "Eligible profiles; radius applies only when both have location, reason explains unavailable GPS",
  array(ref("PublicProfile")),
  undefined,
  { page: true }
);
route(
  "post",
  "/v1/swipes",
  "Like/pass; canonical atomic mutual match. Ended pairs never rematch",
  object({ swipeId: uuid, match: { anyOf: [ref("Match"), { type: "null" }] } }),
  object({ targetUserId: uuid, action: enumString(["like", "pass"]) })
);
route("get", "/v1/matches", "Current active matches", array(ref("Match")));
route(
  "delete",
  "/v1/matches/{id}",
  "End match; revoke history/send/socket room immediately",
  object({ ended: { const: true } }),
  object({ reasonCode: str(80) }, [])
);
route(
  "get",
  "/v1/matches/{id}/messages",
  "Ascending history; only active members",
  array(ref("Message")),
  undefined,
  { page: true }
);
route(
  "post",
  "/v1/matches/{id}/messages",
  "Only REST commits messages; sender+clientMessageId retry same returns same row, changed content 409. GIF/sticker payload {catalogId}; location payload {latitude,longitude}",
  ref("Message"),
  messageBody
);
route(
  "get",
  "/v1/chat/catalog",
  "Local rich message catalog; no external URL fetching",
  object({ gifs: array(str()), stickers: array(str()) })
);
route(
  "post",
  "/v1/blocks",
  "Block pair, end active match, revoke socket/read/write",
  object({ blocked: { const: true } }),
  object({ targetUserId: uuid })
);
route(
  "delete",
  "/v1/blocks/{userId}",
  "Unblock does not reactivate ended match",
  object({ blocked: { const: false } })
);
route(
  "get",
  "/v1/blocks",
  "Own block list",
  array(object({ targetUserId: uuid, createdAt: date }))
);
route(
  "post",
  "/v1/reports",
  "Private receipt; no automatic ban or reporter exposure",
  object({ id: uuid, status: { const: "received" } }),
  object(
    {
      targetUserId: uuid,
      reasonCode: str(80),
      detail: { type: "string", maxLength: 2000 },
      matchId: uuid,
    },
    ["targetUserId", "reasonCode"]
  )
);
const spec = {
  openapi: "3.1.0",
  info: {
    title: "Gặp local core API",
    version: "0.1.0",
    description:
      "P00/P01–P05 local demo. All creation and idempotent retry responses use HTTP 200. Opaque bearer sessions; no real SMS or identity verification.",
  },
  servers: [{ url: "http://localhost:3000" }],
  security: [{ bearerAuth: [] }],
  paths,
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description:
          "Opaque random token. Hashed in SQLite, 24h by default, revocable.",
      },
    },
    schemas,
  },
};
const target = resolve(
  import.meta.dirname,
  "../../..",
  "docs/api/openapi.yaml"
);
mkdirSync(resolve(target, ".."), { recursive: true });
writeFileSync(target, JSON.stringify(spec, null, 2) + "\n");
