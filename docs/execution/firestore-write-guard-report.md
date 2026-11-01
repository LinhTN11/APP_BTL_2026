# Firestore own-data write guard

Date: 2026-11-01 (Asia/Saigon). Scope: BE T02.02/F03–F05, T02.03/F02, T03.01/F06, session invariant F01. Owner: BE domain. This is a security correction to the existing API contract; response DTOs and routes are unchanged.

## Change

- Profile, preferences, private location, profile media upload/order/delete, and demo selfie submission now call `requireTransactionSession` inside the same Firestore transaction as their writes. The helper reads the hashed session document and actor user document, requiring the same actor, unrevoked and unexpired session, and active account.
- Every transaction reads its required documents before issuing writes. Staged upload/selfie files are removed if the transaction rejects, including revocation, expiry, account disablement, or quota failure.
- No new dependency, schema, provider, or API route was introduced. Logout remains the session revocation operation.

## Verification

- `npm run typecheck --workspace @gap/api`: pass.
- `FIRESTORE_EMULATOR_HOST=127.0.0.1:8089 DATABASE_MODE=firestore-emulator node --import tsx --test apps/api/test/firestore-write-guard.test.ts`: 2 pass, 0 fail, 0 skip against actual Firebase Admin SDK and Firestore Emulator project `demo-app-cuoi-ky`, isolated random `test-*` namespaces. Each test deletes only its own namespace and temporary media directory.
- Real local HTTP multipart stream held open after its first bytes: logout, clock expiry, and account disablement before the final boundary each returned 401 `SESSION_EXPIRED`; profile media IDs, media document count, and media directory contents stayed unchanged.
- Each own-data write route was held immediately before its Firestore transaction, then the session document was revoked. All eight returned 401; profile, preferences, location, seeded media, selfie request count, and media files remained unchanged.

## Limits

Emulator verification does not establish Cloud Firestore connectivity or production media storage. A nonfatal Admin SDK metadata lookup warning appeared in the local test environment; both tests completed successfully. The root integrator owns the full suite and release verification.
