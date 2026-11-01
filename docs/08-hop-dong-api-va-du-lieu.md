# Thiết kế API, dữ liệu và invariants

Trạng thái: **D12 chọn Cloud Firestore, core P01–P05 đang port qua Admin SDK async; project/credentials chưa có, chưa kiểm chứng cloud read/write**; SQL core và P06–P10 đang có chỉ là reference local, mở rộng cần port và test riêng; các phần mở rộng vẫn là đề xuất theo phase. Tạo và đồng bộ `docs/api/openapi.yaml` và DTO trong `packages/contracts` trước khi BE/FE triển khai khác nhau. Ngày 01/11/2026.

## 1. Quy ước chung

- Prefix `/v1`. ID UUID, thời gian ISO 8601 UTC; ngày sinh `YYYY-MM-DD` được tính tuổi phía server theo ngày hiện tại. UI hiển thị giờ địa phương.
- Auth: `Authorization: Bearer <opaque-session-token>`. Server tra hash token + expiry + account status; không lấy actor từ body.
- Response thành công `{ "data": ..., "meta": { "nextCursor": null } }`; `meta` có thể bỏ nếu không phân trang. Lỗi `{ "error": { "code": "MATCH_INACTIVE", "message": "Kết nối đã kết thúc", "fieldErrors": {}, "requestId": "..." } }`.
- Status: 400 validation; 401 session thiếu/hết hạn; 403 cấm thao tác; 404 không tồn tại/không được biết; 409 conflict; 413 quá dung lượng; 422 không thỏa điều kiện nghiệp vụ; 429 rate-limit, có `Retry-After`; 503 provider không khả dụng.
- Phân trang `{limit,cursor}` với limit mặc định 20, tối đa 50. Cursor gồm `(createdAt,id)` được encode; không offset cho message đang tăng.
- Contract công khai không tiết lộ số điện thoại, birth date đầy đủ, tọa độ chính xác, report/reviewer hay token người khác.
- Database health: `GET /health` báo `database:{provider:"firestore",mode:"cloud"|"emulator",projectId,namespace}`; không credential/token. Thiếu cloud config phải fail có hướng dẫn, không tự fallback.
- Provider status: `GET /v1/capabilities` trả `{name,mode:"real"|"demo"|"unavailable",reason}`; không trả secrets. Không dùng duy nhất một nhãn “AI bật” cho cả fixture và AI thật.

Ví dụ message request/response:

```json
{
  "clientMessageId": "66408370-f645-4ab6-9639-2ed03cf2ef12",
  "kind": "text",
  "text": "Cuối tuần bạn có muốn đi cà phê không?"
}
```

```json
{
  "data": {
    "id": "46f28bc0-df16-4970-aaf4-f367b40f99b7",
    "matchId": "a486636e-4794-477c-818b-c7a3cf241b08",
    "senderId": "ad441e5c-dd6a-4402-9ea9-332d57a15ca8",
    "clientMessageId": "66408370-f645-4ab6-9639-2ed03cf2ef12",
    "kind": "text",
    "text": "Cuối tuần bạn có muốn đi cà phê không?",
    "createdAt": "2026-11-01T03:00:00.000Z"
  }
}
```

## 2. Endpoint theo nhóm chức năng

Mỗi dòng nhóm endpoint phải được tách request/response schema và lỗi cụ thể trong OpenAPI trước khi viết task tương ứng. Các route phần mở rộng là thiết kế dự kiến; không là cam kết triển khai ngày đầu.

| Nhóm | Endpoint đề xuất | F / rule | Ưu tiên |
|---|---|---|---|
| System | `GET /health`, `GET /v1/capabilities` | mode, version, DB ready | Core |
| Auth | `POST /v1/auth/otp/request`, `/otp/verify`; `POST /v1/auth/oauth/:provider`; `POST /v1/auth/logout`; `GET /v1/me` | F01, rate-limit, challenge expiry, revoke | Core; OAuth free chờ config |
| Demo login | `POST /v1/demo/sessions` | Demo mode + user fixture allowlist; không chấp nhận userId tùy ý ở live | Core |
| Profile | `GET/PATCH /v1/me/profile`, `GET /v1/profiles/:id` | F03–05; server validate enum, đủ 18+, exposure policy | Core |
| Media | `POST /v1/me/media`; `PATCH /v1/me/media/order`; `DELETE /v1/me/media/:id`; `GET /v1/media/:id/content` | F03; multipart, tổng 9 media, private object access | Core ảnh; video theo timebox |
| Verification | `POST /v1/me/verification/selfie`; `GET /v1/me/verification`; `POST /v1/me/verification/phone` | F02,11; real/demo tách; selfie không tự cấp blue tick thật | Core workflow demo / mở rộng real |
| Discovery | `GET/PATCH /v1/me/preferences`; `GET /v1/discovery` | F06,13,32,33; filter, giới hạn quyền, không lộ GPS | Core basic |
| Vị trí riêng | `PUT /v1/me/location` body `{latitude,longitude,consent:true}`; `DELETE /v1/me/location` | F06; validate tọa độ, thời gian server, chỉ chủ tài khoản; không trả tọa độ trong public profile | Core nếu GPS được chọn |
| Swipe | `POST /v1/swipes` body `{targetUserId,action,gateAnswer?}` | F07,16; `like/pass`, không tự like/self, atomic pair match | Core |
| Matches | `GET /v1/matches`; `DELETE /v1/matches/:id` body optional reason code | F07,08,24; revoke chat/socket ngay | Core |
| Messages | `GET/POST /v1/matches/:id/messages`; `POST /v1/matches/:id/read` | F09,10; text/GIF/sticker/location, retry unique | Core text; rich media incremental |
| Safety | `POST /v1/blocks`, `DELETE /v1/blocks/:userId`, `GET /v1/blocks`; `POST /v1/reports` | F22 + reporting safeguard | Core |
| Safety preferences | `GET/PUT /v1/me/safety-keywords`; `GET /v1/safety/resources` | F19,20; keyword not AI | Advanced |
| Chat moderation | `POST /v1/matches/:id/message-media`; `POST /v1/moderation/appeals` | F21; media restricted until allowed; no client authority over verdict | Advanced |
| Minimal moderation | `GET /v1/moderation/reports`; `POST /v1/moderation/reports/:id/decision` | PROPOSAL supporting F19–22; reviewer/admin role only | Advanced; CLI/manual queue enough |
| Quiz/music/mood | `GET /v1/personality/questions`; `POST /v1/me/personality/answers`; `GET/DELETE /v1/me/music`; `POST /v1/me/music/connect`; `PUT /v1/me/mood` | F14,15,18; version quiz, consent, expire mood | Advanced |
| Like gate/game | `PUT /v1/me/like-gate`; `GET /v1/profiles/:id/like-gate`; `POST /v1/matches/:id/games`; `POST /v1/games/:id/turns` | F16,17; đáp án gate không trong public DTO | Advanced |
| Contacts/reputation | `POST /v1/me/contact-blocks`; `POST /v1/date-plans/:id/feedback` | F22,23; contact permission; feedback eligibility + aggregate anonymity | Advanced |
| Venues | `GET /v1/venues`; `GET /v1/venues/:id`; `GET/POST /v1/venues/:id/reviews` | F25,26; seed != đối tác thật | Advanced |
| Date plans | `GET/POST /v1/date-plans`; `GET/PATCH /v1/date-plans/:id`; `POST /v1/date-plans/:id/share`; `GET /v1/date-plans/:id/calendar.ics` | F27,37; thành viên, timezone, preview trước share | Advanced |
| SOS | `POST /v1/date-plans/:id/sos-preview` | F28; tạo payload, không tự gửi/không claim rescue | Advanced |
| AI | `POST /v1/ai/openers`; `/reply-suggestions`; `/practice/sessions`; `/practice/sessions/:id/messages` | F29–31; consent dữ liệu, timeout/quota, mode | Advanced |
| Explore | `GET /v1/explore/topics`; `GET /v1/explore` | F32,33; giải thích filter không claim AI nếu chỉ rule/query | Advanced |
| Plans/boost | `GET /v1/plans`; `GET /v1/me/entitlements`; `POST /v1/demo/purchases`; `POST /v1/boosts`; `POST /v1/swipes/rewind`; `GET /v1/me/curated-picks`; `GET /v1/me/sent-likes`; `POST /v1/super-likes` | F34–36; server entitlement; demo purchase not payment | Advanced |

F12 biometric là thao tác OS mở khóa credential đã có, không có route `/biometric-login` nhận boolean từ client. Server vẫn xác minh session còn hạn. Đề xuất core ngày đầu: opaque session 24h, revoke khi logout, hết hạn phải đăng nhập lại; chưa thêm refresh endpoint. Nếu cần refresh về sau phải bổ sung rotation/replay contract và test trước khi dùng, không hứa mở app không cần OTP nếu phiên hết hạn.

## 3. Realtime contract core

1. Client handshake bằng session token, server xác thực; join room sau kiểm tra membership trên server.
2. `match:subscribe` `{matchId}` → ack `{ok:true}` hoặc error code; client không được tự đặt room/user.
3. Gửi message bằng REST trước. Sau commit server emit `message:created` với message DTO cho hai thành viên; client upsert bằng message ID.
4. `match:ended` `{matchId,reason:"unmatched"|"blocked"}` buộc màn chat chuyển readonly/đóng; server rời room và từ chối mọi send/read cũ.
5. Disconnect/reconnect → tải REST sau cursor. Events không bảo đảm đúng một lần; unique `(senderId,clientMessageId)` giữ idempotency.
6. Session expiry/revoke cũng ngắt socket. Test third-user join, token expired, unmatch/block giữa lúc socket đang mở.

Typing/online/read receipts không có trong Word; chỉ là polish tùy thời gian, không chặn core. Không dùng trạng thái online để tiết lộ hoạt động người bị chặn.

## 4. Dữ liệu core — Firestore

D12: dùng Firebase Admin SDK async ở BE, không Firestore client trực tiếp trên RN. Namespace root `projects/{namespace}` (mặc định `app-cuoi-ky`, `[a-z0-9-]{1,48}`), mọi collection nghiệp vụ là subcollection của root. API DTO UUID/ISO giữ nguyên; không trả raw Firestore Timestamp. Đây là contract port, không phải xác nhận module đã pass/cloud hoạt động; xem [12](12-ket-noi-firestore.md).

| Collection / document | Trường và ràng buộc tại API/transaction |
|---|---|
| `users/{userId}` | UUID, account status, createdAt; không trả thông tin phone/private cho người khác |
| `sessions/{hashToken}` | userId, expiresAt, revokedAt; không lưu raw token |
| `otp_challenges/{id}` + phone index/rate-limit documents | code hash, expiry, attempts/consumed; hash phone làm index ID, verify + link phone atomic, không query rồi ghi để giả unique |
| `profiles/{userId}` | displayName, dateOfBirth, gender, bio, datingGoal, lifestyle, visibility, completedAt; 18+ và enum/null validation |
| `profile_media/{mediaId}` | userId, kind, storageKey, position, status; quota 9/reservation transaction; file vẫn filesystem BE có auth |
| `interests` / profile interest data | slug/label/tags validate; không tin query/filter client |
| `discovery_preferences/{userId}` | genders, age/radius bounds, advanced fields chỉ khi đã port |
| `locations/{userId}` | consent, latitude, longitude, updatedAt; private, không public DTO |
| `swipes/{actorId_targetId}` | actorId, targetId, action, createdAt; không self; canonical ID chống trùng |
| `matches/{canonicalPair}` | external UUID id, sorted member IDs, status, createdAt/endedAt; một document cho một cặp |
| `messages/{messageId}` + message idempotency documents | UUID, matchId, senderId, clientMessageId, kind/content, createdAt; hash(senderId + clientMessageId) giữ same retry result, khác match/content trả conflict |
| `blocks/{actorId_targetId}` | actorId, targetId, createdAt; không self; transaction đọc cả hai chiều |
| `reports/{reportId}` | reporterId, targetId, optional matchId, reason, detail, status, createdAt; không lộ reporter |

Không có SQL FK/unique trong Firestore: service và transaction phải kiểm tham chiếu, session, ownership, block/match ngay trước ghi. Transaction đọc đầy đủ document trước write; closure có thể retry nên emit socket/file side effect chỉ sau commit. Match canonical và idempotency docs phải bảo vệ race giữa hai server; demo socket hiện một backend, chưa có scale-out cross-instance.

Message query có `where(matchId)` + `orderBy(createdAt,id)`, cursor tuple ổn định và limit; composite index khai báo trong `firestore.indexes.json`, không load toàn collection cloud. Các query khác phải có bound/index tương ứng, không thay SQL bằng scan vô hạn. OAuth identities có index document theo provider+subject khi tích hợp thật; không link chỉ vì trùng email, không lưu provider token vào public profile.

Client rules deny all; Admin SDK bỏ qua rules nên quyền nằm tại API. `FIREBASE_PROJECT_ID` bắt buộc, ADC hoặc `GOOGLE_APPLICATION_CREDENTIALS` chỉ ở BE. Seed chỉ do `firestore:seed` gọi rõ/create-if-absent, không ghi đè chỉnh sửa/xóa hoặc phục hồi match ended. Emulator test namespace riêng không là bằng chứng cloud.

## 5. Dữ liệu mở rộng theo phase

| Phase / nhóm | Collection dự kiến khi port | Invariant cần chứng minh |
|---|---|---|
| P06 xác thực/cá nhân hóa | `verification_requests`, `quiz_versions`, `quiz_answers`, `personality_results`, `music_connections`, `moods`, `like_gates` | mode demo không lên badge real; token nhạc private; mood tự hết hạn; secret đáp án không public |
| P07 an toàn/cộng đồng | `safety_keywords`, `moderation_cases`, `appeals`, `contact_blocks`, `date_feedback`, `unmatch_feedback` | report/feedback không trả actor cho người bị đánh giá; contact không upload sổ địa chỉ thô mặc định |
| P08 hẹn thực tế | `venues`, `venue_reviews`, `date_plans`, `date_plan_members`, `share_links` | plan chỉ thành viên sửa; share token expiry/revoke; không lộ vị trí khi chưa đồng ý |
| P09 AI/explore | `ai_sessions`, `ai_messages`, `explore_topics`, `profile_topics` | consent, quota, timeout; chỉ gửi dữ liệu tối thiểu cho provider |
| P10 gói/lịch | `entitlements`, `demo_purchases`, `boosts`, `super_likes`, `calendar_links` | không grant qua boolean client; expiry dùng server clock; purchase retry không cấp đôi |

SQL modules P06–P10 hiện có chưa được xem là Firestore complete; các collection trên là kế hoạch port, không tự bật route fallback SQL trong cloud mode. Không tạo tất cả collection ở ngày đầu. Không lưu dữ liệu biometrics OS hoặc face embedding vào backend chỉ để demo.

## 6. Quy tắc nghiệp vụ cần transaction và quyền

- Hai like đồng thời chỉ tạo **một match**. Canonical pair document + Firestore transaction async; retry SDK phải đọc lại trạng thái/quyền, không dựa unique SQL. Nếu match đã ended, chính sách mặc định không tự tái match; cần quyết định re-match trước khi mở tính năng.
- Discovery bỏ self, người chưa đủ hồ sơ, underage, blocked theo cả hai chiều, account disabled, match đang active và target đã swipe theo chính sách. GPS thiếu: yêu cầu lựa chọn vị trí demo rõ nhãn hoặc bỏ radius có thông báo; không giả khoảng cách thật.
- Một like gate sai trả `GATE_ANSWER_INVALID`, không ghi like. Nhiều lần thử cần rate-limit; câu hỏi không chứa thông tin nhạy cảm.
- Chỉ hai thành viên match active gửi/đọc chat hoặc media liên quan. Media profile áp dụng chính sách visibility của chủ hồ sơ. Media chat không phải URL tĩnh không auth.
- Block hai chiều trong visibility, thu hồi room/chat; unblock không tự phục hồi match cũ. Unmatch xong request send đến chậm vẫn bị reject.
- Xóa/reorder media kiểm tra owner và quota trong DB transaction; ghi file rồi fail DB phải cleanup; stream bị hủy không để orphan tồn tại mãi.
- Chia sẻ vị trí chỉ do **người gửi chia sẻ vị trí của mình**, không lấy tọa độ đối phương. TTL hiển thị và revoke phải được chốt trước live location; core ưu tiên location message một lần.
- Report/AI detection tạo case; biện pháp vĩnh viễn phải được định nghĩa và có người review. Không đổi Word một cách im lặng: quyết định này cần xác nhận trong docs 07.

## 7. Bộ test nghiệm thu trọng yếu

| Test | Quan sát phải có |
|---|---|
| Auth/session | OTP sai/hết hạn/used bị chặn; logout token cũ không dùng lại; demo route tắt khi live |
| Ownership | C không sửa profile/media A; không đọc room/message/location A–B |
| Race match | A/B like đồng thời và retry → một match ID, không hai document |
| Retry message | Gửi cùng `clientMessageId` hai lần → cùng message, một document |
| Revoke | Block/unmatch khi socket mở → send/read mới bị từ chối, socket rời room |
| Media limit | Hai upload đồng thời khi đã có 8 → chỉ 1 được thêm; file lỗi được cleanup |
| Persistence | Restart API không mất profile/match/message; seed lần hai không nhân dữ liệu |
| Provider | `demo`/`unavailable` rõ nhãn; real failure không giả success |
| Clone | Máy/thư mục sạch chạy đúng runbook; điện thoại không dùng localhost để gọi máy tính |

Tên test/câu lệnh sẽ được tạo và khóa trong P01. Chỉ tick sau khi có output, không lấy bảng trên làm bằng chứng pass.
