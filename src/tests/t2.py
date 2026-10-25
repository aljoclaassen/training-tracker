import json, datetime
from playwright.sync_api import sync_playwright
import sheetfix
BASE = "file:///tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/site/"
errors = []
v1state = open('v1state.json').read()
def mk(ctx, y, m, d, state=None):
    pg = ctx.new_page()
    pg.on("console", lambda x: errors.append((y,m,d,"console", x.text)) if x.type == "error" else None)
    pg.on("pageerror", lambda e: errors.append((y,m,d,"pageerror", str(e))))
    pg.clock.install(time=datetime.datetime(y,m,d,9,0,0))
    pg.goto(BASE + "new.html")
    if state is not None:
        pg.evaluate("s => localStorage.setItem('heavy-duty-tracker-v1', s)", state)
        pg.reload()
    pg.wait_for_timeout(400)
    return pg
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 360, "height": 780})
    st = json.loads(v1state); st["cycle"] = {"start": "2026-10-05", "first": "hd"}; st["ui"]["helpSeen"] = True
    # Monday 19 Oct: PB week A
    pg = mk(ctx, 2026,10,19, json.dumps(st))
    print("19 Oct header:", pg.inner_text("#header-plan"), "|", pg.inner_text("#header-week"), "|", pg.inner_text("#header-swap"))
    print("open ex:", pg.evaluate("state.ui.openEx"), "day:", pg.evaluate("state.ui.day"))
    print("hazard visible:", pg.is_visible("#hazard-bar"))
    print("squat summary:", pg.inner_text("#ex-pb-d1-squat .exercise__target") if pg.query_selector("#ex-pb-d1-squat") else None)
    pg.screenshot(path="shots/10-pb-mon.png", full_page=False)
    # open squat, finder
    if pg.evaluate("state.ui.openEx") != "pb-d1-squat":
        pg.click("#ex-pb-d1-squat .exercise__summary")
    pg.click('#ex-pb-d1-squat [data-act="finder-open"]')
    pg.wait_for_timeout(200)
    print("guess:", pg.input_value("#pb-d1-squat-finder-guess"))
    pg.select_option("#pb-d1-squat-finder-left", "4")
    pg.wait_for_timeout(200)
    print("after 4 left:", pg.input_value("#pb-d1-squat-finder-guess"), "|", pg.inner_text("#ex-pb-d1-squat .advice"))
    pg.select_option("#pb-d1-squat-finder-left", "3")
    pg.wait_for_timeout(200)
    pg.screenshot(path="shots/11-finder.png", full_page=True)
    pg.click('#ex-pb-d1-squat [data-act="finder-use"]')
    pg.wait_for_timeout(200)
    print("top kg:", pg.input_value("#pb-d1-squat-main-0-kg"))
    pg.fill("#pb-d1-squat-main-0-reps", "5")
    pg.press("#pb-d1-squat-main-0-reps", "Tab")
    pg.select_option("#pb-d1-squat-main-0-left", "2")
    pg.wait_for_timeout(200)
    print("est max:", [t for t in pg.inner_text("#ex-pb-d1-squat").split("\n") if "Estimated" in t])
    print("backoff hint:", [t for t in pg.inner_text("#ex-pb-d1-squat").split("\n") if "lighter" in t][:2])
    # backoff stepper from suggestion
    pg.click('#ex-pb-d1-squat [data-i="0"] [data-act="log-set"]'); pg.wait_for_timeout(200)
    pg.click('#ex-pb-d1-squat [data-kind="main"][data-i="1"] [data-act="inc"][data-f="kg"]')
    print("backoff kg after +:", pg.input_value("#pb-d1-squat-main-1-kg"))
    pg.screenshot(path="shots/12-squat-logged.png", full_page=True)
    pg.click('#ex-pb-d1-squat [data-act="close"]')
    pg.wait_for_timeout(300)
    print("open after close:", pg.evaluate("state.ui.openEx"))
    # Export PB week
    exp = pg.evaluate("() => { const c = ctx(); return JSON.stringify(buildExport(c.slot, c.plan, c.sessions, {plan:'hd', slot: state}, 'x')); }")
    e = json.loads(exp)
    print("export plan:", e["plan"], "version:", e["version"], "entries:", list(e["entries"].keys())[:4], "other:", e["backup"]["otherPlan"]["plan"])
    open("pbexport.json","w").write(exp)
    # Load v1 export into Load last week -> should go to HD
    pg.evaluate("t => doLoad(t)", open('v1export.json').read())
    print("hd lastWeek:", pg.evaluate("state.lastWeek && state.lastWeek.weekStart"), "pb lastWeek:", pg.evaluate("state.pb.lastWeek"))
    print("toast:", pg.inner_text("#toast"))
    # Test week check: 21 Dec
    full = pg.evaluate("() => localStorage.getItem('heavy-duty-tracker-v1')")
    pg3 = mk(ctx, 2026,12,21, full)
    print("21 Dec:", pg3.inner_text("#header-week"))
    print("21 Dec squat:", pg3.inner_text("#ex-pb-d1-squat .exercise__target"))
    pg3.click("#tab-day-5"); print("day5:", pg3.inner_text("#up-next"))
    pg3.click("#tab-day-4"); print("day4 counted:", pg3.inner_text("#progress-text"))
    pg4 = mk(ctx, 2026,12,14, full); print("14 Dec:", pg4.inner_text("#header-week"), "|", pg4.inner_text("#ex-pb-d1-squat .exercise__target"))
    pg4.click("#tab-day-5"); print("sprints:", pg4.inner_text("#ex-pb-d5-sprints .exercise__main"))
    pg5 = mk(ctx, 2026,11,16, full); print("16 Nov:", pg5.inner_text("#header-week"), "|", pg5.inner_text("#ex-pb-d1-squat .exercise__target"))
    pg5.click("#tab-day-2"); print("bike F2:", pg5.inner_text("#ex-pb-d2-cardio .exercise__target"))
    pg5.click("#tab-day-1"); print("pbench F2:", pg5.inner_text("#ex-pb-d1-pbench .exercise__target"))
    # Back to HD 2 Nov
    pg6 = mk(ctx, 2026,11,2, full)
    print("2 Nov:", pg6.inner_text("#header-plan"), pg6.inner_text("#header-week"), "| banner:", pg6.inner_text("#week-banner"))
    pg6.click("[data-open-new-week]"); pg6.click("#button-new-week-confirm"); pg6.wait_for_timeout(300)
    print("HD weekStart:", pg6.evaluate("state.weekStart"), "lastWeek:", pg6.evaluate("state.lastWeek.weekStart"))
    pg6.click("#tab-day-1"); pg6.click("#ex-d1-1 .exercise__summary") if pg6.evaluate("state.ui.openEx") != "d1-1" else None
    pg6.wait_for_timeout(200)
    print("HD targets:", [t for t in pg6.inner_text("#ex-d1-1").split("\n") if "Target" in t or "Last time" in t or "Use" in t][:5])
    pg6.screenshot(path="shots/13-hd-return.png", full_page=True)
    # PB slot 2 Nov: pb weekStart still 19 Oct; check pb no prompt; 16 Nov PB banner
    print("pg5 banner 16 Nov:", pg5.inner_text("#week-banner")[:120])
    # Restore round-trip
    pg6.evaluate("t => previewRestore(t)", open("pbexport.json").read())
    print("restore summary:", pg6.inner_text("#restore-summary"), "other row hidden:", pg6.is_hidden("#restore-other-row"))
    # Plan view
    pg6.click('.bottom-nav [data-tab="plan"]'); pg6.wait_for_timeout(200)
    pg6.click('[data-plan-view="pb"]'); pg6.wait_for_timeout(200)
    pg6.screenshot(path="shots/14-plan-pb.png", full_page=True)
    sw = pg6.evaluate("document.documentElement.scrollWidth")
    print("scrollWidth @360:", sw)
    # dark mode
    pg6.emulate_media(color_scheme="dark"); pg6.click('.bottom-nav [data-tab="train"]'); pg6.wait_for_timeout(200)
    pg6.screenshot(path="shots/15-dark.png")
    print("RPE/RIR on screen:", [w for w in ("RPE","RIR","e1RM") if w in pg6.inner_text("body")])
    print("ERRORS:", errors)
    b.close()
