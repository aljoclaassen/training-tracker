"""Calendar tests: default schedule unchanged, longer blocks, plan rules, switching, slots."""
import sys; sys.path.insert(0, "/tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad")
import sheetfix
from playwright.sync_api import sync_playwright
URL = "file:///tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/site/new.html"
SH = "/tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/shots/"
errs = []; fails = []
def check(name, ok, info=""):
    print(("PASS " if ok else "FAIL ") + name, info if not ok else "")
    if not ok: fails.append(name)
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 360, "height": 780})
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close")
    # 1. Default lengths reproduce the old fixed two-week rule for 300 weeks
    bad = pg.evaluate("""() => { const cy = {start: '2026-10-05', first: 'hd', lengths: []}; const out = [];
      for (let i = 0; i < 300; i++){ const d = addDays('2026-10-05', 7*i), w = weekInfo(cy, d);
        const bi = Math.floor(i/2), plan = bi%2===0 ? 'hd' : 'pb', bw = i%2+1, f = plan==='pb' ? Math.floor(bi/2)%3+1 : null;
        if (w.plan!==plan || w.blockWeek!==bw || (plan==='pb' && (w.fortnight!==f || w.weekLetter!==(bw===1?'A':'B') || w.testWeek!==(f===3&&bw===2))) || w.blockIndex!==bi) out.push(i); }
      const sw = nextSwap(cy, '2026-10-22'); return {out: out.slice(0,5), sw: sw}; }""")
    check("default schedule unchanged", not bad["out"], bad)
    check("default next swap", bad["sw"] == {"date": "2026-11-02", "plan": "hd"}, bad["sw"])
    # 2. Calendar renders on Plans
    pg.click('.bottom-nav [data-tab="plan"]')
    check("calendar shows blocks", pg.locator(".cal-block").count() == 4, pg.locator(".cal-block").count())
    check("current block marked", "Now" in pg.inner_text(".cal-block.is-current .cal-block__title"))
    check("this week marked", pg.inner_text(".cal-week.is-now .cal-week__state") == "This week")
    pg.screenshot(path=SH + "cal-360-default.png", full_page=True)
    # 3. Stay on Powerbuilding 4 more weeks: 6 weeks covers blocks 1, 2, 3 and test week
    cur = pg.evaluate("ctx().now.blockIndex")
    for _ in range(4): pg.click('[data-cal-b="%d"][data-cal-d="1"]' % cur)
    check("PB adds one week at a time", "Add a week" in pg.inner_text('[data-cal-b="%d"][data-cal-d="1"]' % cur))
    labels = pg.locator(".cal-block.is-current .cal-week__label").all_inner_texts()
    check("PB 6-week block labels", labels == ["Week A · block 1", "Week B · block 1", "Week A · block 2", "Week B · block 2", "Heavy week · block 3", "Test week"], labels)
    notes = pg.inner_text(".cal-block.is-current .cal-notes")
    check("PB notes describe blocks", "block 2, top sets of 4 reps" in notes and "test week" in notes, notes)
    check("focus kept on add button", pg.evaluate("document.activeElement.dataset.calD") == "1")
    check("header swap moved", "Monday 30 November 2026" in pg.evaluate("nextSwap(cycleOf(), todayISO()).date === '2026-11-30' ? 'Monday 30 November 2026' : JSON.stringify(nextSwap(cycleOf(), todayISO()))"))
    check("toast says new length", "6 weeks" in pg.inner_text("#toast"), pg.inner_text("#toast"))
    # Week 3 session (fortnight 2) uses 4-rep top sets
    sess = pg.evaluate("() => { const w = weekInfo(cycleOf(), '2026-11-02'); const s = buildSession('pb', 1, w, {}); return [w.fortnight, w.weekLetter, s.groups.map(g => g.items.map(i => i.rows.map(r => r.reps).join('/')).join(' ')).join(' | ')]; }")
    check("week 3 is block 2 Week A", sess[0] == 2 and sess[1] == "A", sess)
    # 4. Can't shrink the current block below this week
    for _ in range(5): pg.click('[data-cal-b="%d"][data-cal-d="-1"]' % cur)
    check("PB block down to 1 week", pg.evaluate("blockLength(cycleOf(), %d)" % cur) == 1)
    dis = pg.evaluate("document.querySelector('[data-cal-b=\"%d\"][data-cal-d=\"-1\"]').disabled" % cur)
    check("remove disabled at minimum", dis)
    # 5. Stay on Heavy Duty longer next time: one week at a time, up to 12
    nxt = cur + 1
    for _ in range(2): pg.click('[data-cal-b="%d"][data-cal-d="1"]' % nxt)
    hd = pg.locator('.cal-block--hd').first.locator(".cal-week__label").all_inner_texts()
    check("HD 4-week labels", hd == ["Week 1 of 4", "Week 2 of 4", "Week 3 of 4", "Week 4 of 4"], hd)
    check("HD long-run tip", "Long run" in pg.locator('.cal-block--hd').first.inner_text())
    ret = pg.locator('.cal-block--pb').nth(1).inner_text()
    check("PB return note after long HD run", "Back after 4 weeks of Heavy Duty" in ret, ret[:300])
    for _ in range(10): 
        btn = pg.locator('[data-cal-b="%d"][data-cal-d="1"]' % nxt)
        if btn.is_disabled(): break
        btn.click()
    check("HD max 12 weeks", pg.evaluate("blockLength(cycleOf(), %d)" % nxt) == 12)
    check("reset button shown", pg.locator("[data-cal-reset]").count() == 1)
    pg.click("[data-cal-reset]")
    check("reset upcoming", pg.evaluate("blockLength(cycleOf(), %d)" % nxt) == 2)
    pg.evaluate("() => { state.cycle = withBlockLength(cycleOf(), %d, 2); renderAll(); }" % cur)
    # 6. Powerbuilding continues where it left off in the next PB run (odd lengths via switch)
    pg.evaluate("() => { state.cycle = withBlockLength(cycleOf(), %d, 3); renderAll(); }" % cur)
    nb = pg.evaluate("() => { const w = weekInfo(cycleOf(), nextWeekForPlan(cycleOf(), 'pb', '2026-11-16')); return [w.weekStart, w.weekLetter, w.fortnight]; }")
    check("next PB run picks up at Week B", nb[1] == "B" and nb[2] == 2, nb)
    pg.evaluate("() => { state.cycle = withBlockLength(cycleOf(), %d, 2); renderAll(); }" % cur)
    # 7. Switch this week keeps past weeks the same
    before = pg.evaluate("() => [weekInfo(cycleOf(), '2026-10-05').plan, weekInfo(cycleOf(), '2026-10-12').blockWeek, weekInfo(cycleOf(), '2026-10-19').plan]")
    pg.click("[data-cal-switch]"); pg.click("#button-switch-confirm")
    after = pg.evaluate("() => [weekInfo(cycleOf(), '2026-10-05').plan, weekInfo(cycleOf(), '2026-10-12').blockWeek, weekInfo(cycleOf(), '2026-10-19').plan]")
    check("switch keeps past weeks", before[:2] == after[:2] and after[2] == "hd", [before, after])
    check("today is HD after switch", pg.evaluate("ctx().plan") == "hd" and pg.evaluate("state.weekStart") == "2026-10-19")
    check("pb slot moved to next pb week", pg.evaluate("state.pb.weekStart") == pg.evaluate("nextWeekForPlan(cycleOf(), 'pb', todayISO())"))
    # 8. Header link opens calendar
    hdr = pg.inner_text("#header-swap")
    check("header has calendar link", "Change in calendar" in hdr, hdr)
    pg.click("[data-go-calendar]")
    check("link opens calendar", pg.evaluate("state.ui.tab") == "plan" and pg.evaluate("document.activeElement.id") == "calendar-title")
    # 9. Saved and reloaded
    pg.wait_for_timeout(500); pg.reload()
    check("lengths survive reload", pg.evaluate("JSON.stringify(state.cycle.lengths)") == pg.evaluate("JSON.stringify(cycleOf().lengths)") and pg.evaluate("cycleOf().lengths.length") >= 2)
    # Bad stored lengths are cleaned
    pg.evaluate("() => { const raw = JSON.parse(localStorage.getItem('heavy-duty-tracker-v1')); raw.cycle.lengths = ['x', -3, 99, 4]; localStorage.setItem('heavy-duty-tracker-v1', JSON.stringify(raw)); }"); pg.reload()
    check("bad lengths cleaned", pg.evaluate("JSON.stringify(state.cycle.lengths)") == "[2,2,2,4]", pg.evaluate("JSON.stringify(state.cycle.lengths)"))
    # Old saves without lengths load fine
    pg.evaluate("() => { const raw = JSON.parse(localStorage.getItem('heavy-duty-tracker-v1')); delete raw.cycle.lengths; localStorage.setItem('heavy-duty-tracker-v1', JSON.stringify(raw)); }"); pg.reload()
    check("old save loads", pg.evaluate("JSON.stringify(state.cycle.lengths)") == "[]")
    # 10. Sideways scroll and dark mode screenshot
    pg.click('.bottom-nav [data-tab="plan"]')
    for w in (320, 360, 412):
        pg.set_viewport_size({"width": w, "height": 780})
        check("no sideways scroll @%d" % w, pg.evaluate("document.documentElement.scrollWidth") <= w)
    pg.set_viewport_size({"width": 360, "height": 780})
    pg.evaluate("document.documentElement.setAttribute('data-theme','dark')")
    pg.screenshot(path=SH + "cal-360-dark.png", full_page=False)
    pg.evaluate("document.documentElement.setAttribute('data-theme','light')")
    pg.click('.bottom-nav [data-tab="train"]')
    pg.screenshot(path=SH + "cal-today-360.png")
print("ERRORS", errs, "FAILS", fails)
