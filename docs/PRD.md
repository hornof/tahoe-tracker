# PRD — tahoe-tracker   (status: APPROVED by Luke, 2026-11-22, revision 2)

Source: PRD input [#1](https://github.com/hornof/tahoe-tracker/issues/1) and Luke's review of this PR (2026-11-22). PRD issue: [#5](https://github.com/hornof/tahoe-tracker/issues/5).
Supporting files: [spike: webcams](spikes/webcams.md) · [spike: snow-report data](spikes/snow-report-data.md)

## 1. What & why
One web page with the webcams, snow reports and forecasts of Northstar, Heavenly and Kirkwood, so Luke can see conditions at all three without opening three resort sites. For Luke's own use, maybe for the next few weeks until the resorts are fully open; a couple of friends may look too.

## 2. Goals and how we'll know
| Goal | Measure |
|---|---|
| All three resorts on one page | One page load at 1440 px shows every resort's numbers, forecast and cams, with no clicks |
| Quick to build, nothing to run | $0 a month; Luke does nothing day to day |

## 3. Who it's for
Luke, on a laptop. Friends he sends the link to.

## 4. User journeys
1. Open tahoe-tracker.hornof.org: one live cam per resort, each with its snow numbers and forecast.
2. Click a resort's cam: see all of that resort's cams, one big and the rest as tiles; click a tile to make it the big one.
3. Use the tabs at the top to switch resorts or go back to all three.

## 5. Requirements
Nothing here is a hard must-have (PRD input); this is the first build.
1. **Snow numbers:** for each resort, what its own snow report shows: 24 h, 48 h and 7-day snowfall, base depth, season total, and the report's update time. *Check: the numbers match each resort's snow report at the time of the last fetch, compared for all three on one day.*
2. **Forecast:** for each resort, the next 5 days' high, low and expected snowfall, from the same resort page. *Check: matches the forecast on each resort's snow-report page.*
3. **Cams:** live, laid out as in the [clickable mockup](https://claude.ai/artifact/48pVZCLC6X9PQEdoVRSQza#play-Live): the home view shows one live cam per resort; clicking one shows all of that resort's cams (Northstar 4, Heavenly 4, Kirkwood 2), one big and the rest as tiles; tabs switch resorts or return home. If a cam is down, its spot shows a placeholder. *Check: every cam can be reached and plays live with its name; a cam made to fail shows the placeholder.*
4. **Fetch:** a Cloudflare Worker reads the resort pages at most once an hour and serves the numbers the page shows (Luke's choice on [#7](https://github.com/hornof/tahoe-tracker/issues/7)). *Check: the update time on the page is never more than about an hour behind the resort's report.*
5. **Broken shows as broken:** if a fetch fails or a cam image won't load, that resort or cam says "not available" and links to the resort's page; numbers our fetch hasn't refreshed in 6 hours say "stale". *Check: with one resort's fetch made to fail in a test, it shows "not available" and the other two are unaffected.*
6. **Laptop first; iPhone nice-to-have.** *Check: works at 1280 and 1920 px wide. At 390 px the resorts stack in one column if that's easy; not a blocker.*

## 6. Design and UX
**Mockups:** [Claude Design canvas](https://claude.ai/artifact/48pVZCLC6X9PQEdoVRSQza) (private to Luke); described in [`mockups/`](mockups/README.md).

| Screen | What it shows |
|---|---|
| Live cams, clickable (the chosen layout) | Home: one live cam per resort with its numbers and forecast. Click a cam: that resort's cams, one big plus tiles, with its numbers beside. Tabs switch resorts or go home. Details still to refine. |
| Laptop and iPhone, 1440 / 390 px | Earlier static drafts; superseded by the clickable layout. |

**Look:** plain and dense: big numbers, small labels, muted times. **Accessibility:** cams have text labels; "stale" and "not available" are words, not just grey.

## 7. Content
- **Numbers and forecast:** the resorts' own snow-report pages carry them as data in the page, the same way on all three sites, so one small parser reads all three. Forecasts are numbers (highs, lows, inches of snow), not icons to scrape. [Spike](spikes/snow-report-data.md).
- **Cams:** all ten come from one provider, Brownrice, whose stills and live players load straight into another site's page. No server needed. [Spike](spikes/webcams.md).

## 8. Hosting and sharing
tahoe-tracker.hornof.org on Luke's Cloudflare account, next to his other projects. Anyone with the link can open it; no login. $0.

## 9. Not in this build
Hope Valley cam and weather, lift status, current temperature, road conditions. Each is a small add later.

## 10. Risks and assumptions
- Vail or Brownrice changes its pages: the fetch or a cam breaks, and requirement 5 makes it visible. Likely a few times a season.
- Untested: whether Vail lets Cloudflare's servers fetch its pages (it lets a home connection through). The first build card checks this before anything else; the fallback is a GitHub Action.

## 11. Technical uncertainties
1. **Can the cams be shown on another site?** Yes, live or as stills. [Spike](spikes/webcams.md).
2. **Where do the snow numbers come from?** The resorts' own pages; one parser for all three. [Spike](spikes/snow-report-data.md). Fetching from Cloudflare's servers is untested (section 10).

## 12. Decisions so far
| Question | Decision |
|---|---|
| Which numbers? | What the resort shows: 24 h, 48 h, 7 days, base, season total (Luke, review). No 72 h. |
| Forecast? | Yes: 5-day highs, lows and snow (Luke, review). |
| How often to fetch? | Once an hour (Luke, review). |
| What fetches the numbers? | A Cloudflare Worker, not an hourly GitHub Action (Luke, 2026-11-22, on [#7](https://github.com/hornof/tahoe-tracker/issues/7)). |
| Hope Valley? | Later (Luke, PRD input and review). |
| Terms of use? | Personal use; no special handling (Luke, review). |
| Cams: stills or all live? | All live (Luke, 2026-11-22, review Decision 16). |
| Page layout? | The clickable mockup: one live cam per resort, click to see all of that resort's cams, tabs to switch or go home. Details to refine (Luke, 2026-11-22). |
| When is data "stale"? | Only when our fetch has failed for over 6 hours (Luke, 2026-11-22, review Decision 17). |

## 13. Open questions
None.
