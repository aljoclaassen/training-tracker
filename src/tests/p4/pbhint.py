"""Powerbuilding hint on Heavy Duty exercises (information only), cable fly options, one-arm row option,
and the one-arm machine row history recovered from archived weeks (9 November 2026)."""
import datetime, json
from playwright.sync_api import sync_playwright
URL = "file:///tmp/claude-0/-home-claude/ef2ea838-edd3-5f9a-a5d3-1743d048fa9e/scratchpad/work/site/new.html"
fails = []
def check(n, ok, info=""):
    print(("PASS " if ok else "FAIL ") + n, "" if ok else info)
    if not ok: fails.append(n)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 390, "height": 844}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.clock.install(time=datetime.datetime(2026, 11, 30, 9, 0, 0))   # Monday, HD run 2
    pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close")
    pg.evaluate("() => { state.ui.helpSeen = true; state.cycle = Object.assign({}, cycleOf(), {start: '2026-11-02', first: 'hd'}); ensurePbSlot(state, todayISO()); realignSlots(todayISO()); renderAll(); save(); }")
    check("HD week", pg.evaluate("ctx().plan") == "hd")
    pg.evaluate("""() => { const pb = slotOf(state, 'pb'); pb.lastWeek = {weekStart: '2026-11-16', entries: {
        'pb-d1-squat': {sets: [{reps: '5', kg: '140', left: '2'}, {reps: '5', kg: '125', left: '3'}]},
        'pb-d2-bench': {sets: [{reps: '5', kg: '100', left: '2'}]},
        'pb-d1-legpress': {unit: 'plates', sets: [{reps: '10', kg: '12', left: '2'}]} }}; pb.units = {'pb-d1-legpress': 'plates'}; }""")
    H = """(a) => { const c = ctx(); const s = buildHdSession(a[0], a[1] || {}, null); let it = null; s.groups.forEach(g => g.items.forEach(i => { if (i.id === a[2]) it = i; })); return pbHint(it, slotOf(state, 'pb'), a[3]); }"""
    sq = pg.evaluate(H, [1, {}, "d1-1", "kg"])
    check("squat: 140 x 5 with 2 left -> about 135 kg x 8 to failure", sq and sq["kg"] == 135 and sq["reps"] == 8 and sq["after"] == "the leg extension", sq)
    be = pg.evaluate(H, [2, {}, "d2-2", "kg"])
    check("incline bench: flat 100 x 5 with 2 left, x0.95 -> 97.5 kg x 6", be and be["kg"] == 97.5 and be["reps"] == 6, be)
    check("Zercher choice gets no hint", pg.evaluate(H, [1, {"d1-1": "zercher"}, "d1-1", "kg"]) is None)
    check("unit mismatch gets no hint", pg.evaluate(H, [1, {}, "d1-1", "plates"]) is None)
    lp = pg.evaluate(H, [1, {}, "d5-1", "plates"])
    check("leg press in plates: 12 x 10 with 2 left -> 12 plates x 10", lp and lp["kg"] == 12 and lp["reps"] == 10, lp)
    check("no Powerbuilding data, no hint", pg.evaluate(H, [1, {}, "d5-4", "kg"]) is None)
    # Shown in the card, below the warm-up/unit line, information only
    pg.evaluate("() => { state.ui.tab = 'train'; state.ui.day = 1; state.ui.openEx = 'd1-1'; renderAll(); }"); pg.wait_for_timeout(150)
    t = pg.inner_text("#ex-d1-1 .pb-hint") if pg.locator("#ex-d1-1 .pb-hint").count() else ""
    check("card shows the hint", "135 kg × 8" in t and "information only" in t and "leg extension" in t, t)
    tgt = pg.evaluate("() => { const c = ctx(); const it = itemOf(c, 'd1-1'); return rowTarget(it, firstWorkRow(it), rowArgs(c, it)).kg; }")
    check("target is not taken from the hint", tgt != 135, tgt)
    # Cable fly options
    rows = pg.evaluate("() => buildHdSession(2, {}, null).groups.reduce((a, g) => a.concat(g.items), []).filter(i => /^Cable Fly/.test(i.name)).map(i => i.id + ':' + i.name + ':' + !!i.optional)")
    check("cable fly: two separate exercises, not optional", rows == ["d2-cflylow:Cable Fly: Low to High:false", "d2-4:Cable Fly: High to Low:false"], rows)
    # One-arm row option on back day
    names = pg.evaluate("() => buildHdSession(5, {}, null).groups[0].items.map(i => i.id + (i.optional ? '*' : ''))")
    check("back day: one-arm row is optional, after the cable row", names == ["d3-0", "d3-1", "d3-2", "d3-5", "d3-3", "d3-onearm*", "d3-hgpull*"], names)
    # Old one-arm machine lat row history moves to the new option; old crossover becomes high to low
    pg.evaluate("""() => { state.lastWeek = {weekStart: '2026-11-02', entries: {'d3-5': {variant: 'machine', unit: 'plates', sets: [{reps: '10', kg: '4'}, {reps: '9', kg: '7'}, {reps: '8', kg: '7'}]}, 'd2-4': {sets: [{reps: '10', kg: '5'}]}}};
        state.varHistory = {'d3-5|machine-both': {sets: [{reps: '8', kg: '9'}]}}; hdMoveSlot(state); }""")
    st = pg.evaluate("() => ({lw: state.lastWeek.entries, vh: state.varHistory})")
    check("machine lat row last week -> one-arm row, machine", st["lw"].get("d3-onearm", {}).get("variant") == "machine" and "d3-5" not in st["lw"], st["lw"])
    check("crossover last week -> cable fly high to low", "d2-4" in st["lw"] and st["lw"]["d2-4"].get("variant") is None, st["lw"].get("d2-4"))
    check("two-arm machine row has no home and is dropped", not any(k.startswith("d3-5|") for k in st["vh"]), st["vh"])
    # Archive recovery for phones that already ran 2026-11-09.1
    seeded = pg.evaluate("""() => { const s = {varHistory: {}}; const arch = {hd: [
        {weekStart: '2026-10-19', entries: {'d3-5': {variant: 'machine', unit: 'plates', sets: [{reps: '10', kg: '4'}, {reps: '9', kg: '6'}, {reps: '9', kg: '6'}]}}},
        {weekStart: '2026-10-26', entries: {'d3-5': {variant: 'machine', unit: 'plates', sets: [{reps: '10', kg: '4'}, {reps: '9', kg: '7'}, {reps: '8', kg: '7'}]}}},
        {weekStart: '2026-11-02', entries: {'d3-5': {variant: 'db', sets: [{reps: '10', kg: '20'}]}}}], pb: []};
      hdSeedFromArchive(s, arch); const first = JSON.parse(JSON.stringify(s.varHistory));
      s.varHistory = {}; hdSeedFromArchive(s, arch); return [first, s.varHistory, s.hdSeeded]; }""")
    check("archive: newest machine row week seeds the one-arm row", seeded[0].get("d3-onearm|machine", {}).get("date") == "2026-10-26", seeded[0])
    check("archive seeding runs once", seeded[1] == {} and seeded[2] == 1, seeded[1:])
    check("no page errors", not errs, errs)
    b.close()
print("FAILS", fails)
