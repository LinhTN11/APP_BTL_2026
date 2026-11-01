# D12 — Firestore auth/profile/media worker report

Date: 01/11/2026, Asia/Saigon. Scope: P01–P02 / core F01–F06, BE foundation/domain. Files owned: `apps/api/src/firestore/{context,auth,profiles,media,seed,schemas}.ts`, `apps/api/test/firestore-auth-profile.test.ts`, `docs/api/firestore-core.md`, this report. No app factory/server/package/lock/SQL files were edited by this worker.

Implemented direct async Firebase Admin SDK persistence for sessions, OTP challenges/rates/phone identity uniqueness, profiles/preferences/private consented location, media metadata and private pending-demo selfies. Explicit opt-in seed creates stable fictional A–D accounts and original local PNG avatars without resetting edits/deleted media. Firestore context verifies the connection before ready, exposes mode/project/namespace, and closes SDK/Admin handles. Existing core HTTP/mobile DTOs are preserved.

Actual data source tested: **Firestore Emulator** at `127.0.0.1:8089`, Firebase project identifier `demo-app-cuoi-ky`, random test namespaces. This is a real Admin SDK database integration test, not a mock datastore and not a cloud connection test. No cloud project or cloud credential was supplied; no project was created and no cloud writes were attempted. Media bytes remain on the protected backend filesystem; only metadata is in Firestore. SMS OTP and selfie evaluation remain labeled demo; no social provider or verified identity is claimed.

Verification on the actual emulator:

- `node --import tsx --test apps/api/test/firestore-auth-profile.test.ts` with explicit emulator environment: **6 tests passed, 0 failed, 0 skipped**, 29.7 seconds on the final full run after added expiry/size/block assertions.
- API TypeScript check passed after all implementation modules/test code existed; root then continued independent integration changes. Root should rerun its final combined checks before handoff.
- Covered hashed-token storage, logout and session expiry; demo-mode gate; persisted wrong OTP attempts and lockout, OTP expiry, replay, same-challenge race; separate challenge/phone identity races; persistent per-phone request throttling; private DOB/location; profile enum/null/unknown/date validation; preferences validation; authenticated image access and owner-only edits, MIME/signature and 10 MB limit; private selfie access denial; concurrent ninth-image quota, failed-upload file cleanup, ordering/deletion; blocked profile image denial; idempotent seed and restart retaining profile edit, deleted media and session.

The SDK printed a metadata lookup warning in this local environment before connecting; all tests then completed and no test handles remained open. Root's interaction suite separately owns match/chat/socket membership and cross-instance race evidence. Real cloud ADC/IAM/index behavior, provider calls, cloud file storage and production scaling remain unverified. Configuration must be supplied before cloud acceptance; emulator success must not be relabeled as cloud verification.

Primary references checked: [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), [Admin SDK emulator routing](https://firebase.google.com/docs/emulator-suite/connect_firestore#admin_sdks).
