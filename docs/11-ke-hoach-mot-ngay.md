# Kế hoạch thực tế: một ngày BE, một ngày FE riêng

Ngày BE: **01/11/2026, Asia/Saigon** theo yêu cầu người dùng. Ngày FE chưa được cung cấp; không tự giả định ngày 02/11. H0 là thời điểm bắt đầu implementation, không là cam kết còn đủ 8–10 giờ hôm nay. Đây là ước lượng cần điều chỉnh theo số giờ còn lại và tiêu chí chấm.

## 1. Kết quả cần ưu tiên

**Cam kết đề xuất để chốt:** backend local thật cho profile → discovery → like/match → chat → unmatch/block, seed/persistence, contract và màn React Native tối thiểu để bấm test. Auth có demo session minh bạch; OTP/SMS trả phí mô phỏng. Upload ảnh, GPS và các API thiết bị miễn phí được làm thật trong phạm vi đủ thời gian. Provider miễn phí cần tài khoản/config có nhánh tích hợp thật nhưng không chặn luồng core nếu chủ dự án chưa cung cấp config.

Toàn bộ 37 chức năng vẫn trong [roadmap 12 phase](04-ke-hoach-trien-khai.md). **Hoàn thành core một ngày không phải hoàn thành cả tài liệu Word.** Nếu tiêu chí chấm bắt buộc đủ ba phần, cần chốt lại phạm vi mô phỏng/nhân lực/thời gian trước khi cam kết.

## 2. Timebox ngày BE — khoảng 8 giờ tập trung + dự phòng

| Khoảng giờ tương đối | Công việc và task | Worker phù hợp | Đầu ra nghiệm thu |
|---|---|---|---|
| H0–H0.5 | P00: chốt lát core, stack, DTO/error/session, xem prototype | Integrator; người BE quyết định nghiệp vụ còn chặn | Snapshot contract, không tranh luận visual toàn bộ backlog |
| H0.5–H1.5 | P01: workspaces, API health, SQLite migrations/seed, config, Expo shell, scripts demo/doctor | BE foundation; worker FE-test độc lập sau contract | API + Expo Android mở được; chạy lại seed không trùng |
| H1.5–H3 | P02: demo session, me/profile, ảnh upload/quota; profile UI-test | BE domain + FE-test theo file ownership | A sửa profile, persist; không sửa được profile B; upload ảnh thật |
| H3–H4.25 | P03: discovery basic, like/pass, unique mutual match, unmatch | BE domain; QA review transaction | Hai client tạo một match; người bị block không xuất hiện |
| H4.25–H5.75 | P04: text chat REST + socket, retry ID, auth membership, block/report | BE realtime; FE-test dùng contract | A↔B nhận/lấy lại tin; C bị cấm; block/unmatch revoke |
| H5.75–H6.5 | F10 GPS một lần nếu consent đã chốt; gallery permissions; demo labels; các lỗi kết nối | BE + FE-test | Android permission thật, lỗi/retry rõ, không chia sẻ GPS đối phương |
| H6.5–H7.5 | P05: API negative tests, restart, second clone/run, OpenAPI/examples và handoff | QA độc lập, Integrator xử lý lỗi | Bằng chứng core, không thêm feature mới |
| H7.5–H8 | Buffer sửa P0/P1, freeze contract, quay kịch bản demo/ghi known issues | BE | Gói bàn giao FE có thể chạy |
| Nếu có H8–H10 | Google OAuth miễn phí khi đã có config hoặc GIF/sticker/video/profile verification flow | Một worker bounded | Chỉ chọn 1–2 việc theo tiêu chí chấm; không làm tất cả |

Các task chi tiết và file dự kiến nằm trong docs 04. Thời gian là ngân sách của **luồng công việc**, không cộng thành số nhân sự mới; subagent viết code không thay người BE nghiệm thu và xử lý thiết bị.

## 3. Thứ tự cắt phạm vi khi trễ

1. H1.5 chưa chạy được Expo/API trên Android: dừng mọi tích hợp ngoài; sửa mạng/config trước.
2. H3 chưa có profile/auth hoạt động: ưu tiên demo session, profile text và ảnh; social auth chuyển hàng đợi cấu hình, không giả gọi thật.
3. H4.25 matching chưa ổn: không xây AI/gói; sửa unique pair, authorization và match lifecycle.
4. H5.75 socket chưa ổn: REST chat + refresh thủ công có thể là bản dự phòng rõ hạn chế; realtime vẫn là task chưa đạt. Chỉ dùng khi người BE cần cứu demo, không tick socket done.
5. H6.5 khóa feature: dùng toàn bộ thời gian còn lại cho test, lỗi và bàn giao. Nếu core còn fail thì ghi phần fail và giảm scope công khai, không tự đánh dấu hoàn tất.

Không cắt kiểm tra quyền, persistence, block/unmatch, seed an toàn để đổi lấy màn AI/paid đẹp mắt.

## 4. Dịch vụ thật miễn phí trong giới hạn một ngày

| Mức | Ưu tiên | Điều kiện |
|---|---|---|
| A — không chờ tài khoản ngoài | API/DB/chat local; GPS/gallery/camera; share sheet; quiz/rule/fixtures có nhãn; calendar export | Làm thật khi chức năng được chọn vào ngày demo; không tự bật mọi tính năng mở rộng |
| B — miễn phí nhưng cần config/quyền | Google OAuth, provider nhạc, calendar cloud, nơi cung cấp bản đồ/AI free tier | Chủ dự án cung cấp cấu hình, kiểm lại điều kiện/free quota; timebox 30–45 phút cho mỗi adapter sau core |
| C — trả phí hoặc không có free path đã kiểm chứng | SMS, provider face/liveness, payment thật, AI mất phí | Mô phỏng rõ nhãn; logic workflow local có thể là thật nhưng provider result là demo |

Không ép thêm cloud chỉ vì có free tier. Không gọi thuật toán rule/template là AI thật. Không cam kết mọi provider “miễn phí” hoàn thành hôm nay khi chưa có tài khoản/quyền truy cập.

## 5. Ngày FE riêng — khoảng 8 giờ

| Khoảng giờ | Công việc | Kết quả |
|---|---|---|
| F0–F0.5 | Clone-run, đọc contract/handoff, test API health/session; ghi lỗi setup ngay | Chạy được trên máy FE trước khi thay UI |
| F0.5–F1.25 | Duyệt prototype core với chủ dự án; theme, typography hệ thống, glass/opaque wrapper | Tokens và navigation dùng lại được; nếu chưa duyệt giữ draft |
| F1.25–F3.5 | Welcome/login/OTP demo, setup/edit profile, discovery, profile detail, filter sheet | Khoảng 6–7 route/sheet core dùng API thật |
| F3.5–F5.5 | Match result/list, chat, unmatch/block/report sheet | Luồng A↔B hoàn chỉnh, keyboard/send retry đúng |
| F5.5–F6.5 | Loading/error/empty, dark, reduce transparency/motion, Android back/permissions | Không chỉ happy path; nút Save/Send không nằm dưới keyboard |
| F6.5–F7.5 | Hai client test với BE; báo reproduction/requestId; fix ưu tiên | Danh sách lỗi có owner và kết quả retest |
| F7.5–F8 | Demo cuối, ảnh màn, known issues và freeze | Bản FE core có bằng chứng, không nhận hoàn thành 60 màn |

Inventory 60 màn/sheet là yêu cầu phủ cho roadmap. Một ngày FE ưu tiên khoảng 10 route core với sheet dùng chung; các màn nâng cao triển khai theo phase và checklist riêng. Nếu yêu cầu nộp bắt buộc đầy đủ inventory, người dùng cần điều chỉnh mốc/nhân lực hoặc chấp nhận một phần prototype/demo.

## 6. Checklist bàn giao ngắn

- [ ] BE: source, lockfile, migrate/seed, hai lệnh chạy, OpenAPI/DTO/error examples, capabilities.
- [ ] BE-test: login/profile/discovery/match/chat/block/unmatch bấm được trên React Native Android.
- [ ] QA: A/B/C quyền, concurrent like, retry send, restart, clone sạch, tắt API/retry.
- [ ] FE nhận: thiết bị, Expo SDK/Go, API URL, test accounts, known issues, API freeze.
- [ ] FE-product: prototype đã được chủ dự án chốt; core screens và state coverage đã kiểm.
- [ ] Mọi tính năng ngoài core ghi trạng thái riêng: chưa làm/demo/real/blocked-config; không đánh đồng.

## 7. Thông tin còn cần bổ sung theo lúc thực hiện

Ưu tiên tiêu chí chấm bắt buộc; số giờ thực tế còn lại hôm nay; thiết bị Android; Google/provider credentials đã có; và giờ/ngày FE bắt đầu. Các câu hỏi chi tiết khác ở [decision log](07-cau-hoi-va-quyet-dinh.md), hỏi đúng phase để không làm gián đoạn việc độc lập.
