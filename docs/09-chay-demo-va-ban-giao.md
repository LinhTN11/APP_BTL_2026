# Runbook đích: chạy demo và bàn giao cho FE

**Hiện repo chỉ có docs/prototype/skills; các lệnh app bên dưới là tiêu chí cần xây ở P01, chưa chạy được.** Không có backend hoặc app React Native hoàn thành ở lượt lập kế hoạch này.

## 1. Chuẩn bị tối thiểu

- Node 24.15.0 + npm 11.3.0, Git; Android có Expo Go tương thích hoặc emulator đã cấu hình.
- Lần đầu cần internet để tải dependencies; chạy local sau đó vẫn cần kết nối Wi-Fi/LAN giữa điện thoại và máy API.
- Điện thoại và máy tính cùng mạng riêng. Không dùng Wi-Fi cách ly client; hướng dẫn lỗi có IP/port cần kiểm tra.
- Nếu dùng Face ID iOS/native module ngoài Expo Go, có development-build lane riêng; không bắt FE/Android demo phải build iOS trên Windows.

## 2. Hai lệnh đích

```powershell
npm ci
npm run demo
```

`demo` phải in rõ:

```text
API ready: http://<LAN-IP>:3000
Android emulator API: http://10.0.2.2:3000
Provider mode: demo/local + danh sách adapter real đã cấu hình
Database: data/demo.sqlite (migrated; seed skipped nếu đã có)
Metro: QR và hướng dẫn mở Expo Go
Stop: Ctrl+C dừng cả API và Metro
```

Không ghi secrets vào console. IP máy nhiều network adapter có thể không xác định tự động; cho phép override `EXPO_PUBLIC_API_URL` và `API_HOST` bằng `.env.local` hoặc prompt local, không sửa source. `EXPO_PUBLIC_*` là public bundle, không đặt provider secret ở đây.

## 3. Script phải cung cấp

| Script đích | Vai trò | Điều kiện đạt |
|---|---|---|
| `npm run doctor` | Node, config, DB writeable, API/Metro port và API URL | Lỗi có hướng dẫn; không tự kill process không thuộc dự án |
| `npm run demo` | Setup/migrate/seed lần đầu và chạy cả API/Metro | Hai lệnh sau clone; chạy lại an toàn |
| `npm run dev:api`, `npm run dev:mobile` | Chạy tách để debug | Cùng config với demo |
| `npm run verify` | Typecheck, lint, test core theo workspace | Thất bại trả nonzero |
| `npm run test:api -- <case>` | Test module API trọng yếu | Cách chọn case được ghi cụ thể khi P01 tạo runner |
| `npm run test:mobile` | Test tương tác/form/API state cần thiết | Không thay kiểm thử thiết bị |
| `npm run smoke:demo` | Health + session demo + workflow A/B/C | DB test riêng, không đụng dữ liệu người dùng |
| `npm run db:reset:demo` | Reset đúng file data demo sau cảnh báo path | Không reset ngầm khi `demo`; kiểm tra resolved path trước xóa |

Đây là hợp đồng CLI dự kiến, không là log thực thi. P01 phải điền command chính xác và kết quả thực tế vào evidence.

## 4. Seed tối thiểu

- A và B: người trưởng thành, hồ sơ hoàn chỉnh, có thể tương tác hai chiều.
- C: người ngoài match để chứng minh lỗi phân quyền.
- D: bị block để chứng minh không xuất hiện/feed và không gửi tin.
- Có fixtures empty discovery, ảnh lỗi, câu trả lời gate đúng/sai và session hết hạn để QA; không phải tài khoản đăng nhập công khai trên live.
- Số điện thoại/ảnh/tiểu sử là giả lập hoặc asset có quyền dùng. Danh sách cách đăng nhập ở `docs/demo-accounts.md` được tạo tại P01, không chia sẻ mật khẩu thật của thành viên.
- Tạo seed theo ID ổn định; nhiều lần chạy không thêm row trùng. Mọi client dùng cùng API/DB khi test match/chat.

## 5. Kịch bản bấm test tối thiểu

1. Mở A và B trên hai client hoặc hai phiên độc lập; không gọi hai màn trong cùng một session là hai người.
2. A sửa bio, upload ảnh và restart server: dữ liệu còn.
3. A thấy B trong discovery, like B; B like A → cùng match ID.
4. A gửi tin; B nhận qua socket, reload đọc lại từ REST; retry không nhân đôi.
5. C thử đọc match/chat A–B → bị từ chối.
6. A unmatch/block B; B gửi khi chat vẫn mở → server từ chối, UI cập nhật rõ.
7. Từ chối GPS/gallery; app hiện hướng dẫn và vẫn dùng được các chức năng không cần quyền.
8. Tắt API trong lúc save/send: UI có lỗi/retry, không báo lưu thành công giả.

## 6. Bàn giao BE cuối ngày

- API source + migration + seed + lockfile + `.env.example` + OpenAPI + DTO đã khóa.
- `GET /health` và `/v1/capabilities` có ví dụ response.
- UI-test React Native chạy được cho luồng trên; nhãn FE-test, không phải visual final.
- Một API URL FE truy cập được trong phiên test; nếu khác mạng phải chọn cách chia sẻ backend riêng, không mặc định “localhost dùng được mọi nơi”.
- Evidence gồm commit/hash nếu có Git, runtime, thiết bị, phiên bản Expo, commands/output, test bấm tay, provider mode, known issues.
- `docs/handoff/be-to-fe.md` cần bảng route / request / response / errors / pagination / breaking change freeze / liên hệ xử lý lỗi (tạo ở P05, không thêm contact giả).

## 7. Ngày FE làm riêng

- FE chạy clone-run trên máy mình trước khi vẽ màn.
- FE đổi UI-test bằng UI-product theo prototype được chốt, dùng cùng API client/DTO; không mock một API đã có thật chỉ để giấu lỗi.
- FE báo lỗi bằng bước tái hiện, requestId, status/body đã bỏ secret, ảnh màn và expected/actual.
- BE giữ một khoảng sửa lỗi bàn giao theo khả năng thực tế, không hứa lịch cụ thể khi chưa biết ngày FE. Breaking API change phải sửa OpenAPI/DTO và thông báo trong handoff.

## 8. Xử lý lỗi thường gặp

| Triệu chứng | Kiểm tra |
|---|---|
| QR mở được nhưng API lỗi | Backend URL dùng LAN IP thay localhost; port 3000; hai máy cùng Wi-Fi; firewall hỏi quyền local |
| Tunnel Expo được nhưng chat không được | Metro tunnel không tunnel API; cần đường API riêng, HTTPS nếu ra mạng ngoài |
| `node:sqlite` không import | Node đúng phiên bản đã khóa; không cài native SQLite package ngẫu nhiên |
| Expo Go không hỗ trợ SDK | Dùng SDK stable tương thích đã khóa; ghi rõ phiên bản Expo Go/development build |
| Tính năng native bị thiếu | Capabilities/device support; không chuyển sang fixture mà không hiển thị mode |
| Port bị chiếm | Chọn port override và cập nhật URL; không kill process hệ thống |
| Seed làm mất dữ liệu | Đây là lỗi: `demo` chỉ seed DB mới; reset chỉ khi người dùng chủ động gọi |
