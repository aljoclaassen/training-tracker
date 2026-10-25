import json, datetime
from playwright.sync_api import sync_playwright
import sheetfix
BASE = "file:///tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/site/"
errors=[]
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 360, "height": 780})
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errors.append(str(e))); pg.on("console", lambda m: errors.append(m.text) if m.type=="error" else None)
    pg.clock.install(time=datetime.datetime(2026,10,21,9,0,0)); pg.goto(BASE+"new.html")
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(300)
    pg.click("#button-setup-save"); pg.wait_for_timeout(300); pg.click("#button-help-close")
    print("Wed 21 Oct:", pg.inner_text("#header-plan"), "| day", pg.evaluate("state.ui.day"), "| hazard:", pg.inner_text("#hazard-bar")[:60])
    pg.click("[data-hz-yes]"); pg.click("#button-missday-confirm"); pg.wait_for_timeout(200)
    print("after miss:", pg.inner_text("#hazard-bar")[:80].replace("\n"," "))
    # second unanswered day -> I trained
    print("hazard now:", pg.inner_text("#hazard-bar")[:60].replace("\n"," "))
    if pg.query_selector("[data-hz-trained]"): pg.click("[data-hz-trained]"); pg.wait_for_timeout(200)
    print("day now:", pg.evaluate("state.ui.day"))
    pg.click("[data-hz-open]"); pg.wait_for_timeout(200)
    print("sheet:", pg.inner_text("#makeup-note")[:120])
    pg.click("[data-sheet-makeup]"); pg.wait_for_timeout(200)
    pg.fill("#makeup-body input[data-f='reps']", "5"); pg.dispatch_event("#makeup-body input[data-f='reps']", "change"); pg.wait_for_timeout(200)
    print("sheet after:", pg.inner_text("#makeup-note")[:140])
    pg.click("#dialog-makeup [data-close]"); pg.wait_for_timeout(200)
    # swap exercise on day 3 (today)
    pg.click("#tab-day-3"); pg.wait_for_timeout(100)
    oid = pg.evaluate("state.ui.openEx"); print("open on day3:", oid)
    if oid != "pb-d3-rdl": pg.click("#ex-pb-d3-rdl .exercise__summary")
    pg.click('#ex-pb-d3-rdl [data-act="toggle-swap"]'); pg.click('#ex-pb-d3-rdl [data-act="use-swap"]')
    pg.select_option("#pb-d3-rdl-repl-reason", "taken"); pg.wait_for_timeout(100)
    print("swap name:", pg.input_value("#pb-d3-rdl-repl-name"), "| advice:", pg.inner_text('#ex-pb-d3-rdl [data-advice="replaced"]'))
    # skip
    pg.click("#ex-pb-d3-nordic .exercise__summary"); pg.click('#ex-pb-d3-nordic [data-act="toggle-missed"]'); pg.select_option("#pb-d3-nordic-missed-reason","injury")
    print("skip advice:", pg.inner_text('#ex-pb-d3-nordic [data-advice="missed"]'))
    print("swaps log:", pg.inner_text("#swaps-log summary"))
    # deadlift variant + catchup from day 3 on day 4? catch-up on day 4
    pg.click("#tab-day-4"); print("catchup:", pg.inner_text("#catchup")[:100].replace("\n"," "))
    # term
    pg.click("#header-week .term"); print("term:", pg.inner_text("#term-box-text")); pg.click("#term-box-close")
    # export, then old app import of HD export
    exp = pg.evaluate("() => { const c=ctx(); return JSON.stringify(buildExport(c.slot,c.plan,c.sessions,{plan:'hd',slot:state},'x')); }")
    # restore with other plan
    pg.evaluate("t => previewRestore(t)", exp); print("restore:", pg.inner_text("#restore-summary"), pg.evaluate("!!pendingRestore.other"))
    pg.evaluate("() => { document.getElementById('restore-other').checked = true; }"); pg.click("#button-restore-go") if False else pg.evaluate("document.getElementById('button-restore-go').click()")
    pg.wait_for_timeout(200); print("after restore pb wk:", pg.evaluate("state.pb.weekStart"), "hd wk:", pg.evaluate("state.weekStart"), "cycle:", pg.evaluate("JSON.stringify(state.cycle)"))
    # Settings switch now
    pg.click("#button-settings"); pg.click("#button-switch-now"); pg.click("#button-switch-confirm"); pg.wait_for_timeout(200)
    print("switched:", pg.inner_text("#header-plan"), pg.inner_text("#header-week"), pg.inner_text("#header-swap"))
    # Plan page view
    pg.click('.bottom-nav [data-tab="plan"]'); pg.wait_for_timeout(200)
    pg.screenshot(path="shots/20-plan.png", full_page=False)
    pg.click('[data-plan-view="pb"]'); pg.click("#plan-guide details >> nth=1"); pg.wait_for_timeout(100)
    pg.screenshot(path="shots/21-plan-pb.png", full_page=True)
    print("ERR", errors)
    b.close()
