# Backend implementation report — P00/P01–P05

Date: 2026-11-01, Asia/Saigon. Owner: backend_core. Scope: T00.03, T01.02/T01.03, T02.01–T04.03; F01–F10 core and minimal block/report F22/F24. No commit, push, deploy, paid provider call, SMS, or message to an outside party was performed.

## Implemented

- Fastify 5 with strict JSON Schema input validation (unknown fields rejected), structured errors/request IDs, IP quota, auth redaction, health/capabilities, Node 24 SQLite migration and idempotent seed.
- Real SQLite persistence, foreign keys, WAL/busy timeout, canonical pair uniqueness, atomic mutual-like creation, image quota/order transactions. Opaque random session tokens are stored only as hashes, default 24-hour expiry, logout revocation. OTP is explicitly demo, five-minute TTL, five attempts, single use, five requests per phone per 15 minutes. Demo disabled returns 404/503 without silently mocking live SMS.
- Own/public profile separation, server adult validation, preferences, private consented location, basic gender/age/radius discovery, like/pass, active match listing and unmatch without auto-rematch.
- Private authenticated image delivery, owner-only upload/order/delete, nine-image quota and matching PNG/JPEG/WebP magic bytes, 10MB stream limit and file cleanup when DB insertion fails. Synthetic geometric seed PNGs for A/B/C/D are generated locally. Private pending demo selfie workflow never grants a real verification badge.
- REST text, local catalog GIF/sticker and one-time location messages; sender-wide clientMessageId idempotency with conflicting-content 409; ascending cursor history with monotonic per-match timestamps. Socket.IO sends committed messages, rejects outsiders, checks current sessions/membership, removes rooms on block/unmatch and disconnects on logout/expiry.
- Block lists, two-way visibility denial and private report receipts. No keyword auto-ban or SOS claim.
- Shared contracts including concrete input unions; complete machine-readable OpenAPI and API usage notes; demo-account instructions.

`createApp(options?: {dbPath?:string;dataDir?:string;demoMode?:boolean;sessionTtlMs?:number;otpTtlMs?:number;now?:()=>number;logger?:boolean})` returns `Promise<FastifyInstance>` decorated with `.db`, `.io`, `.config`. Exports `setupDatabase({dbPath,dataDir,demoMode?})`, `seedDemo(db,dataDir)` from `apps/api/src/app.ts`. The root launcher should set an absolute root `DATA_DIR`; standalone defaults to cwd/data. Main server binds 0.0.0.0:3000.

## Verification evidence

Latest worker verification commands after formatting and final behavior changes:

```text
node --import tsx apps/api/scripts/generate-openapi.ts
npm run typecheck --workspace @gap/api
npm test --workspace @gap/api
```

All returned exit 0. TypeScript includes src, tests and the OpenAPI generator. Node test runner: **6 tests, 6 pass, 0 fail**, duration 1,830ms (latest run). These are real Fastify injection, temporary filesystem SQLite, and actual listening HTTP/Socket.IO clients; no mocked DB or fake socket transport.

1. Schema/auth/private profile: unauthorized rejected; unknown ownership field rejected; underage/invalid calendar date rejected; OTP one-use, five wrong attempts, TTL and per-phone rate limit; logout invalidates token; demo/live-off isolation.
2. Mutual likes sent concurrently create one row, repeated like same match; discovery paging/filter and GPS range; C denied A–B history; same clientMessageId one row, conflicting retry 409; arbitrary GIF URL rejected; voluntary location accepted; chronological cursor moves to a distinct later message; C denied foreign media delete; unauthenticated media denied; outsider match report rejected; block revokes REST/media and unblock cannot rematch.
3. Actual multipart signature rejection, >10MB rejection; seven uploads then two competing quota requests yield 200/422; nine rows, no failed-upload file orphan; foreign reorder rejected, own reorder succeeds; selfie pending/demo; third-party selfie-content request rejected.
4. Three real Socket.IO clients: C cannot subscribe A–B, B receives persisted REST message, block event removes room and late read/write/subscribe fails; logout disconnects token's socket; independent C–D unmatch produces event and prevents rejoin.
5. Already connected socket disconnects when session expires and REST token is rejected.
6. Close/reopen same DB retains edited profile, session, match and message; seed twice yields four users/four initial media, foreign keys enabled.

Prettier formatted all backend/contracts TypeScript. Root owns install/lockfile and wider API/native smoke; its evidence is separate from this worker report.

## Explicit limitations / handoff

- No video acceptance: duration decoder is unavailable, capability says unavailable and upload rejects unsupported video. Images validate magic bytes, not full decoding, face detection or liveness.
- OTP never sends SMS or proves phone ownership. OAuth/live SMS/AI/payment providers are unavailable. Selfie is private pending/demo only; no reviewer UI or automated approval. No production retention policy, legal consent package, horizontal scaling or deployment claim.
- Profile images are authenticated discovery-visible. Third-user denial applies to another pair's chat/socket, private selfie and media mutation. It does not hide every public profile image from C.
- Rich message catalog is a local allowlist of labels, no external URL fetch or remote content integration. Full media moderation and chat-media upload are later phases.
- Cursor history is oldest-first; reload/upsert after reaching null. There are no socket send commands, receipts, push notifications, typing/online or guaranteed event replay. REST history remains the source of truth.
- Radius can apply only when both profiles have private consented coordinates; missing GPS is explained in metadata. No fake distance or location is emitted.
- This is a local single-process demo backend and RN test-harness contract, not approved FE-product or completion of all 37 features. Android UI/native evidence belongs to the root/mobile QA flow.
