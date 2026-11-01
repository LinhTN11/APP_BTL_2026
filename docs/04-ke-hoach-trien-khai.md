# Kế hoạch triển khai app hẹn hò

> **Cho AI và người triển khai:** đọc [yêu cầu sản phẩm](01-yeu-cau-san-pham.md), [UI/UX](02-yeu-cau-ui-ux.md), [kỹ thuật](03-yeu-cau-ky-thuat.md) và [quy tắc subagent](06-quy-tac-ai-va-subagent.md) trước khi nhận task. Khi thực thi, dùng skill `subagent-driven-development` hoặc `executing-plans` nếu có; các rule của dự án và chỉ dẫn hiện tại của người dùng được ưu tiên.

**Mục tiêu:** hoàn thành demo React Native có backend dùng thật trong demo, có thể chia sẻ mã nguồn và chạy lại từ bản clone sạch; đồng thời giữ lộ trình đầy đủ cho cả 37 chức năng trong tài liệu nguồn.

**Kiến trúc áp dụng:** monorepo npm workspaces, ứng dụng React Native Community CLI, backend Fastify theo module, SQLite file và media lưu cục bộ. Các nhà cung cấp bên ngoài đi qua adapter; dịch vụ miễn phí làm thật khi có cấu hình cần thiết, dịch vụ trả phí mô phỏng minh bạch. Socket.IO phục vụ sự kiện chat, REST là nguồn dữ liệu có thể tải lại.

**Tech stack:** TypeScript, React Native Community CLI, Node.js 24 LTS, Fastify, SQLite qua `node:sqlite`, Socket.IO; phiên bản chính xác được khóa và kiểm tra tương thích tại P01. Không buộc cả nhóm tạo tài khoản cloud để chạy demo.

**Spec:** `docs/01-yeu-cau-san-pham.md`; nguồn đối chiếu: `docs/source/yeu-cau-goc.md`.

**Ngày:** 01/11/2026, múi giờ Asia/Saigon. **Trạng thái:** đang triển khai core P01–P05 theo D11; RN Community CLI đã chốt theo D10, visual FE-product chưa được duyệt. Checkbox chỉ được đánh dấu khi có sản phẩm và bằng chứng tương ứng.

**Nguồn lực đã được chủ dự án chốt:** Android là nền tảng chính; một người BE cần hoàn thành phần được ưu tiên trong hôm nay 01/11/2026, một người FE có một ngày làm riêng. Dịch vụ miễn phí ưu tiên tích hợp thật; dịch vụ trả phí dùng mô phỏng. [Kế hoạch một ngày](11-ke-hoach-mot-ngay.md) quyết định thứ tự/timebox cho bản demo; roadmap này giữ đầy đủ các phase và không cam kết hoàn thành 37 chức năng trong một ngày.

## 1. Ràng buộc chung

- React Native là bắt buộc; prototype HTML/SVG chỉ dùng để duyệt thiết kế.
- BE là phần việc chính của chủ dự án. FE-test là màn tối thiểu để bấm kiểm tra backend. FE-product là toàn bộ giao diện hoàn chỉnh do nhóm FE phụ trách.
- Mọi chức năng F01–F37 phải có task và checklist; lùi phase không có nghĩa là bỏ khỏi phạm vi gốc.
- First run phải chạy được mà không cần API key. Chức năng miễn phí cần credential phải có nhánh tích hợp thật và trạng thái chưa cấu hình rõ; nhánh demo phục vụ first run không được ghi là đã đáp ứng tích hợp thật.
- Luồng giả lập phải ghi rõ `demo`, dữ liệu và quyền lợi demo phải tách khỏi chế độ provider thật.
- Không để client tự xác nhận match, nâng gói, xác minh tài khoản, xóa quyền truy cập chat hoặc ban người dùng.
- Dữ liệu seed là nhân vật hư cấu 18+. Quy tắc tuổi tối thiểu 18 là đề xuất cần chủ dự án xác nhận; không thu thập thông tin nhạy cảm thật để làm seed.
- File DB, media tải lên, token, log nội dung chat và khóa riêng không đưa vào Git.
- Chốt prototype trước khi làm FE-product. FE-test có thể làm theo contract để kiểm tra BE; phải ghi rõ giao diện kiểm thử.
- Android GPS/media/biometric/native calendar là các khả năng thiết bị miễn phí cần thử thật khi thiết bị hỗ trợ; không mô phỏng toàn bộ chỉ vì không có cloud key.
- Thời hạn BE là hôm nay; phạm vi bàn giao một ngày được timebox theo tài liệu 11. Không xem roadmap toàn bộ là khối lượng chắc chắn xong trong hôm nay. Dịch vụ trả phí không tự tạo giao dịch thật.

## 2. Cách đọc và tiêu chuẩn xong task

Mỗi task dưới đây ghi đường dẫn **dự kiến tạo**, không khẳng định file đang tồn tại. API trong plan tuân theo [contract chuẩn](08-hop-dong-api-va-du-lieu.md), prefix `/v1`; schema cuối phải thống nhất trong `packages/contracts` trước khi các agent viết hai đầu. Nếu task mở rộng cần endpoint bổ sung, cập nhật 08/OpenAPI trước khi thực hiện, không tự tạo biến thể route/field song song. Các lệnh `npm run ...` là yêu cầu phải tạo tại P01, **chưa phải lệnh đã chạy thành công trong thư mục hiện tại**.

Một task chỉ xong khi: hành vi và lỗi đã có contract; implementation đúng ownership; kiểm tra có bằng chứng; docs/checklist cập nhật; người tích hợp xem diff và chạy kiểm tra liên quan. Task có logic phân quyền, cạnh tranh ghi dữ liệu hoặc provider phải được review ở mức tương ứng, không chỉ xem screenshot.

| Nhãn người thực hiện | Công việc | Mức tác vụ thường phù hợp |
|---|---|---|
| BE-Core | Auth, DB, matching, chat, quyền truy cập | M/H, cần nâng mức khi có transaction/race |
| BE-Feature | Profile, quiz, catalog, bộ lọc và adapter demo | L/M khi contract đã khóa |
| FE-test | Màn RN phục vụ bấm thử API và hiển thị response | L/M, không tự đổi API |
| FE-product | Toàn bộ màn hình, trạng thái, Liquid Glass và accessibility | M, H nếu liên quan native/performance |
| QA | Integration, reconnect, clone sạch, negative cases | M/H theo rủi ro |
| Integrator | Contract, migrations, lockfile, merge và kiểm tra chéo | M/H; một owner cho file chung |

L/M/H mô tả độ khó để chọn agent có chi phí phù hợp, không gắn cứng tên model. Quy tắc ngân sách và giới hạn đồng thời nằm ở [06](06-quy-tac-ai-va-subagent.md).

## 3. Cấu trúc file mục tiêu

```text
apps/
  api/
    src/app.ts                       # Tạo Fastify instance, không tự listen khi test
    src/server.ts                    # Khởi động server
    src/config.ts                    # Env và chế độ demo/provider
    src/db/{connection.ts,migrate.ts,seed.ts,migrations/*.sql}
    src/modules/{auth,profiles,media,discovery,matches,chat,safety,
                 identity,preferences,personality,music,icebreakers,
                 dates,venues,assistant,explore,billing,calendar}/
    src/providers/{demo,real}/        # Adapter theo capability; không nhét SDK vào route
    test/{auth,profiles,media,discovery,matches,chat,safety,
          identity,preferences,personality,music,icebreakers,
          dates,venues,assistant,explore,billing,calendar}/
  mobile/
    android/, ios/                   # Native projects Community CLI
    App.tsx, index.js, metro.config.js
    src/{api,components,features,navigation,theme}/
    src/features/dev-tools/           # FE-test; chỉ bật trong demo/dev
    test/                            # Component và flow quan trọng
packages/contracts/src/              # Schema request/response/event dùng chung
scripts/{setup.mjs,dev.mjs,doctor.mjs,smoke-demo.mjs}
data/                                # DB + media local, bị Git ignore
docs/{api,qa,handoff}/                # Contract, evidence và hướng dẫn nhóm
```

Các module có thể gộp file nhỏ khi hợp lý; không tạo tầng repository/service/interface chỉ để có nhiều lớp. Tên file chung và bảng DB chỉ Integrator được sửa trong cùng một wave.

## 4. Thứ tự phase và mốc demo

| Phase | Kết quả nhìn thấy | Phụ thuộc | Phạm vi chức năng |
|---|---|---|---|
| P00 | Docs, quyết định, prototype và API mẫu được duyệt | Thông tin nhóm/tiêu chí chấm | Tất cả F |
| P01 | Clone sạch → setup → API + Metro + Android native + seed | D10/D11 + contract core | Nền tảng |
| P02 | Đăng nhập, hồ sơ, media, trạng thái selfie | P01 | F01–F05 |
| P03 | Tìm hồ sơ, like/pass, match, unmatch đúng quyền | P02 | F06–F08 |
| P04 | Chat hai máy + vị trí + chặn/báo cáo tối thiểu | P03 | F09–F10, phần tối thiểu F19/F22/F24 |
| P05 | Bộ màn BE-test và kịch bản demo core lặp lại được | P02–P04 | MVP core đã kiểm thử |
| P06 | Định danh nâng cao, bộ lọc, quiz, nhạc, phá băng | P05 | F11–F18 |
| P07 | An toàn cộng đồng và phản hồi sau hẹn đầy đủ | P04, P06 theo chức năng | F19–F24 |
| P08 | Địa điểm, kế hoạch hẹn, đánh giá, chia sẻ/SOS | T07.01–T07.02 cho safety; không chờ T07.03 review sau hẹn | F25–F28; hoàn tất F23 sau date model |
| P09 | AI mở lời/luyện tập, Explore và Vibe | P06–P08 theo dữ liệu | F29–F33 |
| P10 | Boost, Plus/Gold, lịch trong chat | P09; quyền lợi chốt trước billing | F34–F37 |
| P11 | FE-product, kiểm thử toàn hệ thống, bàn giao | Các phase thuộc phạm vi bản nộp | Toàn bộ phạm vi đã chọn |

UI-test BE có thể triển khai ngay theo D11; T00.02 chỉ gate visual FE-product, không chặn core.

**Mốc M1:** kết thúc P01, cả nhóm chạy được cùng seed. **Mốc M2:** kết thúc P05, demo core từ đăng nhập đến chat/unmatch/chặn, không giả là hoàn tất toàn bộ yêu cầu. **Mốc M3:** kết thúc P08, nhóm tính năng nâng cao và hỗ trợ hẹn hò. **Mốc M4:** kết thúc P11, bản nộp theo phạm vi đã được chủ dự án chốt.

Các phase mở rộng vẫn có mặt trong kế hoạch kể cả khi hạn nộp buộc dừng ở M2. Muốn thay phạm vi bản nộp phải ghi quyết định, lý do và các F bị ảnh hưởng; không tự đánh dấu chúng hoàn thành.

## 5. Chi tiết P00 — chốt yêu cầu, prototype và hợp đồng

### T00.01 — Baseline yêu cầu và quyết định demo

**Owner:** Integrator + chủ dự án, M. **Phụ thuộc:** không. **F:** toàn bộ.

**File:** `docs/01-yeu-cau-san-pham.md`, `docs/03-yeu-cau-ky-thuat.md`, `docs/07-cau-hoi-va-quyet-dinh.md`.

**Đầu vào → đầu ra:** 37 chức năng gốc + nguồn lực đã chốt → scope bản nộp một ngày, adapter nào thật/demo/chưa cấu hình và owner từng phần.

- [ ] Đối chiếu từng F với đoạn P trong nguồn; ghi điểm làm rõ mà không sửa lời gốc.
- [ ] Ghi nhận quyết định đã có: Android chính; một BE hôm nay, một FE một ngày riêng; free thật/paid mô phỏng. Bổ sung tiêu chí chấm, thiết bị cụ thể, phương án LAN/local và credentials cho dịch vụ miễn phí cần cấu hình.
- [ ] Ghi các quyết định về tuổi, vị trí, selfie, moderation, SOS và gói trả phí; quyết định chưa chốt phải ghi giả định cụ thể cùng phase bị chặn.
- [ ] Review coverage F01–F37 và lưu phiên bản docs được dùng để bắt đầu P01.

**Bằng chứng:** bảng quyết định có người/ngày chốt; không còn quyết định chặn P01. Không cần chạy app ở task này.

### T00.02 — Duyệt prototype và phạm vi màn hình

**Owner:** FE-product + chủ dự án, M. **Phụ thuộc:** T00.01 cho nền tảng; có thể làm song song với việc khóa contract.

**File:** `docs/02-yeu-cau-ui-ux.md`, `docs/prototype/flow.drawio`, `docs/prototype/flow.svg`, `docs/prototype/index.html`, `docs/qa/ui-approval.md`.

**Đầu vào → đầu ra:** screen inventory → flow, wireframe và bản preview có trạng thái duyệt theo màn/phiên bản.

- [ ] Dựng luồng auth → profile → khám phá → match → chat → unmatch/block và nhánh an toàn.
- [ ] Vẽ màn/variant cho cả F01–F37 ở mức wireframe; ưu tiên hi-fi các màn core để duyệt Liquid Glass.
- [ ] Preview cả sáng/tối, chữ lớn, giảm trong suốt và giảm chuyển động; ghi khác biệt iOS-native so với Android fallback.
- [ ] Ghi feedback thành checklist theo screen ID; chỉ FE-product các màn đã duyệt mới đi vào implementation.

**Bằng chứng:** file preview mở được và navigation chính không cụt; ảnh màn đại diện; biên bản duyệt. Prototype hiện có là bản nháp, không tự coi là đã được người dùng duyệt.

### T00.03 — Khóa contract và fixture dùng chung

**Owner:** Integrator/BE-Core, H. **Phụ thuộc:** T00.01; không phụ thuộc việc hoàn thiện màu sắc UI.

**File:** `docs/api/openapi.yaml`, `docs/api/events.md`, `docs/api/fixtures.md`, `packages/contracts/src/{common,auth,profiles,discovery,matches,chat}.ts`.

**Contract:** envelope lỗi `{ error: { code, message, fieldErrors?, requestId } }`; thời gian ISO UTC; ID UUID; phân trang cursor. `clientMessageId` là khóa idempotency theo người gửi, unique `(senderId, clientMessageId)`.

- [ ] Định nghĩa input/output/error cho auth, hồ sơ, media, discover, swipe, matches và messages; ghi quyền cho mỗi route.
- [ ] Định nghĩa event `message:created`, `match:ended`, ack `match:subscribe` và cách client tải lại sau mất kết nối; match mới có thể tải REST, không buộc thêm event để demo core.
- [ ] Tạo fixture A/B là người lớn có thể match, C dùng kiểm tra IDOR, D bị block và E ngoài bộ lọc; chỉ dùng dữ liệu hư cấu.
- [ ] BE và FE xác nhận cùng field/type; thay đổi sau này phải cập nhật schema và bên tiêu thụ trong cùng task.

**Bằng chứng:** schema parse/typecheck; ví dụ request/response cho 200/201/400/401/403/404/409/429; không lộ tọa độ chính xác trong discover.

## 6. Chi tiết P01 — nền tảng dễ chạy sau clone

### T01.01 — Workspace, lệnh chạy và kiểm tra môi trường

**Owner:** Integrator, M. **Phụ thuộc:** T00.01/T00.03.

**File:** `package.json`, `package-lock.json`, `.node-version`, `.env.example`, `.gitignore`, `apps/api/package.json`, `apps/mobile/package.json`, `scripts/{setup,dev,doctor}.mjs`, `README.md`.

**Contract:** đường dẫn chính `npm ci → npm run demo`; `demo` gọi setup/dev, giữ `npm run setup` và `npm run dev` riêng để debug; có `npm run doctor`, `npm run verify`. Setup idempotent, không ghi đè env người dùng, không xóa DB; reset là lệnh riêng có tên rõ ràng.

- [ ] Tạo workspaces và khóa RN Community CLI/React/Node/dependencies có tương thích thực tế; không dùng version `latest` trong bản bàn giao.
- [ ] Viết setup tạo env demo mặc định, thư mục data và migration/seed an toàn; thiếu công cụ phải báo cách cài cụ thể.
- [ ] Kiểm tra JDK 17, Android SDK/platform-tools, adb; native build/install qua Gradle và reverse cổng 3000/8081 cho USB.
- [ ] Dev khởi động API và Metro có dừng process con khi thoát; doctor kiểm tra Node, port, writable data, địa chỉ API và kết nối thiết bị.
- [ ] Chạy bộ lệnh trên thư mục sạch có khoảng trắng; ghi số bước tay còn cần cho JDK/SDK/emulator/USB debugging, native build và firewall LAN.

**Bằng chứng:** `docs/qa/clone-run.md` có log môi trường và thời gian đo thực tế. Không ghi “clone chạy luôn” nếu vẫn cần env bí mật hoặc sửa IP hardcode.

### T01.02 — DB, migration và seed

**Owner:** BE-Core/Integrator, H. **Phụ thuộc:** T01.01.

**File:** `apps/api/src/db/{connection,migrate,seed}.ts`, `apps/api/src/db/migrations/001_core.sql`, `apps/api/test/db/migrations.test.ts`, `apps/api/test/db/seed.test.ts`.

**Contract:** connection bật foreign keys; migration có version và transaction; seed có ID ổn định, chạy lại không nhân bản. Bảng core theo 08: users, sessions, otp_challenges, profiles, profile_media, interests/profile_interests, discovery_preferences, locations, swipes, matches, messages, blocks, reports. Quyền membership suy từ cặp canonical và trạng thái match.

- [ ] Kiểm tra `node:sqlite` trên đúng Node đã khóa; bảo đảm query tham số hóa, timeout và cách xử lý transaction được chứng minh bằng test.
- [ ] Tạo unique constraints cho cặp match canonical, swipe theo actor/target, message idempotency và FK liên quan.
- [ ] Seed các fixture T00.03, media local hợp lệ, hội thoại lịch sử và trạng thái đủ dùng kiểm thử.
- [ ] Kiểm tra migrate từ DB rỗng, migrate lần hai, seed lần hai và rollback transaction khi một bước thất bại; lệnh reset chỉ thao tác đường dẫn data của dự án.

**Kiểm tra dự kiến:** `npm run test:api -- db`. **Chấp nhận:** không nhân đôi user/match/message, FK chặn bản ghi mồ côi, restart giữ dữ liệu; bằng chứng ở `docs/qa/db.md`.

### T01.03 — API runtime, health và kiểm tra chung

**Owner:** BE-Core, M. **Phụ thuộc:** T01.01–T01.02.

**File:** `apps/api/src/{app,server,config}.ts`, `apps/api/src/plugins/{auth,errors,limits}.ts`, `apps/api/test/runtime.test.ts`, `scripts/smoke-demo.mjs`.

**Contract:** `GET /health` chỉ báo health/capability an toàn; config phân biệt demo/provider và nhận API host từ env; log redaction không ghi OTP/token/body chat.

- [ ] Tách tạo app khỏi listen để integration test khởi tạo DB tạm độc lập; đóng DB/socket sạch sau test.
- [ ] Thiết lập validation, request ID, error envelope, request/body/upload limits và CORS theo địa chỉ demo đã cấu hình.
- [ ] Tạo scripts `test:api`, `test:mobile`, `typecheck`, `lint`, `verify`, `smoke:demo` và chỉ dẫn dùng Postman CLI nếu nhóm chọn Postman.
- [ ] Kiểm tra request sai, env provider thiếu secret, port đã bị chiếm, DB không ghi được; báo lỗi khởi động dễ hiểu.

**Kiểm tra dự kiến:** `npm run verify` và `npm run smoke:demo`. **Chấp nhận:** không có server lỗi vẫn báo health thành công; môi trường demo không gọi provider ngoài.

## 7. Chi tiết P02 — auth, profile, media, selfie cơ bản

### T02.01 — Đăng nhập và session (F01)

**Owner:** BE-Core, H; FE-test tích hợp sau contract. **Phụ thuộc:** T01.03.

**File:** `apps/api/src/modules/auth/{routes,service,session}.ts`, `apps/api/src/providers/demo/auth.ts`, `packages/contracts/src/auth.ts`, `apps/api/test/auth/session.test.ts`.

**Contract:** `POST /v1/auth/otp/request`, `/otp/verify`, `/oauth/:provider`, `/logout`; `GET /v1/me`; demo account chooser qua `POST /v1/demo/sessions`. Core dùng opaque session 24 giờ, chưa cần refresh endpoint; provider thật yêu cầu token được server xác minh.

- [ ] Khóa schema số điện thoại chuẩn hóa, TTL OTP, giới hạn lần thử/gửi lại, session expiry/revocation; không để client gửi userId để tự đăng nhập ở chế độ provider thật.
- [ ] Viết integration cases OTP đúng/sai/hết hạn/replay, dùng lại session sau logout và gọi `/me` khi không có session hoặc quá 24 giờ.
- [ ] Implement adapter demo không cần key; cấu hình provider thật fail rõ khi chưa có credential, không tự fallback demo trong chế độ thật.
- [ ] Kiểm tra A và B đăng nhập độc lập, logout A không ảnh hưởng B, log không lộ OTP/token.

**Kiểm tra dự kiến:** `npm run test:api -- auth`. **Chấp nhận:** replay bị từ chối, rate limit hoạt động, route bảo vệ trả 401 khi session bị thu hồi.

### T02.02 — Hồ sơ và media tối đa chín mục (F03–F05)

**Owner:** BE-Feature, M; migration do Integrator. **Phụ thuộc:** T02.01.

**File:** `apps/api/src/modules/profiles/{routes,service}.ts`, `apps/api/src/modules/media/{routes,storage}.ts`, `packages/contracts/src/profiles.ts`, `apps/api/test/profiles/profile.test.ts`, `apps/api/test/media/upload.test.ts`.

**Contract:** `GET/PATCH /v1/me/profile`; `POST /v1/me/media`; `DELETE /v1/me/media/:id`; `PATCH /v1/me/media/order`. Client chỉ thay media mình sở hữu; ngày sinh dùng tính tuổi, không public ngày sinh đầy đủ.

- [ ] Khóa field bio/mục đích/sở thích/lối sống, phạm vi giá trị, giới hạn ảnh/video và quy tắc hoàn thiện hồ sơ được phép khám phá.
- [ ] Viết cases media thứ 9 thành công/thứ 10 bị chặn kể cả upload đồng thời; đổi thứ tự/xóa của người khác, file giả MIME, quá dung lượng và tên file traversal đều thất bại.
- [ ] Lưu media theo server-generated key, kiểm tra nội dung và quyền tải; xóa file/bản ghi phải có chiến lược dọn file lỗi và không tạo hồ sơ tham chiếu file mất.
- [ ] Kiểm tra sửa một field không xóa field khác; tuổi/giới tính/consent bắt buộc được validate theo quyết định đã chốt.

**Kiểm tra dự kiến:** `npm run test:api -- profiles media`. **Chấp nhận:** giới hạn 9 do server bảo đảm, không có IDOR, dữ liệu còn sau restart.

### T02.03 — Quy trình selfie và badge có nguồn gốc (F02)

**Owner:** BE-Feature, M; BE-Core review dữ liệu nhạy cảm. **Phụ thuộc:** T02.02.

**File:** `apps/api/src/modules/identity/{selfie-routes,selfie-service}.ts`, `apps/api/src/providers/demo/selfie.ts`, `packages/contracts/src/identity.ts`, `apps/api/test/identity/selfie.test.ts`.

**Contract:** `POST /v1/me/verification/selfie`; `GET /v1/me/verification`; trạng thái `not_submitted/pending/approved/rejected` kèm `source=demo|manual|provider` và lý do không nhạy cảm.

- [ ] Thiết kế consent, quyền xem selfie, thời hạn lưu/xóa và điều kiện duyệt; demo chỉ mô phỏng trạng thái, không tuyên bố đã so khớp khuôn mặt thật.
- [ ] Viết test không được PATCH badge từ profile; user C không xem selfie của A; upload lại sau rejected có trạng thái và lịch sử đúng.
- [ ] Implement demo reviewer route chỉ bật trong demo/dev; provider thật tách adapter và chỉ nhận callback đã xác thực.
- [ ] Hiển thị nguồn badge rõ trên FE-test; kiểm tra yêu cầu xóa media selfie không để URL công khai.

**Kiểm tra dự kiến:** `npm run test:api -- identity/selfie`. **Chấp nhận:** không tự cấp tích xanh thật; không lộ ảnh xác minh trong API profile công khai.

## 8. Chi tiết P03 — khám phá, tương tác và match

### T03.01 — Discovery và bộ lọc cơ bản (F06)

**Owner:** BE-Feature, M. **Phụ thuộc:** T02.02.

**File:** `apps/api/src/modules/discovery/{routes,query,ranking}.ts`, `packages/contracts/src/discovery.ts`, `apps/api/test/discovery/basic.test.ts`.

**Contract:** `GET /v1/discovery?gender=&ageMin=&ageMax=&radiusKm=&cursor=`; `PUT /v1/me/location` nhận vị trí của chính người dùng; `updatedAt` do server quyết định, `capturedAt` từ thiết bị nếu có chỉ là metadata riêng cần validate, không dùng làm giờ có thẩm quyền. Trả khoảng cách đã làm tròn, không trả lat/lng người được gợi ý.

- [ ] Khóa cách lọc hai chiều, tuổi biên, GPS bị từ chối và chế độ nhập khu vực demo; validate min/max/radius và coordinate bounds.
- [ ] Viết fixture kiểm tra bản thân, chưa đủ tuổi, hồ sơ chưa hoàn thiện, đã block, đã match và ngoài bộ lọc không xuất hiện.
- [ ] Implement query phân trang ổn định và lựa chọn khu vực khi thiếu GPS; không coi vị trí cũ là tracking thời gian thực.
- [ ] Kiểm tra empty state, cursor không hợp lệ và phản hồi khi vị trí quá cũ theo TTL đã chốt trong contract.

**Kiểm tra dự kiến:** `npm run test:api -- discovery/basic`. **Chấp nhận:** lọc đúng fixture, không rò tọa độ chính xác, không trùng ID giữa hai trang cùng snapshot.

### T03.02 — Like/pass và match nguyên tử (F07)

**Owner:** BE-Core, H. **Phụ thuộc:** T03.01.

**File:** `apps/api/src/modules/matches/{swipe-service,routes}.ts`, `packages/contracts/src/matches.ts`, `apps/api/test/matches/concurrency.test.ts`.

**Contract:** `POST /v1/swipes {targetUserId, action: like|pass, gateAnswer?}` → `{swipeId, match?}`; `GET /v1/matches`. Mỗi cặp user canonical chỉ có một match theo chính sách không tự tái match sau ended; trạng thái response đúng 08/OpenAPI.

- [ ] Viết test A like B chưa có match, B like A tạo đúng một match và pass không tạo match.
- [ ] Viết test gửi lặp request và hai lượt like đồng thời; unique constraint + transaction phải chặn tạo hai match.
- [ ] Implement server-side eligibility và quyền lợi hiện hành; reject self-like, target blocked/inactive và input không hợp lệ.
- [ ] Gửi event sau commit; khi event bị bỏ lỡ, REST vẫn trả match đúng và không gửi lại notification trùng.

**Kiểm tra dự kiến:** `npm run test:api -- matches/concurrency`. **Chấp nhận:** một match/membership duy nhất qua test cạnh tranh; không client nào tự cấp match.

### T03.03 — Unmatch, dữ liệu hội thoại và lý do cơ bản (F08, nền F24)

**Owner:** BE-Core, H. **Phụ thuộc:** T03.02.

**File:** `apps/api/src/modules/matches/{unmatch-service,feedback-service}.ts`, `apps/api/test/matches/unmatch.test.ts`, `packages/contracts/src/matches.ts`.

**Contract:** `DELETE /v1/matches/:id` nhận reason code tùy chọn; sau unmatch, hai bên không được gửi/đọc mới theo chính sách đã chốt. Báo cáo an toàn được lưu riêng với quyền hạn rõ.

- [ ] Khóa trạng thái `active/ended`, ai có thể hủy và chính sách lịch sử chat sau hủy; không để FE tự quyết quyền.
- [ ] Viết test C không unmatch được A/B; hai bên unmatch cùng lúc không tạo lỗi dữ liệu; retry trả trạng thái nhất quán.
- [ ] Implement thu hồi membership hiệu lực cho REST/socket, lưu feedback không tiết lộ người viết cho đối phương.
- [ ] Kiểm tra event kết thúc, cache FE bị invalidated và message đang gửi bị chặn khi unmatch commit trước message.

**Kiểm tra dự kiến:** `npm run test:api -- matches/unmatch`. **Chấp nhận:** quyền chat hết hiệu lực ngay theo thứ tự commit, không hiện lý do nhạy cảm cho người bị unmatch.

## 9. Chi tiết P04 — chat và an toàn tối thiểu

### T04.01 — Nhắn tin, GIF/sticker và reconnect (F09)

**Owner:** BE-Core, H. **Phụ thuộc:** T03.02–T03.03.

**File:** `apps/api/src/modules/chat/{routes,service,socket}.ts`, `packages/contracts/src/chat.ts`, `apps/api/test/chat/messages.test.ts`, `apps/api/test/chat/reconnect.test.ts`.

**Contract:** `GET/POST /v1/matches/:id/messages`; message `{id, matchId, clientMessageId, senderId, kind, text?, payload?, createdAt}` theo schema 08; socket authenticated vào room sau kiểm tra membership. GIF/sticker dùng catalog local hoặc ID provider có whitelist, không nhận arbitrary executable URL.

- [ ] Viết test chỉ thành viên active được xem/gửi; C không join room; token hết hạn/revoked bị ngắt đúng hành vi.
- [ ] Implement text/GIF/sticker, thứ tự theo server timestamp + ID, cursor và idempotency trên `(senderId, clientMessageId)`.
- [ ] Viết reconnect test: ngắt B, A gửi 3 tin, B nối lại tải từ cursor và thấy đúng 3 tin không trùng; không phụ thuộc sự kiện socket lưu bền.
- [ ] Kiểm tra payload quá dài, type không hỗ trợ, XSS/text literal, spam rate limit và gửi sau unmatch/block.

**Kiểm tra dự kiến:** `npm run test:api -- chat/messages chat/reconnect`; demo hai client đồng thời. **Chấp nhận:** retry không nhân đôi, persistence sau restart, REST/socket cùng quyền.

### T04.02 — Tin vị trí có consent (F10)

**Owner:** BE-Feature + FE-test, M. **Phụ thuộc:** T04.01.

**File:** `apps/api/src/modules/chat/location.ts`, `apps/mobile/src/features/dev-tools/LocationMessagePanel.tsx`, `apps/api/test/chat/location.test.ts`.

**Contract đề xuất cần duyệt:** người gửi chủ động chia sẻ **vị trí của chính mình**, không tự lấy vị trí của đối phương. `kind=location` có payload `latitude/longitude/label/sharedAt`, snapshot một lần, không tracking nền.

- [ ] Làm rõ câu gốc P015 với chủ dự án trước khi implement; nếu yêu cầu chia sẻ vị trí đối phương thì phải có consent riêng và quyền thu hồi của chủ vị trí.
- [ ] Viết test coordinate bounds, denied permission, user C không đọc được, block/unmatch khiến truy cập bị chặn.
- [ ] FE-test hiển thị xác nhận trước gửi, tuổi dữ liệu và mở ứng dụng bản đồ bằng hành động của người dùng.
- [ ] Kiểm tra không đưa vị trí vào analytics/log và không dùng location message cập nhật discover ngầm.

**Kiểm tra dự kiến:** `npm run test:api -- chat/location`; kiểm tra thiết bị thật quyền location denied/granted. **Chấp nhận:** không chia sẻ nền, không lấy GPS người khác.

### T04.03 — Block/report và cảnh báo tối thiểu trước MVP (phần F19/F22/F24)

**Owner:** BE-Core, H. **Phụ thuộc:** T03.03/T04.01.

**File:** `apps/api/src/modules/safety/{blocks,reports,basic-warning}.ts`, `apps/api/test/safety/core.test.ts`, `packages/contracts/src/safety.ts`.

**Contract:** `POST /v1/blocks` body targetUserId, `DELETE /v1/blocks/:userId`, `GET /v1/blocks`, `POST /v1/reports`; report có reason enum, target và context ID mà reporter có quyền tham chiếu. Cảnh báo demo dùng quy tắc local có nhãn, chưa phải model AI thật.

- [ ] Viết test block loại khỏi discover/matches/chat cả hai chiều; C không dùng report để đọc message của A/B.
- [ ] Implement block transaction và thu hồi socket room; unblock không tự khôi phục match đã kết thúc.
- [ ] Thêm report action tại profile/chat và safety information tối thiểu; tránh trả chi tiết report cho đối tượng bị báo cáo.
- [ ] Kiểm tra spam report/rate limit, báo cáo chính mình và cảnh báo sai; không ban vĩnh viễn chỉ vì từ khóa.

**Kiểm tra dự kiến:** `npm run test:api -- safety/core`. **Chấp nhận:** không có khoảng trống quyền giữa REST/socket sau block; demo core có đường thoát và báo cáo thực sự ghi DB.

## 10. Chi tiết P05 — UI để kiểm thử BE và chốt MVP

### T05.01 — Bộ màn RN dành cho BE-test

**Owner:** FE-test, M. **Phụ thuộc:** contract T00.03; có thể dựng khi BE làm P02–P04, nối thật sau mỗi task.

**File:** `apps/mobile/src/features/dev-tools/BackendLab.tsx`, `apps/mobile/src/features/dev-tools/{SessionPanel,ProfilePanel,DiscoveryPanel,MatchPanel,ChatPanel,SafetyPanel}.tsx`, `apps/mobile/src/api/client.ts`.

**Contract:** API client dùng schema chung, API URL cấu hình, trạng thái loading/error/retry; account switch xóa state gắn user, không dùng production UI làm công cụ bypass quyền.

- [ ] Dựng lựa chọn tài khoản seed và hiển thị rõ user/session hiện hành; không in token thô mặc định.
- [ ] Có nút request/verify OTP, chỉnh hồ sơ, thêm/xóa media, gửi selfie demo, load discover, like/pass, mở matches, send text/GIF/sticker/location, unmatch/block/report.
- [ ] Hiển thị HTTP status/error code và dữ liệu response đã che nhạy cảm; nút bị khóa khi request đang gửi, retry dùng idempotency key đúng.
- [ ] Thử mỗi nút bằng API thật local; không gọi setState giả thành công, không bỏ qua lỗi provider/network.

**Kiểm tra dự kiến:** `npm run test:mobile -- dev-tools`; manual hai thiết bị/instance. **Chấp nhận:** mọi nút có tác dụng quan sát được trong DB/API; các màn ghi rõ “Kiểm thử backend”.

### T05.02 — Demo core có kịch bản lặp lại

**Owner:** QA + Integrator, H. **Phụ thuộc:** T05.01 và P02–P04.

**File:** `docs/qa/mvp-scenarios.md`, `docs/qa/mvp-evidence.md`, `scripts/smoke-demo.mjs`, `docs/handoff/demo-core.md`.

**Luồng chuẩn:** seed A/B → đăng nhập hai client → sửa hồ sơ → discover đúng filter → like hai chiều → chat → reconnect → share location có consent → block hoặc unmatch → gửi tin bị chặn → restart vẫn đúng dữ liệu.

- [ ] Viết kịch bản với dữ liệu ban đầu, hành động và kết quả mong đợi cho từng bước; thêm một người C thử IDOR qua API.
- [ ] Chạy smoke API tự động, rồi chạy luồng nút trên RN; phân biệt fixture/demo provider với provider thật trong evidence.
- [ ] Clone sang thư mục mới, chạy đúng README không mượn env/data cũ; ghi bước chưa tự động hóa.
- [ ] Chốt lỗi chặn M2: không chạy được, mất dữ liệu, sai quyền, duplicate match/message, crash luồng chính và nút không nối API.

**Kiểm tra dự kiến:** `npm run verify`, `npm run smoke:demo`. **Chấp nhận:** các case bắt buộc đều có kết quả pass kèm evidence; F11–F37 chưa hoàn thành vẫn để mở.

## 11. Chi tiết P06 — định danh, cá nhân hóa và phá băng

### T06.01 — Số điện thoại và mở khóa sinh trắc (F11–F12)

**Owner:** BE-Core + FE-product, H cho auth; M cho UI. **Phụ thuộc:** T02.01/T05.02.

**File:** `apps/api/src/modules/identity/phone.ts`, `apps/mobile/src/features/auth/biometric-unlock.ts`, `apps/api/test/identity/phone.test.ts`, `apps/mobile/test/biometric-unlock.test.tsx`.

**Contract:** OTP challenge dùng luồng auth; `POST /v1/me/verification/phone` xác nhận challenge và cập nhật `phoneVerifiedAt/source`; biometric là khóa truy cập session/token lưu an toàn trên thiết bị, không chứng minh danh tính trước server.

- [ ] Chốt ý nghĩa “chính chủ”: OTP chỉ xác nhận kiểm soát số, muốn chứng minh thuê bao cần provider/pháp lý và phạm vi riêng.
- [ ] Viết test đổi số phải xác minh lại, OTP replay/hết hạn, token cũ bị thu hồi theo policy, không trùng số đã liên kết tài khoản khác.
- [ ] Implement react-native-keychain với Keystore/Keychain và kiểm soát truy cập sinh trắc OS theo khả năng thiết bị; fallback về đăng nhập bình thường khi không có sensor, hủy prompt hoặc session server hết hạn.
- [ ] Kiểm tra logout xóa khóa/session local và app resume không tự vượt auth chỉ vì biometric trả true.

**Kiểm tra dự kiến:** `npm run test:api -- identity/phone`, `npm run test:mobile -- biometric`; biometric thực phải thử thiết bị phù hợp. **Chấp nhận:** UI không gắn nhãn xác thực thuê bao chỉ dựa OTP.

### T06.02 — Hồ sơ mở rộng và bộ lọc (F13)

**Owner:** BE-Feature + FE-product, M. **Phụ thuộc:** T03.01, T02.02.

**File:** `apps/api/src/modules/preferences/{routes,filters}.ts`, `packages/contracts/src/preferences.ts`, `apps/api/test/preferences/advanced.test.ts`.

**Contract:** `GET/PATCH /v1/me/preferences`; discovery nhận filter relationshipIntent/children/height/education/religion/hometown. Field không khai báo khác giá trị “không”; server kiểm tra entitlement khi dùng filter trả phí tại P10.

- [ ] Chốt taxonomy, đơn vị chiều cao, nhiều lựa chọn và cách xử lý profile thiếu thông tin; không suy luận tôn giáo/con cái từ nội dung khác.
- [ ] Viết fixture biên và tổ hợp filter, field null, input lạ và quyền riêng tư field nhạy cảm.
- [ ] Implement schema/query và màn nhập/xóa lựa chọn; có reset filters, empty result và khả năng mở rộng điều kiện.
- [ ] Kiểm tra nâng/hạ gói về sau không làm endpoint trả filter trả phí sai quyền; giai đoạn trước P10 dùng policy demo được ghi rõ.

**Kiểm tra dự kiến:** `npm run test:api -- preferences/advanced`. **Chấp nhận:** tổ hợp điều kiện được test, field riêng tư không bị public ngầm.

### T06.03 — Quiz MBTI và nhạc (F14–F15)

**Owner:** BE-Feature, M; adapter provider thật cần review M/H. **Phụ thuộc:** T02.02, T06.02.

**File:** `apps/api/src/modules/personality/{quiz,scoring,routes}.ts`, `apps/api/src/modules/music/{routes,service}.ts`, `apps/api/src/providers/demo/music.ts`, `apps/api/test/personality/scoring.test.ts`, `apps/api/test/music/import.test.ts`.

**Contract:** `GET /v1/personality/questions`, `POST /v1/me/personality/answers`; phiên bản bộ câu hỏi + thuật toán chấm phải cùng lưu. `POST /v1/me/music/connect` body provider, `GET/DELETE /v1/me/music`; demo dùng fixture, provider miễn phí/đủ điều kiện dùng OAuth đúng scope.

- [ ] Biên soạn bộ 20–30 câu có quyền sử dụng, chấm điểm xác định, xử lý hòa và đáp án thiếu; không tuyên bố test là chẩn đoán hay chính thức khi chưa có căn cứ.
- [ ] Viết test cùng đáp án/cùng quizVersion cho cùng kết quả, không nhận mã tính cách do client tự gán trong endpoint chấm.
- [ ] Tạo music adapter trả thẻ từ fixture, lưu nguồn/thời điểm; import lặp không nhân đôi, disconnect xóa token/provider-derived data theo policy.
- [ ] Kiểm tra user từ chối OAuth, token hết hạn và không có dữ liệu âm nhạc; không gọi fixture là dữ liệu Spotify/Apple Music thật của user.

**Kiểm tra dự kiến:** `npm run test:api -- personality music`. **Chấp nhận:** quiz reproducible, provider error không phá profile, quyền nhạc có thể thu hồi.

### T06.04 — Điều kiện like, trò chơi chat và mood (F16–F18)

**Owner:** BE-Feature + FE-product, M. **Phụ thuộc:** T03.02, T04.01, T06.03 cho các nội dung quiz nếu dùng.

**File:** `apps/api/src/modules/icebreakers/{gate,game,mood,routes}.ts`, `packages/contracts/src/icebreakers.ts`, `apps/api/test/icebreakers/{gate,game,mood}.test.ts`.

**Contract:** `PUT /v1/me/like-gate`, `GET /v1/profiles/:id/like-gate`; hồ sơ công khai chỉ trả câu hỏi/phiên bản, không đáp án. `POST /v1/swipes` nhận `gateAnswer` và kiểm tra câu trả lời trước ghi like trong cùng service/transaction. Game state gắn match; `PUT /v1/me/mood` có `expiresAt` do server.

- [ ] Viết test không thể gọi swipe trực tiếp để bỏ qua gate, đổi câu hỏi khiến câu trả lời theo version cũ bị từ chối, không trả đáp án đúng cho người đang làm.
- [ ] Implement câu hỏi dạng có đáp án đã chốt và giới hạn thử; nếu là tự luận cần định nghĩa cách duyệt, không dùng “AI hiểu đúng” làm tiêu chí mơ hồ.
- [ ] Implement game Truth or Dare/20 questions với consent cả hai, skip/end, nội dung phù hợp; unmatch/block đóng game.
- [ ] Kiểm tra mood hết hạn đúng giờ server, xóa sớm được, không phụ thuộc app đang mở; reconnect tải lại game state không tạo hai lượt.

**Kiểm tra dự kiến:** `npm run test:api -- icebreakers`. **Chấp nhận:** gate enforce tại server, game không ép người dùng trả lời, mood không tồn tại vô thời hạn.

## 12. Chi tiết P07 — an toàn và phản hồi cộng đồng đầy đủ

### T07.01 — Safety center, keyword và moderation ảnh (F19–F21)

**Owner:** BE-Core + BE-Feature + FE-product, H. **Phụ thuộc:** T04.03; contract moderation chốt trước khi mở media chat.

**File:** `apps/api/src/modules/safety/{keywords,moderation,appeals,routes}.ts`, `apps/api/src/providers/demo/moderation.ts`, `apps/api/test/safety/moderation.test.ts`, `apps/api/test/safety/keywords.test.ts`.

**Contract:** `GET/PUT /v1/me/safety-keywords`; media chat trạng thái `pending/allowed/blurred/rejected`; moderation event là dữ liệu quyết định có nguồn và version, không một boolean client tự gửi.

- [ ] Định nghĩa cảnh báo từ khóa vs phân loại AI, phân biệt cảnh báo cho người dùng với xử lý tài khoản; demo local rules có nhãn.
- [ ] Viết test normalize tiếng Việt, từ có dấu/không dấu, keyword cá nhân không bị lộ cho người gửi; không tự gọi mọi đề cập từ nhạy cảm là ý định gây hại.
- [ ] Tạo hàng đợi/trạng thái kiểm duyệt media đơn giản phù hợp demo, asset nhạy cảm chỉ dùng fixture an toàn; không phát URL ảnh gốc trước verdict và không chỉ blur ở client.
- [ ] Giải quyết xung đột yêu cầu “cấm vĩnh viễn”: đề xuất review/cơ chế khiếu nại trước ban vĩnh viễn, ghi quyết định chủ dự án; test false positive, appeal và callback provider lặp/sai chữ ký.

**Kiểm tra dự kiến:** `npm run test:api -- safety/moderation safety/keywords`. **Chấp nhận:** không truy cập ảnh pending/rejected qua URL trực tiếp; không ban vĩnh viễn chỉ từ một keyword/demo verdict.

### T07.02 — Chặn liên hệ và vòng đời báo cáo (F22)

**Owner:** BE-Core + FE-product, H. **Phụ thuộc:** T04.03, T06.01.

**File:** `apps/api/src/modules/safety/{contacts,report-review}.ts`, `apps/api/test/safety/contact-block.test.ts`, `apps/api/test/safety/report-review.test.ts`.

**Contract:** contact block yêu cầu consent riêng; so khớp số đã chuẩn hóa theo kiến trúc quyền riêng tư đã duyệt. Báo cáo có `open/reviewing/resolved/dismissed`; role reviewer chỉ là công cụ demo được bảo vệ hoặc admin riêng.

- [ ] Chốt chặn liên hệ thủ công hay nhập danh bạ; nếu không cần danh bạ thì không xin quyền đọc toàn bộ contacts.
- [ ] Viết test contact-block hai chiều, không trả cho user biết tài khoản nào dùng số trong danh bạ; không log raw contacts.
- [ ] Implement importer/adapter demo và màn xem/xóa block; upload danh bạ thật chỉ sau khi duyệt dữ liệu/consent và thời hạn lưu.
- [ ] Test user thường không thể đổi trạng thái report hay role, reviewer chỉ thấy context được phép và có audit trail.

**Kiểm tra dự kiến:** `npm run test:api -- safety/contact-block safety/report-review`. **Chấp nhận:** không có endpoint tra cứu số điện thoại thành tài khoản; block không tự biến thành unmatch reversible.

### T07.03 — Review sau hẹn và feedback unmatch (F23–F24)

**Owner:** BE-Feature, M/H cho ẩn danh và chống lạm dụng. **Phụ thuộc:** T03.03, T04.03 cho feedback unmatch; phần review sau hẹn chỉ đóng sau khi T08.02 có date model. Task này không chặn T08.01/T08.02; P07 triển khai feedback unmatch và khóa contract review, P08 quay lại hoàn thiện review. Đồ thị dependency không có cạnh từ T08.02 về task review chưa xong.

**File:** `apps/api/src/modules/safety/{date-reviews,unmatch-feedback,feedback-ranking}.ts`, `apps/api/test/safety/feedback.test.ts`.

**Contract:** `POST /v1/date-plans/:id/feedback` cho người tham gia đủ điều kiện một lần; feedback unmatch nhận reason code tùy chọn trong `DELETE /v1/matches/:id`; public chỉ aggregate đủ ngưỡng, không public nội dung thô/danh tính reviewer. Bản đề xuất threshold ban đầu là tối thiểu 3 review hợp lệ, cần duyệt.

- [ ] Khóa tính đủ điều kiện sau hẹn, các nhãn đúng giờ/giống ảnh/lịch sự, chỉnh sửa và chống tự review/review lặp.
- [ ] Viết test người ngoài không review date, một người không tạo nhiều badge bằng retry, sample nhỏ không public lộ người đánh giá.
- [ ] Implement aggregate và đường báo cáo review bị lạm dụng; không biến đánh giá chủ quan thành chứng nhận an toàn.
- [ ] Dùng unmatch feedback làm tín hiệu xếp hạng demo có giải thích và kiểm soát, không public reason; AI thật chỉ mở khi có consent/dữ liệu phù hợp và đánh giá sai lệch.

**Kiểm tra dự kiến:** `npm run test:api -- safety/feedback`. **Chấp nhận:** anonymous trước đối phương nhưng có trace phục vụ xử lý lạm dụng; không tuyên bố hoàn toàn vô danh với hệ thống.

## 13. Chi tiết P08 — hỗ trợ hẹn hò thực tế

### T08.01 — Catalog địa điểm, trung gian và voucher (F25–F26)

**Owner:** BE-Feature + FE-product, M. **Phụ thuộc:** T04.02/T07.01.

**File:** `apps/api/src/modules/venues/{routes,midpoint,reviews,vouchers}.ts`, `apps/api/src/providers/demo/venues.ts`, `apps/api/test/venues/venues.test.ts`.

**Contract:** `GET /v1/venues` nhận bộ lọc khu vực/trung gian đã được consent, `GET /v1/venues/:id`; dùng vị trí tự nguyện của hai người hoặc khu vực nhập tay, trả gợi ý không lộ tọa độ đối phương. `GET/POST /v1/venues/:id/reviews`; voucher có nguồn/expiry/điều kiện. Query midpoint cụ thể phải khóa trong OpenAPI trước thực hiện.

- [ ] Seed địa điểm/voucher hư cấu, ghi rõ ưu đãi minh họa; chọn bản đồ/provider thật chỉ khi đã có ngân sách/key.
- [ ] Viết test midpoint khi thiếu consent một bên, tọa độ lỗi, không có địa điểm phù hợp và voucher hết hạn.
- [ ] Implement xếp hạng theo khoảng cách/tiêu chí công khai, review có moderation/report; địa điểm “được cộng đồng đánh giá” không đồng nghĩa được bảo đảm an toàn.
- [ ] FE có map/list fallback, xem chi tiết, review, voucher và empty/offline/error; chưa có Maps key vẫn demo danh sách và tọa độ seed được.

**Kiểm tra dự kiến:** `npm run test:api -- venues`. **Chấp nhận:** không lấy location bí mật để tính trung gian; coupon minh họa không trình bày là quyền lợi đối tác thật.

### T08.02 — Kế hoạch hẹn và chia sẻ cho người thân (F27, nền F23/F37)

**Owner:** BE-Feature + FE-product, M/H cho quyền share. **Phụ thuộc:** T03.03/T08.01.

**File:** `apps/api/src/modules/dates/{routes,service,sharing}.ts`, `packages/contracts/src/dates.ts`, `apps/api/test/dates/plan-sharing.test.ts`.

**Contract:** `GET/POST /v1/date-plans`, `PATCH /v1/date-plans/:id`, `POST /v1/date-plans/:id/share`; trạng thái `proposed/accepted/cancelled/completed`. Chia sẻ dùng system share sheet hoặc link token giới hạn scope, TTL và có thu hồi; không tự gửi SMS/email. Khi date model sẵn sàng, đóng phần review F23/T07.03.

- [ ] Khóa cách người nhận đồng ý/sửa/hủy, timezone và thời gian quá khứ; ngày hẹn bị thay đổi không được hiển thị như cả hai đã chấp nhận.
- [ ] Viết test A/B có quyền, C không đọc được; share token không xem chat/profile riêng, hết hạn và revoke có hiệu lực.
- [ ] Implement payload chia sẻ chỉ thông tin cần thiết; xem trước nội dung và user tự chọn người nhận qua share sheet.
- [ ] Kiểm tra unmatch/block ảnh hưởng date/share thế nào; ghi rõ quyết định và đồng bộ với T07.03/T10.03.

**Kiểm tra dự kiến:** `npm run test:api -- dates/plan-sharing`; thử system share trên thiết bị. **Chấp nhận:** không gửi thông tin cho ai nếu chưa có hành động gửi của user.

### T08.03 — SOS preview có xác nhận và giới hạn rõ (F28)

**Owner:** BE-Core + FE-product + QA, H. **Phụ thuộc:** T08.02/T04.02.

**File:** `apps/api/src/modules/dates/sos.ts`, `apps/mobile/src/features/dates/SosFlow.tsx`, `apps/api/test/dates/sos.test.ts`.

**Contract:** `POST /v1/date-plans/:id/sos-preview` trả payload để preview rồi user chủ động mở share/call action. GPS/native share làm thật nếu có quyền; không tự gửi tin, không gọi cứu hộ hay báo người nhận đã nhận. Kết quả chỉ là `prepared/no_location/failed` với mode đúng, không tạo delivery state giả.

- [ ] Chốt người nhận do user lựa chọn, countdown/hủy, trường hợp offline/GPS bị từ chối; phần “cứu hộ” trong nguồn được ghi rõ chưa tích hợp ở demo, không âm thầm đổi thành cam kết gửi thật.
- [ ] Viết test preview lặp không tạo tác dụng gửi ngoài, thiếu GPS vẫn tạo nội dung báo thiếu, lỗi không hiện success và user không preview plan của người khác.
- [ ] Implement flow xác nhận theo prototype, hiển thị tọa độ/thời điểm hoặc lý do không lấy được; mở share sheet không được ghi là thông điệp đã giao.
- [ ] Kiểm tra thiết bị thật foreground/background, mất mạng và hủy thao tác; chỉ thử với người tham gia đã đồng ý, không gọi dịch vụ khẩn cấp thật để test.

**Kiểm tra dự kiến:** `npm run test:api -- dates/sos`; checklist thiết bị tại `docs/qa/sos.md`. **Chấp nhận:** UI phân biệt preview, mở share sheet và giao tin; không có cam kết cứu hộ trong demo.

## 14. Chi tiết P09 — AI và khám phá nâng cao

### T09.01 — AI mở lời và trợ lý chat (F29–F30)

**Owner:** BE-Feature + BE-Core review privacy/cost, M/H. **Phụ thuộc:** T04.01/T06.02/T07.01.

**File:** `apps/api/src/modules/assistant/{routes,context,limits}.ts`, `apps/api/src/providers/demo/assistant.ts`, `apps/api/src/providers/real/assistant.ts`, `apps/api/test/assistant/suggestions.test.ts`.

**Contract:** `POST /v1/ai/openers` và `/v1/ai/reply-suggestions`; trả suggestions để người dùng tự chọn/gửi. Context chỉ profile chung được phép hoặc số tin đã consent; AI không tự gửi tin thay user.

- [ ] Định nghĩa consent, context tối thiểu, redaction, model/provider adapter, timeout, rate limit và ngân sách theo user; demo template hoạt động offline có nhãn.
- [ ] Viết test không lấy chat C, không đưa tọa độ/phone/selfie vào prompt, request lặp không gây nhiều lượt tính phí ngoài policy.
- [ ] Implement structured output có schema, fallback rõ khi timeout/không an toàn, không chèn nội dung profile thành system instruction.
- [ ] Dùng test provider giả để kiểm tra refusal, output sai schema và prompt injection; provider miễn phí thật cần đo quota/latency trên máy mục tiêu, dịch vụ có phí giữ chế độ mô phỏng theo quyết định hiện tại.

**Kiểm tra dự kiến:** `npm run test:api -- assistant/suggestions`. **Chấp nhận:** user luôn quyết định gửi, log không giữ nội dung chat nhạy cảm và chế độ thật không tự fallback giả mà thiếu thông báo.

### T09.02 — Luyện mở lời (F31)

**Owner:** BE-Feature + FE-product, M. **Phụ thuộc:** T09.01.

**File:** `apps/api/src/modules/assistant/{practice-routes,practice-service}.ts`, `apps/api/test/assistant/practice.test.ts`, `apps/mobile/src/features/practice/PracticeScreen.tsx`.

**Contract:** `POST /v1/ai/practice/sessions`, `POST /v1/ai/practice/sessions/:id/messages`; lịch sử practice tách khỏi chat thật và không gắn người thật. Khi bổ sung hành động xóa, khai báo `DELETE /v1/ai/practice/sessions/:id` trong 08/OpenAPI cùng task trước implementation.

- [ ] Định nghĩa persona hư cấu, giới hạn lượt, lưu/xóa lịch sử, feedback mang tính gợi ý; ghi rõ đang trò chuyện với mô phỏng AI.
- [ ] Viết test user C không đọc/xóa session A, giới hạn lượt/budget, retry không tạo hai lượt và AI không chèn tin vào real match.
- [ ] Implement demo có phản hồi xác định để test; provider thật dùng cùng contract và cơ chế safety/cost từ T09.01.
- [ ] FE có bắt đầu, kết thúc, reset/xóa, loading/cancel/error; không dùng cùng navigation/label gây nhầm với người dùng thật.

**Kiểm tra dự kiến:** `npm run test:api -- assistant/practice`. **Chấp nhận:** practice luôn được nhận biết là giả lập, xóa session có hiệu lực.

### T09.03 — Explore, MBTI/music và Vibe (F32–F33)

**Owner:** BE-Feature + FE-product, M. **Phụ thuộc:** T06.02–T06.04/T09.01.

**File:** `apps/api/src/modules/explore/{routes,catalog,ranking}.ts`, `packages/contracts/src/explore.ts`, `apps/api/test/explore/ranking.test.ts`.

**Contract:** `GET /v1/explore/topics`, `GET /v1/explore` với topicId/vibe theo query schema; `vibe` là lựa chọn khai báo hoặc suy luận có consent và nhãn nguồn. Tất cả đường Explore vẫn áp dụng tuổi, visibility, block và quyền hiện hành.

- [ ] Chốt taxonomy chủ đề/vibe, cách bật nhạc, ranking theo MBTI/âm nhạc và ý nghĩa AI trong nguồn; không dùng tên/thương hiệu Tinder làm tên sản phẩm.
- [ ] Viết test block không bị bypass bằng Explore, unknown vibe, profile thiếu MBTI/music, dữ liệu nhạc stale và cursor ổn định.
- [ ] Implement scoring demo xác định được cùng explanation ngắn; tách adapter AI thật nếu cần, không suy diễn thuộc tính nhạy cảm không khai báo.
- [ ] FE hiển thị topic/vibe picker, clear filters, no result và lý do gợi ý đúng dữ liệu thật có sẵn.

**Kiểm tra dự kiến:** `npm run test:api -- explore/ranking`. **Chấp nhận:** mọi nhánh discovery dùng cùng safety/visibility policy, không giới thiệu scoring demo là AI đã kiểm chứng.

## 15. Chi tiết P10 — gói, boost và lịch

### T10.01 — Quyền lợi Plus/Gold và Boost/Super Boost (F34–F36)

**Owner:** BE-Core, H; FE-product theo contract. **Phụ thuộc:** T03.02/T06.02/T09.03.

**File:** `apps/api/src/modules/billing/{catalog,entitlements,boost,usage}.ts`, `packages/contracts/src/billing.ts`, `apps/api/test/billing/entitlements.test.ts`, `apps/api/test/billing/boost.test.ts`.

**Contract:** `GET /v1/plans`, `GET /v1/me/entitlements`, `POST /v1/boosts`; entitlement do server tính theo plan/expiry/usage. Plus: unlimited like, rewind, incognito, no ads. Gold: curated list, advanced filters, Super Like, sent likes; quan hệ Gold kế thừa Plus phải được chốt trong catalog.

- [ ] Chốt Free/Plus/Gold, hạn mức, thời lượng boost/super boost, rewind được bao xa, incognito nhìn thấy ai, curated list nghĩa gì và quy tắc Super Like.
- [ ] Viết matrix test từng quyền bằng gọi API trực tiếp; client giả gói/đổi clock không được mở khóa; hết hạn phải thu hồi quyền ngay.
- [ ] Implement boost theo server clock, giới hạn số lượt và tránh tăng hiển thị người đã block/ngoài điều kiện; không đảm bảo chắc chắn có match.
- [ ] Implement rewind không xóa message/match đã phát sinh trái policy; sent likes không lộ lượt thích của người khác; no ads chỉ kiểm chứng trong app có vị trí ads xác định.

**Kiểm tra dự kiến:** `npm run test:api -- billing/entitlements billing/boost`. **Chấp nhận:** mọi benefit có test quyền và expiry, không chỉ đổi badge trên UI.

### T10.02 — Mô phỏng mua gói có idempotency

**Owner:** BE-Core + QA, H. **Phụ thuộc:** T10.01; F34–F36.

**File:** `apps/api/src/modules/billing/demo-purchases.ts`, `apps/api/src/providers/demo/payments.ts`, `apps/api/test/billing/checkout.test.ts`, `docs/qa/payments.md`.

**Contract:** `POST /v1/demo/purchases` nhận sản phẩm trong catalog, kết quả mô phỏng và idempotency key; chỉ bật trong demo. Server lưu purchase ledger và cấp entitlement theo trạng thái, không nhận boolean client để thay gói ngoài luồng demo đã cho phép.

- [ ] Áp dụng quyết định hiện tại: dịch vụ trả phí mô phỏng, không tạo tài khoản merchant/giao dịch tiền thật; không thêm SDK/webhook live vào đường găng.
- [ ] Viết test purchase retry cùng key chỉ cấp một lần, sản phẩm không hợp lệ bị từ chối, C không sửa ledger A và route demo bị tắt ngoài demo.
- [ ] Implement transaction ghi purchase + entitlement/quota đúng một lần; hỗ trợ tình huống success/failure/cancel/expire bằng dữ liệu mô phỏng có nhãn.
- [ ] FE hiển thị kết quả mô phỏng và quyền thực do server trả; không yêu cầu số thẻ hay ghi nhận đã thu tiền. Nếu về sau được giao thanh toán thật, tạo quyết định/contract/task riêng với sandbox và xác thực callback.

**Kiểm tra dự kiến:** `npm run test:api -- billing/checkout`. **Chấp nhận:** retry purchase không cộng boost/gói hai lần, mode rõ, không có giao dịch thật.

### T10.03 — Đặt lịch từ chat và calendar (F37)

**Owner:** BE-Feature + FE-product, M/H cho OAuth calendar. **Phụ thuộc:** T08.02/T04.01.

**File:** `apps/api/src/modules/calendar/{routes,service,sync}.ts`, `apps/api/src/providers/demo/calendar.ts`, `apps/mobile/src/features/dates/calendar.ts`, `apps/api/test/calendar/sync.test.ts`.

**Contract:** đề xuất hẹn trong chat dùng date model T08.02; `GET /v1/date-plans/:id/calendar.ics` cho export một lần. Native calendar trên Android dùng quyền thiết bị thật. Đồng bộ hai chiều Google/Apple là phạm vi khác với mở native calendar/create .ics; nếu chọn tích hợp cloud miễn phí, khóa các route OAuth/sync bổ sung trong 08/OpenAPI và liên kết external event bằng dateId/provider/accountId trước implementation.

- [ ] Chốt tạo lịch một lần hay sync hai chiều, quyền đọc/ghi, timezone và cập nhật/hủy event; demo .ics/native calendar vẫn phải ghi rõ không phải sync đầy đủ.
- [ ] Viết test retry export không nhân đôi event, user C không export date riêng, đổi giờ có version, DST/timezone và provider revoke.
- [ ] Implement đề xuất/chấp nhận lịch trong chat, user xác nhận mở calendar; không tự thêm vào lịch đối phương.
- [ ] Kiểm tra lỗi quyền, không có calendar account, event bị xóa ngoài app và unmatch; không báo đồng bộ thành công trước provider xác nhận.

**Kiểm tra dự kiến:** `npm run test:api -- calendar/sync`; test calendar thật trên thiết bị sandbox nếu được chọn. **Chấp nhận:** mức tích hợp được mô tả chính xác, không tạo trùng event khi retry.

## 16. Chi tiết P11 — tích hợp, FE-product và bàn giao

### T11.01 — Hoàn thiện toàn bộ FE-product theo inventory

**Owner:** FE-product, M/H theo màn; QA review. **Phụ thuộc:** T00.02 và contract của từng chức năng. Thực hiện cuốn chiếu từ P02, không đợi tới cuối mới bắt đầu UI.

**File:** `apps/mobile/src/navigation/**`, `apps/mobile/src/features/**`, `apps/mobile/src/components/{GlassSurface,AppButton,ScreenState}.tsx`, `apps/mobile/src/theme/**`, `docs/qa/ui-coverage.md`.

**Contract:** mỗi screen ID trong docs UI có route, feature owner, trạng thái loading/empty/error/offline/permission denied khi áp dụng và reference API F tương ứng.

- [ ] Chuyển màn đã duyệt thành RN; dùng shared components/theme, native controls khi có thể, system font và touch target đúng yêu cầu UI.
- [ ] Nối API thật của phase tương ứng; mock chỉ dùng story/preview có nhãn, không còn nút chỉ đổi local state mà không phản ánh server.
- [ ] Kiểm tra Liquid Glass native trên iOS được hỗ trợ; Android/thiết bị cũ có fallback đọc được, Reduce Transparency/Reduce Motion và chữ lớn vẫn dùng được.
- [ ] Đối chiếu từng screen/state với inventory, thử bàn phím/safe area/back gesture, VoiceOver/TalkBack, light/dark và nhiều kích thước; lưu evidence cho bản được nộp.

**Kiểm tra dự kiến:** `npm run test:mobile`, `npm run typecheck`, `npm run lint`; manual thiết bị thật theo `docs/qa/ui-coverage.md`. **Chấp nhận:** không dùng “đã đủ UI” nếu còn screen/state thuộc phạm vi bản nộp chưa có.

### T11.02 — Regression, clone sạch và bàn giao nhóm

**Owner:** QA + Integrator, H. **Phụ thuộc:** các task thuộc scope bản nộp và T11.01.

**File:** `docs/qa/final-report.md`, `docs/handoff/{quickstart,architecture,api-guide,demo-script,known-limits}.md`, `README.md`, `docs/05-checklist-be-fe.md`.

**Đầu vào → đầu ra:** toàn bộ artifact đã chọn → bản demo có hướng dẫn, evidence, giới hạn thật và danh sách phần chưa làm; người khác khởi động không cần máy tác giả.

- [ ] Chạy verify và regression các luồng auth/profile/media/discovery/match/chat/safety/billing cùng negative/concurrency cases liên quan.
- [ ] Thành viên khác clone vào thư mục mới, không có env/data cũ; thực hiện quickstart và kịch bản demo từ đầu; ghi lỗi và sửa đúng nguồn.
- [ ] Kiểm tra secret/data không bị commit, media seed đủ quyền sử dụng, env template không chứa credential, scripts reset ghi rõ mất dữ liệu.
- [ ] Bàn giao schema/API/events, seed accounts, provider modes, vai trò FE/BE, cách debug LAN, backup/restore demo và known limits; tick checklist chỉ theo evidence.

**Kiểm tra dự kiến:** clone-run bằng `npm ci → npm run demo`; kiểm tra bổ sung `npm run doctor`, `npm run verify`, `npm run smoke:demo`; `setup/dev` riêng để debug. **Chấp nhận:** một người ngoài tác giả chạy lại được, report phân biệt `implemented-demo`, `integrated-device`, `integrated-sandbox`, `integrated-real`, `not-implemented`.

## 17. Lịch làm song song và kiểm soát chi phí

| Wave | Có thể làm đồng thời | Cần tránh |
|---|---|---|
| W0 | Phân tích nghiệp vụ; UI/prototype; kỹ thuật/contract | Nhiều agent tự chọn tên field/gói/quyền khác nhau |
| W1 | Workspace/API runtime; prototype feedback; fixture/content | Cùng sửa lockfile, app config, migration chung |
| W2 | Auth → profile; FE-test dựng từ contract; QA chuẩn bị request cases | Agent FE tự giả API để báo xong |
| W3 | Discovery/matching; FE-product core; QA concurrency | Tách matching và transaction vào hai agent không có owner tích hợp |
| W4 | Chat+safety; FE-test chat; QA hai client/reconnect | Hai agent sửa cùng socket/auth middleware |
| W5 | Advanced profile/quiz/music; safety; FE-product theo module | Chạy provider thật hàng loạt để “test” chưa có ngân sách |
| W6 | Venues/date; assistant/explore khi đủ input; kế hoạch billing | Tự thêm microservices/Redis/queue cloud cho demo đơn máy |
| W7 | Billing/calendar sau contract; FE còn lại; handoff docs | Nâng gói/gửi thông tin/ghi calendar thật không theo chế độ đã chốt |
| W8 | Tích hợp, regression và clone sạch | Thêm feature mới trong lúc chốt evidence |

Mỗi wave dùng một Integrator và tối đa số worker thực sự độc lập theo công cụ đang có. Task nhỏ deterministic như seed/catalog/FE-test gọi API đã khóa dùng mức L/M; task auth, IDOR, race, moderation, payment cần mức M/H và reviewer độc lập. Không tạo agent riêng chỉ đổi một nhãn hoặc chạy một lệnh. Tái sử dụng context của agent cùng module nếu không làm giảm tính độc lập của review.

**Đường găng MVP:** T00.01 → T00.03 → T01.01–T01.03 → T02.01–T02.02 → T03.01–T03.03 → T04.01/T04.03 → T05.02. Selfie và vị trí vẫn nằm trong M2 nếu được yêu cầu demo toàn bộ Phần 1; không bỏ chúng chỉ vì nằm ngoài đường găng kỹ thuật.

**Ước lượng:** hiện có một BE trong hôm nay và một FE một ngày riêng; dùng timebox trong [11](11-ke-hoach-mot-ngay.md), dành dự phòng tích hợp và không lấy số agent đồng thời làm hệ số chia thời gian tuyến tính. Đo lại sau P01/P05; phần mở rộng tiếp tục theo roadmap khi có thêm thời gian, không hứa tất cả task xong trong ngày.

## 18. Quy tắc cập nhật tiến độ

- Mỗi task ghi trạng thái `chưa bắt đầu/đang làm/chờ quyết định/chờ review/đã kiểm chứng` và link evidence khi thực thi; tài liệu hiện tại giữ checkbox rỗng cho implementation.
- Khi đổi schema/quyền lợi/luồng UI: cập nhật yêu cầu, contract, checklist và task bị ảnh hưởng trước khi agent phụ thuộc tiếp tục.
- Nếu một phase bị chặn vì provider/key/thiết bị: tiếp tục phần demo độc lập đã được cho phép, giữ phần provider thật ở trạng thái chờ quyết định; không báo thay thế demo là đã đáp ứng tích hợp thật.
- Nếu deadline rút ngắn: đề xuất mốc nộp cùng danh sách F còn thiếu để chủ dự án quyết định; giữ roadmap đầy đủ và ghi phần thiếu trong handoff.

## 19. Ma trận truy vết tổng

| Chức năng | Task BE chính | FE-test | FE-product / chốt cuối |
|---|---|---|---|
| F01 | T02.01 | T05.01 | T11.01 |
| F02 | T02.03 | T05.01 | T11.01 |
| F03–F05 | T02.02 | T05.01 | T11.01 |
| F06 | T03.01 | T05.01 | T11.01 |
| F07 | T03.02 | T05.01 | T11.01 |
| F08 | T03.03 | T05.01 | T11.01 |
| F09 | T04.01 | T05.01 | T11.01 |
| F10 | T04.02 | T05.01 | T11.01 |
| F11–F12 | T06.01 | Mở rộng dev-tools theo contract | T11.01 |
| F13 | T06.02 | Mở rộng dev-tools theo contract | T11.01 |
| F14–F15 | T06.03 | Mở rộng dev-tools theo contract | T11.01 |
| F16–F18 | T06.04 | Mở rộng dev-tools theo contract | T11.01 |
| F19 | T04.03 + T07.01 | T05.01 rồi thêm safety panel | T11.01 |
| F20–F21 | T07.01 | Mở rộng safety panel | T11.01 |
| F22 | T04.03 + T07.02 | T05.01 rồi thêm contacts panel | T11.01 |
| F23 | T07.03 + T08.02 | Dates/reviews panel | T11.01 |
| F24 | T03.03 + T07.03 | T05.01 rồi feedback panel | T11.01 |
| F25–F26 | T08.01 | Venues/reviews panel | T11.01 |
| F27 | T08.02 | Date/share panel | T11.01 |
| F28 | T08.03 | SOS demo panel | T11.01 |
| F29–F30 | T09.01 | Assistant panel | T11.01 |
| F31 | T09.02 | Practice panel | T11.01 |
| F32–F33 | T09.03 | Explore/vibe panel | T11.01 |
| F34–F36 | T10.01–T10.02 | Entitlement/order demo panel | T11.01 |
| F37 | T10.03 | Calendar export panel | T11.01 |

Chi tiết các checkbox BE/FE-test/FE-product và trạng thái từng F nằm trong [05](05-checklist-be-fe.md).
