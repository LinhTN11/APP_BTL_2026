# Câu hỏi cần bổ sung và sổ quyết định

Ngày cập nhật: 02/11/2026 (Asia/Saigon). Các dòng `Dxx` ghi quyết định có căn cứ; mặc định trong câu hỏi chưa giải đáp vẫn là **đề xuất để tiếp tục chuẩn bị**. Không cần chờ mọi câu hỏi để viết docs hoặc prototype; phải chốt các blocker trước khi code phần phụ thuộc hoặc bật dịch vụ thật.

## 1. Quyết định đã có căn cứ

| ID | Quyết định | Nguồn | Tác động |
|---|---|---|---|
| D01 | Mobile bắt buộc React Native | USER | Không đổi sang Flutter/web app để thay app chính |
| D02 | Ưu tiên nhanh, dễ đọc, nhóm clone chạy được | USER | Hạn chế hạ tầng, có seed và hướng dẫn đồng nhất |
| D03 | Người dùng hiện được giao BE; có thể dựng một số UI để test nút | USER | Tách checklist BE, UI thử và UI FE hoàn thiện |
| D04 | UI chủ đạo Apple Liquid Glass, cần đầy đủ màn và prototype trước khi chốt | USER | Thiết kế đủ inventory; prototype là đầu vào duyệt UI |
| D05 | Docs đặt trong `docs/`; AI kiểm docs trước khi làm; có kế hoạch subagent tối ưu chi phí | USER | `AGENTS.md` và workflow phải dẫn tới docs |
| D06 | Tài liệu nguồn có ba phần và 37 dòng chức năng | ORIGINAL | Không âm thầm bỏ phần nâng cao/mở rộng; chia phase |
| D07 | Android là nền tảng chính | USER bổ sung | Ưu tiên Android, không chặn demo vì thiếu iPhone/Mac; glass cần fallback phù hợp Android |
| D08 | Nhóm có 1 BE là người dùng và 1 FE; BE cần xong hôm nay 01/11/2026; FE có một ngày làm riêng | USER bổ sung | Kế hoạch ngày BE ưu tiên core end-to-end và handoff; full backlog 37 chức năng tách các phase sau, không hứa đủ mọi live integration trong một ngày |
| D09 | Dịch vụ miễn phí làm thật, dịch vụ trả phí mô phỏng | USER bổ sung | DB/chat/rule/quiz và năng lực thiết bị làm thật trong phase tương ứng; từng provider phải kiểm quota/điều kiện/cấu hình, phần trả phí có adapter demo và nhãn |
| D10 | Bắt buộc React Native Community CLI, không Expo; thay thế phương án Expo trước đây | USER, 01/11/2026 | Native Android/iOS projects, Android SDK/JDK/Gradle/ADB và Metro; khóa stable RN/CLI/React qua package-lock, không dùng Expo Router/module expo-* |
| D11 | Sau kiểm tra cho phép triển khai core P01–P05 bằng subagent theo ownership | USER, 01/11/2026 | Cho phép core + UI-test BE; DB SQLite khi đó đã được D12 thay bằng Firestore; không phải duyệt visual FE-product hay cam kết xong 37F/60 màn/12 phase hôm nay |
| D12 | Cloud Firestore là DB chính; người dùng chưa có Firebase project | USER, 01/11/2026 | Thay SQL local bằng Admin SDK async + transaction/document/index; giữ RN Community CLI/no Expo. SQL core/extensions là reference, không cloud. BE tạo project riêng một lần và credential được cấp quyền; FE chỉ cần API URL. Chưa có project/credentials nên cloud read/write pending; emulator test ghi riêng. Xem [12](12-ket-noi-firestore.md) |
| D13 | USER cho phép tạo credential Admin SDK local cho Firebase project `app-cuoi-ky-2d653`, tiếp tục smoke/handoff core P01–P05 và giao việc theo model trong work dispatch | USER, 02/11/2026 | Current setup: Standard database in `asia-southeast1` on Spark (operator-selected defaults, not a user-mandated region/plan). Credential file is ignored; never print its contents, commit, or share it. `firestore:check`, create-only seed, and bounded HTTP cloud smoke passed; client rules are deny-all and indexes are READY. CLI deploy got 403 `serviceusage.services.get`; credential lacks `datastore.indexes.create`. No IAM expansion. Smoke namespace and remaining limits: [cloud evidence](qa/cloud-setup-2026-11-02.md). |

### D14 — Dọn repo và UI-test phục vụ BE (USER, 02/11/2026)

Người dùng yêu cầu chia subagent dọn code/ghi chú cũ không dùng, bổ sung màn đăng nhập/đăng ký theo Liquid Glass, xử lý việc BE khả thi, đơn giản hóa khởi động và làm rõ secret khi bàn giao. Áp dụng T01.01/T01.03/T02.01/T02.02/T05.01 (F01,F03–F10): xóa backend SQL unreachable, giữ yêu cầu gốc/backlog và evidence; báo cáo điều phối/API SQL cũ/skill Expo chuyển `.local/` ignored. Root giữ scripts/contract/docs, worker BE giữ API, worker FE-test giữ màn/theme. Acceptance: chỉ Firestore runtime, không import SQL/Expo, lệnh BE/FE riêng, OTP đăng ký dùng API hiện có, profile partial update không mất trường, tests/build và UI preview. Không cấp phạm vi cloud writes, seed/reset, provider mới, push/deploy; không là duyệt FE-product.

### D15 — Màn thật, Google và nhận diện mới (USER, 02/11/2026)

Người dùng yêu cầu bỏ hoàn toàn màn demo, làm trước các màn BE hiện hỗ trợ, bắt buộc Google Sign-In; bỏ nền biển/nút dừng nền/code thừa; nghiên cứu và tạo bộ nhận diện, mascot/nền sinh động riêng của app, tham khảo cách dùng nhân vật của Duolingo nhưng không sao chép màu/nhân vật. Giữ Liquid Glass ở các thanh bar, đổi ô nội dung sang vật liệu khác. Người dùng yêu cầu chia subagent để tối ưu quy trình/chi phí và tiếp tục công việc.

Áp dụng T00.02/T02.01/T02.02/T03.01–T04.03/T05.01, F01,F03–F10,F22/F24 trong core có BE. Integrator giữ navigation/UI/assets chung; worker auth kiểm token/nonce/identity và contract; worker thiết kế giữ brand/prototype. Acceptance: app không còn fixture login/OTP/selfie/GIF mô phỏng hoặc công cụ BE, không tự fake provider; các màn hồ sơ/media/discovery/match/chat/safety nối API thật; Google identity do BE xác minh và nonce dùng một lần; header/tab/composer giữ kính, nội dung đặc; asset/nền biển và nút dừng được gỡ; có preview và verification Android/test. Nhận diện Gặp/Mầm san hô/mận/kem là **PROPOSAL**, chưa có người dùng chốt visual; không đóng toàn bộ 37F hoặc FE-product.

Follow-up USER: “tôi có firebase mà, bạn dùng computer use để lấy thứ cần dùng” cho phép đọc cấu hình OAuth cần thiết từ Firebase Console hiện có. Hai lần Computer Use tự dừng vì không xác định được URL Edge đủ chắc chắn; chưa lấy được OAuth client ID, chưa tạo client hoặc thay IAM/cloud config. Firestore credential hiện có không thay OAuth Web/Android client. [Google setup/contract](google-sign-in.md), [brand](design/brand-2026-11-02.md), [QA hiện tại](qa/product-ui-2026-11-02.md) ghi trạng thái tiếp theo; không tuyên bố Google live đã chạy chỉ từ test local.

Demo endpoints/fixtures BE giữ cho test tool, không còn trong sản phẩm. Không có phạm vi reset, seed lại hay xóa dữ liệu cloud, push/deploy hoặc dịch vụ trả phí từ yêu cầu đổi UI này. Evidence cloud/native trước giữ nguyên lịch sử.

### D16 — Phản hồi nhận diện và delegation (USER, 02/11/2026)

Người dùng chưa chấp nhận V1: font quá chung, mascot bị cô lập trong ảnh, lời mascot phải là bong bóng chat; yêu cầu nhân vật đan trước/sau các lớp chữ/bố cục, nhiều cử chỉ tương tác, chuyển động mượt sau đăng nhập. Nền cần là cảnh có chiều sâu để có thể chuyển động, không chỉ vài họa tiết. Dùng font có cá tính và hỗ trợ tiếng Việt; V2 đang là PROPOSAL, không đánh dấu duyệt visual. Người dùng nhắc phải giao subagent làm phần triển khai để tiết kiệm quota; điều phối giữ tích hợp/review, tối đa hai worker đồng thời theo docs06.

Để hoàn thành yêu cầu đăng ký/đăng nhập thật trong khi OAuth chưa lấy được config, triển khai thêm email/mật khẩu qua Firestore (PROPOSAL implementation choice trong scope F01). Google vẫn là phương thức độc lập bắt buộc; không gộp identity theo email, không giả email verification/reset. Contract và giới hạn: [email](email-sign-in.md). Không mở thêm phạm vi cloud seed/reset, gửi mail hoặc deploy.

### D17 — Firebase Authentication SDK và cấu hình app (USER, 02/11/2026)

USER yêu cầu Firebase dùng SDK, đã bật Auth trên Console; yêu cầu tiếp tục delegation tiết kiệm quota. USER cho phép đăng ký Firebase Web app “Gap Mobile Auth”, sau đó cho phép Android “Gặp Android” package com.gapmobile và SHA-1 debug để dùng Google Sign-In. Integrator đã dùng Management REST API đăng ký hai app và SHA-1; SDK public config lưu .env.local ignored. GET provider config xác nhận Google enabled và EmailPassword enabled; lấy đúng Web/Android OAuthclient. Không tạo Admin key, thay IAM, đổi gói hoặc seed/reset DB. Không đăng ký người dùng cloud để kiểm thử.

App dùng Firebase JS SDK modular chính thức, transient inMemoryPersistence, Firebase ID token đổi sang opaque session qua Admin verifyIdToken(checkRevoked=true). UID Firebase là identity; không link email cũ tự động. Custom scrypt/direct Google exchange của D15/D16 ngừng dùng (410), source/test obsolete được gỡ; dữ liệu legacy giữ nguyên. [Contract](firebase-auth.md). Auth emulator/Firestore emulator và component checks phải ghi riêng với đăng nhập Google thật. Visual D16 vẫn chưa duyệt.

## 2. Câu hỏi theo thời điểm phải chốt

| ID | Cần người dùng bổ sung/chọn | Mặc định đề xuất để chuẩn bị | Cần chốt trước | Liên quan |
|---|---|---|---|---|
| Q01 | **Đã giải đáp về deadline và nhân sự:** 1 BE xong ngày 01/11/2026, 1 FE làm một ngày riêng. Còn thiếu số giờ thực tế có thể làm hôm nay | Không quy đổi một ngày thành cam kết 37 tích hợp; dùng kế hoạch core và điểm cắt giờ | Lập lịch giờ nếu cần | D08 |
| Q02 | Giảng viên yêu cầu đủ 3 phần hay chấm chủ yếu Phần 1? Phải có tích hợp thật nào? | Core end-to-end trước, mọi chức năng còn lại giữ roadmap; adapter demo có nhãn | Cam kết scope và tiêu chí nộp | F01–F37 |
| Q03 | **Đã giải đáp: Android chính.** Chỉ cần bổ sung mẫu máy/Android version nếu có để kiểm hiệu ứng và quyền thiết bị | Android thật hoặc emulator là tiêu chí demo; kiểm native iOS riêng sau nếu có nhu cầu | QA thiết bị | D07 |
| Q04 | **Project/credential đã cấu hình theo D13.** Indexes READY và cloud A/B/C smoke đã có evidence; không tái sử dụng project WebGI hay dữ liệu khác | Firestore là DB chính; emulator chỉ là lane test; thiếu cloud config fail có hướng dẫn | A/B/C cloud smoke và handoff evidence | D02, D12, D13 |
| Q05 | Chỉ 18+ và dùng dữ liệu mẫu được không? Có yêu cầu bảo mật/điều khoản riêng của trường không? | 18+, fixture có quyền dùng, không dữ liệu nhạy cảm thật trong demo | Auth/onboarding | F01, F06 |
| Q06 | Còn thiếu bằng chứng Google sign-in bằng tài khoản thật trên thiết bị | Cấu hình Firebase Web/Android, OAuth client/package/SHA-1 debug và bật provider đã được xác nhận ngày 02/11 theo D17; không cần xin lại credential cho bản debug. [Trạng thái và contract](firebase-auth.md). Không suy cấu hình thành đăng nhập thật đã pass | Nghiệm thu provider/native Google thật | F01, D17 |
| Q07 | “Chính chủ” là xác nhận đang kiểm soát số điện thoại hay phải đối soát danh tính thuê bao? | OTP chỉ tạo `phone_verified`; không dùng nhãn danh tính pháp lý | F11 live/nhãn badge | F11 |
| Q08 | Selfie cần AI thật/liveness hay luồng nộp ảnh và duyệt thủ công đủ demo? Ai duyệt, giữ ảnh bao lâu? | Manual/demo có nhãn riêng; badge không giả xác minh khuôn mặt thật | Selfie implementation | F02 |
| Q09 | “Chia sẻ vị trí của đối phương” thực tế có nghĩa hai người tự gửi vị trí của mình? Cần live location không? | Người dùng tự chia sẻ vị trí bản thân; chỉ một điểm, không theo dõi nền | Location chat | F10 |
| Q10 | Ảnh/video giới hạn MB, video dài bao lâu; cần ảnh chat thật ở đợt nào? | Profile 9 tệp; ảnh ≤10MB; video ≤30MB/30s; ảnh chat ở moderation phase | Upload/schema media | F03, F21 |
| Q11 | Unmatch có xóa lịch sử không, có được Match lại? Giữ dữ liệu báo cáo bao lâu? | Đóng quyền ngay, ẩn chat; không tự phục hồi khi unblock; retention cần chính sách cụ thể | Match/chat state machine | F08, F22, F24 |
| Q12 | Cấm vĩnh viễn có bắt buộc tự động từ AI hay chấp nhận duyệt/khiếu nại? Ai có quyền xử lý? | Quarantine + cảnh báo + người duyệt; không tự ban vĩnh viễn từ một score | Moderation | F19, F21 |
| Q13 | Danh bạ cần tích hợp thật không? Có được gửi số điện thoại/định danh nào lên server? | User block trước; contact block tách riêng với consent và tối thiểu dữ liệu | Contact blocking | F22 |
| Q14 | Bộ câu hỏi tính cách, thuật toán chấm và quyền sử dụng nội dung do ai cung cấp? | 24 câu tự soạn để tham khảo, phiên bản rõ; không gọi là chẩn đoán/MBTI chính thức | Personality quiz | F14 |
| Q15 | Có Spotify/Apple Music developer access không; lấy top track hay danh sách người dùng chọn? | Fixture và nhập tay; adapter live chỉ scope tối thiểu | Music import live | F15 |
| Q16 | “Ẩn danh” là ẩn với đối phương hay không lưu danh tính ở hệ thống? Khi nào được đánh giá một buổi hẹn? | Riêng tư với đối phương; BE giữ liên kết chống abuse; sau buổi hẹn đã kết thúc | Reputation/recommendation | F23, F24 |
| Q17 | Dữ liệu địa điểm/voucher từ đâu? Có đối tác thật hoặc API bản đồ nào được phép dùng không? | Seed địa điểm và voucher demo có nhãn; không cam kết an toàn/ưu đãi thật | Venues/maps | F25, F26 |
| Q18 | Nếu có kênh SOS miễn phí thực sự: gửi cho ai, ai vận hành nhận tin, có quy trình nào? | Kênh trả phí mô phỏng theo D09; GPS thiết bị làm thật. Không có nơi tiếp nhận thì chỉ preview/share có nhãn, không gọi là cứu hộ thực | SOS live | F28 |
| Q19 | Chia sẻ kế hoạch dùng share sheet hay link xem được không cần tài khoản? Có expiry/thu hồi không? | Share sheet có preview; nếu có link thì token ngẫu nhiên, expiry và revoke | Date plan share | F27 |
| Q20 | Có provider AI miễn phí hợp lệ, quota và chính sách dữ liệu nào được chấp nhận; chat nào được gửi ra ngoài? | LLM trả phí mô phỏng theo D09; rule/template ghi rõ không phải AI thật. Free tier chỉ live khi kiểm điều kiện và đủ config | AI live | F29–F33 |
| Q21 | “Danh sách lựa chọn” Gold là curated picks hay xem người đã thích mình? Gold có kế thừa Plus không? | Curated picks; Gold kế thừa Plus; không tự thêm tính năng “Who liked you” chưa có trong nguồn | Entitlement matrix | F35, F36 |
| Q22 | Quota Free/Super Like, thời lượng Boost/Super Boost, số bước Rewind, quy tắc Incognito? | Lưu cấu hình demo có phiên bản; phải chọn số cụ thể trước khi triển khai | Paid features | F34–F36 |
| Q23 | **Đã chốt chính sách: phần trả phí mô phỏng.** Còn cần chốt bảng quyền/quota để mô phỏng nhất quán | Demo entitlement, không thu tiền; không tạo ads thật chỉ để demo quyền no-ads | Entitlement matrix | F34–F36, D09 |
| Q24 | Calendar cần export một chiều hay đồng bộ hai chiều? Ai sở hữu event và xử lý chỉnh sửa xung đột? | Lịch nội bộ + export một chiều có permission; chưa hứa sync hai chiều | Calendar integration | F37 |
| Q25 | Tên app, logo, màu nhấn, ngôn ngữ, tham chiếu UI cụ thể? | Tên working title, tiếng Việt, nền trung tính/ảnh nội dung, Liquid Glass dùng ở lớp điều khiển | Chốt prototype hi-fi | D04 |
| Q26 | Khi có đề nghị xóa tài khoản, xóa chat/selfie/location thế nào và dữ liệu báo cáo giữ ra sao? | Demo có reset cục bộ; live retention phải được chốt riêng, không đặt chính sách pháp lý thay người dùng | Dữ liệu người thật/live | Toàn bộ |

## 3. Ba câu trả lời có giá trị nhất để bắt đầu

1. Yêu cầu chấm điểm cụ thể: Phần 1 hay đủ cả 3 phần; chức năng nào bắt buộc xuất hiện trong demo hôm nay.
2. Xác nhận OAuth Web/Android client đúng project/package/SHA-1 để kiểm Google thật; Firestore credential không thay cấu hình này, app không dùng demo fallback.
3. Xác nhận cách hiểu vị trí F10, tiêu chí selfie F02 và chính sách xử lý ảnh F21 trước khi làm các phần đó.

Không cần người dùng trả lời cả 26 câu trong một lần. Các câu sau được hỏi đúng phase; phần không phụ thuộc vẫn tiếp tục.

## 4. Mẫu ghi quyết định khi nhận câu trả lời

Mỗi quyết định mới ghi: `ID`, ngày, người quyết định, câu hỏi gốc, lựa chọn, lý do, tài liệu/API/schema/test bị ảnh hưởng và trạng thái áp dụng. Giữ lại lịch sử quyết định bị thay thế bằng liên kết tới quyết định mới; không sửa im lặng thành “đã chốt”.

Ví dụ cú pháp (chỉ hướng dẫn, không phải một quyết định đã được duyệt):

```text
ID: D07
Ngày: ngày nhận câu trả lời
Người quyết định: chủ dự án
Thay đổi: Q09 → vị trí một lần do chính người gửi chủ động chia sẻ
Ảnh hưởng: F10, API message/location, permission UI, privacy test
Trạng thái: chờ triển khai / đã triển khai và kiểm tra
```

## 5. Rủi ro phải hiển thị trong báo cáo tiến độ

- **Phạm vi lớn:** 37 dòng gồm nhiều tích hợp ngoài; deadline BE đã chốt hôm nay 01/11/2026 nên ưu tiên core thực và bàn giao, không hứa hoàn thành mọi live provider trong một ngày.
- **Demo dễ bị hiểu nhầm là live:** phải có nhãn và tách trạng thái kiểm tra provider, đặc biệt OTP, selfie, AI, SOS và entitlement.
- **Apple Liquid Glass phụ thuộc nền tảng:** prototype web không chứng minh hiệu ứng native, cảm ứng, keyboard, VoiceOver hoặc hiệu năng thiết bị.
- **Clone chạy ngay vẫn có điều kiện môi trường:** cần Node phiên bản phù hợp, cài dependency, JDK/Android SDK, native build/install, thiết bị/ADB/Metro, mạng LAN/firewall; README và doctor phải nêu rõ, FE không cần secret; BE cần setup project riêng/credential hợp lệ theo D12, không commit key; emulator không là cloud thật.
- **Nội dung nhạy cảm và vị trí:** phân quyền, consent, giới hạn lưu, báo cáo và kiểm duyệt phải cùng đi với tính năng; không để UI thử làm lộ tọa độ/ảnh gốc.
- **Ẩn danh và xác minh:** không dùng các nhãn mạnh hơn bằng chứng kỹ thuật thực sự cung cấp.

### D18 — UI gọn và logo Gặp (USER, 02/11/2026)
Bỏ chữ phụ cam/font trang trí và icon/emote có sẵn; header thường có logo tự vẽ; animation chữ gặp chuyển thành logo. Dùng taste và tham khảo app thật, phân việc model tiết kiệm, docs gọn để review. T00.02/T11.01, F01/core UI; implementation là PROPOSAL chưa duyệt visual. [Review](design/brand-2026-11-02.md). Không đổi contract hoặc quyền cloud.

### D19 — Logo animation qua editor chuyên nghiệp (USER, 02/11/2026)
Giữ chữ gặp tròn/màu cam, sửa chồng chữ; dùng ArtCraft/EffectCraft qua CLI/MCP, xuất animation dạng Lottie thay tween chữ CSS/RN. T00.02/T11.01, FE-product, không thay API/Firestore. Source timeline và artifact trong [review gọn](design/brand-2026-11-02.md); visual chưa duyệt.

### D20 — Dữ liệu thật và bỏ nhãn phụ (USER, 02/11/2026)

USER yêu cầu đồng bộ DB thật, xóa data mock/test, bỏ dòng “Tiếp tục…” ở mở đầu; sau kế hoạch đã yêu cầu triển khai ngay, chia subagent và xác nhận dữ liệu đều của mình, chưa phải production. T01.01–03/T02.01–02/T03.01–03/T04.01/T05.01–02/T11.02, F01/core/F22. Cloud mặc định demo=false, từ chối demo/seed; tests giữ trong emulator riêng. Đã dọn tập seed/QA theo provenance + backup local: 83 document và 8 file giả, giữ 15 document/hai Firebase users tại thời điểm cleanup. Không reset tài khoản thật; không push/deploy/mua dịch vụ. BE/media vẫn local + filesystem, chưa phát hành Internet. [Evidence](qa/production-real-data-2026-11-02.md).

### D21 — Khám phá, GPS và chọn giao diện (USER, 02/11/2026)

USER yêu cầu chia subagent xem/sửa khám phá không có người, GPS không hoạt động và thêm nút sáng/tối/theo thiết bị tại Tôi. T03.01/F06, T04.02/F10, T05.01/T11.01; BE chẩn đoán + regression, FE-native GPS, integrator shared UI/docs. Giữ policy hồ sơ hoàn chỉnh và privacy; bổ sung hướng dẫn thiếu bio/ảnh thay vì tự sửa dữ liệu thật. Giao diện dùng ba lựa chọn, mặc định theo thiết bị, lưu local tách session (PROPOSAL implementation trong phạm vi đã yêu cầu). Không đổi quyền cloud/push/deploy, chưa coi visual được duyệt. [Evidence và giới hạn](qa/discovery-gps-theme-2026-11-02.md).

### D22 — Khám phá theo vị trí/bán kính (USER, 02/11/2026)

USER báo vẫn không có người, yêu cầu lập kế hoạch chia subagent rồi yêu cầu “tiến hành và cho subagent thực thi”. Chẩn đoán mới: cả hai hồ sơ đã hoàn thiện, hai vị trí consent đang lưu >10.000 km, vượt radius 1.000/100 km; không tự suy ra vị trí nào sai. T03.01/T05.01/T05.02, F06: thêm owner location status, hiển thị radius/thời điểm vị trí và cập nhật GPS có preview/consent ngay tại Khám phá; reload dữ liệu đã lưu. Giữ policy radius, không thêm “mọi khoảng cách” hoặc tự ghi/xóa data thật. [Kế hoạch](superpowers/plans/2026-11-02-discovery-radius-fix.md), [QA/giới hạn](qa/discovery-radius-2026-11-02.md).

### D23 — Chuẩn hóa full BE và bảo vệ secret (USER, 03/11/2026)

USER yêu cầu rà soát đầy đủ yêu cầu để hoàn thiện BE, tinh gọn tài liệu cho BE coding bằng AI, hướng dẫn bàn giao cấu hình cho FE, tạo lớp chặn push nhầm secret và chia việc cho subagent rẻ nhất. USER chọn rõ: **“Chốt đủ yêu cầu + backlog BE, sửa tài liệu và lớp chặn secret ngay”**. Lượt này không triển khai toàn bộ tính năng thiếu của 37F; không có deadline full BE mới.

- Owner: integrator BE/docs; hai worker tiết kiệm chia ownership audit yêu cầu và secret guard, tối đa hai worker đồng thời. T00.01/T00.03/T01.01/T11.02; F01–F37 là phạm vi truy vết, không đóng feature bằng việc viết docs.
- Đầu ra: [BE guide](backend/README.md), [ma trận/gap 37F](backend/requirements.md), đường đọc theo task, [bàn giao FE](handoff/be-to-fe.md), [secret guard](security/secrets.md) và [evidence riêng](qa/backend-docs-security-2026-11-03.md).
- FE chỉ cần URL API; client Firebase/OAuth config công khai do API cung cấp. Secret server không bàn giao cho FE-product. Người cần tự chạy BE được cấp credential/quyền riêng trên máy BE, không dùng khóa tác giả.
- Bảo vệ ở máy clone và CI không bảo đảm “không thể” rò mọi secret: hook có thể bị bypass, mẫu nhận dạng có giới hạn. GitHub push protection/ruleset cần owner cấu hình; chưa được tự bật hoặc báo đã bật trong lượt local này.
- Không push/deploy, mua dịch vụ, ghi/reset dữ liệu cloud hay mở IAM. Nguồn gốc và evidence lịch sử giữ nguyên. Các Q nghiệp vụ/provider vẫn chốt đúng phase; chuẩn hóa docs không biến PROPOSAL thành USER.

### D24 — FE clone BE và dùng đúng DB cloud test chung (USER, 03/11/2026)

USER làm rõ cuối cùng: **“tôi gửi secret qua zalo cx đc, bắt buộc phải dùng đúng db cloud còn be thì bên fe clone về”**. Lựa chọn này thay luồng chỉ nhận URL ở D23 cho onboarding mặc định; vẫn có thể trỏ app về một BE chung khi test realtime/ảnh.

- Owner BE/tooling, T01.01/T11.02; F01–F37 xuyên suốt cấu hình. FE clone repo và chạy BE local; giữ nguyên Firebase project + Firestore namespace của team, không tạo DB riêng hoặc tự dùng emulator.
- USER cho phép chia sẻ credential của môi trường team test hiện có qua file gửi riêng, ví dụ Zalo. Tạo `secrets/team-config.json` bằng `team:export`; nhận bằng `team:setup -- --file ...`. Không phát secret trong nội dung chat, mobile bundle hoặc Git. Hạn chế cũ “không chia khóa tác giả cho FE” được thay trong phạm vi credential BE test của team được USER cho phép này; không mở rộng sang credential project khác.
- Tài khoản/dữ liệu hiện là của team test. Việc chạy app/BE có thể sửa cùng dữ liệu cloud; không mô tả đây là production chưa được cho phép. Lượt onboarding không cần tự seed/reset/xóa DB hoặc sửa IAM.
- Bundle chỉ chứa allowlist config cần chạy cloud/auth và service account; không sao chép toàn bộ env, session, secret không liên quan. Import tự sửa đường dẫn credential cho máy nhận, kiểm project/namespace và cloud mode, không in secret; Git guard tiếp tục chặn file secret.
- Bytes media hiện ở filesystem BE, socket message fanout hiện trong một BE; cùng DB không đồng nghĩa đã giải quyết hai phần này cho nhiều BE. Ghi rõ trong handoff; không tự triển khai storage/broker/provider hoặc deploy ngoài phạm vi setup.
- Hai worker tiết kiệm theo ownership: tool export/import + test; tài liệu onboarding. Integrator quản lý scripts npm, entry docs và evidence. [Handoff](handoff/be-to-fe.md), [QA lượt này](qa/team-cloud-setup-2026-11-03.md).

### D25 — Vị trí secret cố định và Swagger API (USER, 03/11/2026)

USER yêu cầu đặt secret theo đường dẫn chuẩn trong thư mục dự án để FE nhận qua Zalo và đưa vào đúng chỗ, cập nhật handoff, đồng thời viết Swagger API. Owner BE/tooling/contract, T01.01/T00.03/T11.02, F01–F37 xuyên suốt tài liệu API.

- FE đặt file nhận tại `PROJECT_ROOT/secrets/team-config.json`, chạy `npm run team:setup` không tham số. Lệnh trích credential vào `secrets/team-firebase-service-account.json` và tạo/cập nhật `.env.local`, tự tính đường dẫn tuyệt đối theo máy nhận. `--file` giữ tương thích cho trường hợp cần chọn nơi khác. D24 vẫn khóa đúng cloud project/namespace và Git guard vẫn áp dụng.
- Swagger UI tại `/docs`, spec tại `/docs/json` và `/docs/yaml`; phục vụ tài nguyên local trên BE từ contract đã sinh. 41 operation hiện có, gồm mô tả route cũ đã ngừng hỗ trợ và fixture chỉ ở emulator; không thêm API roadmap chưa triển khai.
- Authorize dùng opaque API session từ Firebase exchange, không phải Admin credential. Public docs không đổi quyền API nghiệp vụ; UI không giữ token qua reload, không gửi spec tới online validator. Thao tác Try it out có tác dụng thật theo endpoint trên DB đang chọn; hướng dẫn bắt đầu bằng GET health.
- Lượt này đã áp dụng import vào cấu hình local của máy nguồn theo đường dẫn chuẩn, có backup local theo script; không sửa/reset document cloud. BE được mở local để kiểm Swagger qua browser; không deploy/push hoặc gửi file Zalo bằng tool.
- [Bàn giao](handoff/be-to-fe.md), [API](api/README.md), [QA lượt này](qa/swagger-secret-path-2026-11-03.md).
