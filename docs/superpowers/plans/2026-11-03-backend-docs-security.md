# Chuẩn hóa tài liệu full BE và secret guard — kế hoạch thực thi

> For agentic workers: triển khai theo ownership trong docs/06-quy-tac-ai-va-subagent.md; USER đã chọn thực thi bằng subagent tiết kiệm. Không cần hỏi lại cách thực thi.

**Goal:** đủ yêu cầu/backlog 37F để BE coding bằng AI, đường đọc ngắn và lớp chặn secret được kiểm chứng.

**Architecture:** giữ implementation hiện có; docs/backend là entry point và audit gap, docs nguồn/API/evidence tiếp tục giữ trách nhiệm riêng. Guard Node kiểm staged blobs và các commit sắp push; Git hook + CI bổ sung .gitignore.

**Tech Stack:** Node 24/npm workspaces, Git, Markdown, GitHub Actions; không thêm dependency dịch vụ.

**Spec:** D23 trong docs/07-cau-hoi-va-quyet-dinh.md và lựa chọn USER 03/11/2026.

## Ràng buộc

Không Expo/SQLite; Firestore qua Admin ở BE; cloud real-only, emulator explicit; không in/chia sẻ secret, không push/deploy/cloud write. Giữ mọi thay đổi có trước. Không tự chốt các Q nghiệp vụ đang mở. Owner file chung là integrator; tối đa hai worker.

## Task 1 — T00.01/T00.03, F01–F37, docs worker

- [x] Đối chiếu nguồn 01/source, contract và route/test đang có.
- [x] Viết docs/backend/requirements.md: đúng 37 dòng, năng lực con, code/gap, Txx, acceptance, dependencies và gate chưa chốt.
- [x] Kiểm đủ ID và link, review nhận định với source code; không chạy lại test nghiệp vụ cho docs-only.

## Task 2 — T01.01/T11.02, security worker

- [x] Viết scripts/security/*, .githooks/pre-commit/pre-push, .github/workflows/secret-guard.yml và docs/security/secrets.md.
- [x] Guard staged blobs, dangerous paths/content, commit trước khi bị xóa, fail closed; không log giá trị bí mật.
- [x] Test bằng repo tạm: staged/unstaged, renamed env, outgoing history, Git failures, hooks và no-leak.
- [x] Trả CLI integration cho root; không sửa package/setup/ignore ngoài ownership.

## Task 3 — T00.01/T11.02, integrator

- [x] Rút gọn root/docs README và handoff, tạo docs/backend/README.md có prompt giao việc.
- [x] Đồng bộ AGENTS và 01/03/04/05/08/11/12, giữ nguồn/evidence, tách kế hoạch cũ với runtime mới.
- [x] Nối package prepare/security scripts và .gitignore/.gitattributes; không ghi đè hooks tùy chỉnh có trước.
- [x] Đọc diff và kiểm guard/test:security, security:check, startup; kiểm link, ID, đường dẫn hiện có và whitespace.
- [x] Cài hook local sau review, ghi evidence thật và giới hạn remote. Không tự commit/push.

## Nghiệm thu

Người BE chỉ cần entry point ngắn rồi tài liệu đúng task; đủ 37 năng lực gốc có nơi làm tiếp; FE biết dữ liệu nào được nhận. Guard chặn các ca đã kiểm bằng repo tạm, không đọc/in credential thật. Báo rõ guard chưa đẩy lên remote và không bảo đảm chống bypass tuyệt đối.

Kết quả kiểm chứng và giới hạn: `docs/qa/backend-docs-security-2026-11-03.md`. Toàn bộ checkbox ở đây chỉ đóng phạm vi docs/security D23, không đóng các Fxx nghiệp vụ còn thiếu.
