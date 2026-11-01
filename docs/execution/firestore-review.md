# Firestore integration review and disposition

01/11/2026. Integrator summary of the bounded independent source review and subsequent fixes; not a production security audit.

Reviewed surfaces: `src/firestore` transactions, API hooks, mode/configuration, socket listeners/lifecycle, session/OTP/media ownership, root startup scripts, rules/indexes. SQL extension source is reference and was not treated as the selected database.

| Finding | Correction | Evidence |
|---|---|---|
| P1: direct factory in emulator mode without host could initialize cloud credentials | Factory validates mode/host combinations before Admin SDK initialization; explicit cloud rejects emulator host; unreadable credential path fails locally | 3 config tests passed, Admin app inventory unchanged on invalid calls |
| P2: disconnect during subscribe awaits could create a listener after cleanup | Closed/connected state checked after each await before listener creation; leave room/return when disconnected | Source reviewed; existing subscription/lifecycle tests pass; no dedicated forced-disconnect-per-await regression |
| P2: logout/expiry/disabled account during slow upload could still commit | Session and account read inside every own-data write transaction; uploaded file removed on rejected transaction | Real HTTP multipart regression across logout/expiry/disable, plus all8 own-data mutation paths |
| UI: fast Send could capture a stale parent draft | Immediate input-event ref used for payload and validated before send | Regression failed with truncated text, then passed; native full-message readback confirmed |
| Windows startup probe could report free despite all-interface listener | Probe localhost connection rather than bind a competing address; preserve PATH casing in child env | Actual listener detected busy, closed port detected free, running API/Metro detected busy |

Final root run: Firestore15/15 pass0skip, typechecks and ESLint pass. Mobile20/20 after the UI-only last fix. Native Android/API Firestore Emulator send/read/reply verified. Firebase project and credentials are not present; cloud IAM, indexes and read/write remain unverified. Single-server socket fanout is the supported demo shape; cross-instance data transactions are tested, multi-server message broadcasting is not supplied.
