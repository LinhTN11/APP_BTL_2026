# Cloud smoke tách namespace — T01.02 / T05.02

Owner QA; F01, F04, F06–F10, F22. Script kiểm core HTTP của API; không nghiệm thu riêng GPS/provider/native UI hoặc toàn bộ các F này. Trạng thái chuẩn bị script không phải bằng chứng cloud đã đạt.

Sau khi chủ project đã tạo database, cấu hình credential local theo [docs12](../12-ket-noi-firestore.md), deploy rules/indexes đúng project và đợi indexes sẵn sàng, chạy tường minh:

```powershell
node --import tsx scripts/firestore-cloud-smoke.mjs --project PROJECT_ID_CUA_NHOM
```

`--project` bắt buộc khớp chính xác `FIREBASE_PROJECT_ID` từ environment hoặc `.env.local`. Script yêu cầu `DATABASE_MODE=firestore`, `DEMO_MODE=true`, không có `FIRESTORE_EMULATOR_HOST`; kiểm các điều kiện này trước import/init SDK. Không đưa credential hoặc token vào lệnh/chat. Cấu hình shell hiện có ưu tiên hơn `.env.local`, theo `scripts/common.mjs`.

Mỗi lần chạy tạo namespace mới `cloud-qa-<uuid>` thay cho namespace demo mặc định, kiểm trống và claim root bằng create-only trước seed. Chỉ dùng dữ liệu hư cấu A/B/C/D. Script giữ namespace cả khi pass hoặc fail; không reset, recursive-delete, unblock hoặc xóa document. Lệnh HTTP `DELETE /v1/matches/:id` chỉ đổi trạng thái match sang ended theo implementation hiện tại.

Các bước kiểm: health cloud → seed create-only → A sửa hồ sơ → seed lại không đè sửa đổi → discovery → A/B like đồng thời và retry có đúng một match → gửi tin đồng thời với cùng `clientMessageId` có đúng một message → B đọc lịch sử, C bị từ chối đọc/gửi → đóng app và Firestore SDK rồi mở lại cùng namespace, session/profile/match/message còn nguyên → block A/B thu hồi đọc/gửi hai chiều → match A/D riêng rồi unmatch thu hồi đọc/gửi hai chiều.

Kết quả in Project ID/namespace, giai đoạn fail hoặc PASS và đường dẫn media local; không in response body/session token/SDK stack. Dữ liệu Console nằm tại `projects/<namespace>`; root có marker QA và khi pass có `smokeStatus`, `verifiedAt`, match/message IDs. Metadata ảnh ở Firestore; file seed vẫn ở `data/cloud-qa/<namespace>/media`, chưa phải Cloud Storage. Script không đụng fixture/media namespace `app-cuoi-ky`.

Lưu output và đối chiếu document Console để ghi evidence. Script dùng hai HTTP session A/B trên cùng API loopback, có tạo lại app/SDK trong cùng Node process. Chưa thay thế kiểm restart bằng process OS mới, hai thiết bị Android, FE gọi API từ máy khác, Socket.IO/lifecycle room, client rules đã deploy hay UI-product. Mỗi lần chạy giữ lại một ít dữ liệu QA trên cloud; chỉ chạy khi cần evidence mới.
