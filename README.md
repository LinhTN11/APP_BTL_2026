# Gặp — React Native CLI + Cloud Firestore

App hẹn hò cho nhóm **1 BE + 1 FE**, Android chính. Mobile dùng **React Native Community CLI 20.2.0 / React Native 0.88.1, không Expo**. Backend Fastify dùng **Cloud Firestore qua Firebase Admin SDK**.

**Trạng thái:** core đã chuyển sang Firestore và kiểm thử qua Emulator. Người dùng chưa có Firebase project nên chưa kiểm chứng kết nối cloud thật. SQLite cũ và các module nâng cao dựa trên SQL chỉ được giữ làm tham chiếu. Xem [báo cáo hiện tại](docs/qa/final-report.md) để phân biệt phần đã chạy và phần còn thiếu.

## Kết nối DB cloud thật

Làm theo [hướng dẫn Firebase/Firestore](docs/12-ket-noi-firestore.md): tạo project riêng, tạo Firestore, cấu hình Project ID và credential **chỉ trên backend** trong `.env.local`. Không commit credential hoặc đưa vào app.

```powershell
npm ci
npm run firestore:check
npm run firestore:seed
npm run demo
```

`firestore:check` chỉ đọc để kiểm tra kết nối. `firestore:seed` tạo tài khoản demo hư cấu khi `DEMO_MODE=true`, không reset/ghi đè dữ liệu. `demo` bật API **3000**, Metro **8081** và build/install Android khi có đúng một thiết bị ADB. Nếu chưa có emulator/USB, mở thiết bị rồi chạy `npm run android` ở terminal khác.

Cần Node24.15.0, npm11+, JDK21, Android Studio/SDK. Lần đầu cần internet tải npm/Gradle. Backend thiếu project/config phải báo lỗi; không tự dùng SQLite hoặc emulator để giả kết nối cloud.

FE chỉ cần chạy app và đổi ô URL API: emulator `http://10.0.2.2:3000`; USB qua `adb reverse` dùng `http://127.0.0.1:3000`; Wi-Fi dùng IP máy BE. FE dùng chung API sẽ thấy chung dữ liệu Firestore, không cần admin key.

## Kiểm tra tách biệt

```powershell
npm run test:firestore
npm run smoke:demo
npm run verify
```

Các lệnh này dùng **Firestore Emulator cục bộ**, project `demo-app-cuoi-ky` và namespace test riêng. `npm run demo:emulator` là chế độ chạy app thử có nhãn emulator, không là cloud. `npm run test:api:reference` kiểm tra source SQLite cũ để tham khảo, không nghiệm thu DB chính.

## Phạm vi

Core: auth/session demo, hồ sơ/ảnh, khám phá, match, chat, block/report, vị trí có đồng ý và UI-test cho BE. Provider trả phí mô phỏng có nhãn; OAuth/AI thật cần cấu hình riêng. Metadata DB ở Firestore; ảnh đang lưu trong filesystem backend có auth, chưa phải cloud Storage.

UI-test phục vụ kiểm API; [prototype](docs/prototype/index.html) vẫn là bản nháp, chưa chốt FE-product. Roadmap đủ **37 chức năng / 60 màn**, không đồng nghĩa toàn bộ đã triển khai hoặc chuyển sang Firestore.

- [Mục lục docs](docs/README.md), [yêu cầu kỹ thuật](docs/03-yeu-cau-ky-thuat.md), [API](docs/08-hop-dong-api-va-du-lieu.md)
- [Kế hoạch phase](docs/04-ke-hoach-trien-khai.md), [checklist BE/FE](docs/05-checklist-be-fe.md), [deadline](docs/11-ke-hoach-mot-ngay.md)
- [Quy tắc AI](AGENTS.md), [tiến độ thực thi](docs/execution/progress.md), [QA](docs/qa/verification.md)
