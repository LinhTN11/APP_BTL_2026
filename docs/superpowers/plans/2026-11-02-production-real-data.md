# Production với dữ liệu thật — kế hoạch triển khai và phân công

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` or `executing-plans` to implement task-by-task. Chỉ thực thi khi người dùng yêu cầu triển khai; lượt hiện tại chỉ lập kế hoạch và giao subagent rà soát.

**Goal:** App dùng tài khoản và dữ liệu thật xuyên suốt API → Cloud Firestore, không có dữ liệu/hành vi demo trong bản chạy production; bỏ dòng “Tiếp tục…” ở mở đầu và kiểm chứng trước bàn giao.

**Architecture:** Giữ React Native Community CLI → Fastify → Firebase Admin SDK → Cloud Firestore, REST là nguồn chuẩn của chat, Socket.IO cập nhật sau commit. Tách fixtures/test tooling khỏi runtime production. Dọn dữ liệu theo manifest có bằng chứng nguồn gốc, không reset toàn project.

**Tech Stack:** TypeScript, RN CLI, Firebase Authentication SDK, Fastify, Firebase Admin SDK, Firestore, Socket.IO; giữ phiên bản lockfile.

**Spec:** Yêu cầu USER 02/11/2026 trong chat: “Đồng bộ hoàn toàn với cơ sở dữ liệu thật, xóa data mock test đi chỉ để lại phần production hoàn chỉnh để tôi test với dữ liệu thật, trang mở đầu bỏ dòng ‘Tiếp tục ...’ chỉ lên kế hoạch và chia subagent làm”; docs 01–08, 11–12 và `docs/firebase-auth.md`.

## Ràng buộc và phạm vi

- Lượt lập kế hoạch không sửa implementation, không gọi provider, không ghi/xóa cloud, không push/deploy. Chỉ tạo tài liệu này.
- Không scaffold lại; cây làm việc đang có nhiều thay đổi chưa commit, cần giữ nguyên công việc hiện tại.
- Giữ RN Community CLI, Android chính; không Expo, SQLite hoặc emulator fallback.
- Admin credential chỉ ở BE; FE chỉ nhận URL API và client config công khai.
- “Xóa mock test” áp dụng dữ liệu giả và hành vi giả trong bản chạy; giữ unit/integration tests, fixtures chỉ phục vụ test độc lập.
- Production dùng Firebase Auth thật; không demo session, SMS OTP giả, selfie badge giả, GIF/sticker giả hay tự tạo tài khoản mẫu khi lỗi.
- Không diễn giải “đồng bộ hoàn toàn” thành mobile gọi Firestore trực tiếp. Mọi quyền vẫn qua API; rules client deny-all.
- Không dùng tên/email, thiếu `firebaseUid`, hoặc prefix namespace đơn độc để kết luận một tài khoản là test.
- Phạm vi kiểm chứng ban đầu: core đang có F01, F03–F10 và block/report F22. F02 và P06–P10 chưa có provider/implementation thật phải unavailable, không tự coi đủ 37F. Muốn hoàn thiện toàn roadmap cần kế hoạch tiếp theo theo từng phase.
- Đồng bộ dữ liệu core và sẵn sàng phát hành production là hai mốc nghiệm thu. Mốc production còn yêu cầu HTTPS, lưu ảnh bền vững, backup/restore, chính sách dữ liệu và vận hành.

## Hiện trạng xác minh từ source (chưa kiểm lại cloud)

| Nguồn | Phát hiện | Hành động |
|---|---|---|
| `scripts/common.mjs`, `.env.example` | DEMO_MODE mặc định true | Mặc định false, production chặn demo/seed |
| `apps/api/src/server.ts`, `firestore/context.ts` | Có seedDemo/FIRESTORE_SEED_DEMO | Loại seed khỏi entrypoint production |
| `apps/api/src/firestore/auth.ts`, `media.ts`, `chat.ts` | Demo session/OTP/selfie và catalog GIF/sticker còn ở BE | Tách khỏi runtime production, kiểm contract |
| `apps/api/src/firestore/seed.ts` | A/B/C/D có ID cố định, demoAccounts/seedMarkers và seed media | Dùng làm chứng cứ cho inventory, không xóa mù |
| `docs/qa/cloud-setup-2026-11-02.md` | QA namespace lịch sử `cloud-qa-09f3fe9c-5ffe-40b1-8616-1f28640df6ed` | Kiểm kê lại trước đưa vào manifest |
| `docs/qa/native-cloud-2026-11-02.md` | Native QA từng dùng namespace `app-cuoi-ky` | Namespace mặc định có thể lẫn dữ liệu thật và demo |
| `apps/mobile/src/screens/Login.tsx` | Dòng cần bỏ ở nhánh provider real, dưới GoogleSignInButton | Bỏ đúng nhãn phụ, giữ nút Google và thông báo lỗi/loading |
| `apps/mobile/App.tsx` | Default API debug `http://10.0.2.2:3000` | Release cần cấu hình endpoint rõ ràng |
| `apps/api/src/firestore/media.ts` | Firestore giữ metadata, ảnh ở filesystem BE | Chưa thể gọi ảnh là đã đồng bộ cloud hoàn toàn |

## Phân công và thứ tự

Tối đa 1 integrator + 2 worker đồng thời theo docs 06. Hai subagent lượt này chỉ rà soát: `audit_backend`, `audit_mobile`; không được triển khai. Khi triển khai, giao các gói bên dưới theo ownership, tái kiểm tra source trước khi sửa.

| Gói | Owner | Mapping task/F | Phụ thuộc | Timebox khảo sát + thực hiện ban đầu |
|---|---|---|---|---|
| A — Runtime thật | BE foundation | T01.01–03, T02.01, T02.03, T04.01 | Baseline/contract | 45–60 phút, báo lại nếu mở rộng |
| B — App thật và mở đầu | FE-test/product | T05.01, T11.01 / F01, F03–F10, F22 | Contract hiện có; song song A | 45–60 phút |
| C — Inventory và dọn data | Docs/data + integrator | T01.02, T05.02 / dữ liệu core | A khóa nguồn tạo demo; inventory trước apply | 30–60 phút, tùy số document |
| D — Điều kiện production | Integrator + BE media | T01.01, T02.02, T11.02 / F03, vận hành | A/B/C; cấu hình hạ tầng cụ thể | 30 phút đánh giá; ước lượng lại sau inventory |
| E — Review và QA độc lập | QA/reviewer | T05.02, T11.02 / core | A–D | 45–60 phút, thiết bị có sẵn |

Integrator giữ độc quyền `packages/contracts/src/index.ts`, `package*.json`, `apps/api/src/firestore/app.ts`, `context.ts`, `apps/mobile/App.tsx`, indexes và docs chung. Worker gửi đề nghị thay các file này để integrator tích hợp, không sửa chồng nhau.

### A. Runtime thật — BE foundation

**Sở hữu:** `scripts/common.mjs`, `scripts/demo.mjs`, `.env.example`, `apps/api/src/server.ts`, `apps/api/src/firestore/auth.ts`, `media.ts`, `chat.ts`, `seed.ts`, `scripts/firestore.mjs`; test tương ứng ở `scripts/test/startup.test.mjs`, `apps/api/test/firestore-config.test.ts`, `firestore-auth-profile.test.ts`, `firestore-interaction.test.ts`.

- [ ] Ghi baseline env mode không lộ secret; kiểm caller và test dependency trước khi tách seed/demo.
- [ ] Đặt DEMO_MODE=false cho đường chạy thường. Production từ chối cấu hình demo/seed/emulator thay vì âm thầm tiếp tục.
- [ ] Tách seed/demo fixtures sang tooling test; cloud startup không import/chạy seed. Tool seed còn giữ chỉ chạy test lane được chọn rõ.
- [ ] Production không cấp demo session/OTP/selfie demo; catalog GIF/sticker không còn trả thành công giả. Các chức năng chưa có provider thật trả unavailable/không xuất hiện trong app, cập nhật capabilities đúng sự thật.
- [ ] Giữ Firebase ID-token exchange, profile/preferences, ảnh thật, matching, REST/socket chat, unmatch/block/report. Không đổi UID mapping hay tự link theo email.
- [ ] Chặn/revoke phiên của fixture đã xác định khi chuyển mode: tắt endpoint demo không tự làm các session demo cũ mất hiệu lực. Không revoke phiên người thật ngoài phạm vi cleanup.
- [ ] Gửi diff contract/OpenAPI cho integrator; cập nhật docs cấu hình từ demo sang real-data runtime.
- [ ] Kiểm startup và test API bằng emulator riêng; mục tiêu là chứng minh production guards, không gọi emulator pass là cloud pass.

**Acceptance:** `/health` báo đúng cloud/project/namespace khi chạy thật; startup không tạo fixtures; mọi đường demo thất bại trong production; token giả/sai project/hết hạn và third-user chat đều bị từ chối.

**Verification:** `npm run test:startup`; `npm run test:firestore`; `npm run typecheck`. Bổ sung case kiểm `DEMO_MODE` mặc định false và production+seed bị reject; giữ case production demo-session không trả token.

### B. Mobile — bỏ nhãn phụ, dùng trạng thái dữ liệu thật

**Sở hữu:** `apps/mobile/src/screens/{Login,MyProfile,Discover,Matches,Chat,Safety}.tsx`, `src/api.ts`, `src/session.ts`, `src/firebaseAuth.ts`, `src/googleSignIn.ts`, `__tests__/login.test.tsx`, `client.test.ts`, `screens.test.tsx`. App.tsx do integrator sửa theo đề nghị. Preview chỉ chỉnh nếu đang có cùng nhãn phụ; preview vẫn là tài liệu thiết kế.

- [ ] Bỏ đúng câu `Tiếp tục bằng Google. Tài khoản mới sẽ được tạo sau khi bạn xác thực.` ở nhánh provider real. Không xóa hàng loạt mọi chuỗi “Tiếp tục”, nút Google hoặc thông báo unavailable/loading.
- [ ] Rà từng màn: loading/empty/error lấy từ API; DB rỗng hiển thị chưa có hồ sơ/kết nối/tin nhắn, không tự bù bằng mẫu.
- [ ] Kiểm mutation chỉ báo thành công sau API; lỗi lưu/upload/swipe/send hiển thị retry phù hợp. Chat retry giữ clientMessageId, không nhân đôi.
- [ ] Reconnect/đổi phiên/đổi tài khoản phải refetch đúng dữ liệu, không lưu cache hiển thị dữ liệu tài khoản trước. Block/unmatch thu hồi chat ngay.
- [ ] Kiểm trường hợp B like tạo match khi A đang foreground: audit chưa thấy `match:created`. Bổ sung event sau commit và resync REST có bounded refresh khi cần; integrator khóa contract, không để A phải đăng nhập lại mới thấy match.
- [ ] Tải lại profile/preferences khi mở màn hoặc foreground; sau PATCH tên cập nhật header từ response thay vì giữ `saved.session.user.displayName` cũ. Chỉ hiển thị empty sau GET thành công; không hiển thị vừa lỗi tải vừa kết luận không có dữ liệu.
- [ ] Sửa mô tả “Hồ sơ đã được đồng bộ” để phản ánh trạng thái GET/PATCH thực tế. Profile/settings dùng read-back và refresh khi mở/foreground; chat/match cần realtime hai chiều, không hứa mọi collection đều subscribe realtime.
- [ ] Release đọc API URL cấu hình rõ và HTTPS; giữ URL debug riêng để test Android local, không fallback debug trong release.
- [ ] Giữ layout/brand hiện tại, không mở dự án redesign mới; cập nhật test hiện có cho nhãn phụ biến mất.
- [ ] Cập nhật `apps/mobile/README.md` còn mô tả demo cũ. Không xóa Keychain service `vn.gap.demo.session` chỉ vì có chữ demo; nếu đổi tên phải xử lý phiên cũ/logout an toàn.

**Acceptance:** welcome không còn câu trên; Google/email thật còn dùng được; tài khoản mới không có dữ liệu mẫu; đăng xuất/đổi tài khoản không lộ dữ liệu cũ; kill/reopen/reconnect vẫn đọc đúng dữ liệu server.

**Verification:** `npm run test:mobile`, mobile typecheck/lint, `npm run android` và kiểm trực tiếp welcome, auth, profile, discovery, matches, chat, safety trên Android. Tài khoản Google thật cần người dùng thao tác chooser nếu phiên đăng nhập yêu cầu tương tác.

### C. Kiểm kê và dọn dữ liệu — docs/data + integrator

**Tạo khi thực thi:** `scripts/firestore-cleanup.mjs`, `scripts/test/firestore-cleanup.test.mjs`, `docs/qa/real-data-cleanup-2026-11-02.md`. Manifest/backup chứa dữ liệu riêng tư phải ở thư mục local ignored, không commit/chat. Integrator sở hữu `.gitignore` nếu cần bổ sung.

- [ ] Inventory read-only project đã cấu hình: namespace, collection counts, seedMarkers/demoAccounts, users demo IDs cố định, QA namespace có metadata/evidence tương ứng. Chưa biết nguồn gốc thì giữ lại và ghi ambiguity.
- [ ] Dựng manifest đường dẫn document/file cụ thể, lý do xác định synthetic, liên kết phụ thuộc, precondition updateTime và số lượng dự kiến; không đưa nội dung chat/PII vào báo cáo public.
- [ ] Kiểm tra dữ liệu phụ thuộc thực tế trong collection: profile/preferences/media, sessions, swipes/pair/match/messages/idempotency, block/report và identity mappings. Nếu có người thật tham gia hoặc dùng chung file thì giữ lại/đánh dấu xử lý riêng, không cascade xóa dữ liệu thật.
- [ ] Backup đúng tập synthetic sắp dọn và kiểm khả năng đọc/khôi phục trong test lane. Không thực hiện export có phí hoặc mở IAM chỉ vì cần backup.
- [ ] Dry-run là mặc định; apply bắt buộc exact project + manifest. Dừng nếu target khác, dữ liệu đã thay đổi, có document ngoài manifest hoặc thiếu backup; chạy lặp không xóa thêm.
- [ ] Khi được yêu cầu triển khai, trình manifest cụ thể trước bước xóa; chỉ apply phần có đủ bằng chứng và nằm trong phạm vi xóa mock người dùng đã yêu cầu. Không reset namespace/project; không xóa Firebase Auth users chỉ vì tên/email giống test.
- [ ] Dọn file media synthetic sau khi không còn reference, đường dẫn đã xác minh nằm dưới DATA_DIR dự kiến. Firestore xóa parent không thay việc duyệt/xóa subcollections theo manifest.
- [ ] Đối chiếu sau apply: synthetic targets hết, real-user counts/identity/media refs giữ nguyên theo baseline; cập nhật evidence QA lịch sử là artifact đã được dọn, không sửa kết quả lịch sử.

**Acceptance:** không còn fixtures xác định trong namespace runtime; dữ liệu thật được giữ; dry-run/apply idempotent; mismatch/ambiguous/mixed-user case đều không xóa; report có counts trước/sau và target, không secrets.

**Verification:** `node --test scripts/test/firestore-cleanup.test.mjs`; test manifest trên emulator riêng, gồm nested subcollection, mixed match, changed updateTime và path escape; sau đó read-only đối chiếu cloud theo manifest. Lượt hiện tại chưa inventory cloud và chưa có danh sách được phép xóa cuối cùng.

### D. Hoàn thiện điều kiện production — integrator

**Files dự kiến:** `apps/api/src/firestore/media.ts`, `context.ts`, `apps/mobile/App.tsx`, native release network config, `scripts/doctor.mjs`, `README.md`, `docs/12-ket-noi-firestore.md`, `docs/09-chay-demo-va-ban-giao.md`, `docs/handoff/be-to-fe.md`.

- [ ] Kiểm môi trường sẽ dùng để test thật: một BE hay hosting, endpoint HTTPS, credential riêng, namespace runtime và media volume hiện có; không tự mua dịch vụ hoặc deploy.
- [ ] Đánh giá lưu ảnh bền vững: filesystem volume có backup/restore cho một BE, hoặc object storage riêng tư. Nếu yêu cầu ảnh cũng lên cloud thì chọn provider/bucket có quyền và chi phí rõ trước khi viết migration; không coi metadata Firestore là ảnh đã lên cloud.
- [ ] Nếu đổi storage: giữ media ID/ownership, copy và verify object trước cutover, có rollback, không xóa file gốc trước read-back; API đọc ảnh vẫn kiểm quyền. Lập task migration cụ thể sau khi xác định storage đích.
- [ ] Kiểm release endpoint, CORS/socket auth, log redaction, giới hạn upload/rate, secret isolation; đo persistence sau restart BE và không phụ thuộc ổ tạm.
- [ ] Android release hiện còn ký debug ở `android/app/build.gradle`: nếu phát hành production, cấu hình release signing riêng và SHA/OAuth phù hợp, giữ key local/CI secrets; kiểm release build riêng, không nhận debug build là evidence phát hành.
- [ ] Ghi rõ backup/restore, retention/xóa tài khoản và quy trình report đang có; điểm cần chủ dự án quyết định ghi vào docs 07 khi thực thi, không tự đặt chính sách cho dữ liệu thật.

**Acceptance:** không tuyên bố production-ready nếu HTTPS, media durability/restore, real-account QA hoặc chính sách vận hành còn thiếu. Mốc có thể test dữ liệu thật được báo riêng khi core đã đạt.

### E. Review độc lập, tích hợp và bàn giao — QA/reviewer

**Sở hữu:** báo cáo QA mới `docs/qa/production-real-data-2026-11-02.md`; integrator cập nhật `docs/api/openapi.yaml`, `docs/08-hop-dong-api-va-du-lieu.md`, checklist 05 và handoff.

- [ ] Review diff theo spec và quyền truy cập, đặc biệt auth/session, manifest xóa, match/chat/media và không import fixture vào runtime production.
- [ ] Chạy `npm run typecheck`, `npm run lint`, `npm run test:startup`, `npm run test:firestore`, `npm run test:mobile` sau tích hợp; chỉ chạy lại khi có thay đổi/lỗi liên quan.
- [ ] Kiểm cloud bằng hai tài khoản thật do người dùng chủ động dùng: đăng ký/đăng nhập → hoàn thiện hồ sơ/ảnh → discovery → mutual match → chat → reopen/reconnect → block/unmatch. Người thứ ba không đọc được chat/media.
- [ ] Không tự tạo tin nhắn/gửi thông tin tới người dùng thật khác. QA viết dữ liệu cần tài khoản được chỉ định và ghi scope rõ; dữ liệu được tạo mới không giả danh user production.
- [ ] Sau restart API/app, so read-back profile/media/match/message và cập nhật ở client còn lại; retry không tạo message/match trùng.
- [ ] Kiểm GPS/gallery/camera từ chối và cấp quyền, bàn phím, TalkBack/font 200% ở màn bị đổi; ghi thiết bị/mode cụ thể.
- [ ] Bàn giao lệnh chạy dữ liệu thật, endpoint đã kiểm, tính năng unavailable, kết quả cleanup và giới hạn production còn lại; chỉ tick done khi có evidence mới.

## Các mốc hoàn tất

1. **M1 — Code sẵn sàng test thật:** A+B pass, cloud config thật, không runtime demo; chưa đồng nghĩa đã dọn cloud.
2. **M2 — Data sạch và core đã kiểm:** C hoàn tất manifest cleanup, QA core E trên tài khoản thật pass, không fixtures còn hiển thị.
3. **M3 — Production hoàn chỉnh trong phạm vi đã chốt:** D và E đạt các gate vận hành/release; nếu thiếu hạ tầng/storage/account proof thì báo chính xác phần chưa đạt, không gắn nhãn hoàn chỉnh.

**Trạng thái sau USER yêu cầu thực thi:** runtime/mobile/cleanup đã triển khai, tích hợp, review độc lập và kiểm thử. M1 đạt; cleanup M2 đạt (83 document/8 file synthetic được dọn, giữ dữ liệu hai Firebase users thật); native đăng nhập Firebase/GET core đã quan sát thành công. Full core smoke hai client thật và M3 phát hành Internet vẫn chưa nghiệm thu. Xem [báo cáo](../../qa/production-real-data-2026-11-02.md). Checkbox ở thân kế hoạch giữ danh sách công việc thiết kế ban đầu; kết quả thực tế và giới hạn được chốt trong báo cáo.
