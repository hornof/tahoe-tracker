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
