import datetime
from playwright.sync_api import sync_playwright
URL = "file:///tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/site/new.html"; SH = "/tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/shots/"
HIDE = "() => document.querySelectorAll('body *').forEach(e => { if (getComputedStyle(e).position === 'fixed' && !e.closest('nav') && !e.matches('nav')) e.style.display = 'none'; })"
def boot(b, pb):
    pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    pg.clock.install(time=datetime.datetime(2026, 11, 3, 9, 0, 0)); pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close")
    pg.evaluate("() => { state.ui.helpSeen = true; save(); }")
    if pb: pg.evaluate("() => { state.cycle = Object.assign({}, cycleOf(), {first: 'pb'}); realignSlots(todayISO()); renderAll(); }")
    return pg
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = boot(b, True)
    pg.evaluate("() => { state.ui.tab = 'train'; state.ui.day = 2; state.ui.openEx = null; renderAll(); }"); pg.wait_for_timeout(5000)
    pg.locator(".pair-group").first.scroll_into_view_if_needed(); pg.evaluate(HIDE); pg.screenshot(path=SH + "superset-closed.png")
    pg.evaluate("() => { state.ui.day = 1; extraPickDay = 0; renderAll(); }")
    pg.evaluate("() => { ctx().slot.savedSwaps = {'pb-d1-squat': [{name: 'Safety-bar squat', unit: 'kg', sets: [], regular: false}]}; save(); }")
    pg.click('#extras [data-act="extra-add"]'); pg.locator(".extra-picker").scroll_into_view_if_needed(); pg.wait_for_timeout(200); pg.evaluate(HIDE); pg.evaluate("window.scrollBy(0, -40)")
    pg.screenshot(path=SH + "picker-pb.png")
    pg.close()
    pg = boot(b, False)
    pg.evaluate("() => { state.ui.tab = 'train'; state.ui.day = 1; renderAll(); }"); pg.wait_for_timeout(5000)
    pg.click('#extras [data-act="extra-add"]'); pg.locator(".extra-picker").scroll_into_view_if_needed(); pg.wait_for_timeout(200); pg.evaluate(HIDE); pg.evaluate("window.scrollBy(0, -40)")
    pg.screenshot(path=SH + "picker-hd.png")
    b.close()
