# Đăng ký và đăng nhập email/mật khẩu

> **D17 — đã thay thế:** Email đăng ký/đăng nhập hiện dùng Firebase Authentication SDK, không dùng scrypt endpoint của bản trước. [Contract/cấu hình hiện tại](firebase-auth.md). Phần bên dưới lưu lịch sử triển khai, không là hướng dẫn cấu hình mới.

T02.01 / F01, 02/11/2026. Đây là đăng nhập tài khoản ứng dụng bằng API/Firestore thật, không cần SMS hoặc cấu hình OAuth. Google vẫn là phương thức riêng theo [Google Sign-In](google-sign-in.md); email trùng không tự liên kết hai tài khoản.

| Route công khai | Body | `data` thành công |
|---|---|---|
| `GET /v1/auth/methods` | — | `{email:{mode:"real"},google:{mode,webClientId?,reason?}}` |
| `POST /v1/auth/register` | `{email,password}` | Session `{token,expiresAt,user:{id,displayName}}` |
| `POST /v1/auth/login` | `{email,password}` | Cùng Session; tên từ hồ sơ đã lưu |

Email được trim/lowercase, tối đa 254 ký tự; mật khẩu 12–128 ký tự, dùng nguyên bản, không tự trim hoặc đổi Unicode. Body không chấp nhận field ngoài contract. Đăng ký tạo account/profile/preferences/session và identity trong một transaction; hai request đồng thời cùng email chỉ có một account. Account mới tiếp tục qua hồ sơ 18+ trên app. Đăng xuất vẫn dùng `POST /v1/auth/logout`, phiên mặc định 24 giờ và có thể bị thu hồi.

Mật khẩu không được lưu nguyên văn: BE dùng `crypto.scrypt` bất đồng bộ, salt ngẫu nhiên 32 byte riêng mỗi tài khoản, N=16384/r=8/p=1, key 64 byte và so sánh `timingSafeEqual`. `emailIdentities/{sha256(email)}` lưu userId/salt/passwordHash/algorithm; session chỉ lưu SHA-256 của opaque token. User giữ email riêng và `emailVerified:false`, không trả email hoặc hash trong profile công khai. Logger che `req.body.password`, `req.body.idToken` và authorization.

Login giữ các lượt thử trong `emailAuthRates` theo hash email/mục đích trước khi chạy KDF; tối đa 5 lượt trong 15 phút, kể cả đồng thời qua hai BE. Login thành công chỉ bỏ reservation của chính lượt đó; các lượt sai khác vẫn đếm. Hết cửa sổ mới thử lại được. `429 AUTH_RATE_LIMIT` kèm `Retry-After:900`; IP limit chung của API vẫn áp dụng. Đăng ký cũng có throttle riêng theo email. Email không tồn tại, mật khẩu sai hoặc account bị vô hiệu hóa đều trả `401 CREDENTIALS_INVALID` với thông báo giống nhau; identity không tồn tại vẫn chạy KDF dummy. Email đã đăng ký trả `409 REGISTRATION_UNAVAILABLE`.

Xác minh mật khẩu diễn ra trước transaction; trước khi cấp phiên, transaction đọc lại identity/hash/salt và account active để tránh cấp phiên theo credential hoặc account đã thay đổi. Backend không tự link theo email Google, không đọc `userId` từ request để xác định actor.

**Không xác minh quyền sở hữu email.** Không gửi email, không có reset/quên mật khẩu hay khôi phục tài khoản; không hiển thị nhãn email đã xác minh. Chỉ dùng mật khẩu riêng cho ứng dụng và HTTPS khi API ra ngoài mạng debug tin cậy. Chính sách phục hồi, email verification, chống bot/quota trên nhiều IP và vận hành production là việc riêng; không coi test emulator là bằng chứng provider email hoặc Google thật.

Kiểm thử emulator bao gồm normalize/validation, đăng ký đồng thời, hash/password/session không nguyên văn, cùng account khi login, sai/không có/inactive đều lỗi chung, logout, throttle cạnh tranh qua hai instance/hết cửa sổ, malformed credential và không link qua email Google. Không seed/reset/ghi cloud trong bộ kiểm này. Wire schema trong [OpenAPI](api/openapi.yaml).

Nguồn API: [Node.js Crypto: scrypt](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback) và [timingSafeEqual](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b). Các tham số/giới hạn trên là cấu hình của implementation hiện tại, không là tuyên bố đáp ứng mọi yêu cầu bảo mật production.
