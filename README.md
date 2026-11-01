# Gặp — React Native CLI + backend demo

App hẹn hò dành cho nhóm **1 BE + 1 FE**, Android là nền tảng chính. **React Native Community CLI; không dùng Expo.** Backend Fastify + SQLite cục bộ, không cần tài khoản cloud để chạy demo.

## Chạy sau khi clone

Cần Node **24.15.0**, npm **11.3.0+**, Android Studio/SDK và JDK tương thích, một emulator đang chạy hoặc thiết bị Android USB đã cho phép debug. Lần build đầu cần internet để tải npm/Gradle/native dependencies. Xem [runbook](docs/09-chay-demo-va-ban-giao.md).

```powershell
npm ci
npm run demo
```

`demo` tạo config local nếu thiếu, bật API **3000** và Metro **8081**; khi có đúng một thiết bị ADB sẽ build/install app. Nếu chưa có thiết bị, mở emulator/kết nối USB rồi chạy `npm run android` ở terminal khác. `Ctrl+C` dừng các process demo do script tạo. Lần khởi động sau giữ dữ liệu.

Trên app có ô đổi API URL: emulator mặc định `http://10.0.2.2:3000`; USB qua `adb reverse` dùng `http://127.0.0.1:3000`; Wi-Fi dùng IP LAN của máy BE. Không sửa source để đổi IP.

```powershell
npm run doctor
npm run verify
npm run smoke:demo
```

## Phạm vi và trạng thái

Đang triển khai demo core: session/OTP demo, hồ sơ/media, khám phá, like/pass/match, chat, unmatch/block/report và UI kiểm thử React Native. Provider trả phí được mô phỏng có nhãn; provider miễn phí cần credentials được ghi rõ chưa cấu hình khi chưa tích hợp. Không có SMS hoặc thanh toán thật trong demo mặc định.

UI hiện phục vụ BE test nút và API; [prototype](docs/prototype/index.html) vẫn là bản nháp, chưa thay phần FE-product. Đủ 37 chức năng và 60 màn được giữ trong roadmap; không tuyên bố tất cả đã hoàn thành.

- [Mục lục docs](docs/README.md), [yêu cầu kỹ thuật](docs/03-yeu-cau-ky-thuat.md)
- [Phases và tasks](docs/04-ke-hoach-trien-khai.md), [checklist BE/FE](docs/05-checklist-be-fe.md)
- [Kế hoạch một ngày](docs/11-ke-hoach-mot-ngay.md), [contract API](docs/08-hop-dong-api-va-du-lieu.md)
- [Quy tắc AI](AGENTS.md), [tiến độ thực thi](docs/execution/progress.md)
