# Core API 0.2.0

Owner: BE-Core. Scope P01–P05; supports core F01–F10 and basic block/report F22/F24. The active backend is Fastify 5 + Firebase Admin SDK + Cloud Firestore + Socket.IO. **Cloud mode requires an explicitly configured Firebase project and backend credentials.** No cloud project/credentials have been supplied, so cloud read/write is not yet verified.

The former SQLite implementation is historical local reference, not the active factory or production persistence mode. Preserve its evidence in [the original backend report](../execution/backend-report.md); do not start it via the current handoff. P06–P10 SQL modules remain reference only and are not ported or feature-complete in Firestore. Current Firestore behavior is documented in [core Firestore API](firestore-core.md) and [interaction API](firestore-interaction.md).

`openapi.yaml` is OpenAPI 3.1 serialized as JSON (valid YAML); it describes the shared HTTP wire contract, while the specialized Firestore documents describe persistence and mode behavior. Shared types: `packages/contracts/src/index.ts`. The root integrator is updating the health schema for the current safe Firestore mode/project/namespace fields; use `/health` from the running implementation as the current source until that schema update lands. All successful JSON endpoints return HTTP 200, including creation and retry.

Use `Authorization: Bearer <token>` except health, capabilities, demo accounts/sessions and OTP request/verify. Sessions last 24 hours by default; only hashes are stored. Logout revokes that token and disconnects its sockets. Demo login accepts only A/B/C/D. `DEMO_MODE=false` disables demo login; OTP returns 503 without substituting fake SMS success.

Profile images require auth and are discovery-visible. A third person may view a discovery image; they cannot modify/delete its media, view private selfies, or read/subscribe to another pair's messages. Blocked and ended pairs cannot read each other's profile media. The upload directory is never publicly served. Exactly one `file` field is accepted, with matching PNG/JPEG/WebP magic bytes, maximum 10MB and nine images per account. Validation checks signatures, not full decoding or face content. Video is unavailable because duration validation has not been implemented.

Connect Socket.IO to the API origin with `auth: { token }`, then emit `match:subscribe` with `{matchId}` and an acknowledgement callback. Reply: `{ok:true}` or `{ok:false,error:{code,message}}`. `message:created` contains the committed Message DTO. `match:ended` contains `{matchId,reason:'blocked'|'unmatched'}` and immediately removes room membership. REST is the only message write source. Reconnect reloads history. Session expiry disconnects idle sockets; session/match checks run on subscribe and message delivery.

History runs oldest to newest in `(createdAt,id)` order. `nextCursor` points after the page when more stored rows exist; null means the current end. Refresh after reaching the end by reloading history and upserting by message ID. `clientMessageId` is a UUID unique per sender across matches; identical retries return the original, changed content returns 409. Message timestamps are monotonic within a match so rapid writes cannot fall behind a cursor. Text is at most 2,000 characters. GET `/v1/chat/catalog` supplies local GIF/sticker IDs; payload is `{catalogId:'coffee'}` etc. These are local catalog labels, without external URL fetching. Location messages contain the sender's voluntary one-time `{latitude,longitude}`; the server does not extract the counterpart's GPS.

Discovery omits self, either direction of block, incomplete profiles, existing pair matches and previously swiped targets. It filters gender and age. Radius applies only where both users have consented stored coordinates; `meta.radiusAvailable` and `meta.reason` explain absent GPS. No distance is invented. Public DTOs omit birth date, phone, precise location and report data. Ended matches never automatically return after unblock.

Selfie upload creates a private `pending` request with `mode:'demo'`; it never grants a real verified badge. There is no public selfie route, review UI, face recognition or liveness claim. Reports return private receipts without target notifications or automatic bans. Local retention lasts until an explicitly invoked demo reset; production retention/review policy is outside this demo.

Errors use `{error:{code,message,requestId,fieldErrors?}}`. Rate limits return 429 with `Retry-After`: IP 300 requests/minute, OTP five requests per phone per 15 minutes, five attempts per challenge and five-minute TTL. Wrong/expired/consumed OTPs fail. Demo OTP does not prove phone ownership.

Active factory:

```ts
const app = await createFirestoreApp({
  projectId, namespace, dataDir, demoMode: true,
});
// Optional emulatorHost, seedDemo, sessionTtlMs, otpTtlMs,
// now: () => epochMs, logger
// app.firestore: FirestoreContext; app.firestore.io: Socket.IO Server
await app.listen({host:'127.0.0.1', port:0});
await app.close();
```

`createFirestoreApp` is exported from `apps/api/src/firestore/app.ts`. The context and its domain services are under `apps/api/src/firestore/`; transactions enforce session, ownership, match and block rules. Data lives below `projects/{namespace}` and uses bounded queries/indexes. Cloud mode requires `DATABASE_MODE=firestore`, `FIREBASE_PROJECT_ID`, and ADC or `GOOGLE_APPLICATION_CREDENTIALS` on the backend. Missing configuration fails with guidance; it does not fall back to SQL or emulator. Emulator is a separate explicit `DATABASE_MODE=firestore-emulator` test lane. See [Firestore setup](../12-ket-noi-firestore.md) and [BE→FE handoff](../handoff/be-to-fe.md).

The explicit `firestore:seed` command creates fictional fixtures only when absent; it does not reset edited/deleted content or ended matches. Media bytes remain on the protected backend filesystem; Firestore stores metadata only. Client Firestore rules must deny all direct client access. Admin credentials never belong in the mobile app, Git, or handoff.
