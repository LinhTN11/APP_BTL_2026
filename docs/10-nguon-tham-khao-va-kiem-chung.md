# Nguồn tham khảo và giới hạn kiểm chứng

Ngày tra cứu: 01/11/2026. **Ghi chú sau D10:** các nguồn Expo/skills Expo bên dưới là lịch sử phương án cũ, đã ngừng áp dụng. Không dùng làm chỉ dẫn stack/build/native module hiện tại; RN Community CLI là bắt buộc. Các quyết định stack/UI là diễn giải áp dụng cho dự án; không phải Apple/Expo bảo chứng app.

## Nguồn yêu cầu

- Bản Word nguyên gốc được giữ trong `source/DANH SÁCH CHỨC NĂNG APP HẸN HÒ.docx`.
- SHA-256: `f81db92f97bb5156f6bdcf0190ecf93d867f58d586dc4fcd6aa49cc5695dffd0`.
- `source/yeu-cau-goc.md` giữ 37 dòng chức năng với mã đoạn Word để kiểm tra mapping.
- Chỉ dẫn về React Native, deadline, tổ chức BE/FE, Android, free/paid và docs/rules đến từ lời người dùng trong chat, được ghi riêng tại decision log; không gán ngược vào Word.

## Nguồn kỹ thuật chính

| Nguồn | Nội dung dùng trong thiết kế | Giới hạn |
|---|---|---|
| [Apple HIG — Materials](https://developer.apple.com/design/human-interface-guidelines/materials) | Liquid Glass thuộc lớp điều khiển/navigation, nội dung vẫn đọc rõ | Tuân thủ phải review theo màn thật; CSS preview không chứng minh native |
| [Apple HIG — Typography](https://developer.apple.com/design/human-interface-guidelines/typography) | Font hệ thống, phân cấp chữ, hỗ trợ scaling | Không tự đóng gói SF cho Android |
| [Apple HIG — Motion](https://developer.apple.com/design/human-interface-guidelines/motion) | Motion giải thích thao tác và trạng thái, hỗ trợ giảm chuyển động | Không lấy timing trong docs dự án làm thông số Apple bắt buộc |
| [Expo GlassEffect](https://docs.expo.dev/versions/latest/sdk/glass-effect/) | Native glass iOS26+, fallback regular View khi không hỗ trợ | Cần wrapper Android/fallback có thiết kế chủ động |
| [Expo BlurView](https://docs.expo.dev/versions/latest/sdk/blur-view/) | Blur trên các platform theo SDK/config | Test thiết bị thật, không hứa giống iOS native |
| [Expo LocalAuthentication](https://docs.expo.dev/versions/latest/sdk/local-authentication/) | Biometrics OS, Face ID không test được trong Expo Go iOS | Không thay auth server/session |
| [Expo start developing](https://docs.expo.dev/get-started/start-developing/) | Metro/QR/LAN và tunnel | Mạng API riêng phải cấu hình, tunnel Metro không bao gồm backend |
| [Fastify Getting Started](https://fastify.dev/docs/latest/Guides/Getting-Started/) | Route/plugin/validation nền tảng | Chưa scaffold hoặc kiểm integration của app |
| [Node SQLite](https://nodejs.org/api/sqlite.html) | Embedded SQLite API | Latest docs có thể khác Node24; chỉ dùng API runtime đã thử |
| [PocketBase introduction](https://pocketbase.io/docs/) | Backend đóng gói auth/realtime/SQLite, phương án so sánh | Không được chọn song song Fastify |
| [Supabase local development](https://supabase.com/docs/guides/local-development) | Local stack Windows cần CLI/container runtime | Không phù hợp default ít cài đặt nếu nhóm chưa có |
| [Expo skills repository](https://github.com/expo/skills) | Skill native UI, animation và navigation chính thức | Đã pin commit; ví dụ phải so với SDK thực tế |

Các nguồn Apple bổ sung được dùng chi tiết tại cuối docs UI; mở nguồn chính khi thay version/implementation.

## Kiểm tra thực tế trong lượt chuẩn bị

- Thư mục ban đầu không có source app hoặc Git repository. Không có commit/push/deploy trong lượt này.
- Đọc DOCX bằng ZIP/XML, đối chiếu 37 dòng chức năng, lưu bản nguồn và hash.
- Runtime hiện có: Node v24.15.0, npm 11.3.0; chạy `DatabaseSync(':memory:')` và truy vấn `sqlite_version()` thành công (3.51.3).
- Lịch sử cài 4 Expo skill local từ commit pinned; sau D10 đã archive vào `.agents/archived-skills/<name>/`, ngừng áp dụng. Không phải skill bắt buộc, không tự chạy script feedback trong skill.
- Prototype được kiểm tra trình duyệt theo [evidence](prototype/README.md). Chưa có kiểm tra React Native, API app, native Android, live OAuth/AI, payment hoặc selfie provider.
- Rà soát cuối: 37 mapping nguồn không trùng, 60 screen ID, 12 phase/35 task ID không trùng, checklist BE đủ 37 F và không thiếu target link Markdown nội bộ. Reviewer độc lập đã đối chiếu route/event/DTO/session giữa spec, roadmap và contract; các lệch đã sửa trước bàn giao.
- Năm skill cục bộ qua `quick_validate.py` sau khi chuẩn hóa frontmatter wireframe; dependency PyYAML được chạy tạm bằng `uv run --with pyyaml`, không thêm vào runtime app.
- Kiểm tra bổ sung bằng Playwright/Edge trên bản prototype cuối: mở trang, Bắt đầu khám phá → Thích hồ sơ → Match; console 0 error, 0 warning. Đã đóng browser và HTTP server local sau kiểm tra.

Các command được nêu trong kế hoạch là tiêu chí cho lần triển khai sau; không báo test API/build app đã pass chỉ vì kiểm tra docs/prototype thành công.
