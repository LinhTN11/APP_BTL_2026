# Backend config fix report

Date: 2026-11-01 (Asia/Saigon)

## Changes

- `apps/api/src/server.ts` now binds to `process.env.HOST`, defaulting to `0.0.0.0`; `PORT` behavior is unchanged.
- `apps/api/src/db/database.ts` always creates `dataDir/media` during database setup, independently of demo seeding.
- `apps/api/test/config.test.ts` verifies that non-demo setup creates the media directory and leaves the users table empty.

## Verification

- `npm run typecheck --workspace @gap/api` — passed.
- `npm test --workspace @gap/api` — passed, 7 tests including the new non-demo setup case.

Scope: local backend changes only. No database schema or seed behavior was changed.
