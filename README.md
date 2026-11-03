# Gặp — clone và dùng chung DB cloud của team

React Native Community CLI, Fastify + Cloud Firestore. Cần **Node 24.15.x, npm 11+**; chạy Android cần **JDK 21, Android Studio/SDK và emulator hoặc máy USB**. Không Expo.

## Tôi giữ cấu hình BE của team

Máy hiện tại đã có cấu hình cloud. Tạo một file bàn giao:

```powershell
npm run team:export
```

Gửi riêng **`secrets/team-config.json`** cho thành viên FE qua Zalo/file trực tiếp. File gồm cấu hình và credential của DB test chung, không gửi lên repo. Không cần người FE tạo Firebase project hoặc tự sửa đường dẫn credential.

## Tôi là FE — nhận file rồi chạy

Clone repo, tạo thư mục `secrets/` ở root nếu chưa có, tải file từ Zalo và đặt đúng vị trí:

```text
APP-Cuoi-Ky/
  secrets/
    team-config.json    ← file nhận qua Zalo
```

Sau đó chạy tại root dự án:

```powershell
npm ci
npm run team:setup
npm run firestore:check
npm run demo
```

`team:setup` tự tạo `.env.local` và credential trong `secrets/`, giữ đúng **project + namespace cloud** của team và chỉnh đường dẫn cho máy của bạn. `firestore:check` kiểm kết nối đọc; `demo` mở BE **3000** + Metro **8081** + Android khi có đúng một thiết bị ADB. Mở thiết bị sau thì chạy `npm run android`.

Nếu chỉ chạy BE: `npm run be`. Nếu BE đã chạy: `npm run fe` mở riêng app. App dùng API local `http://127.0.0.1:3000` sau ADB reverse; Android emulator qua host có thể dùng `http://10.0.2.2:3000`. Đổi URL trong **Kết nối** khi cần.

Dữ liệu/tài khoản hiện là của team test; chỉnh qua BE sẽ lưu vào **cùng DB cloud**, không vào DB mới hay emulator. Key chỉ được tiến trình BE dùng; app vẫn gọi API. [Bàn giao chi tiết](docs/handoff/be-to-fe.md) · [Cấu hình cloud](docs/12-ket-noi-firestore.md).

## Chặn đưa nhầm secret lên repo

`npm ci` tự cài Git hooks; nếu đã tắt lifecycle scripts thì chạy `npm run security:install`. File bàn giao, `.env.local` và `secrets/` bị ignore; hook kiểm cả staged content và commit sắp push. Trước commit: `npm run security:check`. [Quy tắc và giới hạn](docs/security/secrets.md).

## Kiểm tra và code tiếp

- **Swagger:** sau khi BE chạy, mở [http://127.0.0.1:3000/docs](http://127.0.0.1:3000/docs). Dùng **Authorize** với API session token, không phải Admin key. OpenAPI JSON ở `/docs/json`.
- `npm run api:docs`: tái sinh contract từ generator; `npm run test:openapi`: kiểm contract và Swagger UI.
- `npm run test:team`: kiểm export/import cấu hình bằng file giả và thư mục tạm.
- `npm run test:security`: kiểm lớp chặn secret; `npm run verify`: bộ kiểm tra repo.
- `npm run doctor`: kiểm toolchain/cổng/thiết bị; `Ctrl+C` dừng lệnh.
- `npm run demo:emulator`: lane test riêng được chọn rõ; không thay cho DB cloud chung.

Cùng DB chưa tự đồng bộ bytes ảnh đang nằm trên filesystem mỗi BE; socket message fanout hiện cũng chỉ trong một BE. Test chat realtime/ảnh giữa hai người nên cùng trỏ về một API khi cần; xem giới hạn và hướng dẫn trong [handoff](docs/handoff/be-to-fe.md).

[BE guide](docs/backend/README.md) · [Đủ 37 yêu cầu và backlog](docs/backend/requirements.md) · [Runbook](docs/09-chay-demo-va-ban-giao.md) · [Docs](docs/README.md). Full BE 37F chưa hoàn tất; visual vẫn là nháp.
