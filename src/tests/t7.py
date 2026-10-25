import datetime
from playwright.sync_api import sync_playwright
import sheetfix
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":360,"height":780}); pg=ctx.new_page(); errs=[]
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
    pg.clock.install(time=datetime.datetime(2026,10,12,9,0,0))
    pg.goto("file:///tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/site/new.html")
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close")
    print("open:", pg.evaluate("state.ui.openEx"))
    pg.screenshot(path="shots/50-open.png", full_page=False)
    # Leg extension: warm-up 1 active, type weight then log
    pg.fill("#d1-0-main-0-kg","3"); pg.fill("#d1-0-main-0-reps","15")
    pg.click('#ex-d1-0 [data-i="0"] [data-act="log-set"]'); pg.wait_for_timeout(200)
    print("rest visible after warm-up:", pg.is_visible("#rest-bar"))
    print("rows:", pg.eval_on_selector_all("#ex-d1-0 .set-row", "r => r.map(x => x.className.replace('set-row','').trim() + ':' + x.innerText.replace(/\\n/g,' ').slice(0,50))"))
    pg.fill("#d1-0-main-1-reps","12"); pg.fill("#d1-0-main-1-kg","4"); pg.click('#ex-d1-0 [data-i="1"] [data-act="log-set"]')
    pg.fill("#d1-0-main-2-reps","11"); pg.fill("#d1-0-main-2-kg","6"); pg.click('#ex-d1-0 [data-i="2"] [data-act="log-set"]'); pg.wait_for_timeout(300)
    print("rest visible after main set:", pg.is_visible("#rest-bar"), pg.inner_text("#rest-bar").replace("\n"," | "))
    print("summary:", pg.inner_text("#ex-d1-0 .exercise__main").replace("\n"," | "))
    pg.screenshot(path="shots/51-logged.png", full_page=False)
    pg.clock.run_for(91000); pg.wait_for_timeout(300)
    print("rest after 91s:", pg.inner_text("#rest-next"), pg.evaluate("document.getElementById('rest-bar').className"))
    # edit compact row
    pg.click('#ex-d1-0 [data-i="0"] [data-act="edit-set"]'); print("edit active input:", pg.input_value("#d1-0-main-0-kg"))
    # next week: placeholders
    st = pg.evaluate("() => { storageSave(state); return 1 }")
    pg.click("#button-week-options"); pg.click("#button-new-week"); pg.click("#button-new-week-confirm"); pg.wait_for_timeout(200)
    pg.click("#tab-day-1")
    if pg.evaluate("state.ui.openEx") != "d1-0": pg.click("#ex-d1-0 .exercise__summary")
    print("placeholders:", pg.get_attribute("#d1-0-main-0-kg","placeholder"), pg.get_attribute("#d1-0-main-0-reps","placeholder"))
    pg.click('#ex-d1-0 [data-i="0"] [data-act="log-set"]'); pg.wait_for_timeout(100)
    print("one-tap logged:", pg.evaluate("JSON.stringify(slotOf(state,'hd').entries['d1-0'].sets[0])"))
    print("restSeconds:", pg.evaluate("[restSeconds('90 s','work'), restSeconds('2–3 min','work'), restSeconds('None','set'), restSeconds('2 min after the pair','set'), restSeconds('4 min after the top set, 3 min after back-offs','top'), restSeconds('4 min after the top set, 3 min after back-offs','backoff'), restSeconds('60–90 s','warm')]"))
    pg.emulate_media(color_scheme="dark"); pg.screenshot(path="shots/52-dark.png", full_page=False)
    print("scrollW:", pg.evaluate("document.documentElement.scrollWidth"), "ERR", errs); b.close()
