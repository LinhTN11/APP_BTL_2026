# Yêu cầu kỹ thuật và quyết định stack

Ngày cập nhật: 01/11/2026, Asia/Saigon. Trạng thái: yêu cầu người dùng đã xác nhận; React Native Community CLI đã chốt theo D10, core P01–P05 đang triển khai theo D11. D12 (USER) chọn Cloud Firestore làm DB chính, chưa có project/credentials. Core đang port; SQL core và extensions là reference local, chưa phải cloud implementation.

## 1. Ràng buộc bắt buộc

- Mobile phải dùng **React Native Community CLI**, không Expo/Expo Go/module `expo-*`; Android là thiết bị demo chính.
- Nhóm có **1 BE và 1 FE**. BE cần hoàn thành trong hôm nay; FE có một ngày làm riêng để tích hợp và sửa lỗi.
- Dùng dịch vụ miễn phí thật khi khả thi; dịch vụ bắt trả phí dùng mô phỏng có nhãn. Không coi free trial yêu cầu thẻ hoặc quota tạm thời là miễn phí bền vững.
- FE clone app, cài dependencies và cấu hình API URL tới BE dùng chung; không cần Admin key. BE cần tạo Firebase project riêng một lần và mỗi người chạy backend có credential được cấp quyền. Xem [setup Firestore](12-ket-noi-firestore.md).
- Code TypeScript dễ đọc, module nhỏ, tên nghiệp vụ rõ. Không microservice, Kubernetes, message broker hoặc kiến trúc nhiều lớp không cần thiết cho demo.
- Toàn bộ 37 chức năng phải có nơi trong roadmap; phạm vi một ngày được chốt riêng ở [kế hoạch một ngày](11-ke-hoach-mot-ngay.md), không đồng nghĩa hoàn thành hết roadmap.
- Giao diện Apple Liquid Glass là định hướng thiết kế trên Android. Kính native iOS chỉ là phần tăng cường khi thiết bị hỗ trợ; không là điều kiện để demo Android.

## 2. Stack áp dụng và phạm vi quyết định

D10 (USER, 01/11/2026) thay thế phương án mobile cũ bằng React Native Community CLI. D12 (USER) thay DB chính SQLite bằng Cloud Firestore qua Firebase Admin SDK; Fastify và mobile/API DTO giữ nguyên. Không mirror file SQL, không fallback SQLite/emulator khi cloud thiếu cấu hình. D11 cho phép triển khai P01–P05 và UI-test BE; FE-product cần duyệt prototype riêng. Roadmap vẫn đủ 37 chức năng, 60 màn/sheet và 12 phase.

Không dùng Expo Go, Expo Router, Expo SDK, QR launch hoặc thư viện `expo-*`. App có native projects `android/`, `ios/`; Android được build/install bằng Community CLI/Gradle. Không ghi số React Native từ trí nhớ: khóa bản stable và dependency tương thích trong `apps/mobile/package.json` + `package-lock.json`, kèm evidence môi trường/build.

## 3. Stack triển khai

| Thành phần | Lựa chọn | Quy tắc |
|---|---|---|
| Runtime/tooling | Node **24.15.0**, npm **11.3.0**, npm workspaces | Đây là phiên bản hiện có đã kiểm tra; ghi `.node-version`, `engines`, lockfile khi P01 bắt đầu. Đổi phiên bản cần clone-run lại |
| Mobile | React Native 0.88 / Community CLI 20.2 + TypeScript theo bản đã kiểm tra | Phiên bản chính xác theo lockfile/evidence; giữ native Android/iOS projects, không đoán bản mới |
| Server | Fastify 5, TypeScript, JSON Schema validation | Route → service → repository theo module; Fastify inject để integration test |
| DB | Cloud Firestore, Firebase Admin SDK async phía BE | `projects/{namespace}` và subcollections; transaction + document ID xác định + composite indexes; không SQL adapter/fallback |
| Chat | Socket.IO trên cùng HTTP server | REST lưu/đọc message là nguồn chuẩn; socket báo event sau commit, không thay DB |
| Contract | `packages/contracts`, OpenAPI 3.1, DTO JSON | Không trả row DB trực tiếp; OpenAPI là contract máy đọc, docs 08 là quy tắc nghiệp vụ |
| Mobile state | Context/session nhỏ + API client tập trung | Tránh thêm global-state framework khi state cục bộ đủ; chỉ chọn query cache nếu FE cần |
| Media | Local filesystem, asset giả lập có sẵn trong repo | Upload có auth/ownership, số lượng/size/MIME giới hạn; không mở thư mục upload công khai |
| UI | RN components + GlassSurface của dự án; React Navigation native-stack khi cần | Android baseline dùng nền đặc/bán mờ, viền và tương phản; blur/native glass chỉ thêm sau kiểm build/thiết bị, không dùng module Expo |
| Test API | Node test runner hoặc Vitest, chọn một ở P01 | Test transaction, auth, phân quyền, retry; Postman CLI dùng contract/smoke tùy chọn |

Cấu hình BE: `DATABASE_MODE=firestore`, bắt buộc `FIREBASE_PROJECT_ID`; credential dùng ADC hoặc `GOOGLE_APPLICATION_CREDENTIALS` trỏ file local tuyệt đối, không commit/đưa vào bundle/log/chat. `FIRESTORE_NAMESPACE` mặc định `app-cuoi-ky` (`[a-z0-9-]{1,48}`). Cloud không đặt `FIRESTORE_EMULATOR_HOST`; emulator chỉ khi chọn `DATABASE_MODE=firestore-emulator`. Rules client deny all; Admin SDK bỏ qua rules nên mọi quyền session/owner/match/block phải được API kiểm tra. Chưa có project/credentials nên kết nối thật còn pending; [12](12-ket-noi-firestore.md) là runbook setup.

## 4. Cấu trúc mục tiêu đang triển khai

```text
apps/
  api/src/{app.ts,server.ts,config.ts}
  api/src/firestore/{app,context,auth,profiles,media,seed,matching,chat,safety}.ts
  api/src/db/                       # SQL cũ: reference local, không DB chính
  api/src/modules/{auth,profiles,media,discovery,matches,chat,safety,...}/
  api/src/providers/{demo,google,music,ai,payments,...}/
  api/test/
  mobile/{android,ios}/              # native projects Community CLI
  mobile/{App.tsx,index.js,metro.config.js}
  mobile/src/{api,components,features,navigation,theme}/
packages/contracts/src/             # DTO và schema chia sẻ
scripts/                            # setup, doctor, dev, Firestore check/seed/emulator test
assets/demo/                        # ảnh/dữ liệu giả lập có quyền sử dụng
data/                               # media/upload local; không commit
docs/                               # nguồn yêu cầu, kế hoạch, contract, evidence
.agents/skills/                     # skill cục bộ đi cùng repo
```

## 5. Định nghĩa “clone là chạy”

Điều kiện: Git, Node/npm đã khóa, internet cho lần `npm ci`/Gradle đầu, JDK 21, Android Studio/SDK Command-line Tools, Platform Tools (`adb`), platform/build tools tương thích RN đã khóa. `ANDROID_HOME` trỏ SDK; SDK licenses đã chấp nhận. Có emulator đã bật hoặc máy Android bật USB debugging, đã xác nhận khóa RSA. Backend cloud cần project ID + ADC/credential riêng; FE chỉ cần API URL tới backend đã cấu hình.

```powershell
npm ci
npm run demo
```

Đây là giao diện script đích; evidence phải ghi script nào đã chạy và kết quả. `demo` chạy cloud đã cấu hình và bật API 3000 + Metro 8081, thiếu cấu hình phải báo hướng dẫn trước listen; seed chỉ bằng `npm run firestore:seed`, không tự ghi cloud; build/install Android bằng script `npm run android` ở terminal khác theo runbook. Có thể cần tải Gradle/Maven/SDK lần đầu; không hứa chỉ clone là có APK. Không tự reset DB hoặc mở firewall.

- Emulator API: `http://10.0.2.2:3000`; Metro host 8081 theo cấu hình debug RN.
- USB Android: `adb -s <serial> reverse tcp:3000 tcp:3000` và `adb -s <serial> reverse tcp:8081 tcp:8081`; API dùng `http://127.0.0.1:3000`. Chọn serial riêng cho hai client.
- LAN: API `http://<LAN-IP>:3000`, Metro `<LAN-IP>:8081`, cùng Wi-Fi không cách ly; đổi API URL qua config local theo script, không hardcode IP. Tunnel Metro không thay đường API.
- API URL là public trong bundle; provider secret chỉ ở server. `data/`, session/token và `.env.local` không commit.
- HTTP cleartext chỉ cho debug trong mạng tin cậy; cấu hình native Android debug network security. Release/internet cần HTTPS và cấu hình riêng.
- Native modules: `react-native-keychain` lưu session trong Keystore/Keychain; `react-native-image-picker` chọn/chụp media; `@react-native-community/geolocation` lấy vị trí với quyền Android runtime. Khóa phiên bản tương thích RN và build lại app khi đổi native module; Metro reload không thêm native code.
- Permission phải có manifest/runtime handling và đường từ chối; sinh trắc, Google OAuth, native calendar là phase riêng, không ngầm coi module được cài là tích hợp thật. iOS build cần macOS/Xcode/CocoaPods, không là gate Android trên Windows.

## 6. Miễn phí thật và mô phỏng

| Khả năng | Hướng thực hiện | Điều kiện/giới hạn |
|---|---|---|
| Profile, discovery, match, chat, block/report | Firestore Admin SDK đang port; cloud chưa kiểm chứng | Hai client dùng chung một backend để thấy nhau; seed không thay thế kiểm thử hai chiều |
| GPS, camera/gallery, chia sẻ qua share sheet | API thiết bị thật | Xin quyền tại lúc dùng; từ chối quyền vẫn dùng app; không tự gửi cho người khác |
| Vân tay/Face ID | `react-native-keychain` + kiểm soát truy cập sinh trắc OS khi tương thích | Thiết bị hỗ trợ; không là đăng nhập lần đầu; cần native build và cấu hình iOS/Android riêng, session server vẫn có expiry/revoke |
| Quiz tính cách, mood, keyword, icebreaker | Logic local/server thật | Không tự gọi quiz tự soạn là MBTI chuẩn hóa; keyword rule không gọi là AI |
| Lịch hẹn | DB lịch hẹn + mở lịch/share file ICS thật | Đồng bộ Google/Apple cloud là tích hợp riêng cần OAuth/quyền; không gọi ICS là sync hai chiều |
| Google OAuth | Adapter thật khi có OAuth client miễn phí và config hợp lệ | Chủ dự án cung cấp client IDs/package/redirect; không khóa demo core vì chờ thiết lập |
| SMS OTP, xác minh thuê bao chính chủ | Mock OTP demo; adapter thật nếu xác nhận có dịch vụ miễn phí phù hợp | OTP demo không gửi SMS, không chứng minh sở hữu số; mã chỉ hiện trong dev UI/API có hạn chế |
| Selfie/nhạy cảm ảnh | Upload/quy trình review thật; kết quả nhận diện mô phỏng cho demo nếu không có giải pháp miễn phí khả thi | Không gắn badge “đã xác minh thật” từ fixture; không gọi làm mờ mọi ảnh là AI detection |
| AI, Spotify/Apple Music, map/places | Đánh giá free tier, điều kiện tài khoản/quyền và giới hạn trước tích hợp | AI local/free endpoint phải được đo trên máy mục tiêu; fixture rõ nhãn nếu chưa có adapter thật |
| Boost/Plus/Gold | Entitlement và xếp hạng demo thật; checkout giả lập | Không nhập thẻ, không tạo giao dịch; cả restore/cancel/expire cần state rõ |
| SOS và chia sẻ kế hoạch | Tạo payload/preview/share sheet thật; thao tác gửi do người dùng | Không gọi dịch vụ cứu hộ, không tự gửi SMS hay hứa có người nhận/cứu hộ |

Không mặc định cài mô hình AI local nặng hoặc hàng GB weights chỉ để tránh phí: việc này phá mục tiêu clone nhanh. Nếu chọn phải có cách tắt và giữ demo core chạy độc lập. Nguồn đối chiếu triển khai: [React Native environment setup](https://reactnative.dev/docs/set-up-your-environment), [React Navigation](https://reactnavigation.org/docs/getting-started/), [Keychain](https://github.com/oblador/react-native-keychain), [Image Picker](https://github.com/react-native-image-picker/react-native-image-picker), [Geolocation](https://github.com/michalchudziak/react-native-geolocation). Phiên bản tương thích phải đối chiếu lockfile/build, không coi liên kết là evidence đã chạy.

## 7. Chất lượng tối thiểu

- Auth bằng opaque random session token, server lưu hash token và expiry; refresh/session storage được chốt contract trước code. Logout revoke phía server. Không hardcode JWT secret để tiện demo.
- Mọi API và socket kiểm tra user hiện tại, match còn active, block hai chiều. Không tin `userId` gửi từ client.
- Firestore transaction async đọc đủ document trước ghi; canonical pair document bảo vệ một match, idempotency document bảo vệ message retry, counter/quota bảo vệ 9 media. Không dựa vào SQL FK/unique/WAL; ownership và tham chiếu kiểm tại API/transaction. Emit socket sau commit, không trong closure có thể retry. Query có cursor `(createdAt,id)` + composite index và giới hạn page.
- Login/OTP có expiry, max-attempt và rate limit; server trả lỗi chuẩn, không log token/số điện thoại đầy đủ.
- Message có `clientMessageId` để retry không nhân đôi. Phân trang cursor ổn định, sort theo thời gian + ID.
- Upload kiểm tra byte signature/allowlist và giới hạn stream, không chỉ tên file; max media gồm pending upload, dọn orphan.
- Kiểm tra restart vẫn giữ dữ liệu. `firestore:check` read-only; `firestore:seed` tạo fixture thiếu, không đè chỉnh sửa hoặc reset cloud; `test:firestore` dùng emulator project/namespace tạm rõ ràng, không chứng minh cloud. Media vẫn filesystem BE có auth, chưa phải Cloud Storage.
- Test luồng chính và lỗi quyền quan trọng. Không tăng test chỉ để đạt số lượng hoặc snapshot lặp cấu trúc.
- “Hoàn thành” phải có lệnh, kết quả, thiết bị và mode provider trong evidence. Chưa code thì không đánh dấu pass/build thành công.
