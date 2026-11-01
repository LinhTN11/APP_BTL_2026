# P07 safety API — local implementation

Scope: T07.01 / F19–21, T07.02 / F22, unmatch feedback part of T07.03 / F24. Backend owner: safety worker; shared API/DTO integration: root. F23 belongs to date module. All routes require a current authenticated session. Standard `{data}` / `{error:{code,message,requestId}}` envelopes apply.

## Keywords and resources

- `GET /v1/me/safety-keywords` → `{keywords:string[],matching:string}` for owner only.
- `PUT /v1/me/safety-keywords` `{keywords:string[]}` replaces list; empty clears. At most 50 entries, 1–40 Unicode characters after NFKC, trim, whitespace collapse and Vietnamese lowercase. Accents remain significant: `CÀ PHÊ` matches `cà phê`, not `ca phe`. Normalized duplicates return 422 `KEYWORD_DUPLICATE`; blank/oversized entries return 400. Matching uses literal substring, never user regex.
- Receiver sees `[Nội dung được ẩn theo từ khóa cá nhân]` and `filtered:true` when matched. Stored original and sender's own view remain unchanged. No keyword list or matched keyword is returned to sender. No automatic ban or AI claim. This implementation has no reveal-original action for recipients.
- `GET /v1/safety/resources` returns authored privacy/block/report/meeting guidance and honest demo moderation status. No invented hotline numbers or rescue promise.

## Chat images and review

`POST /v1/matches/:id/message-media` receives exactly one multipart `file` (PNG/JPEG/WebP, matching MIME/signature, ≤10 MiB), only for an active pair. Optional `x-client-message-id: <UUID>` supports exact retry. Different bytes/MIME/match under the same sender+ID return 409 `MESSAGE_RETRY_CONFLICT`. Omit header to let server create an ID. Upload errors clean up the created file; sender and active membership are rechecked after upload and before commit.

Message: `{id,matchId,senderId,clientMessageId,kind:"image",payload:{mediaId,status:"pending"|"allowed"|"blurred"|"rejected",mode:"demo",url,notice},createdAt}`. All uploads enter `pending` through a **DEMO fixture rule: always manual review**, with no sensitivity detection, remote provider call, real AI verdict, automatic safe approval, or permanent account ban. Live mode rejects upload with 503 `PROVIDER_UNAVAILABLE`.

- `GET /v1/moderation/media/:id/preview` serves a generated quarantine SVG placeholder, never original bytes. It is a substitute image, not a claim of actual blurred image processing.
- `GET /v1/moderation/media/:id/content` serves original bytes only when status is `allowed` **and** requester is a current active pair member. Pending/blurred/rejected return 403 `MEDIA_QUARANTINED`, including for sender. C receives 404. Ended/blocked pair loses access even to previously allowed images. Both routes use private/no-store caching.
- No public storage URL exists. Upload path never accepts existing selfie/profile IDs. Existing `/v1/media/:id/content` cannot read quarantine records. Private verification images have no new read route.
- `GET /v1/me/moderation-cases` returns latest 50 owner's `{id,messageId,status,mode,createdAt}` records only.

`GET /v1/moderation/reports` and `POST /v1/moderation/reports/:id/decision` additionally require `DEMO_MODE=true` and explicitly configured `DEMO_MODERATOR_TOKEN`, supplied in `x-demo-moderator-token`. Session authentication remains mandatory. Missing/wrong token or live mode returns 403 `MODERATOR_REQUIRED`. Comparison hashes both tokens before timing-safe equality; nobody is admin by default. No token is generated, returned, written to `.env`, or embedded in mobile. Keep token private; this is a local demo review credential, not a production role system.

Queue returns up to 50 records each of `mediaCases`, `reports`, `appeals`, without original media bytes, storage keys, reporter identity or reviewer identity. Decision body `{decision,reason}` with nonblank reason ≤1000 chars:

- Media case ID: `allowed|blurred|rejected`. Updates stored message payload and writes append-only decision audit including authenticated reviewer, reason and time. `blurred` remains quarantined. Later REST refresh sees current decision; no live moderation-update event is emitted.
- Report ID: `reviewing|resolved|dismissed`, with default state `open`. No account ban action exists. `GET /v1/me/reports` gives reporter latest 50 own receipt statuses only.

`POST /v1/moderation/appeals` `{caseId,reason}` or `{reportId,reason}` accepts exactly one ID. Media appeal requires ownership of upload and `blurred|rejected` decision. Report appeal requires original reporter ownership. Target/outsider receives 404, duplicate appeal 409 `APPEAL_EXISTS`, ineligible media 409 `APPEAL_NOT_ELIGIBLE`. `GET /v1/moderation/appeals` lists latest 50 own appeals. Appeals are persisted `received`; reviewer can reconsider the underlying case and log another decision, but separate appeal resolution workflow is deferred.

## Contacts and feedback

- `POST /v1/me/contact-blocks` `{phones:string[],consent:true}` replaces explicit opt-in list, max100; empty list clears. Requires international E.164 (`+` with 8–15 digits); NFKC/trim/spaces/hyphens/parentheses normalized, no guessed country code. Duplicate normalized numbers return 422 `CONTACT_DUPLICATE`.
- `GET /v1/me/contact-blocks` returns `{count}`, not raw numbers, hashes or matched account IDs. `DELETE /v1/me/contact-blocks` clears. No address-book permission/import is requested automatically.
- Only HMAC-SHA256 of owner ID + normalized number is stored in `contact_blocks`; random installation secret persists privately in `safety_settings`. Equal phone entries across owners produce different digests. API never returns key/digests or offers phone→account lookup. This limits standalone hash guessing; it is **not anonymous against someone with the full DB/key**. Account's linked phone is still private auth data in `users`.
- Matching applies both directions to linked phone accounts. Newly blocked active matches end transactionally, then socket rooms are revoked. Clearing contact list never restores ended matches. No identity verification is claimed for local demo phone linking.
- Root calls `recordUnmatchFeedback(d,actor,matchId,reasonCode)` before `endMatch`; bounded optional reason persists privately once per actor+match. No public aggregate, counterpart disclosure, provider prompt or AI ranking is implemented. Reasons are private from counterpart, traceable by backend.

## Integration hooks

`registerSafety(app,d)` applies idempotent migration version4 plus installation key before route registration. Register once before first request. Exported functions from `modules/safety/index.ts`:

1. `filterMessageForViewer(d,viewerId,messageDTO)` on each REST history/sender response/socket recipient. Foreign text receives keyword placeholder; image payload refreshes latest case state and safe URL. Missing safety table is a compatible no-op.
2. `isContactBlocked(d,a,b)` inside central block check so discovery, profile, swipe, match and date policies share both-direction contact exclusion. It does not call `Domain.blocked`, so there is no recursion. No table → false.
3. `recordUnmatchFeedback(d,actor,matchId,reasonCode)` before ending an active authorized match. Missing table/no reason → no-op. Does not emit or end match itself.

Shared contracts/OpenAPI/capability list and mobile harness are root-owned integration. P07 backend does not constitute FE-product approval or real provider readiness.
