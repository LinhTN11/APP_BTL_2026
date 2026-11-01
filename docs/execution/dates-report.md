# P08 backend worker report — 01/11/2026

Scope: T08.01–T08.03 (F25–F28), date eligibility foundation for F23, one-way ICS foundation for F37. BE owner only; no device, FE-product, cloud, production, provider or delivery claim. Approved brief: `docs/execution/advanced-brief.md` wave P08. API additions and exact DTOs are in `docs/api/dates.md`.

Implemented files:

- `apps/api/src/modules/dates/{index,validation,service,venues,plans,reviews,previews,calendar}.ts` — module registration, bounded validation, SQL transaction/idempotency/authorization, read-only fictional catalog, participant reviews/report queue, private feedback, lifecycle/notifications, share/SOS previews and ICS.
- `apps/api/src/db/migrations/003_dates.sql` — isolated version-3 tables/indexes and non-overwriting fictional catalog seed. Runs transactionally by module URL before routes register. Uses existing migrations marker; no existing core column changed.
- `apps/api/test/dates.test.ts` — real temporary SQLite integration tests, deterministic server clock and restart checks. Supports root auto-registration by checking `app.hasRoute` before registering.
- Module API documentation and this report. No edits to app/domain/core modules/shared contracts/lockfiles/mobile.

Root integration: import `registerDates` from `./modules/dates/index.js`, then call `registerDates(app, d)` before Fastify becomes ready. Existing auth hook already fills `req.actor`; existing Domain SQL, config clock, active match access and Socket.IO instance are reused. Full list: GET `/v1/venues`, GET `/v1/venues/:id`, GET/POST `/v1/venues/:id/reviews`, POST `/v1/venues/:id/reviews/:reviewId/report`, GET/POST `/v1/date-plans`, GET/PATCH `/v1/date-plans/:id`, POST `/v1/date-plans/:id/feedback`, POST `/v1/date-plans/:id/share`, POST `/v1/date-plans/:id/sos-preview`, GET `/v1/date-plans/:id/calendar.ics`.

Verification run on the worker output:

- `node --import tsx --test apps/api/test/dates.test.ts` — **7 tests, 7 passed, 0 failed**. Auth/C denial on every date surface; active match creation/acceptance; future/invalid date/timezone/duration/control characters; proposer/other member lifecycle; optimistic conflicts/retries; ended-date eligibility, feedback/review duplicates and privacy; review report hiding without ban; consent/invalid/missing coordinates, catalog filtering and expired offers; confirmed SOS/current own position/no GPS/no chat delivery; stable escaped/folded ICS and direct DB injection defense; restart persistence/migration idempotence.
- `npm run typecheck --workspace @gap/api` — exit 0.

Limits to preserve at integration: real local storage/workflows and export; fictional venues/vouchers carry demo mode, no redemption workflow. SOS carries demo mode and only prepared/no_location preview. Share has no public links/tokens. No provider/network call exists in this module. Public venue reviews hide author/plan IDs, but there is no public reputation aggregate. Flagged reviews remain hidden pending manual operator review; moderation resolution UI/roles belong to later safety work. Attendance is self-reported, not verified. Query consent is an explicit caller attestation; FE must obtain permission for voluntarily shared coordinates. Native GPS/share/map/calendar and provider sync require separate device/provider testing. Notification hook emits plan ID/version/state to authorized match rooms; FE listener/UX still needs integration. Read/share/export remain available to original plan members after unmatch for their historical plan; acceptance requires an active match.

No commits, new dependencies, external calls, user messages, payments, live data resets, deployments or device actions were performed by this worker. Root owns final shared OpenAPI/contract updates, integration review and full regression verification.
