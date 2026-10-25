import datetime
from playwright.sync_api import sync_playwright
import sheetfix
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":360,"height":780}); pg=ctx.new_page(); errs=[]
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
    pg.clock.install(time=datetime.datetime(2026,10,12,9,0,0))
    pg.goto("file:///tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/site/new.html")
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close")
    pg.click('#ex-d1-0 [data-act="toggle-swap"]'); pg.fill("#d1-0-repl-name","Sissy squat machine"); pg.locator("#d1-0-repl-name").blur(); pg.wait_for_timeout(400)
    print("labels:", pg.eval_on_selector_all('#ex-d1-0 .set-rows[data-kind="repl"] .set-row', "r=>r.map(x=>x.innerText.split('\\n')[0])"))
    for i,(r,k) in enumerate([("15","20"),("12","30"),("12","45")]):
        pg.fill(f"#d1-0-repl-{i}-reps",r); pg.fill(f"#d1-0-repl-{i}-kg",k); pg.click(f'#ex-d1-0 [data-kind="repl"][data-i="{i}"] [data-act="log-set"]'); pg.wait_for_timeout(150)
    print("set end select on main:", pg.locator('#d1-0-repl-2-end').count())
    print("summary:", pg.inner_text("#ex-d1-0 .exercise__target"))
    pg.click("#button-week-options"); pg.click("#button-new-week"); pg.click("#button-new-week-confirm"); pg.wait_for_timeout(300)
    pg.evaluate("selectDay(1)"); pg.click("#ex-d1-0 .exercise__summary") if not pg.is_visible('#ex-d1-0 [data-act="swap-again"]') else None
    pg.click('#ex-d1-0 [data-act="swap-again"]'); pg.wait_for_timeout(100)
    print("warm-up 1:", pg.inner_text('#ex-d1-0 [data-kind="repl"][data-i="0"]').replace("\n"," | ")[:250])
    pg.click('#ex-d1-0 [data-kind="repl"][data-i="2"] [data-act="edit-set"]')
    print("main:", pg.inner_text('#ex-d1-0 [data-kind="repl"][data-i="2"]').replace("\n"," | ")[:250])
    pg.screenshot(path="shots/96-hd-swap.png", full_page=True)
    print("ERR", errs)
