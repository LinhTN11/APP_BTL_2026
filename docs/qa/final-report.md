# Trạng thái và kiểm chứng — 02/11/2026

Core React Native CLI + Fastify + Firestore đang hoạt động trong phạm vi demo P01–P05. **Không đồng nghĩa hoàn thành 37 chức năng hoặc duyệt visual FE-product.**

## Bản hiện tại D15

[Màn thật và nhận diện Gặp/Mầm](product-ui-2026-11-02.md) thay bản thử kính/nền biển: Firebase SDK email/Google không demo fallback; nội dung giấy đặc, bar kính, mascot/nền mới. Native build/install đạt,55 mobile đạt; SDK API19/19+guard4/4 và realSDKemulator smoke đạt; Web/Android SDK config đã cấp theo quyền USER, Google thật chưa kiểm bằng tài khoản. Các mục dưới giữ evidence D14 lịch sử, không mô tả UI hiện tại.

## Lượt dọn code và UI-test trước visual mới

- Gỡ backend SQL unreachable, migrations và SQL-only tests; tách helper dùng chung sang `apps/api/src/shared.ts`. Server chỉ dùng Firestore; không fallback.
- Sửa PATCH hồ sơ: cập nhật một trường lifestyle giữ các trường khác, kể cả hai cập nhật đồng thời. Regression đã fail trước sửa (15 pass/1 fail), pass sau sửa.
- Bổ sung chào mừng → đăng nhập/đăng ký → OTP → hồ sơ đầu tiên. SMS có nhãn demo; cùng API verify tạo mới hoặc đăng nhập. Sửa lỗi không hủy được hồ sơ đang tạo khi phiên hết hạn/mất mạng.
- GlassProvider/GlassSurface cho điều khiển nổi, nền/viền sáng và light/dark; Android dùng fallback bán trong suốt, high text contrast dùng nền đặc. Nội dung form vẫn dễ đọc. Không phải native iOS refraction.
- Lệnh `be`, `fe`, `demo`; FE dùng API chung không cần key. README ngắn, bàn giao có danh sách BE còn việc. Báo cáo worker/API SQL/skill Expo cũ chuyển ignored `.local/`, giữ nguyên nguồn yêu cầu và evidence.
- Generator OpenAPI đồng bộ health/capabilities/profile/pagination/OTP/register/read-cursor; tài liệu đã được generate lại.

| Kiểm tra mới | Kết quả |
|---|---|
| `npm run verify` trước bản sửa hủy hồ sơ cuối | Exit 0: typecheck/lint, startup 2/2, Firestore 16/16 (0 skipped), mobile 23/23 |
| Android debug | `npm run android`: BUILD SUCCESSFUL, cài `com.gapmobile` trên Pixel_9 Android16 x86_64; JDK21. Có cảnh báo deprecation Gradle/AGP, không phải build error. |
| Rà soát Standards | Không lỗi API/runtime; phát hiện QA doc mô tả SQL cũ, đã viết lại báo cáo này. |
| Rà soát Spec | Phát hiện P2 hủy hồ sơ khi logout401/network; sửa và kiểm regression riêng sau đó. |

Sau sửa cuối: root chạy lại mobile typecheck/lint (exit0) và Jest **4 suites/25 tests pass**, bao gồm hủy hồ sơ với logout401 hoặc lỗi mạng. API/scripts không đổi sau full verify16/2, không chạy lại suite không liên quan.

Native smoke mới trên Pixel9: đăng ký bằng số hư cấu ở emulator → OTP demo → hồ sơ đầu tiên (DOB2000-01-01) → lưu thành công → Khám phá với ảnh fixture và socket báo realtime connected → đăng xuất có xác nhận → về màn chào mừng. Đã xem ảnh light/dark, không có overflow ở các màn đã đi qua. Ảnh: [welcome sáng](native-ui-welcome-2026-11-02.png), [welcome tối](native-ui-dark-2026-11-02.png). Đây là một emulator, không là sign-off đầy đủ font200%/TalkBack/native permissions/keyboard.

Prototype web12 màn được worker kiểm bằng Edge: luồng auth→profile→discovery, 12 màn không rỗng, viewport412px không overflow ngang, console0errors/0warnings; dark/opaque toggles đã xem. Root đã đọc diff; đây không thay thế nghiệm thu native.

`git diff --check` đạt; không link Markdown nội bộ hỏng; giữ đủ37F/60S. `.env.local`, service account, `.local/` và `.vscode/` được Git ignore. Chưa commit/push/deploy. Lượt này không chạy ghi/xóa/seed/deploy cloud; test chỉ dùng emulator. Demo emulator đã dừng sau kiểm tra để không để lại backend test chạy ngầm.

## Evidence lịch sử còn giá trị

- [Cloud setup/HTTP](cloud-setup-2026-11-02.md): project `app-cuoi-ky-2d653`, check read-only, explicit create-only seed; deny-all rules, indexes READY; A/B/C HTTP ownership, race/retry/persistence/block/unmatch.
- [Native cloud](native-cloud-2026-11-02.md): một Pixel9 emulator + HTTP companion; profile save, mutual match/chat/realtime, account switch, app/API OS-process restart, unmatch/socket revoke. Có ảnh và giới hạn cụ thể.
- Bản archive Firestore `b82acd3` trước cleanup từng qua npmci/setup/typecheck/emulator smoke trong thư mục có dấu cách; không là clean native build của bản mới.

Không dùng kết quả test SQL hoặc evidence cũ để khẳng định feature Firestore mới đã hoàn thành.

## Việc còn mở

- Hai Android client thật đồng thời, đầy đủ GPS/gallery/camera permissions, TalkBack, font200%, bàn phím và high-contrast trên thiết bị; iOS chưa build.
- Video chưa có duration validation; GIF/sticker mới catalog label; ảnh nằm trên filesystem BE có auth, chưa Cloud Storage.
- OAuth/SMS/AI/music/calendar thật cần provider/config và phase tương ứng. Selfie mới nộp ảnh private pending/demo; policy reviewer/retention chưa chốt.
- P06–P10 chưa triển khai Firestore. Source SQL cũ chỉ còn trong Git history/local notes, không còn trong API active.
- Socket nhiều backend, HTTPS/production vận hành và chính sách retention chưa nghiệm thu. FE-product visual chưa duyệt.

Lệnh chạy và cấu hình: [README](../../README.md). Danh sách bàn giao: [BE → FE](../handoff/be-to-fe.md).
