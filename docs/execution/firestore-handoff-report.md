# Firestore handoff and verification report

Date: 01/11/2026 (Asia/Saigon). Scope: docs-only reconciliation of API README, BE→FE handoff and QA evidence to D12. No source, tests, other docs, commits or cloud resources changed by this report.

## Active backend and handoff

- Active server factory: `createFirestoreApp` at `apps/api/src/firestore/app.ts`; shared database context/services and domain routes are in `apps/api/src/firestore/`. The active mode uses async Firebase Admin SDK and Firestore transactions. Data is rooted at `projects/{namespace}` and queries use declared indexes; current domain APIs are described in [core](../api/firestore-core.md) and [interaction](../api/firestore-interaction.md).
- Cloud mode requires `DATABASE_MODE=firestore`, `FIREBASE_PROJECT_ID`, and backend-only ADC or `GOOGLE_APPLICATION_CREDENTIALS`. Missing config fails; no automatic SQLite or emulator fallback. Emulator is selected explicitly with `DATABASE_MODE=firestore-emulator` and is test evidence only.
- Handoff commands follow the root manifest: `npm ci`, `npm run firestore:check`, `npm run firestore:seed`, `npm run demo`. FE receives only the API URL and never receives Admin credentials. Rules deny direct client access. Composite indexes and deny-all rules must be deployed only to the confirmed new Firebase project.
- Local media bytes remain on protected backend filesystem. No Google auth/OAuth provider, real SMS, AI provider, live video, biometric backend or Cloud Storage claim; provider credentials are not present.
- Existing SQLite core and P06–P10 SQL extensions are historical/local reference, not active cloud implementation. Advanced modules are not ported or feature-complete in Firestore.

## Evidence and limits

- Firestore Admin SDK integration ran against explicit emulator `127.0.0.1:8089`, project label `demo-app-cuoi-ky`, with random test namespaces: core suite 6/6 and interaction suite 4/4, total **10 passed, 0 failed, 0 skipped**, about 55 seconds. Integrated HTTP smoke against the emulator passed.
- No Firebase project or cloud credential exists yet. No real cloud read/write, IAM/index deployment, cloud HTTP smoke or cloud native test was performed.
- API README records the active `createFirestoreApp` API and preserves the old SQLite report as historical evidence. Wire DTOs remain the shared API contract; the root integrator is updating the OpenAPI health schema for safe Firestore provider/mode/project/namespace fields.
- QA still has two config/write-guard review fixes awaiting final verification. Native Firestore QA is in progress and is not recorded as passing.
- Prior SQLite/API and mobile evidence (API 6 then 7 tests; mobile 15 then 19 tests), plus native JDK 21/SDK 37/Community CLI build and auto-install, remain attributed to their respective runs; they do not prove current Firestore behavior. See [QA summary](../qa/verification.md).

