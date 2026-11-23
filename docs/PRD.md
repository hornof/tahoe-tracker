# PRD — tahoe-tracker   (status: DRAFT, revision 1)

Source: PRD input [#1](https://github.com/hornof/tahoe-tracker/issues/1) (answers and inline replies, 2026-11-22). PRD issue: [#5](https://github.com/hornof/tahoe-tracker/issues/5).
Supporting files: [spike: webcams](spikes/webcams.md) · [spike: snow-report data](spikes/snow-report-data.md)

## 1. What & why
A web page that shows the webcams and snow reports of three Tahoe ski resorts, Northstar, Heavenly and Kirkwood, in one place. Today checking conditions means opening three resort sites and digging through each. The stakeholder is the owner, Luke, who skis on an Epic Pass. A couple of his friends may use it too.

## 2. Goals and how we'll know
| Goal | Measure |
|---|---|
| See all three resorts at once | From one page load at 1440 px wide, every resort's snow numbers and cams are on the page, with no clicks and no sideways scrolling |
| Faster than the resort sites | Page shows its content within 3 s on a home connection; checking all three resorts takes one page instead of three sites |
| Never mislead | Every snow number shows when the resort last updated it and every cam image when the page fetched it; anything stale or broken is marked (requirement 5) |
| Few hiccups to build and run | Hosting costs $0; the owner does nothing day to day; a broken source shows as broken, not as wrong numbers |

## 3. Who it's for
- **The owner (Luke):** checks conditions before deciding whether and where to ski, mostly from a laptop.
- **Friends of the owner:** open a link he shares. No accounts.
- **The owner as admin:** adds or removes a cam or a resort later (Hope Valley is the first planned addition).

## 4. User journeys
**Check conditions (owner or friend)**
1. Open tahoe-tracker.hornof.org.
2. See the three resorts side by side: cams, then new snow, base, lifts open and temperature, each with its update time.
3. Click a cam to play it live, or a resort's name to open its own snow report.

**Add a cam or a resort (owner, with Claude)**
1. Ask Claude to add, for example, the Hope Valley YouTube cam.
2. Claude adds one entry to the site's list of sources in a PR. The owner merges it.
3. After the merge, the new cam shows on the live page.

## 5. Requirements
Each requirement ends with the check that proves it. Per the PRD input, nothing here is a hard must-have; this is the scope of the first build.

### Visitors
1. **One page, three resorts:** on a laptop, a table across the top shows the snow numbers of Northstar, Heavenly and Kirkwood, one row each; below it, each resort gets a column of its cams. *Check: at 1440 × 900, all three resort names, at least one cam each, and their snow numbers are visible without scrolling sideways.*
2. **Cams:** each resort shows all its cams (Northstar 4, Heavenly 4, Kirkwood 2) as still images that the page reloads every 2 minutes. Clicking a cam opens its live video. ([Spike](spikes/webcams.md): the stills update about every 2 minutes; ten live players at once would need about 15 Mbit/s, so live is one at a time.) *Check: each cam shows its name and an image with the time the page fetched it; after 2 minutes the image reloads; clicking it plays that cam live.*
3. **Snow numbers:** for each resort, new snow overnight, in 24 h, 48 h and 7 days; base depth; lifts open out of total; and current temperature. These are what the resorts publish ([spike](spikes/snow-report-data.md)); there is no 72 h figure (open question 4). *Check: the numbers on the page match the resort's own snow report at the time of the last fetch, compared for all three resorts on one day.*
4. **Update times:** each resort's numbers show the resort's own update time, and each cam image the time the page fetched it, in Pacific time. *Check: each has a visible time; stopping the data fetch for more than 6 hours makes the numbers show as stale.*
5. **Stale and broken sources:** snow numbers older than 6 hours are greyed out and labeled stale. A cam image that fails to load, or a resort whose numbers fail to fetch, shows "not available" with a link to the resort's page. (Brownrice's stills carry no time of their own, so the page shows when it fetched them.) *Check: with one resort's source made to fail in a test, that resort shows "not available" and the other two are unaffected.*
6. **Links out:** each resort links to its own cams page and snow-report page. *Check: every link opens the right resort page, checked by hand on all six.*
7. **Laptop first:** the layout is designed for a laptop screen. *Check: at 1280 px and 1920 px wide, nothing overlaps or is cut off.*
8. **iPhone, nice-to-have:** if it works on an iPhone too, good. On a phone each resort shows four numbers (24 h, base, lifts, temperature); the rest are on the laptop page. *Check: at 390 px wide the three resorts stack in one column and nothing scrolls sideways. Not a blocker for the first build.*

### Owner (admin)
9. **One list of sources:** the resorts, their cams and their data sources live in one file in the repo. Adding a cam is one entry. *Check: a test PR that adds one cam changes only that file plus its test, and the cam appears after the merge.*
10. **No upkeep:** nothing for the owner to run or pay for day to day. *Check: a week with no action from the owner, and the page still updates.*
11. **Breakage is visible:** when a resort changes its site and the data fetch fails, the owner can see it. *Check: a failed fetch shows on the page (requirement 5) and as a failed run on GitHub.*

## 6. Design and UX
**Mockups:** [Claude Design canvas](https://claude.ai/artifact/48pVZCLC6X9PQEdoVRSQza) (private to the owner until shared), based on layout D in the earlier [mockups artifact](https://claude.ai/artifact/2NoKu58r1PgSDXcE73GFxw). PNGs go in `docs/mockups/` after approval.

| Screen | What it shows |
|---|---|
| Laptop, 1440 px | A table of snow numbers for all three resorts on top, then one column per resort with its cam stills. Northstar's Village cam is playing live after a click; Kirkwood's numbers show the stale state; one Heavenly cam shows an image that failed to load. |
| iPhone, 390 px (nice-to-have) | The three resorts stacked: four numbers in a row (24 h, base, lifts, temperature), then the cams. |

**Look:** plain and dense, like a dashboard: numbers large, labels small, update times muted. Light and dark mode follow the computer's setting.
**Motion:** none beyond what a cam player does itself. Images refresh in place without the page jumping.
**Accessibility:** every cam has a text label; colors pass WCAG AA contrast; stale is shown by a word, not only by grey.
**Things a user never sees:** no logins, no ads, no cookie banner (the page sets no cookies).

## 7. Content
- **Cams:** all ten cams on the resorts' cams pages come from one provider, Brownrice. Its still-image and live-player addresses load straight into a page on another site, so the cams need no server. Details: [webcams spike](spikes/webcams.md).
- **Snow numbers:** from the resorts' own snow-report and lift-status pages, which carry the numbers as data in the page, laid out the same way on all three sites. A scheduled GitHub Action fetches the six pages, reads them with one parser, and writes a `data.json` file the page shows. A browser page can't read another site's content, so this runs outside the page. Details: [snow-report data spike](spikes/snow-report-data.md).
- Nothing is stored about visitors.

## 8. Hosting and sharing
- **Address:** tahoe-tracker.hornof.org, on the owner's Cloudflare account.
- **Public**, no login. Anyone with the link can open it.
- **Cost:** $0, within Cloudflare's and GitHub's free tiers.
- **Link preview:** page title "Tahoe Tracker" and a one-line description, so a shared link reads well in a message.
- Options considered: a Claude artifact (can't embed live players or fetch data on its own; mockups A–C), a page on the owner's main site (mixes this into another repo). Chosen: its own subdomain and repo.

## 9. Not in this build
**Non-goals:** forecasts, alerts or notifications, accounts, history or charts of past snow, any resort outside the three.
**Future work:**
- Hope Valley: the Desolation Hotel YouTube cam and Hope Valley weather. Waits until the first three resorts work. Small: one cam entry, plus one weather source.
- Roads: Caltrans chain controls and road cams for I-80, US-50 and CA-88 (mockup A). Small to medium.
- iPhone polish beyond requirement 8. Small.

## 10. Risks and assumptions
- **Resorts change their sites.** Any scraper breaks when Vail changes its pages, likely a few times a season. Mitigated by requirement 5 (broken shows as broken) and 11 (the owner can see it).
- **Resorts' terms.** Vail's robots.txt allows the report pages and its terms say nothing about automated access, but they license content for personal, noncommercial use and forbid posting it on another website. A public page goes beyond that on paper (open question 5).
- **Bot protection.** Vail's sites block requests that pretend to be a browser but answer an honest user agent, and block with a page that still returns status 200. The parser checks for the data, not the status. Fetching from GitHub's servers rather than a home connection is untested; the first build card tries it.
- **One site design for all three.** The snow-report spike confirmed that the three Vail sites carry their data with the same names and fields, so one parser covers all three; a change by Vail likely breaks all three at once.
- **Assumed:** hornof.org's DNS is on Cloudflare, so the subdomain is one DNS record.

## 11. Technical uncertainties
1. **Can the resorts' cams be shown live on another site, and if not, as stills no older than a few minutes?** Spike: [webcams](spikes/webcams.md). Answer: both. Stills load straight from Brownrice and update about every 2 minutes; the live players embed. Brownrice could turn on a per-cam site check at any time, which would stop live embedding; stills would then need a Cloudflare Worker.
2. **Where can each resort's snow numbers come from reliably, without bot protection blocking a server-side fetch?** Spike: [snow-report data](spikes/snow-report-data.md). Answer: from the resorts' own pages, which answer an honest user agent from a home connection; one parser covers all three; no free third-party API covers them. Two things are untested: fetching from GitHub's servers, and lift counts while lifts are running (open question 6).
3. **Can the Hope Valley YouTube cam be embedded?** Spike: [webcams](spikes/webcams.md). Answer: yes; embed it by its channel, since the video changes whenever the stream restarts.

## 12. Decisions so far
| Question | Decision |
|---|---|
| Who is it for? | The owner, plus a couple of friends; public link, no login (sections 1, 3, 8). |
| Laptop or phone? | Laptop first; iPhone is a nice-to-have (requirements 7, 8). |
| Which resorts first? | Northstar, Heavenly, Kirkwood; Hope Valley later (section 9). |
| Where does it live? | tahoe-tracker.hornof.org on Cloudflare (section 8). |
| How are the cams shown? | Stills that reload every 2 minutes; click for live; straight from Brownrice, no server (requirement 2). [Spike](spikes/webcams.md). |
| Where do the snow numbers come from? | The resorts' own pages, read by a scheduled GitHub Action into `data.json` (section 7). [Spike](spikes/snow-report-data.md). |

## 13. Open questions
1. **Which cams per resort?** The resorts list ten in all. Recommended: show all ten, in each resort's own order, and drop any that is broken more than it works.
2. **How often should snow numbers refresh?** Recommended: every 30 minutes from 5 am to 6 pm Pacific, and every 2 hours overnight. Resorts post their morning report around 5–6 am.
3. **Temperature units and snow units?** Recommended: °F and inches, as the resorts report them.
4. **No 72 h snow figure: what instead?** The resorts publish overnight, 24 h, 48 h and 7 days. Options: (a) show those four; (b) build a 72 h total from stored daily 24 h values; (c) use the change in a nearby station's snow depth, labeled as a station reading. Recommended: (a).
5. **Public page, or personal?** Vail's terms license its content for personal use and forbid posting it on another website. Options: (a) public, as the PRD input says; (b) a personal page, marked so search engines skip it, that shows only the numbers and cams and links to each resort, with no Vail text or logos. Recommended: (b). Friends can still open the link. Either way the cams load straight from Brownrice and are never copied to the site, which is the clearer breach the [webcams spike](spikes/webcams.md) flags.
6. **Accept two untested points in the snow data?** The spike fetched from a home connection at night. Untested: (a) whether Vail's bot protection lets GitHub's servers through, and (b) whether lift and run counts read right while lifts are running. Recommended: accept the risk now; the first build card runs one fetch from a real GitHub Action and checks the counts during the day, before anything is built on them. If GitHub is blocked, the fallback is a Cloudflare Worker.
