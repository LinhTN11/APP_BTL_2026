# Demo plans and visibility — F34–F36, T10.01–T10.02

Status 01/11/2026: optional SQLite module saved while project direction changes to shared cloud database. It has no real payment provider, prices, currency, card data or webhook. Root owns registration and core integration. These are provisional demo policy numbers, not approved commercial pricing.

| Plan | Rights |
|---|---|
| Free | 20 new normal Likes per UTC day; no Rewind, Incognito or Super Like |
| Plus | Unlimited normal Likes; five Rewinds per UTC day; Incognito; noAds flag |
| Gold | Inherits Plus; five Super Likes per UTC day; advanced filters, sent likes, curated picks |

Subscription success replaces the current plan, resets Incognito to false and starts thirty days from server time. It does not extend/stack subscriptions. At expiry, the effective plan immediately becomes Free. When DEMO_MODE is false, stored demo plans/boosts confer no rights and demo purchase/boost activation are forbidden. A purchase retry still requires demo mode.

| Method / endpoint | Input / behavior |
|---|---|
| GET `/v1/plans` | Demo catalog and explicit policy; prices null; currency absent |
| GET `/v1/me/entitlements` | Server-derived current plan, expiry, quotas/flags |
| PATCH `/v1/me/incognito` | `{enabled:boolean}`; active Plus/Gold only |
| POST `/v1/demo/purchases` | `{productId:'plus'|'gold'|'boost'|'super-boost',outcome:'success'|'failure'|'cancel',idempotencyKey}`; demo only; one transaction purchase+grant; failed/cancelled grants nothing |
| POST `/v1/boosts` | `{productId:'boost'|'super-boost',idempotencyKey}`; consume one owned successful purchase credit; reject stacking active boosts |
| POST `/v1/swipes/rewind` | `{idempotencyKey}`; only most recent stored swipe by insertion order, never a swipe with any active/ended match; preserve historical Like usage |
| POST `/v1/super-likes` | `{targetUserId,gateAnswer?,idempotencyKey}`; Gold quota and shared core validation+like mutation callbacks; no fake grant when callback missing |
| GET `/v1/me/sent-likes` | Gold only; cursor-paginated own sent Likes; omit unavailable/blocked/Incognito-hidden profiles |
| GET `/v1/me/curated-picks` | Gold only; deterministic current discovery page, honest explanation; no AI score |

Purchase/boost/action idempotency keys are owner-scoped and max 128 characters. Same key and body return stored response; changed product/outcome/body returns409. Purchase response is a snapshot, not proof that an old entitlement remains active. `GET /v1/me/entitlements` supplies current rights. Keys do not allow another user to read another purchase.

Boost lasts thirty minutes at weight5; Super Boost sixty minutes at weight10. The helper returns maximum active weight rather than multiplying; expiry uses server clock. There are no fabricated view/click counts or promised matches. Incognito hides the target unless they already Liked the viewer; this exception never overrides block, age or account restrictions.

Integration exports: `registerBilling(app,d,{validateLike,like})`, `readEntitlements`, `assertLikeAllowed`, `recordLikeUsage`, `isIncognitoHidden`, `boostWeight`, `assertAdvancedFilterAllowed`. Core new-Like quota assertion and usage insert must run in the same transaction as swipe insertion; skip assertion on exact existing swipe retry. Usage has no FK cascade to swipes, so Rewind cannot refund or bypass Free daily quotas. Helpers tolerate absent billing tables for isolated earlier core tests.

`validateLike(actor,target,gateAnswer?)` is synchronous outside billing's transaction so wrong-gate attempt records survive rejection. `like(actor,target,gateAnswer?)` is synchronous, must call core mutation/quota logic, return `{swipeId,match}` and open no nested transaction. The billing transaction includes the actual Like/Match, Super Like quota and action ledger atomically. Missing either callback yields503.

Verification: six focused SQLite assistant/billing tests and API typecheck passed on 01/11/2026. Billing coverage includes exact purchase retry/conflict, failure/owner separation, subscription expiry, no production demo rights, persistent Like ledger/quota, Incognito condition, Rewind retaining ended matches, Boost credit ownership/nonstacking/expiry. Shared core Super Like callback behavior, full discovery boost ordering and all paid-filter downgrades still require integrator verification. No shared cloud, live payment or device claim.
