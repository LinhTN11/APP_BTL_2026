# Prototype v0.1 — chưa duyệt

Mở `index.html` trực tiếp bằng Edge/Chrome. Không cài dependency, không dùng API key, không gọi backend. Hoặc tại thư mục gốc repo chạy `python -m http.server 8768 --bind 127.0.0.1`, mở `http://127.0.0.1:8768/docs/prototype/index.html`. Chỉ dùng local; Ctrl+C để dừng.

- `flow.drawio`: mở bằng draw.io/diagrams.net để sửa wireframe và kết nối.
- `flow.svg`: preview flow tĩnh, 8 màn cốt lõi, không thay danh mục 60 màn trong `../02-yeu-cau-ui-ux.md`.
- `index.html`: bản tương tác 8 màn, gần đúng Liquid Glass bằng CSS. Không phải app React Native hay chứng cứ native Apple material trên Android.
- `preview-discover.png`: ảnh desktop sáng đã kiểm tra bố cục.
- `preview-chat-dark.png`: ảnh desktop tối/giảm trong suốt đã kiểm tra.
- `preview-mobile.png`: ảnh ở viewport 412px, đã sửa overflow ngang.

## Kiểm tra đã thực hiện — 01/11/2026

Dùng Playwright CLI với Microsoft Edge có sẵn. Đã mở đủ 8 màn bằng thanh chọn; màn không rỗng. Đã click Bắt đầu → Khám phá → Thích → Match → Gửi lời chào → Chat. Đã gửi chuỗi `Chào Linh <3`, nội dung hiển thị nguyên văn, không thành HTML. Đã đổi light/dark và giảm trong suốt, `aria-pressed` cập nhật đúng; đã bật emulation reduced-motion. Viewport 412px có document width 412px, không overflow ngang. Sau reload bản cuối và duyệt lại 8 màn: console 0 error, 0 warning. XML `flow.drawio` và `flow.svg` parse hợp lệ.

Đã xem ảnh sáng và mobile. Chưa test screen reader thật, touch device Android, font scaling RN, contrast mọi nền, hiệu năng native, provider thật hay BE. Prototype dùng nhãn rõ khi chỉ mở toast mô tả luồng nằm ngoài 8 màn, không giả đã triển khai tính năng đó. Chưa có xác nhận duyệt UI từ chủ dự án.
