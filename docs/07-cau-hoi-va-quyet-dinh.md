# Câu hỏi cần bổ sung và sổ quyết định

Ngày: 01/11/2026 (Asia/Saigon). Các dòng `Dxx` ghi quyết định có căn cứ; mặc định trong câu hỏi chưa giải đáp vẫn là **đề xuất để tiếp tục chuẩn bị**. Không cần chờ mọi câu hỏi để viết docs hoặc prototype; phải chốt các blocker trước khi code phần phụ thuộc hoặc bật dịch vụ thật.

## 1. Quyết định đã có căn cứ

| ID | Quyết định | Nguồn | Tác động |
|---|---|---|---|
| D01 | Mobile bắt buộc React Native | USER | Không đổi sang Flutter/web app để thay app chính |
| D02 | Ưu tiên nhanh, dễ đọc, nhóm clone chạy được | USER | Hạn chế hạ tầng, có seed và hướng dẫn đồng nhất |
| D03 | Người dùng hiện được giao BE; có thể dựng một số UI để test nút | USER | Tách checklist BE, UI thử và UI FE hoàn thiện |
| D04 | UI chủ đạo Apple Liquid Glass, cần đầy đủ màn và prototype trước khi chốt | USER | Thiết kế đủ inventory; prototype là đầu vào duyệt UI |
| D05 | Docs đặt trong `docs/`; AI kiểm docs trước khi làm; có kế hoạch subagent tối ưu chi phí | USER | `AGENTS.md` và workflow phải dẫn tới docs |
| D06 | Tài liệu nguồn có ba phần và 37 dòng chức năng | ORIGINAL | Không âm thầm bỏ phần nâng cao/mở rộng; chia phase |
| D07 | Android là nền tảng chính | USER bổ sung | Ưu tiên Android, không chặn demo vì thiếu iPhone/Mac; glass cần fallback phù hợp Android |
| D08 | Nhóm có 1 BE là người dùng và 1 FE; BE cần xong hôm nay 01/11/2026; FE có một ngày làm riêng | USER bổ sung | Kế hoạch ngày BE ưu tiên core end-to-end và handoff; full backlog 37 chức năng tách các phase sau, không hứa đủ mọi live integration trong một ngày |
| D09 | Dịch vụ miễn phí làm thật, dịch vụ trả phí mô phỏng | USER bổ sung | DB/chat/rule/quiz và năng lực thiết bị làm thật trong phase tương ứng; từng provider phải kiểm quota/điều kiện/cấu hình, phần trả phí có adapter demo và nhãn |
| D10 | Bắt buộc React Native Community CLI, không Expo; thay thế phương án Expo trước đây | USER, 01/11/2026 | Native Android/iOS projects, Android SDK/JDK/Gradle/ADB và Metro; khóa stable RN/CLI/React qua package-lock, không dùng Expo Router/module expo-* |
| D11 | Sau kiểm tra cho phép triển khai core P01–P05 bằng subagent theo ownership | USER, 01/11/2026 | Cho phép core + UI-test BE; DB SQLite khi đó đã được D12 thay bằng Firestore; không phải duyệt visual FE-product hay cam kết xong 37F/60 màn/12 phase hôm nay |
| D12 | Cloud Firestore là DB chính; người dùng chưa có Firebase project | USER, 01/11/2026 | Thay SQL local bằng Admin SDK async + transaction/document/index; giữ RN Community CLI/no Expo. SQL core/extensions là reference, không cloud. BE tạo project riêng một lần và credential được cấp quyền; FE chỉ cần API URL. Chưa có project/credentials nên cloud read/write pending; emulator test ghi riêng. Xem [12](12-ket-noi-firestore.md) |

## 2. Câu hỏi theo thời điểm phải chốt

| ID | Cần người dùng bổ sung/chọn | Mặc định đề xuất để chuẩn bị | Cần chốt trước | Liên quan |
|---|---|---|---|---|
| Q01 | **Đã giải đáp về deadline và nhân sự:** 1 BE xong ngày 01/11/2026, 1 FE làm một ngày riêng. Còn thiếu số giờ thực tế có thể làm hôm nay | Không quy đổi một ngày thành cam kết 37 tích hợp; dùng kế hoạch core và điểm cắt giờ | Lập lịch giờ nếu cần | D08 |
| Q02 | Giảng viên yêu cầu đủ 3 phần hay chấm chủ yếu Phần 1? Phải có tích hợp thật nào? | Core end-to-end trước, mọi chức năng còn lại giữ roadmap; adapter demo có nhãn | Cam kết scope và tiêu chí nộp | F01–F37 |
| Q03 | **Đã giải đáp: Android chính.** Chỉ cần bổ sung mẫu máy/Android version nếu có để kiểm hiệu ứng và quyền thiết bị | Android thật hoặc emulator là tiêu chí demo; kiểm native iOS riêng sau nếu có nhu cầu | QA thiết bị | D07 |
| Q04 | **Đã chọn Firestore, chưa có project (D12).** Còn thiếu project ID + ADC/credential local được cấp quyền | Firestore là DB chính; không tái sử dụng WebGI/project khác; emulator chỉ là lane test, thiếu cloud config fail có hướng dẫn | Cloud read/write thật; việc port/test emulator tiếp tục | D02, D12 |
| Q05 | Chỉ 18+ và dùng dữ liệu mẫu được không? Có yêu cầu bảo mật/điều khoản riêng của trường không? | 18+, fixture có quyền dùng, không dữ liệu nhạy cảm thật trong demo | Auth/onboarding | F01, F06 |
| Q06 | Đã có Google OAuth client ID, redirect URI, package name và cấu hình social provider nào chưa? | Theo D09: provider miễn phí làm thật khi đủ config; SMS/dịch vụ trả phí mô phỏng; chưa có config hiển thị rõ chưa cấu hình | Tích hợp live auth | F01, D09 |
| Q07 | “Chính chủ” là xác nhận đang kiểm soát số điện thoại hay phải đối soát danh tính thuê bao? | OTP chỉ tạo `phone_verified`; không dùng nhãn danh tính pháp lý | F11 live/nhãn badge | F11 |
| Q08 | Selfie cần AI thật/liveness hay luồng nộp ảnh và duyệt thủ công đủ demo? Ai duyệt, giữ ảnh bao lâu? | Manual/demo có nhãn riêng; badge không giả xác minh khuôn mặt thật | Selfie implementation | F02 |
| Q09 | “Chia sẻ vị trí của đối phương” thực tế có nghĩa hai người tự gửi vị trí của mình? Cần live location không? | Người dùng tự chia sẻ vị trí bản thân; chỉ một điểm, không theo dõi nền | Location chat | F10 |
| Q10 | Ảnh/video giới hạn MB, video dài bao lâu; cần ảnh chat thật ở đợt nào? | Profile 9 tệp; ảnh ≤10MB; video ≤30MB/30s; ảnh chat ở moderation phase | Upload/schema media | F03, F21 |
| Q11 | Unmatch có xóa lịch sử không, có được Match lại? Giữ dữ liệu báo cáo bao lâu? | Đóng quyền ngay, ẩn chat; không tự phục hồi khi unblock; retention cần chính sách cụ thể | Match/chat state machine | F08, F22, F24 |
| Q12 | Cấm vĩnh viễn có bắt buộc tự động từ AI hay chấp nhận duyệt/khiếu nại? Ai có quyền xử lý? | Quarantine + cảnh báo + người duyệt; không tự ban vĩnh viễn từ một score | Moderation | F19, F21 |
| Q13 | Danh bạ cần tích hợp thật không? Có được gửi số điện thoại/định danh nào lên server? | User block trước; contact block tách riêng với consent và tối thiểu dữ liệu | Contact blocking | F22 |
| Q14 | Bộ câu hỏi tính cách, thuật toán chấm và quyền sử dụng nội dung do ai cung cấp? | 24 câu tự soạn để tham khảo, phiên bản rõ; không gọi là chẩn đoán/MBTI chính thức | Personality quiz | F14 |
| Q15 | Có Spotify/Apple Music developer access không; lấy top track hay danh sách người dùng chọn? | Fixture và nhập tay; adapter live chỉ scope tối thiểu | Music import live | F15 |
| Q16 | “Ẩn danh” là ẩn với đối phương hay không lưu danh tính ở hệ thống? Khi nào được đánh giá một buổi hẹn? | Riêng tư với đối phương; BE giữ liên kết chống abuse; sau buổi hẹn đã kết thúc | Reputation/recommendation | F23, F24 |
| Q17 | Dữ liệu địa điểm/voucher từ đâu? Có đối tác thật hoặc API bản đồ nào được phép dùng không? | Seed địa điểm và voucher demo có nhãn; không cam kết an toàn/ưu đãi thật | Venues/maps | F25, F26 |
| Q18 | Nếu có kênh SOS miễn phí thực sự: gửi cho ai, ai vận hành nhận tin, có quy trình nào? | Kênh trả phí mô phỏng theo D09; GPS thiết bị làm thật. Không có nơi tiếp nhận thì chỉ preview/share có nhãn, không gọi là cứu hộ thực | SOS live | F28 |
| Q19 | Chia sẻ kế hoạch dùng share sheet hay link xem được không cần tài khoản? Có expiry/thu hồi không? | Share sheet có preview; nếu có link thì token ngẫu nhiên, expiry và revoke | Date plan share | F27 |
| Q20 | Có provider AI miễn phí hợp lệ, quota và chính sách dữ liệu nào được chấp nhận; chat nào được gửi ra ngoài? | LLM trả phí mô phỏng theo D09; rule/template ghi rõ không phải AI thật. Free tier chỉ live khi kiểm điều kiện và đủ config | AI live | F29–F33 |
| Q21 | “Danh sách lựa chọn” Gold là curated picks hay xem người đã thích mình? Gold có kế thừa Plus không? | Curated picks; Gold kế thừa Plus; không tự thêm tính năng “Who liked you” chưa có trong nguồn | Entitlement matrix | F35, F36 |
| Q22 | Quota Free/Super Like, thời lượng Boost/Super Boost, số bước Rewind, quy tắc Incognito? | Lưu cấu hình demo có phiên bản; phải chọn số cụ thể trước khi triển khai | Paid features | F34–F36 |
| Q23 | **Đã chốt chính sách: phần trả phí mô phỏng.** Còn cần chốt bảng quyền/quota để mô phỏng nhất quán | Demo entitlement, không thu tiền; không tạo ads thật chỉ để demo quyền no-ads | Entitlement matrix | F34–F36, D09 |
| Q24 | Calendar cần export một chiều hay đồng bộ hai chiều? Ai sở hữu event và xử lý chỉnh sửa xung đột? | Lịch nội bộ + export một chiều có permission; chưa hứa sync hai chiều | Calendar integration | F37 |
| Q25 | Tên app, logo, màu nhấn, ngôn ngữ, tham chiếu UI cụ thể? | Tên working title, tiếng Việt, nền trung tính/ảnh nội dung, Liquid Glass dùng ở lớp điều khiển | Chốt prototype hi-fi | D04 |
| Q26 | Khi có đề nghị xóa tài khoản, xóa chat/selfie/location thế nào và dữ liệu báo cáo giữ ra sao? | Demo có reset cục bộ; live retention phải được chốt riêng, không đặt chính sách pháp lý thay người dùng | Dữ liệu người thật/live | Toàn bộ |

## 3. Ba câu trả lời có giá trị nhất để bắt đầu

1. Yêu cầu chấm điểm cụ thể: Phần 1 hay đủ cả 3 phần; chức năng nào bắt buộc xuất hiện trong demo hôm nay.
2. Google OAuth client ID và cấu hình provider miễn phí đã có sẵn chưa; mẫu Android dùng demo nếu biết.
3. Xác nhận cách hiểu vị trí F10, tiêu chí selfie F02 và chính sách xử lý ảnh F21 trước khi làm các phần đó.

Không cần người dùng trả lời cả 26 câu trong một lần. Các câu sau được hỏi đúng phase; phần không phụ thuộc vẫn tiếp tục.

## 4. Mẫu ghi quyết định khi nhận câu trả lời

Mỗi quyết định mới ghi: `ID`, ngày, người quyết định, câu hỏi gốc, lựa chọn, lý do, tài liệu/API/schema/test bị ảnh hưởng và trạng thái áp dụng. Giữ lại lịch sử quyết định bị thay thế bằng liên kết tới quyết định mới; không sửa im lặng thành “đã chốt”.

Ví dụ cú pháp (chỉ hướng dẫn, không phải một quyết định đã được duyệt):

```text
ID: D07
Ngày: ngày nhận câu trả lời
Người quyết định: chủ dự án
Thay đổi: Q09 → vị trí một lần do chính người gửi chủ động chia sẻ
Ảnh hưởng: F10, API message/location, permission UI, privacy test
Trạng thái: chờ triển khai / đã triển khai và kiểm tra
```

## 5. Rủi ro phải hiển thị trong báo cáo tiến độ

- **Phạm vi lớn:** 37 dòng gồm nhiều tích hợp ngoài; deadline BE đã chốt hôm nay 01/11/2026 nên ưu tiên core thực và bàn giao, không hứa hoàn thành mọi live provider trong một ngày.
- **Demo dễ bị hiểu nhầm là live:** phải có nhãn và tách trạng thái kiểm tra provider, đặc biệt OTP, selfie, AI, SOS và entitlement.
- **Apple Liquid Glass phụ thuộc nền tảng:** prototype web không chứng minh hiệu ứng native, cảm ứng, keyboard, VoiceOver hoặc hiệu năng thiết bị.
- **Clone chạy ngay vẫn có điều kiện môi trường:** cần Node phiên bản phù hợp, cài dependency, JDK/Android SDK, native build/install, thiết bị/ADB/Metro, mạng LAN/firewall; README và doctor phải nêu rõ, FE không cần secret; BE cần setup project riêng/credential hợp lệ theo D12, không commit key; emulator không là cloud thật.
- **Nội dung nhạy cảm và vị trí:** phân quyền, consent, giới hạn lưu, báo cáo và kiểm duyệt phải cùng đi với tính năng; không để UI thử làm lộ tọa độ/ảnh gốc.
- **Ẩn danh và xác minh:** không dùng các nhãn mạnh hơn bằng chứng kỹ thuật thực sự cung cấp.
