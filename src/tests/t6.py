import datetime
from playwright.sync_api import sync_playwright
import sheetfix
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":360,"height":780}); errs=[]
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.clock.install(time=datetime.datetime(2026,10,23,9,0,0))
    pg.goto("file:///tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/site/new.html")
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close")
    pg.click("#tab-day-5"); print(pg.inner_text("#ex-pb-d5-farmer .exercise__target"))
    pg.click("#ex-pb-d5-farmer .exercise__summary"); pg.wait_for_timeout(100)
    print(pg.inner_text("#ex-pb-d5-farmer label[for='pb-d5-farmer-main-0-left']"), "|", pg.eval_on_selector_all("#pb-d5-farmer-main-0-left option", "o => o.map(x=>x.textContent)"))
    pg.click("#tab-day-2"); print(pg.inner_text("#ex-pb-d2-suitcase .exercise__target"))
    pg.screenshot(path="shots/40-carry.png", full_page=True); print(errs); b.close()
