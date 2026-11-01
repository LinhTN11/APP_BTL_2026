# QA và bằng chứng bàn giao

Cập nhật 01/11/2026 (Asia/Saigon). Bằng chứng dưới đây phân biệt worker checks, tích hợp native và kiểm tra clone sạch; một nhóm pass không chứng minh nhóm khác.

## Evidence lịch sử trước khi chuyển Firestore

- Evidence SQLite/API cũ bắt đầu ở 6/6 pass; lượt kế tiếp ghi 7 tests pass, gồm case cấu hình non-demo mới. Mobile worker ban đầu có 15/15 tests, sau đó 19/19 tests qua 3 suites sau khi bổ sung screen checks. Đây là các mốc của các lượt khác nhau, không gộp thành một run và không chứng minh cloud Firestore. Chi tiết worker: [backend report](../execution/backend-report.md), [config fix report](../execution/backend-config-fix-report.md), [mobile report](../execution/mobile-report.md), [mobile fixes report](../execution/mobile-fixes-report.md).
- Native build/install evidence được thu trong giai đoạn đó: Gradle 9.4.1, JDK 21, Android SDK 37, React Native 0.88.1, Community CLI 20.2.0; x86_64 debug build thành công trong 3 phút 21 giây và tự cài/mở app trên Pixel 9 emulator trong khoảng 10 giây.
- Android integration khi đó: A đăng nhập và hiển thị discovery/media, mutual like qua API, refresh match và mở chat. Không gán evidence này cho Firestore cloud.
- Clean source archive từ `6daf434`: `npm ci` khoảng 23 giây, setup, HTTP smoke và typecheck pass. Đây là SQL archive, không phải clean clone của Firestore head hay clean native build.
- Mobile worker lint/typecheck pass; lint 0 errors/0 warnings. Worker tests chỉ kiểm tra API client/session/cursor/socket state, không phải nghiệm thu toàn bộ UI/accessibility.

## Firestore emulator hiện tại

- Auth/profile/media và matching/chat/safety suites dùng Firebase Admin SDK kết nối **Firestore Emulator** với project giả lập `demo-app-cuoi-ky`, host `127.0.0.1:8089`, namespace ngẫu nhiên: tổng cộng **10 passed, 0 failed, 0 skipped**; khoảng 55 giây theo báo cáo cuối.
- HTTP smoke trên emulator đã pass theo báo cáo tích hợp. Đây là evidence emulator, không phải cloud.
- Clean source archive của `b82acd3` tại đường dẫn có dấu cách `gap firestore clone 72593919`: `npm ci` cài1517 packages trong38s; setup, API/mobile typecheck và Firestore Emulator HTTP smoke đều đạt. Dùng toolchain/cache máy hiện tại và emulator đang chạy; không là cold-machine/native build hoặc cloud test.
- Lượt tích hợp cuối: `npm run verify` đạt typecheck, ESLint, **15/15 Firestore tests, 0 skipped** và mobile 19/19; sau sửa fast-send ở UI, chạy lại mobile typecheck/lint và **20/20 mobile tests** đều đạt. Backend không thay đổi sau lượt 15 bài.
- Cấu hình thiếu emulator host bị chặn trước SDK; session logout/expiry/account disable trong upload chậm trả 401, không ghi DB/file. Socket kiểm tra trạng thái kết nối sau các bước await trước khi gắn listener.
- Native Android với API Firestore Emulator: A đăng nhập/discovery/media, A và B mutual Like, A gửi tin; client B HTTP đọc document qua API và phản hồi, A nhận realtime. Kiểm tra dữ liệu đầy đủ sau sửa fast-send; ảnh [native-firestore-chat.png](native-firestore-chat.png). Đây là một client Android + một client HTTP, không phải hai máy Android.
- Direct client REST vào Firestore Emulator không có auth nhận 403 theo rules deny all. Không suy ra rules/indexes đã triển khai lên cloud.
- Báo cáo chi tiết: [Firestore handoff](../execution/firestore-handoff-report.md), [core worker](../execution/firestore-core-report.md), [interaction worker](../execution/firestore-interaction-report.md).

## Chưa được chứng minh

- Keyboard Android đã kiểm tra trên emulator: ô nhập và nút Gửi nằm trên IME; đã gửi/nhận tin trong luồng Firestore Emulator. Chưa nghiệm thu đầy đủ mọi tương tác/quyền trên máy thật.
- Firebase project/credentials chưa có; chưa kết nối, đọc/ghi hoặc chạy smoke trên Cloud Firestore thật. Emulator pass không chứng minh IAM, indexes đã triển khai, cloud durability hoặc cloud billing/quota.
- Các review fixes đã qua kiểm tra nêu trên; riêng timing socket disconnect trong từng await chưa có bài regression chuyên biệt, đã kiểm tra source guard và suite lifecycle hiện có.
- Clean SQL archive chưa chạy clean Gradle/native build. iOS chưa build.
- Firestore archive mới đã kiểm tra như trên; native Gradle build trong clean archive vẫn chưa thực hiện.
- Chưa có xác nhận đầy đủ cho quyền GPS/gallery grant-denial trên máy, TalkBack, cỡ chữ 200%, accessibility acceptance hoặc hai client Android native realtime end-to-end.
- Video, SMS/OAuth/Google sign-in, live selfie/biometrics, Google auth, AI thật và provider cloud chưa được cung cấp/kiểm tra như thật; provider credentials không có. Selfie là pending/demo; GIF/sticker là nhãn catalog, không animated. Ảnh lưu protected backend filesystem, không phải Cloud Storage.
- Các module SQL mở rộng P06–P10 chỉ là reference: chưa port thành Firestore feature, chưa được coi là đã hoàn thành.
- Đây là core P01–P05, không phải xác nhận hoàn tất toàn bộ 37 chức năng roadmap hay phê duyệt FE-product visual.

## Clone sạch

Đã kiểm tra source archive SQL từ `6daf434` với `npm ci`, setup, HTTP smoke, typecheck. Lần chạy này dùng cache môi trường hiện có và không bao gồm native Gradle build sạch; không diễn giải thành clean-room Android build hoặc clone verification cho backend Firestore hiện tại.

## Cách ghi bổ sung

Mỗi lần QA ghi ngày/commit hoặc source snapshot, host/runtime, thiết bị/API URL mode, lệnh và kết quả cụ thể. Tách API unit/integration, typecheck/lint, Android build/install, bấm tay native, hai-client realtime, clean clone và iOS thành các mục riêng. Bug report nên có bước tái hiện, expected/actual, `requestId`, status/body đã loại secret và ảnh phù hợp. Không đưa OTP/token hay dữ liệu cá nhân vào tài liệu.
