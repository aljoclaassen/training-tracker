"""Past blocks list in the Blocks section, with weeks per plan, and the hard-weeks-in-a-row line (9 November 2026)."""
import datetime
from playwright.sync_api import sync_playwright
URL = "file:///tmp/claude-0/-home-claude/ef2ea838-edd3-5f9a-a5d3-1743d048fa9e/scratchpad/work/site/new.html"
SH = "/tmp/claude-0/-home-claude/ef2ea838-edd3-5f9a-a5d3-1743d048fa9e/scratchpad/w2/shots/"
fails = []
def check(n, ok, info=""):
    print(("PASS " if ok else "FAIL ") + n, "" if ok else info)
    if not ok: fails.append(n)
with sync_playwright() as p:
    b = p.chromium.launch()
    for w, dark in ((360, True), (390, False)):
        pg = b.new_page(viewport={"width": w, "height": 844}, device_scale_factor=2, color_scheme="dark" if dark else "light"); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.clock.install(time=datetime.datetime(2026, 11, 10, 9, 0, 0))
        pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close")
        # Heavy Duty 2 weeks from 21 September, Powerbuilding 3 weeks, Heavy Duty 2 weeks, then Powerbuilding from 9 November
        pg.evaluate("() => { state.ui.helpSeen = true; state.cycle = {start: '2026-09-21', first: 'hd', lengths: [2, 3, 2, 2]}; ensurePbSlot(state, todayISO()); realignSlots(todayISO()); state.ui.tab = 'plan'; state.ui.planSection = 'blocks'; renderAll(); save(); }")
        pg.wait_for_timeout(3000); pg.evaluate("() => document.querySelectorAll('.toast').forEach(e => e.style.display = 'none')")
        check("%d: past blocks list present and closed" % w, pg.locator("details.cal-past").count() == 1 and not pg.evaluate("document.querySelector('details.cal-past').open"))
        pg.click("details.cal-past > summary"); pg.wait_for_timeout(100)
        items = pg.eval_on_selector_all(".cal-past__item", "els => els.map(e => e.innerText.replace(/\\s+/g, ' ').trim())")
        check("%d: newest first, dates and weeks" % w, len(items) == 3 and items[0].startswith("HD Heavy Duty run 2") and "26 October to 8 November" in items[0] and "two weeks" in items[0] and "Powerbuilding run 1 5 October to 25 October 2026 · 3 weeks" in items[1] and "Heavy Duty run 1 21 September to 4 October" in items[2], items)
        tot = pg.inner_text(".cal-past .guide__body > p")
        check("%d: totals per plan" % w, "Heavy Duty: 4 weeks in 2 blocks" in tot and "Powerbuilding: 3 weeks in 1 block" in tot, tot)
        now = pg.inner_text(".cal-now")
        check("%d: now card shows hard weeks in a row" % w, "hard in a row" in now and "after 6" in now, now)
        check("%d: no sideways scroll" % w, pg.evaluate("document.documentElement.scrollWidth <= innerWidth"))
        pg.locator("details.cal-past").scroll_into_view_if_needed(); pg.locator("details.cal-past").screenshot(path=SH + "pastblocks-%d.png" % w)
        check("%d: no page errors" % w, not errs, errs)
        pg.close()
    # Before any block has ended: no list
    pg = b.new_page(); pg.clock.install(time=datetime.datetime(2026, 11, 10, 9, 0, 0)); pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close")
    pg.evaluate("() => { state.cycle = {start: '2026-11-09', first: 'hd', lengths: []}; state.ui.tab = 'plan'; state.ui.planSection = 'blocks'; renderAll(); }")
    check("first block: no past list", pg.locator("details.cal-past").count() == 0)
    b.close()
print("FAILS", fails)
