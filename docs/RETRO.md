# tahoe-tracker: retrospective notes

Kept as we go, for a retrospective at the end of the project. Each stage gets what worked and what didn't. Notes are marked **Luke** or **Claude** by who raised them.

## Setup (new project), 2026-11-22

### What didn't work
- **A PR in another repo, without asking (Claude, raised by Luke).** apb-setup's last step adds the project to a list in the apb repo, so Claude opened hornof/apb#185 there. Luke didn't know work was happening in apb. Its CI failed: a test in apb pinned tahoe-tracker's row to "not in use", so any PR setting it to "in use" broke. The findings went on the coordination issue, then to hornof/apb#186 (filed by the advisor); hornof/apb#185 was closed unmerged.
- **The coordination ticket (Luke).** Luke asked for findings on "the com ticket"; the only one was in the apb repo, and tahoe-tracker had none. That took several rounds to untangle, then a new issue (#3) and a PR (#4) just to name it.
- **The folder check felt odd (Luke).** Setup asked "Setting up in ~/src/claude/tahoe-tracker, is that right?" when that was obviously the folder. Asking made it seem like it wasn't.
- **Hook busywork (Claude).** End-of-turn checks sent replies back over things like PR assignees and the exact wording of a review-fix status ("no commit" was rejected, "no change" passed). Each one cost a round and meant nothing to Luke.
- **Watcher noise (Claude).** The GitHub watcher interrupted with alerts about Claude's own PRs and comments.
- **An unclear author (Claude).** An advisor comment on #3 appeared under Claude's GitHub account, not Luke's, so who wrote what was unclear.

### What worked
- Repo, board, deny list and Claude's GitHub account all set up, and the deny list was tested.

## PRD, 2026-11-22

### What was useful (Luke)
- Knowing the answers to the two simple questions:
  1. Can we embed a live stream? Yes.
  2. Can we scrape the snow info? Yes.
- A cool page layout. About 5 minutes with a clickable mockup produced something Luke is excited about.
- The whole PRD phase could have taken 5–10 minutes, and Luke would have been happy.

### What didn't work (Luke)
- **Doc dumps.** Claude made many docs and a lot of information, then said "go read them". If it's useful, keep it as reference; don't ask Luke to read it. That's AI slop and a waste of time.
- **The hooks.** Hidden plugin checks, Claude explaining them, and Claude getting blocked. A total disaster.
- **Forgetting basic rules in CLAUDE.md.** Another big time sink.

### What didn't work (Claude)
- **Things Luke never asked for:** a 72-hour figure, lifts, temperature, a terms-of-service analysis. Each one then needed review and fixing.
- **Decisions made without Luke.** Review questions were written into the PRD as "defaults" he'd never seen, and stills were chosen over the live cams he asked for.
- **A misread rule, then blame.** "Resolve with no reply" applies only when Luke resolves the thread; Claude read it as "silence means yes", then blamed the process when challenged.
- **Too many questions at once:** eight open decisions in one hand-off. Too much process for a small site.

### Try next time
- Answer Luke's core questions first, in a few lines.
- Show a clickable mockup early.
- One short question at a time; nothing counts as decided until Luke says so.
- Reread CLAUDE.md at each stage boundary.
- When a hook pushes for something Luke didn't ask for, tell him in one line and wait.
