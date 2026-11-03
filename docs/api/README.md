# Tài liệu API

`openapi.yaml` là OpenAPI 3.1 sinh từ `apps/api/scripts/generate-openapi.ts`; file dùng cú pháp JSON nên cũng là YAML hợp lệ. Route hiện tại được mô tả theo mã trong `apps/api/src/firestore/`. Không thêm roadmap P06–P10 vào contract trước khi BE triển khai.

## Mở Swagger UI

Khi API chạy ở cùng origin, mở `/docs` để xem và thử API; raw spec có tại `/docs/json` và `/docs/yaml`. UI không lưu quyền xác thực giữa các lần tải trang. Protected routes cần API session opaque từ `POST /v1/auth/firebase`; public routes tự bỏ Bearer security.

## Xác thực

Đăng nhập email/Google bằng Firebase Authentication SDK trong app, sau đó gửi Firebase ID token đến `POST /v1/auth/firebase`. API xác minh token và trả session opaque để dùng dạng `Authorization: Bearer <session>`. Không gửi mật khẩu, Firebase Admin key hoặc token thật vào Swagger example, Git hay tài liệu.

Các route OTP, selfie và GIF/sticker chỉ chạy ở emulator/demo được bật rõ ràng, hoặc trả 503 khi provider chưa khả dụng. API demo account/session trả 404 khi demo tắt. Các route custom register/login/Google cũ trả `410 AUTH_SDK_REQUIRED`.

## Sinh lại contract

Từ thư mục gốc repository:

```powershell
npm run api:docs
```

Generator ghi `docs/api/openapi.yaml`. Sau khi sửa route/schema, cập nhật generator và chạy test contract:

```powershell
npm run test:openapi
```

Core hiện dùng Firestore cho metadata; bytes ảnh nằm trên filesystem của BE, nên cùng Firestore project/namespace không tự đồng bộ file ảnh giữa các máy. Xem [Firestore core](firestore-core.md), [hợp đồng API/dữ liệu](../08-hop-dong-api-va-du-lieu.md) và [kết nối Firestore](../12-ket-noi-firestore.md).

Swagger dùng static contract với [@fastify/swagger](https://github.com/fastify/fastify-swagger) và giao diện local từ [@fastify/swagger-ui](https://github.com/fastify/fastify-swagger-ui). Nhánh plugin đã khóa tương thích Fastify 5 theo bảng compatibility chính thức và được kiểm trong suite emulator.
