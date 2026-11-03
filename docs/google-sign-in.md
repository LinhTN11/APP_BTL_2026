# Đăng nhập và đăng ký Google — Android

> **D17 — đã thay thế:** Google hiện đổi credential bằng Firebase Authentication SDK rồi BE xác minh Firebase ID token; không dùng direct Google challenge của bản trước. [Contract/cấu hình hiện tại](firebase-auth.md). Phần bên dưới lưu lịch sử triển khai, không là hướng dẫn cấu hình mới.

T02.01 / F01, cập nhật 02/11/2026. Luồng dùng Android Credential Manager và Google ID token được BE xác minh bằng `google-auth-library`; không dùng tài khoản mẫu hoặc tự tin dữ liệu hồ sơ do client gửi. Đăng nhập lần đầu tự tạo tài khoản và mở bước hoàn thiện hồ sơ; lần sau dùng cùng Google `sub` sẽ vào cùng tài khoản. Không tự liên kết với tài khoản số điện thoại hay một Google account khác chỉ vì trùng email.

App còn có [email/mật khẩu qua API thật](email-sign-in.md), hoạt động khi Google chưa cấu hình. `GET /v1/auth/methods` báo khả năng từng phương thức. Email/password không xác minh quyền sở hữu email và không tự link vào Google account trùng email.

## Cấu hình một lần

1. Trong Google Auth Platform của project dự định dùng, cấu hình audience/consent và tài khoản thử nghiệm nếu app đang ở Testing. Tạo OAuth client loại **Web application** cho BE, rồi đặt public client ID vào `.env.local` của BE:

   ```dotenv
   GOOGLE_WEB_CLIENT_ID=<web-client-id>.apps.googleusercontent.com
   ```

2. Tạo OAuth client loại **Android** cùng project: package `com.gapmobile` và SHA-1 của chứng chỉ thực sự ký APK. Lấy SHA-1 debug/release bằng `gradlew.bat signingReport` trong `apps/mobile/android` với JDK/SDK đã cấu hình. Khi phát hành qua Play, dùng thêm SHA-1 của Play App Signing. Không dùng Android client ID cho biến `GOOGLE_WEB_CLIENT_ID`.
3. Khởi động lại BE. App lấy client ID công khai qua API; FE vẫn chỉ cần API URL, không cần nhận Admin key hoặc client secret. Tích hợp này không cần đưa `google-services.json` vào app.
4. Build/cài lại Android vì đã thêm native module và Maven dependencies; chỉ reload Metro sẽ không có module Google. Thiết bị/emulator cần Google Play Services và có thể thêm/đăng nhập tài khoản Google.
5. Mở app, chọn Google, chọn tài khoản và chấp thuận. Đăng xuất rồi đăng nhập lại phải về cùng hồ sơ. Hủy account chooser sẽ trở về màn đăng nhập. Bản iOS chưa có native Google bridge và trả thông báo chưa hỗ trợ; không coi là đã kiểm iOS.

Client ID là giá trị công khai. Admin credential chỉ nằm phía BE. Không nhập ID token/session vào chat, issue hoặc log; dùng HTTPS khi API ra ngoài mạng debug tin cậy.

## HTTP contract

Các route dưới đây không cần session có sẵn. Mọi response giữ envelope hiện hành và lỗi chuẩn `{error:{code,message,requestId}}`.

| Route | Request | `data` thành công |
|---|---|---|
| `GET /v1/auth/google/config` | — | `{mode:"real",webClientId}` hoặc `{mode:"unavailable",reason}` |
| `POST /v1/auth/google/challenge` | Không body | `{challengeId,nonce,expiresAt}`; hạn 5 phút |
| `POST /v1/auth/google` | `{challengeId,idToken}` | Session hiện hành `{token,expiresAt,user:{id,displayName}}` |

Native account chooser nhận nonce do BE cấp. BE xác minh chữ ký Google, audience, issuer, expiry và nonce trong ID token; transaction tiêu thụ challenge đúng một lần, tạo/đọc `oauthIdentities/{sha256("google:"+sub)}` và cấp opaque session. Raw Google token và raw session token không lưu trong Firestore. Google name chỉ dùng làm tên khởi đầu, tối đa 80 ký tự; ảnh/email Google không tự công khai hoặc tải về. Khóa `oauthIdentities` đảm bảo hai lượt đăng ký đồng thời cùng subject không tạo hai người dùng. Account bị vô hiệu hóa không thể lấy phiên mới.

`GOOGLE_WEB_CLIENT_ID` thiếu/sai định dạng: config và capability `oauth` báo `unavailable`; challenge/exchange trả `503 PROVIDER_UNAVAILABLE`. Giá trị đúng định dạng làm capability báo adapter `real`, **không chứng minh** client đã đăng ký đúng trong Google Console. Token sai trả `401 GOOGLE_TOKEN_INVALID`; challenge dùng lại/hết hạn trả `401 GOOGLE_CHALLENGE_INVALID`. App không tự chuyển sang tài khoản demo khi Google lỗi. Rate limit IP chung hiện hành vẫn áp dụng.

Collection bổ sung: `googleChallenges` (nonce hash, expiry, thời điểm dùng) và `oauthIdentities` (provider, subject, userId, createdAt), đều dưới namespace BE. Các challenge hết hạn không dùng được; việc dọn document cũ cần cấu hình retention/TTL riêng khi vận hành lâu dài.

## Kiểm chứng và giới hạn

- Test crypto sử dụng chứng chỉ test local với **hàm xác minh thật** của Google Auth Library, kiểm chữ ký giả, sai audience/issuer/expiry/nonce; không là đăng nhập với tài khoản Google thật.
- Test Firestore chỉ chạy trong lane emulator được chọn rõ: cấu hình thiếu, đăng ký, cùng subject đồng thời (cả subject mới với hai challenge riêng và subject đã tồn tại), challenge replay/nonce sai/hết hạn, không liên kết qua email, disabled account, session hash và logout.
- Test mobile kiểm native nonce/exchange, hủy đăng nhập, thiếu cấu hình và lỗi không lộ dữ liệu provider.
- Cần kiểm người dùng chọn tài khoản Google thật sau khi chủ project cấu hình OAuth clients. Không tự tạo cloud OAuth client, mở IAM, gửi dữ liệu tài khoản thật hoặc tuyên bố luồng provider đã hoạt động chỉ từ test local.

OpenAPI máy đọc có đủ ba route Google tại [api/openapi.yaml](api/openapi.yaml), được tạo từ `apps/api/scripts/generate-openapi.ts`. `.env.example` chỉ chứa placeholder Web Client ID công khai, không chứa credential thật. Challenge creation hiện dùng rate limit IP chung của API; khi vận hành lâu dài cần bổ sung quota riêng và TTL cleanup, chưa coi là hệ thống chống abuse production.

Nguồn chính thức đã đối chiếu: [Android Credential Manager](https://developer.android.com/identity/sign-in/credential-manager-siwg), [triển khai button flow và nonce](https://developer.android.com/identity/sign-in/credential-manager-siwg-implementation), [xác minh Google ID token trên BE](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token), [AndroidX Credentials stable releases](https://developer.android.com/jetpack/androidx/releases/credentials). Native dependencies khóa `credentials:1.6.0`, `credentials-play-services-auth:1.6.0`, `googleid:1.1.1`.

## Kiểm đọc cấu hình trong lượt D16

Sau khi Computer Use tự dừng do không xác định URL Edge, integrator dùng credential BE hiện có qua GoogleAuth SDK để gọi **chỉ GET** API chính thức `projects.defaultSupportedIdpConfigs.get` cho `google.com` trong project của app. Kết quả `404 NOT_FOUND`; không thu được Web Client ID từ provider config này. Không in token/client secret/nội dung key; không tạo client, bật provider hoặc mở rộng IAM. Kết quả này không chứng minh mọi OAuth client trong Google Cloud đều không tồn tại, chỉ cho thấy không có config provider khả dụng tại endpoint đã đọc.

Nguồn endpoint: [Identity Platform — get default supported IdP config](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/projects.defaultSupportedIdpConfigs/get). Cần xác nhận client Web/Android trong Console trước khi đánh dấu Google thật hoạt động.
