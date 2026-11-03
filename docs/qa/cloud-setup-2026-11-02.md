# Cloud Firestore — bằng chứng setup ngày 02/11/2026

Owner: Integrator/BE, T01.02 và T05.02; core F01, F03–F10, F22. Ngày/giờ ghi theo Asia/Saigon. Đây là database thật cho demo, không phải nghiệm thu đủ 37 chức năng hay FE-product.

## Cấu hình được quan sát và kiểm tra

- Project người dùng đã tạo: `app-cuoi-ky-2d653`, tên App-Cuoi-Ky; không dùng project khác.
- Tạo database `(default)`, Standard, `asia-southeast1` (Singapore) qua Firebase Console bằng computer-use. Giữ Spark; không bật billing, backup hay dịch vụ trả phí.
- Production rules mặc định: `allow read, write: if false;`. Đọc lại release `projects/app-cuoi-ky-2d653/releases/cloud.firestore` và source rules qua Rules API xác nhận deny all; không chỉ dựa vào màn wizard.
- Người dùng xác nhận riêng việc tạo một khóa Admin SDK. File tải về đã kiểm `project_id` và `type` rồi chuyển vào `secrets/firebase-service-account.json`; không in nội dung, không đưa vào mobile hay Git.
- `.env.local`: cloud mode, đúng project, namespace demo `app-cuoi-ky`, credential path tuyệt đối trên máy BE. Không có emulator host. `git check-ignore` xác nhận cả env và credential bị ignore.

## Kết quả lệnh

| Kiểm tra | Kết quả thực tế |
|---|---|
| `npm run firestore:check` | Exit 0: cloud, project `app-cuoi-ky-2d653`, namespace `app-cuoi-ky`; không ghi document |
| `npm run firestore:seed` | Exit 0: tạo fixture hư cấu A/B/C/D theo create-only; không reset state |
| Anonymous Firestore REST read | HTTP 403, `PERMISSION_DENIED`, ở đúng cloud project; không thử ghi ẩn danh |
| `npm run typecheck` | Exit 0 cho API và mobile |
| `npm run lint` | Exit 0 |
| `node --check scripts/firestore-cloud-smoke.mjs` | Exit 0 |
| Cloud HTTP smoke | Exit 0 ngày 02/11/2026 khoảng 02:21 Asia/Saigon; bounded HTTP core PASS, chi tiết dưới đây |

## Indexes và giới hạn quyền triển khai

CLI `firebase deploy --only firestore:rules,firestore:indexes --project app-cuoi-ky-2d653 --non-interactive` dừng với HTTP 403 khi kiểm `serviceusage.services.get`. `testIamPermissions` xác nhận credential không có `serviceusage.services.get` hoặc `datastore.indexes.create`; đây là thiếu quyền quản trị cho CLI, khác với quyền đọc/ghi DB đã đạt. Không mở rộng IAM để xử lý.

Tạo bốn composite index qua Console bằng phiên đăng nhập sẵn của người dùng. Các link tạo index do chính truy vấn SDK trả về, đối chiếu `firestore.indexes.json` trước Save:

| Collection | Fields (ASC nếu không ghi khác) | Index ID | Trạng thái đã kiểm tra |
|---|---|---|---|
| users | accountStatus, createdAt, id, __name__ | CICAgOjXh4EK | READY |
| blocks | actorId, createdAt, id, __name__ | CICAgJiUpoMK | READY |
| messages | matchId, createdAt, id, __name__ | CICAgJim14AK | READY |
| matches | memberIds ARRAY_CONTAINS, status, createdAt, id, __name__ | CICAgJjF9oIK | READY |

`__name__` là trường bổ sung tự động của Firestore. REST Admin API trả bốn trạng thái READY; Console hiển thị cả bốn Enabled trước khi chạy smoke.

## Cloud HTTP smoke đã chạy

```powershell
node --import tsx scripts/firestore-cloud-smoke.mjs --project app-cuoi-ky-2d653
```

Exit 0, chỉ một lần chạy cloud. Namespace giữ lại: `cloud-qa-09f3fe9c-5ffe-40b1-8616-1f28640df6ed`. Không sửa fixture demo chính `app-cuoi-ky`; không xóa document.

| Case | Kết quả |
|---|---|
| Health | `firestore/cloud`, đúng project và namespace QA |
| Profile/seed | A sửa bio, đọc lại; seed lần hai giữ nguyên sửa đổi |
| Discovery | A nhìn thấy B |
| Like đồng thời/retry | A/B mutual like và retry: đúng một match document, cùng match ID |
| Message đồng thời/retry | Cùng clientMessageId: cùng message ID, đúng một document và một dòng history |
| Quyền C | C bị từ chối cả đọc và gửi chat A/B |
| Persistence | Đóng API và Firestore SDK, tạo lại trong cùng Node process: session/profile/match/chat vẫn còn |
| Block | A block B: cả hai bị từ chối đọc và gửi chat |
| Unmatch | Cặp A/D riêng: unmatch thu hồi đọc/gửi của cả hai; match document được giữ trạng thái ended |
| Console | Root QA hiển thị `smokeStatus: "passed"`, `retainedForConsoleEvidence: true`, match/message IDs và `verifiedAt: "2026-11-01T19:21:43.021Z"` |

Output kết thúc: `Cloud HTTP smoke PASS: project=app-cuoi-ky-2d653, namespace=cloud-qa-09f3fe9c-5ffe-40b1-8616-1f28640df6ed`.

## Artifacts và giới hạn

[Script cloud smoke](../../scripts/firestore-cloud-smoke.mjs) chỉ ghi namespace mới `cloud-qa-<uuid>`, giữ evidence và không xóa document. [Hướng dẫn](cloud-smoke-guide.md) mô tả preflight, các bước và giới hạn. Fixture demo chính không bị block/unmatch bởi smoke.

Chưa kiểm hai thiết bị Android trên cloud, Socket.IO cloud, iOS, native permissions đầy đủ, TalkBack/font 200% hoặc FE-product. Ảnh vẫn ở filesystem BE; metadata DB cloud không biến media thành Cloud Storage. OTP/selfie vẫn demo; OAuth và các provider chưa cấu hình giữ trạng thái unavailable. Extensions P06–P10 vẫn cần port riêng.

Phân công model và file ownership: [bàn giao hiện tại](../handoff/be-to-fe.md) (dispatch cũ lưu local trong `.local/`). Hướng dẫn chính thức: [Firestore quickstart](https://firebase.google.com/docs/firestore/quickstart), [locations](https://firebase.google.com/docs/firestore/locations), [quota](https://firebase.google.com/docs/firestore/quotas).
