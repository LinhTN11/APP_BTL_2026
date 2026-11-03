# Khám phá trống do vị trí và bán kính — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` or `executing-plans` to implement task-by-task. USER đã chọn chia subagent. Lượt này chỉ điều tra chỉ đọc và lập kế hoạch; chưa sửa implementation hoặc dữ liệu thật.

**Goal:** Khám phá dùng đúng vị trí/bộ lọc đã lưu và giúp người dùng xử lý trường hợp không có kết quả; chứng minh hai hồ sơ hợp lệ xuất hiện khi đáp ứng khoảng cách, không chỉ thêm lời nhắc chung.

**Architecture:** Giữ RN CLI → Fastify → Firestore Admin. Backend trả trạng thái vị trí của chính người gọi và chính sách bán kính; frontend dùng màn hiện có để xem trạng thái, lấy lại GPS, preview/consent và tải lại. Không tiết lộ lý do loại từng ứng viên hoặc tự sửa tọa độ.

**Tech Stack:** TypeScript, React Native Community CLI, Fastify, Firebase Admin SDK, Firestore, Geolocation đang khóa trong lockfile.

**Spec:** Yêu cầu USER: “phần khám phá tôi vẫn chưa thấy ai mặc dù tôi đã lập 2 acc, lên kế hoạch chia subagent fix lỗi”; AGENTS.md, docs 01/F06, 03, 04/T03.01, 06, 08, 11, 12. D21 là checkpoint lịch sử, không phải trạng thái dữ liệu hiện tại.

**Execution checkpoint:** USER đã yêu cầu thực thi; Task1/2 đã implement và review/re-review approved, DTO/OpenAPI/docs tích hợp. Workspace typecheck/lint pass (2warning cũ), mobile103/103, API emulator26/26 + targeted timestamp1/1 sau fix. Android build/install và đọc owner-status trên session thật pass. Kiểm hai tài khoản cloud tự lưu GPS đúng và thấy nhau nếu trong radius vẫn chờ thao tác có consent; không tự thay dữ liệu. [QA cuối](../../qa/discovery-radius-2026-11-02.md).

## Global Constraints

- React Native Community CLI bắt buộc, không dùng Expo hay module `expo-*`, Android chính.
- Cloud Firestore qua Admin SDK là DB chính; không fallback SQLite/emulator. Test dùng emulator được chọn rõ.
- Admin credential chỉ ở BE, không trong app/chat/Git.
- Không tự ghi tọa độ, reset dữ liệu, xóa swipe/block, seed cloud, push/deploy hay gửi tin.
- Không ép hai người ở xa xuất hiện bằng cách âm thầm bỏ radius. Người dùng chủ động lấy GPS, xem trước và đồng ý lưu; thu hồi vị trí giữ xác nhận/ý nghĩa hiện có.
- Hai worker tối đa đồng thời; integrator giữ contract/DTO, OpenAPI/docs và App.tsx. Không commit cây đang chứa công việc khác.

## Bằng chứng hiện tại, 02/11/2026 khoảng 22:41 Asia/Saigon

Subagent BE đọc cloud và chạy handler hiện hành bằng Fastify inject trong tiến trình chẩn đoán, không tạo session hoặc ghi dữ liệu:

| Điều kiện | Kết quả |
|---|---|
| Tài khoản | Hai identity riêng, active/public, đủ tuổi |
| Hồ sơ | Cả hai đã có tên/bio, media resolve được: 1 và 2 mục |
| Filter tuổi/giới tính | Khớp; không có advanced filter |
| Swipe/match/block | Không có cặp loại nhau |
| Vị trí | Cả hai consent; khoảng cách lưu >10.000 km |
| Bán kính | 1.000 km và 100 km |
| Handler discovery | Cả hai 200, data=[], không còn cursor |

**Nguyên nhân hiện tại:** nhánh kiểm khoảng cách trong `apps/api/src/firestore/matching.ts` loại hồ sơ đúng với hai vị trí đang lưu. Chưa biết vị trí nào cũ/sai, hoặc hai người thực sự ở xa. Không gọi đây là bằng chứng GPS giả. Chẩn đoán cũ thiếu bio/ảnh đã hết hiệu lực.

Frontend có vấn đề thông tin: empty state hiện tập trung bio/ảnh; không cho biết thời điểm lấy vị trí của chính người dùng và radius đang dùng ngay trong Khám phá. Thao tác “Tải lại khám phá” chỉ tải deck, không đồng bộ lại biểu mẫu preferences.

## Contract dự kiến do integrator khóa trước worker

Thêm endpoint authenticated, owner-only `GET /v1/me/location`; không nhận userId tùy ý. Không trả tọa độ trong DTO này:

```ts
type OwnLocationStatus = {
  hasLocation: boolean; // chỉ true khi document có consent hợp lệ
  updatedAt: string | null; // server timestamp đã lưu, không bịa tuổi vị trí
};
// Envelope: { data: OwnLocationStatus }
```

Giữ `PUT /v1/me/location` body `{latitude,longitude,consent:true}` và `DELETE` hiện có. Giữ radius/filter policy; trạng thái vị trí và radius hiển thị có nguồn từ API, không suy ra “không có ai quanh bạn” từ một danh sách rỗng. Không trả số ứng viên bị loại/ID/khoảng cách riêng của người không được gợi ý.

## Task 1 — Worker BE: trạng thái vị trí riêng và regression bán kính

**Mapping/owner:** T03.01/F06, BE domain. **Timebox:** 25–35 phút.

**Files:** `apps/api/src/firestore/profiles.ts`, `apps/api/test/firestore-auth-profile.test.ts`. Chỉ sửa `matching.ts` khi regression chứng minh sai tính toán; root cấp ownership riêng khi cần.

**Consumes:** contract OwnLocationStatus đã khóa, session actor hiện có, private locations collection. **Produces:** GET owner-only, regression cho nguyên nhân hiện tại.

- [ ] Viết test fail cho GET không có vị trí → `{hasLocation:false,updatedAt:null}`; PUT consent → GET true/time server; DELETE → false/null. GET không auth trả 401. Response không có latitude/longitude/target/userId.
- [ ] Viết test hai profile đủ điều kiện với tọa độ emulator `(10,106)` và `(40,-74)`, radius 100/1000: A/B đều không thấy nhau. Đưa vị trí B về `(10.001,106.001)` bằng PUT API test có consent: cả hai thấy nhau khi tải lại. Không dùng coordinate fixture này trên cloud.
- [ ] Chứng minh thiếu GPS vẫn giữ policy fallback hiện tại; block hai chiều, private visibility, underage, swipe/match không bị phá bởi cập nhật vị trí.
- [ ] Thêm handler nhỏ trong profiles registration, chỉ đọc `ctx.ref('locations', req.actor)`; lấy `updatedAt` thật từ document, không đổi dữ liệu.
- [ ] Chạy `npm run test:firestore` (explicit emulator), `npm run typecheck --workspace @gap/api`; báo số pass/skip và diff. Lệnh fail trước sửa là bằng chứng regression, không lặp suite khi không có thay đổi mới.

**Acceptance:** tọa độ gần/xa phân loại đúng, owner status đúng sau PUT/DELETE, không rò location ứng viên hoặc tạo phiên mới trong chẩn đoán.

## Task 2 — Worker FE: sửa luồng khám phá/vị trí ngay trên màn có sẵn

**Mapping/owner:** T03.01/T05.01, F06; FE-test/core. **Timebox:** 30–40 phút. Có thể bắt đầu tests/interaction sau khi root khóa contract, không chờ worker BE chạy xong.

**Files:** `apps/mobile/src/screens/Discover.tsx`, `apps/mobile/src/screens/MyProfile.tsx`, `apps/mobile/__tests__/screens.test.tsx`. Root giữ `api.ts` DTO và `App.tsx`.

**Consumes:** OwnLocationStatus, Preferences.radiusKm, `currentLocation()`, `openLocationSettings()`, PUT/DELETE API hiện có. **Produces:** khôi phục luồng khám phá có consent, trạng thái/retry thật.

- [ ] Test initial load hiển thị radius server và thời điểm vị trí owner đã lưu; không giả nhận tọa độ mới nếu chỉ tải lại. Không dùng text “vị trí hiện tại” cho document cũ.
- [ ] Khám phá có “Cập nhật vị trí”: lấy GPS một lần → preview → Hủy không gọi PUT; đồng ý mới PUT consent → load status/preferences/deck lại. Không thêm màn/dependency hoặc chạy GPS nền.
- [ ] Khi đã có vị trí, copy empty chỉ nói “Chưa có hồ sơ phù hợp với bộ lọc hiện tại”, kèm radius + cách cập nhật GPS/đổi bộ lọc. Không tiết lộ tình trạng/vị trí hồ sơ người khác và không khẳng định bio/ảnh là nguyên nhân mới.
- [ ] “Tải lại khám phá” đồng bộ status và preferences đã lưu trước deck; giữ nháp bộ lọc chưa lưu, label rõ nháp đang khác cấu hình đã áp dụng. Nếu lỗi GET/PUT không hiện success-empty; giữ retry và không cập nhật giả timestamp.
- [ ] Tests mock deferred/deny/timeout/PUT fail, cancel/consent; GET deck được gọi sau PUT thành công và khi quay lại từ Tôi. Bản nháp profile/theme/session không bị reset.
- [ ] Chạy targeted `npm test --workspace @gap/mobile -- --runInBand screens.test.tsx` và typecheck. Báo UI change + evidence, không tự tick physical GPS.

**Acceptance:** người dùng biết radius/vị trí đã lưu của mình, sửa qua thao tác có đồng ý, deck được lấy lại; không có thao tác nào tự mở rộng bộ lọc hoặc ghi vị trí.

## Task 3 — Integrator/QA: contract, review và kiểm chứng A↔B

**Mapping/owner:** T03.01/T05.02, F06; root. **Timebox:** 20–30 phút sau hai worker.

**Files:** `apps/mobile/src/api.ts`, `apps/api/scripts/generate-openapi.ts`, `docs/api/openapi.yaml`, `docs/api/firestore-core.md`, `docs/05-checklist-be-fe.md`, `docs/qa/discovery-gps-theme-2026-11-02.md`, `docs/README.md`; `App.tsx` chỉ khi điều hướng cần đổi.

- [ ] Khóa OwnLocationStatus DTO và OpenAPI trước khi worker implement; additive endpoint, giữ backward compatibility.
- [ ] Review diff của hai worker: actor-bound GET, privacy, no hidden location writes, quyền/timeout/cancel, giữ dirty form, lỗi không bị đổi thành empty.
- [ ] Chạy workspace typecheck/lint và một lượt full mobile/API phù hợp sau tích hợp. Kiểm Android build/bundle nếu đổi runtime/native; không coi unit pass là GPS thật pass.
- [ ] Native real-account: từng người tự chọn lấy GPS, xem trước và đồng ý lưu. Sau đó refresh A/B; nếu vị trí thực nằm trong radius, cả hai thấy hồ sơ đối phương. Nếu thực ở xa, empty đúng là acceptance; không điền tọa độ gần giả để demo.
- [ ] Đối chiếu response API và UI cùng thời điểm. Nếu API có candidate mà UI trống, mở riêng regression frontend bằng response đã khử PII; nếu handler/instance đang chạy khác source, sửa khởi động process thay vì chỉnh data.
- [ ] Cập nhật QA với checkpoint mới; phân biệt emulator near/far đã chứng minh, cloud read-only, physical GPS và thao tác user chưa làm. Chưa đóng lỗi user-facing khi chưa có evidence luồng người dùng tương ứng.

## Giới hạn và việc không gộp vào lỗi này

- Chỉ có hai tài khoản không bảo đảm hai hồ sơ thỏa filter. Không bỏ tuổi/visibility/block hoặc tự xóa lịch sử tương tác.
- Bộ lọc sâu ẩn, onboarding tên/ngày sinh chưa đủ bio/ảnh là gap thật nhưng hiện không gây ca này. Đưa backlog riêng, không kéo dài worker hiện tại.
- Nếu muốn khám phá bất kể khoảng cách, đó là lựa chọn filter mới cần triển khai minh bạch (ví dụ “Không giới hạn khoảng cách”), không âm thầm nâng giới hạn 1.000 km hoặc thu hồi vị trí thay người dùng. Kế hoạch tối thiểu hiện tại không thêm tùy chọn này.

## Thứ tự và ngân sách

Root khóa contract (5–10 phút) → hai worker BE/FE song song (30–40 phút) → root review/tích hợp/QA (20–30 phút). Khoảng 60–90 phút kỹ thuật, chưa tính thời gian người dùng lấy GPS hoặc tình trạng tín hiệu. Tái sử dụng hai subagent hiện có để giảm chi phí; không worker thứ ba chờ dependency, không chạy lặp suite đã pass.
