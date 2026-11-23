# TDD — tahoe-tracker   (status: APPROVED by Luke, 2026-11-23)

From the approved [PRD](PRD.md). TDD issue: [#7](https://github.com/hornof/tahoe-tracker/issues/7).

## Stack & architecture
- **The page:** plain HTML, CSS and JavaScript, no framework and no build step, in `site/`. Layout as in the PRD's clickable mockup: home shows one live cam per resort with its numbers and forecast; tabs switch resorts or go home. The live players stay clickable everywhere (play, pause), so clicking a cam always does the same thing; a label or button next to each cam opens its resort, or makes a tile the big one (Luke, 2026-11-22, review Decision 12).
- **The cams:** `site/cams.json` lists the ten cams (resort, name, Brownrice id). Each plays in an `<iframe src="https://player.brownrice.com/embed/<id>">`. A cam is "down" when its still (`player.brownrice.com/snapshot/<id>`) fails to load; then its spot shows a placeholder saying "not available" with a link to the resort's cams page. Only these two Brownrice URLs are used ([webcams spike](spikes/webcams.md)).
- **The snow numbers:** a Cloudflare Worker (a Pages Function at `/api/snow`, decided by Luke on #7). It fetches the three resorts' snow-report pages with an honest user agent, reads `FR.snowReportData` and `FR.forecasts`, and returns 24 h, 48 h, 7 days, base, season total, update time and the 5-day forecast as JSON. It stores the last good result per resort in Workers KV and always answers from that copy at once; when the copy is over an hour old, it also refreshes it in the background (`ctx.waitUntil`), so the page never waits on Vail (Luke, 2026-11-22). After a failed fetch, the Worker tries again after 10 minutes, not an hour (Luke, 2026-11-23, PR #18 Decision 4). Details: [snow spike](spikes/snow-report-data.md).
- **Stale and broken:** a resort whose fetch fails keeps its last good numbers; if those are over 6 hours old the page says "stale"; with none at all it says "not available" and links to the resort.
- **Hosting:** Cloudflare Pages at tahoe-tracker.hornof.org, from this repo. Main deploys; each PR gets a preview URL.
- **Stores:** the cam list is a file in the repo; the snow numbers live in Workers KV. Nothing else is stored.
- **Cost:** $0. About 72 KV writes a day (three resorts, hourly) against a free limit of 1,000.

## Test plan
| PRD requirement | Test |
|---|---|
| 1. Snow numbers | Unit: the parser reads saved copies of all three resort pages and returns the five numbers and update time. Unit: the Worker with fetch mocked returns them as JSON. |
| 2. Forecast | Unit: the parser returns five days of high, low and snow from the saved pages. |
| 3. Cams | Browser: home shows three live cam players, one per resort, each with its name; the label or button next to a cam opens that resort's cams; the one next to a tile makes it the big one; tabs switch resorts and go home. Browser: a cam whose still is made to fail shows "not available" and the resort link. Live, after each deploy: each cam's snapshot URL returns 200 image/jpeg and each embed URL returns 200. |
| 4. Fetch | Unit: the Worker answers from KV at once, and starts a background refresh only when KV's copy is over an hour old. Live, after each deploy (the orchestrator's post-merge check): `/api/snow` returns numbers for all three resorts. |
| 5. Broken shows as broken | Unit: one resort's fetch fails; the other two are unaffected, and the failed one gets "stale" after 6 hours or "not available" with no data. Browser: the page shows those words, and a failed cam shows "not available" with its link. |
| Numbers on the page (piece 4) | Browser, with `/api/snow` stubbed: the home view and each resort view show that resort's five numbers, update time and forecast. |
| 6. Laptop first; iPhone nice-to-have | Browser: no overlap or sideways scroll at 1280 and 1920 px; stacked at 390 px. |

- **Width-dependent tests:** only requirement 6's layout tests. They run at 1280, 1920 and 390 px; everything else runs at 1280 px.
- **Tools:** unit tests with Node's built-in test runner (`node --test`, no packages); browser tests with Playwright, with the Brownrice player stubbed so tests don't depend on live video.
- **Time limits:** `node --test --test-timeout=10000`; Playwright's per-test timeout of 30 s; every fetch in the Worker uses `AbortSignal.timeout(10000)`.

## Work pieces
1. **Skeleton and the Akamai check.** A placeholder page live at tahoe-tracker.hornof.org, CI running, and a first `/api/snow` that fetches Northstar's page from Cloudflare and returns its 24 h number. This proves the biggest risk early: whether Vail lets Cloudflare's servers through. Needs: Luke's one-time Cloudflare setup (Risks). *Luke looks at:* the preview link shows the page, and `/api/snow` shows a number.
2. **Snow data.** The parser for all three resorts plus the forecast, KV storage, the hourly rule, stale and not-available. Needs: 1. Can be built at the same time as 3. *Luke looks at:* `/api/snow` on the preview shows all three resorts.
3. **Cams page.** `cams.json`, the layout from the mockup, live players, the resort view and tabs, the placeholder. Needs: 1. Can be built at the same time as 2. **Early look.** *Luke looks at:* the preview link; click through the resorts.
4. **Numbers on the page.** Show `/api/snow` in the layout, with the stale and not-available words. Needs: 2 and 3. **Early look.** *Luke looks at:* the preview link; numbers and forecasts under each resort.

## Risks
- **Vail blocks Cloudflare's servers.** Piece 1 finds out before anything else is built. Fallback: run the same fetch from a GitHub Action that stores the result in KV through Cloudflare's API (no commits).
- **Brownrice turns on its per-site check.** The player would show its own "not allowed" message instead of video, and the page can't detect that from outside the player. Fix then: show stills instead for that cam (the snapshot URL).
- **Live players pause after 10 minutes** (Brownrice's own setting, from the webcams spike). A click or a reload resumes them.
- **Vail changes its pages.** The parser stops finding the data; the page shows "stale", then "not available". The saved-page unit tests show what changed.
- **One-time setup needs Luke:** connecting the repo to Cloudflare Pages, adding the subdomain, and creating the KV namespace bound to both production and preview are clicks in Cloudflare's dashboard. Without the preview binding, `/api/snow` fails on PR previews.
