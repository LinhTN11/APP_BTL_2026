# P07 backend safety report — 01/11/2026

Owner: safety worker. Tasks T07.01 / F19–21, T07.02 / F22 and unmatch-feedback portion of T07.03 / F24. F23 attendance/review belongs to date worker. Scope authorized by root's next-wave brief; no network/provider call, paid service, deployment, message to another person, or existing data reset performed.

## Implemented

- Idempotent migration4, owner-private NFKC/lowercase literal keyword preferences, authored safety resources and viewer filter preserving original message.
- New multipart chat image route with active pair authorization before/after awaited uploads, MIME/signature check and 10MiB limit. Isolated filesystem quarantine, sanitized typed message payload, exact retry hash and cleanup on DB failure. Every upload is `pending` by explicitly labeled DEMO fixture rule; no AI inference.
- Generated quarantine placeholder endpoint; original bytes fail closed until manual `allowed` plus active match membership. Third user cannot read preview/original; profile URL path cannot bypass quarantine. No selfie read route or image-ID attachment route added.
- Demo moderation queue/decisions require current authenticated session plus separately configured environment token; disabled by default, denied in live mode, timing-safe hash comparison. Manual states and reasoned reviewer audit; no permanent ban. Owner-only media metadata/report status/appeal lists with duplicate and eligibility checks.
- Consent-required explicit contact replacement/clear/count, 100-number bound, strict normalized international phones, installation-keyed owner-specific HMAC storage, both-direction linked-phone helper. Existing active match ends after transaction and room revoked; clear does not restore.
- Private optional unmatch-feedback helper validates active membership, stores once per actor+match, never reveals reason to counterpart or provider.

## Files owned

`apps/api/src/modules/safety/{index,keywords,contacts,media,review}.ts`, `apps/api/src/db/migrations/004_safety.sql`, `apps/api/test/safety.test.ts`, `docs/api/safety.md`, this report. Shared app/domain/chat/contracts/OpenAPI were not edited by safety worker.

## Evidence

Executed against actual temporary SQLite/filesystem on Node runtime available in workspace:

```text
npm run typecheck --workspace @gap/api
exit 0; tsc --noEmit

cd apps/api
node --import tsx --test test/safety.test.ts
tests 4; pass 4; fail 0; duration ~1.03s
```

Tests verify Vietnamese composed/decomposed/case/space normalization and accent distinction; literal regex characters; blank/duplicate/oversized/max-list validation; owner-only preferences; stored original retention; missing-table no-op and restart persistence. Media test proves outsider denial, invalid signature rejection, >10MiB 413, exact retry one case, conflicting retry409, pending/blurred/rejected original403, placeholder separate from raw bytes, profile-path bypass404, correct allowed bytes, authenticated+configured token gate, no token/default403, no session401, wrong token403, live mode403/unavailable503, owner appeal privacy/duplicate, audit rows and unmatch revocation. Report test proves own receipts and private appeal ownership. Contacts test proves consent/normalization/duplicate rules, opaque hashes and count-only responses, both-direction exclusion with linked phones, unrelated users unaffected, room/chat revocation, restart persistence and clear without restoration; feedback outsider denied/private reason.

These four tests are module integration cases with many concrete assertions, not four isolated unit assertions. Full-suite/core/socket integration remains root-owned after shared hooks land.

## Required integration

1. Register `registerSafety(app,d)` before requests, after DB/multipart setup.
2. Call `filterMessageForViewer(d,viewerId,messageDTO)` for REST history, sender responses and each socket recipient. It also hydrates current moderated-image safe payload.
3. Add `isContactBlocked(d,a,b)` to central block check used by domain/discovery/profile/swipe/match/date guards. No recursion: helper uses SQL only.
4. Call `recordUnmatchFeedback(d,actor,matchId,reasonCode)` before ending match.
5. Extend shared DTO image kind/payload/filtered flag, shared OpenAPI and capabilities with accurate mode. Redact demo moderator header in logging if headers are logged.

## Material limits

No real AI/sensitivity classification, legal identity check, permanent-ban policy, automatic user ban, external contact import, anonymous-to-backend claim, AI feedback ranking, live provider callback or production admin RBAC. A local operator supplies their own demo reviewer token; no author secret is needed for normal core clone-run. Pending images cannot be previewed as originals even by reviewer; queue is metadata/fixture workflow, not a full content-review product. `blurred` uses a safe replacement placeholder, not transformed original pixels. Decisions appear after REST refresh; no moderation-update push event. Appeals persist `received`; separate appeal resolution states are deferred. Keyword filter currently has no explicit reveal-original recipient action. Lists cap at latest50 and have no extension pagination. HMAC key co-resides privately in local DB, protecting digest-only leakage but not full DB compromise; account linking/OTP remains visibly demo. FE-product screens, Android native verification and full roadmap acceptance are outside this backend module.

Original F21 permanent-ban wording remains deliberately deferred pending reviewable policy; implementation does not represent this portion as complete.
