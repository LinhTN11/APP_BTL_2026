# Independent bounded core review — P01–P05

Date: 2026-11-01 (Asia/Saigon). Reviewer: `core_review_finish`. Scope: T00.03, T01.02/T01.03, T02.01–T04.03 and T05.01 FE-test; F01–F10 plus basic F22/F24. Reference implementation: `6daf434` against `4a687a4`, with current working-tree integration visible during review. Source was read-only; this report is the reviewer's only write. No commit, push, deploy, provider call, real-data reset or new subagent.

## Verdict at review time

No new P0/P1 defect was found in this bounded pass. One P2 configuration defect is listed below. This is a local core-demo assessment, conditional on integrator verification of the separately assigned mobile corrections and native flows; it is not production readiness or FE-product approval.

## Findings

### P2 — API ignores the advertised HOST binding

- Location: `apps/api/src/server.ts:3`; configuration is exposed by `.env.example:3` and `scripts/common.mjs:36`.
- Reproduction: set `HOST=127.0.0.1` in the shell or `.env.local`, then launch the API through the root demo launcher. The launcher passes that environment value, but `server.ts` always calls `listen({host: "0.0.0.0", ...})`, so the API remains reachable on all interfaces rather than the requested loopback interface.
- Impact: a developer cannot restrict this demo API to loopback through its advertised configuration. This matters because demo sessions are intentionally unauthenticated and the server permits profile/chat mutations after obtaining one. The documented default remains a trusted-LAN demo; this finding does not challenge that default.
- Suggested correction: use `process.env.HOST ?? "0.0.0.0"` and verify the resulting listening address for an explicit loopback configuration. Reported to the integrator; this reviewer did not edit source or claim the correction passed.

## Coverage and standards assessment

Read `AGENTS.md`, docs index, AI/subagent ownership rules, core brief, API/data contract, backend report and mobile report. Compared the implementation with the contract and reviewed source boundaries for:

- OTP request limits, expiry, attempts, one-time consumption, opaque session hashing, revocation and DEMO_MODE=false provider behavior. Authenticated actor identity comes from the server session; live-off routes do not silently issue demo credentials.
- Parameterized SQL, synchronous SQLite transaction boundaries, canonical match uniqueness, ended-pair rejection and sender-wide retry-message uniqueness/content conflict handling. Membership and active status are checked before REST history/send; monotonic message timestamps preserve cursor ordering.
- Two-way block visibility, room removal and match-ended notifications; session logout/expiry disconnects; third-user socket subscription denial. Public discovery profile media is intentionally authenticated and visible to eligible outsiders. Private selfie storage has no public read route; chat access remains restricted to active match members.
- Public/own DTO separation, server age/date validation, consented private location, discovery exclusions/filter metadata, media ownership/order/quota and write-failure cleanup. Unsupported video and live providers are explicitly unavailable and were not counted as implementation defects.
- Root setup/demo/android process supervision, workspace cwd, absolute default data directory, Windows npm launch without shell interpolation, port checks and adb reverse. No additional source blocker was established in these paths.
- Mobile secure-session serialization, old-session 401 guard, workspace teardown, chronological REST reload/upsert, ended-room tombstones and user-visible retry handling. React Native CLI implementation is present; archived Expo skill files are provenance rather than runtime dependencies.

No additional hard documented-standard violation was established beyond the HOST mismatch. The review intentionally does not report formatter/type-system-enforced style issues or speculative abstractions as defects.

## Corrections already owned elsewhere

The integrator assigned a mobile worker to handle keyboard/composer sizing, edits made while profile save is pending, Discover safety/swipe card-advance races, and removal of ended-room pending retry bodies. Those items were not duplicated here. Their completion requires the worker's actual diff and appropriate verification; this report does not assert that those changes passed.

## Evidence and limits

- This pass inspected the source and diff/file inventory; it did not repeat the full test suite or native build. Existing evidence supplied by the integrator was unified verification (API 6 + mobile 15 tests), Android debug build, and clean-clone npm-ci/smoke/typecheck. Backend/mobile report claims are attributed to their authors, not independent reruns by this reviewer.
- Actual Android/two-client interaction QA, keyboard behavior, picker and GPS permission paths, font scaling/TalkBack, process-tree shutdown on this device and final handoff evidence remain the integrator's responsibility. iOS, release signing, live providers, production scaling/security review and advanced phases were outside this pass.
- Nonblocking future-mode edge: a fresh `demoMode:false` database creates `dataDir` but `dataDir/media` is currently created only by `seedDemo` (`apps/api/src/db/database.ts:26,45` and the seed function). If a user/session is later provisioned without demo seeding, image upload's `writeFile` would fail for that missing directory. There is no live onboarding in the authorized core, so this was reported as a future-mode initialization limit rather than a core-demo blocker. Initialize the storage directory independently before enabling that mode for real users.
- Large-dataset efficiency, arbitrary deployment/network conditions and exhaustive adversarial testing were not covered. No dependency advisory was promoted to a source blocker without an established affected runtime path.

Summary: standards axis — one P2 advertised-config mismatch; spec/core acceptance axis — no additional P0/P1 defect established in the inspected paths, with separately owned mobile corrections and native acceptance verification still required.
