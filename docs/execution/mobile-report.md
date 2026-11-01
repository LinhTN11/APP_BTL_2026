# Mobile worker — T05.01 / FE-test

Date: 01/11/2026. Scope P01–P05; F01/F02 demo/F03–F10/basic F22. Owner FE-test worker; integrator owns native/demo evidence. Read AGENTS, docs README/UI/API/deadline/decisions/subagent rules and core-brief; inspected prototype. D10/D11 authorize RN CLI UI-test; FE-product visual remains unapproved. No root manifest/lock/scripts/backend/contracts edits, worker commits/push/deploy or external messages.

## Implementation

- RN 0.88.1 / React 19.3.0 / CommunityCLI 20.2.0 pinned. Current stable registry version matches installed SDK37/buildtools37/NDK27.1.12297006 and Node24.15/JDK21. Root performed unified npm install. Hoisted Gradle/Metro paths configured; Android/iOS scaffold retained. No Expo.
- App orchestrates session restore/logout/expiry, navigation and Socket.IO. Shared UI/theme and separate Login/Discover/MyProfile/Chat/Safety modules. Typed API client supports envelopes, structured errors, 401 and 15s timeout. Session uses device-only Keychain/Keystore with serialized mutations. Old-session 401 cannot expire another account.
- Editable API origin defaults 10.0.2.2:3000; actual capabilities/modes/reasons and server demo-account list. OTP request/verify shows demo code only if returned. No provider success invented.
- Own profile read/edit, 18+ server validation, enum hints, image picker multipart upload/delete/reorder/quota; DEMO selfie image submission/status. Unsaved profile back/tab/reload confirmation. No video or dedicated camera UI.
- Discovery/preferences and server radius reason; fictional authenticated profile images; like/pass/matches; loading/error/retry/empty. No fabricated distances.
- REST send, ascending chronological message cursor pages, socket auth/membership ack/events. Reconnect fetches every page, duplicate events upsert by ID. New matches subscribe. Ended-room reducer removes message/draft state and rejects late events. Failed clientMessageId survives chat navigation within session. New typing is not cleared by an older request completion.
- Local GIF/sticker catalog ID selection and label rendering, no external GIF provider. Native GPS permission then explicit coordinates/recipient consent before one-time private store/share. Block/unmatch confirmation, report receipt, blocklist/unblock. No automatic ban or rescue promise.
- System fonts, flexible scroll forms, 48dp controls, accessibility role/state/error region, light/dark, opaque Android glass fallback. No decorative motion. Android adjustResize/hardware back wired. Full accessibility/FE visual acceptance not claimed.

## Worker verification

Executed from apps/mobile after module extraction and behavior edits: `npm run typecheck`, `npm test`, `npm run lint` all PASS; lint 0 errors/0 warnings. Jest 2 suites/15 tests: API auth DTO/all 2xx; authenticated 401 vs anonymous; remote media cannot receive bearer; URL origin validation; multi-page reconnect/cursor loop; duplicate upsert; old-session stale completion; ended-room tombstone; UUID retry ID; Keychain device-only save/restore/invalid+expired clear/logout service. No vacuous snapshot/render test.

Parent reports Android debug assemble success 3m21s and native emulator A login/discovery rendering from real API/media. Worker did not start competing Gradle. Integrator must refer to parent build/native evidence; this report is not independent native proof. iOS not built on Windows.

## Limits and follow-up

Parent owns remaining native flows/two-client QA, integrated supervisor and handoff. Device photo-picker/upload, real GPS permission grant/denial, keyboard/font200%/TalkBack and two native clients not independently exercised by worker. No iOS/release signing, OAuth/SMS/live selfie/biometrics, advanced phases/full S01–S60 claim. GIF/sticker are local catalog labels rather than rich animation.

Session restore verifies /v1/me and reports offline failure. Offline logout cannot guarantee server revocation and states so. Pending send IDs are memory-only, lost after app termination; check history before manual resend. Worker notified parent at source freeze: ended reducer clears chat/draft but Workspace pending-retry map retains inaccessible pending body until logout; root should also delete pending[matchId] inside ended callback. No source edit after freeze to conflict with independent reviewer.

Sources checked: [RN CLI](https://reactnative.dev/docs/getting-started-without-a-framework), [Keychain](https://github.com/oblador/react-native-keychain), [Image Picker](https://github.com/react-native-image-picker/react-native-image-picker), [Geolocation](https://github.com/michalchudziak/react-native-geolocation).
