# D12 — Cloud Firestore as primary database

USER confirmed: Firestore, no project yet. React Native Community CLI/no Expo stays fixed. Replace primary SQL storage with Firebase Admin Firestore, not a SQLite mirror or dump. Preserve existing wire DTOs/mobile API. Missing cloud project/credentials must fail helpfully; do not silently fall back to SQLite/emulator and call it cloud. Use emulator explicitly for tests while project connection is pending. No production/existing project reuse.

## Architecture and ownership

Primary factory `createFirestoreApp(options)` in `apps/api/src/firestore/app.ts`. Export shared async Firestore context/services from `firestore/context.ts`. Root owns server.ts/package/lock/scripts and primary mode selection. Local SQL source is reference until ports pass; no more new SQL implementation.

Firestore Admin `firebase-admin` pinned14.5.0, Node24. Credentials via ADC / `GOOGLE_APPLICATION_CREDENTIALS` absolute local file path; project via `FIREBASE_PROJECT_ID`, explicit `FIRESTORE_EMULATOR_HOST` only when `DATABASE_MODE=firestore-emulator`. Never put admin credentials in RN bundle/Git/chat. App namespace collection root: `projects/{namespace}` document and its subcollections; namespace default `app-cuoi-ky`, validate `[a-z0-9-]{1,48}`. Admin bypasses client rules, so deny all direct client Firestore reads/writes; Fastify enforces identity/ownership. Media remain protected backend filesystem initially; label this separately from Firestore DB. Never store large media bytes in documents or pretend file storage is cloud.

Options shape:
```ts
interface FirestoreOptions {
 projectId?: string; namespace?: string; emulatorHost?: string;
 dataDir?: string; demoMode?: boolean; seedDemo?: boolean;
 now?: () => number; sessionTtlMs?: number; otpTtlMs?: number;
 logger?: boolean;
}
```
Context `{db:Firestore, root:DocumentReference, config:{now,namespace,dataDir,demoMode,sessionTtlMs,otpTtlMs}, io:SocketIOServer, ref(collection,id), collection(name)}`. Store dates as ISO strings/epoch milliseconds consistently wire; do not leak raw Timestamp objects. Seed profiles A/B/C/D same stable UUIDs and exact profile/media/enum DTOs. Seed only explicitly `seedDemo:true` in emulator tests or explicit seed command, no auto cloud reset. Export `seedFirestoreDemo(context)` safe create-if-absent never overwrite edits or deletions/ended match. Terminate SDK/admin app on close, no leaked test handles.

## Core auth/profile worker scope

Own `firestore/{context,auth,profiles,media,seed,schemas}.ts`, `test/firestore-auth-profile.test.ts`, docs/api/firestore-core.md and report. Use async real Admin SDK, no in-memory fake datastore. Sessions docs keyed hash(token), raw tokens never stored. Demo sessions enabled only mode/seeded account; OTP5min max5 attempts and5requests/phone/15min persisted transactions; verifychallenge &create/link phone identity atomic, no query-equality uniqueness races (phone index doc hash). No social/provider identity claim. Profiles own/public,18+validate/enums/nulls, preferences, consented private location. Upload quota9 protected transaction + byte/MIME/size10MB, storage path controlled, cleanup DB failure, authenticated file read with public profile vsprivate selfie policy. Profile/ media DB docs Firestore. Selfie pending demo only, no verified badge. Export registerFirestoreAuth(app,ctx), registerFirestoreProfiles(app,ctx), registerFirestoreMedia(app,ctx). Central `authenticate(ctx,token)` returns `{userId,sessionKey,expiresAt}` exported for app hook/socket. Context app binding root integrator ownsfactory; helpers should not import app factory to avoid cycles. Tests may use createFirestoreApp once rootcreates; beforethat use local Fastify factory helper solelytest registration + central authhook. All tests require actual emulatorhostexplicit, skipwithclearreason ifnotrunning (root starts emulator and requirepass, no skippedcount successclaim).

## Matching/chat/safety worker scope

Own `firestore/{matching,chat,safety}.ts`, `test/firestore-interaction.test.ts`, docs/api/firestore-interaction.md/report. Consume context/auth/profilehelpers. Export registerFirestoreMatching(app,ctx), registerFirestoreChat(app,ctx), registerFirestoreSafety(app,ctx), configureFirestoreSocket(ctx), optional lifecyclehelpers. Core API routes same brief.

- Canonical deterministic match document ID from sorted UUID pair; swipe document actor_target; transactions read all relevant documents (profiles/users/block/match/reverse swipe) before writes. Two server instances mutual likes still one match; no sync SQL assumptions.
- Message idempotency document key hash(senderId+clientMessageId) and associated immutable match/content check; transaction stores message + cursor sortkey. Keep UUID external IDs. Query paging oldest-first stable `(createdAt,id)` (composite index supplied root); don't fetch wholecloud collections perrequest. Same-millisecond timestamp plus UUID sorting safe; newer pages use last tuple. Concurrent send not lost.
- Authorization/member/blocked state checked in every transaction immediately before write; unmatch/block conflicts with sends through common matchdoc. After commit emit socketevent, no event in retriedtransaction closure. Cross-instance socket scaleout not supported yet; one Fastify server for demo, disclose.
- Socket token expiry/logout revoke, matchroom membership current-state, no client room/user injection. Firestore listener for match status or bounded immediate local room revoke; no idle raw data events afterblock. Actor C denied history/send/subscribe. Public profile images not private chat attachments.
- Block/report real Firestore persistence, unmatch reason private. Advanced safety workflows may port only after core stable; mark unported features explicitly rather than fallbackSQL.

## Root tasks

Factory/app/server config, Admin dependency, emulator tooling/firebase.json/rules/indexes, cloud setup guide, envignore, tests/emulator runner, mobile integration, phase status and honest cloud verification. Backend must advertise `database:{provider:'firestore',mode:'cloud'|'emulator',projectId,namespace}` health/capability; never serviceaccount/token secrets. `npm run demo` points real Firestore requires configuration; `demo:emulator` explicit test lane. Real project connection/write/read awaiting user-supplied target/config.

## Acceptance

Actual Firestore emulator SDK tests for transactions/races/ownership/replay/persistence/restart. No simulated tests labeled realcloud. Preserve mobile compatibility. Source primary imports no node:sqlite. Cloud missing config returns actionable error before listening. No open Firestore rules. No cloud credentials bundled with source. Regression/API smoke must target explicitly selected mode and ephemeral namespace only; never erase existing cloud data.
