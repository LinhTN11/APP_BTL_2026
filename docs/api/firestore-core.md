# Firestore core auth, profile and media

**D20 current runtime:** cloud requires demo=false and rejects seed/demo flags; fixtures only in explicit emulator lane. Real mode rejects marked demo users/sessions/targets, OTP/selfie are unavailable. Firebase SDK auth supersedes the legacy OTP flow described below. Cloud seed/QA data has been removed with snapshot under USER authorization; old seed evidence is historical. [Current API](README.md), [D20 QA](../qa/production-real-data-2026-11-02.md).

Task: D12 / P01–P02 and core F01–F06; owner BE foundation/domain. Wire contract remains [QA hiện tại](../qa/final-report.md) and the existing mobile `/v1` DTOs. This adapter uses `firebase-admin` Cloud Firestore directly; it does not mirror into SQLite or use an in-memory datastore.

## Connection and data source

`createFirestoreContext(options)` is async and returns `FirestoreContext`. It checks the selected database connection before the server listens. `ctx.close()` terminates its Firestore client and named Admin app. `ctx.database` exposes only `{provider:'firestore', mode:'cloud'|'emulator', projectId, namespace}`.

Cloud mode requires an intended `FIREBASE_PROJECT_ID` plus ADC or a local `GOOGLE_APPLICATION_CREDENTIALS` file. No project is created automatically. Credentials belong only on the backend host; never paste a service-account private key in chat, Git, `.env.example`, or the React Native bundle. Cloud setup and bounded HTTP/native evidence exist; see [cloud evidence](../qa/cloud-setup-2026-11-02.md) and [native evidence](../qa/native-cloud-2026-11-02.md).

Tests use the **actual Firestore Emulator**, explicitly selected by `DATABASE_MODE=firestore-emulator` and `FIRESTORE_EMULATOR_HOST=127.0.0.1:8089`. The project ID `demo-app-cuoi-ky` identifies this emulator lane; emulator test evidence is not cloud connection evidence. Missing cloud config never falls back to SQLite or an emulator. An explicit `emulatorHost` option is available to test factories; conflicting process host values are rejected.

Each namespace is rooted at `projects/{namespace}`. Namespace is `[a-z0-9-]{1,48}`. Root factory owns HTTP/socket lifetime and assigns `ctx.io`; registration helpers do not import the app factory. Direct client Firestore access must remain denied; Admin SDK authority is exercised only through backend authentication and ownership checks.

## Collections

| Collection | Document key | Stored data / invariant |
|---|---|---|
| `users` | UUID | Account status, phone if demo OTP created, creation ISO time |
| `profiles` | User UUID | Camel-case profile fields, visibility, ordered `mediaIds`, optional demo verification summary |
| `preferences` | User UUID | Gender/age/radius and optional advanced filters |
| `locations` | User UUID | Private consented latitude/longitude and update ISO time; delete revokes |
| `sessions` | SHA-256(raw token) | User UUID, numeric expiry/revocation; raw token never stored |
| `otpChallenges` | UUID | Normalized phone, challenge-specific code hash, attempts, numeric expiry and consumption |
| `otpRates` | SHA-256(phone) | Last 15-minute request timestamps, maximum five accepted requests |
| `firebaseIdentities` | SHA-256(firebase UID key) | Stable Firebase UID to user; no auto email link |
| Legacy identities | Existing document keys | Previous custom email/Google data retained only; no implicit migration |
| `phoneIdentities` | SHA-256(phone) | Unique phone-to-user link serialized by a document transaction |
| `media` | Media UUID | Owner, profile scope, controlled filesystem key, MIME, position; no media bytes |
| `verificationRequests` | UUID | Private selfie filesystem key, owner, pending/demo status; no public content route |
| `demoAccounts` | A/B/C/D | Explicit seeded account allowlist |
| `seedMarkers` | `core-A` etc. | Prevent deleted/edited fixtures being reset by later seed runs |

Firestore documents use ISO strings for wire dates and numeric milliseconds for expiry windows. Public DTOs contain no raw Timestamp objects, phone, full birth date or precise stored location. Own profile exposes the birth date; age is computed against server UTC date. Advanced nullable fields preserve canonical validation. Unknown fields, invalid enums, invalid dates and under-18 dates are rejected.

## Auth and transaction rules

`authenticate(ctx, token)` resolves to `{userId,sessionKey,expiresAt}`; `sessionKey` is the token hash. The root HTTP hook binds `req.actor` and `req.sessionId` from this result. Expired/revoked sessions and inactive users are rejected. Logout persists revocation and disconnects matching local sockets.

OTP request/verification is explicitly `mode:'demo'`, available only with demo mode; it sends no SMS and proves no real-world phone ownership. Live SMS remains unavailable. Product UI uses [Google Sign-In](../google-sign-in.md); the real implementation requires a configured Web OAuth client and Android package/SHA-1, and live account verification remains pending. OTP/demo sessions are test tooling only. Each challenge lasts at most five minutes and permits five wrong attempts. Wrong-attempt increments are committed before returning `OTP_INVALID`. A successful verify atomically consumes the challenge, creates/links the unique phone identity, creates the user/profile/preferences if needed, and creates a hashed session. Separate challenges for the same phone converge to one identity; concurrent verifies of one challenge have one winner. Request limits persist in Firestore.

Transactions read every relevant document before writing. Retry callbacks have no filesystem/socket side effects. This follows the [Firestore transaction requirements](https://firebase.google.com/docs/firestore/manage-data/transactions). Emulator routing follows the [Admin SDK emulator configuration](https://firebase.google.com/docs/emulator-suite/connect_firestore#admin_sdks).

## Media policy and seed

Media bytes are **backend filesystem storage**, not Firebase Storage or cloud Firestore storage. Firestore holds metadata only. The authenticated `/v1/media/:id/content` handler validates owner/public visibility, current account/profile completeness, blocks and ended matches, then streams a controlled basename with `private, no-store`. Selfies have no public media document or content endpoint and remain pending demo; no verified badge is issued.

Uploads accept one multipart `file`: JPEG/PNG/WebP signature and declared MIME must agree, maximum 10 MB. Video is explicitly unsupported until duration validation exists. The profile document's `mediaIds` is the shared transaction lock for upload quota, reorder and deletion. Two uploads at eight images can add only one ninth image. A file created before a failed database write is removed. Storage keys never use client filenames. Reorder requires exactly the owner's current IDs and deletion compacts positions.

`seedFirestoreDemo(ctx)` requires demo mode and must be requested explicitly (`seedDemo:true` or the seed command). Stable fictional A–D UUIDs and synthetic local geometric PNG avatars preserve existing demo/mobile DTOs. First creation uses create-only transactions; repeated seed does not replace edits, deleted media, account status or interaction state. Existing namespace data is not reset. A missing local seed file may be recreated only when its existing metadata still identifies the same seed asset.

## Verification lane

`GET /v1/me/location` dùng actor của session, trả `{data:{hasLocation:boolean,updatedAt:string|null}}`. Vị trí chưa có/đã thu hồi/không consent trả `false,null`; vị trí consent trả thời gian server đã lưu theo định dạng ISO UTC chuẩn do PUT tạo (`YYYY-MM-DDTHH:mm:ss.sssZ`), không tạo timestamp mới khi đọc. Giá trị legacy thiếu/sai định dạng hoặc ngày không hợp lệ trả `updatedAt:null`. Response không chứa tọa độ, userId hoặc trạng thái của người khác. PUT/DELETE vẫn yêu cầu thao tác chủ động và consent hiện có. Khám phá áp dụng radius khi cả hai có vị trí consent; hai vị trí ngoài radius hợp lệ có thể trả danh sách rỗng dù hồ sơ đầy đủ.

Discovery/public profile policy hiện hành: account active, public, đủ 18 tuổi, tên và bio sau trim không trống, có media hồ sơ. Tạo tài khoản Firebase chưa đủ để được gợi ý; phải lưu giới thiệu và thêm ảnh. GPS là tùy chọn: thiếu vị trí không loại toàn bộ hồ sơ, máy chủ trả trạng thái bán kính trong meta; bộ lọc tuổi/giới tính, swipe, block và match vẫn áp dụng. D21 thêm hướng dẫn UI và regression, không thay policy hay dữ liệu thật.

Run only against an explicit emulator with ephemeral namespaces:

```powershell
$env:DATABASE_MODE='firestore-emulator'
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8089'
$env:FIREBASE_PROJECT_ID='demo-app-cuoi-ky'
node --import tsx --test apps/api/test/firestore-auth-profile.test.ts
npm run typecheck --workspace @gap/api
```

The test file clearly skips without an emulator host; a skipped run is not acceptance. Tests create random namespaces and remove only their own namespace, never a cloud database. Current evidence and remaining limitations are in [QA hiện tại](../qa/final-report.md).

D17 current auth uses [Firebase SDK exchange](../firebase-auth.md). Earlier OTP/custom-identity descriptions remain test/history; product password handling belongs to Firebase, not this API.
