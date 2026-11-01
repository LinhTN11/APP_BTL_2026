# Core API 0.1.0

Owner: BE-Core. Scope T00.03, T01.02–T01.03, T02.01–T04.03; supports F01–F10 and minimal block/report F22/F24. Fastify 5, SQLite and Socket.IO are real local services. No cloud account or provider secret is needed.

`openapi.yaml` is OpenAPI 3.1 serialized as JSON (valid YAML). Shared types: `packages/contracts/src/index.ts`. Regenerate using `node --import tsx apps/api/scripts/generate-openapi.ts` from the repository root. All successful JSON endpoints return HTTP 200, including creation and retry.

Use `Authorization: Bearer <token>` except health, capabilities, demo accounts/sessions and OTP request/verify. Sessions last 24 hours by default; only hashes are stored. Logout revokes that token and disconnects its sockets. Demo login accepts only A/B/C/D. `DEMO_MODE=false` disables demo login; OTP returns 503 without substituting fake SMS success.

Profile images require auth and are discovery-visible. A third person may view a discovery image; they cannot modify/delete its media, view private selfies, or read/subscribe to another pair's messages. Blocked and ended pairs cannot read each other's profile media. The upload directory is never publicly served. Exactly one `file` field is accepted, with matching PNG/JPEG/WebP magic bytes, maximum 10MB and nine images per account. Validation checks signatures, not full decoding or face content. Video is unavailable because duration validation has not been implemented.

Connect Socket.IO to the API origin with `auth: { token }`, then emit `match:subscribe` with `{matchId}` and an acknowledgement callback. Reply: `{ok:true}` or `{ok:false,error:{code,message}}`. `message:created` contains the committed Message DTO. `match:ended` contains `{matchId,reason:'blocked'|'unmatched'}` and immediately removes room membership. REST is the only message write source. Reconnect reloads history. Session expiry disconnects idle sockets; session/match checks run on subscribe and message delivery.

History runs oldest to newest in `(createdAt,id)` order. `nextCursor` points after the page when more stored rows exist; null means the current end. Refresh after reaching the end by reloading history and upserting by message ID. `clientMessageId` is a UUID unique per sender across matches; identical retries return the original, changed content returns 409. Message timestamps are monotonic within a match so rapid writes cannot fall behind a cursor. Text is at most 2,000 characters. GET `/v1/chat/catalog` supplies local GIF/sticker IDs; payload is `{catalogId:'coffee'}` etc. These are local catalog labels, without external URL fetching. Location messages contain the sender's voluntary one-time `{latitude,longitude}`; the server does not extract the counterpart's GPS.

Discovery omits self, either direction of block, incomplete profiles, existing pair matches and previously swiped targets. It filters gender and age. Radius applies only where both users have consented stored coordinates; `meta.radiusAvailable` and `meta.reason` explain absent GPS. No distance is invented. Public DTOs omit birth date, phone, precise location and report data. Ended matches never automatically return after unblock.

Selfie upload creates a private `pending` request with `mode:'demo'`; it never grants a real verified badge. There is no public selfie route, review UI, face recognition or liveness claim. Reports return private receipts without target notifications or automatic bans. Local retention lasts until an explicitly invoked demo reset; production retention/review policy is outside this demo.

Errors use `{error:{code,message,requestId,fieldErrors?}}`. Rate limits return 429 with `Retry-After`: IP 300 requests/minute, OTP five requests per phone per 15 minutes, five attempts per challenge and five-minute TTL. Wrong/expired/consumed OTPs fail. Demo OTP does not prove phone ownership.

Factory:

```ts
const app = await createApp({dbPath, dataDir, demoMode: true});
// Optional sessionTtlMs, otpTtlMs, now: () => epochMs, logger
// app.db: DatabaseSync; app.io: Socket.IO Server; app.config
await app.listen({host:'127.0.0.1', port:0});
await app.close();
```

`setupDatabase({dbPath,dataDir,demoMode?})` and `seedDemo(db,dataDir)` are exported from `apps/api/src/app.ts`. Migration/seed run automatically. Seed never overwrites edited profiles, restores deleted media rows, resets swipes or erases messages. Standalone default data directory is `<cwd>/data`; root launcher supplies absolute root `DATA_DIR`. Server binds `0.0.0.0:3000` (`PORT` override). Root runbook handles Android/LAN setup.
