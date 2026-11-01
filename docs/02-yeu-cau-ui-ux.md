# Yêu cầu UI/UX — app hẹn hò React Native

Ngày lập: 01/11/2026. Trạng thái: **ĐỀ XUẤT ĐỂ DUYỆT**, chưa chốt thiết kế. Tài liệu nguồn: [bản gốc](source/yeu-cau-goc.md). Các mã Pxxx bên dưới trỏ về đoạn nguồn; không đánh đồng đề xuất thiết kế với yêu cầu đã xác nhận.

## 1. Mục tiêu và phạm vi bàn giao

Yêu cầu của chủ dự án: React Native; phong cách Apple Liquid Glass xuyên suốt nút, chuyển cảnh, vật liệu, chữ; có prototype xem trước rồi mới chốt. Người dùng hiện phụ trách BE; FE hoàn chỉnh là hạng mục bàn giao cho nhóm FE. Nhánh BE được dựng các màn thao tác tối thiểu để kiểm thử endpoint, không bị buộc hoàn thiện thẩm mỹ toàn app trước khi kiểm tra nghiệp vụ.

**Đã xác nhận bổ sung:** Android là nền tảng chấm demo chính; BE có 1 ngày hôm nay, FE có 1 ngày riêng; ưu tiên tích hợp dịch vụ miễn phí thật, chức năng trả phí mô phỏng. Phong cách Apple Liquid Glass trên Android là yêu cầu của chủ dự án, không tự đổi thành giao diện Material thuần. Android dùng font hệ thống và control tương tác theo nền tảng, nhưng hình thức material/thanh nổi/bo góc tuân hướng Apple đã duyệt.

Đề xuất tên tạm là **Gặp** (không phải tên đã duyệt), giao diện tiếng Việt, độ tuổi 18+, mobile trước. Phải thiết kế đủ màn hình của cả ba phần nguồn; có thể triển khai theo phase. Màn hình mở rộng chưa có BE vẫn có thiết kế đầy đủ và trạng thái “chưa khả dụng”, không có nút thành công giả.

## 2. Nguyên tắc thiết kế Apple

Liquid Glass tạo lớp điều khiển/navigaton nổi phía trên nội dung. Ảnh hồ sơ, tin nhắn và biểu mẫu vẫn là nội dung rõ ràng; không biến mọi khung thành kính. Ưu tiên thanh tab, toolbar, nút nổi và điều khiển tạm thời. Chọn regular cho nội dung chữ; chỉ dùng clear trên nền media phù hợp, có lớp bảo đảm độ tương phản. Đây là cách vận dụng [Apple HIG — Materials](https://developer.apple.com/design/human-interface-guidelines/materials), kiểm tra 01/11/2026.

Dùng thành phần hệ thống khi có thể: native navigation stack, action sheet, date picker, permission dialog, share sheet, bàn phím, alert. Các nút Like/Pass tùy biến cần giữ semantic, trạng thái và kích thước chạm. Chuyển động phục vụ phản hồi và định hướng, ngắn, ngắt được; không chặn thao tác để chờ animation theo [Apple HIG — Motion](https://developer.apple.com/design/human-interface-guidelines/motion).

### Vật liệu theo nền tảng

- iOS native glass là enhancement nghiên cứu riêng bằng native module tương thích React Native Community CLI đã khóa; cần kiểm tra OS/runtime/native build. Không dùng module `expo-*`. Khi chưa có evidence, `GlassSurface` dùng fallback của dự án; không hứa native Liquid Glass.
- **Android là baseline nghiệm thu chính.** Android/iOS cũ: component `GlassSurface` của dự án dùng nền đặc bán mờ/blur đã kiểm tra hiệu năng, viền và độ nổi nhẹ; giữ cấu trúc, kích thước và tương phản. Không hứa khúc xạ giống hệt iOS native.
- Khi Reduce Transparency hoặc Increase Contrast bật: nền đặc, viền rõ, không phụ thuộc nhìn xuyên; trạng thái được biểu đạt bằng nhãn/icon.
- Prototype HTML chỉ gần đúng qua CSS backdrop-filter, không chứng minh native Liquid Glass, hiệu năng RN hay thiết bị thực.

### Chữ và icon

Theo [Apple HIG — Typography](https://developer.apple.com/design/human-interface-guidelines/typography), dùng font hệ thống và text styles. iOS dùng hệ thống SF thông qua nền tảng; **không nhúng/gửi kèm file SF Pro**. Android dùng system font tương ứng để clone chạy được, không tải font ngoài khi khởi động. Prototype dùng `-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`.

Đề xuất token cơ sở (cần duyệt cùng prototype): large title 34/41 regular hoặc bold tùy context; title 28/34; headline 17/22 semibold; body 17/22; subhead 15/20; footnote 13/18. Đơn vị logical pt/dp, không pixel vật lý. RN cho phép font scaling, chiều cao co giãn và wrap; chữ tiếng Việt đủ dấu. SF Symbols trên iOS qua thư viện tương thích; Android dùng bộ vector tương đương có license phù hợp, giữ nhãn accessibility. Không dùng emoji làm icon giao diện cuối cùng.

### Màu, khoảng cách và hình dạng

Đề xuất màu nhấn rose #C83C59; màu hành động hệ thống theo semantic. Nền light #F4F3F6, chữ #201E25; dark #141318, chữ #F7F4FA; panel theo semantic light/dark, không hardcode alpha cho mọi nền. Lưới 4pt, spacing chủ đạo 8/16/24/32; lề ngang 20; safe area theo thiết bị. Corner 12 cho field, 20 cho nhóm nội dung, capsule cho action phù hợp. Đây là token riêng, không khẳng định số Apple bắt buộc.

## 3. Motion và trạng thái điều khiển

| Thành phần | Hành vi đề xuất | Reduced Motion |
|---|---|---|
| Nhấn nút | Phản hồi màu/độ nổi tức thì, scale nhẹ khoảng 0.98 nếu tùy biến; haptic chọn lọc | Không scale, đổi trạng thái |
| Chuyển tab/stack | Ưu tiên animation native theo nền tảng | Tuân hệ thống, fade/ngắt chuyển động lớn |
| Vuốt hồ sơ | Theo ngón tay; trở về khi chưa đạt ngưỡng; commit một lần; nút Like/Pass thay thế | Không xoay/phóng card, vẫn dùng nút |
| Sheet | Native detents, kéo đóng nếu không mất dữ liệu | Giảm chuyển động theo hệ thống |
| Match | Một animation ngắn, có nút bỏ qua/tiếp tục ngay | Màn xác nhận tĩnh |
| Loading | Spinner nhỏ trong nút và khóa request trùng; skeleton chỉ khi có ích | Không shimmer |
| SOS/report/block | Phản hồi rõ, không animation trang trí che kết quả | Giữ nhãn trạng thái đầy đủ |

Đề xuất tùy biến: nhấn 100–160ms, chuyển trạng thái 180–240ms, sheet 250–350ms; ưu tiên thông số native nếu khác. Không coi đây là thông số chính thức Apple. Xác nhận trên máy thực mục tiêu; không dựng parallax liên tục, blur toàn trang hoặc nhiều lớp kính lồng nhau.

## 4. Kiến trúc thông tin và luồng

Bốn tab đề xuất: **Khám phá · Kết nối · Hẹn hò · Tôi**. Explore theo chủ đề nằm trong Khám phá; Match và tin nhắn chung tab Kết nối. Trung tâm an toàn có từ Tôi và menu chat; SOS dễ truy cập từ kế hoạch hẹn. Tính năng gói trả phí nằm ở Tôi và điểm chặn quyền có giải thích.

1. Chào mừng → đăng nhập → OTP/provider → đồng ý/18+ → tạo hồ sơ → chọn vị trí → khám phá. Selfie là flow riêng, không làm mất dữ liệu hồ sơ.
2. Khám phá → bộ lọc → hồ sơ chi tiết → câu hỏi điều kiện (nếu có) → Like → Match khi hai bên cùng thích → chat.
3. Chat → vị trí của **chính người gửi** sau đồng ý → trò chơi/AI → đề xuất địa điểm → tạo kế hoạch → chia sẻ → đánh giá sau hẹn.
4. Chat/hồ sơ → menu → unmatch/block/report → xác nhận → danh sách an toàn. Kết nối đã thu hồi không gửi thêm tin được.
5. Tôi → xác thực/sinh trắc → sở thích/MBTI/music → quyền riêng tư/từ khóa → Plus/Gold/Boost → trạng thái quyền.

## 5. Danh mục màn hình đầy đủ

Mỗi dòng là màn hình hoặc sheet có tuyến điều hướng/xuất phát xác định. Cột BE test nêu UI tối thiểu người phụ trách BE có thể dựng; FE sở hữu chất lượng visual, motion, adaptive layout và accessibility cuối cùng. “Mở rộng” vẫn nằm trong phạm vi thiết kế tổng, không ngầm loại khỏi yêu cầu.

| Mã | Màn hình/sheet | Nội dung, hành động chính | Nguồn | BE test tối thiểu |
|---|---|---|---|---|
| S01 | Chào mừng | Giới thiệu ngắn, bắt đầu, 18+/đồng ý | USER/đề xuất | Chuyển đăng nhập |
| S02 | Chọn đăng nhập | SĐT, Google, Apple, Facebook; trạng thái provider | P003 | Đăng nhập demo có nhãn |
| S03 | Số điện thoại | Mã nước, số, gửi OTP | P003 | Form gửi OTP |
| S04 | OTP | Nhập mã, countdown, gửi lại, đổi số | P003 | Xác minh, sai/hết hạn |
| S05 | Hoàn thiện hồ sơ | Tên hiển thị, ngày sinh, giới tính; không cho dưới 18 theo đề xuất | P007/đề xuất | Submit profile |
| S06 | Media hồ sơ | Grid 0–9 media, thêm/sắp xếp/xóa, ảnh đại diện | P006 | Upload/xóa, lỗi giới hạn |
| S07 | Bio và mục đích | Bio, mục đích quan hệ, tag sở thích | P007 | Update/read back |
| S08 | Lối sống | Cung, thuốc, rượu và trường mở rộng | P008/P021 | Form có giá trị null |
| S09 | Hướng dẫn selfie | Giải thích sử dụng ảnh, đồng ý, camera | P004 | Gửi yêu cầu demo |
| S10 | Chụp/xem lại selfie | Camera, chụp lại, gửi | P004 | File upload |
| S11 | Trạng thái xác minh | Chờ/đạt/từ chối/lỗi; demo không tích xanh thật | P004/P018 | Render trạng thái server |
| S12 | Quyền vị trí | Lý do, cho phép/từ chối, chọn khu vực demo | P010 | Không ép cấp quyền |
| S13 | Khám phá | Card media, bio ngắn, Like/Pass, mở chi tiết | P010/P011 | Hai tài khoản like nhau |
| S14 | Hồ sơ đối phương | Media, sở thích, lifestyle, badges có giải thích | P006–P008 | Xem field công khai |
| S15 | Bộ lọc cơ bản | Giới tính, tuổi, bán kính; áp dụng/xóa | P010 | Query params |
| S16 | Match mới | Hai hồ sơ, chat/tiếp tục khám phá | P011 | Match trả về từ BE |
| S17 | Kết nối/tin nhắn | Matches mới, hội thoại, unread | P011/P014 | List từ API |
| S18 | Hội thoại | Text/GIF/sticker, sending/failed/retry | P014 | Gửi/nhận hai tài khoản |
| S19 | Chọn GIF/sticker | Tab, tìm, preview, gửi | P014 | Fixture local |
| S20 | Chia sẻ vị trí | Preview, độ chính xác, người nhận, hủy/xác nhận | P015 (cần làm rõ) | Gửi tọa độ tự nguyện |
| S21 | Menu hội thoại | Hẹn hò, mute nếu được bổ sung, unmatch/block/report | P012/P032 | Unmatch/block |
| S22 | Hủy ghép đôi | Xác nhận, lý do tùy chọn, riêng tư | P012/P034 | Không gửi lại tin |
| S23 | Tôi/hồ sơ của tôi | Preview, chỉnh sửa, xác minh, setting | P006–P008 | Đọc/profile update |
| S24 | Sinh trắc học | Bật/tắt, yêu cầu hệ thống, fallback đăng nhập | P019 | Capability/failure |
| S25 | Bộ lọc nâng cao | Quan hệ, con, cao, học vấn, tôn giáo, quê | P021 | Query/filter null |
| S26 | Trắc nghiệm tính cách | Giới thiệu, 20–30 câu, tiến độ, bỏ dở | P022 | Submit đáp án |
| S27 | Kết quả tính cách | Mã, mô tả, hiển thị/ẩn, làm lại | P022 | Lưu mã, không chẩn đoán |
| S28 | Kết nối âm nhạc | Spotify/Apple Music, consent, kết nối/ngắt | P023 | Adapter demo có nhãn |
| S29 | Gu âm nhạc | Nghệ sĩ/thể loại, chọn tag, đồng bộ lại | P023 | Fixture tags |
| S30 | Tạo câu hỏi điều kiện | Câu hỏi, đáp án, bật/tắt | P025 | Create/update gate |
| S31 | Trả lời trước Like | Câu hỏi, đáp án, kết quả, thử lại theo rule | P025 | Server chặn sai |
| S32 | Trò chơi phá băng | Chọn Truth or Dare/20 câu, mời/đồng ý/bỏ qua | P026 | Session/turn |
| S33 | Tâm trạng trong ngày | Chọn/nhập nhãn, hạn hiển thị, gỡ | P027 | Expiry từ server |
| S34 | Trung tâm an toàn | Hướng dẫn, cảnh báo, blocklist, SOS | P029–P039 | Đọc policy/status |
| S35 | Cảnh báo nội dung | Ngữ cảnh, hành động chủ động, bỏ qua/report | P029 | Review result |
| S36 | Từ khóa cá nhân | List, thêm/xóa, phạm vi và tác dụng | P030 | CRUD keywords |
| S37 | Ảnh nhạy cảm | Blur, lý do, báo cáo; mở xem theo policy | P031 | Không leak thumbnail |
| S38 | Chặn người/liên hệ | Chọn thủ công/quyền danh bạ riêng, xác nhận | P032 | Block/unblock |
| S39 | Báo cáo người/nội dung | Lý do, bằng chứng, gửi, mã tiếp nhận | P029/P031/P032 | Submit report |
| S40 | Đánh giá sau hẹn | Đúng giờ/giống ảnh/lịch sự, giải thích ẩn danh | P033 | Một review/hẹn |
| S41 | Địa điểm gợi ý | Danh sách/bản đồ, trung gian, lọc | P036 | Seed địa điểm |
| S42 | Chi tiết địa điểm | Địa chỉ, an toàn, giờ, voucher/điều kiện | P036/P037 | Detail/claim fixture |
| S43 | Đánh giá địa điểm | List, thêm review hợp lệ, báo cáo | P037 | CRUD review theo quyền |
| S44 | Tạo/xem kế hoạch hẹn | Người, giờ, nơi, ghi chú, hủy/sửa | P038 | Create/read/update |
| S45 | Chia sẻ kế hoạch | Preview nội dung, OS share sheet, không gửi ngầm | P038 | Generate safe share |
| S46 | SOS | Xác nhận, vị trí/không vị trí, recipient, trạng thái giao | P039 | Simulation có nhãn |
| S47 | AI gợi ý mở lời | Điểm chung, 3 gợi ý, sửa/chèn; không tự gửi | P044 | Adapter demo |
| S48 | AI trợ lý chat | Consent context, gợi ý, dùng/bỏ | P045 | Adapter demo |
| S49 | Luyện tập với AI | Mở session, chat giả lập rõ nhãn, xóa | P046 | Session riêng |
| S50 | Explore chủ đề | Chủ đề, nhạc, tính cách, kết quả | P048 | Seed/filter |
| S51 | Tìm Vibe | Chọn năng lượng/phong cách, kết quả, xóa lọc | P049 | Taxonomy demo |
| S52 | Boost/Super Boost | Quyền hiện tại, thời hạn, kích hoạt, lịch sử | P050 | Ledger demo |
| S53 | So sánh Plus/Gold | Quyền, giá/chu kỳ nếu có, mua/khôi phục demo | P051/P052 | Entitlement demo |
| S54 | Lượt thích/lựa chọn | Đã gửi, Super Like, lựa chọn Gold | P052 | Server kiểm tra quyền |
| S55 | Quyền Plus | Undo, ẩn danh, giới hạn Like, quảng cáo | P051 | Toggle/check quyền |
| S56 | Lịch hẹn trong chat | Đề xuất/nhận/từ chối, xung đột, timezone | P053 | Invitation states |
| S57 | Đồng bộ lịch | Google/Apple, consent, chọn lịch, ngắt | P053 | Adapter demo |
| S58 | Cài đặt và quyền riêng tư | Session, permissions, tài khoản, logout | Đề xuất phục vụ USER | Logout/401 |
| S59 | Trạng thái bị hạn chế | Lý do/phạm vi, khiếu nại nếu được chốt | P031/đề xuất | Render moderation |
| S60 | Công cụ demo BE | Chọn fixture tài khoản, log request đã che bí mật, reset dev có xác nhận | USER | Chỉ development |

## 6. Ma trận trạng thái áp dụng

Không chỉ vẽ happy path. Mỗi màn truy vấn có loading, success, empty, network error/retry, offline, unauthorized/expired; mỗi mutation có idle, submitting, success, validation error, retryable error, forbidden, conflict khi có. Không che form/nhảy layout khi lỗi; giữ input sau lỗi mạng. Gắn lỗi field và cho focus tới field đầu sai.

| Nhóm | Trạng thái riêng bắt buộc |
|---|---|
| Auth | OTP sai/hết hạn/rate limit, hủy OAuth, trùng account cần xử lý rõ, provider chưa cấu hình, biometric không có/lockout |
| Profile/media | 0 ảnh, quá 9 media, MIME/kích thước sai, upload dở, reorder/lưu lỗi, selfie pending/rejected |
| Discovery | Chưa vị trí/từ chối quyền, không kết quả, filter quá hẹp, card stale, Like trùng, gate trả lời sai |
| Chat | Sending/sent/failed, retry không nhân đôi, hội thoại rỗng, unmatch/block từ máy kia, GIF hết nguồn, vị trí từ chối |
| Safety | Report đã gửi, trùng, ảnh bị giữ lại, false positive/kháng nghị đề xuất, không lộ người báo cáo |
| Dates/SOS | Chưa có hẹn, đổi/hủy hẹn, địa điểm đóng, không GPS, người nhận chưa cấu hình, dispatch failed; demo hiển thị “Mô phỏng” |
| AI/music/calendar | Consent chưa cấp/thu hồi, timeout, quota, provider unavailable, dữ liệu demo, token hết hạn, quyền lịch từ chối |
| Monetization | Free/Plus/Gold, hết hạn, purchase pending/cancelled/failed, restore, boost đang chạy; không thu tiền ở demo |

## 7. Accessibility và tiêu chí nghiệm thu UI

Theo [Apple HIG — Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), hỗ trợ chữ lớn, độ tương phản, vùng chạm và giảm chuyển động. Tiêu chí riêng của dự án:

- [ ] Vùng chạm ít nhất 44×44 logical point; Android dùng 48dp ở control thiết kế được; icon có label, role và trạng thái screen reader.
- [ ] Body text đạt contrast 4.5:1, chữ lớn 3:1 theo ngưỡng phù hợp; đo trên nội dung media sáng/tối, không chỉ background mẫu.
- [ ] Font scale 100/150/200% không cắt nút quan trọng; màn cuộn được; không khóa chiều cao text.
- [ ] VoiceOver/TalkBack đi theo thứ tự hợp lý; focus vào heading/sheet/lỗi; không đọc ảnh nhạy cảm đã ẩn bằng mô tả lộ nội dung.
- [ ] Có nút Like/Pass và các lựa chọn thay gesture; không chỉ dùng màu truyền đạt Like/ban/error.
- [ ] Reduce Motion tắt zoom/parallax/shimmer; Reduce Transparency thay material đặc; light/dark đều đọc được.
- [ ] Keyboard không che composer/submit; back/hardware back và swipe back hoạt động đúng; hủy form có cảnh báo nếu mất dữ liệu.
- [ ] Không tự gửi AI text, vị trí, SMS, kế hoạch hẹn hoặc SOS khi mở màn hình. Hành động ngoại vi có preview/xác nhận.
- [ ] Không ghi thành công trước BE; không chuyển màn do timer giả; lỗi hiển thị ngắn gọn tiếng Việt, có hành động khôi phục.

## 8. Quy trình prototype trước chốt

Skill dự án: `.agents/skills/wireframes-mockups/SKILL.md` (bản cài cùng repo để nhóm clone có thể dùng). Stack bắt buộc React Native Community CLI theo D10; bốn skill Expo cũ đã ngừng áp dụng cho implementation. Dùng RN primitives, React Navigation và native modules tương thích bản khóa. Yêu cầu Apple-inspired trên Android giữ nguyên. Dùng để dựng flow/wireframe draw.io trước khi đầu tư hi-fi. Không coi skill là bằng chứng “Apple chuẩn”; nguồn Apple và kiểm thử native là chuẩn đối chiếu.

1. Kiểm tra danh mục S01–S60 với yêu cầu nguồn, hợp nhất/tách màn nếu có lý do; chủ dự án duyệt hành trình và mức ưu tiên.
2. Xem [sơ đồ luồng sửa được](prototype/flow.drawio), [preview SVG](prototype/flow.svg), rồi [prototype tương tác](prototype/index.html). Mở HTML trực tiếp bằng trình duyệt, không cần npm hay mạng.
3. Bản hiện tại là draft của 8 màn cốt lõi: chào mừng, khám phá, bộ lọc, match, chat, hồ sơ, kế hoạch hẹn, an toàn. Điều hướng trực tiếp và nút chính chạy mô phỏng trong bộ nhớ; không gọi BE, không gửi dữ liệu ra ngoài.
4. Duyệt layout, typography, material và tone màu trước. Ghi nhận ngày, người duyệt, phiên bản, screen IDs và thay đổi vào bảng bên dưới; không tự đánh dấu đã duyệt.
5. FE vẽ hi-fi toàn bộ S01–S60 và state áp dụng theo phase; BE dựng test UI cho những endpoint đang triển khai. Chỉ UI đã được duyệt mới coi là baseline visual.
6. Sau duyệt, dựng mẫu RN trên **Android trước**; iOS là đối chiếu bổ sung khi có thiết bị. Đo lại accessibility, native glass và frame rate trước nhân rộng; web preview không thay bước này.

| Phiên bản | Phạm vi | Trạng thái | Người/ngày duyệt |
|---|---|---|---|
| v0.1 — 01/11/2026 | Flow tổng + 8 màn review, screen inventory 60 màn | Chờ chủ dự án xem | Chưa có |

## 9. Checklist tách trách nhiệm

**BE + màn test:** xác nhận contract; fixture hai người; nút gọi API thực; rendering state; auth/permission; mutation retry; demo badge; evidence test. **FE chính thức:** responsive layout, design tokens/components, native controls, transitions/haptics, media UX, full screen/state coverage, accessibility và visual QA. **Cùng thực hiện:** quyết định loading/error/empty, optimistic update/rollback, app lifecycle, deep link/provider callbacks và test end-to-end.

Với 1 ngày FE, đề xuất nhóm FE chỉ thực thi S01–S04 (gộp auth), S05–S08 (gộp chỉnh hồ sơ), S13–S18 (khám phá/match/chat), S21–S23 (menu/an toàn cơ bản), S58; khoảng 10 route chính, tái dùng component. Đây là cắt lát giao demo đầu, không phải tuyên bố hoàn tất 60 màn. Các màn ngoài lát này giữ đầy đủ trong kế hoạch tiếp theo. Chốt số route sau khi BE hoàn thành contract và prototype được duyệt.

Các quyết định cần chủ dự án bổ sung: tên/brand, thiết bị Android/OS và máy dev, deadline giờ cụ thể, thứ tự phần 2/3, người duyệt UI, tài khoản/dịch vụ miễn phí nào nhóm đã có. Dịch vụ trả phí mô phỏng; dịch vụ miễn phí ưu tiên thật, không vì thiếu credential mà âm thầm ghi đã tích hợp. Xem file câu hỏi của dự án; thiếu câu trả lời không cản trở việc chuẩn bị docs/prototype, nhưng không biến đề xuất thành đã chốt.

## 10. Nguồn và giới hạn chứng cứ

Tra cứu 01/11/2026: [Apple Materials](https://developer.apple.com/design/human-interface-guidelines/materials), [Typography](https://developer.apple.com/design/human-interface-guidelines/typography), [Motion](https://developer.apple.com/design/human-interface-guidelines/motion), [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility). Apple có bản `.md` cùng đường dẫn để đọc bằng công cụ. Token màu, spacing, timing, tên tab và screen decomposition trong tài liệu này là đề xuất dự án. Chưa có xác minh thiết bị thực hoặc chứng cứ UI đã được duyệt.
