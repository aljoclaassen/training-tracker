import json, datetime
from playwright.sync_api import sync_playwright
import sheetfix
BASE = "file:///tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/site/"
errors=[]
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 360, "height": 780})
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.clock.install(time=datetime.datetime(2026,10,19,9,0,0)); pg.goto(BASE+"new.html")
    st = json.loads(open('v1state.json').read()); st["cycle"]={"start":"2026-10-05","first":"hd"}; st["ui"]["helpSeen"]=True
    pg.evaluate("s => localStorage.setItem('heavy-duty-tracker-v1', s)", json.dumps(st)); pg.reload(); pg.wait_for_timeout(300)
    exp = open("pbexport.json").read()
    print(pg.evaluate("t => { try { const r = parseBackup(t); return JSON.stringify({plan:r.plan, other: !!r.other, keys: Object.keys(r.data.backup||{})}); } catch(e){ return 'ERR '+e.message } }", exp))
    for (y,m,d) in [(2026,10,26),(2026,11,16),(2026,11,23),(2026,12,14),(2026,12,21)]:
        pg.clock.set_fixed_time(datetime.datetime(y,m,d,9,0,0)); pg.reload(); pg.wait_for_timeout(300)
        # log something so slot isn't empty, then start new week next time
        if pg.query_selector("[data-open-new-week]"):
            pg.click("[data-open-new-week]"); pg.click("#button-new-week-confirm"); pg.wait_for_timeout(200)
        pg.evaluate("() => { const c = ctx(); const it = sessionItems(c.sessions[0]).filter(i=>i.kind==='main')[0]; const e = ensureEntry(c.slot, it); e.sets[0].reps='1'; e.sets[0].kg='120'; e.sets[0].left='2'; save(); renderAll(); }")
        print(y,m,d, pg.inner_text("#header-week").replace(" (what's this?)",""), "| slot", pg.evaluate("state.pb.weekStart"), "|", pg.inner_text("#ex-pb-d1-squat .exercise__target"))
        for n in (4,5):
            pg.click(f"#tab-day-{n}"); 
        print("   day1 notes:", pg.evaluate("ctx().sessions[0].notes"))
        print("   day5 rest:", pg.evaluate("ctx().sessions[4].rest"), "pbench:", pg.evaluate("sessionItems(ctx().sessions[0]).filter(i=>i.id==='pb-d1-pbench')[0].setsText"), "bike:", pg.evaluate("sessionItems(ctx().sessions[1]).filter(i=>i.id==='pb-d2-cardio')[0].setsText"))
    pg.click("#tab-day-1"); pg.wait_for_timeout(100)
    if pg.evaluate("state.ui.openEx") != "pb-d1-squat": pg.click("#ex-pb-d1-squat .exercise__summary")
    pg.screenshot(path="shots/16-testweek.png", full_page=True)
    print("ERR", errors); b.close()
