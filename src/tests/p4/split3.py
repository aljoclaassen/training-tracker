"""10 November 2026: stiff-leg deadlift barbell / dumbbells / Smith tracked apart (this week's set moved to dumbbells),
two cable flies, DB row and T-bar row choose bent over/standing or chest-supported, DB rear delt fly added."""
import datetime
from playwright.sync_api import sync_playwright
URL = "file:///tmp/claude-0/-home-claude/ef2ea838-edd3-5f9a-a5d3-1743d048fa9e/scratchpad/work/site/new.html"
fails = []
def check(n, ok, info=""):
    print(("PASS " if ok else "FAIL ") + n, "" if ok else info)
    if not ok: fails.append(n)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 390, "height": 844}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.clock.install(time=datetime.datetime(2026, 11, 10, 9)); pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close")
    pg.evaluate("() => { state.ui.helpSeen = true; state.cycle = {start: '2026-10-12', first: 'hd', lengths: [2, 2, 2]}; realignSlots(todayISO()); renderAll(); storageSave(state); }")
    V = pg.evaluate("() => ['SLDL', 'DBROW', 'TBAR'].map(k => PROGRAMME.plans.hd.variants[k].map(v => v.id).join('/'))")
    check("variation lists", V == ["barbell/dumbbell/smith", "bent/chest", "chest/free"], V)
    rd = pg.evaluate("() => buildHdSession(5, {}, null).groups.filter(g => g.title === 'Rear Delts')[0].items.map(i => i.name)")
    check("rear delts: face pulls, cable fly, DB fly", rd == ["Face Pulls", "Cable Rear Delt Fly", "DB Rear Delt Fly"], rd)
    # A phone holding this week's stiff-leg deadlift (logged Monday, before the split) and older history
    old = pg.evaluate("() => { storageSave(state); return JSON.parse(localStorage.getItem(CONFIG.storageKey)); }")
    old.pop("hdFixesDone", None)
    old["weekStart"] = "2026-11-09"
    old["entries"] = {"d5-4": {"sets": [{"reps": "10", "kg": "22"}], "doneAt": "2026-11-09"}}
    old["lastWeek"] = {"weekStart": "2026-10-12", "entries": {"d5-4": {"variant": "free", "sets": [{"reps": "10", "kg": "80"}]},
        "d3-5": {"sets": [{"reps": "10", "kg": "20"}, {"reps": "8", "kg": "34"}]}, "d3-2": {"sets": [{"reps": "8", "kg": "40"}]}}}
    old["varHistory"] = {"d5-4|smith": {"sets": [{"reps": "10", "kg": "60"}], "date": "2026-10-01"}, "d2-4|low": {"sets": [{"reps": "10", "kg": "5"}], "date": "2026-11-03"}}
    pg.evaluate("(s) => localStorage.setItem(CONFIG.storageKey, JSON.stringify(s))", old); pg.reload(); pg.wait_for_timeout(300)
    st = pg.evaluate("() => ({e: state.entries['d5-4'], lw: state.lastWeek.entries, vh: state.varHistory, done: state.hdFixesDone})")
    check("this week's stiff-leg deadlift moved to dumbbells", st["e"]["variant"] == "dumbbell" and st["e"]["sets"][0]["kg"] == "22", st["e"])
    check("older stiff-leg history stays barbell", st["lw"]["d5-4"]["variant"] == "barbell" and st["lw"]["d5-4"]["sets"][0]["kg"] == "80", st["lw"]["d5-4"])
    check("Smith stiff-leg keeps its own history", "d5-4|smith" in st["vh"])
    check("DB row history is bent over, T-bar is chest-supported", st["lw"]["d3-5"]["variant"] == "bent" and st["lw"]["d3-2"]["variant"] == "chest", (st["lw"]["d3-5"], st["lw"]["d3-2"]))
    check("low-to-high fly history moves to its own exercise", "d2-cflylow|-" in st["vh"] and not any(k.startswith("d2-4|low") for k in st["vh"]), list(st["vh"]))
    # Targets by variation
    t = pg.evaluate("""() => { const c = ctx(); const it = itemOf(c, 'd5-4'); const a = rowArgs(c, it); const r = rowTarget(it, firstWorkRow(it), a);
      state.entries['d5-4'].variant = 'barbell'; state.entries['d5-4'].sets = [{}]; const c2 = ctx(); const it2 = itemOf(c2, 'd5-4'); const r2 = rowTarget(it2, firstWorkRow(it2), rowArgs(c2, it2));
      return [it.variant, r2.kg]; }""")
    check("dumbbell and barbell targets kept apart", t[0] == "dumbbell" and t[1] in (80, 82.5), t)
    pg.reload(); pg.wait_for_timeout(200)
    check("the fix runs once", pg.evaluate("state.hdFixesDone") == ["sldl-db-2026-11-09"])
    check("no page errors", not errs, errs)
    b.close()
print("FAILS", fails)
