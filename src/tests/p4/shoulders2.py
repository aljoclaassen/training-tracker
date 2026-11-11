"""11 November 2026, shoulder day: DB lateral raise supersets into the shoulder press (Mentzer pre-exhaust), machine
lateral raise optional on its own, old lateral history split by variation, first DB lateral target from Powerbuilding,
Underhand One-Arm Pushdown, Overhead Cable Extension back as optional with its history."""
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
    pg.clock.install(time=datetime.datetime(2026, 11, 12, 9)); pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close")
    pg.evaluate("() => { state.ui.helpSeen = true; state.cycle = {start: '2026-10-12', first: 'hd', lengths: [2, 2, 2]}; ensurePbSlot(state, todayISO()); realignSlots(todayISO()); state.ui.day = 4; renderAll(); storageSave(state); }")
    sh = pg.evaluate("() => buildHdSession(4, {}, null).groups.filter(g => g.title === 'Shoulders' || !g.title).slice(0, 2).map(g => g.items.map(i => i.id + (i.pair ? '/' + i.pair : '') + (i.optional ? '*' : '') + ':' + i.rows.length))")
    check("DB lateral (2 rows) supersets into the press (3 rows); machine lateral optional", sh[0] == ["d4-dblat/A1:2", "d4-0/A2:3"] and "d4-machlat*:2" in sh[1], sh)
    check("machine lateral: standing or seated", pg.evaluate("() => PROGRAMME.plans.hd.variants.MACHLAT.map(v => v.id + ':' + v.unit)") == ["standing:plates", "seated:plates"])
    check("one-arm pushdown: underhand, cable or machine", pg.evaluate("() => [EXERCISES['d4-10'].item.name, PROGRAMME.plans.hd.variants.ONEARMPD.map(v => v.id).join('/')]") == ["Underhand One-Arm Pushdown", "cable/machine"])
    # Old phone data: lateral raise logged three ways, reverse-grip pushdown, overhead extension history
    old = pg.evaluate("() => { storageSave(state); return JSON.parse(localStorage.getItem(CONFIG.storageKey)); }")
    old["lastWeek"] = {"weekStart": "2026-10-12", "entries": {"d4-3": {"variant": "dumbbell", "sets": [{"reps": "10", "kg": "8"}, {"reps": "8", "kg": "14"}]},
        "d4-10": {"variant": "reverse", "sets": [{"reps": "8", "kg": "3"}, {"reps": "8", "kg": "3"}]}, "d4-ohcable": {"sets": [{"reps": "8", "kg": "6"}]}}}
    old["varHistory"] = {"d4-3|standing": {"sets": [{}, {"reps": "8", "kg": "5"}], "date": "2026-10-05"}, "d4-3|seated": {"sets": [{}, {"reps": "8", "kg": "4"}], "date": "2026-09-28"}, "d4-3|-": {"sets": [{}, {"reps": "9", "kg": "6"}], "date": "2026-09-21"}}
    pg.evaluate("(s) => localStorage.setItem(CONFIG.storageKey, JSON.stringify(s))", old); pg.reload(); pg.wait_for_timeout(300)
    st = pg.evaluate("() => ({lw: state.lastWeek.entries, vh: state.varHistory})")
    check("dumbbell laterals -> DB Lateral Raise", st["lw"].get("d4-dblat", {}).get("sets", [{}, {}])[1].get("kg") == "14" and "d4-3" not in st["lw"], st["lw"])
    check("machine laterals -> Machine Lateral Raise by variation (unlabelled = standing)", "d4-machlat|standing" in st["vh"] and "d4-machlat|seated" in st["vh"] and not any(k.startswith("d4-3|") for k in st["vh"]), list(st["vh"]))
    check("reverse-grip pushdown -> underhand cable", st["lw"].get("d4-10", {}).get("variant") == "cable", st["lw"].get("d4-10"))
    check("overhead cable extension keeps its history", st["lw"].get("d4-ohcable", {}).get("sets", [{}])[0].get("kg") == "6")
    pg.reload(); pg.wait_for_timeout(200)
    check("moves are stable on reload", pg.evaluate("() => state.lastWeek.entries['d4-dblat'] && !state.lastWeek.entries['d4-machlat'] && Object.keys(state.varHistory).filter(k => k.startsWith('d4-machlat')).length") == 2)
    # First DB lateral target from Powerbuilding lateral raises (no Heavy Duty history)
    pg.evaluate("() => { state.lastWeek = null; state.varHistory = {}; }")
    T = """(pbSetup) => { const pb = slotOf(state, 'pb'); Object.assign(pb, pbSetup); const c = ctx(); const it = itemOf(c, 'd4-dblat'); const t = rowTarget(it, firstWorkRow(it), rowArgs(c, it)); return {kg: t.kg, reps: t.reps, text: t.text}; }"""
    r = pg.evaluate(T, {"lastWeek": {"weekStart": "2026-10-26", "entries": {"pb-d4-lateral": {"sets": [{"reps": "15", "kg": "10", "left": "1"}, {"reps": "14", "kg": "12", "left": "0"}, {"reps": "12", "kg": "12", "left": "0"}]}}}})
    # best: 12 x 14 to failure -> 12 x (1 + 14/30) = 17.6; x0.95 = 16.72; / 1.2 = 13.93 -> 13 kg (1 kg steps)
    check("first DB lateral target from PB: 12 kg x 14 to failure -> 13 kg x 6", r["kg"] == 13 and r["reps"] == 6 and "12 kg × 14" in r["text"], r)
    r = pg.evaluate(T, {"lastWeek": {"weekStart": "2026-10-26", "entries": {"pb-d4-lateral": {"replaced": True, "sets": [{"reps": "15", "kg": "6"}]}}}, "history": {}})
    check("swapped PB laterals give no guess", r["kg"] is None, r)
    pg.evaluate("() => { state.ui.tab = 'train'; state.ui.day = 4; state.ui.openEx = 'd4-dblat'; renderAll(); }"); pg.wait_for_timeout(150)
    check("superset opens side by side", pg.locator(".pair-group.is-open .exercise").count() == 2)
    # Dips supersets: the dip set follows the last set only
    pg.evaluate("() => { state.lastWeek = null; state.entries = {}; state.ui.openEx = 'd4-7'; renderAll(); }"); pg.wait_for_timeout(150)
    def log(id, i, reps, kg):
        row = pg.locator('#ex-' + id + ' [data-kind="main"][data-i="' + str(i) + '"]'); ins = row.locator("input")
        ins.nth(0).fill(reps); ins.nth(1).fill(kg); row.locator('[data-act="log-set"]').click(); pg.wait_for_timeout(150)
    log("d4-7", 0, "10", "20")
    check("pushdown warm-up does not jump to dips", pg.evaluate("activeRows['d4-tdips']") in (None, 0) and pg.evaluate("(state.entries['d4-tdips'] || {sets: []}).sets.filter(isLogged).length") == 0)
    log("d4-7", 1, "8", "35")
    check("pushdown last set leads straight into dips", pg.evaluate("activeRows['d4-tdips']") == 0 and pg.evaluate("ctx().slot.entries['d4-7'].sets.filter(isLogged).length") == 2)
    t = pg.evaluate("() => { state.lastWeek = {weekStart: '2026-11-02', entries: {'d2-cdips': {sets: [{reps: '9', kg: '0'}]}}}; const c = ctx(); const it = itemOf(c, 'd2-cdips'); return rowTarget(it, 0, rowArgs(c, it)).text; }")
    check("bodyweight dips: aim for one more rep", "10 clean reps" in t, t)
    check("no page errors", not errs, errs)
    b.close()
print("FAILS", fails)
