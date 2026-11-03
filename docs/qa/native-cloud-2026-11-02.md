# Native Android + Cloud Firestore evidence — 02/11/2026

**Window:** approximately 02:36–02:50 Asia/Saigon. This is a bounded native smoke on one Android emulator with HTTP companion calls, not full FE-product acceptance.

## Environment

- `npm run doctor`: all checks reported OK.
- Device: `Pixel_9` / `emulator-5554`, Android 16, x86_64; JDK 21.0.6.
- `npm run demo` ran API on port 3000 and Metro on 8081 in cloud mode, project `app-cuoi-ky-2d653`, namespace `app-cuoi-ky`.
- Android build: `BUILD SUCCESSFUL` in 18 seconds; installed to one device as `com.gapmobile`.

## Observed flow

| Check | Result |
|---|---|
| Native login/profile | A logged in. Authenticated profile and image loaded. A edited bio in the app, saved, and HTTP read-back matched `Ho so demo hu cau. Kiem thu cloud tren Pixel 9.` |
| Match | Native A liked B. Separate synthetic HTTP B liked A. Match created with ID `bad73133-9150-5e41-a9c3-38752b2cc809`. |
| Chat | Native A sent text. HTTP B read history and replied; native A received the reply without manual reload. |
| Access denial | HTTP C chat-history read was denied with 404. |
| Account switch | Native A logged out; B logged in. B profile was shown, A bio was not visible, and opening B chat showed a blank composer. |
| App restart | Force-stop/start restored B session while API stayed online. |
| API process restart | A watch-triggered restart after changing only `server.ts` mtime (no content edit) changed PID `11556` → `46504`. Health returned 200 with the expected cloud project. Existing sessions remained usable; A profile and two messages persisted. Native B reconnected, opened A chat and saw history; A’s third HTTP message appeared to native B without reload. |
| Cloud unmatch/socket revocation | Native B opened D chat; HTTP D unmatch ended the match without deleting its document. B read/send were then denied (403), and native chat closed immediately with an alert. The first run displayed duplicate alerts from post-commit and Firestore-listener end events; after the synchronous active-chat ref fix, a fresh B/C regression (`cd035b1e-92e1-5e68-94df-1800b20e5550`) showed one alert and closed after one OK. B/D match `74769164-27fe-56c1-86dc-126b1e3380be`; A/B remains active. No documents were deleted/reset. |
| Runtime logs | Filtered current logcat showed no crash or JavaScript error. |

Screenshots: [native cloud chat](native-cloud-chat-2026-11-02.png), [native cloud unmatch](native-cloud-unmatch-2026-11-02.png).

Mobile typecheck/lint passed and `npm run test:mobile` passed (3 suites, 20/20). The alert regression was verified manually before/after; no automated alert-specific test was added.

## Limits and observations

- One Android emulator plus HTTP companion client; not two Android devices.
- Keyboard was in Gboard floating stylus mode. This does not establish full software-keyboard/IME coverage.
- GPS, camera/gallery permissions, TalkBack, full native permissions, and FE-product visual/accessibility acceptance were not tested.
- A newly received message was persisted and displayed, but the chat view did not auto-scroll to it; tester scrolled manually to see the third message.
- Earlier startup offline/revoked-session restoration concern was static code review only in this run, not a reproduced device bug.

This evidence complements, but does not broaden, [cloud setup/HTTP smoke evidence](cloud-setup-2026-11-02.md). It does not imply all P01–P05 acceptance, all 37 functions, two-device realtime, full permissions/accessibility, or FE-product approval.
