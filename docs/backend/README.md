# BE — bắt đầu ở đây

Cập nhật 03/11/2026. Owner: BE; tài liệu điều phối T00.01/T00.03/T11.02, F01–F37.

## Mục tiêu và ranh giới đã chốt

- USER yêu cầu **chốt đủ yêu cầu + backlog full BE, sửa tài liệu và lớp chặn secret ngay** trong lượt này. Không nhận đã triển khai mọi chức năng còn thiếu.
- “Full BE” là đủ năng lực server trong **37 dòng gốc**, kể cả các năng lực con, có contract, quyền, dữ liệu, test và trạng thái provider rõ ràng. Xem [ma trận gap BE](requirements.md). Không đồng nghĩa mọi provider đều live hay FE hoàn chỉnh.
- React Native Community CLI, Fastify/TypeScript, Cloud Firestore Admin SDK. Ảnh hiện nằm filesystem BE có auth. Không Expo, SQL/fallback, microservice mới.
- Cloud chỉ dữ liệu thật (`DEMO_MODE=false`), không seed. Fixture/demo chỉ ở emulator được chọn rõ. Provider chưa cấu hình trả `unavailable`; không bật kết quả giả ở cloud để đóng task. Mở provider demo mới phải chốt isolation trước.
- D24: FE clone và chạy BE local, nhận **một file cấu hình team** qua kênh riêng, dùng đúng project/namespace cloud chung. Credential được phép chia sẻ cho BE test của team, chỉ nằm ở tiến trình BE; không vào app/Git. [Cài cấu hình và bảo vệ Git](../security/secrets.md).
- Lượt setup không push/deploy, mở IAM, mua dịch vụ hoặc seed/reset cloud. Khi thành viên chạy app/BE, thao tác nghiệp vụ được lưu vào DB test chung theo D24.

## Đọc tối thiểu trước một task

1. [AGENTS.md](../../AGENTS.md) → dòng Fxx/Txx trong [requirements](requirements.md).
2. [API đang chạy](../api/README.md), [OpenAPI](../api/openapi.yaml), [DTO](../../packages/contracts/src/index.ts); chỉ đọc endpoint liên quan.
3. Mở module và test hiện có. Khi thay quyền/dữ liệu: đọc đúng mục [invariants](../08-hop-dong-api-va-du-lieu.md). Khi gặp câu hỏi chưa chốt: [decision log](../07-cau-hoi-va-quyet-dinh.md).
4. Đọc [06 — AI/subagent](../06-quy-tac-ai-va-subagent.md) nếu giao việc; [Firestore setup](../12-ket-noi-firestore.md) nếu đổi runtime/DB; [Firebase Auth](../firebase-auth.md) nếu đổi auth. UI thì đọc UI/prototype riêng.

Không yêu cầu AI nạp toàn bộ QA, 60 màn, mọi skill hoặc lịch sử quyết định cho mỗi task. Không bỏ nguồn yêu cầu khi cần xác định acceptance.

## Bản đồ code hiện có

| Việc | Điểm bắt đầu |
|---|---|
| Listen/runtime/config/socket | `apps/api/src/server.ts`, `firestore/app.ts`, `firestore/context.ts`, `scripts/common.mjs` |
| Firebase identity và opaque session | `firestore/firebase-auth.ts`, `firestore/auth.ts` |
| Hồ sơ, vị trí, ảnh | `firestore/profiles.ts`, `firestore/media.ts` |
| Discovery/swipe/match | `firestore/matching.ts` |
| Chat, block/report | `firestore/chat.ts`, `firestore/safety.ts` |
| Schema/errors/DTO | `apps/api/src/schemas.ts`, `apps/api/src/shared.ts`, `packages/contracts/src/index.ts` |
| Firestore indexes/rules | `firestore.indexes.json`, `firestore.rules` |
| API tests | `apps/api/test/firestore-*.test.ts` |

Các đường dẫn `firestore/*` ở bảng tính từ `apps/api/src/`. Module P06–P10 là phần cần xây trên Firestore; không dùng tên file dự kiến trong roadmap làm bằng chứng đã có implementation.

## Quy trình coding bằng AI

Chọn **một task độc lập** trong backlog, chốt contract trước nếu thêm API. Integrator sở hữu DTO/OpenAPI/schema/index/lockfile chung; worker chỉ sửa file được giao. Tối đa hai worker, ưu tiên model tiết kiệm với task rõ, nâng mức review khi auth, phân quyền, transaction hoặc entitlement.

```text
Task: <Txx.yy / Fxx + năng lực con>, owner BE
Đọc: AGENTS.md; docs/backend/README.md; dòng Fxx của requirements.md;
      API/invariant/decision liên quan; module + test hiện có.
Mục tiêu: <hành vi quan sát được>; mode: <real/demo/unavailable>.
Sở hữu: <file cụ thể>; không sửa: <file chung + file worker khác>.
Phụ thuộc: <task/DTO/quyết định đã có>; câu hỏi chặn: <Qxx hoặc không>.
Acceptance: <happy path, third-user deny, invalid input, retry/race/revoke>.
Verification: <lệnh test cụ thể + môi trường emulator/cloud/thiết bị>.
Timebox: 20–40 phút; báo sớm blocker, tiếp tục phần độc lập.
Trả về: diff, test output, giới hạn, contract/checklist đã cập nhật.
Không đọc/in secret, không commit/push/deploy hoặc ghi cloud.
```

Chưa có quyết định provider/quota/moderation thì chỉ hoàn thiện contract đề xuất và test độc lập; không biến đề xuất thành policy đã chốt. Không chuyển câu hỏi chưa chốt của một phase thành blocker cho mọi phase khác.

## Chạy và nghiệm thu

Máy FE/BE mới trong team: đặt file nhận tại `secrets/team-config.json` → `npm ci` → `npm run team:setup` → `npm run firestore:check` → `npm run demo` (hoặc `be`). Dùng đúng cloud project/namespace của team, không tạo DB riêng. Máy đã có cấu hình giữ nguyên khi không import. [Hướng dẫn ngắn](../handoff/be-to-fe.md). Emulator vẫn là lane test chọn rõ, không thay cloud của team.

| Thay đổi | Lệnh cần chạy |
|---|---|
| Docs | Kiểm link, phủ F01–F37, đối chiếu route/file, không tick test nghiệp vụ từ tài liệu |
| Secret guard | `npm run test:security`, `npm run security:check` |
| Startup/config | `npm run test:startup` |
| Swagger/OpenAPI | `npm run api:docs`, `npm run test:openapi`; browser tại `/docs` |
| BE contract/domain | `npm run typecheck`, `npm run test:firestore` (emulator explicit) |
| Giao toàn luồng sau code | `npm run verify`; cloud/native/provider thật là evidence riêng khi có quyền |

Đóng task cần contract + implementation + kiểm chứng liên quan + review + cập nhật gap/checklist. Ghi riêng **BE**, **FE**, **provider**, **native/cloud QA**; không gộp một nhãn “xong”. Kiểm tra đầy đủ 37 chức năng khác với kiểm thử core đang có. [Roadmap chi tiết](../04-ke-hoach-trien-khai.md) và [checklist nghiệm thu](../05-checklist-be-fe.md) giữ ID ổn định.
