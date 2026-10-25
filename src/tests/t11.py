import datetime
from playwright.sync_api import sync_playwright
import sheetfix
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":360,"height":780}); pg=ctx.new_page(); errs=[]
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
    pg.clock.install(time=datetime.datetime(2026,10,20,9,0,0))
    pg.goto("file:///tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/site/new.html")
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close")
    X="#ex-pb-d2-suitcase"
    pg.click(X+" .exercise__summary")
    print("panel:", pg.inner_text(X).replace("\n"," | ")[:520])
    pg.fill("#pb-d2-suitcase-main-0-kg","24"); pg.select_option("#pb-d2-suitcase-main-0-left","3"); pg.click(X+' [data-kind="main"][data-i="0"] [data-act="log-set"]'); pg.wait_for_timeout(200)
    print("logged:", pg.inner_text(X+' [data-kind="main"][data-i="0"]').replace("\n"," | "), "| row2:", pg.inner_text(X+' [data-kind="main"][data-i="1"] .set-row__head'))
    print("summary:", pg.inner_text(X+" .exercise__target"))
    pg.screenshot(path="shots/97-suitcase.png", full_page=True)
    # swap the carry for a dumbbell farmer walk: metres by default
    pg.click(X+' [data-act="toggle-swap"]'); print("default measure:", pg.evaluate("state.pb.entries['pb-d2-suitcase'].repl.measure"))
    pg.fill("#pb-d2-suitcase-repl-name","Dumbbell farmer walk"); pg.locator("#pb-d2-suitcase-repl-name").blur(); pg.wait_for_timeout(400)
    print("swap fields:", pg.inner_text(X+' [data-kind="repl"][data-i="0"]').replace("\n"," | ")[:300])
    pg.fill("#pb-d2-suitcase-repl-0-reps","40"); pg.fill("#pb-d2-suitcase-repl-0-kg","22.5"); pg.click(X+' [data-kind="repl"][data-i="0"] [data-act="log-set"]'); pg.wait_for_timeout(200)
    print("swap logged:", pg.inner_text(X+' [data-kind="repl"][data-i="0"]').replace("\n"," | "))
    pg.click('[data-tab="history"]'); pg.evaluate("() => { state.ui.histView = 'log'; renderAll(); document.querySelectorAll('details.hist-day').forEach(d => d.open = true); }"); print("history:", pg.inner_text("#hist-body .hist-day").replace("\n"," | "))
    # plan hold swap
    pg.click('[data-tab="train"]'); pg.click(X+' [data-act="toggle-swap"]'); pg.click(X+' [data-act="toggle-swap"]')
    print("ERR", errs)
