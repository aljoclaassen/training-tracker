# Training Tracker Handover

25 October 2026 · @Aljo Claassen · replaces "Powerbuilding App Handover.md" (9 October 2026) as the working brief

## Brief

**One phone app runs both programmes, Heavy Duty (HD) and Powerbuilding (PB), in alternating blocks, works offline, and is shared with friends.** This chat took it from the first powerbuilding build to the current version: a redesigned look, supersets side by side, a calendar where either plan can run longer, strength charts in History, and Powerbuilding predictions. This is a personal project (gym), not BOA Foundation or Cango Wildlife work output.

**Pick up here:** version **2026-10-25.1** is deployed (2026-10-23.2 plus Legs A to Legs B suggestions). The owner's last instruction pattern is: list changes for review, commit only when he says "commit". Ask him to confirm, then deploy it (see "Pending").

### Where things live

| Item | Location |
| --- | --- |
| Live app | https://aljoclaassen.github.io/training-tracker/ (GitHub Pages, works offline via service worker) |
| Repository | `aljoclaassen/training-tracker`, branch `main`. Holds only the built files: `index.html`, `sw.js`, `theme.css`, plus `backups/` and `theme-previews/`. The build sources are **not** in the repo. |
| Build sources and tests | `training-tracker-src-2026-10-25.zip` (attach it to the new chat). Contains `build/`, `hd.json`, all tests, a README with setup steps, and the uncommitted 2026-10-23.2 build. |
| Last deployed commit | `9e3c4cd` "Calendar, History clean-up and powerbuilding predictions" (version 2026-10-23.1) |
| Earlier briefs (project files) | "Powerbuilding App Handover.md" (programme data and original rules; if they disagree with the code, the code and this doc win), "HANDOVER_Heavy_Duty.md", "Training_Plan_Heavy_Duty.docx" |

## Must not break

- **Storage key `heavy-duty-tracker-v1`: never change it.** Other keys: `training-tracker-archive` (12 finished weeks per plan), `training-tracker-theme` `{palette, mode, contrast, v: 3}`.
- Old saves and exports must keep loading. `cycle.lengths` is optional; missing means 2-week blocks.
- Exercise IDs stay stable (HD ids like `d1-1`, PB ids prefixed `pb-`).
- Plain language: "reps left", "estimated max". **Never show RPE, RIR or e1RM** (test t2 checks this).
- WCAG AA in all 5 themes, light and dark, with and without extra contrast. 44px tap targets. Usable from 320px wide with no sideways scroll.
- South African English, UK spelling, dates like "23 October 2026".
- `sw.js` VERSION must equal `config.appVersion`. Bump both on every deploy (format `YYYY-MM-DD.n`).

## How to build, test and deploy

1. Unzip the sources into the scratchpad and follow `README.md`: move the tests up a level, run the `sed` path fix, then `cd build && python3 build.py`.
2. `build.py` reads `hd.json`, `pb.json`, `config.json`, `logic.js`, `display.js`, `shell.html`, `theme.css` (marker `/*{{THEME}}*/`) and `header.txt` (handover notes written into the file). It writes `../training-tracker.html` and `../site-pages/{index.html, sw.js, theme.css}`. `gen_theme.py` regenerates `theme.css` from the 5 palettes.
3. Copy the build to `site/new.html` and run the tests:
   - `t2`–`t13`: regression. `t2` is flaky with an intermittent timeout, so rerun it. `t5` needs a local server: serve `site-pages` copied into `srv/training-tracker/` on port 8765; its reload race is flaky too.
   - `p3/pair.py`: supersets. `p3/overlap.py`: 840 superset layouts, must be 0 problems. `p3/audit.py`: contrast, must be 0 fails (17,973 checks at last run).
   - `p4/cal.py`: calendar. `p4/chart.py`: History charts. `p4/lilley.py`: History and PB predictions. `p4/calshot.py`: screenshots.
   - `sheetfix.py` wraps Playwright so tests close and open the exercise sheet like a person would.
4. Deploy: clone the repo, copy `site-pages/{index.html, sw.js, theme.css}` into it, commit with the attribution lines, push to `main`.

## What the app does now (current state)

**Look (theme v3).** Fitness-app style: large titles, a summary card with a ring and colour-coded metrics, weekday tabs with dots, and a bottom nav (Today, Plans, History). The open exercise is a bottom sheet with a scrim (Escape closes it). The rest timer is a live bar at the bottom, or at the top while a sheet is open. A "Next set" pill button sits above the nav. Five themes: Pulse (default), Dune, Glacier, Forge, Bloom. Older theme names map to new ones (`themeMove`). Weights are moderate (700 for numbers and titles, 600 for labels). Settings has Light, Dark or Match phone, plus Extra contrast.

**Supersets.** An open pair shows both exercises side by side (`.pair-group.is-open`, two columns). After A1 is logged, the partner's set for the same round gets focus with the toast "Set N logged. Now X."; after A2, the rest timer points back to A1's next set. In narrow columns, set rows stack the name above the numbers and steppers put the number above − and +. This was tested at 320–412px and 130% text.

**Swaps.** A swap mirrors the original's set rows. Swaps can be saved to repeat every week ("Do this instead every week"). Holds log seconds plus added weight; carries log metres.

**Calendar (Plans page, top).**
- The cycle is `{start, first, lengths[]}`; blocks alternate plans and `lengths[i]` gives each block's weeks (0 to 12, default 2).
- Both plans add or remove **one week at a time**, from 1 to 12 weeks. Past blocks are locked, and the current block can't end before this week.
- Each block shows an HD or PB badge, a run number, its dates and every week. "Now" and "This week" are marked.
- Each block also has notes on what that plan's rules do across it, a long-run tip (4+ weeks), and a "back after N weeks of the other plan" note.
- Buttons: "Show more blocks", "Switch to X this week" (ends the current block without changing earlier weeks), "Set upcoming blocks to 2 weeks". Today's swap line has a "Change in calendar" link.
- **PB counts its weeks across all PB blocks.** A longer run moves on through block 1 (5 reps), block 2 (4 reps), heavy week, test week, then block 1 again. A run that ends on Week A starts the next run at Week B.
- An empty log is moved to the plan's next week when the schedule changes (`realignSlots`). A week with logged sets is never moved.

**History.**
- Plan toggle (HD or PB), then two tabs: **Progress** (opens first) and **Week log**. Changing a picker keeps it in place on screen.
- **Progress:**
  - The exercise picker sits at the top. Below it is the estimated max with its change since the first week.
  - For PB squat, bench and deadlift, a **Week B check** compares Week B to Week B: 2–5% is on track, with notes for below, above and no rise across 3 checks.
  - Three stacked charts on a shared week axis, never two scales on one chart: **Strength (estimated max)**, **Weight (heaviest set)**, **Reps (on that set)**. Tap, drag or use the arrow keys to read any week. Exercises without weight, carries and timed holds get one chart.
  - "Week by week (n)" is a folded table showing week labels and the estimated max.
- **Week log:**
  - The week picker reads "PB run 3 · Week 1 · 14–20 Dec". Under it, a line gives the full dates, "this week" or "last week", and for PB the programme stage.
  - Totals for days, exercises and working sets.
  - Days are folded: "[PB] Day 1 · Week 1: Heavy Squat · n exercises".

**Week labels (from 2026-10-23.2).** Weeks are numbered within their block ("Week 3 of 4"). Each block has a run number ("HD run 2"). HD and PB badges use the calendar colours, but the letters carry the meaning. PB's own "Week A" and "Week B" (lighter and harder week) now appear only as the programme stage.

## Logic rules (as coded)

- **Estimated max** = load × (1 + (reps + reps left) ÷ 30). A single with nothing left is its own max. HD sets go to failure, so this is plain Epley for them. One function, `estMax`, is used everywhere; `loadForReps` reverses it, rounded down.
- **HD (reviewed 23 October 2026, unchanged):**
  - Double progression: at the top of the rep range, add the small step.
  - Inside the range: same weight, +1 rep.
  - After rest-pause or forced reps: same weight, +1 clean rep.
  - Stopped short: repeat.
  - 2 weeks below range: drop about 7.5%.
  - 3 or more HD weeks away: about 90%. Weeks on PB don't count as a break.
  - Warm-ups use your own last warm-up share.
- **PB top set:**
  - Plan rule: at least 1 more rep left than planned → +5 kg (bench +2.5). As planned → same weight. At least 1 fewer → same weight.
  - **Second opinion (`topSetCheck`):** if last week's reps left point to a load at least 3% away, a note is added. Lean lighter if warm-ups feel slow; go heavier only if warm-ups move fast and look the same.
- **PB back-offs:** a percentage lighter than today's top set (10%, then 8%, then 10% by fortnight).
- **PB accessories:** top of the range with the planned reps left on every set → smallest step. Nordic: +1 rep a week up to 6. Carry: +10 kg when all sets felt like 3 left.
- **PB test week (`testTarget`):**
  - Singles are predicted from the freshest estimate: today's last logged single, else last time's best set. The targets are the loads for 1 rep with 3, 2 and 1 left. Example: after 140 kg × 1 with 2 left, 135 / 140 / 142.5 kg.
  - The final single has a technique cue.
  - The extra try is offered only after a clean final single (+5 kg squat and deadlift, +2.5 kg bench).
- **Top-set finder:** unchanged from the original brief (first guess from HD weights, warm-up ladder, reps-left response).
- **Thomas Lilley input:** public material is mostly podcast titles, chapter lists and descriptions. Themes used: peak less (testing more often won't help), technique first, reps-left autoregulation. The owner may send a specific source to check against.

## Decisions made in this chat

- Supersets side by side. The overlap fix stacks set names above their numbers.
- Theme work went through previews (Summit, Tempo, a mix), then a Fitness-style concept with 5 multi-colour themes. The owner chose "Look and layout" and "Replace with the 5 new". The CSS backups are in the repo under `backups/`.
- Either plan can run longer. One-week steps for both plans (PB was 2-week steps until 23 October).
- History strength line added. Charts are separate so two scales never share one chart.
- History week labels: letters (A, B, C) were replaced by numbers plus HD or PB badges and run numbers, at the owner's request ("A of 2" was confusing).
- Workflow: for bigger changes, list them for review before committing. Commit only on the owner's "commit".

## Pending

1. **Deploy 2026-10-23.2** (week numbers, HD and PB badges, run numbers, shorter week picker) once the owner confirms "commit". The files are already built: `site-pages/` in the zip build, or rebuild from the sources. It passed t2–t11, `p4/cal`, `p4/chart`, `p4/lilley` and the audit (0 fails). Commit message suggestion: "History and calendar: numbered weeks, HD and PB badges, run numbers".
2. **Optional:** put the build sources in the repo (for example a `src/` folder) so future chats don't need the zip. Ask first.
3. **On hold (don't build unless asked):** a warm-up % readout and a main-set suggestion.
4. **Open items from the original brief:**
   - deadlift test stance setting;
   - which two muscle groups get the extra set in fortnight 2;
   - HD changes deferred from week-1 review (easy bike in HD weeks; flat-bench variation);
   - whether the Word plan gets a PB section.

*General training guidance, not medical advice.*

## 25 October 2026 addition

- **Legs A to Legs B (HD only):** once Legs A is logged, the Legs B main set for Leg Extension, Standing and Seated Calf Raise (`CONFIG.hdWeekPairs`) starts from that result (weight and reps, same unit only, missed partners ignored). Code: `rowTarget` (`from: "partner"`) and `partnerFor` in display.js. Test: `tests/p4/legsab.py`. Powerbuilding is deliberately untouched: its targets come from the programme.
- **Open:** the owner is considering removing one calf day in HD (probably the Day 3 one). Not started.
