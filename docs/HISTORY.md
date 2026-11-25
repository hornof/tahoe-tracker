# tahoe-tracker: how it was built

The history of this project, one entry per stage, oldest first. A newcomer should be able to read it in five minutes and understand why the project looks the way it does. The PRs hold the details; this file holds the turning points.

What's worth writing down:
- **Decisions and why.** What was chosen, what was turned down, and the reason.
- **Surprises.** What turned out harder, easier or different than expected.
- **Mistakes and the fix.** What went wrong, and the rule added so it doesn't happen again.
- **Changes of mind.** A feature that moved to later, a requirement that was dropped.

What isn't: routine progress ("wrote tests, they pass"), anything the board or the PR list already shows.


## 2026-11-22: Setup
- Repo and board created. PRD input: https://github.com/hornof/tahoe-tracker/issues/1.

## 2026-11-22: PRD approved (gate 1)
- Two spikes answered the real questions: the resorts' cams (all from one provider) embed live on another site, and the snow numbers and forecast sit as data in the resorts' own pages.
- The first PRD drafts grew far past what Luke asked for (a 72-hour figure he never wanted, lifts, temperature, a terms analysis), and review decisions were written in as defaults he never saw. Luke cut it back to his own list; the lesson is to ask, keep it short, and never let a default stand in for his answer.
- Luke chose live cams and, from a clickable mockup, the layout: one live cam per resort, click through to all of that resort's cams.
- Data fetching moved from an hourly GitHub commit to a Cloudflare Worker idea, to be settled in the TDD.

## 2026-11-23: TDD approved (gate 2)
- A plain static page on Cloudflare Pages, live Brownrice players, and a Cloudflare Worker for the snow numbers, chosen by Luke over an hourly GitHub Action that would have committed every hour.
- Luke chose clickable players everywhere, with a button next to each cam to navigate, and saved numbers shown instantly with a background refresh.
- The first build piece checks the biggest risk before anything else: whether Vail lets Cloudflare's servers fetch its pages.

## 2026-11-23: Build and live
- Live at https://tahoe-tracker.hornof.org: the ten Brownrice cams in Luke's layout (one per resort on home, click through to all of a resort's cams), with each resort's snow numbers and 5-day forecast from a Cloudflare Worker.
- Four cards, PRs #17–#20. The first proved early that Vail lets Cloudflare's servers fetch its pages, so the GitHub Action fallback was never needed.
- Luke decided along the way: "stale" when the last fetch failed and the copy is over 6 hours old; retry after 10 minutes; the big cam capped so the tile row fits on a laptop.

## 2026-11-24: Feedback round one (card #22, PR #23)
- New intro text, Mid Mountain as Northstar's default cam, and the update times moved behind an "i" button.
- The resort view became "layout 2", chosen by Luke with a size explorer on the canvas: big cam beside a numbers box of the same height, the other cams in a centered row below. It scales with the window, stops growing at the title bar's width, and stacks below 1000 px. The numbers box scrolls if its text doesn't fit, and big snow totals get smaller text where needed.
- This replaced card #15's "tile row fits on screen" rule. The first try kept that rule over the approved mockup, which led to the project rule "What Luke has agreed is the spec" (PR #24).
