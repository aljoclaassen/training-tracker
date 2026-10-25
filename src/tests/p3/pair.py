import datetime
from playwright.sync_api import sync_playwright
SH="/tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/shots/"
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    for w,mode in [(360,"dark"),(390,"light")]:
        pg=b.new_page(viewport={"width":w,"height":800}, color_scheme=mode); pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
        pg.clock.install(time=datetime.datetime(2026,10,20,9,0,0))
        pg.goto("file:///tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/site/new.html")
        pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close"); pg.wait_for_timeout(200)
        pg.click("#ex-pb-d2-chin .exercise__summary"); pg.wait_for_timeout(300)
        print(mode, "pair open:", pg.evaluate("!!document.querySelector('.pair-group.is-open')"), "both panels:", pg.evaluate("document.querySelectorAll('.pair-group.is-open .exercise__panel:not([hidden])').length"), "scrollW", pg.evaluate("document.documentElement.scrollWidth"))
        pg.screenshot(path=SH+f"pair-{mode}.png")
        pg.fill("#pb-d2-chin-main-0-reps","8"); pg.fill("#pb-d2-chin-main-0-kg","10"); pg.click('#ex-pb-d2-chin [data-i="0"] [data-act="log-set"]'); pg.wait_for_timeout(250)
        print("  after A1:", pg.inner_text("#toast"), "| focus:", pg.evaluate("document.activeElement.closest('.exercise') && document.activeElement.closest('.exercise').id"))
        pg.fill("#pb-d2-dip-main-0-reps","10"); pg.fill("#pb-d2-dip-main-0-kg","15"); pg.click('#ex-pb-d2-dip [data-i="0"] [data-act="log-set"]'); pg.wait_for_timeout(250)
        print("  after A2 rest:", pg.inner_text("#rest-next"), "| chin active row:", pg.evaluate("activeRows['pb-d2-chin']"))
        pg.screenshot(path=SH+f"pair2-{mode}.png")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(150); print("  closed:", pg.evaluate("state.ui.openEx"), pg.evaluate("!!document.querySelector('.pair-group.is-open')"))
        pg.close()
    print("ERR", errs)
