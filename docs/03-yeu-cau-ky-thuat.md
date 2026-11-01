# Yêu cầu kỹ thuật và quyết định stack

Ngày cập nhật: 01/11/2026, Asia/Saigon. Trạng thái: yêu cầu người dùng đã xác nhận; lựa chọn thư viện là đề xuất để triển khai.

## 1. Ràng buộc bắt buộc

- Mobile phải dùng **React Native**; Android là thiết bị demo chính.
- Nhóm có **1 BE và 1 FE**. BE cần hoàn thành trong hôm nay; FE có một ngày làm riêng để tích hợp và sửa lỗi.
- Dùng dịch vụ miễn phí thật khi khả thi; dịch vụ bắt trả phí dùng mô phỏng có nhãn. Không coi free trial yêu cầu thẻ hoặc quota tạm thời là miễn phí bền vững.
- Người nhận repo có thể cài dependencies rồi chạy demo bằng ít lệnh, không phải tự tạo DB, tài khoản cloud hoặc nhập khóa trả phí.
- Code TypeScript dễ đọc, module nhỏ, tên nghiệp vụ rõ. Không microservice, Kubernetes, message broker hoặc kiến trúc nhiều lớp không cần thiết cho demo.
- Toàn bộ 37 chức năng phải có nơi trong roadmap; phạm vi một ngày được chốt riêng ở [kế hoạch một ngày](11-ke-hoach-mot-ngay.md), không đồng nghĩa hoàn thành hết roadmap.
- Giao diện Apple Liquid Glass là định hướng thiết kế trên Android. Kính native iOS chỉ là phần tăng cường khi thiết bị hỗ trợ; không là điều kiện để demo Android.

## 2. Ba lựa chọn và phương án đề xuất

| Phương án | Thuận lợi | Chi phí triển khai/clone | Kết luận cho nhóm này |
|---|---|---|---|
| Expo + Fastify + SQLite local | Cùng TypeScript; dữ liệu và API nằm trong repo; chủ động nghiệp vụ BE; không cần tài khoản cloud | Tự viết auth, rules và chat; DB chỉ phù hợp demo nhỏ một server | **Đề xuất chọn** để kiểm soát deadline và đọc code |
| Expo + PocketBase | Auth, file, realtime, SQLite và dashboard có sẵn | Binary theo hệ điều hành, API rule/hook cần học; không mặc nhiên nhanh hơn nếu nhóm chưa biết | Phương án thay thế trước P01 nếu nhóm đã quen PocketBase |
| Expo + Supabase | Auth/Postgres/storage có sẵn, phù hợp demo nhiều mạng | Cloud cần project/config; local Windows cần CLI và container runtime | Chỉ chọn nếu đã có project/config sẵn; không đặt trên đường chạy demo mặc định |

Đây là quyết định theo khả năng bàn giao nhanh và dễ hiểu, không phải khẳng định Fastify luôn ít code nhất. Không triển khai đồng thời ba stack. Nguồn nền tảng: [Fastify](https://fastify.dev/docs/latest/Guides/Getting-Started/), [PocketBase](https://pocketbase.io/docs/), [Supabase local](https://supabase.com/docs/guides/local-development).

## 3. Stack đề xuất

| Thành phần | Lựa chọn | Quy tắc |
|---|---|---|
| Runtime/tooling | Node **24.15.0**, npm **11.3.0**, npm workspaces | Đây là phiên bản hiện có đã kiểm tra; ghi `.node-version`, `engines`, lockfile khi P01 bắt đầu. Đổi phiên bản cần clone-run lại |
| Mobile | Expo stable + React Native + TypeScript + Expo Router | P01 khóa đúng SDK stable tương thích Expo Go của nhóm; không ghim số SDK từ trí nhớ hoặc lấy beta |
| Server | Fastify 5, TypeScript, JSON Schema validation | Route → service → repository theo module; Fastify inject để integration test |
| DB | SQLite, SQL migrations, `node:sqlite` `DatabaseSync` | Không cài DB server; chỉ dùng API đã kiểm tra trên Node đã khóa; SQL có tham số |
| Chat | Socket.IO trên cùng HTTP server | REST lưu/đọc message là nguồn chuẩn; socket báo event sau commit, không thay DB |
| Contract | `packages/contracts`, OpenAPI 3.1, DTO JSON | Không trả row DB trực tiếp; OpenAPI là contract máy đọc, docs 08 là quy tắc nghiệp vụ |
| Mobile state | Context/session nhỏ + API client tập trung | Tránh thêm global-state framework khi state cục bộ đủ; chỉ chọn query cache nếu FE cần |
| Media | Local filesystem, asset giả lập có sẵn trong repo | Upload có auth/ownership, số lượng/size/MIME giới hạn; không mở thư mục upload công khai |
| UI | Native navigation/control phù hợp + `expo-glass-effect`/`expo-blur` có kiểm tra hỗ trợ | Android dùng thiết kế kính có fallback opaque; không nhúng SF font trên Android |
| Test API | Node test runner hoặc Vitest, chọn một ở P01 | Test transaction, auth, phân quyền, retry; Postman CLI dùng contract/smoke tùy chọn |

`node:sqlite` đã chạy được một truy vấn in-memory trên máy hiện tại, trả SQLite 3.51.3. Đây **chỉ** là kiểm tra khả dụng runtime, chưa chứng minh backend được xây hoặc chạy. Không lấy API từ tài liệu Node latest khác major rồi giả định dùng được trên Node 24. Nguồn: [Node SQLite](https://nodejs.org/api/sqlite.html).

## 4. Cấu trúc dự kiến, chưa được scaffold

```text
apps/
  api/src/{app.ts,server.ts,config.ts}
  api/src/db/{connection.ts,migrate.ts,seed.ts,migrations/}
  api/src/modules/{auth,profiles,media,discovery,matches,chat,safety,...}/
  api/src/providers/{demo,google,music,ai,payments,...}/
  api/test/
  mobile/app/                       # routes React Native
  mobile/src/{api,components,features,theme}/
packages/contracts/src/             # DTO và schema chia sẻ
scripts/                            # setup, doctor, dev, smoke, reset-demo
assets/demo/                        # ảnh/dữ liệu giả lập có quyền sử dụng
data/                               # DB/upload/session local; không commit
docs/                               # nguồn yêu cầu, kế hoạch, contract, evidence
.agents/skills/                     # skill cục bộ đi cùng repo
```

## 5. Định nghĩa “clone là chạy”

Điều kiện tối thiểu phải công khai: Git, Node/npm đúng phiên bản, internet lần đầu để `npm ci`, Expo Go tương thích trên Android **hoặc** Android Emulator đã cài. Không thể hứa máy không có runtime vẫn chạy ngay sau clone.

Trải nghiệm đích, các script **chưa tồn tại ở thời điểm viết docs**:

```powershell
npm ci
npm run demo
```

`demo` phải: kiểm tra Node/port → tạo config local và random secret nếu thiếu → migrate → seed nếu DB mới → bật API + Metro → in API URL, QR và cách xử lý lỗi. Chạy lần hai không xóa dữ liệu/seed đè. Không tự mở firewall, gửi SMS, mua gói, tạo cloud resource. Quy trình cụ thể ở [runbook](09-chay-demo-va-ban-giao.md).

- `DEMO_MODE=true`, providers thiếu config được trả về trạng thái `demo` hoặc `unavailable`, không crash startup.
- Provider miễn phí được triển khai adapter thật theo phase; dùng thật khi config hợp lệ. Có nút/nhãn cho biết chế độ, không âm thầm trả dữ liệu giả khi provider thật thất bại.
- `data/`, token, `.env.local`, media người thật không commit. `.env.example` chỉ có tên biến và giá trị không bí mật.
- Android emulator dùng `http://10.0.2.2:3000`; điện thoại dùng `http://<LAN-IP>:3000`, cùng Wi-Fi. Metro tunnel **không tự tunnel backend**.
- HTTP/cleartext chỉ dùng môi trường phát triển tin cậy, kiểm tra thực tế Expo Go/build; cấu hình network-security cho dev build nếu cần. Bản chia sẻ ra internet phải HTTPS và cấu hình riêng.

## 6. Miễn phí thật và mô phỏng

| Khả năng | Hướng thực hiện | Điều kiện/giới hạn |
|---|---|---|
| Profile, discovery, match, chat, block/report | API/DB local thật | Hai client dùng chung một backend để thấy nhau; seed không thay thế kiểm thử hai chiều |
| GPS, camera/gallery, chia sẻ qua share sheet | API thiết bị thật | Xin quyền tại lúc dùng; từ chối quyền vẫn dùng app; không tự gửi cho người khác |
| Vân tay/Face ID | OS biometric + SecureStore/session thật | Thiết bị hỗ trợ; không là đăng nhập lần đầu; Face ID iOS cần development build theo tài liệu Expo |
| Quiz tính cách, mood, keyword, icebreaker | Logic local/server thật | Không tự gọi quiz tự soạn là MBTI chuẩn hóa; keyword rule không gọi là AI |
| Lịch hẹn | DB lịch hẹn + mở lịch/share file ICS thật | Đồng bộ Google/Apple cloud là tích hợp riêng cần OAuth/quyền; không gọi ICS là sync hai chiều |
| Google OAuth | Adapter thật khi có OAuth client miễn phí và config hợp lệ | Chủ dự án cung cấp client IDs/package/redirect; không khóa demo core vì chờ thiết lập |
| SMS OTP, xác minh thuê bao chính chủ | Mock OTP demo; adapter thật nếu xác nhận có dịch vụ miễn phí phù hợp | OTP demo không gửi SMS, không chứng minh sở hữu số; mã chỉ hiện trong dev UI/API có hạn chế |
| Selfie/nhạy cảm ảnh | Upload/quy trình review thật; kết quả nhận diện mô phỏng cho demo nếu không có giải pháp miễn phí khả thi | Không gắn badge “đã xác minh thật” từ fixture; không gọi làm mờ mọi ảnh là AI detection |
| AI, Spotify/Apple Music, map/places | Đánh giá free tier, điều kiện tài khoản/quyền và giới hạn trước tích hợp | AI local/free endpoint phải được đo trên máy mục tiêu; fixture rõ nhãn nếu chưa có adapter thật |
| Boost/Plus/Gold | Entitlement và xếp hạng demo thật; checkout giả lập | Không nhập thẻ, không tạo giao dịch; cả restore/cancel/expire cần state rõ |
| SOS và chia sẻ kế hoạch | Tạo payload/preview/share sheet thật; thao tác gửi do người dùng | Không gọi dịch vụ cứu hộ, không tự gửi SMS hay hứa có người nhận/cứu hộ |

Không mặc định cài mô hình AI local nặng hoặc hàng GB weights chỉ để tránh phí: việc này phá mục tiêu clone nhanh. Nếu chọn phải có cách tắt và giữ demo core chạy độc lập. Nguồn thiết bị: [Expo LocalAuthentication](https://docs.expo.dev/versions/latest/sdk/local-authentication/), [Expo startup](https://docs.expo.dev/get-started/start-developing/).

## 7. Chất lượng tối thiểu

- Auth bằng opaque random session token, server lưu hash token và expiry; refresh/session storage được chốt contract trước code. Logout revoke phía server. Không hardcode JWT secret để tiện demo.
- Mọi API và socket kiểm tra user hiện tại, match còn active, block hai chiều. Không tin `userId` gửi từ client.
- DB foreign keys bật, unique constraints, transaction cho mutual like/match và giới hạn 9 media; một kết nối ghi/transaction manager, busy timeout và WAL được test thực tế.
- Login/OTP có expiry, max-attempt và rate limit; server trả lỗi chuẩn, không log token/số điện thoại đầy đủ.
- Message có `clientMessageId` để retry không nhân đôi. Phân trang cursor ổn định, sort theo thời gian + ID.
- Upload kiểm tra byte signature/allowlist và giới hạn stream, không chỉ tên file; max media gồm pending upload, dọn orphan.
- Kiểm tra restart server vẫn giữ dữ liệu; reset chỉ xóa dữ liệu demo khi người dùng gọi rõ.
- Test luồng chính và lỗi quyền quan trọng. Không tăng test chỉ để đạt số lượng hoặc snapshot lặp cấu trúc.
- “Hoàn thành” phải có lệnh, kết quả, thiết bị và mode provider trong evidence. Chưa code thì không đánh dấu pass/build thành công.
