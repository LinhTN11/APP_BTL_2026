# QA logo motion — 02/11/2026

T00.02/T11.01 · F01/core UI · PROPOSAL chưa duyệt visual.

- Authoring thực: EffectCraft CLI đã tạo/lưu `docs/design/gap-wordmark.ecproj`, xuất Lottie với `textAsShapes:true`, không warning. Script/lệnh tái tạo: [README](../../scripts/brand-motion/README.md).
- Artifact: 300×120, 60fps, 132 frame (2,2s), 2 layer vector, không layer chữ. Wordmark đúng Baloo 2 ExtraBold/cam #C34D40; chữ thu hết ở frame 66, nét logo bắt đầu frame 67.
- Edge/Lottie SVG: kiểm frame 20/90/131, 0 live text node, 0 fragment CSS cũ; vùng logo không chạm tiêu đề. Reduced Motion dừng ở frame cuối. Ảnh đã nhìn: [chữ](brand-lottie-word-390.png), [chuyển tiếp](brand-lottie-transition-390.png), [logo](brand-lottie-logo-390.png).
- 88 tổ hợp preview: 11 màn × 320/390 × light/dark × 100/200% chữ; không overflow ngang/ảnh hỏng/eyebrow DOM. Đây là kiểm layout, không đo FPS thực tế.
- Mobile: 10 suite, 57 test pass; typecheck pass; ESLint 0 lỗi, 2 warning inline-style sẵn có. Test mới kiểm reduced-motion và lớp poster không chồng Lottie.
- Android `:app:assembleDebug` với dependency Lottie: BUILD SUCCESSFUL, 2m21s, 188 tasks (53 executed). Chưa cài lại/đo frame pacing trên thiết bị, chưa build iOS; không gọi đây là bằng chứng native visual.
- Web runtime vendored Lottie light 5.13.0 + license; native lottie-react-native 7.5.0 autolink. Không đổi API/auth/cloud/provider hoặc phát sinh phí.
