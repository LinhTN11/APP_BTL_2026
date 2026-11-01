# Mobile bounded fixes — T05.01 / FE-test

01/11/2026. F03–F05 profile editing, F07 discovery, F09 chat, F22 block/unmatch. Owner: mobile worker; integrator owns native emulator evidence. Scope remains P01–P05 UI-test, not visual FE-product approval. No dependencies, Gradle, API contract, external provider, commit, push or deploy changes.

## Causes and changes

- Android chat composer was beneath the IME in integrator's `docs/qa/native-chat.png`. App set `KeyboardAvoidingView.behavior` to undefined on Android, leaving RN layout unchanged with target36 edge-to-edge. Installed RN0.88.1 implementation supports explicit Android `height`, listens to keyboard events and subtracts measured overlap. App now selects Android `height` and iOS `padding`. Native keyboard layout acceptance belongs to integrator's follow-up; worker did not operate emulator or send the prepared draft.
- Profile save replaces the form with its server response and clears dirty. Editing during its request therefore lost newer text. Shared `Field` now exposes `editable` (default true); all nine profile fields become noneditable while profile task is busy. Auth fields keep their default behavior.
- Discovery swipe and block had independent task locks and both removed array index zero. A delayed B block confirmation after passing B consequently removed C. Discovery and its safety actions now share the same synchronous task lock; completions filter the captured user ID. Safety component is keyed by profile ID so report text/errors do not transfer to the next target.
- Workspace held pending retry bodies outside the ended-room reducer. Retry state now lives in `chatReducer`, is deleted with draft/history on `ended`, and uses the existing tombstone/session guard to reject delayed state updates after revocation or account switch. Other match retries remain intact.

## Verification

From `apps/mobile`: `npm run typecheck` PASS; `npm run lint` PASS (0 errors/warnings); `npm test` PASS, 3 suites / 19 tests; `git diff --check` PASS for edited app source/tests.

Four added regressions first failed against previous behavior, then passed: deferred profile save locks fields and restores editability after response; block and queued Like serialize under one lock; old B block confirmation does not remove C; ended match removes its retry and rejects a late retry update while preserving another match and clearing on session switch. Tests render actual screen components through existing React test renderer and use deferred API promises, with no source-pattern assertions or snapshots.

Edited: `apps/mobile/App.tsx`, `src/ui.tsx`, `src/chat.ts`, `src/screens/{Chat,MyProfile,Discover,Safety}.tsx`, `__tests__/{client.test.ts,screens.test.tsx}` and this report. Existing `apps/mobile/README.md` changes were left untouched.

## Limits

Worker did not rebuild native binaries, operate emulator, exercise iOS, TalkBack or font200%. Android keyboard change requires integrator native recheck and should not be called independently device-verified from this report. No API/DTO changes or additional feature scope.
