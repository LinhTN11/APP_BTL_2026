# Checklist riêng cho backend, UI kiểm thử và frontend sản phẩm

Trạng thái kiểm chứng mới nhất nằm ở [báo cáo core Firestore](qa/final-report.md). Core đã chạy trên Emulator; cloud project chưa có. Các checkbox nghiệm thu toàn bộ chức năng vẫn mở khi còn provider/thiết bị/phạm vi chưa đáp ứng; không suy ra toàn bộ việc chưa được triển khai chỉ từ checkbox trống.

Trạng thái 01/11/2026: D12 (USER) chọn Firestore; core P01–P05 đang port, SQL cũ là reference. Chưa có project/credentials, cloud read/write chưa kiểm chứng; P06–P10 cần port riêng. [Setup cloud](12-ket-noi-firestore.md); React Native Community CLI, không Expo (D10). Checkbox chỉ tick theo evidence; FE-product chưa được duyệt visual.

**Ngày:** 01/11/2026. **Trạng thái ban đầu:** toàn bộ implementation chưa bắt đầu; tài liệu/prototype không được dùng để đánh dấu backend hoặc màn RN đã hoàn thành.

**Phân công đã chốt:** một BE là chủ dự án, cần ưu tiên demo trong hôm nay; một FE có một ngày làm riêng. Android là nền tảng chính. Roadmap đầy đủ có 37 chức năng F01–F37 và 60 màn/variant S01–S60; số lượng này không phải cam kết xong trong một ngày.

Đọc cùng [yêu cầu sản phẩm](01-yeu-cau-san-pham.md), [UI/UX và screen ID](02-yeu-cau-ui-ux.md), [kế hoạch phase/task](04-ke-hoach-trien-khai.md) và [kế hoạch một ngày](11-ke-hoach-mot-ngay.md). Khi cần ưu tiên theo deadline, tài liệu 11 điều khiển thứ tự; file này giữ danh sách đầy đủ để không thất lạc yêu cầu.

## 1. Ai làm phần nào

| Luồng việc | Owner | Được tính hoàn thành khi |
|---|---|---|
| BE | Chủ dự án + subagent BE được giao | API/DB/quyền chạy đúng, có test/evidence, contract cập nhật |
| FE-test | BE có thể giao subagent hỗ trợ | Màn RN tối thiểu bấm API thật local, hiển thị loading/error/result; không phải FE-product |
| FE-product | Thành viên FE | Màn đã duyệt, Liquid Glass/fallback Android, mọi state và API đúng contract |
| QA/integration | BE tích hợp; FE cùng thử UI | Clone sạch, hai client, quyền truy cập và luồng end-to-end được kiểm chứng |

Một F có thể BE xong nhưng FE chưa xong, hoặc demo xong nhưng provider thật chưa có. Không gộp các trạng thái này thành một checkbox “xong app”.

**Mã trạng thái khi cập nhật:** `chưa bắt đầu`, `đang làm`, `chờ cấu hình`, `chờ review`, `implemented-demo`, `integrated-device`, `integrated-sandbox`, `integrated-real`, `đã kiểm chứng`. Mỗi phần được tick phải ghi mode và link evidence ở cuối dòng hoặc bảng báo cáo QA.

**Quy tắc dịch vụ:** miễn phí làm thật khi có khả năng/cấu hình; trả phí mô phỏng. FE chỉ cần API URL; BE setup Firebase project riêng một lần và credential riêng được cấp quyền, không commit key. Cloud thiếu cấu hình phải báo lỗi; emulator phải chọn rõ và không tính là cloud pass. Cần credential miễn phí mà chưa có phải ghi `chờ cấu hình`, không đổi tên fixture thành tích hợp thật. Media picker/camera/GPS/biometric/native calendar có thể làm thật trên Android hỗ trợ mà không cần cloud key.

## 2. Checklist BE — nền tảng trước chức năng

- [ ] **BE-BASE-01 — T00.01/T00.03:** chốt phạm vi một ngày và contract; đủ F01–F37, error envelope, fixtures A/B/C và quy tắc quyền. Người dùng xác nhận các quyết định nhạy cảm còn mở trước task bị ảnh hưởng.
- [ ] **BE-BASE-02 — T01.01:** `npm ci → npm run demo` từ clone sạch; `demo` gọi setup/dev, vẫn giữ hai lệnh riêng để debug. Không sửa source/IP hardcode, không mượn env/data máy tác giả.
- [ ] **BE-BASE-03 — T01.02:** Firestore Admin SDK async/document/index + seed explicit idempotent; transaction/canonical IDs/idempotency docs bảo vệ match/message/media; restart giữ dữ liệu. Lane `test:firestore` emulator và cloud verification ghi riêng.
- [ ] **BE-BASE-04 — T01.03:** health/config/errors/rate limits/log redaction; `verify`, `doctor`, `smoke:demo` là lệnh hoạt động thật.
- [ ] **BE-BASE-05 — toàn bộ phase:** schema/document/index, lockfile có một owner tích hợp; không merge đồng thời hai thay đổi xung đột không review.

## 3. Checklist BE — từng chức năng trong nguồn

### Phần 1 — core

- [ ] **F01 — Đăng nhập đa kênh — T02.01/P02.** OTP có TTL/rate limit/replay protection; opaque session 24 giờ, logout/revocation đúng, core không cần refresh endpoint. Các nút Google/Apple/Facebook báo đúng khả năng và cấu hình; OAuth miễn phí làm thật khi credential phù hợp, không biến đăng nhập chọn user demo thành OAuth thật. SMS trả phí mô phỏng có nhãn.
- [ ] **F02 — Selfie — T02.03/P02.** Upload ảnh có quyền, consent và trạng thái server; camera/upload làm thật. So khớp khuôn mặt/tích xanh demo phải có nguồn `demo`, không tự gắn xác minh thật chỉ vì gửi ảnh thành công.
- [ ] **F03 — Tối đa 9 media — T02.02/P02.** Upload/xóa/sắp xếp của chủ sở hữu, type/size đúng; chặn media thứ 10 kể cả request đồng thời, không path traversal hay URL riêng bị public.
- [ ] **F04 — Bio/mục đích/sở thích — T02.02/P02.** CRUD/read-back, validation/giá trị null và quyền public/private rõ; user C không sửa được A.
- [ ] **F05 — Lối sống — T02.02/P02.** Taxonomy và enum hợp lệ, sửa một field không mất field khác; field không khai báo không tự suy luận.
- [ ] **F06 — Bộ lọc cơ bản/GPS — T03.01/P03.** Giới tính/tuổi/bán kính áp dụng ở server, từ chối GPS có lựa chọn khu vực; không trả tọa độ chính xác của người khác và không hiện người đã block.
- [ ] **F07 — Like/pass/match — T03.02/P03.** Chỉ mutual like tạo match; Firestore transaction/canonical pair document chặn duplicate qua race/retry; pass/self-like/blocked target có hành vi đúng.
- [ ] **F08 — Unmatch — T03.03/P03.** Chỉ thành viên được hủy, retry nhất quán, REST và socket thu hồi quyền; message sau unmatch bị từ chối theo thứ tự commit.
- [ ] **F09 — Text/GIF/sticker — T04.01/P04.** Persist và phân trang đúng, idempotency cho gửi lại, reconnect nhận bù không trùng; C không đọc/join room. GIF/sticker local là catalog demo nhưng gửi/nhận là API thật.
- [ ] **F10 — Vị trí trong chat — T04.02/P04.** Chốt lại P015 trước implementation; phương án đề xuất là gửi vị trí của chính người gửi bằng consent. Snapshot/location denied/coordinate validation và quyền xem đều có test.

### Phần 2 — nâng cao và an toàn

- [ ] **F11 — Xác minh số điện thoại — T06.01/P06.** Đổi số xác minh lại, OTP không dùng lại; phân biệt kiểm soát số với “thuê bao chính chủ”, không gắn chứng nhận vượt quá bằng chứng.
- [ ] **F12 — FaceID/vân tay — T06.01/P06.** Native biometric + secure token unlock trên thiết bị được hỗ trợ, session server hết hạn vẫn đăng nhập lại; logout xóa secret local, có fallback khi user hủy/sensor không có.
- [ ] **F13 — Bộ lọc chuyên sâu — T06.02/P06.** Quan hệ/con cái/chiều cao/học vấn/tôn giáo/quê quán có schema và query tổ hợp; enforcement entitlement bổ sung ở T10.01, không chỉ khóa UI.
- [ ] **F14 — Quiz tính cách — T06.03/P06.** 20–30 câu có version, scoring xác định và test hòa/thiếu đáp án; lưu nguồn/phiên bản, không trình bày là chẩn đoán hay công cụ chính thức chưa được chứng minh.
- [ ] **F15 — Spotify/Apple Music — T06.03/P06.** OAuth/permission/import/disconnect khi đáp ứng điều kiện provider; không có key/eligibility thì ghi rõ. Fixture có nhãn, không nhân đôi tags hoặc giữ token sau thu hồi.
- [ ] **F16 — Câu hỏi trước Like — T06.04/P06.** Server kiểm `gateAnswer` theo câu hỏi/version hiện tại trước ghi like; gọi thẳng swipe không bỏ qua gate, client dùng câu hỏi cũ phải tải lại; đáp án không lộ trong profile response, không cần permit endpoint riêng.
- [ ] **F17 — Game phá băng — T06.04/P06.** Session/turn dùng chung hai người, đồng ý/skip/end rõ; reconnect giữ state, unmatch/block đóng game, nội dung mẫu phù hợp.
- [ ] **F18 — Mood trong ngày — T06.04/P06.** Set/delete/expiry bằng giờ server; hết hạn cả khi app không mở, không hiển thị vô thời hạn.
- [ ] **F19 — Safety center/cảnh báo AI — T04.03/P04 + T07.01/P07.** MVP có report/block/warning tối thiểu; bản đầy đủ phân biệt rules demo và AI thật, consent/context/rate limits rõ, không ban từ một keyword.
- [ ] **F20 — Từ khóa cấm cá nhân — T07.01/P07.** CRUD/normalize/matching có test tiếng Việt; không lộ keyword riêng cho người gửi, không coi mọi câu có từ đó đều có ý định gây hại.
- [ ] **F21 — Blur ảnh nhạy cảm/ban — T07.01/P07.** Pending/rejected asset không truy cập qua URL trực tiếp; blur không chỉ là overlay FE. Chính sách ban vĩnh viễn sau review/appeal là đề xuất phải được chủ dự án chốt, khác câu gốc cần ghi rõ.
- [ ] **F22 — Chặn user/liên hệ — T04.03/P04 + T07.02/P07.** Chặn user hai chiều trước MVP; mở rộng chặn liên hệ có consent, không tạo API dò số thành tài khoản và không upload toàn bộ danh bạ ngầm.
- [ ] **F23 — Đánh giá sau hẹn — T07.03/P07 + T08.02/P08.** Chỉ người tham gia đủ điều kiện, một review hợp lệ/người/hẹn; aggregate đủ ngưỡng, không lộ reviewer cho đối phương, có report lạm dụng và không gọi badge là bảo đảm an toàn.
- [ ] **F24 — Lý do unmatch/AI gợi ý — T03.03/P03 + T07.03/P07.** Thu feedback tùy chọn kín với đối phương; ranking demo có quy tắc giải thích, AI thật có consent/đánh giá riêng; không tiết lộ reason trong API match ended.
- [ ] **F25 — Địa điểm trung gian/voucher — T08.01/P08.** Catalog/query/midpoint có consent, không lộ vị trí đối phương; voucher mẫu có nhãn, expiry và điều kiện, không giả đối tác thật.
- [ ] **F26 — Review địa điểm an toàn — T08.01/P08.** Gửi/xem/report review theo quyền và chống trùng, moderation cơ bản; không tuyên bố địa điểm đã được bảo đảm an toàn.
- [ ] **F27 — Chia sẻ kế hoạch hẹn — T08.02/P08.** Date proposal/accept/update/cancel đúng quyền; share payload tối thiểu, link TTL/revoke nếu có, không tự gửi tin cho người thân.
- [ ] **F28 — SOS — T08.03/P08.** Preview theo quyền date plan, GPS thật khi có permission, offline/denied/lỗi báo đúng; user chủ động mở share/call, không tự gửi và không ghi “đã cứu hộ”/“đã nhận” chỉ vì đã mở share sheet.

### Phần 3 — AI, kinh doanh và lịch

- [ ] **F29 — AI mở lời — T09.01/P09.** Input chỉ profile chung được phép, output schema/timeout/budget có kiểm tra; gợi ý cần user chọn gửi, không tự gửi, demo template không gọi là model thật.
- [ ] **F30 — AI hỗ trợ chat — T09.01/P09.** User consent trước dùng context, không đọc chat người ngoài hoặc đưa vị trí/phone/selfie vào prompt, xử lý output lỗi và prompt injection.
- [ ] **F31 — Luyện mở lời — T09.02/P09.** Practice session riêng, persona hư cấu và nhãn AI rõ; không trộn với real match, có xóa/giới hạn lượt và quyền chủ sở hữu.
- [ ] **F32 — Explore — T09.03/P09.** Chủ đề/nhạc/MBTI áp dụng chung safety/visibility policy; không bypass block/tuổi/incognito; thiếu metadata có fallback và explanation trung thực.
- [ ] **F33 — Vibe — T09.03/P09.** Taxonomy/scoring có version, nguồn khai báo/suy luận rõ, consent nếu suy luận; clear filter và kết quả rỗng đúng.
- [ ] **F34 — Boost/Super Boost — T10.01–T10.02/P10.** Server time, quota/expiry, giao dịch cấp quyền một lần; không tăng hiển thị cho người bị loại bởi safety policy, không hứa có match.
- [ ] **F35 — Plus — T10.01–T10.02/P10.** Server enforce unlimited likes/rewind/incognito/no ads theo catalog; hết hạn thu hồi quyền, client giả gói không mở khóa; checkout trả phí mô phỏng.
- [ ] **F36 — Gold — T10.01–T10.02/P10.** Curated list/advanced filters/Super Like/sent likes có test entitlement và expiry; quan hệ Gold kế thừa Plus được chốt, không tự hiểu khác nhau giữa FE và BE.
- [ ] **F37 — Đặt lịch trong chat/Google/Apple Calendar — T10.03/P10.** Invitation states/timezone/dedup đúng; native calendar miễn phí thử thật trên Android. Xuất lịch một lần hoặc file .ics phải ghi đúng, không gọi là sync hai chiều khi chưa có.

## 4. Checklist FE-test — màn tối thiểu BE được phép dựng

Màn này ưu tiên khả năng quan sát API, không phải phạm vi một ngày FE-product. Sau M2 có thể mở rộng panel theo module, không cần dùng thời gian BE để làm đẹp toàn bộ màn mở rộng.

- [ ] **FT01 — Đăng nhập/session (F01/F11):** chọn fixture demo có nhãn, request/verify OTP, logout, thông báo provider chưa cấu hình. Hiển thị user hiện hành và lỗi 401; không lộ token thô.
- [ ] **FT02 — Hồ sơ (F03–F05):** đọc/sửa/read-back; ảnh/video picker thật; thêm/xóa/đổi thứ tự và thử mục thứ 10. Lỗi field hiện sát form.
- [ ] **FT03 — Selfie (F02):** camera/file thật, preview/retake/upload và trạng thái demo/server; không dùng badge thật khi demo duyệt.
- [ ] **FT04 — Discovery (F06/F13):** GPS thật khi được phép, từ chối vẫn chọn khu vực; sửa filter, xem request/query và response hợp lệ.
- [ ] **FT05 — Tương tác (F07/F08/F16):** like/pass, list matches, match hai account, trả lời gate khi có, unmatch và quan sát lỗi gửi tin sau đó.
- [ ] **FT06 — Chat hai client (F09/F10/F17):** text/GIF/sticker/location, sending/retry có cùng idempotency key, reconnect; gửi game action khi module có.
- [ ] **FT07 — Safety (F19–F24):** block/unblock/report, keyword, moderation fixture và feedback; không có nút dev cấp quyền dùng được trong chế độ provider thật.
- [ ] **FT08 — Cá nhân hóa (F12/F14/F15/F18):** bật biometric thật khi có thiết bị, quiz submit/read-back, music adapter status/disconnect và mood expiry.
- [ ] **FT09 — Địa điểm/hẹn (F25–F27):** venues/detail/review, date create/accept/edit/cancel; share sheet thật có preview.
- [ ] **FT10 — SOS (F28):** preview payload, GPS denied/offline/failed, user chủ động mở native share/call; không tự gửi external message, không giả trạng thái delivery khi không quan sát được người nhận.
- [ ] **FT11 — AI/Explore (F29–F33):** request suggestions/practice/topic/vibe, mode nguồn, error/timeout/rate limit; chỉ chèn gợi ý khi user chọn.
- [ ] **FT12 — Gói/Boost (F34–F36):** xem entitlements, tạo purchase qua `/v1/demo/purchases`, simulate success/failure/retry qua route demo; kiểm tra API trả quyền đúng sau expiry/restart.
- [ ] **FT13 — Lịch (F37):** invite accept/export, native permission, không có account và retry; phân biệt export với sync.
- [ ] **FT14 — Quan sát chung:** mỗi action có loading/error/status code, request ID và result đã che nhạy cảm; reset dev ghi rõ mất dữ liệu và cần thao tác xác nhận riêng.

**Mức tối thiểu trong một ngày BE:** FT01–FT07 ở phạm vi module core đã triển khai; FT08–FT13 chỉ làm nếu module tương ứng thuộc timebox đã chọn. Không dựng panel mở rộng chỉ để che việc API còn thiếu.

## 5. Checklist FE-product — giao cho thành viên FE

Mỗi dòng cần thêm loading/empty/error/offline/permission denied khi phù hợp theo ma trận state của docs UI. Số S là màn hoặc variant; có thể gom vào route/sheet chung mà vẫn phải giữ đủ hành vi.

### Core cho ngày làm FE đầu tiên

- [ ] **FE-CORE-01 — S01–S04 / F01:** Welcome + auth provider/phone/OTP, consent và trạng thái provider. Ưu tiên gom thành flow gọn; không dùng nút provider không hoạt động mà không giải thích.
- [ ] **FE-CORE-02 — S05–S08, S23 / F03–F05:** profile setup/edit/preview; media 0–9, sở thích, bio/lifestyle, keyboard và lỗi form; camera/gallery thật.
- [ ] **FE-CORE-03 — S09–S11 / F02:** hướng dẫn/capture/retake/status selfie có nhãn nguồn demo; có thể gom trong sheet/wizard.
- [ ] **FE-CORE-04 — S12–S15 / F06:** location permission, discover card, profile detail, basic filter sheet; denied/empty/end-of-deck và retry dùng được.
- [ ] **FE-CORE-05 — S16–S17 / F07:** match overlay/screen và matches/inbox; phản hồi server quyết định trạng thái match, không chỉ animation local.
- [ ] **FE-CORE-06 — S18–S20 / F09–F10:** chat, GIF/sticker sheet, location preview/send; bàn phím/safe area/reconnect/sending/failed/retry đúng.
- [ ] **FE-CORE-07 — S21–S22, S38–S39 / F08/F22/F24:** menu/unmatch/block/report và confirmation; kết quả xong điều hướng về chỗ hợp lệ, cache chat không còn xem được sau mất quyền.
- [ ] **FE-CORE-08 — S34, S58 / F19 + phần hỗ trợ:** safety info/settings/logout, trạng thái 401 và không có mạng; không trộn lab dev với menu sản phẩm.
- [ ] **FE-CORE-09 — dùng chung:** Android fallback Liquid Glass đọc rõ; system font, light/dark, large text, Reduce Motion/Transparency, touch target và accessibility label.
- [ ] **FE-CORE-10 — dùng chung:** đối chiếu khoảng 10–12 route/sheet core đã chốt theo docs 11; có screenshot/evidence thao tác API thật. Nếu thiếu thời gian phải ghi rõ variant còn thiếu, không tick trọn nhóm.

Các nhóm này là mục tiêu ưu tiên của một ngày FE, không bảo đảm mọi màn/variant đã hoàn thiện trong thời lượng đó. Ưu tiên luồng demo xuyên suốt hơn việc mở nhiều màn không có dữ liệu.

### Backlog FE đầy đủ theo chức năng mở rộng

- [ ] **F11 — S03–S04/S11:** trạng thái xác minh/đổi số, hiểu đúng kiểm soát số vs chính chủ, error provider và retry/rate limit.
- [ ] **F12 — S24:** bật/tắt biometric, system prompt thật, hủy/no sensor/session expired fallback.
- [ ] **F13 — S25:** advanced filter sheet, null/multi-select, reset và khóa gói do server xác nhận khi có billing.
- [ ] **F14 — S26–S27:** quiz 20–30 câu, tiến độ/bỏ dở/submit/result/retake/privacy; chữ lớn không cắt đáp án.
- [ ] **F15 — S28–S29:** kết nối nhạc/consent/import/disconnect/reconnect, nguồn demo/thật rõ và trạng thái chưa cấu hình.
- [ ] **F16 — S30–S31:** chủ hồ sơ tạo câu hỏi/đáp án; người khác gửi `gateAnswer` cùng like; sai/đổi câu hỏi/client version cũ phải tải lại đúng, không có permit endpoint riêng.
- [ ] **F17 — S32 trong S18:** chọn game/mời/đồng ý/skip/end, lượt hai người, reconnect; không ép trả lời.
- [ ] **F18 — S33:** mood picker/set/remove/expiry, timestamp từ server, không hiện mood hết hạn.
- [ ] **F19 — S34–S35:** safety center đầy đủ, cảnh báo context và hành động user, trạng thái rules demo/AI thật.
- [ ] **F20 — S36:** list/add/delete keyword, scope giải thích rõ và lỗi normalize/duplicate.
- [ ] **F21 — S37/S59:** pending/blur/rejected image không leak thumbnail, warning và khiếu nại theo policy; trạng thái tài khoản hạn chế rõ.
- [ ] **F22 — S38:** blocklist/user/contact flow, consent danh bạ riêng, unblock có confirmation và không tự phục hồi match.
- [ ] **F23 — S40:** review sau hẹn theo eligibility, nhãn đúng giờ/giống ảnh/lịch sự, giải thích aggregate/riêng tư; report lạm dụng.
- [ ] **F24 — S22:** unmatch reason tùy chọn, giải thích không gửi lý do cho đối phương, feedback gửi lỗi không ngăn user hủy match theo policy.
- [ ] **F25 — S41–S42:** list/map/midpoint, detail/voucher/điều kiện/expiry, thiếu Maps key vẫn có list đúng dữ liệu; không giả ưu đãi thật.
- [ ] **F26 — S43:** đọc/gửi/report review địa điểm, loading/empty/moderation; không dùng huy hiệu bảo đảm an toàn tuyệt đối.
- [ ] **F27 — S44–S45:** create/accept/update/cancel date, preview share payload và OS share sheet, link expired/revoked nếu dùng link.
- [ ] **F28 — S46:** SOS confirm/countdown/cancel theo thiết kế đã chốt, GPS denied/offline/delivery failure; không hiện success giả.
- [ ] **F29 — S47:** common interests và gợi ý mở lời, dùng/sửa/bỏ, không tự gửi; loading/refusal/timeout/budget.
- [ ] **F30 — S48:** consent context chat, gợi ý và user chủ động chọn, không đọc history quá phạm vi đã cho phép.
- [ ] **F31 — S49:** practice persona hư cấu, session/chat/delete/reset, nhãn AI luôn thấy, không giống danh sách người thật.
- [ ] **F32 — S50:** topic/music/MBTI Explore, results/clear/filter, safety policy và explanation từ BE.
- [ ] **F33 — S51:** Vibe picker/results/reset/empty, nguồn suy luận hay tự khai báo rõ.
- [ ] **F34 — S52:** Boost/Super Boost duration/quota/activate/history, hết hạn/retry/order state do server.
- [ ] **F35 — S53/S55:** Plus rights, rewind/incognito/unlimited likes/no ads, lock/expiry/checkout demo có nhãn.
- [ ] **F36 — S53–S54:** Gold compare/curated/super like/sent likes, entitlement errors và restore theo adapter được chọn.
- [ ] **F37 — S56–S57:** invite accept/reject/timezone, chọn calendar/permission/disconnect, export vs sync rõ, tránh duplicate event.
- [ ] **Hỗ trợ — S58–S60:** settings/permissions/logout/restricted account; Backend Lab chỉ dev/demo, không đóng vai trò màn sản phẩm.

## 6. Checklist QA/integration — điều kiện ký nhận

- [ ] **QA01 — Contract:** tất cả F trong phạm vi bản nộp có API/schema/error/owner; FE và BE không dùng field khác tên/khác type.
- [ ] **QA02 — Clone sạch:** thành viên còn lại chạy quickstart không có env/data tác giả; ghi phiên bản Node/OS/Android và bước thủ công thật.
- [ ] **QA03 — Hai client:** A/B login riêng, mutual like/match/chat/reconnect; account switch/logout không giữ state người trước.
- [ ] **QA04 — Phân quyền:** C không đọc/sửa profile private/media/selfie/match/chat/date/order của A/B; REST và socket cùng policy.
- [ ] **QA05 — Race/retry:** concurrent likes chỉ một match; retry send chỉ một message; upload không vượt 9; demo purchase và calendar không nhân đôi quyền/event.
- [ ] **QA06 — Thu hồi:** unmatch/block/logout/expiry có hiệu lực; không còn quyền qua socket room, URL asset hoặc cache FE.
- [ ] **QA07 — Persistence:** restart API/client không mất DB đã ghi, seed không nhân đôi, reset tách biệt và có cảnh báo đúng mục tiêu dữ liệu.
- [ ] **QA08 — Modes:** free service thật có evidence; chưa cấu hình ghi rõ; paid simulation có nhãn; không một button nào giả thành công nhưng báo tích hợp thật.
- [ ] **QA09 — Thiết bị:** Android GPS/media picker/camera/biometric/calendar thực theo scope; không có capability phải fallback đúng, không crash.
- [ ] **QA10 — UI:** screen/state coverage, Liquid Glass fallback, font/chữ lớn/keyboard/safe area/back, light/dark, reduced motion/transparency và accessibility.
- [ ] **QA11 — Dữ liệu:** seed hư cấu, file upload/token/env/DB không commit, log che bí mật/nội dung riêng, nguồn media có quyền sử dụng.
- [ ] **QA12 — Báo cáo cuối:** `docs/qa/final-report.md` phân biệt demo/device/sandbox/real/chưa làm; mọi checkbox đã tick có bằng chứng và known limits, không ghi đủ 37 F khi mới xong core.

## 7. Mẫu ghi nhận khi đóng một hạng mục

```text
ID: F07 / BE / T03.02
Trạng thái: đã kiểm chứng
Mode: phải ghi firestore/cloud hoặc firestore/emulator; kết quả SQLite cũ chỉ là reference local, không chứng minh Firestore
Người thực hiện / reviewer: tên thành viên hoặc task agent
Phiên bản: commit hoặc snapshot tương ứng
Kiểm tra: lệnh và kết quả; kịch bản cạnh tranh hai request
Bằng chứng: docs/qa/... hoặc link artifact
FE liên quan: FE-CORE-05 — chưa/đã nối API, trạng thái riêng
Giới hạn: ghi cụ thể nếu còn phần chưa đáp ứng
```

Không tick checkbox theo lời agent báo “done” khi chưa xem diff và kiểm tra đầu ra. Có thể tick BE trước FE, nhưng báo cáo tổng phải giữ cả hai trạng thái.
