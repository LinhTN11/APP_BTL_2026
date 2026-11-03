# Gặp / Mầm — màn ứng dụng thật và kiểm chứng

> **Hiện tại D17:** Firebase Authentication SDK đã thay custom email/direct Google exchange. Web/Android app và SHA-1 đã đăng ký theo quyền USER; provider EmailPassword/Google đều bật. Phần D15 bên dưới giữ lịch sử, không mô tả auth hiện hành. Bằng chứng mới nhất ở mục D17 cuối file.

02/11/2026 (Asia/Saigon), D15. Owner: integrator + worker Google/BE + worker nhận diện; T00.02/T02.01/T02.02/T03.01/T04.01/T05.01, F01,F03–F10,F22. Đây là thay đổi theo yêu cầu người dùng, **chưa duyệt visual FE-product**, không đóng toàn bộ 37F.

## Hành vi hiện tại

- App có chào mừng, chọn đăng ký/đăng nhập Google, hoàn thiện hồ sơ đầu tiên, hồ sơ/ảnh/sở thích/lối sống/vị trí riêng, khám phá + bộ lọc + Like/Pass, kết nối, chat văn bản/vị trí và báo cáo/chặn/bỏ chặn/hủy ghép đôi. Các màn nghiệp vụ gọi API hiện có; không hardcode hồ sơ/match/chat mẫu trong native.
- Đã gỡ UI công cụ BE/chọn fixture, số điện thoại/OTP mô phỏng, selfie mô phỏng, danh mục GIF/sticker gửi nhãn. Các route demo BE vẫn là công cụ test có gate, không là cách đăng nhập dự phòng trong app. Không xóa/reset dữ liệu Firestore sẵn có.
- Google: Android Credential Manager lấy ID token có nonce; BE xác minh chữ ký/audience/issuer/expiry/nonce rồi transaction tạo/tìm identity theo provider+subject, dùng challenge một lần và session hash. Không link theo email. Phiên lưu Keychain, logout/expiry giữ hành vi revoke. Hủy onboarding thu hồi phiên chưa bàn giao. Khôi phục gặp401 xóa phiên cũ cục bộ.
- Danh sách matches/blocks tải đến hết cursor; reconnect không suy ra match kết thúc chỉ vì nằm sau trang1. Loader phát hiện cursor lặp.
- PATCH lifestyle gửi null để xóa từng lựa chọn; omitted giữ nguyên. Có test clear/readback, partial merge, enum sai và cập nhật đồng thời.
- Đã xóa OceanBackdrop, ocean-current.png, ocean-motion test và toàn bộ nút dừng nền; giữ Reduced Motion độc lập cho tab/mascot. Header/tab/composer là glass, card/field/chip/bubble/nút là mặt đặc. Mascot chào một lần, không vòng animation nền.
- Nhận diện có light/dark, mascot PNG transparent, nền vườn PNG, wordmark, launcher vector Android adaptive/legacy và tên Gặp. Tên hiển thị iOS đổi, nhưng chưa build iOS.

## Kiểm chứng mới

| Lệnh/phạm vi | Kết quả và giới hạn |
|---|---|
| `npm run typecheck` | API + mobile đạt sau sửa cuối; shared ProfilePatch cho phép null khi xóa lifestyle |
| `npm run lint` | Đạt, không warning/error |
| `npm run test:mobile` | 7 suites,44/44 đạt; auth Google/onboarding/cancel/missing-config; membership pagination; lifestyle clear; session/chat/material |
| `npm run test:firestore` | Worker chạy explicit emulator:18/18 đạt,0skip,0fail sau sửa lifestyle cuối; có Google crypto verification/nonce/replay/concurrency/isolation và core permissions |
| `npm run test:startup` | 2/2 đạt sau dừng Metro; lần đầu bị precondition Metro đang dùng8081, không phải lỗi launcher |
| `npm run android` | Build/install/launch đạt trên Pixel_9 x86_64 Android16; chạy lại đạt sau launcher resources |
| Public config HTTP trên BE cloud hiện có | `GET /v1/auth/google/config` trả `mode:unavailable`, lý do chưa cấu hình; không phải live Google success |
| Native visual | Đã xem welcome light/dark, mascot+nền thực, caption tương phản, font200% ở welcome và UI XML sau cuộn cho thấy consent/Google/retry trong viewport. Không nghiệm thu toàn app/TalkBack/hai thiết bị |
| Static preview | Worker Edge176 trường hợp (11 màn x4 viewport x2 theme x2 transparency),0overflow/ảnh hỏng; consent,form,keyboard,Reduced Motion,chat text an toàn đạt. Xem [preview evidence](../prototype/README.md) |

Ảnh native: [welcome light](native-product-welcome-2026-11-02.png), [dark](native-product-dark-2026-11-02.png), [font200%](native-product-large-type-2026-11-02.png), [launcher](native-product-launcher-2026-11-02.png). Chỉ là ảnh QA, không ghi là visual đã được người dùng duyệt. Font/theme của emulator đã khôi phục1.0/night yes theo trạng thái ban đầu sau kiểm.

## Google còn chặn ở cấu hình

Chưa có GOOGLE_WEB_CLIENT_ID local được xác nhận. USER yêu cầu dùng Computer Use lấy từ Firebase, đã thử hai lượt: công cụ tự dừng vì không xác định chắc URL Edge, nên không đọc được OAuth Client ID, không thay cấu hình Console/IAM/provider và không tạo credential. Firebase Admin credential hiện có phục vụ Firestore, không thay thế OAuth Web/Android client. Không đưa secret vào app/chat/Git.

[Hướng dẫn Google](../google-sign-in.md). Package Android `com.gapmobile`; SHA-1 của chứng chỉ debug thực tế từ signingReport trong lượt này: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`. Cần client Web và Android đúng project/package/chứng chỉ, restart BE, rồi thử chọn tài khoản Google thật. Không giả thành công hoặc mở fallback tài khoản mẫu. Release signing hiện là cấu hình development; cần chứng chỉ/Play App Signing riêng khi phát hành.

## Chưa nghiệm thu

Chưa đăng nhập Google thật hoặc kiểm end-to-end native từ Google tới profile/match/chat sau thay đổi này. API emulator và component tests không thay thế bằng chứng đó. Hai Android client, permission/gallery/GPS đầy đủ, TalkBack, toàn bộ màn ở font200%, iOS và môi trường production chưa nghiệm thu. Selfie/SMS/GIF-provider và P06–P10 không được biến thành màn giả; vẫn là backlog. Không push/deploy/seed/reset cloud trong lượt này.


## V2 — font, pose, abstract pattern theo USER

T00.02/T05.01, F01,F03–F10, owner visual worker + root integration. Đây vẫn là đề xuất chưa duyệt visual. USER đã sửa rõ nền là họa tiết trừu tượng có thể chuyển động, không vườn/plaza.

- `Brand` dùng bốn PNG khác nhau: chào, chỉ dẫn, lắng nghe, mừng. Hai pose mới tạo bằng built-in imagegen theo ảnh Mầm gốc, alpha transparent, đã nhìn kiểm. Chạm welcome đổi lời và pose; focus form nghe; consent mừng. Bubble mang lời thoại dạng text native, không in chữ vào ảnh.
- `SceneBackdrop` phủ canvas bằng seed/arc/leaf/dot code-native; welcome có lớp rõ hơn. Dịch lớp1.4s khi xuất hiện, finite và dừng khi background/Reduced Motion. Không còn dùng garden asset.
- Baloo2ExtraBold + BeVietnamPro Regular/SemiBold local kèmOFL; Android assets/fonts và iOS Resources/UIAppFonts được đăng ký. Native build/iOS proof ghi riêng, không suy ra từ preview.
- Welcome giữ title/ghost/mascot nhiều lớp ở chữ thường; fontScale>=1.4 chuyển layout đọc co giãn để chữ200% không bị cắt khung tuyệt đối. Form field có viền focus và chuyển callback để mascot phản hồi.
- Preview Edge24 trường hợp320/390 × light/dark × 100/200% × welcome/register/discover: không overflow ngang/ảnh hỏng; font Baloo load. Đã nhìn ảnh320light/390dark/type200/form. Focus/consent đổi đúng asset, ReducedMotion giữ phản hồi tĩnh. Xem `brand-v2-phone-*.png`, `brand-v2-form-390-light.png`.
- SceneTransition tests3/3 đạt: route change không remount/làm mất draft, ReducedMotion không bắt đầu animation, greeting finite/cancellable/non-intercepting. Tsc mobile và eslint các file visual đạt trước kiểm integration cuối. Không thay thế evidence native hoặc authenticated provider.


Native V2 integration: `npm run android` đạt build/install/launch Pixel_9 x86_64 Android16 (BUILD SUCCESSFUL2m50s,161tasks). Đã nhìn ảnh welcome light/dark và font200% sau APK mới: chữ Baloo tiếng Việt, pattern abstract, mascot transparent, bubble đọc được; font200% chuyển flow đúng và cuộn tiếp được. Ảnh `native-brand-v2-{light,dark,type200,type200-scroll}-2026-11-02.png`. Không đăng nhập hay tạo tài khoản cloud; public config native hiển thị Google đã cấu hình, nút vẫn yêu cầu consent. Logcat mới chỉ thấy Running GapMobile, không ReactNativeJS/AndroidRuntime error. Khôi phục fontScale1.0 và night yes như trạng thái ban đầu. Sau build đã dừng đúng1Gradle9.4.1daemon IDLE để trảRAM; không kill Java/app khác. iOS, TalkBack, hai native client và authenticated provider flow V2 vẫn chưa nghiệm thu.

## D17 — Firebase SDK và tích hợp cuối

App dùng Firebase JS SDK cho email/Google; BE nhận Firebase ID token, dùng Admin SDK với checkRevoked rồi ánh xạ UID sang phiên API. [Contract hiện tại](../firebase-auth.md). Đã bỏ scrypt/direct Google token path; route cũ trả 410. Identity legacy không bị xóa hoặc link theo email.

USER đã cho phép đăng ký Web/Android app để cấu hình SDK. Management API xác nhận Web “Gap Mobile Auth”, Android “Gặp Android”, package com.gapmobile và SHA-1 debug; cấu hình có đúng Google OAuth Web/Android clients. Provider Google và Email/Password đều bật. Public config lưu trong .env.local bị ignore, BE3000 đã khởi động lại; GET /v1/auth/methods trả firebase/email/google real trên đúng project. Không tạo Admin key, đổi IAM/gói trả phí hoặc signup tài khoản cloud để thử.

Kiểm chứng cuối: mobile 9 suites, 55/55 pass trong 5.076 giây, không sửa timeout. Hai lần trước 54/55 do cold mount đầu vượt 5 giây khi RAM chỉ còn khoảng 600 MB và nhiều Gradle daemon; diagnostic riêng đạt 4611 ms và quiet rerun 55/55. API emulator SDK 19/19 và file guard 4/4 sau sửa; smoke Firebase JS thật → Auth emulator → Admin SDK thật → Firestore emulator đạt register/login/sai password, UID, disabled/revoked token, logout và Google fixture plumbing. Không coi fixture là bằng chứng Google thật. Typecheck API/mobile và lint cuối đều exit 0.

Android build/install/launch mới nhất sau font và Kotlin nonce: BUILD SUCCESSFUL trong 2 phút 50 giây, 161 tasks, 7 executed. Native visual screenshots do worker kiểm riêng; iOS chưa build. Không đánh dấu visual được duyệt hoặc Google real-account.

Dependency audit `npm audit --omit=dev` sau thêm Firebase umbrella: 4 low, 6 moderate, 4 high; high quy về Node Firestore/gRPC transitive không được app import (app chỉ dùng firebase/app và firebase/auth). Chưa tuyên bố production ready. Package-manager override thử không loại được nested pinned gRPC, đã gỡ override không hiệu quả. Automatic approval review chặn lệnh dọn thư mục dependency cache trước khi chạy; không thực hiện xóa hoặc vượt qua chặn. Giữ imports SDK công khai được hỗ trợ; cần xử lý dependency trước phát hành.

Còn chưa kiểm tài khoản Google thật, native full auth → core sau SDK, hai thiết bị, TalkBack, toàn bộ màn ở font 200% và iOS. Phiên API opaque đã cấp có vòng đời riêng tối đa 24 giờ; Firebase revocation được kiểm khi exchange. Không push/deploy/reset hoặc seed cloud.

Native V2 cuối: đã nhìn welcome light/dark, font 200% sau reflow và cuộn, form focus dùng đúng pose Listen; không red screen. Ảnh `native-brand-v2-light-2026-11-02.png`, `native-brand-v2-dark-2026-11-02.png`, `native-brand-v2-type200-2026-11-02.png`, `native-brand-v2-type200-scroll-2026-11-02.png`, `native-brand-v2-listen-2026-11-02.png`. Font scale/night mode được khôi phục 1.0/yes. Patch cuối consent dismiss keyboard và reset focus đạt Login11/11, typecheck/lint; chưa kiểm lại pose consent trên native sau patch này. Full mobile55/55 là trước patch cuối, không lặp lại toàn suite sau thay đổi nhỏ đã có kiểm thử tập trung.
