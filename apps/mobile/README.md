# Gặp — React Native API client

T05.01 / P01–P05; F01–F10 and basic F22. Android-first core API UI; visual design remains an unapproved proposal. React Native Community CLI 20.2.0, React Native 0.88.1 and React 19.3.0; no Expo.

Install dependencies with `npm ci` at the repository root. Follow the root README/runbook for API, Metro, Android SDK/JDK and emulator setup.

```powershell
npm run start --workspace @gap/mobile
npm run android --workspace @gap/mobile -- --no-packager --active-arch-only
npm run typecheck --workspace @gap/mobile
npm test --workspace @gap/mobile
npm run lint --workspace @gap/mobile
```

Google and email sign-in use Firebase Authentication, then exchange the ID token for an opaque backend session. See `docs/firebase-auth.md` and `docs/google-sign-in.md`. No OTP, predefined account, selfie or GIF fixtures are available in the runtime UI. A new account starts with server-owned profile data and empty discovery, connections or messages when the API returns empty lists. No data is automatically seeded or reset.

API endpoint configuration and Android debug/release networking are documented in the root README. Android emulator development normally uses `http://10.0.2.2:3000`; physical devices need a reachable API host. Release requires an explicitly configured HTTPS endpoint. Tokens use react-native-keychain (Android Keystore / iOS Keychain), never AsyncStorage. The existing Keychain service identifier is retained for session compatibility. Logout tears down sockets and in-memory account data; failed server revocation is reported.

Core flows call the API: own profile, image upload/delete/reorder, preferences, discovery, like/pass/match, message history, voluntary GPS preview/consent, unmatch, block/unblock and reports. Loading and errors remain distinct from successful empty reads. Profile, preferences and safety lists refresh on screen mount and foreground; dirty profile/filter input is preserved. Profile GET/PATCH responses update the displayed account name. These collections are REST reads, not Firestore client subscriptions.

Chat history is fetched oldest to newer; reconnect resyncs chronological REST pages and merges IDs. Failed sends retain the same clientMessageId for retry within the session, including chat navigation. App termination discards pending sends; inspect server history before manually sending again. Block/unmatch ends access; unblock does not restore an ended match. Use two real accounts/clients to verify mutual matching and realtime delivery. Provider sign-in requires its actual configured native environment and may need user interaction with the account chooser.

Android/iOS native projects are included. iOS requires macOS/Xcode/CocoaPods and remains unverified here. This is core UI, not full 60-screen FE or proof of production release readiness. Visual, accessibility and native device coverage remain documented in `docs/qa/`.
