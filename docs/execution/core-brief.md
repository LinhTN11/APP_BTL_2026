# Authorized core implementation brief — P00/P01–P05

Read AGENTS.md + docs/08 contract + this brief. User correction: React Native Community CLI, **no Expo dependency/import/runtime**, Android first. Fastify+SQLite TypeScript remains selected. All code local, no paid provider calls, no live messaging/payment. Main user is BE; UI is a working test harness, not approved FE-product.

## Exact wire DTOs shared by workers

Envelope success `{data:T,meta?:{nextCursor:string|null}}`; error `{error:{code,message,fieldErrors?,requestId}}`. UUID IDs, UTC ISO dates. API prefix /v1, default port3000.

- `GET /health` no auth -> `{data:{status:'ok',...}}`. `GET /v1/capabilities` no auth -> `{data:[{name,mode:'real'|'demo'|'unavailable',reason?}]}`.
- `GET /v1/demo/accounts` demo only -> `{data:[{account:'A'|'B'|'C'|'D',displayName}]}`.
- `POST /v1/demo/sessions` body `{account:'A'|'B'|'C'|'D'}` -> `{data:{token,expiresAt,user:{id,displayName}}}`; only when DEMO_MODE true. No arbitrary userId login.
- `POST /v1/auth/otp/request` `{phone}` -> `{data:{challengeId,expiresAt,mode:'demo',demoCode?}}` demo code only DEMO_MODE; verify `{challengeId,code}` -> same session DTO. OTP TTL5min, max5 attempts, max5 requests/phone per15min; one-time use. Live unavailable if not configured, never silently demo.
- `POST /v1/auth/logout` revoke current token. `GET /v1/me` -> user `{id,displayName}`.
- Profile `{userId,displayName,dateOfBirth?,age,gender,bio,datingGoal,interests:string[],lifestyle:{zodiac?:string,smoking?:string,drinking?:string},media:Media[],verification?:{status,mode}}`; own GET/PATCH `/v1/me/profile`; public GET `/v1/profiles/:id` omit dateOfBirth/private location/phone. PATCH only known fields, validate 18+.
- Media `{id,kind:'image'|'video',url,position}` relative authenticated `/v1/media/:id/content`. POST `/v1/me/media` multipart field `file` (JPEG/PNG/WebP<=10MB, MP4<=30MB/30s if duration validation implemented); order PATCH `{mediaIds:string[]}`; delete owner. Never pretend video duration validated if not implemented; unsupported video explicit503/422. 9 media quota transaction.
- Preferences `{genders:string[],minAge,maxAge,radiusKm}` GET/PATCH `/v1/me/preferences`.
- PUT `/v1/me/location` `{latitude,longitude,consent:true}`, DELETE revoke; private.
- GET `/v1/discovery?limit=&cursor=` -> `{data:PublicProfile[],meta:{nextCursor}}`. Must omit self/blocked/ended pair/already swiped/profile incomplete, filter gender/age/radius if consented location available. Seed A/B mutually eligible, C outsider. Missing GPS explain radius unavailable rather than fabricate distance.
- POST `/v1/swipes` `{targetUserId,action:'like'|'pass'}` -> `{data:{swipeId,match:Match|null}}`.
- Match `{id,otherUser:{id,displayName},status:'active'|'ended',createdAt}`; GET `/v1/matches` list; DELETE `/v1/matches/:id` `{reasonCode?}`. One canonical pair, no automatic re-match after ended.
- Message `{id,matchId,senderId,clientMessageId,kind:'text'|'gif'|'sticker'|'location',text?:string,payload?:object,createdAt}`. GET `/v1/matches/:id/messages?cursor=&limit=` -> chronological page (document direction); POST `{clientMessageId,kind,text?,payload?}` -> message. Text<=2000chars; GIF/sticker local catalog allowlist (no arbitrary server URL fetching); location from sender voluntary `{latitude,longitude}` validated.
- `POST /v1/blocks` `{targetUserId}`; `DELETE /v1/blocks/:userId`; `GET /v1/blocks` -> list. Block ends match, revokes socket room/read/write immediately, discovery excludes either direction; unblock doesn't reactivate match.
- `POST /v1/reports` `{targetUserId,reasonCode,detail?,matchId?}` -> receipt id; no target sees reporter. Any member may report profile with valid target; matchId only own member.
- `POST /v1/me/verification/selfie` file -> pending demo request; GET status; do not grant verified real from fixture. If not implemented report clearly.
- Socket handshake `auth:{token}`; `match:subscribe` `{matchId}` with ack `{ok:true}` or structured error; server `message:created` message; `match:ended` `{matchId,reason:'unmatched'|'blocked'}`. REST is only send source, socket delivers committed messages. Reconnect reload history; unique(senderId,clientMessageId), conflicting retry content should409. Revoke token disconnects; expiry disconnects.

## Implementation quality / acceptance

SQLite migration/seed idempotent; seed fictional adult A/B/C/D with at least one valid local profile image each, no real persons. Opaque random token/hash DB; errors/request IDs; rate limits; parameter SQL; clean transaction rollback; ownership checks. Test API real DB (temp/in-memory), concurrent mutual likes→one match, retry message→one row, C denied REST/socket/media, block/unmatch active socket revocation, session expiry/logout/OTP replay, >9media/upload failure, restart durability. Native app must call actual API and show provider modes, loading/errors/retry; session switch must clear drafts/history/socket.

## Ownership

Backend worker: `apps/api/**`, `packages/contracts/**`, `docs/api/**`, `docs/demo-accounts.md`, `docs/execution/backend-report.md`.
Mobile worker: `apps/mobile/**`, `docs/execution/mobile-report.md`.
Docs worker: existing docs root Markdown + AGENTS only.
Root: root package.json, package-lock.json, scripts/**, README.md, .gitignore, docs/qa/**, docs/handoff/**, ledger. Request root changes for shared files. No subagents from workers; no worker commits.
