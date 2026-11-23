# Build log

One line per iteration: date · what changed · tests (pass/fail count). Append-only; the builder writes it.

- 2026-11-23 · Card #13: first `/api/snow` Pages Function (`functions/api/snow.js`) fetches Northstar with an honest user agent and a 10 s timeout, returns the 24 h number or what Vail sent instead · tests/unit/snow.test.js 13/13 pass; live on the preview from Cloudflare (SJC) returned 0 in, Vail didn't block
- 2026-11-23 · Card #15: cams page — `site/cams.json` (ten cams), home with one live player per resort, resort view with one big cam plus tiles, tabs and back button via the address bar, "not available" placeholder when a still fails; live check `npm run test:live` · unit 7/7 pass; browser 12/12 at 1280, 10/10 @width at 1920 and 390; live 20/20
