import datetime, json
from playwright.sync_api import sync_playwright
import sheetfix
URL="file:///tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/site/new.html"
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":360,"height":780}); pg=ctx.new_page(); errs=[]
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
    pg.clock.install(time=datetime.datetime(2026,10,19,9,0,0))
    pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close")
    print("plan:", pg.inner_text("#header-plan"))
    # swap leg press for hack squat, log two sets, make it regular
    pg.click("#ex-pb-d1-legpress .exercise__summary")
    pg.click('#ex-pb-d1-legpress [data-act="toggle-swap"]')
    pg.fill("#pb-d1-legpress-repl-name","Hack squat"); pg.locator("#pb-d1-legpress-repl-name").blur(); pg.wait_for_timeout(400)
    print("swap rows on open:", pg.eval_on_selector_all("#ex-pb-d1-legpress .set-rows", "r => r.map(x => x.dataset.kind + ':' + x.children.length)"), "main hidden:", pg.locator('#ex-pb-d1-legpress .set-rows[data-kind="main"]').count())
    print("swap panel text:", pg.inner_text("#ex-pb-d1-legpress .exercise__panel").replace("\n"," | ")[:600])
    pg.screenshot(path="shots/94-swap-open.png", full_page=True)
    pg.fill("#pb-d1-legpress-repl-0-reps","12"); pg.fill("#pb-d1-legpress-repl-0-kg","80"); pg.select_option("#pb-d1-legpress-repl-0-left","2")
    pg.click('#ex-pb-d1-legpress [data-kind="repl"][data-i="0"] [data-act="log-set"]'); pg.wait_for_timeout(200)
    pg.fill("#pb-d1-legpress-repl-1-reps","12"); pg.fill("#pb-d1-legpress-repl-1-kg","80")
    pg.click('#ex-pb-d1-legpress [data-kind="repl"][data-i="1"] [data-act="log-set"]'); pg.wait_for_timeout(200)
    print("rest after swap set:", pg.inner_text("#rest-next"))
    print("summary:", pg.inner_text("#ex-pb-d1-legpress .exercise__main").replace("\n"," | "))
    pg.check('#ex-pb-d1-legpress input[data-regular]'); pg.wait_for_timeout(200)
    print("toast:", pg.inner_text("#toast"))
    # one-off swap on BSS
    pg.click("#ex-pb-d1-bss .exercise__summary"); pg.click('#ex-pb-d1-bss [data-act="toggle-swap"]')
    pg.fill("#pb-d1-bss-repl-name","Walking lunge"); pg.fill("#pb-d1-bss-repl-0-reps","10"); pg.fill("#pb-d1-bss-repl-0-kg","20"); pg.click('#ex-pb-d1-bss [data-kind="repl"][data-i="0"] [data-act="log-set"]'); pg.wait_for_timeout(300)
    # plank for ab wheel: plan chip, seconds + added weight
    pg.click("#ex-pb-d1-abwheel .exercise__summary"); pg.click('#ex-pb-d1-abwheel [data-act="toggle-swap"]'); pg.click('#ex-pb-d1-abwheel [data-act="use-swap"]'); pg.wait_for_timeout(100)
    print("plank:", pg.input_value("#pb-d1-abwheel-repl-name"), pg.evaluate("state.pb.entries['pb-d1-abwheel'].repl.measure"), pg.inner_text('#ex-pb-d1-abwheel [data-kind="repl"][data-i="0"] .set-row__fields').replace("\n"," | "))
    pg.fill("#pb-d1-abwheel-repl-0-reps","45"); pg.fill("#pb-d1-abwheel-repl-0-kg","10"); pg.click('#ex-pb-d1-abwheel [data-kind="repl"][data-i="0"] [data-act="log-set"]'); pg.wait_for_timeout(200)
    print("plank compact:", pg.inner_text('#ex-pb-d1-abwheel [data-kind="repl"][data-i="0"]').replace("\n"," | "))
    pg.screenshot(path="shots/95-plank.png", full_page=True)
    # log a squat top set
    pg.click("#ex-pb-d1-squat .exercise__summary"); pg.fill("#pb-d1-squat-main-0-reps","5"); pg.fill("#pb-d1-squat-main-0-kg","100"); pg.click('#ex-pb-d1-squat [data-i="0"] [data-act="log-set"]'); pg.wait_for_timeout(200)
    # extra exercise
    pg.click('#extras [data-act="extra-add"]'); pg.click('#extras [data-act="extra-blank"]'); xid=pg.evaluate("state.pb.extras[1][0].id")
    pg.fill("#extra-"+xid+"-name","Push-ups"); pg.fill("#extra-"+xid+"-0-reps","25"); pg.locator("#extra-"+xid+"-0-reps").blur(); pg.wait_for_timeout(400)
    print("extras card:", pg.inner_text("#extras").replace("\n"," | ")[:200])
    pg.screenshot(path="shots/90-extras.png", full_page=True)
    pg.wait_for_timeout(400)
    # history this week
    pg.click('[data-tab="history"]'); pg.evaluate("() => { state.ui.histView = 'log'; renderAll(); document.querySelectorAll('details.hist-day').forEach(d => d.open = true); }"); pg.wait_for_timeout(200)
    print("history now:", pg.inner_text("#hist-body").replace("\n"," | ")[:400])
    pg.screenshot(path="shots/91-history.png", full_page=True)
    # new week via dialog
    pg.click('[data-tab="train"]'); pg.click("#button-week-options"); pg.click("#button-new-week"); pg.click("#button-new-week-confirm"); pg.wait_for_timeout(300)
    print("archive:", pg.evaluate("Object.entries(JSON.parse(localStorage.getItem('training-tracker-archive'))).map(([k,v])=>k+':'+v.map(w=>w.weekStart).join(','))"))
    print("saved:", pg.evaluate("JSON.stringify({s:state.pb.savedSwaps, x:state.pb.savedExtras}).slice(0,400)"))
    print("new week:", pg.evaluate("state.pb.weekStart"), "regular applied:", pg.evaluate("JSON.stringify(state.pb.entries['pb-d1-legpress'] && {r:state.pb.entries['pb-d1-legpress'].replaced, n:state.pb.entries['pb-d1-legpress'].repl.name, s:state.pb.entries['pb-d1-legpress'].repl.sets.length})"))
    pg.evaluate("selectDay(1)")
    pg.click("#ex-pb-d1-legpress .exercise__summary")
    print("swap rows:", pg.inner_text("#ex-pb-d1-legpress .set-rows[data-kind=repl]").replace("\n"," | ")[:400])
    pg.click("#ex-pb-d1-abwheel .exercise__summary"); pg.click('#ex-pb-d1-abwheel [data-act="swap-again"]')
    print("plank next week:", pg.inner_text('#ex-pb-d1-abwheel [data-kind="repl"][data-i="0"]').replace("\n"," | ")[:200])
    pg.click("#ex-pb-d1-legpress .exercise__summary")
    print("placeholder:", pg.get_attribute("#pb-d1-legpress-repl-0-kg","placeholder"), pg.get_attribute("#pb-d1-legpress-repl-0-reps","placeholder"))
    pg.click("#ex-pb-d1-bss .exercise__summary")
    print("swap again line:", pg.inner_text("#ex-pb-d1-bss .remind"))
    pg.click('#ex-pb-d1-bss [data-act="swap-again"]'); pg.wait_for_timeout(100)
    print("after swap again:", pg.input_value("#pb-d1-bss-repl-name"), pg.get_attribute("#pb-d1-bss-repl-0-kg","placeholder"))
    print("extras reminder:", pg.inner_text("#extras .remind"))
    pg.click('#extras [data-act="extra-again"]'); xid=pg.evaluate("state.pb.extras[1][0].id")
    print("extra again:", pg.input_value("#extra-"+xid+"-name"), pg.get_attribute("#extra-"+xid+"-0-reps","placeholder"))
    pg.click('#extra-'+xid+' [data-act="inc"][data-f="reps"]'); print("inc from grey:", pg.input_value("#extra-"+xid+"-0-reps"))
    pg.screenshot(path="shots/92-week2.png", full_page=True)
    # history pick last week, progress
    pg.click('[data-tab="history"]'); pg.evaluate("() => { state.ui.histView = 'log'; renderAll(); document.querySelectorAll('details.hist-day').forEach(d => d.open = true); }"); pg.wait_for_timeout(200)
    print("week options:", pg.eval_on_selector_all("#hist-week option","o=>o.map(x=>x.textContent)"))
    pg.select_option("#hist-week", "2026-10-19"); pg.wait_for_timeout(100); pg.evaluate("document.querySelectorAll('details.hist-day').forEach(d => d.open = true)"); pg.evaluate("document.querySelectorAll('details.hist-day').forEach(d => d.open = true)")
    print("last week view:", pg.inner_text("#hist-body .hist-day").replace("\n"," | ")[:400])
    pg.click('[data-hist-view="progress"]'); pg.select_option("#hist-ex", "pb-d1-legpress"); pg.click(".hist-weeks > summary"); print("progress:", pg.inner_text(".hist-table").replace("\n"," | "))
    pg.click('[data-hist-plan="hd"]'); print("hd empty:", pg.inner_text("#hist-body").replace("\n"," | ")[:200])
    pg.emulate_media(color_scheme="dark"); pg.click('[data-hist-plan="pb"]'); pg.screenshot(path="shots/93-history-dark.png", full_page=True)
    print("scrollW:", pg.evaluate("document.documentElement.scrollWidth"))
    # export carries extras + saved
    exp=json.loads(pg.evaluate("() => { const c=ctx(); return JSON.stringify(buildExport(c.slot,c.plan,c.sessions,null,'x')); }"))
    print("export extras:", list(exp['extras'].keys()), "backup saved:", list(exp['backup']['savedSwaps'].keys()), list(exp['backup']['savedExtras'].keys()))
    # turn regular off
    pg.click('[data-tab="train"]'); pg.evaluate("selectDay(1)"); pg.click("#ex-pb-d1-legpress .exercise__summary") if not pg.is_visible("#ex-pb-d1-legpress input[data-regular]") else None
    pg.uncheck('#ex-pb-d1-legpress input[data-regular]'); print("regular off:", pg.evaluate("state.pb.savedSwaps['pb-d1-legpress'].map(x=>x.regular)"), pg.inner_text("#toast"))
    # reload keeps everything
    pg.wait_for_timeout(500); pg.reload(); pg.wait_for_timeout(200)
    print("after reload extras:", pg.evaluate("state.pb.extras[1].length"), "archive pb:", pg.evaluate("archiveLoad().pb.length"))
    # 14 new weeks -> archive capped at 12
    pg.evaluate("for (let k=0;k<14;k++){ const c=ctx(); archiveWeek(c.plan, Object.assign(buildExport(c.slot,c.plan,c.sessions,null,'x'),{weekStart: addDays('2026-01-05', 7*k)})); }")
    print("archive capped:", pg.evaluate("archiveLoad().pb.length"))
    print("ERR", errs)
