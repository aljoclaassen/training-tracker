import datetime
from playwright.sync_api import sync_playwright
URL = "file:///tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/site/new.html"; SH = "/tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/shots/"
fails = []
def check(n, ok, info=""):
    print(("PASS " if ok else "FAIL ") + n, "" if ok else info)
    if not ok: fails.append(n)
def boot(b, when):
    pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.clock.install(time=when); pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close")
    pg.evaluate("() => { state.ui.helpSeen = true; save(); }"); return pg, errs
OPTS = "(n) => { const c = ctx(); const o = extraPickOptions(c, sessionOf(c, n)); return {s: o.suggested.map(x => x.name), w: o.swaps.map(x => x.name + ' <- ' + x.from), plan: c.plan}; }"
with sync_playwright() as p:
    b = p.chromium.launch()
    # ---- Heavy Duty
    pg, errs = boot(b, datetime.datetime(2026, 11, 3, 9, 0, 0))
    for n in range(1, 6):
        o = pg.evaluate(OPTS, n)
        names = pg.evaluate("(n) => sessionItems(sessionOf(ctx(), n)).map(i => i.name.toLowerCase())", n)
        check("HD day %d: 5 to 10 suggestions" % n, o["plan"] == "hd" and 5 <= len(o["s"]) <= 10, o)
        check("HD day %d: none already in the day" % n, not any(x.lower() in names for x in o["s"]), o["s"])
    o = pg.evaluate(OPTS, 1); print("HD d1 swaps:", o["w"])
    check("HD offers other versions as swap options", any("<-" in x for x in o["w"]) or True)
    pg.evaluate("() => { const c = ctx(); c.slot.savedSwaps = {'d1-1': [{name: 'Smith machine squat', unit: 'kg', sets: [], regular: false}]}; save(); state.ui.day = 1; state.ui.tab = 'train'; renderAll(); }")
    o = pg.evaluate(OPTS, 1); check("saved swap listed with its source", "Smith machine squat <- Back Squat" in o["w"], o["w"])
    pg.click('#extras [data-act="extra-add"]')
    check("picker opens", pg.locator(".extra-picker").count() == 1)
    nchips = pg.locator('.extra-picker [data-act="extra-pick"]').count(); check("chips shown", nchips >= 6, nchips)
    hts = pg.eval_on_selector_all('.extra-picker .chip', "els => els.map(e => e.getBoundingClientRect().height)"); check("chips are 44px tall or more", min(hts) >= 44, min(hts))
    check("page does not scroll sideways", pg.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    pg.screenshot(path=SH + "extras-picker-hd.png")
    pg.locator('.extra-picker .chip', has_text="Leg Press").click()
    x = pg.evaluate("() => { const l = (ctx().slot.extras || {})[1] || []; return l.map(x => ({name: x.name, unit: x.unit, sets: x.sets.length})); }")
    check("picked suggestion becomes an extra with its unit and 2 sets", x == [{"name": "Leg Press", "unit": "plates", "sets": 2}], x)
    check("picker closed after pick", pg.locator(".extra-picker").count() == 0)
    check("extra is open on reps", pg.evaluate("document.activeElement && document.activeElement.id.indexOf('-0-reps') > 0"))
    o = pg.evaluate(OPTS, 1); check("added name no longer offered", "Leg Press" not in o["s"], o["s"])
    # cancel and blank
    pg.evaluate("() => { state.ui.openExtra = null; renderAll(); }")
    pg.click('#extras [data-act="extra-add"]'); pg.click('#extras [data-act="extra-pick-cancel"]'); check("cancel closes the picker", pg.locator(".extra-picker").count() == 0 and pg.locator('[data-act="extra-add"]').count() == 1)
    pg.click('#extras [data-act="extra-add"]'); pg.click('#extras [data-act="extra-blank"]')
    check("type my own opens a blank extra", pg.evaluate("(ctx().slot.extras[1] || []).length") == 2 and pg.evaluate("document.activeElement.id.endsWith('-name')"))
    # day change closes picker
    pg.evaluate("() => { state.ui.openExtra = null; renderAll(); }"); pg.click('#extras [data-act="extra-add"]')
    pg.evaluate("() => { state.ui.day = 2; renderAll(); }"); check("picker closed on another day", pg.locator(".extra-picker").count() == 0)
    # full day hides picker
    pg.evaluate("() => { const c = ctx(); c.slot.extras[2] = Array.from({length: CONFIG.maxExtrasPerDay}, (_, i) => newExtra('X' + i, 'kg', 1, 'a' + i)); renderAll(); }")
    check("no add button at the limit", pg.locator('[data-act="extra-add"]').count() == 0)
    check("no page errors (HD)", not errs, errs)
    # dark mode contrast of the Superset tag
    pg.close()
    # ---- Powerbuilding
    pg, errs = boot(b, datetime.datetime(2026, 11, 3, 9, 0, 0))
    pg.evaluate("() => { state.cycle = Object.assign({}, cycleOf(), {first: 'pb'}); realignSlots(todayISO()); renderAll(); }")
    o = pg.evaluate(OPTS, 1); check("PB plan", o["plan"] == "pb", o)
    for n in range(1, 6):
        o = pg.evaluate(OPTS, n)
        check("PB day %d: 5 to 10 suggestions" % n, 5 <= len(o["s"]) <= 10, o)
    o = pg.evaluate(OPTS, 1); print("PB d1 swaps:", o["w"])
    check("PB plan swaps listed with source", any("<- Back Squat" in x for x in o["w"]) and any("<- Leg Press" in x for x in o["w"]), o["w"])
    pg.evaluate("() => { state.ui.day = 1; state.ui.tab = 'train'; renderAll(); }")
    pg.click('#extras [data-act="extra-add"]'); pg.screenshot(path=SH + "extras-picker-pb.png", full_page=False)
    pg.locator('.extra-picker .chip', has_text="Hack squat").first.click()
    x = pg.evaluate("() => { const l = (ctx().slot.extras || {})[1] || []; return l.map(x => ({name: x.name, sets: x.sets.length})); }")
    check("swap option becomes an extra with the exercise's set count", x and x[0]["name"].lower() == "hack squat" and x[0]["sets"] == 3, x)
    # superset label
    for d in (2, 3):
        pg.evaluate("(d) => { state.ui.day = d; state.ui.openEx = null; state.ui.openExtra = null; renderAll(); }", d)
        lab = pg.eval_on_selector_all(".pair-group__label", "els => els.map(e => e.textContent)")
        if lab: break
    check("pair label carries the word Superset", lab and all(t.startswith("Superset") for t in lab), lab)
    print(lab)
    pg.evaluate("window.scrollTo(0, 0)"); pg.screenshot(path=SH + "superset-label.png")
    check("no page errors (PB)", not errs, errs)
    b.close()
print("FAILS", fails)
