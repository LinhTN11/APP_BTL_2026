# Kính xuyên thấu và chuyển động — bản thử 02/11/2026

T05.01 / F01,F03–F10, owner Integrator + UI + native material + prototype. Theo feedback người dùng: giữ khúc xạ viền đang tốt; đồng bộ card/nút/field/pill; pill di chuyển lò xo và co giãn khi kéo. **Chưa được người dùng duyệt visual; không ghi prompt hoặc thông số này thành rule.**

## Thay đổi hiện hành

- Một đường vật liệu `GlassSurface → FrostedMaterial`, không còn nhánh nested đổi thành View phẳng. Panel, button, input, checkbox/radio, chat bubble và tab indicator đều dùng chung engine.
- Android33+: engine original trong `apps/mobile/android/app/src/main/java/com/gapmobile/glass/`. Lấy backdrop chung, bỏ toàn bộ kính khỏi capture để không feedback, shader uốn phần trong và viền, chữ/children vẽ nét ở trên. Không sửa node_modules.
- Rim16dp và độ lệch cong40dp tách khỏi interior warp: interior bằng0 trong dải rim, không triệt tiêu curl. Đã sửa hồi quy rim yếu do vector phần trong đối nghịch vector mép. Không dùng outline stroke để giả khúc xạ.
- Android24–32/iOS giữ thư viện blur/glass fallback; chưa build iOS hoặc nghiệm thu máy Android cũ. Increase Contrast/Reduce Transparency dùng mặt đặc.
- `GlassTabs` giữ một pill lens không viền; tap dùng spring, kéo có velocity projection, rubber-band và squash/stretch; release chọn tab gần đích, cancel quay về selection kiểm soát bởi parent. Reduce Motion bỏ spring/co giãn.
- Nền biển là ảnh original local pan/zoom chậm; có dừng/chạy, Reduce Motion và AppState. Không gọi là video sóng hoặc mô phỏng quang học vật lý.
- Dọn SurfaceDepth bypass, palette matte, nav style/selected plate cũ, glint/border giả riêng lẻ. Engine/primitive chung sở hữu vật liệu, không thêm bộ UI song song.

## Kiểm chứng

- Root mobile typecheck/lint đạt; Jest7 suites,35/35 tests pass. Bao gồm auth regressions, motion pause/reducedMotion/AppState cleanup, flick target bounds, rubber-band/shape bounds, native selection/fallback, nested/common-control material và accessibility preference OR.
- Android debug build/install customengine đạt; rim fix build lại đạt9s trên Pixel9 Android16. Log hiện tại không lỗi GapGlass/RN/AndroidRuntime. Root xem trực tiếp nút/ô/thanh/pill: nền xuyên qua, mép biến dạng và dispersion; tap đổi tab và swipe điều hướng được thử trên emulator.
- Web Edge:12 màn ×4 chế độ tại413px không overflow, auth→match/chat/escaped text đạt. Card37.158/input7.410/button9.483 pixels khác khi tắt displacement với nền đóng băng; riêng pill3.470 pixels khác. So map rim cũ/mới:25.639 pixels rim sai khác0;59.748 pixels trong thay đổi.
- Web spring tap overshoot274px với target262px, scale1.25/0.842 rồi settle; drag/cancel/keyboard/reduced-motion và indicator DOM persistence được kiểm. Console0 lỗi/cảnh báo. [Prototype](../prototype/index.html), [chi tiết web](../prototype/README.md).

## Giới hạn

Capture native chia sẻ mỗi80ms ở1/3 resolution; hiệu ứng là approximation, chưa đo frame time trên máy yếu. Scale jelly dùng layer transform, chưa inverse perspective/rotation. Chưa nghiệm thu TalkBack, font200%, mọi frame contrast hoặc hai native clients trong lượt visual này. Ảnh fixture cũ không phải chất lượng media sản phẩm.

Không thay API/DB, không seed/reset/ghi cloud, không push/deploy. Các ảnh/video điều tra trung gian giữ ignored `.local/` và `output/playwright/`; chỉ giữ evidence cuối liên quan trong docs/qa.

Nguồn: [Android AGSL](https://developer.android.com/develop/ui/views/graphics/agsl), [MDN backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter), [SVG displacement](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDisplacementMap). Thông số trên là lựa chọn bản thử của dự án, không phải thông số chính thức Apple.


Ảnh native cuối đã xem: [nút và pill kính](native-glass-controls-2026-11-02.png), [sau kéo sang An toàn](native-glass-drag-2026-11-02.png). Video thao tác trung gian lưu local `.local/glass5-drag.mp4`; không đưa video QA vào gói clone mặc định.


Chỉnh hình học theo feedback tiếp theo: bottom rail/pill cùng tâm cung tròn, gap5dp và bán kính pill bằng bán kính rail trừ5dp; bỏ inset ngang9dp lệch so với inset dọc5dp. Topbar gap8dp đều; BE là hình tròn48dp ở font mặc định, radius24dp, outer radius32dp; tăng kích thước theo font scale. Giữ nguyên shader viền và spring. Typecheck/lint và35/35 mobile tests đạt sau chỉnh.
