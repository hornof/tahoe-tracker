# PRD — tahoe-tracker   (status: DRAFT, revision 1)

Source: PRD input [#1](https://github.com/hornof/tahoe-tracker/issues/1) (answers and inline replies, 2026-11-22). PRD issue: [#5](https://github.com/hornof/tahoe-tracker/issues/5).
Supporting files: [spike: webcams](spikes/webcams.md) · [spike: snow-report data](spikes/snow-report-data.md)

## 1. What & why
A web page that shows the webcams and snow reports of three Tahoe ski resorts, Northstar, Heavenly and Kirkwood, in one place. Today checking conditions means opening three resort sites and digging through each. The stakeholder is the owner, Luke, who skis on an Epic Pass. A couple of his friends may use it too. It is not a trial run for anyone else.

## 2. Goals and how we'll know
| Goal | Measure |
|---|---|
| See all three resorts at once | From one page load, every resort's cams and snow numbers are on screen at 1440 px wide without clicking anything |
| Faster than the resort sites | Page shows its content within 3 s on a home connection; checking all three resorts takes one page instead of three sites |
| Never mislead | Every cam image and snow number shows when it was last updated; anything older than its limit (section 5) is marked stale |
| Few hiccups to build and run | Hosting costs $0; the owner does nothing day to day; a broken source shows as broken, not as wrong numbers |

## 3. Who it's for
- **The owner (Luke):** checks conditions before deciding whether and where to ski, mostly from a laptop.
- **Friends of the owner:** open a link he shares. No accounts.
- **The owner as admin:** adds or removes a cam or a resort later (Hope Valley is the first planned addition).

## 4. User journeys
**Check conditions (owner or friend)**
1. Open tahoe-tracker.hornof.org.
2. See the three resorts side by side: cams, then new snow, base, lifts open and temperature, each with its update time.
3. Click a cam or a number to open the resort's own page for more.

**Add a cam or a resort (owner, with Claude)**
1. Ask Claude to add, for example, the Hope Valley YouTube cam.
2. Claude adds one entry to the site's list of sources in a PR. The owner merges it.
3. After the merge, the new cam shows on the live page.

## 5. Requirements
Each requirement ends with the check that proves it. Per the PRD input, nothing here is a hard must-have; this is the scope of the first build.

### Visitors
1. **One page, three resorts:** Northstar, Heavenly and Kirkwood each get a column (laptop) with their name, cams and snow numbers. *Check: at 1440 × 900, all three resort names, at least one cam each, and their snow numbers are visible without scrolling sideways.*
2. **Cams:** each resort shows its cams. A cam is live video where the resort allows its player on other sites, otherwise its latest still image. *Check: each cam is labeled with its name and either plays (labeled "live") or shows an image with its time; while the source works, that image is under 15 minutes old.*
3. **Snow numbers:** for each resort, new snow (24 h and the longest period the source gives up to 72 h), base depth, lifts open out of total, and current temperature, where the source has them. *Check: the numbers on the page match the resort's own snow report at the time of the last fetch, compared for all three resorts on one day.*
4. **Update times:** every cam image and every resort's numbers show when they were last updated, in Pacific time. *Check: each has a visible time; stopping the data fetch for longer than the limit makes it show as stale.*
5. **Stale and broken sources:** snow numbers older than 6 hours, or a cam image older than 30 minutes, are greyed out and labeled stale. A source that fails shows "not available" with a link to the resort's page. *Check: with one resort's source made to fail in a test, that resort shows "not available" and the other two are unaffected.*
6. **Links out:** each resort links to its own cams page and snow-report page. *Check: every link opens the right resort page, checked by hand on all six.*
7. **Laptop first:** the layout is designed for a laptop screen. *Check: at 1280 px and 1920 px wide, nothing overlaps or is cut off.*
8. **iPhone, nice-to-have:** if it works on an iPhone too, good. *Check: at 390 px wide the three resorts stack in one column and nothing scrolls sideways. Not a blocker for the first build.*

### Owner (admin)
9. **One list of sources:** the resorts, their cams and their data sources live in one file in the repo. Adding a cam is one entry. *Check: a test PR that adds one cam changes only that file plus its test, and the cam appears after the merge.*
10. **No upkeep:** nothing for the owner to run or pay for day to day. *Check: a week with no action from the owner, and the page still updates.*
11. **Breakage is visible:** when a resort changes its site and the data fetch fails, the owner can see it. *Check: a failed fetch shows on the page (requirement 5) and as a failed run on GitHub.*

## 6. Design and UX
**Mockups:** [Claude Design canvas](https://claude.ai/artifact/48pVZCLC6X9PQEdoVRSQza) (private to the owner until shared), based on layout D in the earlier [mockups artifact](https://claude.ai/artifact/2NoKu58r1PgSDXcE73GFxw). PNGs go in `docs/mockups/` after approval.

| Screen | What it shows |
|---|---|
| Laptop, 1440 px | A table of snow numbers for all three resorts on top, then one column per resort with its cams. Kirkwood shows the stale state; one Heavenly cam shows a failed source. |
| iPhone, 390 px (nice-to-have) | The three resorts stacked: four numbers in a row, then the cams. |
**Look:** plain and dense, like a dashboard: numbers large, labels small, update times muted. Light and dark mode follow the computer's setting.
**Motion:** none beyond what a cam player does itself. Images refresh in place without the page jumping.
**Accessibility:** every cam has a text label; colors pass WCAG AA contrast; stale is shown by a word, not only by grey.
**Things a user never sees:** no logins, no ads, no cookie banner (the page sets no cookies).

## 7. Content
- **Cams:** the resorts' own cams; which ones and how they're shown depends on the [webcams spike](spikes/webcams.md).
- **Snow numbers:** from the source the [snow-report data spike](spikes/snow-report-data.md) recommends, fetched by something outside the page (a scheduled GitHub Action or a Cloudflare Worker), because a browser page can't read another site's content.
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
- **Resorts may forbid reuse** of cams or data in their terms. The spikes check; for a personal page with a few friends the risk is low, but the page links back to each resort.
- **Assumed:** all three resorts share one site design (all Vail Resorts), so one way of reading them covers all three. The snow-report spike confirms or refutes it.
- **Assumed:** hornof.org's DNS is on Cloudflare, so the subdomain is one DNS record.

## 11. Technical uncertainties
1. **Can the resorts' cams be shown live on another site, and if not, as stills no older than a few minutes?** Spike: [webcams](spikes/webcams.md). Answer: *pending*.
2. **Where can each resort's snow numbers come from reliably, without bot protection blocking a server-side fetch?** Spike: [snow-report data](spikes/snow-report-data.md). Answer: *pending*.
3. **Can the Hope Valley YouTube cam be embedded?** Covered by the webcams spike. Answer: *pending*.

## 12. Decisions so far
| Question | Decision |
|---|---|
| Who is it for? | The owner, plus a couple of friends; public link, no login (sections 1, 3, 8). |
| Laptop or phone? | Laptop first; iPhone is a nice-to-have (requirements 7, 8). |
| Which resorts first? | Northstar, Heavenly, Kirkwood; Hope Valley later (section 9). |
| Where does it live? | tahoe-tracker.hornof.org on Cloudflare (section 8). |

## 13. Open questions
1. **Which cams per resort?** Each resort lists several. Recommended: show every cam the resort lists, in the resort's own order, and drop any that is broken more than it works.
2. **How often should snow numbers refresh?** Recommended: every 30 minutes from 5 am to 6 pm Pacific, and every 2 hours overnight. Resorts post their morning report around 5–6 am.
3. **Temperature units and snow units?** Recommended: °F and inches, as the resorts report them.
