# Gặp — React Native API test harness

T05.01 / P01–P05; F01–F10 and basic F22. Android-first backend test UI; FE-product visual design remains unapproved. Native Community CLI 20.2.0, React Native 0.88.1, React 19.3.0; no Expo.

Install dependencies at the repository root with `npm ci`. Follow root README/runbook for API/Metro, Android SDK/JDK and emulator setup. Root scripts coordinate the demo. Workspace commands:

```powershell
npm run start --workspace @gap/mobile
npm run android --workspace @gap/mobile -- --no-packager --active-arch-only
npm run typecheck --workspace @gap/mobile
npm test --workspace @gap/mobile
npm run lint --workspace @gap/mobile
```

Initial API URL: `http://10.0.2.2:3000` for Android Emulator. Edit it on sign-in and tap **Kết nối / thử lại API**. Physical phones need the API host LAN IP and network access. Tokens use react-native-keychain (Android Keystore / iOS Keychain), never AsyncStorage. Logout tears down sockets and in-memory session data; failed server revocation is reported.

Actual API flows: demo A/B/C/D login, OTP demo, capabilities, own profile, image upload/delete/reorder, preferences, discovery, like/pass/match, chronological message pages, realtime reconnect, idempotent retry, local GIF/sticker catalog IDs, voluntary device GPS preview/consent, unmatch, block/unblock, reports and clearly labelled selfie DEMO image submission. Opaque Android glass fallback, system fonts, light/dark, 48dp controls and no decorative motion.

Demo: sign in as A and like B; logout, sign in as B and like A; open Kết nối. Use two clients to observe realtime. No automatic seed reset. Unblock does not restore an ended match. Message pages run oldest to newer; reconnect fetches all chronological pages and upserts IDs. Failed sends retain clientMessageId across chat navigation within the same session. App termination discards pending sends; check existing history before manually resending.

Android/iOS native projects are included. Android debug supports local HTTP; release cleartext remains disabled. iOS needs macOS/Xcode/CocoaPods and was not built here. This is not full 60-screen FE, native iOS Liquid Glass, video/camera capture, real provider OAuth/SMS/biometrics or production release readiness. Native device GPS/photo picker/accessibility coverage is tracked in the execution report.

Sources checked 01/11/2026: [React Native without a framework](https://reactnative.dev/docs/getting-started-without-a-framework), [Keychain](https://github.com/oblador/react-native-keychain), [Image Picker](https://github.com/react-native-image-picker/react-native-image-picker), [Geolocation](https://github.com/michalchudziak/react-native-geolocation). See docs/execution/mobile-report.md.
