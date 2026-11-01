# Kết nối Cloud Firestore thật

**D12 — người dùng đã chọn Cloud Firestore và chưa có Firebase project (01/11/2026).** React Native Community CLI giữ nguyên; Firestore thay SQLite làm DB chính. Core đã có code và kiểm tra emulator; chưa có project/credentials nên **chưa xác nhận kết nối cloud thật**.

## 1. Chuẩn bị project riêng cho app

1. Mở [Firebase Console](https://console.firebase.google.com/), đăng nhập tài khoản của nhóm và tạo project mới dành riêng cho app này.
2. Trong **Build → Firestore Database**, tạo database Standard, chọn vị trí phù hợp cho nhóm. Chọn chế độ khóa truy cập client; không mở rules `allow read, write: if true` để chạy nhanh.
3. Ghi lại **Project ID**. Gửi Project ID qua chat được; đó không phải khóa bí mật. Không tái sử dụng project WebGI hay dữ liệu dự án khác.
4. Trong **Project settings → Service accounts**, tạo khóa Admin SDK cho backend nếu nhóm dùng credential file. Lưu file ở `secrets/firebase-service-account.json` trên máy BE; thư mục này bị Git ignore. Không gửi nội dung file vào chat, không cho vào app Android hoặc repo. Có thể dùng ADC thay credential file nếu môi trường nhóm đã cấu hình.
5. Sau khi cài dependencies và xác nhận Project ID, triển khai rules khóa client và composite indexes trong repo vào **đúng project mới**. Lệnh này do chủ project chạy sau khi đăng nhập Firebase CLI; không thực hiện trên project khác:

```powershell
npx firebase login
npx firebase deploy --only firestore:rules,firestore:indexes --project PROJECT_ID_CUA_NHOM
```

Chờ indexes ở trạng thái sẵn sàng trước khi thử các truy vấn match/chat. Firestore Emulator không chứng minh indexes đã được tạo trên cloud.

Tài liệu chính: [Firestore quickstart](https://firebase.google.com/docs/firestore/quickstart), [Admin SDK setup](https://firebase.google.com/docs/admin/setup). Firestore có quota không tính phí; cần theo dõi giới hạn đọc/ghi/lưu trữ trong [usage limits](https://firebase.google.com/docs/firestore/quotas). Không tự nâng gói hoặc bật dịch vụ trả phí để hoàn tất demo.

## 2. Cấu hình backend

Trong `.env.local` (không commit):

```dotenv
DATABASE_MODE=firestore
FIREBASE_PROJECT_ID=project-id-cua-nhom
FIRESTORE_NAMESPACE=app-cuoi-ky
GOOGLE_APPLICATION_CREDENTIALS=C:/duong-dan-tuyet-doi/secrets/firebase-service-account.json
DEMO_MODE=true
HOST=0.0.0.0
PORT=3000
```

Không đặt `FIRESTORE_EMULATOR_HOST` khi kiểm tra cloud. Backend phải báo thiếu config hoặc lỗi quyền rõ ràng, **không tự đổi sang SQLite hay emulator**.

Khi code chuyển đổi đã được kiểm chứng, chạy:

```powershell
npm ci
npm run firestore:check
npm run firestore:seed
npm run demo
```

`firestore:check` chỉ kiểm tra quyền đọc/kết nối. `firestore:seed` tạo fixture hư cấu A/B/C/D trong namespace đã chọn, không reset hoặc ghi đè dữ liệu có sẵn. Các script đã có; lane emulator đã kiểm tra, lane cloud vẫn cần project/credentials thật. Xem bằng chứng trong [QA](qa/verification.md).

## 3. Cách FE chạy và test chung

- FE chạy app CLI và trỏ URL API tới máy BE hoặc backend dùng chung. FE **không cần** khóa Admin SDK.
- Người chạy backend khác cần được cấp quyền/credential riêng hợp lệ; không chia sẻ khóa trong Git để đổi lấy “clone chạy ngay”.
- App không đọc Firestore trực tiếp. Backend kiểm tra session, ownership, match/block và transaction trước khi đọc/ghi.
- Media ảnh hiện phục vụ qua API và filesystem BE có auth. **DB cloud không đồng nghĩa ảnh đã lưu cloud**. Storage provider là hạng mục riêng; không nhét ảnh lớn vào Firestore document.

## 4. Emulator là một lane kiểm thử riêng

Firestore Emulator dùng SDK và giao thức Firestore để kiểm tra transaction/permissions logic mà không đụng cloud. Chạy emulator **không** là bằng chứng dữ liệu đã lên Firebase project.

```powershell
npm run test:firestore
```

Test dùng project ID demo và namespace tạm, không dùng credential cloud. `npm run demo:emulator` đã có để chạy app thử có nhãn emulator; không đổi tên thành cloud thật trong báo cáo. Bộ kiểm tra cuối gồm 15 bài Firestore (0 bỏ qua) và 20 bài mobile; xem [báo cáo](qa/final-report.md).

## 5. Bằng chứng cần có để chốt cloud

- Project ID/namespace đúng app, API báo provider Firestore và mode cloud.
- Đọc kết nối thành công; seed được tạo rõ ràng do người dùng gọi script.
- A sửa hồ sơ/Like/gửi tin → nhìn thấy document trên console → restart API vẫn đọc lại được.
- B hoặc máy FE gọi cùng API thấy cùng dữ liệu; C không đọc chat A–B.
- Không có admin key trong bundle, source, log hoặc Git; client rules deny all.

Các mục trên sẽ giữ “chưa kiểm chứng” cho tới khi có project và quyền truy cập phù hợp.
