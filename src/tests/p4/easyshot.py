import datetime
from playwright.sync_api import sync_playwright
URL = "file:///tmp/claude-0/-home-claude/ef2ea838-edd3-5f9a-a5d3-1743d048fa9e/scratchpad/work/site/new.html"; SH = "shots/"
HIDE = "() => document.querySelectorAll('body *').forEach(e => { if (getComputedStyle(e).position === 'fixed' && !e.closest('nav') && !e.matches('nav')) e.style.display = 'none'; })"
def run(label, when, cycle, day, tab="train", scroll=None, w=390):
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={"width": w, "height": 844}, device_scale_factor=2)
        pg.clock.install(time=when); pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close")
        pg.evaluate("(a) => { state.ui.helpSeen = true; state.cycle = a[0]; ensurePbSlot(state, todayISO()); realignSlots(todayISO()); state.ui.day = a[1]; state.ui.openEx = null; state.ui.tab = a[2]; renderAll(); }", [cycle, day, tab])
        pg.wait_for_timeout(200)
        if scroll: pg.evaluate("(s) => { const e = document.querySelector(s); if (e) e.scrollIntoView({block: 'start'}); }", scroll)
        pg.evaluate(HIDE); pg.wait_for_timeout(100)
        pg.screenshot(path=SH + label + ".png", full_page=(tab == "plan" and not scroll)); b.close()
pbc = {"start": "2026-10-05", "first": "pb", "lengths": [7, 2]}
hdc = {"start": "2026-10-05", "first": "hd", "lengths": []}
run("easy-pb-day1", datetime.datetime(2026, 11, 16, 9), pbc, 1)
run("easy-pb-day2", datetime.datetime(2026, 11, 16, 9), pbc, 2)
run("easy-hd-day1", datetime.datetime(2026, 12, 28, 9), hdc, 1)
run("easy-hd-day3", datetime.datetime(2026, 12, 28, 9), hdc, 3)
run("nudge-train", datetime.datetime(2026, 12, 21, 9), {"start": "2026-10-05", "first": "hd", "lengths": [12]}, 1)
run("easy-calendar", datetime.datetime(2026, 12, 14, 9), hdc, 1, "plan", "#calendar")
