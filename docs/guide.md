# Training tracker: App Guide

What the training tracker is, how it is built, and why, in plain language. General ideas (server, browser storage, build script, cache and so on) are explained once in the Concepts handbook in the `build-standards` repo; this guide refers to its entries by number. Version 1, 14 November 2026, matching app version 2026-11-11.1.

**Status:** live and in daily use at https://aljoclaassen.github.io/training-tracker/. A personal project, shared with friends; not Cango Wildlife or BOA Foundation work.

## 1. What it does

One phone app runs two training programmes, **Heavy Duty** and **Powerbuilding**, in alternating blocks of weeks. It shows each day's session, the target for every set, logs what was actually lifted, works out the next targets, and keeps history and strength charts. It works without signal in the gym.

| Screen | What it holds |
| --- | --- |
| Today | This day's session, set by set, with targets, rest timer and the "Next set" button |
| Plans | **Plan:** the programme, day by day, plus the technique guide. **Blocks:** the calendar of Heavy Duty and Powerbuilding blocks, easy weeks, past blocks |
| History | **Progress:** estimated max, heaviest set and reps, each on its own chart. **Week log:** every logged week |
| Settings | Theme (5 colour sets), light, dark or match phone, extra contrast, plan schedule |
| Week options | Export this week, Load last week, Start new week, Restore from backup |

## 2. How the parts fit together

```text
 Source files (src/)          Build script            Published files            Your phone
 hd.json, pb.json,      ──>   src/build/build.py ──>  index.html, sw.js,   ──>   browser opens the app;
 logic.js, display.js,        (Python)                theme.css on               logs are saved in the
 shell.html, theme.css,                               GitHub Pages               phone's browser storage
 config.json
```

| Part | Lives in | Job |
| --- | --- | --- |
| `src/hd.json` | The repo | The Heavy Duty programme, as data |
| `src/build/pb.json` | The repo | The Powerbuilding programme, as data |
| `src/build/logic.js` | The repo | The rules: targets, progression, estimated max, calendar |
| `src/build/display.js`, `shell.html`, `theme.css` | The repo | The screens and the look |
| `src/build/config.json` | The repo | Settings, including `appVersion` |
| `src/build/build.py` | The repo | Assembles everything into the published files (Concepts handbook, entry 23) |
| `index.html`, `sw.js`, `theme.css` at the top of the repo | The repo, published by GitHub Pages | The app as the phone receives it. Never edited by hand: always rebuilt |
| `src/tests/` | The repo | 39 automated test scripts (Concepts handbook, entry 24) |
| `src/HANDOVER.md` | The repo | The detailed technical record of every version, for Claude and developers |
| Your logs | Your phone's browser storage | Everything you have logged. Not on any server |

## 3. The training ideas behind the app

*General training guidance, not medical advice.*

### Heavy Duty

High-intensity training in the style of Mike Mentzer and Dorian Yates: few sets, taken all the way to failure, with long recovery between sessions for the same muscle.

- **One working set per exercise, taken to failure** after warm-ups. Failure means the last clean rep.
- **Warm-ups as a share of the working weight**, typically 50%, 60% and 70%, staying well short of failure. Fewer warm-ups for later exercises on a muscle that is already warm.
- **Double progression:** when you reach the top of the rep range, add the smallest weight step; inside the range, keep the weight and add a rep; stopped short, repeat.
- **Coming back:** after 3 or more weeks away from Heavy Duty, restart at about 90%. Weeks spent on Powerbuilding do not count as a break.
- **Current layout (your own programme, since 9 November 2026):** Monday legs; Tuesday chest and biceps; Wednesday rest; Thursday shoulders and triceps; Friday back and rear delts; weekends off. Supersets include the DB incline fly into the barbell incline bench, DB lateral raise into the shoulder press (Mentzer's pre-exhaust), and two dips supersets. The back day finishes with the hex bar deadlift.
- **Forced reps and rest-pause** are added in a measured way: none in a block's first week, one a day in the middle weeks, two a day in the last week, none in an easy week. Never on free-weight squats, deadlifts, barbell rows or the behind-the-neck press. The dose is Claude's design, informed by research showing forced reps added little and that training to failure slows recovery by one to two days.

### Powerbuilding

Strength work on the squat, bench press and deadlift, with bodybuilding accessories, aimed at a test of your best single lifts.

- **One top set, then back-off sets** 8 to 10% lighter.
- **"Reps left" instead of jargon.** Effort is how many more clean reps you could still have done: 4 (bar moves fast) down to 0 (failure). The app never shows the technical terms RPE, RIR or e1RM; this was a decision for plain language.
- **Week A and Week B:** a lighter then a harder week, with fewer reps left on the top set as blocks go on: 5 reps, then 4 reps, then a heavy week, then a test week.
- **Test week:** work up through singles to a final single with about 1 rep left, saved as the record.
- **Top-set finder:** when you do not know your starting weight, the app suggests one from your Heavy Duty weights and adjusts it from how many reps you had left.
- Sessions are planned to fit 60 to 90 minutes, warm-up and cardio included, which is why there are supersets.

### How the two fit together

- **Blocks alternate** between the programmes. Either can run 1 to 12 weeks, adjusted a week at a time in the calendar.
- **Easy weeks:** the week after every Powerbuilding test week is an easy week; you can make any week easy. After 6 hard weeks in a row the app suggests one.
- **Estimated max** links the two: weight × (1 + (reps + reps left) ÷ 30). A set of 100 kg for 5 reps with 2 left estimates about 123 kg. It drives the strength charts, the Powerbuilding test-week targets, and the "Powerbuilding hint" shown on some Heavy Duty exercises.

**Sources used:** Iron Studio Gym's Dorian Yates 4-day split; Fitness Volt on Yates's warm-ups; StrengthLog and Athlean-X on Mentzer's Heavy Duty; Thomas Lilley's public material (peak less, technique first, reps-left autoregulation); Drinkwater 2007, Prestes 2019 and Morán-Navarro 2017 on forced reps, rest-pause and recovery. The full list for the original programme is in "Training Plan Heavy Duty (9 Oct 2026)", kept outside the repo.

## 4. Why it is built this way

Each answer follows the six parts from the SOP.

### Why is there no server?

**Answer:** only one phone uses each copy of the app, so nothing needs to be shared between devices.

**Picture:** a notebook in your pocket. Tour Timer, by contrast, is a whiteboard four devices share, so it needs something in the middle.

**Term:** *server*, Concepts handbook entry 3.

**Turned down:** a server and accounts, which would cost money, need looking after, and hold friends' training data somewhere other than their own phones.

**What would change it:** wanting the same logs on two devices, or a coach seeing a friend's logs.

### Where are my logs, and what if I lose my phone?

**Answer:** on the phone itself, in the browser's storage; a lost phone or cleared browser loses them unless you have exported a backup.

**Picture:** a gym locker that only opens on that one phone.

**Term:** *browser storage*, Concepts handbook entry 10. The app's storage names are `heavy-duty-tracker-v1` (your logs), `training-tracker-archive` (12 finished weeks per plan) and `training-tracker-theme`.

**What to do:** use **Week options, Export this week** regularly and keep the file off the phone (email it to yourself, or save it to cloud storage). An export holds the week, last week's numbers, your best-set history, saved swaps and the other plan's current state, so **Restore from backup** on a new phone lets you carry on where you were. Older weeks in the Week log are not in the export file.

**Why the name `heavy-duty-tracker-v1` must never change:** the app finds your logs by that name. Change it and the app opens empty, as if you had never trained.

### Why is the app one large file built by a script?

**Answer:** the published app is one 560 kB file; editing small source files and rebuilding is far safer than editing that file by hand.

**Picture:** a book's chapters are edited separately, then bound the same way every time.

**Term:** *build script*, Concepts handbook entry 23.

**The rule:** never edit `index.html` at the top of the repo directly. Change the source in `src/`, rebuild, test, then publish.

### Why is the programme kept in `hd.json` and `pb.json`?

**Answer:** keeping the programme as data, separate from the code, means an exercise can change without touching the rules or the screens.

**Picture:** the ingredients, kept apart from the recipe method.

**Term:** *code and data*, Concepts handbook entry 9. The repo's copy is the one real copy of the programme. Every earlier version is in the repo's history; for example, Heavy Duty before the 8 November change is at github.com/aljoclaassen/training-tracker/blob/c64e092/src/hd.json.

### Why do exercises have ID codes like `d2-2`, and why must they stay the same?

**Answer:** the app files every logged set under its exercise's ID; if an ID changed, that exercise's history would look like a brand new exercise.

**Picture:** a member number at the gym. Your name on the card can change; the number keeps your records together.

**How changes are handled:** when the plan was redesigned on 9 November, the app was given a map of old IDs to new ones (`hdMoves`) so history moved across. Retired exercises stay in the app, marked retired, so past weeks still show them.

### Why do versions look like 2026-11-11.1?

**Answer:** each release is named by its date plus a number for that day, which is simple and shows at a glance how recent it is.

**Term:** *version*, Concepts handbook entry 18. The SOP's MAJOR.MINOR.PATCH style suits apps with outside users; for this personal app the date style stays. The version is set in two places that must match: `appVersion` in `src/build/config.json` and `VERSION` in the service worker. If they differ, phones may keep the old copy (Concepts handbook entry 12).

### Why are there 39 test scripts?

**Answer:** each one uses the app in a browser the way you would and checks a feature still works, so a change in one place cannot silently break another.

**Term:** *automated tests*, Concepts handbook entry 24. Examples: one checks the words RPE, RIR and e1RM never appear; one checks text contrast in every theme (about 18,000 checks); one checks history moved correctly in the 9 November redesign.

**Known problem:** the tests only run after replacing a folder path left over from an old Claude session. Fixing that is an open item.

## 5. Common jobs

| Job | How |
| --- | --- |
| Change an exercise, sets, reps or rest | Ask Claude in APP Training; it edits `hd.json` or `pb.json`, rebuilds, runs the tests and gives you the release |
| Release an update | Raise `appVersion` and the service worker `VERSION` to the same value, rebuild, run the tests, copy the built files to the top of the repo, commit with a clear message, push |
| Back up your logs | Week options, Export this week. Keep the file off the phone |
| Move to a new phone | Open the app on the new phone, Week options, Restore from backup |
| Make a week easy | Plans, Blocks, the week, Make easy |
| Run a plan longer | Plans, Blocks, add or remove a week |
| Something went wrong | The red banner has a "Copy error details" button. Paste the details to Claude with what you were doing |

## 6. Open items

- Split `src/HANDOVER.md` into the SOP's standard pieces: brief, decisions log, CHANGELOG. Its dated additions already work as a changelog.
- Tag the current version as a GitHub release.
- Fix the tests' hard-coded folder path.
- Remove `backups/` and `theme-previews/` from the top of the repo; Git already keeps every earlier version.
- From the original brief: the deadlift test stance setting; which two muscle groups get the extra set in Powerbuilding's second block.
- The suggestion lists for extra exercises were written by Claude; edit them to your own.
- Time real Heavy Duty sessions so the time estimate matches.

## 7. Where to find more

- `README.md`: the live link and release steps
- `src/README.md`: building and testing
- `src/HANDOVER.md`: the full technical record
- The Concepts handbook, in the `build-standards` repo
