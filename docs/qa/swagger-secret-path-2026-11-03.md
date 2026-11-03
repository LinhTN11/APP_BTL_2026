# QA — đường dẫn secret chuẩn và Swagger API

Ngày 03/11/2026 (Asia/Saigon). T01.01/T00.03/T11.02, cấu hình và contract xuyên F01–F37 theo D25. Không triển khai tính năng roadmap mới.

## Thay đổi

- `team:setup` mặc định đọc `secrets/team-config.json`; giữ override `--file`. Handoff có cây thư mục và lệnh không cần điền đường dẫn Downloads.
- Credential được trích ra `secrets/team-firebase-service-account.json`, `.env.local` dùng đường dẫn tuyệt đối tính theo từng máy (API npm workspace có cwd riêng). Guard project/namespace/cloud mode, backup và rollback giữ nguyên.
- Swagger UI `/docs` cùng raw spec `/docs/json`, `/docs/yaml`; plugin `@fastify/swagger` 9.9.3 và `@fastify/swagger-ui` 5.2.6 dùng với Fastify 5. Tài nguyên được phục vụ local; giữ script CSP, cho runtime inline styles của Swagger, không ép HTTPS trên HTTP LAN debug.
- 41 operation của API hiện hành: server cùng origin `/`, nhóm/summary tiếng Việt, schema JSON/multipart/binary, query/path params, examples không chứa credential, lỗi, auth/session và deprecated routes. Không có endpoint roadmap nâng cao được nhận là đã chạy.
- `npm run api:docs` sinh lại spec; `npm run test:openapi` kiểm contract/UI. `verify` có thêm test OpenAPI. Startup BE in URL Swagger.

## Verification

| Kiểm tra | Kết quả |
|---|---|
| `npm run api:docs` | Exit 0; artifact cập nhật theo generator. |
| `npm run test:openapi` | **4/4 pass**, exit 0; UI/assets/spec local, auth API vẫn giữ; metadata/path params/security/references/upload/binary/410 được kiểm. |
| `npm run test:startup` | **24 pass, 1 skip, 0 fail**, exit 0; gồm **12 test team config**. Skip là cleanup emulator không thuộc luồng này. |
| `npm run typecheck` | API + mobile exit 0. Không đổi TSX/mobile flow. |
| `npm run test:security` | **17/17 pass**, exit 0. |
| `npm run security:check` | Exit 0; không phát hiện tên file/mẫu credential bị cấm trong file tracked. |
| `npm run team:setup` trên máy nguồn | Exit 0; cài đường dẫn chuẩn bằng bundle đã có. Backup được script giữ local; không in nội dung key. |
| Browser Edge qua Playwright | 41 operation hiển thị, không có lỗi render spec; Authorize có Bearer API session. GET `/health` bằng Execute trả **200**, body xác nhận Firestore cloud đúng `app-cuoi-ky-2d653` / `app-cuoi-ky`. GET profile chưa đăng nhập trả **401**. Console fresh reload cuối **0 error/0 warning**; legacy marked deprecated và OTP ở nhóm thử nghiệm. |

`npm run test:firestore`: **28/28 pass**, 0 skip/fail, exit 0 trên explicit Firestore emulator. Test mới đối chiếu mọi operation trong spec với route thực tế, mở docs không session, API profile vẫn 401 khi thiếu session và nhận 200 sau demo login chỉ ở emulator. Browser cloud chỉ GET, không tạo tài khoản/session hoặc sửa dữ liệu cloud. Kiểm **119 link local trong 11 tài liệu**: không hỏng. `git diff --check` trên file tracked thuộc lượt này exit 0; chỉ có cảnh báo line ending Windows. File mới cũng được kiểm trailing whitespace.

## Phạm vi và giới hạn

Không in key, không gửi Zalo bằng tool, không mở IAM, không seed/reset cloud, không commit/push/deploy. BE local được mở phục vụ kiểm Swagger; không là triển khai Internet. Tài liệu app/media/realtime nhiều BE vẫn giữ giới hạn D24. Chưa kiểm trên máy FE khác; không suy emulator pass thành provider/cloud write pass.
