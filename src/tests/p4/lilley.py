"""History clean-up, week letters and powerbuilding predictions."""
import datetime
from playwright.sync_api import sync_playwright
URL = "file:///tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/site/new.html"
SH = "/tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/shots/"
fails = []
def check(n, ok, info=""):
    print(("PASS " if ok else "FAIL ") + n, "" if ok else info)
    if not ok: fails.append(n)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 390, "height": 844}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.clock.install(time=datetime.datetime(2026, 12, 21, 9, 0, 0))   # powerbuilding test week
    pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close")
    # --- formulas
    check("estMax counts reps left", pg.evaluate("estMax(100, 5, 2)") == 123.3)
    check("single with none left is its max", pg.evaluate("estMax(140, 1, 0)") == 140)
    check("HD set to failure = plain Epley", pg.evaluate("estMax(40, 10, '')") == 53.3)
    check("loadForReps rounds down", pg.evaluate("loadForReps(126.7, 5, 2, 'kg')") == 102.5)
    # --- test week predictions
    r = pg.evaluate("""() => { const c = ctx(); const it = itemOf(c, 'pb-d1-squat'); const roles = it.rows.map(r => r.role + ':' + r.left);
      const last = [{kg: '140', reps: '1', left: '2'}];
      const t = [0,1,2,3].map(i => testTarget(it, i, {entry: {sets: []}, unit: 'kg'}, last));
      const after = testTarget(it, 1, {entry: {sets: [{kg: '130', reps: '1', left: '2'}]}, unit: 'kg'}, last);
      const extra = testTarget(it, 3, {entry: {sets: [{}, {}, {kg: '142.5', reps: '1', left: '1'}]}, unit: 'kg'}, last);
      return {roles, t, after, extra, plan: c.plan, test: c.now.testWeek}; }""")
    check("in test week", r["plan"] == "pb" and r["test"], r)
    # e1RM 140×(1+3/30)=154 → 3 left: 154/(1+4/30)=135.9→135; 2 left: 154/1.1=140; 1 left: 154/1.0667=144.4→142.5
    check("test singles predicted", [x["kg"] for x in r["t"][:3]] == [135, 140, 142.5], [x["kg"] for x in r["t"]])
    check("final single technique cue", "Stop if your technique changes" in r["t"][2]["text"], r["t"][2]["text"])
    check("extra try waits for final single", r["t"][3]["kg"] is None and "Only after a clean final single" in r["t"][3]["text"])
    check("today's single updates the estimate", r["after"]["kg"] == 130 and "Today's last single" in r["after"]["text"], r["after"])
    check("extra try +5 kg squat", r["extra"]["kg"] == 147.5 and "clean single" in r["extra"]["text"], r["extra"])
    # test rows now show targets on screen
    pg.evaluate("() => { const c = ctx(); c.slot.lastWeek = {weekStart: '2026-12-14', entries: {'pb-d1-squat': {sets: [{kg: '140', reps: '1', left: '2'}]}}}; state.ui.day = 1; state.ui.openEx = 'pb-d1-squat'; renderAll(); }")
    txt = pg.inner_text("#ex-pb-d1-squat")
    check("test target shown in sheet", "About 135 kg" in txt, txt[:600])
    # --- top-set second opinion
    t = pg.evaluate("""() => { const row = {reps: '5', left: '2'};
      return [topSetCheck(nextTopSet('squat', {kg: '100', reps: '5', left: '0'}, '3', '5', 'kg'), row, {kg: '100', reps: '5', left: '0'}, 'kg'),
              topSetCheck(nextTopSet('squat', {kg: '100', reps: '5', left: '3'}, '3', '5', 'kg'), row, {kg: '100', reps: '5', left: '3'}, 'kg')]; }""")
    check("grind gets a lighter suggestion", t[0].get("predicted") == 92.5 and "warm-ups feel slow" in t[0]["text"], t[0])
    check("as planned: no extra note", "predicted" not in t[1], t[1])
    # --- History: seed powerbuilding weeks (B weeks 26 Oct and 23 Nov)
    pg.evaluate("""() => { const c = ctx(); const it = itemOf(c, 'pb-d2-bench') ? null : null; }""")
    pg.evaluate("""() => { const c = ctx(); const id = 'pb-d1-squat';
      const data = [['2026-10-19', 100, 5, 3], ['2026-10-26', 102.5, 5, 2], ['2026-11-16', 105, 4, 3], ['2026-11-23', 107.5, 4, 2], ['2026-12-14', 125, 1, 2]];
      data.forEach(([ws, kg, reps, left]) => { const w = weekInfo(cycleOf(), ws); const sess = [1,2,3,4,5].map(n => buildSession('pb', n, w, {}));
        const slot = freshSlot(ws); const it = sess[0].groups.map(g => g.items).flat().filter(i => i.id === id)[0];
        const e = ensureEntry(slot, it); e.sets = it.rows.map((r, i) => i === 0 ? {kg: String(kg), reps: String(reps), left: String(left)} : (r.role === 'backoff' ? {kg: String(kg - 10), reps: String(r.reps), left: '3'} : {kg: '', reps: ''}));
        archiveWeek('pb', buildExport(slot, 'pb', sess, null, 'x')); });
      state.ui.histPlan = 'pb'; state.ui.histEx = id; save(); showTab('history'); }""")
    pg.wait_for_timeout(200)
    check("History opens on Progress", pg.get_attribute('[data-hist-view="progress"]', "aria-pressed") == "true")
    head = pg.inner_text(".strength-head")
    # B weeks: 102.5×(1+7/30)=126.4 ; 107.5×(1+6/30)=129.0 → +2.1%
    check("Week B check on track", "Week B check: +2.1%" in head and "On track" in head, head)
    # exercise change keeps the picker in place
    pg.evaluate("window.scrollTo(0, 0)")
    y0 = pg.evaluate("document.getElementById('hist-ex').getBoundingClientRect().top")
    opts = pg.eval_on_selector_all("#hist-ex option", "o => o.map(x => x.value)")
    pg.select_option("#hist-ex", opts[-1]); pg.wait_for_timeout(100)
    y1 = pg.evaluate("document.getElementById('hist-ex').getBoundingClientRect().top")
    check("exercise picker stays put", abs(y1 - y0) < 2 and pg.evaluate("document.activeElement.id") == "hist-ex", (y0, y1))
    pg.select_option("#hist-ex", "pb-d1-squat"); pg.wait_for_timeout(100)
    pg.screenshot(path=SH + "hist-progress.png")
    pg.click(".hist-weeks > summary")
    tbl = pg.inner_text(".hist-table")
    check("table rows carry week letters", "PB run 1 · Week 2" in tbl and "PB run 1 · Week 1" in tbl, tbl[:300])
    # Week log
    pg.click('[data-hist-view="log"]')
    labels = pg.eval_on_selector_all("#hist-week option", "o => o.map(x => x.textContent)")
    check("week select has letters", any(l.startswith("PB run 2 · Week 2 · 23–29 Nov") for l in labels), labels)
    check("days start folded", pg.locator("details.hist-day[open]").count() == 0 and pg.locator("details.hist-day").count() >= 1)
    summ = pg.inner_text("details.hist-day summary")
    check("day heading has week letter", "PB" in summ and "Day 1 · Week 1" in summ, summ)
    pg.click("details.hist-day summary")
    check("day opens on tap", pg.locator("details.hist-day[open]").count() == 1)
    pg.screenshot(path=SH + "hist-log.png")
    check("no sideways scroll", pg.evaluate("document.documentElement.scrollWidth") <= 390)
    print("ERRORS", errs, "FAILS", fails)
