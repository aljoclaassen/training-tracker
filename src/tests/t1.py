import json, datetime, sys
from playwright.sync_api import sync_playwright
BASE = "file:///tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/site/"
errors = []
def at(page, iso):
    page.clock.set_fixed_time(datetime.datetime.fromisoformat(iso + "T09:00:00"))
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844})
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(("console", m.type, m.text)) if m.type in ("error",) else None)
    page.on("pageerror", lambda e: errors.append(("pageerror", str(e))))
    # 1. Old app: build real v1 data
    page.clock.install(time=datetime.datetime(2026,10,8,9,0,0))
    page.goto(BASE + "old.html")
    page.wait_for_timeout(300)
    page.evaluate("""() => {
      const set = (id, i, reps, kg) => { const ex = EX_BY_ID[id]; const e = getEntry(ex); e.sets[i].reps = String(reps); e.sets[i].kg = String(kg); e.doneAt = '2026-10-05'; };
      set('d1-1', 2, 9, 100); set('d1-1', 0, 12, 50);
      set('d1-4', 1, 7, 120);
      set('d2-2', 3, 6, 80);
      set('d1-0', 2, 12, 5);
      state.units['d1-0'] = 'plates';
      save();
    }""")
    page.wait_for_timeout(600)
    v1export = page.evaluate("() => JSON.stringify(buildExport())")
    v1state = page.evaluate("() => localStorage.getItem('heavy-duty-tracker-v1')")
    open('v1export.json','w').write(v1export)
    open('v1state.json','w').write(v1state)
    print("old state keys:", list(json.loads(v1state).keys()))
    # 2. New app, same storage, 10 Oct
    page2 = ctx.new_page()
    page2.on("console", lambda m: errors.append(("console", m.type, m.text)) if m.type in ("error",) else None)
    page2.on("pageerror", lambda e: errors.append(("pageerror", str(e))))
    page2.clock.install(time=datetime.datetime(2026,10,10,9,0,0))
    page2.goto(BASE + "new.html")
    page2.wait_for_timeout(400)
    print("setup visible:", page2.is_visible("#setup-panel"))
    page2.screenshot(path="shots/01-setup.png", full_page=True)
    page2.click("#button-setup-save")
    page2.wait_for_timeout(400)
    print("header:", page2.inner_text("#header-plan"), "|", page2.inner_text("#header-week"), "|", page2.inner_text("#header-swap"))
    print("help visible:", page2.is_visible("#help-panel"))
    page2.screenshot(path="shots/02-first.png", full_page=True)
    page2.click("#button-help-close")
    page2.click("#tab-day-1")
    page2.wait_for_timeout(200)
    print("day1 progress:", page2.inner_text("#progress-text"))
    print("squat row:", page2.inner_text("#ex-d1-1 .exercise__main"))
    page2.click("#ex-d1-1 .exercise__summary")
    page2.wait_for_timeout(200)
    page2.screenshot(path="shots/03-hd-open.png", full_page=True)
    st = json.loads(page2.evaluate("() => localStorage.getItem('heavy-duty-tracker-v1')"))
    print("d1-1 sets kept:", st["entries"]["d1-1"]["sets"])
    print("cycle:", st.get("cycle"), "pb weekStart:", st["pb"]["weekStart"])
    print("ERRORS:", errors)
    b.close()
