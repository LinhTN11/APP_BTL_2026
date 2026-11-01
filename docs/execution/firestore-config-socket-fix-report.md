# Firestore config and socket disconnect fix

Date: 01/11/2026 (Asia/Saigon). Scope: bounded Firestore configuration and chat socket fixes.

## Changes

- `createFirestoreContext` now accepts only `DATABASE_MODE=firestore` or `firestore-emulator` when the variable is set. Explicit emulator mode requires a loopback host and valid port. Explicit cloud mode rejects emulator hosts from both environment and options. With mode unset, a test factory can still select the emulator through `options.emulatorHost`; an environment-only emulator host is rejected.
- A configured `GOOGLE_APPLICATION_CREDENTIALS` path is checked for readability before creating an Admin SDK app. A missing file fails with a local configuration error before SDK initialization or credential lookup. Project and namespace validation remain ahead of SDK setup.
- Socket `match:subscribe` checks `closed` and `socket.connected` after each awaited match check and room join. It leaves the room and returns without creating a Firestore listener or acknowledging success if the client disconnects during those waits. Error handling also avoids acknowledging a disconnected socket.
- The existing bounded socket-pruning sweep already catches errors and its close hook waits for an in-flight sweep; it needed no change.

## Verification

- Formatted the changed TypeScript files with the repository's `node_modules/.bin/prettier`.
- `node --import tsx --test apps/api/test/firestore-config.test.ts` with `DATABASE_MODE=firestore-emulator` and `FIRESTORE_EMULATOR_HOST=127.0.0.1:8089`: **3 passed, 0 failed, 0 skipped**. Cases cover invalid/unsafe mode combinations with unchanged Firebase Admin app inventory, an absent credential file with unchanged app inventory, and a real Admin SDK connection to the configured emulator when mode is unset and `options.emulatorHost` is explicit.
- `npm run typecheck --workspace @gap/api`: **passed**.
- The emulator run emitted a local `MetadataLookupWarning` before the real emulator connection succeeded. No cloud project or cloud request was used.
- Reviewed existing interaction tests: they cover unauthorized subscriptions, active subscriptions, match ending, and socket disconnect/logout. They do not hold an SDK-backed `match:subscribe` await open while disconnecting, so this race has no dedicated timing regression test; the implementation now rechecks after both match reads and the room join.

## Limits

This task did not run the full API suite, Android/Gradle builds, or device QA. No native files changed; Android/iOS build and device behavior remain unverified here. Firestore cloud credentials, IAM, indexes, and live cloud behavior remain unverified.
