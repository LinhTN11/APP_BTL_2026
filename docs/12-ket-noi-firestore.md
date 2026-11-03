# Firestore cloud dùng chung cho BE local

Cập nhật 03/11/2026. Mỗi thành viên clone repo và chạy BE trên máy mình, nhưng mọi BE phải kết nối **cùng Firebase project `app-cuoi-ky-2d653` và Firestore namespace `app-cuoi-ky`**. Không tạo project/namespace riêng cho FE.

Project và credential hiện có đã được cấu hình theo D13. Cloud Firestore Standard ở `asia-southeast1`, client rules deny-all; các composite index hiện có READY. Chi tiết bằng chứng tại [cloud setup](qa/cloud-setup-2026-11-02.md). Người dùng đã cho phép chuyển bộ cấu hình BE cần thiết qua Zalo cho thành viên nhóm theo flow ở [bàn giao BE → FE](handoff/be-to-fe.md). Mỗi máy giữ bản local bị Git ignore; không cần tự tạo service account hoặc đổi IAM.

## Xuất cấu hình ở máy đã có BE

Tại repo trên máy đã cấu hình đúng, chạy (không cần server đang bật):

```powershell
npm run team:export
```

`team:export` tạo **một tệp** `secrets/team-config.json` gồm danh sách biến được cho phép, service-account hiện tại, project ID và namespace. Chuyển tệp thủ công cho đúng thành viên qua Zalo. Không đưa tệp vào repo, app hoặc log.

## Nhập cấu hình ở mỗi máy FE

Đặt file nhận từ Zalo tại `PROJECT_ROOT/secrets/team-config.json` trong bản clone.

```powershell
npm ci
npm run team:setup
npm run firestore:check
npm run demo
```

`team:setup` dùng file tại đường dẫn ổn định trên làm mặc định; có thể dùng `npm run team:setup -- --file <đường-dẫn-khác>` để chọn file khác. Lệnh tạo/cập nhật `.env.local` và trích service account thành `PROJECT_ROOT/secrets/team-firebase-service-account.json`; đường dẫn tuyệt đối được tính lại theo máy nhận để API tìm đúng file kể cả khi process chạy từ `apps/api`. Không sửa tay đường dẫn credential. Script giữ cấu hình máy không liên quan và từ chối project/namespace khác hoặc cờ emulator. Chạy `npm run be` nếu chỉ cần API.

`npm run firestore:check` là kiểm tra đọc, không ghi/xóa document. Nếu project/namespace, credential hoặc chế độ emulator không đúng, dừng và lấy lại tệp từ máy nguồn; không tự đổi project ID để làm lệnh chạy tiếp.

## Dữ liệu và giới hạn giữa nhiều BE local

- Cloud Firestore chứa các collection dưới `projects/{FIRESTORE_NAMESPACE}`; Auth dùng cùng Firebase project. Account, profile, preferences, match và message của nhóm lưu ở DB chung. Ghi qua một máy sẽ hiện khi máy khác tải lại dữ liệu từ DB.
- Test nhóm dùng account/dữ liệu thật của project chung; các thay đổi qua app/API được chia sẻ. Không chạy seed/reset lên DB này.
- Ảnh/media bytes hiện lưu trên filesystem của từng BE local; metadata nằm trong Firestore. Ảnh tải lên từ máy này không tự đồng bộ bytes sang máy BE khác, dù dùng chung DB.
- `message:created` được phát bởi tiến trình API đã nhận tin; chưa có fanout nội dung chat giữa các BE local. Một số event vòng đời như `match:created`/`match:ended` có listener Firestore, nhưng không có nghĩa mọi socket event được chia sẻ. REST reload đọc dữ liệu đã commit từ DB chung.
- `npm run demo:emulator` và `npm run test:firestore` là emulator explicit, project test riêng; không phải DB nhóm và không thay cho `firestore:check`.

## Nếu phải thay đổi project hoặc quyền

Không tạo project riêng cho từng thành viên. Nếu nhóm cần đổi project/namespace hoặc thêm quyền backend, chủ project cần quyết định và cấu hình đúng nơi trước; các máy nhận file mới cùng dùng đúng một cặp giá trị. Cấu hình hiện tại dùng Firestore Standard và client rules deny-all; app truy cập nghiệp vụ qua API/Admin SDK. Không cần `google-services.json` để app gọi Firestore trực tiếp vì app không dùng Firestore client SDK.

Nếu gặp lỗi quyền cloud, gửi mã lỗi và tên quyền thiếu cho chủ project; không tự mở rộng IAM, nâng gói, bật dịch vụ trả phí hay triển khai rules/indexes.

## Git và credential

`.env.local`, `secrets/`, service-account JSON và private key bị Git ignore/guard. `npm ci` cài hook qua `prepare`; nếu dùng `--ignore-scripts`, cài hook bằng `npm run security:install`. Trước khi commit có thể chạy `npm run security:check` và `npm run test:security`. Xem [bảo vệ credential và team setup](security/secrets.md); không cần đọc nội dung key để kiểm tra guard.

`team-cloud.json` ở root chỉ chứa project ID/namespace công khai. Export/import đối chiếu file này để không nhận nhầm bundle của DB khác. Muốn đổi DB của cả team phải cập nhật quyết định và manifest trước, không tự sửa ID trong bundle.
