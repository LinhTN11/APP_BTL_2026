# Tài khoản demo local

Chỉ dùng trong lane **Firestore emulator được chọn rõ** với `DEMO_MODE=true`. Cloud từ chối demo/seed. Fixture cloud lịch sử đã được dọn theo D20; bảng dưới là contract kiểm thử emulator, không phải tài khoản đăng nhập app thật. PNG hình học được mã nguồn tạo, không dùng ảnh người thật.

| Account | ID | Đặc điểm |
|---|---|---|
| A | `00000000-0000-4000-8000-000000000001` | Nữ, sinh 15/05/2000, đủ hồ sơ và ảnh |
| B | `00000000-0000-4000-8000-000000000002` | Nam, sinh 15/05/2000, đủ hồ sơ và ảnh |
| C | `00000000-0000-4000-8000-000000000003` | Nữ; người thứ ba kiểm quyền chat A–B |
| D | `00000000-0000-4000-8000-000000000004` | Nam; cặp C–D độc lập để kiểm unmatch |

Mặc định đề xuất mọi giới tính 18–100 tuổi, chưa có GPS. A/B chưa match sẵn: A like B rồi B like A tạo đúng một match. C không được đọc/gửi/subscribe chat A–B. Ảnh hồ sơ discovery có auth được phép xem; ảnh selfie riêng tư không có route đọc công khai.

`POST /v1/demo/sessions` body `{ "account": "A" }` trả `{data:{token,expiresAt,user}}`. Không có mật khẩu/token hardcode. Token ngẫu nhiên, server chỉ lưu hash. Đăng xuất thu hồi token đó. UI đổi tài khoản phải xóa draft/history/socket cũ.

OTP demo dùng số E.164 như `+84901234567`; API trả `mode:'demo'` và `demoCode`. Không gửi SMS hay xác nhận số thuộc về người đăng nhập. OTP tạo hồ sơ mới chưa hoàn tất; cần ngày sinh 18+, bio và ảnh trước swipe. Selfie chỉ pending/demo, không cấp tick thật.

Chạy lại API giữ thay đổi, matches/messages; seed idempotent. Block/unmatch xong không tự tái match. Muốn lặp kịch bản từ đầu, chỉ dùng reset demo được root runbook mô tả khi chủ động yêu cầu; không xóa DB thật.
