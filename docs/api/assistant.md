# Local assistant / Explore — F29–F33, T09.01–T09.03

Status 01/11/2026: optional backend modules saved and tested against SQLite. Cloud database steering arrived during implementation; these modules are preserved, not evidence of a cloud integration or FE delivery. Root owns registration/contracts.

All routes require an authenticated session. Local templates return `mode: demo`, `provider: local-template`, and an explicit notice that no AI/LLM or external transmission occurs. Suggestions never insert real chat messages. A provider interface and unavailable real-provider implementation exist in `assistant/provider.ts`; no external provider is configured.

| Method / endpoint | Input / behavior |
|---|---|
| POST `/v1/ai/openers` | `{targetUserId,consent:true}`; active complete public target; reject block or Incognito-hidden target; use at most three shared declared interests |
| POST `/v1/ai/reply-suggestions` | `{matchId,consent:true}`; active match member, no block; fetch at most ten text messages of 500 characters, no coordinates or media; templates do not transmit or echo this context |
| POST `/v1/ai/practice/sessions` | `{consent:true,persona?:'friendly-peer'}`; private fictional partner; max ten stored sessions |
| GET `/v1/ai/practice/sessions` | Owner-only cursor list; `limit` 1–50 |
| GET `/v1/ai/practice/sessions/:id` | Owner-only private history, bounded by 40 turns |
| POST `/v1/ai/practice/sessions/:id/messages` | `{clientMessageId:uuid,text}`; trimmed nonblank text, max 1,000 chars; exact retry returns same response, changed text same key →409 |
| DELETE `/v1/ai/practice/sessions/:id` | Owner only; cascading deletion of practice turns |
| GET `/v1/explore/topics` | Declared-interest topic taxonomy, user-declared vibe taxonomy, unavailable music-provider/personality-ranking capabilities |
| GET `/v1/explore` | Optional `topicId`, `vibe`, `limit`, `cursor`; fixed internal discovery request with original Authorization, then parameterized SQL filters |
| GET/PUT/DELETE `/v1/me/vibe` | PUT `{vibe:'relaxed'|'active'|'curious'}`; explicit user declaration, no inferred sensitive attributes |

Limits are provisional demo configuration: ten successful assistant requests per minute and sixty per UTC day. Retry of a practice turn consumes no additional usage. Usage stores only user, operation, context count, timestamp; it retains no copied real conversation content. Practice deletion removes messages/session; usage counters remain. No automated message, notification, purchase or network call occurs.

Explore topics: coffee (`coffee`, `cà phê`); music (`music`, `âm nhạc`, `nhạc`); travel (`travel`, `du lịch`); reading (`reading`, `đọc sách`, `sách`). SQL matches exact trimmed tags (SQLite lowercase supports ASCII), without inferring interests. Vibe means relaxed/thư giãn, active/năng động, curious/ham khám phá and is opt-in. Missing declared data does not match an enabled filter.

Explore preserves the core discovery cursor. It filters one eligible discovery page at a time, so an empty page can still have `nextCursor`; clients must follow it. No location data beyond the public profile DTO is returned. Advanced music OAuth and AI/MBTI ranking remain unavailable. Core visibility, membership, quota and discovery policies remain root-owned integration requirements; calling the module alone does not prove those hooks are wired.

Verification: `node --import tsx --test test/assistant.test.ts test/billing.test.ts` inside `apps/api` passed six focused tests on 01/11/2026. Assistant cases cover consent, block, ended match, outsider IDOR, private practice duplicate/cascade, Explore topic/vibe/block/cursor. No cloud/provider/device/FE-product verification is claimed.
