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

## TDD, 2026-11-23

### What worked (Claude)
- **Short.** The TDD fit on one page: stack, a test per PRD requirement, four build pieces.
- **Questions one at a time, in chat.** The reviewer's questions came to Luke as short (a)/(b) choices with a recommendation. Three decisions (Worker, how clicking a cam works, saved numbers shown instantly) took a few minutes.
- **The reviewer earned its keep.** It caught a real design bug: a live player takes every click, so "click a cam to open its resort" couldn't work as drawn. Luke's choice (b) fixed it before any code.
- **Decisions were recorded where they belong:** in the TDD, the PRD's decisions table, and a short note on the PR.
- **The riskiest unknown goes first.** Build piece 1 checks whether Vail lets Cloudflare fetch its pages before anything else is built.

### What didn't work (Claude)
- **A re-asked question.** Luke had already agreed hourly commits were bad, but hadn't said "Worker" outright, so Claude asked again. He reasonably asked "didn't we already go over this?"
- **The approved PRD was out of date.** It still said "GitHub Action" after Luke chose the Worker, so it needed edits after approval. Recording a decision should update every doc that mentions it at the same time.
- **Hook busywork again.** End-of-turn checks forced a board move, PR and card assignees, a status line on each review fix, and a "no action" reply for each reviewer note before the merge could be asked for. Each one cost a round and meant nothing to Luke.
- **Small calls made without Luke.** To satisfy that last check, Claude closed reviewer notes 7, 10 and 11 as "no action" on its own judgment. They were minor, but Luke wasn't asked.
- **Watcher noise.** Most of its alerts were about Claude's own comments.

### Luke's take
- **Overall:** the TDD phase went great. Fast, only a couple of simple questions, and done. A much more pleasant experience than the PRD phase.
- **The re-asked Worker question:** fine, not a big deal.
- **The approved PRD still saying "GitHub Action":** he didn't catch it; he thought they'd agreed on the Cloudflare Worker.
- **Hook busywork and watcher noise:** he didn't notice either. It cost Claude rounds, not Luke's attention.
- **Minor reviewer notes closed without him:** good. If Claude can handle something on its own, all the better; the reviewer finding minor things is a good sign.

### Takeaway
What made this stage pleasant: one short doc, a few simple questions one at a time, and Claude handling the small stuff itself. Ask Luke only what needs him.

## Setup: CI and Cloudflare, 2026-11-23

### What worked (Luke)
- **Clear, easy-to-follow Cloudflare instructions.** That saved a ton of time. When small mistakes came up, which they always will, they got worked through together quickly.
- **No more bizarre, contradictory answers out of nowhere.** Plain, consistent replies kept things moving.

### What worked (Claude)
- Short numbered click steps, one part at a time, with the exact values to type.
- Looking at Luke's screen directly instead of asking for screenshots.
- Checking each result (the preview link, the live site) before moving on, and saying up front when a failure was expected (the first deploy before `site/` existed).

### What didn't work (Claude)
- **A stale menu path.** "Workers & Pages" had moved under Compute, and the Pages option sat behind a "Continue to Pages" link. Luke's corrected path is saved for next time.
- **A long detour about sessions.** Claude kept recommending a fresh session with reasons that argued the opposite, and called its own suggestion a "rule". Luke chose to stay in this session.

### Noted for later (Luke)
- **The progress page needs a lot of work.** Luke understands every piece on it, but the layout is hard to read and he can't get useful information from it. It comes from apb's `scripts/progress-page.py`, so the redesign belongs to apb.
- **What it used to look like, and should again (Luke).** The sketch-gallery map had a "Now:" line and one box per stage, each marked Done or Now, with the current stage filled in. apb commit af1c43b ("Map: no copied status", 2026-11-15) removed both, and the progress page copied the plain list. The "3 of 3 board items in Done" bar is misleading too: it counts only the cards on the board, so it reads 100% after planning.

## Build, 2026-11-23

### What worked (Claude)
- **Riskiest thing first.** Card #13 answered the big unknown, whether Vail lets Cloudflare's servers fetch its pages, in about 5 minutes. It did.
- **Parallel builders.** Cards #14 (snow data) and #15 (cams page) were built at the same time, each in its own worktree. Each card took 5–12 minutes to build.
- **Early looks.** Luke saw the cams page and the numbers on previews before review, and liked them.
- **Questions one at a time.** Four decisions (stale rule, retry timing, big-cam height, click behaviour) came to Luke as short (a)/(b) choices; each took a minute.
- **The reviewer caught real things:** a load error that covered the whole page, missing dates on fetch times, wrong test counts. Its spot checks matched every number against the resorts' own pages.
- **Tests that bite.** Deliberate-bug checks on cards #14, #15 and #16 caught every planted bug except one, which then got its own test.

### What didn't work (Claude)
- **A merge conflict nobody saw.** Cards #14 and #15 both added a line to `LOG.md`. After #14 merged, #15's PR quietly stopped running its tests, because GitHub doesn't run them on a conflicting PR. It was caught only because the checks never appeared.
- **Interruptions.** One builder stopped on a temporary API error, and a safety check failed transiently twice. Both were resumed, but each cost a few minutes.
- **Builders departing from their rules.** One wrote a helper before its tests; one ran an extra check unasked. Both were put right, but each needed a round.
- **Hook busywork.** Assignees, card moves and "no action" replies on every reviewer note, before every hand-off.

## Feedback round one (card #22, PR #23), 2026-11-24

### What worked
- **The workshop.** All five feedback items were agreed in chat, in Luke's own words, before any build started.
- **The size explorer.** Sliders on the canvas let Luke try cam and panel sizes against the bottom of his screen. He found layout 2 in a few minutes and approved it on sight.
- **Short questions.** Decision 6, rewritten as one plain question, one line of why and two short options, was "super easy to follow". That's now the format for every question.
- **Builders who stop.** Twice the builder stopped on a conflict with what Luke had agreed instead of choosing for him, which led to Decisions 6–9.

### What didn't work
- **The first layout ignored the mockup.** The brief kept an older "tile row fits on screen" rule over the approved mockup. Fix: the project rule "What Luke has agreed is the spec" (PR #24).
- **Designed for one screen.** The size explorer used fixed pixels for a 1280 × 800 laptop (Luke's is about 1440 × 785), and nobody said up front that other widths would need their own answers. That surfaced at the end as four more decisions.
- **Hard-to-read questions.** "Phone layout" for laptop windows, undefined terms ("the content", "1440"), pixel math in the question. Luke had to ask for rewrites, and a rewrite done in place without a reply left him looking for an answer.
- **A missed test failure.** The full test run failed at 3:08 and nobody told Luke until he asked at 3:35.
- **Mac vs Linux.** Tests passed on the builder's Mac and failed on GitHub's Linux twice: once a real layout problem (big snow totals), once a test that measured too early.

### Try next time
- When a design starts at one screen size, say at the start which other sizes it must handle, and ask those questions while designing.
- Check every CI result when it finishes, not when asked.

## The whole project

### How long it took
From apb's event log and GitHub, Pacific time:
- **Wall time:** about 12 hours, 7:44 pm Sunday to 7:49 am Monday (the last merge).
- **Break:** Luke's last message before it was at 2:41 am; he was back at 7:49 am. Only the watcher ran in between (5 hours).
- **Hands-on:** about 7 hours.

| Stage | Time, approx. | Notes |
|---|---|---|
| Setup (repo, board, accounts) | 15 min | 7:44–7:58 pm |
| Detour: apb PR #185 and the coordination issue | 1 h | includes a 30-minute pause |
| PRD | 2 h | most of it the rough patch (extra content, defaulted decisions) |
| TDD | 40 min | smooth |
| Setup: CI and Cloudflare | 1¼ h | about 30 minutes of it the fresh-session detour and the progress page |
| Build, 4 cards | 1¼ h | 1:21–2:39 am; the last merge waited for the morning |

About 2–2½ of the 7 hours went to detours rather than the product. For comparison, sketch-gallery took about 7 days, with many more interruptions. Luke is happy with the turnaround.

### Rabbit holes (Luke)
When Claude made mistakes or Luke got confused, Luke paused the real work to understand why they'd got out of sync. That turned into yak shaving that fed his frustration. The worst was the fresh-session suggestion, with reasons that argued the opposite: 30–60 minutes that a plain "no" would have saved. An earlier detour filled the chat with the very back-and-forth the fresh session was meant to escape.

He still wants a way to give feedback and fix mistakes, just not mid-work.

**Try next time:** Luke says **"park it"**. Claude adds one line under "Parked" below, answers what's needed in one line, and goes back to the work. Parked items get investigated at the retrospective. "Reread CLAUDE.md" stays as the reset, and "no" to a Claude suggestion is always enough.

### Parked
- (none yet)

### To do: review apb's hook rules together (Luke)
The end-of-turn hook rules in apb (`hooks/apb-stop.py`, `scripts/consistency-check.py`) are too specific. Each seems to have been added after one incident, perhaps from a "make sure this never happens again" whose wording Luke never saw. They encode the instance, not the principle (see Luke's guiding principles on the right level of abstraction), so they fire when a rule is broken on paper but not in spirit. Examples from this project:
- a decision link demanded for an ordinary chat question;
- deleting the notes that recorded Luke's decisions;
- a "no action" reply required for every reviewer note;
- assign and unassign churn.

Luke wants to go over them with Claude, read the actual text, and rewrite them at the right level.
