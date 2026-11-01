# Báo cáo trạng thái hiện tại — React Native CLI / Firestore

Ngày 01/11/2026. **Đã có core chạy với Firestore Emulator; chưa kết nối Cloud Firestore thật vì chưa có Firebase project/credential.** Đây không phải báo cáo hoàn tất 37 chức năng hoặc duyệt FE-product.

## Đã thực hiện

- React Native Community CLI20.2.0, RN0.88.1, Android native project; không Expo. Fastify primary server dùng Firebase Admin SDK14.5.0/Firestore.
- Auth/session và OTP demo có rate/expiry/replay; hồ sơ, ảnh tối đa9, bộ lọc, vị trí riêng có đồng ý; mutual match transaction; chat lưu document/idempotency/cursor/realtime; unmatch/block/report và private read/unmatch record.
- UI-test có nút gọi API thật, loading/error/retry, secure local session, đổi tài khoản không giữ chat/draft, keyboard Android, profile save guard, safety/swipe serialization và fast-send payload.
- Scripts kiểm tra kết nối, seed create-only, chạy native app/API/Metro; cloud thiếu cấu hình fail rõ, emulator chọn riêng. Direct client Firestore rules deny all; admin credential chỉ BE.

## Bằng chứng kiểm tra

| Nhóm | Kết quả và giới hạn |
|---|---|
| Root verify | Typecheck/ESLint đạt; Firestore15/15 pass,0skip; mobile19/19 trong cùng run |
| Mobile sau sửa cuối | Typecheck/ESLint đạt;20/20 tests,0snapshot; regression fast-send có RED→GREEN |
| HTTP smoke | Firestore Emulator: A/B auth→discovery→mutual match→chat persisted→C denied→block revoke đạt |
| Android | x86_64 debug build/install đã đạt (JDK21, SDK37, Gradle9.4.1); app gọi API Firestore Emulator, gửi tin, B HTTP đọc/phản hồi, A nhận realtime; IME không che Send |
| Truy cập trực tiếp | REST client không auth vào emulator nhận403; không phải bằng chứng rules đã deploy cloud |
| Clone | Firestore snapshot `b82acd3`, thư mục có dấu cách: npmci1517 packages/38s, setup, typecheck và emulator HTTP smoke đạt; chưa clean native build/cloud |
| Cloud | Chưa có project/credential; chưa thực hiện cloud read/write, seed, deploy rules/indexes |

## Phần chưa hoàn tất

- Tạo project Firebase riêng, cấu hình BE, deploy indexes/rules, kiểm kết nối và dữ liệu chung qua cloud. Hướng dẫn: [12-ket-noi-firestore.md](../12-ket-noi-firestore.md).
- Phần mở rộng P06–P10 có source SQLite tham chiếu và kiểm tra cục bộ riêng; chưa port đầy đủ sang Firestore, không nằm trong primary app. Không tự lấy số bài test SQL để nghiệm thu DB mới.
- Video/profile duration validation; GIF/sticker hiện là catalog label, chưa animated; OAuth, AI thật, music và calendar cloud cần provider/config và phase riêng. OTP/selfie mặc định ghi rõ demo, không có xác minh chính chủ thật.
- Media metadata ở Firestore, ảnh trên filesystem BE có auth; chưa có Cloud Storage. Đồng bộ socket message giữa nhiều backend chưa có; demo dùng một backend.
- Chưa kiểm iOS build, hai thiết bị Android, TalkBack/font200%, toàn bộ native permissions và FE-product Liquid Glass hoàn chỉnh.

## Bước tiếp theo

Chủ dự án tạo Firebase project và cấu hình credential local theo docs12 (không gửi khóa bí mật vào chat/Git). Khi có Project ID và quyền backend đúng project, chạy `firestore:check`, seed tường minh rồi nghiệm thu cloud A/B/C. FE chỉ cần URL API dùng chung, không cần admin key. Các phase và checklist còn mở cho tới khi có artifact/bằng chứng tương ứng.
