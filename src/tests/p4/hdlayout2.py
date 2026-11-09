"""Heavy Duty layout 2 (9 November 2026): Aljo's four-day split with Wednesday rest, and history carried over
from the five-day layout (merged ids, variation slots, renumbered days, retired exercises still in past weeks)."""
import datetime, json, re
from playwright.sync_api import sync_playwright
URL = "file:///tmp/claude-0/-home-claude/ef2ea838-edd3-5f9a-a5d3-1743d048fa9e/scratchpad/work/site/new.html"
fails = []
def check(n, ok, info=""):
    print(("PASS " if ok else "FAIL ") + n, "" if ok else info)
    if not ok: fails.append(n)
SUMMARY = """() => { const c = ctx(); return c.sessions.map(s => ({n: s.n, title: s.title, rest: !!s.rest, time: s.time,
  items: s.rest ? [] : s.groups.reduce((a, g) => a.concat(g.items.map(i => ({id: i.id, name: i.name, opt: i.optional, pair: i.pair}))), []),
  pairs: s.rest ? [] : s.groups.filter(g => g.pair).map(g => g.items.map(i => i.id + ':' + i.pair))})); }"""
OLD = {"d1-1": {"sets": [{"reps": "12", "kg": "60"}, {"reps": "10", "kg": "80"}, {"reps": "9", "kg": "120"}]},
       "d5-2": {"sets": [{"reps": "12", "kg": "50"}, {"reps": "8", "kg": "90"}]},
       "d5-0": {"sets": [{"reps": "12", "kg": "30"}, {"reps": "10", "kg": "40"}, {"reps": "11", "kg": "55"}]},
       "d1-0": {"sets": [{"reps": "12", "kg": "30"}, {"reps": "10", "kg": "40"}, {"reps": "10", "kg": "50"}]},
       "d4-8": {"variant": "ez", "sets": [{"reps": "10", "kg": "20"}, {"reps": "7", "kg": "35"}]},
       "d3-5": {"variant": "db", "sets": [{"reps": "10", "kg": "20"}, {"reps": "8", "kg": "36"}]},
       "d2-0": {"sets": [{"reps": "10", "kg": "12"}, {"reps": "8", "kg": "20"}]}}
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 390, "height": 844}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.clock.install(time=datetime.datetime(2026, 11, 10, 9, 0, 0))   # Tuesday, HD week 2
    pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close")
    pg.evaluate("() => { state.ui.helpSeen = true; state.cycle = Object.assign({}, cycleOf(), {start: '2026-11-02', first: 'hd'}); realignSlots(todayISO()); renderAll(); save(); }")
    S = pg.evaluate(SUMMARY); by = {s["n"]: s for s in S}
    names = lambda n: [i["name"] for i in by[n]["items"]]
    check("HD week", pg.evaluate("ctx().plan") == "hd", pg.evaluate("ctx().plan"))
    check("days: Legs, Chest/Biceps, Rest, Shoulders/Triceps, Back/Rear Delts", [s["title"] for s in S] == ["Legs", "Chest, Biceps", "Rest", "Shoulders, Triceps", "Back, Rear Delts"], [s["title"] for s in S])
    check("Monday list", names(1) == ["Leg Extension", "Back or Zercher Squat", "Leg Press", "Hack or Pendulum Squat", "Stiff-Leg or Romanian Deadlift", "Leg Curl", "Standing Calf Raise", "Seated Calf Raise"], names(1))
    check("Tuesday list", names(2) == ["DB Incline Fly", "Incline Bench Press: Barbell or Smith", "Machine Chest Press", "DB Chest Press", "Cable Fly: High to Low or Low to High", "Pec Deck", "DB Chest Pullover", "Dumbbell Incline Curl", "Barbell Curl or Bicep-Biased Pulldown", "Preacher or Machine Curl", "Hammer or Concentration Curl"], names(2))
    check("Thursday list", names(4) == ["Shoulder Press: Behind-the-Neck or Military", "Lateral Raise", "Cable Lateral Raise", "DB Shoulder Press", "Barbell Upright Row", "Dumbbell Shrug", "Tricep Pushdown", "Tricep Extension or JM Press", "DB Skull Crusher or DB Tricep Extension", "One-Arm Pushdown"], names(4))
    check("Friday list", names(5) == ["Close-Grip Palm-Up Chin-up", "BB Bent-over Row", "T-Bar Row", "DB Bent-Over Row", "Cable Seated Row", "One-Arm Row: High-to-Low Cable or Machine", "Hammer Grip Pulldown", "Face Pulls", "Cable Rear Delt Fly", "Back Extension"], names(5))
    opt = sorted(i["id"] for s in S for i in s["items"] if i["opt"])
    check("optional exercises", opt == sorted(["d1-2", "d2-4", "d2-pec", "d2-5", "d2-10", "d3-hgpull", "d3-onearm"]), opt)
    check("only superset: incline fly + incline bench", [x for s in S for x in s["pairs"]] == [["d2-0:A1", "d2-2:A2"]])
    check("no deadlift, no rear delt superset, no Friday pullover", not any(re.search(r"^Deadlift|superset with barbell rear delt row", n) for n in names(5)) and "DB Chest Pullover" not in names(5))
    print("times:", {n: by[n]["time"] for n in (1, 2, 4, 5)})
    for n in (1, 2, 4, 5):
        m = re.match(r"(\d+)–(\d+) min", by[n]["time"]); check("day %d has a time estimate" % n, bool(m), by[n]["time"])
    check("week counts four training days", pg.evaluate("() => weekDaysDone(ctx().slot, ctx().sessions).total") == 4)
    # Variation slots carry their own rows
    rows = pg.evaluate("() => { const it = PROGRAMME.plans.hd; const s = buildHdSession(1, {'d1-1': 'zercher'}, null); return s.groups[0].items[1].rows.map(r => r.label + '@' + r.pct); }")
    check("Zercher keeps its one warm-up and percentages", rows == ["Warm-up@60", "Working@100"], rows)
    rows = pg.evaluate("() => buildHdSession(4, {'d4-9': 'jm-ez'}, null).groups[1].items[1].rows.map(r => r.label + '@' + r.pct)")
    check("JM press keeps its warm-up inside the tricep extension slot", rows == ["Warm-up@60", "Working@100"], rows)

    # ---- History transfer: a phone still holding the old five-day layout
    old = pg.evaluate("() => { storageSave(state); return JSON.parse(localStorage.getItem(CONFIG.storageKey)); }")
    old.pop("hdLayout", None)
    old["lastWeek"] = {"weekStart": "2026-11-02", "exportedAt": "x", "entries": OLD, "missedDays": {"3": {"note": "back day missed", "reason": "", "date": "2026-11-04"}},
                       "extras": {"5": [{"name": "Hip Thrust", "unit": "kg", "sets": [{"reps": "10", "kg": "60"}]}]}}
    old["varHistory"] = {"d1-1|-": {"name": "Back Squat", "date": "2026-10-20", "unit": "kg", "sets": [{"reps": "9", "kg": "110"}]},
                         "d5-3|-": {"name": "Pendulum Squat", "date": "2026-10-23", "unit": "plates", "sets": [{"reps": "12", "kg": "6"}, {"reps": "10", "kg": "9"}]},
                         "d4-8|barbell": {"name": "JM Press", "variant": "barbell", "date": "2026-10-22", "unit": "kg", "sets": [{"reps": "10", "kg": "20"}, {"reps": "8", "kg": "40"}]},
                         "d3-5|machine": {"name": "Lat Row", "variant": "machine", "date": "2026-10-21", "unit": "plates", "sets": [{"reps": "8", "kg": "5"}]}}
    old["units"] = {"d1-1": "kg", "d4-8:ez": "kg", "d3-5:db": "kg", "d5-3": "plates"}
    old["savedExtras"] = {"3": [{"name": "Rack Pull", "unit": "kg"}], "5": [{"name": "Hip Thrust", "unit": "kg"}]}
    old["history"] = {"db fly": {"name": "DB Fly", "date": "2026-11-03", "kg": 20, "reps": 8, "unit": "kg"}}
    old["entries"] = {"d5-0": {"sets": [{"reps": "12", "kg": "30"}, {"reps": "10", "kg": "40"}, {"reps": "12", "kg": "57.5"}], "doneAt": "2026-11-10"}}
    pg.evaluate("(s) => localStorage.setItem(CONFIG.storageKey, JSON.stringify(s))", old); pg.reload(); pg.wait_for_timeout(300)
    st = pg.evaluate("() => ({lw: state.lastWeek, vh: state.varHistory, units: state.units, se: state.savedExtras, hist: state.history, layout: state.hdLayout, e: Object.keys(state.entries)})")
    lw = st["lw"]["entries"]
    check("layout marker set", st["layout"] == 2)
    check("Back Squat last week lands on the back variation", lw.get("d1-1", {}).get("variant") == "back" and lw["d1-1"]["sets"][2]["kg"] == "120", lw.get("d1-1"))
    check("Legs B leg extension merged (Legs A kept, Legs B into history)", "d5-0" not in lw and lw["d1-0"]["sets"][2]["kg"] == "50" and st["vh"].get("d1-0|-", {}).get("sets", [{}])[2].get("kg") == "55", (lw.get("d1-0"), st["vh"].get("d1-0|-")))
    check("Zercher (old Legs B) goes to the Zercher variation", st["vh"].get("d1-1|zercher", {}).get("sets", [{}, {}])[1].get("kg") == "90", st["vh"].get("d1-1|zercher"))
    check("old back squat history on the back variation", "d1-1|back" in st["vh"] and "d1-1|-" not in st["vh"], list(st["vh"]))
    check("pendulum squat history moves into the hack slot", st["vh"].get("d1-2|pendulum", {}).get("unit") == "plates")
    check("JM press last week lands on the tricep extension slot", lw.get("d4-9", {}).get("variant") == "jm-ez" and "d4-8" not in lw, lw.get("d4-9"))
    check("JM press variation history moved", "d4-9|jm-barbell" in st["vh"] and not any(k.startswith("d4-8") for k in st["vh"]), list(st["vh"]))
    check("DB lat row becomes DB Bent-Over Row; machine lat row dropped", lw.get("d3-5", {}).get("variant") is None and lw["d3-5"]["sets"][1]["kg"] == "36" and not any(k.startswith("d3-5|machine") for k in st["vh"]), (lw.get("d3-5"), list(st["vh"])))
    check("DB fly keeps its numbers as the incline fly", lw.get("d2-0", {}).get("sets", [{}, {}])[1].get("kg") == "20" and st["hist"].get("db incline fly", {}).get("kg") == 20, st["hist"])
    check("units follow", st["units"].get("d1-1:back") == "kg" and st["units"].get("d4-9:jm-ez") == "kg" and st["units"].get("d3-5") == "kg" and st["units"].get("d1-2:pendulum") == "plates", st["units"])
    check("day-keyed data renumbered: old Day 3 to 5, old Day 5 to 1", [x["name"] for x in st["se"].get("5", [])] == ["Rack Pull"] and [x["name"] for x in st["se"].get("1", [])] == ["Hip Thrust"] and "5" in st["lw"]["missedDays"] and "1" in st["lw"]["extras"], (st["se"], st["lw"]["missedDays"], list(st["lw"]["extras"])))
    check("this week's retired entry stays", "d5-0" in st["e"])
    # Targets from the moved data
    tgt = pg.evaluate("""() => { const c = ctx(); const r = id => { const it = itemOf(c, id); const a = rowArgs(c, it); const w = firstWorkRow(it); const t = rowTarget(it, w, a); return {kg: t.kg, reps: t.reps}; };
      return {squat: r('d1-1'), tri: (() => { state.entries['d4-9'] = {sets: [], variant: 'jm-ez'}; return r('d4-9'); })(), fly: r('d2-0'), row: r('d3-5')}; }""")
    check("targets come from the moved numbers", tgt["squat"]["kg"] == 120 and tgt["tri"]["kg"] == 35 and tgt["fly"]["kg"] in (20, 22.5) and tgt["row"]["kg"] in (36, 38.5), tgt)
    # Retired exercise logged this week still shows in History and goes into the export
    exp = pg.evaluate("() => { const c = ctx(); return buildExport(c.slot, 'hd', c.sessions, null, 'now'); }")
    check("export carries the retired Legs B leg extension and the layout", "d5-0" in exp["entries"] and exp["layout"] == 2, list(exp["entries"])[:5])
    hw = pg.evaluate("() => { const c = ctx(); return historyWeeks(c.slot, 'hd', c.sessions, {hd: [], pb: []}, 'now').map(w => ({ws: w.weekStart, days: w.view.map(d => d.day + ':' + d.items.map(i => i.name).join('/'))})); }")
    check("history shows the retired exercise under Monday", any("1:" in d and "Leg Extension" in d for w in hw for d in w["days"]), hw)
    # Rolling over into next week moves the retired entry onto Leg Extension
    pg.evaluate("() => { state.entries['d1-0'] = undefined; delete state.entries['d1-0']; const c = ctx(); startNewWeek(c.slot, 'hd', c.sessions, c.cycle, '2026-11-16', 'now'); }")
    lw2 = pg.evaluate("() => state.lastWeek.entries")
    check("rollover: Legs B leg extension becomes Leg Extension last week", lw2.get("d1-0", {}).get("sets", [{}, {}, {}])[2].get("kg") == "57.5" and "d5-0" not in lw2, list(lw2))
    # Archive weeks from the old layout keep their extras on the right day
    ax = pg.evaluate("() => hdArchiveExtras({3: [{name: 'Rack Pull'}], 5: [{name: 'Hip Thrust'}], 2: [{name: 'Dips'}]}, 0)")
    check("archived old-layout extras renumbered", [x["name"] for x in ax["5"]] == ["Rack Pull"] and [x["name"] for x in ax["1"]] == ["Hip Thrust"] and ax["2"][0]["name"] == "Dips", ax)
    # Reload again: nothing moves twice
    pg.evaluate('() => storageSave(state)'); pg.reload(); pg.wait_for_timeout(200)
    st2 = pg.evaluate("() => ({se: state.savedExtras})")
    check("renumbering runs once", [x["name"] for x in st2["se"].get("5", [])] == ["Rack Pull"], st2)
    # Superset rounds line up from the working set back
    pg.evaluate("() => { state.lastWeek = null; state.entries = {}; state.ui.day = 2; state.ui.tab = 'train'; state.ui.openEx = 'd2-0'; renderAll(); }"); pg.wait_for_timeout(150)
    check("pair opens side by side", pg.locator(".pair-group.is-open .exercise").count() == 2)
    row = pg.locator('#ex-d2-0 [data-kind="main"][data-i="0"]')
    ins = row.locator("input"); ins.nth(0).fill("10"); ins.nth(1).fill("12") if ins.count() > 1 else None
    row.locator('[data-act="log-set"]').click(); pg.wait_for_timeout(150)
    check("fly warm-up leads into the last bench warm-up (rounds line up from the working set)", pg.evaluate("activeRows['d2-2']") == 2, pg.evaluate("activeRows['d2-2']"))
    v = pg.evaluate("() => [PROGRAMME.plans.hd.variants.INCBENCH.map(x => x.id + ':' + x.rows.length), PROGRAMME.plans.hd.variants.OHP.map(x => x.label)]")
    check("incline bench: barbell or Smith, rows match the old 3 warm-ups", v[0] == ["barbell:4", "smith:4"], v[0])
    check("shoulder press: behind-the-neck or military, barbell or Smith", v[1] == ["Behind-the-neck, barbell", "Military, barbell", "Military, Smith machine", "Behind-the-neck, Smith machine"], v[1])
    g = pg.evaluate("() => topSetGuess('bench', null, {entries: {}, lastWeek: {entries: {'d2-2': {variant: 'smith', sets: [{}, {}, {}, {reps: '6', kg: '80'}]}}}, varHistory: {}, history: {}}).kg")
    check("PB bench guess falls back to the Smith incline", g == 80, g)
    check("no page errors", not errs, errs)
    b.close()
print("FAILS", fails)
