# Cấu hình backend local và bảo vệ credential

Áp dụng T01.01/T11.02. Theo lựa chọn hiện tại, mỗi FE clone repo và chạy BE local, nhưng mọi BE dùng chung Firestore project `app-cuoi-ky-2d653` và namespace `app-cuoi-ky`. Người dùng đã cho phép chủ cấu hình chuyển bộ cấu hình BE hiện có qua Zalo cho nhóm. Quyền này chỉ áp dụng cho thiết lập nhóm đã chọn; không đưa credential vào Git, app mobile hoặc log.

## Cấu hình FE nhận

BE chạy `npm run team:export` để tạo một tệp `secrets/team-config.json` bị Git ignore. Tệp chỉ chứa cấu hình Firebase client được cho phép, Admin service-account hiện có, project ID và namespace. Chủ cấu hình chuyển tệp riêng cho thành viên qua Zalo.

Trên mỗi bản clone FE, đặt file nhận từ Zalo tại `PROJECT_ROOT/secrets/team-config.json`:

```powershell
npm ci
npm run team:setup
npm run firestore:check
npm run demo
```

`team:setup` mặc định đọc `PROJECT_ROOT/secrets/team-config.json`; nếu lưu file khác, dùng `npm run team:setup -- --file <đường-dẫn-khác>`. Lệnh tạo/cập nhật `.env.local` và trích credential vào `PROJECT_ROOT/secrets/team-firebase-service-account.json`, với đường dẫn tuyệt đối được tính theo máy nhận để BE tìm thấy từ workspace `apps/api`. Không cần chép `.env.local` của BE hoặc sửa đường dẫn credential bằng tay. Cả bundle nhận và credential đã trích đều nằm dưới `secrets/`, thư mục này bị Git ignore.

Mỗi người chạy BE local vì vậy máy đó có quyền Admin của project dùng chung. Dùng đúng tệp nhóm đã cấp; không đưa credential vào mobile bundle. App chỉ nhận Firebase client config công khai từ API. Không gửi nội dung file hoặc key qua chat với AI, issue, log hay Git.

## Kiểm tra credential trong repo

Các file `.env.local`, thư mục `secrets/`, service-account JSON, private key và keystore đã bị Git ignore/guard. Giữ hook secret guard đang cấu hình; trước commit chạy:

```powershell
npm run security:check
npm run test:security
```

Nếu `npm ci` bị chạy với `--ignore-scripts`, cài hook trước khi commit:

```powershell
npm run security:install
```

Scanner chỉ dùng Node built-in và Git. `security:check` quét nội dung file tracked; `staged` quét blob trong Git index; hook `pre-push` quét commit sắp gửi. File ignored/untracked như `.env.local` không được quét. Output chỉ nêu đường dẫn và rule, không in giá trị khớp. Nếu guard từ chối file, đừng đổi tên/nhét credential vào source; kiểm tra `.gitignore` và giữ credential local.

Repo có GitHub Actions workflow `Secret guard`; check chưa tự trở thành required cho merge. Chủ repository quản lý Rulesets/Branch protection riêng. Scanner là kiểm soát giảm nhầm lẫn, không thể nhận diện mọi định dạng/provider.

Nếu credential bị commit hoặc gửi nhầm ra ngoài nhóm, báo chủ project để thu hồi/thay thế và xem xét lịch sử Git; xóa file ở commit mới chưa xóa bản cũ. Không in key/token để điều tra.

## Google Sign-In trên build FE

Firebase client API key, App ID, project ID, OAuth client ID là cấu hình client, không phải Admin credential. Nếu Google Sign-In lỗi trên build debug của FE, package hoặc SHA-1 chứng chỉ debug có thể khác máy đã đăng ký. Chủ project đăng ký SHA-1 debug công khai phù hợp trong Firebase/Google Console; không cần chuyển Admin key vào app. Chi tiết hiện có tại [Firebase Auth](../firebase-auth.md).

## Chạy emulator

Emulator là lane test riêng, không phải project/namespace cloud nhóm. Chọn rõ bằng `npm run demo:emulator` hoặc `npm run test:firestore`; không dùng team-config để chuyển emulator sang cloud và không coi emulator pass là kiểm tra project nhóm. [Firestore setup](../12-ket-noi-firestore.md).

Tham khảo cách Firebase phân biệt API key và service-account credential: [Firebase security checklist](https://firebase.google.com/support/guides/security-checklist), [API keys](https://firebase.google.com/docs/projects/api-keys). Push protection là cài đặt riêng của GitHub: [Push protection](https://docs.github.com/en/code-security/concepts/secret-security/push-protection).
