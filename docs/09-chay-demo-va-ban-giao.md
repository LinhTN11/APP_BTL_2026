# Chạy app và xử lý lỗi

**Mặc định D24 (03/11):** team gửi riêng `secrets/team-config.json`; máy FE clone repo → `npm ci` → đặt file tại `secrets/team-config.json` → `npm run team:setup` → `npm run firestore:check` → `npm run demo`. BE chạy trên máy FE nhưng dùng đúng DB cloud chung; app gọi API local. [Hướng dẫn ngắn](handoff/be-to-fe.md). Các cấu hình LAN/API chung bên dưới vẫn dùng khi chủ động trỏ về một BE khác.

## Khám phá trống dù có hai tài khoản

Trong Khám phá, xem **Bán kính đã lưu** và thời điểm **Vị trí đã lưu trên máy chủ**. Hai hồ sơ đủ bio/ảnh vẫn không xuất hiện nếu vị trí đã lưu nằm ngoài bán kính, không khớp bộ lọc hoặc bị loại do trạng thái/tương tác. Không suy ra chỉ tạo tài khoản là sẽ thấy nhau.

Nếu vị trí cũ không đúng: trên từng tài khoản, chọn **Cập nhật vị trí** → kiểm tra tọa độ xem trước → **Đồng ý lưu**; app tải lại khám phá sau khi lưu thành công. **Hủy** không thay dữ liệu. Khi GPS lỗi, kiểm tra Vị trí hệ thống và quyền qua **Mở cài đặt vị trí**, rồi thử lại. Agent không tự điền tọa độ để ép có kết quả. Nếu có nút **Trang khám phá kế tiếp**, tiếp tục kiểm tra trang thay vì kết luận hết hồ sơ.

Kết quả chỉ được xác nhận sau request thành công. Lỗi mạng/status không là danh sách rỗng thành công; tải lại trước khi đổi bộ lọc nếu cấu hình chưa tải được. [Bằng chứng và giới hạn hiện tại](qa/discovery-radius-2026-11-02.md).

Lệnh chạy nhanh nằm tại [README](../README.md); cấu hình cloud một lần nằm tại [Firestore](12-ket-noi-firestore.md). BE dùng `npm run be`, FE dùng `npm run fe`, cả hai trên một máy dùng `npm run demo`. Các lệnh đọc `.env.local` khi cần BE; FE dùng API chung không cần khóa Firebase.

## Lần đầu trên máy mới

1. Cài Node 24.15.x/npm 11+. Mở app Android cần JDK 21 và Android Studio/SDK/platform tools; chấp nhận SDK licenses.
2. Chạy `npm ci`, rồi `npm run team:setup` sau khi đặt file nhận qua Zalo tại `secrets/team-config.json` để cài cloud test chung. Người tự quản lý project khác mới dùng `npm run setup` và cấu hình riêng; không đổi sang DB khác trong luồng team D24.
3. Mở một emulator hoặc cắm một máy USB có USB debugging; `adb devices -l` phải hiện `device`.
4. Chạy `npm run demo` trên máy có BE hoặc `npm run fe` trên máy FE. Chưa có thiết bị thì mở thiết bị sau, chạy `npm run android` ở terminal khác.

`npm run setup` không ghi đè cấu hình/data cũ; tự nhận SDK/JDK từ Android Studio nếu có. Không seed DB khi khởi động cloud. `npm run firestore:seed` là lệnh tạo fixture có chủ ý, không reset.

## API URL trên điện thoại

| Kết nối | URL |
|---|---|
| Emulator, BE cùng máy | `http://10.0.2.2:3000` |
| USB, BE cùng máy | `http://127.0.0.1:3000` sau adb reverse |
| Wi-Fi, máy BE khác | `http://IP-LAN-MAY-BE:3000` |

`npm run android` tự reverse cổng API local và Metro cho đúng một thiết bị. Với nhiều máy, chọn serial và reverse thủ công:

```powershell
adb devices -l
adb -s SERIAL reverse tcp:3000 tcp:3000
adb -s SERIAL reverse tcp:8081 tcp:8081
```

Thay SERIAL bằng ID thực. Qua Wi-Fi, Metro vẫn chạy trên máy FE; dev server host của app là `IP-MAY-FE:8081`, còn API URL là máy BE. Dùng mạng tin cậy và kiểm tra firewall khi hai máy không thấy nhau. localhost trên điện thoại là chính điện thoại. HTTP chỉ dành debug local; release cần HTTPS.

## Khi không chạy được

| Triệu chứng | Xử lý |
|---|---|
| Không biết thiếu gì | `npm run doctor`; kiểm Node/JDK/SDK/ADB/cổng. Doctor mặc định kiểm cả BE và mobile; FE không cần sửa mục cloud nếu dùng API chung. |
| Thiếu Project ID/credential | Chỉ máy chạy BE cấu hình [Firestore](12-ket-noi-firestore.md); FE chạy `npm run fe`. |
| Port 3000/8081 đang dùng | Dừng terminal cũ bằng Ctrl+C; script không tự kill server khác. |
| Không có thiết bị / unauthorized | Mở emulator hoặc chấp nhận USB RSA; giữ đúng một thiết bị khi dùng lệnh gọn. |
| API không kết nối | Kiểm URL, máy BE còn chạy, LAN/firewall; thử `/health` trên máy FE. |
| Gradle/native build lỗi | Kiểm JDK 21, SDK/licenses và mạng tải dependency lần đầu; chạy lại `npm run android` sau khi sửa. |
| Đã unmatch/block và không match lại | Đúng policy core: không tự phục hồi cặp đã kết thúc; dùng fixture/cặp test khác. Không reset cloud. |
| Provider không khả dụng | Xem capabilities; demo/unavailable phải giữ nhãn, không có nút thành công giả. |

## Kiểm thử

- `npm run verify`: typecheck, lint, Firestore Emulator tests và mobile tests.
- `npm run smoke:demo`: API core trên emulator, không cloud writes.
- `npm run demo:emulator`: thử app local, phải ghi rõ emulator.
- `npm run firestore:check`: probe cloud chỉ đọc. Script cloud smoke có ghi dữ liệu; chỉ chạy khi được cấp phạm vi cụ thể.

[QA và giới hạn](qa/final-report.md) · [Bàn giao và việc còn lại](handoff/be-to-fe.md). Android chính; iOS cần macOS/Xcode/CocoaPods và chưa được kiểm trong lượt này.

## D20 — Chạy trên điện thoại USB thật

`npm run demo` bật API cloud thật + Metro; hoặc `npm run be` và `npm run fe`. `npm run android` thiết lập ADB reverse cho 3000/8081; app debug mặc định `http://127.0.0.1:3000`, dùng được cả USB thật lẫn emulator qua reverse. Chỉ dùng `10.0.2.2` khi đi đường host của Android emulator; điện thoại USB không dùng địa chỉ này. Khi tắt BE sẽ mất API dù Metro vẫn chạy. Máy qua LAN nhập URL BE, release chỉ chấp nhận HTTPS. Không bật DEMO_MODE/seed ở cloud.
