import datetime, re
from playwright.sync_api import sync_playwright
URL = "file:///tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/site/new.html"; SH = "/tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/shots/"
fails = []
def check(n, ok, info=""):
    print(("PASS " if ok else "FAIL ") + n, "" if ok else info)
    if not ok: fails.append(n)
with sync_playwright() as p:
    b = p.chromium.launch()
    for first, label in (("hd", "HD"), ("pb", "PB")):
        pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.clock.install(time=datetime.datetime(2026, 11, 3, 9, 0, 0)); pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close")
        pg.evaluate("(f) => { state.ui.helpSeen = true; state.cycle = Object.assign({}, cycleOf(), {first: f}); realignSlots(todayISO()); state.ui.tab = 'train'; renderAll(); save(); }", first)
        for n in range(1, 6):
            pg.evaluate("(n) => { state.ui.day = n; state.ui.openEx = null; renderAll(); }", n); pg.wait_for_timeout(80)
            head = pg.inner_text("#session-head"); m = re.search(r"Takes (about )?(\d+)–(\d+) min, (.*?)\.", head)
            check("%s day %d shows a time line" % (label, n), bool(m), head)
            if m:
                lo, hi = int(m.group(2)), int(m.group(3)); print("  ", label, n, m.group(0))
                if label == "HD": check("HD day %d estimate is believable (30 to 120 min)" % n, 30 <= lo < hi <= 120 and m.group(1) == "about " and "warm-up sets and rests" in m.group(4), m.group(0))
                else: check("PB day %d wording unchanged" % n, m.group(1) is None and m.group(4) == "warm-up included", m.group(0))
        pg.evaluate("window.scrollTo(0, 0)"); pg.evaluate("(n) => { state.ui.day = 1; renderAll(); }", 1); pg.wait_for_timeout(100)
        pg.evaluate("() => document.querySelectorAll('body *').forEach(e => { if (getComputedStyle(e).position === 'fixed' && !e.closest('nav') && !e.matches('nav')) e.style.display = 'none'; })")
        pg.screenshot(path=SH + "time-%s.png" % label.lower())
        check("no page errors (%s)" % label, not errs, errs); pg.close()
    b.close()
print("FAILS", fails)
