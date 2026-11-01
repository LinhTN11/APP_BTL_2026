# SDD ledger — plan: docs/04-ke-hoach-trien-khai.md

## 2026-11-01 — React Native CLI correction and execution

User: React Native CLI, no Expo; check compatibility then execute with subagents. Implementation authorized. Visual design remains draft; FE-test is authorized independently.

Workspace: newly initialized repository, branch `feat/rn-cli-demo`; initial docs snapshot committed. No existing app to overwrite. Work is local, no push/deploy. This repo is the user's explicitly named implementation workspace.

Ruling: execute P00/P01–P05 core first, then reassess remaining roadmap against deadline; never silently claim all 37 F complete. User's one-day BE priority and future FE day govern delivery.

Ruling: use file-disjoint docs/backend/mobile workers in parallel as explicitly requested; root owns root package/scripts/lockfile and integration. This overrides skill's generic prohibition on concurrent implementation because no shared mutation is delegated. No agent may spawn subagents or commit independently.

| Task wave | Producer → consumer / shared interface | Check / ruling |
|---|---|---|
| CLI docs | User D10 → all tasks | Expo plan contradicts user; replace active guidance before using it |
| P00 contract | Core brief + docs08 → backend/mobile | Root locks concrete DTO subset in core brief; extend OpenAPI with implementation |
| P01 runtime/DB | API config/migration/seed → modules | API worker owns only apps/api + packages/contracts + docs/api; root owns npm lock |
| P01 native | RN generated android/ios → test screens | Mobile worker owns only apps/mobile; no Expo runtime/import/package |
| P02 auth/profile/media | Session/profile DTO → mobile API client | Use brief exact fields; opaque 24h session, demo account A/B/C/D explicit |
| P03 matching | active canonical pair → chat/safety | Atomic unique match; no re-match after ended in core |
| P04 realtime | REST persisted DTO → socket + mobile upsert | message:created, match:ended, match:subscribe; auth at subscribe and every read/write |
| P05 integration | npm scripts + API + native app → clone-run/QA | Root smoke/review; no UI-product approval implied |
| P06–P11 | core + phase-specific decisions → expanded roadmap | Remain pending until actually implemented/tested; no invented provider success |

## Current state

- CLI docs worker: complete; active docs require Community CLI, no Expo. Old Expo skills archived outside active catalog.
- Backend core worker: implemented actual DB/auth/profile/image/discovery/matching/chat/block/report and private selfie submission; 6 integration tests initially passed, now 7 with storage/config regression.
- Mobile core worker: implemented native CLI test harness with API/client/session and split screen modules; initial 15 tests passed.
- Root: HTTP smoke passed; full initial verify passed; Android x86_64 debug built (Gradle9.4.1/JDK21), installed on Pixel9 headless emulator; clean source archive into path with spaces passed npmci/setup/smoke/typecheck.
- Independent reviewer: no P0/P1 found within bounded core review; HOST mismatch corrected, no-demo media directory corrected. Mobile save/swipe/pending races and keyboard layout under active fixes/verification.
- Current: 19 mobile tests pass after fixes; native keyboard send/reply QA passed. Before fix composer sat below IME, after fix input and Send fit above it; actual Android send persisted and B HTTP client's reply rendered realtime in A. Evidence `docs/qa/native-keyboard-after.png`, `native-chat-success.png`.
- Next workers: personalization P06 (F13–F18 local backend) and date support P08 (F25–F28/calendar export foundation). Private file ownership and separate migrations; root alone integrates app registration. Their features remain pending until tested; no whole-roadmap completion claim.

Ruling: local educational personality questions are original and informational, not official MBTI. Music import without developer credentials remains unavailable. Calendar export is one-way ICS, not cloud synchronization. Venue/voucher records are synthetic demo catalog, not partner offers. GPS/SOS only voluntary preview, never rescue dispatch.

## Review policy

Workers self-test bounded changes; independent reviewer checks spec + correctness after integration, including auth/IDOR/transaction/retry/revocation. Root verifies commands against current files before marking tasks complete. Evidence in docs/qa and docs/handoff.

## USER steering — D12 Firestore

User explicitly confirmed Cloud Firestore and has no Firebase project yet. Primary database must move to real Firestore through Admin SDK; SQLite implementation is now a tested reference, not the selected production/demo cloud backend. SQL extension integration stopped; no mirroring a local SQLite file and calling that Firestore.

- Firestore auth/profile/media worker assigned actual async SDK implementation.
- Firestore interaction worker assigned transactional matching/chat/block/report/socket paths.
- Root: primary factory/server switch, emulator tests/tooling, Firebase setup instructions, configuration and source protection.
- Cloud verification remains pending a dedicated project ID and authorized local credentials. Emulator tests are labeled emulator, never live cloud success. React Native CLI/no Expo unchanged; mobile wire contract preserved.

## D12 current verification and remaining work

- Primary server imports `createFirestoreApp`; no SQL storage fallback. Firebase rules/indexes, configuration checks, explicit emulator launcher, read-check and create-only seed scripts are implemented.
- Final root verification: typechecks + ESLint passed; Firestore15/15 tests passed with0skipped. Mobile19/19 in that run, then20/20 after an additional reproduced fast-send stale-prop regression/fix. No backend code changed after the15-test gate.
- Native Android Firestore Emulator workflow passed: A login/discovery/media/Like, B reciprocal Like, native message persisted and B HTTP response arrived realtime on A; IME/send bounds validated. One native client plus one HTTP client, not two native devices.
- Independent review findings resolved: fail-closed emulator/cloud mode selection; transaction session/account guard for every own-data mutation; socket disconnect check before listener; no-session upload cleanup. Root inspected actual diffs and ran integration checks.
- SDK metadata probing disabled only in explicit emulator launcher via supported `METADATA_SERVER_DETECTION=none`; cloud ADC behavior unchanged. Windows PATH casing normalized for child npm/Java; port probe verified against an actual all-interface listener and its closed port.
- Cloud project/credentials still absent. Do not run cloud writes or reuse another app's project. User setup route: docs/12-ket-noi-firestore.md. Full P06–P10 SQL references are not registered in Firestore and are not claimed complete.
