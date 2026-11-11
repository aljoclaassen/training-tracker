"""Hex Bar Deadlift (10 November 2026): optional on back day, before the back extension; first target from the
Powerbuilding hex-bar farmer's carry plus 10%, rounded down; own history takes over once logged."""
import datetime
from playwright.sync_api import sync_playwright
URL = "file:///tmp/claude-0/-home-claude/ef2ea838-edd3-5f9a-a5d3-1743d048fa9e/scratchpad/work/site/new.html"
fails = []
def check(n, ok, info=""):
    print(("PASS " if ok else "FAIL ") + n, "" if ok else info)
    if not ok: fails.append(n)
T = """(pbSetup) => { const pb = slotOf(state, 'pb'); Object.assign(pb, pbSetup || {}); const c = ctx(); const it = itemOf(c, 'd3-hexdl');
  const a = rowArgs(c, it); const t = rowTarget(it, firstWorkRow(it), a); return {kg: t.kg, reps: t.reps, text: t.text, opt: it.optional}; }"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 390, "height": 844}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.clock.install(time=datetime.datetime(2026, 11, 13, 9)); pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close")
    pg.evaluate("() => { state.ui.helpSeen = true; state.cycle = {start: '2026-10-12', first: 'hd', lengths: [2, 2, 2]}; ensurePbSlot(state, todayISO()); realignSlots(todayISO()); state.ui.day = 5; renderAll(); }")
    lb = pg.evaluate("() => buildHdSession(5, {}, null).groups.filter(g => g.title === 'Lower Back')[0].items.map(i => i.id + (i.optional ? '*' : ''))")
    check("back day: hex bar deadlift (not optional) before the back extension", lb == ["d3-hexdl", "d3-8"], lb)
    r = pg.evaluate(T, {"lastWeek": {"weekStart": "2026-10-26", "entries": {"pb-d5-farmer": {"sets": [{"reps": "30", "kg": "97.5"}, {"reps": "30", "kg": "100"}, {"reps": "25", "kg": "100"}, {}]}}}})
    check("first target: heaviest carry 100 kg + 10% = 110 kg x 6+", r["kg"] == 110 and r["reps"] == 6 and "hex-bar farmer's carry (100 kg)" in r["text"] and "walk with it" in r["text"], r)
    r = pg.evaluate(T, {"lastWeek": {"weekStart": "2026-10-26", "entries": {"pb-d5-farmer": {"sets": [{"reps": "30", "kg": "97.5"}]}}}})
    check("rounded down: 97.5 + 10% = 105 kg", r["kg"] == 105, r)
    r = pg.evaluate(T, {"lastWeek": {"weekStart": "2026-10-26", "entries": {"pb-d5-farmer": {"replaced": True, "sets": [{"reps": "30", "kg": "40"}]}}}})
    check("a carry swapped for dumbbells does not count", r["kg"] is None, r)
    r = pg.evaluate(T, {"lastWeek": None, "history": {"hex-bar farmer's carry": {"kg": 90, "reps": 30, "unit": "kg"}}})
    check("falls back to best-set history", r["kg"] == 97.5, r)
    r = pg.evaluate(T, {"lastWeek": None, "history": {}})
    check("no carry logged: no guess", r["kg"] is None, r)
    # Once logged, own history wins
    pg.evaluate("() => { state.lastWeek = {weekStart: '2026-11-02', entries: {'d3-hexdl': {sets: [{reps: '10', kg: '60'}, {reps: '6', kg: '85'}, {reps: '7', kg: '120'}]}}}; }")
    r = pg.evaluate(T, {"lastWeek": {"weekStart": "2026-10-26", "entries": {"pb-d5-farmer": {"sets": [{"reps": "30", "kg": "100"}]}}}})
    check("own history takes over", r["kg"] == 120 and "First time" not in r["text"], r)
    pg.evaluate("() => { state.lastWeek = null; state.ui.openEx = 'd3-hexdl'; renderAll(); }"); pg.wait_for_timeout(150)
    check("card shows the first-time target and warm-ups from it", "110 kg" in pg.inner_text("#ex-d3-hexdl") and "55 kg" in pg.inner_text("#ex-d3-hexdl"))
    check("no page errors", not errs, errs)
    b.close()
print("FAILS", fails)
