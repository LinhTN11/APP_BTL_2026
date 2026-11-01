# P09/P10 local assistant, Explore and demo entitlement backend

Existing source F29–F37 and docs04/08 govern. No Expo, external accounts/payments/messages/publication. These are backend/test-tool workflows, not approved UI-product.

## Rulings for unresolved demo parameters

- No AI credentials have been supplied. Default assistant is deterministic template **mode demo**, not claimed as AI. Do not add a paid/free-trial provider call or heavy model download. Preserve optional adapter boundary and explicit unavailable real-provider capability, to wire a confirmed free provider later.
- Templates can suggest shared declared interests, safe follow-up questions and private practice. User chooses sends; never auto-send to actual chat. Consent required before using existing match conversation as context. No sending data externally in default mode.
- Free demo plan: 20 new Likes per UTC day, 0 Super Likes, no rewind/incognito. Plus: unlimited normal Likes, at most 5 rewinds per UTC day, Incognito, no-ads entitlement flag. Gold inherits Plus, 5 Super Likes per UTC day, curated picks/advanced filter access/sent likes. These numbers are explicitly demo configuration, not original or approved business pricing.
- Rewind only most recent swipe with no associated active/ended match. Never delete message/match to rewind. Usage ledger retains prior Like so rewind cannot refund/bypass Free quota. Existing retry of same swipe/purchase never consumes extra quota.
- Boost30min and SuperBoost60min are visibility weights only (demo weight5/10), no fake view/click count, no stacking to unbounded multiplier. Plus/Gold subscription demo term30days, expiry server clock. Default catalog prices null/currency absent; no real price or card data.
- Incognito hides owner from discovery unless they have already Liked the viewer; never affects block/age/membership. No-ads is a feature flag; no ad-network integration claim.

## Task outputs

Export registerAssistant(app,d), registerBilling(app,d), readEntitlements(d,userId), assertLikeAllowed(d,actorId), recordLikeUsage(d,actorId,swipeId), isIncognitoHidden(d,viewer,target), boostWeight(d,userId), assertAdvancedFilterAllowed(d,actorId). Root integrates hooks in core swipe transaction/discovery/profile-filter handlers after worker finishes. Helpers must tolerate extension table missing until registration for isolated core tests.

Assistant:
- POST `/v1/ai/openers` `{targetUserId,consent:true}` checks permitted public target (block/visibility), returns `{mode:'demo',provider:'local-template',suggestions:string[],notice}`.
- POST `/v1/ai/reply-suggestions` `{matchId,consent:true}` active membership, bounded conversation context, same mode.
- POST `/v1/ai/practice/sessions`, GET private session/history, POST session/:id/messages with clientMessageId + bounded text. Private synthetic partner, duplicate-safe; never creates actual match/message. DELETE session cascade owner only.
- GET `/v1/explore/topics`, GET `/v1/explore` actual SQL declared topic/vibe filters with core discovery eligibility, block/age/preferences/incognito and no hidden GPS leaks. Mood/quiz references optional real data; no claiming inferred AI vibes. User-declared vibe semantics must be documented. If sharing existing discovery filter requires source integration, export a function for root rather than creating inconsistent rules.

Billing:
- GET plans/entitlements, POST demo/purchases `{productId,outcome:'success'|'failure'|'cancel',idempotencyKey}` DEMO_MODE only; transaction purchase+entitlement/boost credit, exact same retry returns same result; changed-body same key409. No live checkout/webhook.
- POST boosts consume purchased credit, expiry server clock; POST swipes/rewind, GET me/sent-likes and curated-picks, POST super-likes. Super Like must produce actual like/match through consistent core logic; if callback hook is needed root integrates rather than duplicate transaction. No boolean grant on normal route.
- Persist SQL migrations5/6, audit/usage records, tests actual SQLite for quota/retries/cross-user ownership/expiry/incognito/rewind cannot erase match/failed purchase no rights/no production demo grant. Assistant IDOR/consent/ended block, private practice duplicate and delete, Explore no bypass.

Ownership: new `apps/api/src/modules/assistant/**`, `modules/billing/**`, `db/migrations/005_assistant.sql`, `006_billing.sql`, `test/{assistant,billing}.test.ts`, `docs/api/{assistant,billing}.md`, `docs/execution/ai-billing-report.md`. No app/core source/contracts/OpenAPI/lock edits, no subagents or worker commits. Root integrates and broader tests after report. Keep files focused/readable; prioritize correctness and honest supported/unsupported capability over hollow endpoints.
