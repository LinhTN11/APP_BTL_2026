# Khám phá và vị trí đã lưu — 02/11/2026

Scope USER: thực thi [kế hoạch sửa radius](../superpowers/plans/2026-11-02-discovery-radius-fix.md), T03.01/T05.01/T05.02, F06. Hai worker BE/FE theo file ownership; integrator giữ DTO/OpenAPI/docs và review.

## Chẩn đoán trước sửa

Checkpoint khoảng 22:41 Asia/Saigon: hai tài khoản thật đã đủ tên, tuổi, bio và media, active/public. Không có advanced filter hoặc swipe/match/block loại nhau. Cả hai có vị trí consent, nhưng khoảng cách lưu >10.000 km so với bán kính 1.000 km/100 km. Handler hiện tại trả 200/data=[] cho cả hai; kiểm qua read-only cloud/Fastify inject, không tạo session hoặc ghi DB. Chưa xác định vị trí nào không đúng thực tế. Chẩn đoán D21 cũ về bio/ảnh không còn đúng cho checkpoint này.

## Thay đổi trong phạm vi

- `GET /v1/me/location` authenticated/owner-only trả trạng thái và thời điểm cập nhật server đã lưu; không tọa độ/userId/target. PUT/DELETE giữ consent hiện có.
- Khám phá hiển thị bán kính đã lưu và thời điểm vị trí của chính người dùng; thêm cập nhật GPS → preview → đồng ý lưu → tải lại. Không tự cập nhật GPS nền hay mở rộng radius.
- Reload đồng bộ trạng thái vị trí, preferences đã lưu và deck; bản nháp filter chưa lưu được phân biệt với radius đang áp dụng. Empty không khẳng định hồ sơ chưa hoàn thiện là nguyên nhân.

## Verification

| Kiểm tra | Kết quả |
|---|---|
| BE regression red → green | GET thiếu trả404 trước sửa; explicit Firestore Emulator sau sửa26/26 pass,0skip; sau fix validation timestamp, targeted owner-status1/1 pass0skip và API typecheck pass |
| API + mobile workspace typecheck | Pass |
| Lint | 0 lỗi, 2 warning inline-style có sẵn tại App/ui |
| Mobile toàn bộ sau review/fix cuối | 103/103 tests,14/14 suites pass |
| FE focused regression | Trước sửa10 fail/2pass; sau review/fix31/31 gồm20 GPS/discovery +11 screen |
| Android arm64 USB | `npm run android` BUILD SUCCESSFUL, installDebug/launch thành công |
| Native đọc API | Khám phá render radius1000km và thời điểm vị trí server15:32:05 ngày02/11, xác nhận endpoint mới hoạt động trên session thật; không sửa timestamp khi đọc |
| Review BE độc lập | Spec compliance PASS, code quality PASS, không finding |
| Review FE + tích hợp cuối | 4 findings đã sửa và re-review xác nhận tất cả addressed; Task1/2 spec+quality PASS, scoped integration APPROVED |
| Metro bundle sau fix cuối | HTTP200; logcat ReactNativeJS:E/AndroidRuntime:E checkpoint không lỗi |
| Native GPS preview/cancel | Android thật: nhấn Cập nhật vị trí → nhận alert xem trước tọa độ → Hủy; agent không nhấn Đồng ý lưu và không phát hành PUT vị trí thật |

Coverage: status GET owner/auth/nonconsent/legacy timestamp và privacy; near/far, GPS optional, block hai chiều/hidden/underage/swipe/match; GET/PUT lỗi không hiện success-empty; cancel/no write, deferred GPS/PUT, stale preview sau unmount, reload/remount/foreground, nháp filter/profile không mất. Full runtime cloud GPS save của cả hai tài khoản vẫn chưa thực hiện.

Review sửa thêm: không báo hết hồ sơ khi còn cursor; không hiển thị radius reason cũ sau refresh lỗi; không cho sửa/lưu defaults khi preferences chưa tải thành công; timestamp legacy parseable nhưng không phải dạng ISO server chuẩn trả null. Các regression mới đã fail trước sửa và pass sau sửa.

## Giới hạn

Hai vị trí thật vẫn phải trong radius để được gợi ý, cùng các điều kiện tuổi/giới tính/profile/visibility/safety khác. Agent không tự sửa vị trí đã lưu, thu hồi consent hay xóa tương tác thật để tạo kết quả. Kiểm near/far trong emulator không chứng minh hai tài khoản cloud đã tìm thấy nhau. Cần từng tài khoản chủ động cập nhật và đồng ý lưu GPS thực trên thiết bị nếu vị trí cũ không đúng.
