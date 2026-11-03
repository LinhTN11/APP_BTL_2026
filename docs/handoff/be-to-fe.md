# Bàn giao BE/FE — mỗi máy BE dùng cùng cloud DB

Cập nhật 03/11/2026. Mỗi FE clone repo và chạy API local; tất cả các API phải dùng **đúng cùng Firestore project `app-cuoi-ky-2d653` và namespace `app-cuoi-ky`**. Tài khoản và document test ghi qua một API sẽ thấy trong DB chung.

## Thao tác ngắn

### Máy BE đã cấu hình

Tại repo trên máy đã có cấu hình cloud, chạy (không cần bật server để xuất file):

```powershell
npm run team:export
```

Lệnh tạo một tệp `secrets/team-config.json` bị Git ignore, gồm cấu hình client Firebase được cho phép, Admin service-account hiện có, project ID và namespace. Người sở hữu cấu hình chuyển tệp này riêng cho thành viên nhóm qua Zalo như đã thống nhất. Không gửi tệp vào repo hoặc mobile app.

### Mỗi máy FE

Tạo thư mục `secrets/` cạnh `package.json` ở root nếu chưa có. Tải file từ Zalo, giữ đúng tên `team-config.json` và đặt tại `PROJECT_ROOT/secrets/team-config.json` trong bản clone. Không cần nhập đường dẫn tải xuống trong lệnh.

```text
APP-Cuoi-Ky/
  secrets/
    team-config.json                    ← file tải từ Zalo
    team-firebase-service-account.json  ← tự tạo bởi team:setup
  .env.local                            ← tự tạo/cập nhật bởi team:setup
```

```powershell
npm ci
npm run team:setup
npm run firestore:check
npm run demo
```

`team:setup` nhập cấu hình vào `.env.local` và trích service account ra `PROJECT_ROOT/secrets/team-firebase-service-account.json`; nó ghi đường dẫn tuyệt đối của máy nhận để API dùng được cả khi chạy từ `apps/api`. Không sửa tay đường dẫn credential. Có thể dùng `npm run team:setup -- --file <đường-dẫn-khác>` nếu bundle đang ở vị trí khác. Sau khi import thành công, chỉ cần giữ bản local dưới `secrets/`; cả hai file secret đều bị Git ignore.

`npm run demo` chạy API và Metro/app trên máy FE. Nếu chỉ cần API, dùng `npm run be`. App đăng nhập qua API local đang kết nối cùng Firestore project/namespace với các thành viên khác.

## Swagger UI và xác thực API

Sau khi BE chạy, mở `http://127.0.0.1:3000/docs` trong trình duyệt để xem API. Nút **Authorize** nhận opaque API session Bearer token. Không dán Firebase ID token hoặc Admin key vào đó. Firebase ID token được đổi lấy API session qua `POST /v1/auth/firebase`; app thực hiện bước này sau khi người dùng đăng nhập bằng Firebase SDK. [OpenAPI contract](../api/openapi.yaml).

Thử `GET /health` bằng **Try it out → Execute** trước. Với API cần đăng nhập, đổi Firebase ID token ở `POST /v1/auth/firebase`, copy `data.token` trong response vào **Authorize** (chỉ giá trị token, Swagger tự thêm `Bearer`). Có thể tải spec tại `/docs/json` hoặc `/docs/yaml`. Khi sửa contract, BE chạy `npm run api:docs`; khởi động lại BE để nạp spec mới.

## Cấu hình và dữ liệu dùng chung

- Chỉ một cặp giá trị project/namespace được dùng: `app-cuoi-ky-2d653` / `app-cuoi-ky`. Script setup từ chối file sai cặp hoặc cấu hình emulator đang bật; không tự sửa cấu hình đang trỏ sang DB khác.
- Tệp bàn giao chứa credential BE nhạy cảm. Chuyển riêng cho thành viên nhóm qua kênh đã thống nhất; không đưa vào Git, issue, log, app bundle hoặc chat với AI. Mỗi máy giữ bản local trong `secrets/` và `.env.local`.
- Cấu hình Firebase client (API key, App ID, project ID, OAuth client ID) là public config; Admin service-account key mới là credential backend. App mobile chỉ nhận public config qua API, không đóng gói Admin key.
- Các tài khoản, profile, preferences, match và message lưu Firestore dùng chung nên thay đổi của nhóm thấy được trong cùng DB. Không seed/reset DB chung khi kiểm tra kết nối.
- Ảnh profile hiện lưu bytes trên filesystem cục bộ của từng API, không nằm trong Firestore. Metadata có thể đồng bộ qua DB, nhưng bytes ảnh do một máy tải lên không tự xuất hiện trên máy BE khác. Vì vậy media chưa được chia sẻ bền vững giữa các API local.
- `message:created` được phát bởi tiến trình API đã nhận tin, chưa có fanout nội dung chat giữa các BE local. Một số event vòng đời như `match:created`/`match:ended` có listener dựa trên Firestore, nhưng không suy ra mọi socket event đều chạy xuyên máy. REST reload vẫn đọc dữ liệu đã commit từ DB chung.

## Nếu bước nào lỗi

- `team:setup` báo project/namespace không khớp: dừng, nhờ chủ cấu hình xuất lại tệp; không chỉnh ID hoặc trỏ sang DB khác.
- `npm run firestore:check` chỉ kiểm tra đọc kết nối cloud. Nếu lỗi, kiểm tra tệp cấu hình đã tải đúng, `.env.local` không còn emulator/giá trị cũ và credential local tồn tại; không dán nội dung key vào log.
- Nếu Google Sign-In lỗi ở build debug trên máy FE, package và SHA-1 chứng chỉ debug có thể khác máy hiện tại. Chỉ cần đăng ký SHA-1 debug công khai phù hợp trong Firebase/Google Console; không đưa Admin key vào app. Xem [Firebase Auth](../firebase-auth.md).
- Emulator là lane riêng: `npm run demo:emulator` / `npm run test:firestore` dùng Firestore Emulator, không phải DB nhóm và không thay cho `firestore:check`.

## Phạm vi API hiện tại

| Phạm vi | Trạng thái BE/API |
|---|---|
| Auth | Firebase SDK email/Google → `POST /v1/auth/firebase` → API session. Route auth tùy biến cũ trả 410. Tài khoản Google thật trên thiết bị cần kiểm chứng. |
| Hồ sơ/khám phá | Profile, ảnh, lifestyle, bộ lọc cơ bản, vị trí consent và Like/Pass/Match gọi API thật. Video và bộ lọc nâng cao còn thiếu. |
| Chat/an toàn | REST + Socket.IO, text, vị trí một điểm do người gửi chủ động, Unmatch/Block/Report. GIF/sticker provider thật chưa có. |
| P06–P10 | Phần lớn chưa triển khai Firestore; xem [ma trận 37F và backlog BE](../backend/requirements.md). |

FE giữ envelope `{data,...meta}` hoặc `{error:{code,message,requestId,fieldErrors?}}`. Bearer session được lưu an toàn trên máy; không log token. REST là nguồn dữ liệu tin nhắn; retry giữ `clientMessageId` và nội dung; reconnect tải lại REST, upsert theo ID. [Contract hiện hành](../api/README.md) · [OpenAPI](../api/openapi.yaml).

`team-cloud.json` ở root chỉ chứa project ID/namespace công khai. Export/import đối chiếu file này để không nhận nhầm bundle của DB khác. Muốn đổi DB của cả team phải cập nhật quyết định và manifest trước, không tự sửa ID trong bundle.
