import datetime
from playwright.sync_api import sync_playwright
URL = "file:///tmp/claude-0/-home-claude/ef2ea838-edd3-5f9a-a5d3-1743d048fa9e/scratchpad/work/site/new.html"
fails = []
def check(n, ok, info=""):
    print(("PASS " if ok else "FAIL ") + n, "" if ok else info)
    if not ok: fails.append(n)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 390, "height": 844}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.clock.install(time=datetime.datetime(2026, 11, 3, 9)); pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload()
    pg.click("#button-setup-save"); pg.click("#button-help-close")
    pg.evaluate("() => { state.cycle = {start: '2026-10-05', first: 'pb', lengths: []}; ensurePbSlot(state, todayISO()); realignSlots(todayISO()); state.ui.day = 2; state.ui.openEx = null; renderAll(); }")
    L0 = pg.evaluate("history.length")
    pg.evaluate("() => { state.ui.openEx = 'pb-d2-chin'; renderAll(); }")
    check("pair opened", pg.locator(".pair-group.is-open").count() == 1)
    check("one history entry added", pg.evaluate("history.length") == L0 + 1)
    pg.go_back(); pg.wait_for_timeout(150)
    check("Back closes the superset", pg.locator(".pair-group.is-open").count() == 0 and pg.evaluate("state.ui.openEx") is None)
    check("still in the app", pg.url.endswith("new.html") and pg.locator("#view-train").is_visible())
    pg.evaluate("() => { state.ui.openEx = 'pb-d2-chin'; renderAll(); }")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(150)
    check("closing in app drops the entry", pg.evaluate("history.length") >= L0 and pg.evaluate("state.ui.openEx") is None)
    pg.evaluate("() => { state.ui.openEx = 'pb-d2-chin'; renderAll(); }"); pg.go_back(); pg.wait_for_timeout(100)
    pg.evaluate("() => { state.ui.openEx = 'pb-d2-chin'; renderAll(); }"); pg.go_back(); pg.wait_for_timeout(100)
    check("repeat open and Back works", pg.locator(".pair-group.is-open").count() == 0)
    # single exercise and extra
    pg.evaluate("() => { state.ui.openEx = 'pb-d2-bench'; renderAll(); }"); pg.go_back(); pg.wait_for_timeout(100)
    check("Back closes a single exercise", pg.evaluate("state.ui.openEx") is None)
    check("no page errors", not errs, errs); b.close()
print("FAILS", fails)
