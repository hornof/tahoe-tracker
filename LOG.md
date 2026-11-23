# Build log

One line per iteration: date · what changed · tests (pass/fail count). Append-only; the builder writes it.

- 2026-11-23 · Card #13: first `/api/snow` Pages Function (`functions/api/snow.js`) fetches Northstar with an honest user agent and a 10 s timeout, returns the 24 h number or what Vail sent instead · tests/unit/snow.test.js 13/13 pass; live on the preview from Cloudflare (SJC) returned 0 in, Vail didn't block
- 2026-11-23 · Card #15: cams page — `site/cams.json` (ten cams), home with one live player per resort, resort view with one big cam plus tiles, tabs and back button via the address bar, "not available" placeholder when a still fails; live check `npm run test:live` · unit 20/20 (6 new); browser 22/22 in CI, every width; live 20/20
- 2026-11-23 · Card #15, review fixes: the cam-list load error no longer covers the header (own class, tabs written in index.html so they stay), the numbers panel checked below the cams at 390 px, "Make big" scrolls the new big cam into view and focuses its name · unit 21/21 (7 new); browser 24/24 locally, every width
