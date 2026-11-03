# Cleanup dữ liệu thật — 02/11/2026

Đã dọn theo quyền USER: 83 document seed/QA và 8 ảnh synthetic; giữ 15 document/hai Firebase users thật tại thời điểm apply. Snapshot/manifest/byte backup local được giữ ở `.local/real-data-cleanup/`, không commit dữ liệu riêng tư.

[Kết quả, verification và điều kiện offline](production-real-data-2026-11-02.md#cleanup-cloud-đã-chạy). Không chạy lại cloud smoke lịch sử để tái tạo fixtures. `scripts/firestore-cleanup.mjs inventory --project <exact-project>` là read-only; apply chỉ dành cho manifest được review và dừng tất cả writers.
