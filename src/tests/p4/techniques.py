"""Heavy Duty forced reps and rest-pause guide (9 November 2026): re-entry, build, peak and easy weeks follow
the block length in the calendar; picks per day; tags, how-to and the Plans page guide."""
import datetime
from playwright.sync_api import sync_playwright
URL = "file:///tmp/claude-0/-home-claude/ef2ea838-edd3-5f9a-a5d3-1743d048fa9e/scratchpad/work/site/new.html"
SH = "/tmp/claude-0/-home-claude/ef2ea838-edd3-5f9a-a5d3-1743d048fa9e/scratchpad/w2/shots/"
fails = []
def check(n, ok, info=""):
    print(("PASS " if ok else "FAIL ") + n, "" if ok else info)
    if not ok: fails.append(n)
PH = "(a) => { const w = weekInfo({start: '2026-11-02', first: 'hd', lengths: [a[0]], easy: a[2] || {}}, a[1]); const t = hdTechWeek(w); return t ? t.phase + (t.capped ? '*' : '') : null; }"
PICKS = """(a) => { const cyc = {start: '2026-11-02', first: 'hd', lengths: [a[0]]}; const w = weekInfo(cyc, a[1]);
  return [1, 2, 4, 5].map(n => hdTechPicks(buildHdSession(n, a[2] || {}, w), a[3] || {}, w).map(p => p.id + ':' + p.tech.join('+')).join(', ')); }"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 390, "height": 900}, device_scale_factor=2); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.clock.install(time=datetime.datetime(2026, 11, 10, 9, 0, 0)); pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close")
    wk = ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30", "2026-12-07", "2026-12-14", "2026-12-21"]
    check("2-week block: re-entry, peak", [pg.evaluate(PH, [2, d]) for d in wk[:2]] == ["reentry", "peak"])
    check("3-week block: re-entry, build, peak", [pg.evaluate(PH, [3, d]) for d in wk[:3]] == ["reentry", "build", "peak"])
    check("4-week block: re-entry, build, build, peak", [pg.evaluate(PH, [4, d]) for d in wk[:4]] == ["reentry", "build", "build", "peak"])
    check("1-week block: re-entry only", pg.evaluate(PH, [1, wk[0]]) == "reentry")
    check("easy week: none", pg.evaluate(PH, [3, wk[1], {"1": True}]) == "cruise")
    check("over 6 hard weeks: peak held at build", pg.evaluate(PH, [8, wk[7]]) == "build*", pg.evaluate(PH, [8, wk[7]]))
    check("powerbuilding week: no guide", pg.evaluate("() => hdTechWeek(weekInfo({start: '2026-11-02', first: 'pb', lengths: [2]}, '2026-11-02'))") is None)
    pk = pg.evaluate(PICKS, [2, wk[1]])
    check("peak picks: legs, chest, shoulders, back", pk == ["d5-1:rp, d1-6:rp", "d2-2:fr, d2-6:rp", "d4-1:fr, d4-7:rp", "d3-0:fr, d3-facepull:rp"], pk)
    pk = pg.evaluate(PICKS, [3, wk[1]])
    check("build picks: one a day", pk == ["d5-1:rp", "d2-2:fr", "d4-1:fr", "d3-0:fr"], pk)
    check("re-entry picks: none", pg.evaluate(PICKS, [2, wk[0]]) == ["", "", "", ""])
    pk = pg.evaluate(PICKS, [3, wk[1], {"d2-2": "smith", "d4-0": "smith"}])
    check("variations change the picks (Smith incline, Smith press)", pk[1] == "d2-2:rp+fr" and pk[2] == "d4-0:rp+fr", pk)
    pk = pg.evaluate(PICKS, [3, wk[1], {}, {"lastWeek": {"entries": {"d5-1": {"sets": [{}, {}, {"reps": "7", "kg": "10"}]}}}}])
    check("a missed rep range moves the technique on, never back to the pre-exhaust", pk[0] == "d1-3:rp", pk)
    # On screen: Tuesday of a 2-week block's peak week
    pg.evaluate("() => { state.ui.helpSeen = true; state.cycle = {start: '2026-11-02', first: 'hd', lengths: [2]}; realignSlots(todayISO()); state.ui.tab = 'train'; state.ui.day = 2; renderAll(); save(); }")
    pg.wait_for_timeout(3000); pg.evaluate("() => document.querySelectorAll('.toast').forEach(e => e.style.display = 'none')")
    line = pg.inner_text("#session-head .tech-line") if pg.locator("#session-head .tech-line").count() else ""
    check("session head: peak line names both", "Peak week (week 2 of 2)" in line and "Incline Bench Press" in line and "Dumbbell Incline Curl" in line, line)
    check("card tags", pg.inner_text("#ex-d2-2 .exercise__tag--tech") == "Forced reps" and pg.inner_text("#ex-d2-6 .exercise__tag--tech") == "Rest-pause")
    pg.locator("#session-head").screenshot(path=SH + "tech-head.png")
    pg.evaluate("() => { state.ui.openEx = 'd2-6'; renderAll(); }"); pg.wait_for_timeout(150)
    check("how-to in the open card", "rest 10 to 15 seconds" in pg.inner_text("#ex-d2-6 .tech-how"))
    pg.evaluate("() => { state.ui.openEx = null; state.ui.tab = 'plan'; state.ui.planSection = 'plan'; state.ui.planView = 'hd'; renderAll(); }"); pg.wait_for_timeout(150)
    check("Plans page guide", pg.locator("#plan-guide summary", has_text="Forced reps and rest-pause").count() == 1)
    pg.evaluate("() => { state.ui.tab = 'train'; state.ui.day = 1; state.cycle = {start: '2026-11-09', first: 'hd', lengths: [2]}; realignSlots(todayISO()); renderAll(); }"); pg.wait_for_timeout(150)
    check("re-entry week line", "Plain failure today" in pg.inner_text("#session-head"))
    check("no page errors", not errs, errs)
    b.close()
print("FAILS", fails)
