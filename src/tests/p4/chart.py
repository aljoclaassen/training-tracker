import datetime, sys
sys.path.insert(0, "/tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad")
from playwright.sync_api import sync_playwright
SH = "/tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/shots/"
fails = []
def check(n, ok, info=""):
    print(("PASS " if ok else "FAIL ") + n, "" if ok else info)
    if not ok: fails.append(n)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 390, "height": 844}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.clock.install(time=datetime.datetime(2026, 11, 9, 9, 0, 0))
    pg.goto("file:///tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/site/new.html")
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close")
    # Heavy Duty: same weight, reps going up, then weight up with fewer reps; plus a bodyweight exercise
    pg.evaluate("""() => { const c = ctx(); const item = c.sessions[0].groups[0].items.filter(i => i.rows.some(r => r.role === 'work'))[0];
      window._id = item.id; const w = item.rows.findIndex(r => r.role === 'work');
      const weeks = [['2026-09-07', 40, 8], ['2026-09-14', 40, 10], ['2026-10-05', 40, 12], ['2026-10-12', 42.5, 9], ['2026-11-02', 42.5, 11]];
      weeks.forEach(([ws, kg, reps]) => { const e = ensureEntry(c.slot, item); e.sets = item.rows.map((r, i) => i === w ? {reps: String(reps), kg: String(kg), end: 'clean'} : {reps: '', kg: ''});
        const x = JSON.parse(JSON.stringify(buildExport(c.slot, c.plan, c.sessions, null, 'x'))); x.weekStart = ws; archiveWeek(c.plan, x); });
      c.slot.entries = {}; state.ui.histEx = item.id; save(); showTab('history'); }""")
    pg.wait_for_timeout(300)
    check("three charts", pg.locator(".chart-stack svg").count() == 3, pg.locator(".chart-stack svg").count())
    titles = pg.eval_on_selector_all(".chart__title", "els => els.map(e => e.textContent)")
    check("chart titles", titles[0].startswith("Strength") and titles[1].startswith("Weight") and titles[2].startswith("Reps"), titles)
    v = pg.inner_text(".strength-head__value")
    check("estimated max headline", v.startswith("58.1"), v)   # 42.5 × (1 + 11/30) = 58.08
    check("strength change", "+7.4" in pg.inner_text(".strength-head"), pg.inner_text(".strength-head"))
    check("rep-only gain shows on strength line", pg.evaluate("estMax(40,10) > estMax(40,8)"))
    check("readout latest", "42.5 plates × 11" in pg.inner_text(".chart-readout"), pg.inner_text(".chart-readout"))
    pg.locator(".chart-stack").scroll_into_view_if_needed(); box = pg.locator(".chart-stack svg").first.bounding_box()
    pg.mouse.move(box["x"] + box["width"] * 0.16, box["y"] + 50)
    check("hover picks week", "40 plates × 8" in pg.inner_text(".chart-readout") or "40 plates × 10" in pg.inner_text(".chart-readout"), pg.inner_text(".chart-readout"))
    check("guide shown in all", pg.locator('.chart__guide[visibility="visible"]').count() == 3)
    pg.focus(".chart-stack"); pg.keyboard.press("End"); pg.keyboard.press("ArrowLeft")
    check("keyboard picks week", "42.5 plates × 9" in pg.inner_text(".chart-readout"), pg.inner_text(".chart-readout"))
    pg.click(".hist-weeks > summary")
    check("table shows est max", "Est. max" in pg.inner_text(".hist-table"))
    check("no sideways scroll", pg.evaluate("document.documentElement.scrollWidth") <= 390)
    pg.evaluate("document.querySelector('.hist-progress').scrollIntoView()"); pg.wait_for_timeout(100)
    pg.screenshot(path=SH + "chart-light.png")
    pg.evaluate("applyMode('dark')"); pg.wait_for_timeout(300); pg.evaluate("document.querySelector('.hist-progress').scrollIntoView()")
    pg.screenshot(path=SH + "chart-dark.png")
    pg.set_viewport_size({"width": 320, "height": 700})
    check("no sideways scroll 320", pg.evaluate("document.documentElement.scrollWidth") <= 320)
    print("ERRORS", errs, "FAILS", fails)
