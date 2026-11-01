# D12 Firestore interaction verification

Date: 01/11/2026 (Asia/Saigon). Scope: P03 T03.01–T03.03 / P04 T04.01–T04.03, BE domain/realtime, F06–10/F22 and private basic unmatch feedback. Status: core implementation and actual emulator verification complete within this module; cloud connection remains unverified.

Owned deliverables:

- `apps/api/src/firestore/matching.ts`: bounded discovery, swipe transaction, deterministic canonical pair, paged matches, idempotent unmatch, private feedback, shared authorization/session/room helpers.
- `apps/api/src/firestore/chat.ts`: persistent messages/idempotency keys, stable forward cursors, payload validation, private read cursors, authenticated Socket.IO subscriptions and lifecycle listeners/cleanup.
- `apps/api/src/firestore/safety.ts`: transactional block/unblock, paged block listing, private report receipts.
- `apps/api/test/firestore-interaction.test.ts`: real Admin SDK emulator integration, no fake DB.
- `docs/api/firestore-interaction.md`: collection/query/lifecycle behavior and limits.

Verification executed against explicit `127.0.0.1:8089`, project `demo-app-cuoi-ky`, a new random `interaction-xxxxxxxx` namespace per test and temporary backend media directory:

```powershell
$env:DATABASE_MODE='firestore-emulator'
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8089'
$env:FIREBASE_PROJECT_ID='demo-app-cuoi-ky'
node --import tsx --test test/firestore-interaction.test.ts # cwd apps/api
```

Final result: **4 tests passed, 0 failed, 0 skipped**, duration 44.54 seconds. `npm run typecheck -w @gap/api` also passed after the final implementation. Formatter applied only to owned files. The SDK printed a metadata lookup warning during emulator startup; test connections/read/writes all used the explicit emulator and completed successfully.

Verified behavior:

- Two separate backend instances and concurrent mutual likes/retries create exactly one canonical match; retries retain the same external match ID.
- Six concurrent sends with one client message key create one message across instances; changed content returns 409. C receives 404 for history/send and cannot subscribe; injected room/user subscription data is rejected.
- Five concurrent sends under a frozen server clock allocate increasing timestamps. Three oldest-first pages have no duplicate or omitted messages. Invalid cursors/coordinates fail; text stays literal; valid GIF/sticker/location persist with exact payloads. Authorized read cursors persist; C cannot create one.
- Another fresh backend instance reads existing history; explicit repeat seeding preserves messages. This proves storage persistence across factories, not an emulator-process restart/cloud durability exercise.
- Report receipts persist, and C cannot attach a report to A/B's private match. Private unmatch feedback is written once and never returned in a match list.
- Live sockets receive committed messages. Block emits public match-ended, removes local rooms, denies history/send/retry/subscribe, hides the pair from discovery/matches, and unblock never rematches.
- Concurrent sends against unmatch and block from a second backend produce only permitted successes or `MATCH_INACTIVE`; the persisted message count equals successful sends. Post-revoke sends fail. Unmatch retry is stable.
- A match listener removes a room after another backend commits block. Advancing the server clock disconnects an idle expired session; logout disconnects the same-instance socket and the old token is rejected.

An initial test caught listener ordering that could remove a room before HTTP code emitted `match:ended`. The listener now emits the public lifecycle event before leaving; the final complete suite passed after this fix and actor-account transaction hardening.

Limits: emulator evidence is not cloud evidence. No project/resources/credentials were created, no provider call, push or deploy occurred. Cross-instance message fanout requires a future Socket.IO adapter; the demo uses one backend. Discovery may require multiple cursor requests and scans at most 200 candidates per request. Advanced safety moderation/review/appeals/contact blocking, private chat attachments, personalization/games, billing, AI and date modules remain unported here; no SQL fallback is invoked. Native/visual FE acceptance remains outside this worker.
