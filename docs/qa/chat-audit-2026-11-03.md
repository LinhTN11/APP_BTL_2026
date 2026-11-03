# Kiểm tra và sửa nhắn tin — 03/11/2026

USER yêu cầu kiểm tra nhắn tin theo yêu cầu và chia subagent sửa lỗi. Phạm vi: F09/T04.01, F10/T04.02, thu hồi quyền F08/T03.03 và F22/T04.03. Integrator giữ App/sync và tài liệu; worker BE giữ Firestore chat/test; worker FE giữ màn Chat/test riêng. Giữ nguyên các thay đổi đang có trong repo.

## Lỗi đã tái hiện và sửa

| Lỗi | Nguyên nhân và bản sửa | Bằng chứng hồi quy |
|---|---|---|
| Kết nối đã unmatch/block hiện lại | REST đang chạy trả snapshot cũ sau `match:ended`; Workspace ghi nhớ ID đã kết thúc, lọc response và chặn mở lại. Phù hợp policy cặp ended không rematch. | `workspace-sync.test.tsx`: test mới fail trước sửa, pass sau sửa. |
| Mở/tải lại chat dài không thấy tin mới nhất | Màn chỉ GET trang 50 tin cũ nhất; dùng helper tải tiếp cursor đến hết, merge theo message ID như trước. | `chat-screen.test.tsx`: kiểm cả mở và refresh qua nhiều trang. |
| GPS trả về sau khi rời chat vẫn mở hộp xác nhận | Không kiểm vòng đời sau `currentLocation`; thêm kiểm tra mounted/epoch. | Test GPS hoàn tất sau unmount không mở Alert. |
| Xác nhận GPS cũ vẫn gửi sau khi rời chat | Callback Alert còn sống sau unmount; kiểm epoch trước gửi. | Test bấm callback cũ không POST. |
| Xác nhận GPS ghi đè tin văn bản chưa xác nhận | Hộp consent có thể mở trước một lượt gửi text bị mất response; dùng ref đồng bộ bảo vệ pending ID, chỉ cho retry cùng ID. | Test text POST lỗi rồi bấm consent cũ: chỉ một POST. |
| REST báo mất quyền nhưng chat/cache vẫn còn khi không có socket event | Bắt chính xác `403 MATCH_INACTIVE`/`404 NOT_FOUND`, vô hiệu hóa request cũ và gọi parent `onEnded` để purge/đóng; gửi bị từ chối không giữ retry. | Hai case GET và một case POST trong `chat-screen.test.tsx`. |
| Subscribe đồng thời vượt giới hạn 50 | Kiểm số subscription trước các await nên 51 yêu cầu có thể đều qua; giữ reservation theo match đang xử lý và đếm chung với subscription đã hoàn tất. | Test emulator 51 subscribe song song: trước sửa 51 thành công; sau sửa phải 50 thành công, một `SUBSCRIPTION_LIMIT`, đúng 50 room. |

Các regression mới đã được worker/integrator chạy fail trước sửa rồi pass sau sửa. Reviewer BE kiểm riêng bản sửa tombstone của integrator, không phát hiện vấn đề với policy hiện hành.

## Verification

- `npm run test:mobile`: **111/111**, 15 suites, exit 0 (integrator chạy toàn bộ sau sửa).
- `npm run typecheck`: API + mobile đạt, exit 0.
- `npm run lint`: exit 0, không lỗi; hai warning inline-style ở App/ui đang có trước bản sửa này.
- `npm run test:firestore`: worker BE chạy explicit emulator, **27/27**, 0 fail/skip, exit 0 (56,3 giây); trước sửa 26 pass/1 fail vì 51 subscribe đều thành công. Integrator đọc implementation và regression, không chạy lại cùng suite đã pass.
- `adb devices`: không có thiết bị kết nối. Chưa build/install hay kiểm lại hai máy Android trong lượt này.

## Đối chiếu yêu cầu và phần còn mở

- Core text: có REST persistence, idempotency, cursor, merge event trùng, giữ nháp/retry trong phiên; bộ integration BE kiểm quyền người thứ ba, block/unmatch, session, race và reconnect. Kết quả emulator không là xác nhận cloud mới.
- F09 chưa hoàn tất toàn bộ: GIF/sticker thật chưa có provider và bộ chọn mobile. D20 cố ý trả `503 PROVIDER_UNAVAILABLE` ngoài demo emulator; không bật catalog giả để coi là hoàn thành.
- F10 đang có GPS một điểm của chính người gửi, preview/consent và thời gian message. Chưa có nút mở bản đồ/lựa chọn vị trí gần đúng; chưa kiểm quyền GPS/keyboard/TalkBack trên thiết bị trong lượt này.
- Socket hiện một BE, chưa có message fanout nhiều BE. Mỗi socket tối đa 50 hội thoại; app vẫn cố subscribe danh sách match, nên trên 50 active match có thể cần tải REST cho hội thoại chưa vào room. Bản sửa chỉ bảo vệ cap trước race, chưa triển khai chính sách ưu tiên/luân chuyển room.
- Tải toàn bộ lịch sử giúp không bỏ tin mới trong lát core, nhưng chưa tối ưu cho hội thoại rất dài (virtualization/scroll-to-latest/incremental catch-up).
- Không gửi tin người dùng thật, không ghi/reset cloud, không đọc/in Admin key, không push/deploy. Native/cloud QA cũ không được coi là kết quả kiểm mới.

Kết luận: đã sửa các lỗi tái hiện trong luồng text/GPS và quyền truy cập; mức đáp ứng toàn bộ F09/F10 vẫn **partial**, không tick hoàn thành FE-product hay toàn bộ T04.
