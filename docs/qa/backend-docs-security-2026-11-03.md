# QA — yêu cầu full BE, tài liệu và secret guard

Ngày 03/11/2026 (Asia/Saigon). Phạm vi USER/D23: chốt yêu cầu/backlog, chuẩn hóa docs, hướng dẫn cấu hình FE và lớp chặn secret; không triển khai phần BE nâng cao.

## Thay đổi

- T00.01/T00.03/T11.02: ma trận đủ F01–F37 giữ ORIGINAL/USER/PROPOSAL, tách code BE khỏi provider/QA/UI chưa đạt; backlog theo dependency, ownership, acceptance và quyết định mở.
- Root/docs README và handoff ngắn theo vai trò; AGENTS chuyển đường đọc BE sang bộ gọn; tài liệu 01/03/04/05/08/11/12 phân biệt kế hoạch cũ với runtime D17/D20 hiện hành. Không sửa nguồn gốc hoặc evidence lịch sử.
- T01.01/T11.02: `.gitignore` mở rộng env/private keys; Node scanner + Git pre-commit/pre-push + installer qua npm prepare + GitHub Actions; không thêm dependency. Public Firebase client config không bị đánh đồng Admin secret.
- Hai worker `gpt-6-luna`, ownership riêng yêu cầu và guard; integrator review, sửa tích hợp và kiểm chứng. Không có số đo chi phí/token hóa đơn; tối ưu bằng model tiết kiệm, context và số worker giới hạn.

## Kiểm chứng lượt này

| Kiểm tra | Kết quả mới |
|---|---|
| `npm run test:security` | **17/17 pass**, 0 fail/skip, exit 0; gồm staged khác working tree, env/template, đổi tên credential, key content, no-leak, range/branch/tag, hook preservation và hook Git thật. |
| `npm run security:check` | Exit 0; không thấy tên file/mẫu credential bị cấm trong working tree tracked. Không quét untracked/ignored credential local. |
| `npm run security:staged` | Exit 0; index hiện có không thấy mẫu bị cấm. Test tự scan guard/tests/docs/hooks/workflow mới trong repo tạm cũng pass. Không stage file vào repo thật. |
| `node scripts/security/secret-guard.mjs range 0000000000000000000000000000000000000000 HEAD` | Exit 0; quét lịch sử tới HEAD local (repo có 4 commit). Không có push. |
| `npm run security:install` + `git config --local --get core.hooksPath` | Exit 0; local hooks bật, kết quả `.githooks`. `npm ci` sau clone cài qua root `prepare`; nếu tắt lifecycle scripts phải cài thủ công. |
| Node syntax checks | `node --check` cho scanner và installer exit 0. |
| Tài liệu | **37 dòng/37 ID duy nhất F01–F37**, **204 link Markdown local** trong 17 tài liệu kiểm tra không hỏng; bảng kiểm link cuối bao gồm security guide. |
| Diff/nguồn | `git diff --check` trên file tracked thay đổi trong lượt này exit 0; `docs/source` không đổi. |

Ca pre-push tích hợp dùng **bare remote local tạm**: commit có credential giả rồi xóa ở commit sau vẫn bị hook chặn; nhánh sạch push được. Không có remote/network thật. Regression cũng phát hiện secret ở file tên trung tính, nội dung đã stage bị thay lại trong working tree và lỗi Git phải fail closed.

Review đã sửa một false positive: RN chuẩn `apps/mobile/ios/.xcode.env` chỉ cấu hình Node binary. Chỉ miễn rule tên file cho đúng path này; vẫn quét content, kiểm thử chèn token phải bị chặn. `.xcode.env` ở path khác và `.xcode.env.local` không được ngoại lệ. `debug.keystore` Android có sẵn là khóa dev công khai, không được dùng cho release.

Đã chạy `npm run test:startup`: exit 0, **12 pass, 1 skip, 0 fail**. Ca skip là cleanup emulator không thuộc phạm vi guard; không gọi cloud và không đóng acceptance cloud từ kết quả này.

## Giới hạn

- Không chạy lại test nghiệp vụ/mobile/cloud/native do không đổi implementation ứng dụng; các báo cáo trước vẫn là evidence theo ngày riêng. Không nhận hoàn tất full BE/FE hoặc provider live.
- Repo chưa cấu hình remote tại lúc kiểm tra. Workflow chưa chạy trên GitHub; ruleset, required checks và hosted push protection chưa bật. Hook local đã cài thành công; không suy ra remote protection đã bật.
- Scanner tập trung filename và mẫu credential phổ biến, không bảo đảm nhận ra mọi format; hooks có thể bypass. CI sau push không thu hồi một secret đã lộ. Owner cần hosted push protection + bắt buộc check khi có remote, không chia secret BE cho FE.
- Không đọc/in key thật, cấp/chép credential, sửa IAM, gửi tin, ghi/reset cloud, commit/push/deploy. Tests dùng repository tạm và credential giả tạo trong test.
