import datetime
from playwright.sync_api import sync_playwright
URL = "file:///tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/site/new.html"; SH = "/tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/shots/"
LOG = """([id, kg, reps]) => { const c = ctx(); const item = itemOf(c, id); const w = firstWorkRow(item);
  const e = ensureEntry(c.slot, item); e.sets = item.rows.map((r, i) => i === w ? {reps: String(reps), kg: String(kg), end: 'clean'} : {reps: '', kg: ''}); save(); }"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    pg.clock.install(time=datetime.datetime(2026, 11, 6, 9, 0, 0))
    pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close")
    pg.evaluate("() => { state.ui.helpSeen = true; save(); }")
    pg.evaluate(LOG, ["d1-0", 40, 10])
    pg.evaluate("() => { state.ui.day = 5; state.ui.tab = 'train'; state.ui.openEx = 'd5-0'; renderAll(); }"); pg.wait_for_timeout(300)
    pg.wait_for_timeout(600)
    pg.wait_for_timeout(5000)
    pg.get_by_text("Main set", exact=True).first.click(); pg.wait_for_timeout(500)
    pg.screenshot(path=SH + "legsb-sheet.png")
    sheet = pg.locator("[role=dialog], .sheet").first
    try:
        pg.evaluate("() => { const s = document.querySelector('.sheet__body, .sheet'); if (s) s.scrollTop = 400; }"); pg.wait_for_timeout(200)
        pg.screenshot(path=SH + "legsb-sheet2.png")
    except Exception as e: print(e)
    b.close()
