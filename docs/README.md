# Tài liệu dự án Gặp

Cập nhật 03/11/2026. **Core Firestore đã có code và evidence từng phần; full BE 37 chức năng chưa hoàn tất.** D24: FE clone/chạy BE local, nhận một file cấu hình qua Zalo và dùng đúng cloud DB của team. Bắt đầu từ [README](../README.md); yêu cầu/backlog và secret guard vẫn áp dụng.

## Đọc theo việc cần làm

| Bạn cần | Bắt đầu tại |
|---|---|
| Chạy BE hoặc Android | [README root](../README.md) |
| BE dùng AI để tiếp tục coding | [BE — bắt đầu ở đây](backend/README.md) |
| Đủ 37 yêu cầu, code hiện có, gap và thứ tự làm | [Ma trận BE và backlog](backend/requirements.md) |
| FE kết nối API, chia trách nhiệm | [Bàn giao BE → FE](handoff/be-to-fe.md) |
| Cấp cấu hình, chặn commit/push nhầm secret | [Secret và bảo vệ Git](security/secrets.md) |
| Swagger xem/thử API | [Mở Swagger local](http://127.0.0.1:3000/docs), [cách dùng và sinh contract](api/README.md) |
| Endpoint đang chạy, DTO, lỗi, socket | [API hiện hành](api/README.md), [OpenAPI](api/openapi.yaml), [DTO](../packages/contracts/src/index.ts) |
| Lần đầu chạy backend cloud | [Firestore](12-ket-noi-firestore.md), [Firebase Auth](firebase-auth.md) |
| Android/LAN/USB, GPS, lỗi khởi động | [Runbook](09-chay-demo-va-ban-giao.md) |
| UI và duyệt thiết kế | [UI/UX](02-yeu-cau-ui-ux.md), [prototype nháp](prototype/index.html), [brand](design/brand-2026-11-02.md) |

## Nguồn chuẩn và cách xử lý mâu thuẫn

1. Chỉ dẫn USER hiện tại và [quyết định](07-cau-hoi-va-quyet-dinh.md) mới nhất áp dụng cho phạm vi tương ứng.
2. [Nguồn gốc bất biến](source/yeu-cau-goc.md) và [phân tích sản phẩm F01–F37](01-yeu-cau-san-pham.md) giữ đầy đủ yêu cầu; `PROPOSAL` chưa trở thành quyết định USER.
3. Hành vi hiện hành đối chiếu **code + API hiện hành + test**. Nếu lệch yêu cầu, ghi gap; không sửa nguồn để hợp thức hóa code.
4. [Contract/invariants](08-hop-dong-api-va-du-lieu.md) gồm cả thiết kế mở rộng; endpoint dự kiến chưa được gọi như API đã chạy. [Roadmap Txx](04-ke-hoach-trien-khai.md) giữ ID nhiệm vụ; [checklist](05-checklist-be-fe.md) giữ điều kiện đóng việc.

BE đọc bộ ngắn ở trên và chỉ mở tài liệu chi tiết đúng task. [Kỹ thuật](03-yeu-cau-ky-thuat.md), [quy tắc AI/subagent](06-quy-tac-ai-va-subagent.md) vẫn áp dụng. [Kế hoạch một ngày](11-ke-hoach-mot-ngay.md) là timebox lịch sử 01/11/2026, không phải deadline mới hay giới hạn yêu cầu full BE.

## Evidence — đọc đúng phạm vi và ngày

| Phạm vi | Báo cáo |
|---|---|
| Secret path và Swagger, 03/11 | [QA Swagger/setup](qa/swagger-secret-path-2026-11-03.md) |
| Cài BE local với DB cloud test chung, 03/11 | [QA team setup](qa/team-cloud-setup-2026-11-03.md) |
| Lượt chuẩn hóa tài liệu và secret guard 03/11 | [QA lượt này](qa/backend-docs-security-2026-11-03.md) |
| Chat/retry/quyền, 03/11 | [Chat audit](qa/chat-audit-2026-11-03.md) |
| Discovery/GPS/bán kính, 02/11 | [Discovery](qa/discovery-radius-2026-11-02.md), [GPS/theme](qa/discovery-gps-theme-2026-11-02.md) |
| Cloud thật/D20, 02/11 | [Real data](qa/production-real-data-2026-11-02.md), [cloud setup](qa/cloud-setup-2026-11-02.md), [native cloud](qa/native-cloud-2026-11-02.md) |
| Core và UI lịch sử | [Core report](qa/final-report.md), [UI](qa/product-ui-2026-11-02.md), [motion](qa/brand-motion-2026-11-02.md) |

Evidence cũ không chứng minh trạng thái cloud hiện tại. Test emulator không chứng minh provider thật hoặc hai thiết bị. Visual vẫn là bản nháp chưa được duyệt. SQLite/API SQL cũ không còn active; không tự khôi phục hoặc dùng `.local/` làm contract.
