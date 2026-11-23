# tahoe-tracker

A web site that shows some Tahoe ski resorts' webcams and snow reports (e.g. Northstar, Heavenly, Kirkwood) in one place.

Built with the apb process: https://github.com/hornof/apb

## Using it

Open https://tahoe-tracker.hornof.org (live once Cloudflare Pages is connected).

To run it locally: `python3 -m http.server 8788 --directory site`, then open http://127.0.0.1:8788. Tests: `npm ci` and `npx playwright install chromium`, then `npm test` (unit) and `npx playwright test` (browser).

## Files

| File | What it is | Who reads it |
|---|---|---|
| site/ | The web page itself, served as is | anyone |
| tests/ | Unit tests (`tests/unit/`) and browser tests (`tests/browser/`) | Claude, builders |
| .github/workflows/ci.yml | The automatic tests GitHub runs on every PR and on main | Claude |
| docs/MAP.md | Every piece of the project and where it lives. The map artifact is built from it | anyone |
| docs/HISTORY.md | The project's turning points for people, oldest first: decisions, surprises, changes of mind. Start here to learn the project's history | anyone |
| docs/PRD.md | What it does and for whom (written from the PRD input), with any mockups in docs/mockups/ | collaborator, Claude |
| docs/TDD.md | How it's built and tested (written after the PRD is approved) | collaborator, Claude |
| CLAUDE.md | Rules every Claude session follows in this repo | Claude |
| .claude/settings.json | What Claude is allowed to do here, shared by everyone | Claude |
| LOG.md | Claude's record of every build step: what changed and whether tests passed | Claude |
| LESSONS.md | Technical lessons from debugging and testing; each rule they lead to also goes in CLAUDE.md | Claude, builders |

Progress is on the GitHub Projects board, not in this file: https://github.com/users/hornof/projects/10
