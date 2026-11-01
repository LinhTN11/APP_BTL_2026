# Đặc tả yêu cầu sản phẩm app hẹn hò

Ngày soạn: 01/11/2026. Trạng thái: **bản phân tích để duyệt**, chưa phải bằng chứng đã triển khai.

## 1. Cách đọc và nguồn yêu cầu

- `ORIGINAL`: có trong [tài liệu gốc đã trích xuất](source/yeu-cau-goc.md); `Pxxx` là số đoạn nguồn.
- `USER`: người dùng yêu cầu trực tiếp trong chat: React Native bắt buộc; dễ chạy sau khi clone; code dễ đọc; ưu tiên công việc backend; có UI phục vụ thử nút; thiết kế đủ màn hình theo phong cách Apple Liquid Glass; prototype để duyệt trước; chia BE/FE và subagent; AI phải đọc docs trước.
- `USER` đã bổ sung: **Android là nền tảng chính; 1 BE hoàn thành phần demo hôm nay 01/11/2026 (Asia/Saigon); 1 FE có một ngày làm việc riêng; dịch vụ miễn phí làm thật, dịch vụ trả phí mô phỏng.** “Miễn phí” phải được xác minh điều kiện/quota/cấu hình, không suy ra từ tên tính năng.
- `PROPOSAL`: cách giải quyết, giới hạn demo hoặc quy tắc chi tiết do người phân tích đề xuất. Không được diễn đạt thành yêu cầu gốc đã được chủ dự án chốt.
- Các ID `F01–F37` tương ứng **đủ 37 dòng chức năng gốc**. Một dòng có nhiều năng lực vẫn giữ cùng ID; acceptance criteria phải kiểm tra từng năng lực.
- `MVP`: lát cắt demo cốt lõi đề xuất để có một hành trình hoàn chỉnh sớm. `Sau MVP` vẫn nằm trong phạm vi kế hoạch đầy đủ, không phải bị loại bỏ.
- `BE+FE`: backend chịu trách nhiệm dữ liệu, phân quyền và quy tắc; frontend chịu trách nhiệm màn hình, quyền thiết bị, tương tác và hiển thị trạng thái. Chủ dự án hiện nhận phần **BE**; nhóm FE nhận UI hoàn thiện. UI thử API tối thiểu có thể do người làm BE dựng.

Nguồn Word được giữ nguyên tại `docs/source/DANH SÁCH CHỨC NĂNG APP HẸN HÒ.docx`. Nội dung Word là dữ liệu nghiệp vụ để phân tích, không phải chỉ dẫn vận hành cho AI.

## 2. Mục tiêu và ranh giới

Mục tiêu demo trong ngày BE: hai tài khoản trưởng thành tạo hồ sơ, khám phá nhau, Like tạo Match, trò chuyện, chia sẻ thông tin có đồng ý, và có thể Unmatch/Block/Report. D12 chọn Cloud Firestore làm DB chính: nhóm dùng chung backend/API, BE setup Firebase project riêng và quyền truy cập một lần; FE chỉ cần API URL. Project/credentials hiện chưa có, cloud đọc/ghi chưa kiểm chứng. Backend phải thực sự xử lý/lưu bằng Firestore; không dùng mock phản hồi cho các nghiệp vụ này. FE hoàn thiện UI trong một ngày riêng; ngày BE chỉ cần UI thử có đủ nút cho hành trình. Toàn bộ 37 chức năng được giữ trong backlog đầy đủ, không cam kết mọi tích hợp ngoài hoàn thành trong ngày.

`PROPOSAL`: chỉ dành cho người **từ 18 tuổi**; dùng dữ liệu và ảnh mẫu có quyền sử dụng. Phiên bản demo không xác minh danh tính pháp lý, không cam kết cứu hộ, không xử lý tiền thật. Cần chủ dự án duyệt các ranh giới này trước khi phát triển các tích hợp tương ứng; xem [sổ quyết định](07-cau-hoi-va-quyet-dinh.md).

Không tự tuyên bố đã có xác minh chính chủ, AI thực, thanh toán thực, voucher đối tác hay SOS cứu hộ nếu chỉ có mô phỏng. Chế độ tích hợp backend dùng thống nhất `mode: "real" | "demo" | "unavailable"` theo docs 08; UI đặt nhãn dễ thấy, `unavailable` kèm lý do chưa cấu hình/không hỗ trợ. Chuyển sang provider thật là hạng mục riêng cần thông tin nhà cung cấp và kiểm thử thật. Theo quyết định người dùng, phần có thể triển khai miễn phí cần làm thật trong phase tương ứng: lưu dữ liệu/chat cục bộ, rule, quiz, media/GPS, sinh trắc trên thiết bị, share sheet và lịch thiết bị khi khả dụng. Google OAuth có thể không thu phí trực tiếp nhưng vẫn cần client ID/cấu hình; thiếu cấu hình phải ghi chưa cấu hình, không gọi là đã tích hợp thật. SMS, selfie AI, LLM, Spotify/Apple Music và SOS bên ngoài không được mặc nhiên coi miễn phí; kiểm điều kiện trước khi chọn adapter.

## 3. Vai trò và hành trình chính

| Vai trò | Năng lực đề xuất | Không được phép |
|---|---|---|
| Khách | Xem giới thiệu, đăng ký/đăng nhập, điều khoản | Đọc hồ sơ riêng hoặc chat |
| Thành viên | Quản lý hồ sơ của mình, khám phá, Like/Pass, chat trong Match, báo cáo/chặn | Sửa hồ sơ người khác, xem tọa độ riêng hay hội thoại khác |
| Người bị hạn chế | Xem thông báo và kênh khiếu nại theo trạng thái | Tiếp tục tương tác bị hạn chế |
| Người kiểm duyệt demo (`PROPOSAL`) | Duyệt selfie/báo cáo và ghi lý do, nhật ký xử lý | Đọc hoặc sửa dữ liệu tùy ý ngoài tác vụ được cấp quyền |

Vai trò kiểm duyệt là phần bổ sung cần thiết để minh họa xử lý báo cáo/xác minh; không yêu cầu làm một dashboard quản trị đồ sộ. Có thể bắt đầu bằng màn hình công cụ nội bộ tối thiểu.

Hành trình nghiệm thu đầu tiên:

1. Người A đăng nhập demo → khai báo tuổi hợp lệ → tạo hồ sơ tối thiểu → bật khám phá.
2. A Like B; B chỉ thấy Match sau khi B cũng Like A; hệ thống tạo đúng một Match.
3. A và B mở hội thoại, gửi văn bản/GIF/sticker, tải lại vẫn thấy dữ liệu.
4. A chia sẻ vị trí của **A** trong chat sau khi đồng ý; B không tự lấy vị trí A.
5. A Unmatch hoặc Block B → cả hai không còn gửi tin hay xuất hiện trong khám phá của nhau theo quy tắc đã chọn.
6. API từ chối C đọc hội thoại A–B dù C biết ID.

## 4. Danh mục đầy đủ và phân công

| ID | Nguồn | Chức năng gốc | Đợt đề xuất | Trách nhiệm |
|---|---|---|---|---|
| F01 | ORIGINAL, Phần 1, P003 | Đăng nhập số điện thoại/SMS OTP, Google, Apple, Facebook | MVP: session/local demo; OAuth miễn phí làm thật khi đủ config; SMS trả phí mô phỏng | BE+FE |
| F02 | ORIGINAL, Phần 1, P004 | Selfie so khớp ảnh hồ sơ, tích xanh cơ bản | MVP: luồng gửi/duyệt demo; so khớp live sau | BE+FE |
| F03 | ORIGINAL, Phần 1, P006 | Tối đa 9 ảnh/video ngắn | MVP | BE+FE |
| F04 | ORIGINAL, Phần 1, P007 | Bio, mục đích hẹn hò, thẻ sở thích thủ công | MVP | BE+FE |
| F05 | ORIGINAL, Phần 1, P008 | Cung hoàng đạo, hút thuốc, uống rượu | MVP | BE+FE |
| F06 | ORIGINAL, Phần 1, P010 | Lọc giới tính, bán kính GPS, khoảng tuổi | MVP | BE+FE |
| F07 | ORIGINAL, Phần 1, P011 | Like, Pass, Match hai chiều | MVP | BE+FE |
| F08 | ORIGINAL, Phần 1, P012 | Unmatch | MVP | BE+FE |
| F09 | ORIGINAL, Phần 1, P014 | Chat văn bản, GIF, sticker | MVP | BE+FE |
| F10 | ORIGINAL, Phần 1, P015 | Chia sẻ vị trí “của đối phương” trong chat | MVP sau khi làm rõ quyền chia sẻ | BE+FE |
| F11 | ORIGINAL, Phần 2, P018 | Xác minh số điện thoại chính chủ | Sau MVP; không đánh đồng với OTP | BE+FE |
| F12 | ORIGINAL, Phần 2, P019 | FaceID/vân tay đăng nhập nhanh | Sau MVP; Android sinh trắc miễn phí làm thật khi phần cứng hỗ trợ | FE quyền thiết bị + BE session |
| F13 | ORIGINAL, Phần 2, P021 | Lọc dự định quan hệ, con cái, chiều cao, học vấn, tôn giáo, quê quán | Sau MVP | BE+FE |
| F14 | ORIGINAL, Phần 2, P022 | Trắc nghiệm tính cách 20–30 câu, khoảng 2 phút | Sau MVP | BE+FE |
| F15 | ORIGINAL, Phần 2, P023 | Nhập gu nhạc Spotify/Apple Music | Sau MVP: demo rồi adapter live | BE+FE |
| F16 | ORIGINAL, Phần 2, P025 | Trả lời đúng câu hỏi trước khi Like | Sau MVP | BE+FE |
| F17 | ORIGINAL, Phần 2, P026 | Truth or Dare, 20 câu hỏi trong chat | Sau MVP | BE+FE |
| F18 | ORIGINAL, Phần 2, P027 | Tâm trạng tạm thời trong ngày | Sau MVP | BE+FE |
| F19 | ORIGINAL, Phần 2, P029 | Trung tâm an toàn, cảnh báo AI từ ngữ nhạy cảm | MVP: trung tâm và rule demo; AI sau | BE+FE |
| F20 | ORIGINAL, Phần 2, P030 | Từ khóa cấm cá nhân | Sau MVP | BE+FE |
| F21 | ORIGINAL, Phần 2, P031 | Làm mờ/cảnh báo ảnh nhạy cảm, cấm vĩnh viễn khi vi phạm | Sau MVP; cần duyệt chính sách cấm | BE+FE |
| F22 | ORIGINAL, Phần 2, P032 | Chặn người dùng hoặc liên hệ | MVP: user block; contact block sau | BE+FE |
| F23 | ORIGINAL, Phần 2, P033 | Đánh giá/huy hiệu uy tín ẩn danh sau hẹn | Sau MVP | BE+FE |
| F24 | ORIGINAL, Phần 2, P034 | Lý do Unmatch ẩn danh để AI cải thiện gợi ý | Sau MVP; Unmatch cơ bản ở F08 | BE+FE |
| F25 | ORIGINAL, Phần 2, P036 | Địa điểm trung gian, bản đồ, ưu đãi/voucher | Sau MVP: dữ liệu mẫu; đối tác live riêng | BE+FE |
| F26 | ORIGINAL, Phần 2, P037 | Thư viện đánh giá độ an toàn địa điểm | Sau MVP | BE+FE |
| F27 | ORIGINAL, Phần 2, P038 | Chia sẻ kế hoạch hẹn cho người thân | Sau MVP | BE+FE |
| F28 | ORIGINAL, Phần 2, P039 | SOS gửi tọa độ GPS cứu hộ | Sau MVP: mô phỏng rõ; live cần quy trình | BE+FE |
| F29 | ORIGINAL, Phần 3, P044 | AI gợi ý mở lời từ điểm chung | Mở rộng | BE+FE |
| F30 | ORIGINAL, Phần 3, P045 | AI gợi ý tiếp chuyện | Mở rộng | BE+FE |
| F31 | ORIGINAL, Phần 3, P046 | Luyện tập mở lời với AI | Mở rộng | BE+FE |
| F32 | ORIGINAL, Phần 3, P048 | Explore theo chủ đề/sở thích, nhạc, MBTI bằng AI | Mở rộng | BE+FE |
| F33 | ORIGINAL, Phần 3, P049 | Tìm theo Vibe/phong cách sống | Mở rộng | BE+FE |
| F34 | ORIGINAL, Phần 3, P050 | Boost và Super Boost | Mở rộng: entitlement demo | BE+FE |
| F35 | ORIGINAL, Phần 3, P051 | Plus: Like không giới hạn, Rewind, Incognito, không quảng cáo | Mở rộng: entitlement demo | BE+FE |
| F36 | ORIGINAL, Phần 3, P052 | Gold: lựa chọn, lọc mở rộng, Super Like, xem lượt Like đã gửi | Mở rộng: entitlement demo | BE+FE |
| F37 | ORIGINAL, Phần 3, P053 | Đặt lịch trong chat, đồng bộ Google/Apple Calendar | Mở rộng: lịch nội bộ rồi adapter | BE+FE |

## 5. Acceptance criteria theo chức năng

Các con số chưa có trong nguồn dưới đây là `PROPOSAL`. Chủ dự án có thể đổi trước phase liên quan; phải cập nhật docs, schema và test cùng nhau.

### Nhóm A — Tài khoản và hồ sơ

**F01 — Đăng nhập.** Thành công: chọn nhà cung cấp → nhận/chấp nhận challenge → backend xác thực → tạo hoặc lấy đúng tài khoản → cấp session. OTP chỉ dùng một lần, hết hạn và giới hạn số lần thử; demo hiển thị mã thử và nhãn mô phỏng. Google/Apple/Facebook có đủ entry point và trạng thái chưa cấu hình, hủy và lỗi; không chấp nhận user ID do client tự khai làm bằng chứng live. Không tự gộp hai tài khoản chỉ vì cùng email chưa xác minh. Tài khoản mới đi onboarding, tài khoản cũ về màn chính.

**F02 — Selfie.** Thành công: người dùng đồng ý → chụp/gửi selfie → trạng thái `pending` → xử lý → `approved` hoặc `rejected` kèm lý do. Thay ảnh hồ sơ ảnh hưởng xác minh phải quay về trạng thái cần kiểm tra. Luồng demo/manual ghi rõ “Đã duyệt mô phỏng”, không hiển thị như xác minh khuôn mặt thật. Từ chối quyền camera hoặc lỗi upload cho phép thử lại; ảnh lỗi không làm mất hồ sơ. Cần chốt nhà cung cấp, liveness, thời hạn giữ selfie và điều kiện tích xanh live.

**F03 — Media.** Thành công: chọn ảnh/video → kiểm tra MIME/kích thước/thời lượng phía server → tải lên → sắp thứ tự/chọn ảnh chính → lưu. Server từ chối media thứ 10 kể cả hai upload đồng thời. `PROPOSAL`: ảnh JPEG/PNG/WebP ≤10MB; video MP4 ≤30 giây và ≤30MB; ít nhất một ảnh để bật khám phá. Không tin phần mở rộng file; xóa/thay media không để đường dẫn tệp tùy ý hoặc ảnh của người khác bị truy cập trái phép.

**F04 — Hồ sơ cơ bản.** Lưu/sửa Bio (`PROPOSAL`: ≤500 ký tự), một mục đích quan hệ và tối đa 10 thẻ từ danh mục. Server xác thực giới hạn và trim chuỗi; Unicode tiếng Việt hiển thị đúng. Dữ liệu trống phân biệt với không muốn công khai. Lưu thất bại giữ bản nháp và báo lỗi; không giả lưu thành công.

**F05 — Lối sống.** Người dùng có thể chọn/bỏ chọn cung hoàng đạo, hút thuốc, uống rượu; giá trị chưa khai không tự suy diễn thành “không”. Các giá trị server nằm trong enum có phiên bản. Ngày sinh đầy đủ không công khai; chỉ hiển thị tuổi theo quy tắc đã duyệt.

**F11 — Điện thoại chính chủ.** Phải tách `phone_verified` (đã kiểm soát số qua OTP) khỏi `identity_verified` (đã xác minh danh tính qua nguồn có thẩm quyền). Demo chỉ minh họa trạng thái; không quảng cáo OTP chứng minh thuê bao chính chủ. Thay số buộc xác minh lại và thu hồi trạng thái cũ; có xử lý số đã được tài khoản khác liên kết. Tiêu chí live chưa chốt là blocker cho nhãn “chính chủ”.

**F12 — Sinh trắc học.** Chỉ bật sau một phiên đăng nhập hợp lệ và sự đồng ý; hệ điều hành thực hiện FaceID/vân tay. Không gửi/lưu mẫu sinh trắc lên BE. Mở khóa chỉ giải phóng credential trong secure storage; server vẫn kiểm tra session, expiry/revocation. Không có cảm biến, người dùng hủy, không đăng ký sinh trắc, hoặc session hết hạn đều có đường quay về đăng nhập chính; không tạo “biometric token” giả từ client.

### Nhóm B — Khám phá, cá nhân hóa và Match

**F06 — Bộ lọc cơ bản.** Lọc theo giới tính được khai báo, tuổi và bán kính quanh vị trí được phép sử dụng. Server tính eligibility, không chỉ lọc UI; không trả chính mình, tài khoản ẩn/bị hạn chế, người đã block theo hai chiều. Không có quyền GPS thì dùng khu vực mẫu/chọn khu vực có nhãn rõ, không tự bịa GPS hiện tại. Chỉ trả khoảng cách gần đúng, không trả tọa độ chính xác của hồ sơ trong deck. Khoảng tuổi đảo hoặc bán kính ngoài giới hạn trả lỗi có trường.

**F07 — Like/Pass/Match.** A Like B một lần chỉ tạo một interaction; B Like A tạo đúng một Match bằng Firestore transaction/canonical pair document dù request đồng thời. Match active cho phép hai thành viên chat. Retry dùng request key không tạo tác dụng kép. Pass loại hồ sơ khỏi lượt khám phá hiện tại theo quy tắc vòng đời được chọn; không tự coi Pass là Block vĩnh viễn. Like người đã block/ẩn hoặc không đủ điều kiện bị server từ chối.

**F08 — Unmatch.** Có xác nhận và lựa chọn lý do riêng tư; Unmatch thành công đóng quyền gửi mới ngay với cả hai. Request gửi tin đến cùng lúc phải kiểm tra lại trạng thái Match trong server. `PROPOSAL`: ẩn hội thoại khỏi danh sách chính; dữ liệu phục vụ báo cáo giữ theo retention đã chốt. Retry Unmatch là idempotent; người ngoài Match không hủy được. Cần quyết định có được Match lại hay không trước khi triển khai Rewind.

**F13 — Bộ lọc sâu.** Có trường dự định quan hệ, con cái, chiều cao, học vấn, tôn giáo, quê quán; áp dụng giao các điều kiện đã bật. Trường chưa khai không mặc nhiên khớp; UI cho biết bộ lọc có thể làm hết kết quả. Điều kiện trả phí kiểm tra server dựa entitlement, không chỉ khóa nút. Không tự suy ra tôn giáo/nguồn gốc từ ảnh, tên hoặc AI.

**F14 — Trắc nghiệm tính cách.** `PROPOSAL`: 24 câu, lưu phiên bản câu hỏi và công thức chấm minh bạch, cho tạm dừng/tiếp tục. Chỉ hiện mã sau khi trả lời đủ; người dùng có thể ẩn hoặc làm lại. “Khoảng 2 phút” là mục tiêu UX cần đo thực tế, không bảo đảm. Ghi đây là bài khám phá tính cách tham khảo, không chẩn đoán và không tự tuyên bố là công cụ MBTI chính thức/được cấp phép. Nội dung câu hỏi và quyền sử dụng cần duyệt.

**F15 — Gu âm nhạc.** Người dùng chọn Spotify hoặc Apple Music → đồng ý quyền → adapter lấy dữ liệu hợp lệ → ánh xạ thành thẻ và cho chỉnh/ẩn. Demo dùng danh sách nhạc cố định ghi nhãn; từ chối quyền, token hết hạn, thiếu dữ liệu hoặc nhà cung cấp chưa bật phải có fallback nhập tay. Ngắt kết nối thu hồi credential phía ứng dụng; chỉ lấy scope cần thiết, không đồng bộ âm thầm vô hạn.

**F16 — Câu hỏi trước Like.** Chủ hồ sơ đặt một câu từ danh mục an toàn và đáp án; người Like gửi `gateAnswer` cùng request Like để server đối chiếu câu hỏi/đáp án hiện hành trước khi ghi interaction. Không gửi đáp án đúng trong payload khám phá; không dựa cờ `passed` do client tự truyền. Sai trả phản hồi chung, giới hạn thử; khi chủ hồ sơ đổi câu hỏi, client phải tải lại câu hỏi và trả lời theo cấu hình mới, không tái dùng kết quả `passed` cũ. Tắt câu hỏi không phá flow Like bình thường.

**F18 — Tâm trạng trong ngày.** Chọn nhãn/ngắn gọn → có `expiresAt` theo giờ server → tự hết hạn tối đa 24 giờ (`PROPOSAL`). Hồ sơ không hiển thị nhãn cũ sau expiry dù client không mở lại. Có thể xóa hoặc đổi trước hạn; retry không làm phát sinh nhiều trạng thái active.

**F24 — Lý do Unmatch và gợi ý.** Gửi lý do là tùy chọn, không cản Unmatch; không hiển thị danh tính/chi tiết cho đối phương. Phần tối ưu gợi ý AI là adapter mở rộng, demo có thể tổng hợp rule minh bạch. Lý do nhạy cảm không đưa trực tiếp vào prompt bên thứ ba mặc định. Không gọi dữ liệu là “ẩn danh hoàn toàn” nếu BE vẫn lưu người gửi để chống lạm dụng; cần mô tả là riêng tư với đối phương.

**F32 — Explore.** Danh sách chủ đề có kết quả phân trang; chọn chủ đề áp dụng cùng quyền và bộ lọc nền như discovery. Có chế độ nhạc và tính cách với dữ liệu đã đồng ý; người chưa có dữ liệu thấy lời hướng dẫn. Nội dung đề xuất không dùng thương hiệu Tinder làm tên/nhận diện app. Phần AI phải phân biệt với bộ lọc theo tag đơn giản.

**F33 — Vibe.** `PROPOSAL`: dùng taxonomy chọn tay để demo trước, ví dụ thư giãn/năng động/thích khám phá. Search không suy luận thuộc tính nhạy cảm hoặc tâm trạng sức khỏe từ chat/ảnh. Đầu vào không khớp taxonomy có gợi ý, không bịa điểm số chính xác. Nếu bổ sung AI mapping, lưu phiên bản và giải thích tag được áp dụng.

### Nhóm C — Chat và phá băng

**F09 — Messaging.** Chỉ thành viên Match active đọc/gửi được. Tin văn bản, GIF và sticker là các loại có schema riêng; GIF/sticker demo lấy từ catalog có quyền dùng, không nhận URL tùy ý rồi để server tải vô hạn. `PROPOSAL`: văn bản ≤2.000 ký tự; client-generated message ID để chống trùng khi retry; phân trang lịch sử bằng cursor; thứ tự ổn định theo thời gian server và ID. UI có sending/sent/failed/retry; mất mạng hoặc session hết hạn không mất nội dung đang gõ.

**F10 — Vị trí trong chat.** Câu gốc “vị trí của đối phương” chưa xác định quyền. `PROPOSAL` để duyệt: mỗi người **tự chia sẻ vị trí của mình** bằng hành động chủ động, đối phương chỉ xem thông tin đã được gửi. Không tra GPS của người khác. MVP chỉ chia sẻ một điểm tại thời điểm gửi; không có theo dõi nền/live location. Có timestamp, tùy chọn vị trí gần đúng; từ chối quyền vẫn chat được. Muốn live location phải đặc tả thời lượng, thu hồi và nền riêng.

**F17 — Trò chơi.** Trong Match active, một người mời, người kia chấp nhận; có thể bỏ qua câu hoặc kết thúc mà không bị phạt. `PROPOSAL`: catalog 20 câu an toàn, không yêu cầu dữ liệu riêng tư/nguy hiểm. Hai người nhìn cùng lượt và phiên bản trạng thái; retry không nhảy lượt hai lần. Unmatch/Block kết thúc game và đóng quyền cập nhật.

**F29 — AI mở lời.** Lấy điểm chung từ trường hồ sơ được phép công khai, trả vài bản nháp; người dùng chọn/sửa rồi tự gửi. Không tự gửi tin và không bịa thông tin cá nhân. Timeout/thiếu khóa API có gợi ý template ghi nhãn, không làm hỏng chat. Demo không gọi LLM nhưng vẫn minh họa đầy đủ nút và trạng thái.

**F30 — AI tiếp chuyện.** Chỉ dùng đoạn hội thoại người dùng đã đồng ý gửi cho AI, giới hạn ngữ cảnh và loại dữ liệu nhạy cảm. Trả bản nháp không có tác dụng gửi tin. Không đưa lịch sử hội thoại của Match khác vào prompt. Chặn/quota/timeout có lỗi dễ hiểu và cho người dùng tiếp tục chat thủ công.

**F31 — Luyện tập.** Phòng luyện tập tách biệt chat người thật, ghi rõ đang trò chuyện với AI; lưu/xóa phiên riêng. Không tạo Match hay gửi cho người thật. Demo dùng kịch bản cố định; live có giới hạn lượt/chi phí, timeout và tùy chọn xóa dữ liệu. Nhận diện phòng AI bằng dữ liệu server để tránh chỉ đổi nhãn phía client.

### Nhóm D — An toàn và cộng đồng

**F19 — Trung tâm an toàn/cảnh báo.** Có hướng dẫn chặn/báo cáo/quyền riêng tư và trạng thái xử lý. Rule demo phát hiện từ khóa có nhãn “cảnh báo thử nghiệm”; không tuyên bố hiểu ngữ cảnh như AI. Một từ riêng lẻ không đủ căn cứ kết luận người dùng nguy hiểm. Cảnh báo nên hỗ trợ hành động an toàn, không tự gửi thông tin cá nhân ra ngoài hoặc gọi cứu hộ. Report là năng lực `PROPOSAL` bổ sung để các yêu cầu an toàn có đường xử lý cụ thể.

**F20 — Từ khóa cá nhân.** Thêm/sửa/xóa từ khóa, chuẩn hóa chữ hoa/thường và khoảng trắng; chỉ chủ sở hữu đọc được cấu hình. `PROPOSAL`: làm mờ nội dung đến phía người nhận và cho xem có chủ đích, không âm thầm sửa tin gốc. Cần thống nhất xử lý dấu tiếng Việt và cụm từ; UI giải thích ví dụ để tránh kỳ vọng sai. Danh sách trống không chặn chat.

**F21 — Ảnh nhạy cảm.** Nguồn yêu cầu làm mờ/cảnh báo và “cấm vĩnh viễn nếu vi phạm”; **chưa chốt tiêu chuẩn, bằng chứng và quyền khiếu nại**. `PROPOSAL`: ảnh chờ kiểm tra không được phát URL gốc cho người nhận; kết quả nghi vấn bị quarantine/làm mờ, có cảnh báo và hàng đợi duyệt. Nếu detector lỗi thì không tự phát ảnh chưa kiểm tra. Không dùng một score AI duy nhất để tự ban vĩnh viễn; quyết định có lý do, bằng chứng, người duyệt và cơ chế khiếu nại. Đây là đề xuất điều chỉnh phải xin chủ dự án xác nhận trước phase moderation. Ảnh chat là mở rộng schema F09 để đáp ứng dòng gốc này, dù Phần 1 chỉ liệt kê text/GIF/sticker.

**F22 — Block.** Block người dùng có hiệu lực ở server với discovery, Like, Match, chat và AI context liên quan; trả lỗi chung không tiết lộ chi tiết riêng tư. Unblock không tự khôi phục Match cũ (`PROPOSAL`). Contact blocking là luồng riêng, chỉ đọc danh bạ khi cho phép và chỉ gửi dữ liệu tối thiểu; không coi hash số điện thoại là ẩn danh mạnh. Khi chưa có quyền danh bạ vẫn block theo user được.

**F23 — Đánh giá sau hẹn.** Chỉ tài khoản tham gia cuộc hẹn đã kết thúc được gửi một đánh giá cho mỗi bên/cuộc hẹn. Tiêu chí đúng giờ, giống ảnh, lịch sự có thể bỏ qua; không nhận nội dung xúc phạm. Không công khai người gửi cho đối phương; chống tự đánh giá và gửi lặp. `PROPOSAL`: chỉ hiển thị badge tổng hợp sau ngưỡng ít nhất 3 người đánh giá độc lập, không hứa ẩn danh tuyệt đối và không dùng badge như chứng nhận an toàn.

### Nhóm E — Gặp mặt thực tế

**F25 — Địa điểm/voucher.** Tính điểm giữa từ vị trí gần đúng hai bên đã đồng ý, không tiết lộ vị trí nhà. Danh sách có địa chỉ, giờ/dữ liệu cập nhật, khoảng cách dự kiến; nếu không có tọa độ thì chọn khu vực tay. Demo dùng seed địa điểm và voucher có nhãn, không gọi đó là ưu đãi đối tác thật. Voucher có mã/điều kiện/hết hạn; kiểm tra quyền và lượt dùng trên server nếu có luồng đổi.

**F26 — Thư viện địa điểm an toàn.** Xem đánh giá theo tiêu chí đông người/nhân viên hỗ trợ, nguồn và thời điểm. Không gọi địa điểm “bảo đảm an toàn”. Gửi đánh giá có chống trùng/lạm dụng; nội dung bị báo cáo có luồng kiểm duyệt. Demo dùng dữ liệu mô phỏng được nhận diện rõ.

**F27 — Chia sẻ kế hoạch.** Người dùng tạo ngày giờ/địa điểm/thông tin muốn chia sẻ → preview → tự chọn người nhận qua share sheet hoặc kênh đã tích hợp. Không tự gửi cho danh bạ hay người thân từ server khi chưa được chỉ định. Nếu dùng link, `PROPOSAL`: token ngẫu nhiên, expiry, thu hồi, payload tối thiểu; không yêu cầu người nhận đăng nhập nếu chủ dự án chọn link công khai có token. Hủy share sheet không ghi nhận là gửi thành công.

**F28 — SOS.** Luôn có trạng thái “mô phỏng” trong demo. Nhấn → xác nhận nhanh/hủy thao tác nhầm → lấy vị trí nếu được phép → preview hoặc gửi đến kênh thử đã cấu hình → hiển thị kết quả gửi thực tế. Không ghi “đã cứu hộ/đã báo cơ quan chức năng” từ việc gọi API thành công. Không có GPS/mạng thì hiển thị giới hạn và thông tin điểm gần nhất kèm thời gian; không bịa tọa độ hiện tại. Live cần chốt người nhận, kênh, đồng ý, độ tin cậy, xử lý lỗi và quy trình vận hành trước khi phát triển.

**F37 — Đặt lịch/Calendar.** Hai thành viên Match active đề xuất/đồng ý lịch có timezone, địa điểm và trạng thái `proposed/accepted/cancelled`. Đổi hoặc hủy thông báo trong app; người ngoài không truy cập. Demo lưu lịch nội bộ; Google/Apple adapter xin quyền khi xuất/sync. Retry không tạo hai event; thu hồi quyền hoặc lỗi nhà cung cấp giữ lịch nội bộ và trạng thái chưa đồng bộ. Phải phân biệt xuất một chiều với đồng bộ hai chiều, chưa tự hứa đồng bộ đầy đủ.

### Nhóm F — Gói trả phí và tăng hiển thị

**F34 — Boost/Super Boost.** Demo cấp quyền bằng công cụ thử có nhãn, không thu tiền. Lưu thời điểm bắt đầu/hết hạn theo server và mức tăng khác nhau trong cấu hình có phiên bản; xếp hạng vẫn tuân thủ block, quyền riêng tư, bộ lọc. Retry activate không tiêu thụ hai lượt. Hết hạn tự trở lại bình thường; không hứa số Match sẽ tăng.

**F35 — Plus.** Mỗi quyền có kiểm tra backend: Like không giới hạn, Rewind interaction hợp lệ, Incognito và không quảng cáo. `PROPOSAL` incognito chỉ xuất hiện với người mình đã Like, tuyệt đối không vượt Block; Rewind không phục hồi Unmatch/Block hay thu hồi tin đã gửi. Nếu demo không có quảng cáo, đánh dấu quyền “không quảng cáo” đã mô phỏng, không tạo ads thật chỉ để chứng minh. Cần chốt quota Free, số bước Rewind và kế thừa Gold trước phase này.

**F36 — Gold.** Đủ bốn năng lực gốc: danh sách lựa chọn, bộ lọc mở rộng, Super Like, xem lại Like đã gửi. “Danh sách lựa chọn” chưa rõ là curated picks hay ai thích mình; đề xuất curated picks hàng ngày và ghi quyết định trước khi code. `PROPOSAL`: Gold kế thừa Plus; Super Like có quota server và loại interaction riêng, không tự tạo Match. Lịch sử đã gửi không tiết lộ hồ sơ đã block/ẩn/quyền truy cập bị thu hồi.

## 6. Quy tắc dữ liệu và quyền dùng chung (`PROPOSAL`)

1. Backend là nơi quyết định session, tuổi, eligibility, giới hạn media, quyền chat, block, quota và entitlement. UI disabled không thay được authorization.
2. Tuổi tính từ ngày sinh theo ngày server và timezone quy định; dưới 18 bị từ chối onboarding/discovery. Không chỉ kiểm tuổi bằng trường client gửi.
3. Profile công khai tách khỏi credential, số điện thoại, ngày sinh đầy đủ, tọa độ, selfie, báo cáo và token nhà cung cấp. API không trả cả record DB thô.
4. Thao tác lặp và đồng thời có khóa/constraint giao dịch phù hợp: Match đôi duy nhất, message retry, media 9 tệp, review một lần, entitlement không tiêu thụ kép.
5. Client cần loading/empty/success/error/offline/permission-denied; API lỗi có code ổn định, trường liên quan và request ID, không rò secret/stacktrace.
6. Retention và xóa tài khoản chưa có trong gốc nhưng cần quyết định để tránh tích lũy selfie, vị trí và chat vô hạn. Không tự đặt chính sách pháp lý; demo chỉ dữ liệu mẫu, có reset toàn bộ dữ liệu cục bộ.
7. Trạng thái `real/demo/unavailable` theo từng adapter; không có khóa provider thật thì trả trạng thái chưa cấu hình hoặc fixture có nhãn, không fallback âm thầm thành kết quả giả.

## 7. Checklist phạm vi BE và FE

### Backend — phạm vi người dùng hiện được giao

- [ ] Contract API, schema/document/index Firestore, seed idempotent gọi rõ và lane emulator riêng; không reset cloud ngầm.
- [ ] Auth/session và các provider adapter demo/live rõ ràng.
- [ ] Profile/media và bảo vệ dữ liệu riêng tư.
- [ ] Discovery, filters, Like/Pass/Match/Unmatch và chống race/retry.
- [ ] Chat text/GIF/sticker/location và kiểm tra quyền mỗi thao tác.
- [ ] Block/report, moderation state machine, review và lịch sử xử lý.
- [ ] Các module mở rộng F11–F37 theo phase, không tuyên bố xong chỉ vì đã có mock.
- [ ] Kiểm thử API positive/negative/concurrent và hướng dẫn chạy sạch sau clone.
- [ ] UI thử nút tối thiểu cho auth → profile → discovery → Match → chat → block/unmatch; nhãn rõ đây là test harness.

### Frontend — bàn giao cho nhóm FE

- [ ] Prototype đủ màn/flow và state matrix, duyệt trước giao diện hoàn thiện.
- [ ] Bộ component/tokens Liquid Glass, typography hệ thống, motion, light/dark và accessibility.
- [ ] Tất cả màn của F01–F37, gồm lỗi, quyền bị từ chối, dữ liệu trống và offline.
- [ ] Tích hợp API theo contract, secure storage và quyền thiết bị đúng nền tảng.
- [ ] Native iOS glass trên thiết bị hỗ trợ, fallback Android/iOS cũ; kiểm tra hiệu năng thực.
- [ ] Luồng chat/gesture/keyboard, ảnh/video, bản đồ, share sheet, sinh trắc và calendar.
- [ ] Nghiệm thu FE bằng dữ liệu seed và API thật cục bộ; mock UI không chứng minh BE đã hoàn thành.

## 8. Điều kiện hoàn thành một chức năng

Một dòng Fxx chỉ được đóng khi: yêu cầu/giả định liên quan đã duyệt đủ cho phase; contract và dữ liệu thống nhất; BE qua ca happy path, lỗi quyền và retry/race có liên quan; UI thuộc phạm vi phase dùng được; trạng thái demo/live đúng; có hướng dẫn và bằng chứng kiểm tra. Ghi riêng `BE done`, `FE test harness done`, `FE polished done`, `provider live verified`; không gom thành một dấu “xong”.

Các câu hỏi làm thay đổi phạm vi và cách chốt được quản lý tại [07-cau-hoi-va-quyet-dinh.md](07-cau-hoi-va-quyet-dinh.md).
