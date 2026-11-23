# Build log

One line per iteration: date · what changed · tests (pass/fail count). Append-only; the builder writes it.

- 2026-11-23 · Card #13: first `/api/snow` Pages Function (`functions/api/snow.js`) fetches Northstar with an honest user agent and a 10 s timeout, returns the 24 h number or what Vail sent instead · tests/unit/snow.test.js 13/13 pass; live on the preview from Cloudflare (SJC) returned 0 in, Vail didn't block
- 2026-11-23 · Card #14: `/api/snow` covers all three resorts (five numbers, update text, 5-day forecast) from KV binding `SNOW`, refreshes a copy over 1 h old in the background (10 min retry wait after a failure), "stale" after a failed fetch with the copy over 6 h old, "not-available" with no copy; saved pages in `tests/fixtures/` · tests/unit/snow.test.js 36/36 pass; deliberate-bug check 14/14 caught (after adding a Pacific-date test for the one first missed)
