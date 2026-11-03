# D20 — Bản chạy dữ liệu thật, 02/11/2026

Scope USER: triển khai kế hoạch real-data, xóa mock/test của chủ dự án, bỏ nhãn phụ mở đầu, chia subagent có giám sát. Không push/deploy, không mua dịch vụ hoặc đổi IAM. Giữ các thay đổi có sẵn trên `feat/rn-cli-demo`.

## Kết quả

- Cloud runtime mặc định `DEMO_MODE=false`; cloud từ chối demo/seed, production mode từ chối emulator. Fixture tokens cũ và demo targets không truy cập được trong real mode. OTP/selfie/catalog GIF/sticker trả unavailable, không fake success.
- App bỏ câu “Tiếp tục bằng Google. Tài khoản mới sẽ được tạo sau khi bạn xác thực.” dưới nút Google; giữ nút và lỗi/loading cần thiết.
- `match:created {matchId}` gửi đúng thành viên sau commit; listener membership phát hiện match ở BE khác. App debounce rồi tải lại REST và subscribe membership thực tế. Event có thể lặp; REST là nguồn chuẩn.
- Hồ sơ/header cập nhật từ response; foreground tải dữ liệu mới, không ghi đè biểu mẫu dirty; empty không được dùng thay cho lỗi tải. Pending chat giữ `clientMessageId` trước POST, kể cả rời màn khi đang gửi.
- Debug API mặc định `http://127.0.0.1:3000` dùng ADB reverse qua USB; release không fallback emulator và yêu cầu URL HTTPS. Test data/mock vẫn giữ trong kiểm thử độc lập, không phải dữ liệu hiển thị app.

## Cleanup cloud đã chạy

Project `app-cuoi-ky-2d653`; runtime namespace `app-cuoi-ky`; QA cũ `cloud-qa-09f3fe9c-5ffe-40b1-8616-1f28640df6ed`. API cổng3000 được giữ offline suốt inventory/apply/file cleanup, rules client deny all; không có writer khác được khởi chạy trong lượt này.

| Chỉ số tại thời điểm cleanup | Kết quả |
|---|---:|
| Document inventory trước apply | 98 |
| Document seed/QA được xóa | 83 |
| Document giữ nguyên sau đối chiếu | 15 |
| Firebase users thật được giữ | 2 |
| File ảnh giả được backup rồi xóa | 8 |
| Quan hệ mixed seed↔user thật trong inventory | 0 |

15 document giữ lại: users2, profiles2, preferences2, firebaseIdentities2, media2, locations1, sessions4. Sau khi API mở lại, đăng nhập/sử dụng thật có thể tạo session hoặc dữ liệu mới bình thường; số15 không phải tổng cố định của DB.

Snapshot/manifest/result và backup bytes tại `.local/real-data-cleanup/`, được Git ignore, không đưa PII/credential/token/nội dung chat vào báo cáo. Manifest apply: `manifest-1793631843067.json`; result chứa plan hash và đường backup từng file. Toàn bộ snapshot trước xóa giữ encoded Firestore types để phục hồi. Không xóa Firebase Auth users.

Script `scripts/firestore-cleanup.mjs`: default read-only inventory; apply kiểm exact project, plan/provenance hashes, inventory/updateTime; đọc collection và kiểm inventory lại trong transaction, xóa atomically tối đa400 targets. CLI từ chối apply khi API local đang nghe. Chỉ chọn seed từ ID + demoAccount + mapping + marker; không suy từ tên/email/thiếu Firebase UID/prefix. Bảo toàn component chạm user khác, kể cả nested document dưới media/session/message/report/seedMarker. QA root chỉ được xóa khi mọi descendant được chứng minh riêng. File paths/realpaths được kiểm dưới media directory dự kiến, giữ file còn reference.

**Giới hạn công cụ:** yêu cầu dừng mọi writer, gồm backend/Admin từ máy khác; kiểm port local không chứng minh remote writer vắng mặt. Transaction không khóa việc xuất hiện namespace/collection hoàn toàn mới ngoài inventory. Không dùng script này như online migration có concurrent writers.

## Verification mới

| Kiểm tra | Kết quả |
|---|---|
| `npm run typecheck` sau tích hợp/contract | PASS API + mobile |
| `npm run lint` | 0 lỗi, 2 warning inline style có sẵn ở App/ui |
| `npm run test:startup` | 12 pass, 1 cleanup integration skip vì lane này không mở emulator |
| Cleanup suite trong Firestore Emulator riêng | 9/9 pass, không skip; includes mixed/nested/provenance, changed updateTime, giữ user khác/namespace khác, idempotent rerun và JSON backup restore |
| `npm run test:firestore` cuối | 23/23 pass; emulator explicit, không ghi cloud |
| `npm run test:mobile` cuối | 11 suites, 66/66 pass; gồm workspace socket→REST/profile-header/account reset và in-flight send retry |
| `npm run android` | BUILD SUCCESSFUL, install debug lên một điện thoại USB `2211133C`, Android16 arm64 |
| Live `/health` | 200, firestore/cloud đúng project/namespace |
| Live capabilities | database/core/profile-images/location/oauth/firebase-auth real; OTP/selfie/GIF-sticker/video/advanced unavailable |
| Native sau bật API lại | Người dùng đăng nhập Firebase trong app; log API xác nhận `/v1/auth/firebase`, profile, preferences, matches và discovery thành công; không tự gửi tin cho tài khoản khác |

Lỗi “đang kết nối máy chủ” lúc kiểm tra: API đang offline để cleanup, trong khi Metro vẫn mở; điện thoại thật cũng không dùng được default `10.0.2.2` của emulator. Đã đổi default debug sang loopback qua ADB reverse, bật lại `npm run be` và xác nhận request từ điện thoại trả200. API/Metro được để chạy cho chủ dự án tiếp tục test; tắt BE/rút USB thì cần URL LAN phù hợp hoặc nối lại reverse.

## Review và giới hạn nghiệm thu

Hai implementer độc lập BE/mobile, integrator giữ App/contract/cleanup/docs; reviewer độc lập kiểm spec và chất lượng. Bốn finding đã sửa: nested cleanup provenance, cửa sổ ghi đồng thời khi cleanup, pending message ID qua navigation, fixture targets trong discovery/swipe. Focused recheck không còn finding cần sửa trong scope; evidence chi tiết/ledger lưu ignored `.superpowers/sdd/2026-11-02-production-real-data/`.

Đã sẵn sàng cho chủ dự án test core bằng dữ liệu thật trên BE local. Chưa nhận là bản phát hành production Internet hoặc đủ37F: ảnh thật vẫn trên filesystem BE, chưa object storage; HTTPS/domain/release signing/retention và backup vận hành còn cần thiết lập cho môi trường phát hành. Chưa kiểm hai Android client thật cùng mutual-match/chat/block/reconnect sau D20, toàn bộ permission/accessibility hoặc iOS; không suy các phần đó từ emulator tests. Không tạo provider trả phí/thông báo/badge/AI giả để lấp phần chưa có.
