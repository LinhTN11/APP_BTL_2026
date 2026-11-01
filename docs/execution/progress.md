# SDD ledger — plan: docs/04-ke-hoach-trien-khai.md

## 2026-11-01 — React Native CLI correction and execution

User: React Native CLI, no Expo; check compatibility then execute with subagents. Implementation authorized. Visual design remains draft; FE-test is authorized independently.

Workspace: newly initialized repository, branch `feat/rn-cli-demo`; initial docs snapshot committed. No existing app to overwrite. Work is local, no push/deploy. This repo is the user's explicitly named implementation workspace.

Ruling: execute P00/P01–P05 core first, then reassess remaining roadmap against deadline; never silently claim all 37 F complete. User's one-day BE priority and future FE day govern delivery.

Ruling: use file-disjoint docs/backend/mobile workers in parallel as explicitly requested; root owns root package/scripts/lockfile and integration. This overrides skill's generic prohibition on concurrent implementation because no shared mutation is delegated. No agent may spawn subagents or commit independently.

| Task wave | Producer → consumer / shared interface | Check / ruling |
|---|---|---|
| CLI docs | User D10 → all tasks | Expo plan contradicts user; replace active guidance before using it |
| P00 contract | Core brief + docs08 → backend/mobile | Root locks concrete DTO subset in core brief; extend OpenAPI with implementation |
| P01 runtime/DB | API config/migration/seed → modules | API worker owns only apps/api + packages/contracts + docs/api; root owns npm lock |
| P01 native | RN generated android/ios → test screens | Mobile worker owns only apps/mobile; no Expo runtime/import/package |
| P02 auth/profile/media | Session/profile DTO → mobile API client | Use brief exact fields; opaque 24h session, demo account A/B/C/D explicit |
| P03 matching | active canonical pair → chat/safety | Atomic unique match; no re-match after ended in core |
| P04 realtime | REST persisted DTO → socket + mobile upsert | message:created, match:ended, match:subscribe; auth at subscribe and every read/write |
| P05 integration | npm scripts + API + native app → clone-run/QA | Root smoke/review; no UI-product approval implied |
| P06–P11 | core + phase-specific decisions → expanded roadmap | Remain pending until actually implemented/tested; no invented provider success |

## Current state

- Docs worker: assigned CLI migration.
- Backend worker: pending core brief dispatch.
- Mobile worker: pending core brief dispatch.
- Root: foundation tooling, dependency integration, native build/QA and independent review.

## Review policy

Workers self-test bounded changes; independent reviewer checks spec + correctness after integration, including auth/IDOR/transaction/retry/revocation. Root verifies commands against current files before marking tasks complete. Evidence in docs/qa and docs/handoff.
