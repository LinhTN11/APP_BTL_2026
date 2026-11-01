# Runbook đích: chạy demo và bàn giao cho FE

**D12 (USER) chọn Cloud Firestore làm DB chính; core P01–P05 đang port từ SQL reference qua Admin SDK. Chưa có Firebase project/credentials nên chưa xác nhận cloud read/write hay test/build dưới cloud.** React Native Community CLI (D10), Fastify giữ nguyên. Các lệnh bên dưới là giao diện bàn giao đích; đối chiếu scripts và evidence trước khi báo chạy thành công. UI-test BE được phép triển khai, FE-product chưa được duyệt visual.

## 1. Chuẩn bị tối thiểu

- Git, Node 24.15.0 + npm 11.3.0 theo runtime đã ghi; RN 0.88 / Community CLI 20.2 và native dependencies theo lockfile/evidence đã kiểm; không đoán phiên bản khác.
- JDK 21; Android Studio/SDK Command-line Tools, Android platform/build tools đúng cấu hình `apps/mobile/android`, Platform Tools (`adb`); chấp nhận SDK licenses. `JAVA_HOME`, `ANDROID_HOME` và PATH phải trỏ công cụ đã cài.
- Emulator Android đang chạy **hoặc** điện thoại USB debugging đã bật và xác nhận khóa RSA. `adb devices -l` phải hiện `device`, không phải `unauthorized/offline`. Nhiều máy cần chọn serial rõ ràng.
- Internet cho npm/Gradle/Maven/SDK lần đầu; BE cần project riêng và ADC/credential hợp lệ theo [12 — Firestore](12-ket-noi-firestore.md); FE chỉ cần API URL của BE, không cần Admin key. First native build có thể lâu và cần dung lượng SDK/cache.
- Android là gate trên Windows; iOS native build cần macOS/Xcode/CocoaPods riêng. Không dùng Expo Go, QR launch hoặc Expo development build.

## 2. Chạy API, Metro và native Android

```powershell
npm ci
npm run firestore:check
npm run firestore:seed
npm run demo
```

`demo` chọn cloud Firestore và bật API 3000 + Metro 8081 sau kiểm cấu hình; thiếu project/credential phải dừng có hướng dẫn trước listen, không tự fallback SQL/emulator. Cần `DATABASE_MODE=firestore`, `FIREBASE_PROJECT_ID`, ADC hoặc `GOOGLE_APPLICATION_CREDENTIALS` local phía BE; cloud không đặt `FIRESTORE_EMULATOR_HOST`. `firestore:check` chỉ đọc, `firestore:seed` chỉ gọi rõ và create-if-absent, không reset/đè dữ liệu cũ. Các script đang tích hợp; đối chiếu package/evidence, không suy ra pass từ đoạn lệnh này. Để terminal này chạy; terminal khác build/install app:

```powershell
npm run android
```

Script Android cần gọi Community CLI/Gradle theo workspace; trong `apps/mobile`, lệnh tương đương là `npm run android`. Với nhiều thiết bị chọn serial qua option mà CLI bản khóa hỗ trợ, hoặc dùng `adb -s <serial> install` cho APK debug đã build. Không giả định build/install thành công chỉ vì Metro đã mở.

`demo` phải in API URL theo mode, Metro URL/port, database provider/mode/project ID/namespace và provider modes, chỉ dẫn build/install và Ctrl+C dừng process do script tạo; không log token/secret.

| Kết nối | API URL trên Android | Metro/debug |
|---|---|---|
| Android emulator chuẩn | `http://10.0.2.2:3000` | Host Metro 8081 theo RN debug config |
| USB qua adb reverse | `http://127.0.0.1:3000` | Reverse cả 3000 và 8081 cho đúng serial |
| LAN cùng Wi-Fi riêng | `http://<LAN-IP>:3000` | Dev server host `<LAN-IP>:8081`; mạng không cách ly client |

USB, chạy cho từng client cần test:

```powershell
adb devices -l
adb -s <serial> reverse tcp:3000 tcp:3000
adb -s <serial> reverse tcp:8081 tcp:8081
adb -s <serial> reverse --list
```

Thay `<serial>` bằng ID thật, không gõ nguyên placeholder. API bind địa chỉ cho mode kết nối cần thiết. API URL chọn bằng config local do scripts/mobile cung cấp; tên biến chính xác phải theo implementation và handoff, không sửa IP trong source. API URL/config mobile là public trong bundle; provider secret chỉ ở server. Metro không tunnel backend.

Native module mới phải build/install lại. Keychain, Image Picker và Geolocation cần native linking/manifest/runtime permissions phù hợp bản khóa. HTTP cleartext chỉ bật debug trong mạng tin cậy; release/internet cần HTTPS. Không tự mở firewall, tải SDK hệ thống hoặc sửa cấu hình máy ngoài scope đã cho phép.

## 3. Script bàn giao

| Script đích | Vai trò | Điều kiện đạt |
|---|---|---|
| `npm run doctor` | Node, JDK/SDK/adb, writable data, API 3000/Metro 8081 và kết nối thiết bị | Lỗi có hướng dẫn; không tự kill process khác |
| `npm run demo` | API/Metro với cloud Firestore đã cấu hình | Thiếu cloud config fail có hướng dẫn; không ngầm seed/reset/fallback |
| `npm run firestore:check` | Read-only kiểm kết nối/quyền đọc cloud | Không ghi fixture; chưa có project nên pending |
| `npm run firestore:seed` | Gọi rõ tạo fixture thiếu trong namespace chọn | Idempotent/create-if-absent, không đè dữ liệu |
| `npm run test:firestore` | Lane Firestore Emulator riêng | SDK/transaction/race/quyền thật qua emulator, không tính cloud pass |
| `npm run demo:emulator` | API/Metro với emulator được chọn rõ khi script có | Health mode emulator; không là cloud thật |
| `npm run android` | Community CLI build/install native Android | Thiết bị được chọn, báo lỗi Gradle/SDK rõ |
| `npm run dev:api`, `npm run dev:mobile` | Chạy API/Metro tách để debug | Cùng config với demo |
| `npm run verify` | Typecheck/lint/test core theo workspace | Thất bại trả nonzero |
| `npm run test:api -- <case>` | Case auth/transaction/authorization/retry | Ghi cách filter thật theo runner đã chọn |
| `npm run test:mobile` | Form/API states cần thiết | Không thay device/native verification |
| `npm run smoke:demo` | Health/session/core A/B/C theo mode/namespace test chọn rõ | Không chạm dữ liệu thật; không tự seed/reset cloud |
| Reset dữ liệu | Không có reset cloud ngầm trong demo/check/seed | SQL reset cũ không áp dụng Firestore; mọi xóa dữ liệu thật cần scope cụ thể |

P01 phải ghi scripts thực tế và kết quả vào evidence; mục nào chưa có giữ trạng thái chưa triển khai.

## 4. Seed tối thiểu

- A và B: người trưởng thành, hồ sơ hoàn chỉnh, có thể tương tác hai chiều.
- C: người ngoài match để chứng minh lỗi phân quyền.
- D: bị block để chứng minh không xuất hiện/feed và không gửi tin.
- Có fixtures empty discovery, ảnh lỗi, câu trả lời gate đúng/sai và session hết hạn để QA; không phải tài khoản đăng nhập công khai trên live.
- Số điện thoại/ảnh/tiểu sử là giả lập hoặc asset có quyền dùng. Danh sách cách đăng nhập ở `docs/demo-accounts.md` được tạo tại P01, không chia sẻ mật khẩu thật của thành viên.
- Tạo seed theo ID ổn định; nhiều lần chạy không thêm document trùng/đè chỉnh sửa; không seed lại match đã ended. Mọi client dùng cùng API/DB khi test match/chat.

## 5. Kịch bản bấm test tối thiểu

1. Mở A và B trên hai client hoặc hai phiên độc lập; không gọi hai màn trong cùng một session là hai người.
2. A sửa bio, upload ảnh và restart server: dữ liệu còn.
3. A thấy B trong discovery, like B; B like A → cùng match ID.
4. A gửi tin; B nhận qua socket, reload đọc lại từ REST; retry không nhân đôi.
5. C thử đọc match/chat A–B → bị từ chối.
6. A unmatch/block B; B gửi khi chat vẫn mở → server từ chối, UI cập nhật rõ.
7. Từ chối GPS/gallery; app hiện hướng dẫn và vẫn dùng được các chức năng không cần quyền.
8. Tắt API trong lúc save/send: UI có lỗi/retry, không báo lưu thành công giả.

## 6. Bàn giao BE cuối ngày

- API source + Firestore rules/indexes + seed explicit + lockfile + `.env.example` + OpenAPI + DTO đã khóa.
- `GET /health` và `/v1/capabilities` có ví dụ response; database `{provider:"firestore",mode:"cloud"|"emulator",projectId,namespace}`, không secrets. Rules client deny all, API kiểm quyền Admin SDK.
- UI-test React Native chạy được cho luồng trên; nhãn FE-test, không phải visual final.
- Một API URL FE truy cập được trong phiên test; nếu khác mạng phải chọn cách chia sẻ backend riêng, không mặc định “localhost dùng được mọi nơi”.
- Evidence gồm commit/hash nếu có Git, runtime, thiết bị, phiên bản RN/React/CLI theo lockfile, JDK/SDK/Gradle, native build/install, cấu hình API/Metro/ADB, commands/output, test bấm tay, provider mode, known issues.
- `docs/handoff/be-to-fe.md` cần bảng route / request / response / errors / pagination / breaking change freeze / liên hệ xử lý lỗi (tạo ở P05, không thêm contact giả).

## 7. Ngày FE làm riêng

- FE chạy app clone với API URL BE dùng chung trước khi vẽ màn. Nếu FE tự chạy backend thì cần credential riêng được cấp quyền, không nhận key trong repo/chat. Media vẫn filesystem BE có auth, chưa Cloud Storage.
- FE đổi UI-test bằng UI-product theo prototype được chốt, dùng cùng API client/DTO; không mock một API đã có thật chỉ để giấu lỗi.
- FE báo lỗi bằng bước tái hiện, requestId, status/body đã bỏ secret, ảnh màn và expected/actual.
- BE giữ một khoảng sửa lỗi bàn giao theo khả năng thực tế, không hứa lịch cụ thể khi chưa biết ngày FE. Breaking API change phải sửa OpenAPI/DTO và thông báo trong handoff.

## 8. Xử lý lỗi thường gặp

| Triệu chứng | Kiểm tra |
|---|---|
| `adb` không tìm thấy hoặc `unauthorized` | SDK platform-tools/PATH, USB driver, USB debugging, xác nhận RSA; chọn đúng serial |
| Gradle không build | JDK 21/JAVA_HOME, SDK/licenses/platform/build tools, dependency download; đọc log đầu tiên thay vì xóa cache hàng loạt |
| App không kết nối Metro | Metro chạy 8081; USB reverse 8081 hoặc LAN dev-server host đúng; firewall/mạng |
| App mở nhưng API/chat lỗi | API URL theo emulator/USB/LAN; reverse 3000, API bind và socket dùng cùng endpoint; Metro hoạt động không chứng minh API hoạt động |
| Native module thiếu | Đã khóa/cài module, manifest/config đúng, build/install lại native app; reload JS không đủ |
| Cloud config/permission lỗi | `FIREBASE_PROJECT_ID`, ADC/credential local, project quyền đọc/ghi; không in key, không tự fallback SQL/emulator; xem docs12 |
| Query thiếu Firestore index | Áp dụng index theo repo vào project được phép; emulator pass không chứng minh cloud index/quyền đã sẵn |
| Port bị chiếm | Config override đồng bộ API/Metro/app; không kill process hệ thống |
| Seed làm mất dữ liệu | Lỗi cần sửa: cloud startup không seed; explicit seed create-if-absent không đè chỉnh sửa/xóa; không reset ngầm |

Evidence cuối phải phân biệt API tests, native build, device smoke, hai client realtime và clean-clone. Không suy ra nhóm kiểm tra còn lại từ một lệnh pass.
