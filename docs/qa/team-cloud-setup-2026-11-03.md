# QA — FE clone BE và dùng đúng cloud DB của team

Ngày 03/11/2026, task T01.01/T11.02, phạm vi cấu hình xuyên F01–F37. Quyết định D24: mỗi FE chạy BE local, nhận credential test được USER cho phép qua file riêng (ví dụ Zalo), tất cả dùng đúng cloud project/namespace hiện tại.

## Kết quả

- Thêm `team:export`, `team:setup`, `test:team`; một file bàn giao `secrets/team-config.json` chứa allowlist runtime config và service-account hiện có. Không sao chép toàn bộ env hoặc giá trị session/provider không liên quan.
- Public manifest `team-cloud.json` khóa project `app-cuoi-ky-2d653` / namespace `app-cuoi-ky`. Export/import từ chối bundle khác DB, account khác project, emulator/demo/seed và shell override xung đột.
- Import tính đường dẫn credential **tuyệt đối trên máy nhận** để dùng được khi npm workspace API chạy từ `apps/api`; không dùng đường dẫn của máy gửi. Giữ cấu hình máy không liên quan, backup local khi thay đổi, import lặp không nhân bản và rollback khi lần ghi sau lỗi.
- Nếu export lại thay đổi, backup bản cũ và thay nguyên tử file canonical `secrets/team-config.json`; tài liệu luôn trỏ đúng file cần gửi. Không cần bật server để xuất.
- Đồng bộ README, AGENTS, BE guide, handoff, Firestore, security guide, kỹ thuật/runbook/checklist và decision D24; không bỏ secret guard.

## Verification thực sự chạy

| Kiểm tra | Kết quả |
|---|---|
| `npm run test:team` | **10/10 pass**, exit 0; toàn bộ dùng key giả/thư mục tạm, không nhập vào cấu hình thật. |
| `npm run test:startup` sau tích hợp | **22 pass, 1 skip, 0 fail**, exit 0. Bao gồm 10 test team; ca skip là cleanup emulator không thuộc scope onboarding. |
| `npm run test:security` | **17/17 pass**, exit 0; hook Git thật và remote bare tạm, không push mạng. |
| `npm run security:check` | Exit 0; không có file tracked/mẫu credential bị cấm được phát hiện. |
| Self-scan file mới | Worker tạo repo Git tạm, stage module/team tests/manifest/ignore/guard rồi chạy scanner staged: pass. Không stage repo thật. |
| `npm run team:export` trên máy nguồn | Exit 0; file canonical đã tạo local, không in nội dung credential. Kiểm metadata cho thấy bundle cloud-only, project/namespace khớp manifest, credential.project_id khớp. |
| `npm run firestore:check` | **Exit 0**: `Firestore read connection OK: cloud project=app-cuoi-ky-2d653, namespace=app-cuoi-ky. No documents written.` |
| Git ignore | `.env.local`, `secrets/team-config.json`, `secrets/team-firebase-service-account.json` đều bị ignore. |

Hai worker `gpt-6-luna` chia ownership script/tests và docs; integrator review, nối npm/manifest và chạy export/check thật. Không có số đo hóa đơn để khẳng định số tiền/quota đã tiết kiệm. Hướng URL-only `team:info/check` được dừng khi USER chốt lại và file thử của worker đã gỡ; không còn là entry point.

## Giới hạn đã ghi trong handoff

Cùng cloud DB là đã khóa bằng manifest và config, không đồng nghĩa mọi bytes ảnh hay socket event tự đồng bộ qua nhiều BE. Media hiện filesystem mỗi BE; `message:created` fanout trong tiến trình nhận POST, REST reload lấy được document chung. Không triển khai storage/broker trong lượt setup này. Test realtime/ảnh giữa người dùng có thể cùng trỏ một API khi cần.

Chưa thao tác trên máy FE thật; chưa có bằng chứng native/Google account mới trên máy đó. Không nhập bundle vào cấu hình nguồn đang chạy, không seed/reset/xóa cloud, không sửa IAM, không tạo credential mới, không gửi Zalo bằng tool và không commit/push/deploy. File gửi đã sẵn ở máy nguồn; người dùng tự chuyển cho thành viên nhóm.
