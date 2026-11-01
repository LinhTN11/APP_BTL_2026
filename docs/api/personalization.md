# P06 — local personalization API

Implemented backend scope: T06.02–T06.04 / F13–F18, excluding external music OAuth and T06.01. All routes use core Bearer auth and the `{data}` / `{error:{code,message,requestId}}` envelope. No provider, network request, AI, identity verification or paid service is used by this module. Visual/product UI is not part of this handoff.

`registerPersonalization(app, domain)` synchronously applies idempotent SQL migration `002_personalization.sql` before requests. Tables are additive; migration version 2 is recorded once. Existing core SQLite databases upgrade without resetting users, sessions or matches.

## Profile and advanced filters

`PATCH /v1/me/profile` accepts optional `advanced` patch; omitted keys retain previous values. Explicit `null` clears a field. The response adds an `advanced` object to own/public profile and discovery. These are optional **public, self-declared profile fields**; do not send sensitive values the user has not chosen to display. The server does not infer data from names, photos, quiz or AI.

| Field | Accepted non-null value |
|---|---|
| `children` | `none`, `have`, `want`, `unsure`, `prefer_not_to_say` |
| `heightCm` | Integer 100–250; centimeters |
| `education`, `religion` | Nonblank string, at most 80 characters |
| `hometown` | Nonblank string, at most 100 characters |

All five keys return `null` when undeclared. `none` is an explicit declaration and differs from null. Existing `datingGoal`, gender and lifestyle enums remain unchanged.

`GET/PATCH /v1/me/preferences` adds `advancedFilters`, an optional merged object with nullable keys `children`, `minHeightCm`, `maxHeightCm`, `education`, `religion`, `hometown`, `datingGoal`. Bounds/taxonomies match profile values; minimum height must not exceed maximum. Set a filter key to `null` to remove that condition. Strings match whole declared values after Unicode normalization, trimming and lowercasing. Enabled conditions intersect with existing age/gender/radius conditions. Missing profile values do not match an enabled condition. Radius still uses consented coordinates only and never returns GPS.

Advanced filters are real local rules available in this demo wave. No paid entitlement is claimed; P10 must add server entitlement enforcement when monetization is implemented.

```json
{"advancedFilters":{"children":"none","minHeightCm":160,"maxHeightCm":180,"education":"University","datingGoal":"relationship"}}
```

## Personality questionnaire

`GET /v1/personality/questions` returns version `preference-v1`, 24 original Vietnamese educational prompts, numeric `axis` 0–3, scale 1–5 and the complete deterministic scoring rule. This is self-reflection, not licensed/official MBTI, diagnosis or a scientific assessment. Content has not received product/editorial approval or a two-minute usability measurement.

`POST /v1/me/personality/answers`:

```json
{"version":"preference-v1","answers":[{"questionId":"q1","value":5}],"finalize":false}
```

`finalize` defaults to `true`: all 24 unique question IDs `q1`–`q24` are then required, each value an integer 1–5. Unknown IDs/version, invalid values and duplicate questions are rejected. `finalize:false` saves a replacement draft of 1–24 unique answers; clients resume with `GET /v1/me/personality` and submit their complete accumulated draft. Draft save clears any previous result, so incomplete answers cannot leave a stale public code.

Each axis uses six questions. Sum `value - 3`; nonnegative selects E/S/T/J and negative selects I/N/F/P. Ties deterministically select the first letter. Responses/results persist with the version. Final response is `{version,answered,complete,result:{code,version,visible}}`; draft result is null.

Answers are private and returned only by `GET /v1/me/personality`. `visible` in the finalize request defaults to false. `PATCH /v1/me/personality` body `{visible:boolean}` changes an existing result's visibility. Public profile exposes only `{code,version}` when opted in, otherwise null. Own profile also includes `visible`. Retaking replaces previous private answers; no answer history is public.

## Mood

`PUT /v1/me/mood` body `{text,expiresInHours?}`: nonblank text at most 80 characters; duration >0 and <=24 hours, default 24. Server clock computes `expiresAt`; client cannot set an arbitrary expiry. One SQLite row is overwritten per user. Profile/discovery return `{text,expiresAt}` only while server time is strictly before expiry and otherwise null, including at the boundary. `DELETE /v1/me/mood` clears it early. No background job/client wakeup is required for expiry.

## Question before Like

`GET /v1/like-gate/questions` returns the safe original catalog: `favorite-color`, `favorite-season`, `favorite-pet` with public text. `PUT /v1/me/like-gate` sets `{questionId,answer}` or disables with `{enabled:false}`. Answers must be nonblank and <=100 characters. Server stores a random salt and SHA-256 answer hash; responses never include salt/hash/answer. Setting a gate increments its public version.

`GET /v1/profiles/:id/like-gate` returns null or `{id,text,version}` after the same blocked/complete profile checks as public profile access.

`POST /v1/swipes` accepts optional `gateAnswer` (1–100 characters). A Like uses the target's current gate and normalizes NFKC/trim/Vietnamese lowercase before constant-time hash comparison. Missing/wrong answers return `422 GATE_ANSWER_INVALID`, and write no swipe/match. Old answers cease working when the target changes their answer. No client `passed` flag is accepted. Pass never requires the gate. Disabling restores normal Like behavior. Repeated valid Like retains core unique swipe/match behavior.

After five wrong/missing attempts for the actor/target pair within a persisted 15-minute server-time window, subsequent attempts return `429 GATE_RATE_LIMIT` until window expiry. Correct answer clears the failed-attempt counter. The module performs no asynchronous work between gate validation and core swipe transaction.

## Match games

`POST /v1/matches/:id/games` body `{kind,requestId}` where kind is `truth-or-dare` or `twenty-questions` and requestId is UUID. Only active-match members can create; only one invited/active game per match. Creation returns state `{id,matchId,kind,status,version,nextActorId,promptIndex,prompt,createdAt}`. Status starts `invited`, version/index 0, recipient is next actor; prompt stays null until consent.

`GET /v1/matches/:id/games` lists states. `GET /v1/games/:id` returns state plus `turns:[{id,actorId,action,answer,choice,createdAt}]` so both members can reload the shared history. Answers are bounded plain text, not HTML content or provider input.

`POST /v1/games/:id/turns`:

```json
{"requestId":"66408370-f645-4ab6-9639-2ed03cf2ef12","expectedVersion":0,"action":"accept"}
```

Actions: recipient `accept` starts the game and gives the first prompt to creator; `answer` requires nonblank answer <=500 characters (`choice:truth|dare` also required for truth-or-dare); `skip` advances without penalty; either member can `end` regardless of whose turn it is. Answer/skip alternate actors and advance through 20 authored safe prompts. The twentieth answer/skip ends the game. Truth-or-dare offers a harmless authored dare alongside each truth; clients never supply prompt HTML or arbitrary provider requests.

Turn request returns `{game,turn:{actorId,action,answer?,choice?}}`. `expectedVersion` must match current version; every successful action increments once. Exact same actor/requestId/payload retry returns original response without advancing. Reusing a requestId with changed payload/game returns 409. Create retry with same creator/requestId/match/kind returns same game ID/current state. Match/authorization checks run before retries, so replay cannot revive access after block/unmatch.

Errors include `GAME_EXISTS`, `GAME_NOT_ACCEPTED`, `GAME_ALREADY_ACTIVE`, `GAME_ENDED`, `TURN_CONFLICT`, `VERSION_CONFLICT`, `REQUEST_CONFLICT` (409). Outsiders receive 404; ended/blocked matches return `403 MATCH_INACTIVE`. Block/unmatch also persist game status ended. Games use REST reload, not new socket events.

## Music status

`POST /v1/me/music/connect` body `{provider:"spotify"|"apple-music"}` always returns `503 PROVIDER_UNAVAILABLE` until a real developer/OAuth adapter is implemented. `GET /v1/me/music` returns `{mode:"unavailable",connected:false,tags:[],reason}`. `DELETE /v1/me/music` returns `{connected:false}`. There are no tokens, fixtures pretending to be imported data, external calls or manual tags in this wave. Provider consent/expiry/import/disconnect acceptance remains open.
