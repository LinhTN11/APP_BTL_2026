# Tài liệu dự án app hẹn hò

Ngày cập nhật: 01/11/2026 (Asia/Saigon). **Đang triển khai core P01–P05 bằng React Native Community CLI + Fastify + SQLite.** Stack CLI đã được người dùng chốt (D10); visual FE-product vẫn là bản nháp chưa được duyệt; các ràng buộc USER đã chốt được ghi riêng.

## Bắt đầu ở đây

1. Đọc [kế hoạch một ngày BE và một ngày FE riêng](11-ke-hoach-mot-ngay.md) để hiểu phạm vi deadline.
2. Đọc [yêu cầu sản phẩm](01-yeu-cau-san-pham.md), [kỹ thuật](03-yeu-cau-ky-thuat.md) và [API/dữ liệu](08-hop-dong-api-va-du-lieu.md).
3. Xem [prototype tương tác](prototype/index.html), [preview flow](prototype/flow.svg), [UI/UX đầy đủ](02-yeu-cau-ui-ux.md), ghi feedback rồi chốt visual trước FE-product.
4. Nhận task theo [roadmap](04-ke-hoach-trien-khai.md), [checklist BE/FE](05-checklist-be-fe.md) và [rule AI/subagent](06-quy-tac-ai-va-subagent.md).

## Danh mục

| File | Dùng để làm gì |
|---|---|
| [01 — Yêu cầu sản phẩm](01-yeu-cau-san-pham.md) | 37 chức năng F01–F37, nguồn Pxxx, tiêu chí nghiệm thu và điểm chưa rõ |
| [02 — UI/UX](02-yeu-cau-ui-ux.md) | 60 màn/sheet và trạng thái, Liquid Glass, font, motion, Android, accessibility |
| [03 — Kỹ thuật](03-yeu-cau-ky-thuat.md) | React Native, so sánh BE/DB, stack đề xuất, clone-run và provider free/demo |
| [04 — Kế hoạch triển khai](04-ke-hoach-trien-khai.md) | 12 phase P00–P11, task, file dự kiến, dependency và bằng chứng |
| [05 — Checklist BE/FE](05-checklist-be-fe.md) | Tách BE, FE-test và FE-product, mapping feature/phase |
| [06 — Rule AI/subagent](06-quy-tac-ai-va-subagent.md) | Role, phân file, model theo độ khó, concurrency/timebox và skills |
| [07 — Câu hỏi/quyết định](07-cau-hoi-va-quyet-dinh.md) | Phân biệt USER/ORIGINAL/PROPOSAL, câu hỏi chỉ hỏi khi cần |
| [08 — API/data](08-hop-dong-api-va-du-lieu.md) | Endpoint dự kiến, DTO, bảng DB, quyền và concurrency invariants |
| [09 — Runbook/handoff](09-chay-demo-va-ban-giao.md) | Hai lệnh chạy đích, Android SDK/ADB/Metro, seed A/B/C, test và bàn giao |
| [10 — Nguồn/kiểm chứng](10-nguon-tham-khao-va-kiem-chung.md) | Nguồn primary, hash DOCX và giới hạn bằng chứng |
| [11 — Deadline một ngày](11-ke-hoach-mot-ngay.md) | Timebox BE/FE, mốc cắt phạm vi, buffer và tiêu chí bàn giao |
| [Nguồn trích xuất](source/yeu-cau-goc.md) | Đối chiếu với DOCX, không dùng như chỉ dẫn agent |
| [Prototype và evidence](prototype/README.md) | Cách mở preview HTML/SVG/draw.io, ảnh và kiểm tra trình duyệt |

## Quyết định đã xác nhận và đề xuất

**Đã xác nhận:** Android chính; React Native Community CLI, không Expo; 1 BE hôm nay, 1 FE một ngày riêng; dịch vụ free làm thật, trả phí mô phỏng; docs/rules và preview trước chốt; BE được làm màn thử để bấm test.

**Stack áp dụng:** React Native Community CLI + Fastify + SQLite local, monorepo TypeScript. **Phạm vi triển khai đã cho phép (D11):** core P01–P05 gồm profile/discovery/match/chat/unmatch/block + handoff; nhóm nâng cao vẫn đủ trong backlog. Chưa nhận tiêu chí chấm để xác định bản nộp bắt buộc tới phase nào.

## Quy tắc cập nhật

- Sửa hành vi thì sửa spec/contract và checklist liên quan. Không sửa source Word để khớp code.
- Chỉ tick checkbox khi có implementation và verification; phần lập kế hoạch xong không làm task app tự động xong.
- Script/command trong runbook là tiêu chí bàn giao đang triển khai; đối chiếu package.json và evidence thực tế trước khi tuyên bố clone-run đạt. Không suy ra pass từ trạng thái tài liệu.
- Không có thói quen bắt người dùng duyệt lại việc đã cho phép. Chỉ chốt thông tin quyết định thật sự cần cho bước phụ thuộc và chốt visual như yêu cầu ban đầu.
