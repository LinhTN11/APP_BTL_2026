# Bàn giao BE → FE (core P01–P05)

Cập nhật 01/11/2026. Đây là UI-test cho BE; visual FE-product vẫn là bản nháp, chưa có prototype được người dùng chốt. Phạm vi này không đồng nghĩa hoàn thành roadmap 37 chức năng.

## Chạy backend cloud

BE tạo Firebase project riêng và cấu hình quyền Admin SDK trên máy chạy backend theo [runbook Firestore](../12-ket-noi-firestore.md). Project ID và namespace không phải secret; Admin credentials chỉ nằm trên máy BE. Chỉ deploy client rules (deny all) và composite indexes vào project mới đã xác nhận. Project/credentials hiện chưa được cấp nên chưa có cloud connection proof.

Trong `.env.local` tại root (không commit):

```dotenv
DATABASE_MODE=firestore
FIREBASE_PROJECT_ID=project-id-cua-nhom
FIRESTORE_NAMESPACE=app-cuoi-ky
GOOGLE_APPLICATION_CREDENTIALS=C:/duong-dan-tuyet-doi/secrets/firebase-service-account.json
DEMO_MODE=true
HOST=0.0.0.0
PORT=3000
```

ADC có thể thay `GOOGLE_APPLICATION_CREDENTIALS` nếu được cấu hình rõ trên máy BE. Không đặt `FIRESTORE_EMULATOR_HOST` ở cloud mode. Thiếu project/config hoặc quyền phải hiển thị lỗi; app không tự chuyển SQLite hay emulator.

```powershell
npm ci
npm run firestore:check
npm run firestore:seed
npm run demo
```

`firestore:check` là probe kết nối/quyền đọc; `firestore:seed` là lệnh ghi fixture A/B/C/D có chủ ý, create-if-absent, không reset dữ liệu. `demo` dùng Firestore cloud mode. Chỉ chạy các lệnh ghi sau khi BE xác nhận đúng project/namespace. Client rules và composite indexes phải được triển khai vào đúng project mới; xem runbook.

## Chạy app FE

FE chỉ cần API URL và React Native Community CLI; **không cần Firebase project ID, service-account file hay Admin key**. Cấu hình URL tới backend dùng chung theo LAN/USB/emulator bên dưới. FE không kết nối Firestore trực tiếp.

## Runtime

Yêu cầu Node 24.15.x, npm 11+, JDK 21 (đã dùng khi build), Android SDK/ADB và emulator hoặc thiết bị Android. React Native Community CLI 20.2.0, React Native 0.88.1, React 19.3.0; **không dùng Expo/Expo Go**.

```powershell
npm run doctor
```

Yêu cầu Node 24.15.x, npm 11+, JDK 21 (đã dùng khi build), Android SDK/ADB và emulator hoặc thiết bị Android. React Native Community CLI 20.2.0, React Native 0.88.1, React 19.3.0; **không dùng Expo/Expo Go**. Trên máy BE đã cấu hình cloud, giữ terminal `npm run demo` chạy; lệnh khởi động API và Metro. Cài/chạy app ở terminal khác:

```powershell
npm run android
```

Trên Android emulator mặc định, API origin là `http://10.0.2.2:3000`; Metro dùng cổng 8081. Với thiết bị USB, thay `<serial>` bằng ID từ `adb devices -l`, rồi chạy:

```powershell
adb -s <serial> reverse tcp:3000 tcp:3000
adb -s <serial> reverse tcp:8081 tcp:8081
```

Khi dùng USB, nhập `http://127.0.0.1:3000` trong ô URL API trên màn đăng nhập. Trên máy thật qua Wi-Fi, nhập `http://<LAN-IP-máy-chạy-API>:3000` và đảm bảo Metro truy cập được qua 8081. `localhost` trên điện thoại là chính điện thoại. Không ghi token/secret vào bug report.

`npm run setup` chuẩn bị runtime thủ công; `npm run dev` bật demo không tự mở Android; `npm run dev:api` và `npm run dev:mobile` chạy riêng API/Metro. `npm run test:firestore` chạy emulator suite, không phải cloud proof. `npm run demo:emulator` và `npm run smoke:demo` chọn emulator rõ ràng, không được gọi là cloud. Các lệnh kiểm tra riêng gồm `npm run typecheck`, `npm run lint`, `npm run test:mobile`; `npm run verify` gom các lệnh typecheck/lint/tests theo manifest hiện tại.

## Phiên demo và luồng kiểm tra

Trong `DEMO_MODE=true`, đăng nhập bằng A/B/C/D ở danh sách app. Tài khoản là fixture hư cấu; không có mật khẩu hoặc token dùng chung. A và B chưa match sẵn: đăng nhập A và like B, sau đó đăng nhập B và like A. A refresh danh sách match rồi mở chat. C dùng để kiểm tra không thể đọc/gửi/subscribe chat A–B; D thuộc fixture cặp riêng C–D. OTP demo không gửi SMS và không chứng minh quyền sở hữu số điện thoại.

**Luồng đã được kiểm tra tích hợp trên Android theo evidence hiện có:** A đăng nhập, xem discovery/media, like; B like lại qua API để tạo mutual match; A refresh match và mở chat. Luôn ghi backend/mode cùng kết quả; emulator Firestore không chứng minh cloud. Native gửi tin và keyboard/resize đang **đang xác thực**, chưa được tính pass.

## Contract cần giữ

- Thành công trả HTTP 200 kể cả tạo mới: `{data: ...}`; phân trang có thể thêm `{meta:{nextCursor}}`.
- Lỗi: `{error:{code,message,requestId,fieldErrors?}}`. Giữ `requestId`, status và body đã bỏ thông tin nhạy cảm khi báo lỗi. Các status thường gặp: 400 validation, 401 session, 403 quyền, 404 không tồn tại/không tiết lộ, 409 conflict, 413 dung lượng, 422 nghiệp vụ, 429 rate limit, 503 provider unavailable.
- `GET /v1/matches/:id/messages` trả lịch sử **cũ trước, mới sau** theo `(createdAt,id)`. Theo `nextCursor` tới khi `null`; refresh cuối danh sách bằng cách tải lại và upsert theo message `id`.
- Gửi tin qua REST với `clientMessageId` UUID. Retry cùng ID và nội dung trả lại message cũ; đổi nội dung với cùng ID nhận 409. Socket chỉ nhận event `message:created`; reconnect phải tải REST. `match:ended` có reason `blocked|unmatched` và kết thúc chat.
- Enum hợp đồng: gender `female|male|other`; datingGoal `relationship|friendship|casual|unsure`; lifestyle frequency `never|sometimes|often|prefer_not_to_say`; message kind `text|gif|sticker|location`; provider mode `real|demo|unavailable`; verification demo `not_submitted|pending`.
- Profile gồm `displayName`, `dateOfBirth` (riêng tư, không có trong public profile), `age`, `gender`, `bio`, `datingGoal`, `interests`, `lifestyle`, `media`, verification. Preferences: `genders`, `minAge`, `maxAge`, `radiusKm`. Message gồm `id`, `matchId`, `senderId`, `clientMessageId`, `kind`, `text?`, `payload?`, `createdAt`.
- GIF/sticker hiện là nhãn catalog local, không có animation/provider ngoài. Selfie chỉ ở trạng thái pending/demo, không cấp verified badge. Video upload chưa khả dụng. Location chỉ chia sẻ tọa độ tự nguyện của người gửi. Không có Google/OAuth integration.

OpenAPI canonical: [docs/api/openapi.yaml](../api/openapi.yaml); hướng dẫn: [API README](../api/README.md), [Firestore core](../api/firestore-core.md), [Firestore interaction](../api/firestore-interaction.md). Root đang cập nhật health schema; trước thay đổi breaking, đồng bộ OpenAPI/DTO và ghi chú ở đây.

## Bản đồ màn hình

| Màn hình | File |
|---|---|
| Đăng nhập, chọn demo account, API URL/capabilities | `apps/mobile/src/screens/Login.tsx` |
| Discovery, like/pass, danh sách match | `apps/mobile/src/screens/Discover.tsx` |
| Sửa hồ sơ, ảnh, location, selfie demo | `apps/mobile/src/screens/MyProfile.tsx` |
| Chat, REST/socket, catalog, chia sẻ location | `apps/mobile/src/screens/Chat.tsx` |
| Block, unmatch, report | `apps/mobile/src/screens/Safety.tsx` |
| API/error/URL/media client | `apps/mobile/src/api.ts` |
| Session và credential thiết bị | `apps/mobile/src/session.ts` |
| UI primitives/theme | `apps/mobile/src/ui.tsx` |

## Báo lỗi và trạng thái xác nhận

Gửi bước tái hiện, account A/B/C/D, thiết bị/API mode, expected/actual, thời điểm, `requestId`, HTTP status/body đã bỏ token/số riêng tư và ảnh/quay màn nếu hữu ích. Không gửi session token, OTP, ảnh riêng tư hoặc dữ liệu người thật. Ghi native/keyboard/profile race là đang xác minh cho tới khi có kết quả tái hiện và sửa.

Backend report và mobile report lưu evidence worker lịch sử; xem tổng hợp trạng thái hiện tại, phân biệt SQLite cũ/emulator Firestore/cloud và build/device tại [QA verification](../qa/verification.md). Chưa có API freeze tuyệt đối; phối hợp trước khi FE phụ thuộc vào thay đổi contract.
