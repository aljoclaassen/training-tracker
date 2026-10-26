import datetime
from playwright.sync_api import sync_playwright
URL = "file:///tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/site/new.html"; SH = "/tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/shots/"
fails = []
def check(n, ok, info=""):
    print(("PASS " if ok else "FAIL ") + n, "" if ok else info)
    if not ok: fails.append(n)
LOG = """([id, kg, reps, extra]) => { const c = ctx(); const item = itemOf(c, id); const w = firstWorkRow(item);
  const e = ensureEntry(c.slot, item); e.sets = item.rows.map((r, i) => i === w ? Object.assign({reps: String(reps), kg: String(kg), end: 'clean'}, extra || {}) : {reps: '', kg: ''}); save(); }"""
TGT = """(id) => { const c = ctx(); const item = itemOf(c, id); const w = firstWorkRow(item); const a = rowArgs(c, item); const t = rowTarget(item, w, a); return {text: t.text, kg: t.kg, reps: t.reps, from: t.from || ''}; }"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.clock.install(time=datetime.datetime(2026, 11, 6, 9, 0, 0))   # Friday of HD week 1
    pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close")
    pg.evaluate("() => { state.ui.helpSeen = true; save(); }")
    plan = pg.evaluate("ctx().plan"); check("HD week", plan == "hd", plan)
    # Before Legs A is logged: Legs B falls back to its own rule
    t0 = pg.evaluate(TGT, "d5-0"); check("no partner yet: own rule", t0["from"] == "", t0)
    # Legs A logged 40 kg x 10
    pg.evaluate(LOG, ["d1-0", 40, 10, None])
    t1 = pg.evaluate(TGT, "d5-0"); check("Legs B starts from Legs A", t1["from"] == "partner" and t1["kg"] == 40 and t1["reps"] == 10, t1)
    check("text names day and weekday", "Day 1 (Monday)" in t1["text"] and "40 plates × 10" in t1["text"], t1["text"])
    t1a = pg.evaluate(TGT, "d1-0"); check("Legs A unaffected", t1a["from"] == "", t1a)
    # Calves pair
    pg.evaluate(LOG, ["d1-6", 60, 12, None]); t2 = pg.evaluate(TGT, "d5-6"); check("standing calf pair", t2["from"] == "partner" and t2["kg"] == 60, t2)
    pg.evaluate(LOG, ["d1-7", 45, 15, None]); t3 = pg.evaluate(TGT, "d5-7"); check("seated calf pair", t3["from"] == "partner" and t3["kg"] == 45, t3)
    # Day 3 calves are not paired
    pg.evaluate(LOG, ["d1-6", 60, 12, None]); t4 = pg.evaluate(TGT, "d3-11"); check("Day 3 calves not paired", t4["from"] == "", t4)
    # Missed Legs A: no suggestion
    pg.evaluate("() => { const c = ctx(); const e = c.slot.entries['d1-0']; e.missed = {on: true}; save(); }")
    t5 = pg.evaluate(TGT, "d5-0"); check("missed partner ignored", t5["from"] == "", t5)
    pg.evaluate("() => { const c = ctx(); delete c.slot.entries['d1-0'].missed; save(); }")
    # Different unit: no suggestion
    pg.evaluate("() => { const c = ctx(); c.slot.units['d1-0'] = 'kg'; save(); }")
    t6 = pg.evaluate(TGT, "d5-0"); check("unit mismatch ignored", t6["from"] == "", t6)
    pg.evaluate("() => { const c = ctx(); delete c.slot.units['d1-0']; save(); }")
    # Warm-up follows the suggested weight
    w = pg.evaluate("() => { const c = ctx(); const item = itemOf(c, 'd5-0'); const a = rowArgs(c, item); return hdWarmup(item, 0, a); }")
    check("warm-up follows 40 kg", w and w["workingKg"] == 40, w)
    # Screen
    pg.evaluate("() => { state.ui.day = 5; state.ui.tab = 'today'; renderAll(); }"); pg.wait_for_timeout(300)
    pg.evaluate("() => { const b = document.querySelector('#exercise-list [data-open], #exercise-list button'); }")
    txt = pg.inner_text("#exercise-list")
    check("Legs B shows the day tab", "Legs B" in pg.inner_text("#session-head"), pg.inner_text("#session-head"))
    pg.screenshot(path=SH + "legsb-list.png")
    # PB untouched
    pbp = pg.evaluate("() => ({partner: partnerFor(ctx(), {plan: 'pb', id: 'pb-d5-psquat'}), hdOther: partnerFor(ctx(), {plan: 'hd', id: 'd2-0'})})")
    check("PB has no partner suggestion", pbp["partner"] is None and pbp["hdOther"] is None, pbp)
    check("no page errors", not errs, errs)
    b.close()
print("FAILS", fails)
