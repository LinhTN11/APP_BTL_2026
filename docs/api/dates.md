# P08 — Local venues, date plans, reviews and preview/export

Owner: backend, T08.01–T08.03 / F25–F28, foundation F23/F37. No FE-product, native map/share/GPS/calendar or cloud sync is claimed. All routes use the existing Bearer session hook and `{data: ...}` / standard error envelopes. Register with `registerDates(app, domain)` from `apps/api/src/modules/dates/index.ts` before Fastify is ready.

## Catalog and voluntary coordinates

| Route | Input / response |
|---|---|
| `GET /v1/venues` | Optional query `area`; alternatively `latitude`, `longitude`, `ownConsent=true` for distance sorting. Optional `sharedLatitude`, `sharedLongitude`, `sharedConsent=true` additionally compute a spherical midpoint. Both coordinate pairs must be explicit and voluntary; neither pair is read from a profile. Maximum 100 results without area filter. |
| `GET /v1/venues/:id` | Venue DTO below. |
| `GET /v1/venues/:id/reviews` | Latest 50 published participant reviews. No reviewer/plan ID. |

Venue DTO: `{id,name,area,address,location:{latitude,longitude},hours,criteria,updatedAt,mode:"demo",source:"synthetic",safetyNotice,vouchers:[{id,code,conditions,expiresAt,expired,mode:"demo",redeemable:false}]}`. List entries optionally add `distanceKm`; list meta gives `mode:"demo"`, `ranking:"manual_area"|"voluntary_coordinates"`, and a notice. Returned venue coordinates belong to the synthetic catalog; neither user coordinates nor midpoint are returned or persisted. Consent flags are caller attestations, not proof of another person's permission; FE must obtain explicit consent before passing a voluntarily shared point. No maps API, partner offer, voucher redemption or guaranteed-safe badge exists.

The idempotent version-3 migration creates three fictional venues and one clearly labeled fictional voucher, using `INSERT OR IGNORE` without overwriting existing rows. Expiry is evaluated with server time on every read.

## Date plan lifecycle

| Route | Body / behavior |
|---|---|
| `GET /v1/date-plans` | Latest 100 plans belonging to actor. |
| `POST /v1/date-plans` | `{requestId,matchId,venueId,title,startsAt,endsAt,timezone}`. Match must be active and actor a member; server snapshots exactly both members. |
| `GET /v1/date-plans/:id` | Actor must be a plan member; outsiders receive 404. |
| `PATCH /v1/date-plans/:id` | `{requestId,version,status:"accepted"|"cancelled"|"completed"}`. Optimistic version required. |

Plan DTO: `{id,matchId,proposerId,memberIds:string[],title,venue:Venue,startsAt,endsAt,timezone,status,version,createdAt,updatedAt,mode:"real"}`. Times normalize to UTC ISO strings. Dates must include an explicit offset or Z, be real calendar dates, and have a valid IANA/Intl timezone. Creation starts in the future; duration is positive and at most 24 hours. Title is 1–120 characters and rejects CR/LF/control characters. Request IDs are nonblank strings of at most 100 characters. Unknown body fields are rejected.

- New plans are `proposed`, version 1. Only the other member can accept, while the match remains active and before start time.
- Either member can cancel a proposed/accepted plan before its end, including after unmatch/block.
- Either member can mark an accepted plan completed after `endsAt`. Completed/cancelled plans are terminal. An accepted plan is eligible for feedback when its end passes without requiring a separate completion action.
- Members retain plan read/share/export and historical feedback eligibility after unmatch. Outsiders never gain access. No participant GPS, phone or birthday is added to plan DTOs.
- Create/update responses are stored transactionally under actor + requestId. Exact retry returns the original response; reusing the key for a different operation/payload returns `409 IDEMPOTENCY_CONFLICT`. Create retry and acceptance retry still recheck active match permission. `version` mismatch returns `409 VERSION_CONFLICT`; invalid transitions return `409 STATE_CONFLICT`.
- After commit, `date-plan:updated` is emitted to the existing authorized match room with `{planId,matchId,version,status}`. Retry may repeat that event; clients should deduplicate by planId/version. The event contains no GPS. This supplies a notification hook, not a finished mobile notification UI.

## Participant reviews and feedback

`POST /v1/venues/:id/reviews` body: `{planId,rating:1..5,text,crowded:boolean,staffSupport:boolean}`. The actor must belong to an accepted/completed plan at this venue whose end has passed. Text is at most 1000 characters and plain text; an empty text is allowed. One review per actor/plan: exact content retry returns the same record, changed content returns `409 ALREADY_REVIEWED`. Review DTO: `{id,venueId,rating,text,crowded,staffSupport,createdAt,source:"participant_report",mode:"real",notice}`. Criteria are subjective participant observations, not a safety certificate.

`POST /v1/venues/:id/reviews/:reviewId/report` body: `{reason}` (1–300 characters). Any authenticated user can flag a published review. It is hidden from public lists with `pending_review`, the report is persisted once per actor/review, and no account is banned. Reviewing/resolving that local queue is an operator/P07 integration still to implement; no client can set moderation state or impersonate a moderator.

`POST /v1/date-plans/:id/feedback` body: `{attended:boolean,tags:string[]}`. Tags are unique members of `on_time`, `resembles_photos`, `respectful`, at most three; absent attendance requires an empty tag list. Same eligibility and once-only rule as venue review; identical retry succeeds and changed feedback returns `409 ALREADY_REVIEWED`. Response: `{recorded:true,visibility:"private",mode:"real"}`. Raw actor-linked feedback remains private; no public reputation aggregate or badge is implemented. This is the date eligibility/storage foundation for F23, not all of T07.03.

## Share, SOS and calendar

| Route | Input / response |
|---|---|
| `POST /v1/date-plans/:id/share` | Empty body or `{}`. `{mode:"real",delivery:"prepared",channel:"system_share_sheet",text,notice}`. Contains only chosen plan title, time, venue and state; no public URL/token or recipient. |
| `POST /v1/date-plans/:id/sos-preview` | `{confirmed:true,locationConsent?:boolean,location?:{latitude,longitude,capturedAt}}`. Optional own coordinates require explicit consent; capturedAt is timezone-aware, no older than 15 minutes and no more than one minute ahead. Response `{mode:"demo",status:"prepared"|"no_location",delivery:"prepared",location:Location|null,text,notice}`. Missing GPS is explicit and plan venue is never represented as current GPS. Location is returned only to this request and is never persisted. |
| `GET /v1/date-plans/:id/calendar.ics` | Authorized member download with `text/calendar; charset=utf-8`, private/no-store cache policy. UTC DTSTART/DTEND and original timezone metadata; stable UID per plan, SEQUENCE = version−1, stable revision timestamp. Cancelled plan emits CANCELLED status. |

Share and SOS endpoints create previews without sending SMS/email, fetching a provider, creating a chat message, or recording delivery success. SOS is explicitly simulated; no rescue is called or promised. The mobile caller still needs to invoke native share after explicit user choice and handle cancellation. ICS is one-way export; no Google/Apple account, permission or two-way sync is claimed. Text escaping, CRLF property injection rejection and Unicode-aware 75-octet line folding apply to ICS output, including validation of stored venue/title values.

Useful error codes: `VALIDATION_ERROR` 400; `NOT_FOUND` 404 for outsiders/unknown records; `MATCH_INACTIVE` 403; `DATE_IN_PAST`, `DATE_RANGE_INVALID`, `LOCATION_CONSENT_REQUIRED`, `CONFIRMATION_REQUIRED`, `LOCATION_STALE`, `VENUE_MISMATCH`, `MIDPOINT_UNDEFINED` 422; state/version/idempotency/review/eligibility conflicts 409. Failed validation and conflicts do not write a successful operation.
