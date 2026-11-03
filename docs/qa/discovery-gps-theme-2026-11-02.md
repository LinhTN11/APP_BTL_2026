# Khám phá, GPS và giao diện — 02/11/2026

Scope USER: xem xét và chia subagent sửa khám phá trống, GPS, thêm lựa chọn giao diện tại Tôi. T03.01/F06, T04.02/F10, T05.01/T11.01 (shared UI). Owner: worker BE kiểm discovery và regression; worker FE-native sửa GPS; integrator giữ App, screens, theme, docs và tích hợp. Không thay contract hay policy khám phá.

## Nguyên nhân và thay đổi

- Đọc cloud chỉ lấy chẩn đoán cần thiết: hai tài khoản active/public/đủ tuổi, cả hai thiếu bio, một tài khoản thiếu ảnh. Policy đang có yêu cầu tên/bio không trống, đủ 18 tuổi và media. Không phải GPS chặn discovery. Không điền hồ sơ hay upload ảnh thay người dùng.
- Tôi hiện nhắc từng mục thiếu; Khám phá empty giải thích điều kiện và có nút đến hồ sơ. Sau khi lưu giới thiệu/ảnh trên từng tài khoản, tải lại Khám phá; bộ lọc, swipe, block và trạng thái account vẫn áp dụng.
- Điện thoại USB có quyền fine/coarse nhưng Vị trí hệ thống đang tắt (`location_mode=0`). Code cũ luôn chọn network, không thử GPS khi network không có fix. Nay ưu tiên GPS khi fine được cấp, fallback network một lần khi timeout; quyền approximate vẫn chỉ dùng network. Xin quyền khi thao tác, lấy một điểm, không chạy nền. Lỗi hướng dẫn bật Vị trí/cấp quyền; nút Tôi → Mở cài đặt vị trí. Không bật cài đặt hệ thống tự động.
- Tôi → Giao diện: Theo thiết bị / Sáng / Tối, mặc định Theo thiết bị. Lưu local bằng service Keychain riêng `vn.gap.appearance`, không đụng session; áp dụng palette và status bar toàn app. Chế độ theo thiết bị theo dõi đổi scheme; ghi thất bại giữ chế độ trước và báo retry. Không thêm dependency.
- Review độc lập phát hiện/sửa hai lỗi: khóa lựa chọn khi đang ghi Keychain để không bỏ qua tap tiếp theo trong im lặng; callback hết hạn phiên ổn định theo token để đổi theme không tạo lại API hoặc tải lại/mất hồ sơ chưa lưu. Regression đã fail trước sửa và pass sau sửa với MyProfile thật, xác nhận bản nháp và dirty-navigation guard được giữ.

## Verification

- API typecheck pass; Firestore Emulator explicit `demo-app-cuoi-ky`: 24/24 pass, không skip. Regression chứng minh hồ sơ chỉ hiện sau khi lưu bio/ảnh, vị trí optional; vẫn loại underage/block hai chiều và không rò tọa độ/ngày sinh.
- Workspace typecheck pass; lint 0 error, 2 warning inline-style đã có ở App/ui.
- Mobile suite: 83/83 tests, 13/13 suites pass; có tests theme theo thiết bị, lưu/restore, lỗi ghi; GPS fine/coarse/denied/blocked/timeout/settings/iOS configuration; screens hướng dẫn hoàn thiện và điều hướng.
- `npm run android`: BUILD SUCCESSFUL, installDebug và launch trên một Android USB arm64. Metro Android bundle trả HTTP 200; logcat ReactNativeJS:E/AndroidRuntime:E tại checkpoint không có lỗi.
- UI hierarchy Android thật ghi nhận bộ chọn giao diện và nhắc bio/ảnh thiếu đã render; checkpoint sau ghi nhận `location_mode=3` (Vị trí được bật bên ngoài tác vụ), nhưng chưa chứng minh nhận được GPS fix. Agent không đổi công tắc hệ thống.

## Còn cần kiểm chứng

Chưa chứng minh GPS fix thật sau khi Vị trí được bật; công tắc tắt tại lúc chẩn đoán đầu tiên, bật ở checkpoint cuối. Chưa kiểm iOS native, visual/TalkBack/200% font toàn bộ hoặc hai thiết bị. Build/install không tự chứng minh mọi UI flow. Visual tổng thể vẫn là bản nháp, chưa được người dùng duyệt. Không ghi/xóa/seed cloud, push hoặc deploy trong lượt này.
