"""Easy week tests: schedule rules, PB easy week, HD easy week, targets, last-week protection, calendar toggles, old saves."""
import sys, datetime, json
sys.path.insert(0, "/tmp/claude-0/-home-claude/ef2ea838-edd3-5f9a-a5d3-1743d048fa9e/scratchpad/work")
import sheetfix
from playwright.sync_api import sync_playwright
URL = "file:///tmp/claude-0/-home-claude/ef2ea838-edd3-5f9a-a5d3-1743d048fa9e/scratchpad/work/site/new.html"
fails = []
def check(n, ok, info=""):
    print(("PASS " if ok else "FAIL ") + n, "" if ok else info)
    if not ok: fails.append(n)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 360, "height": 780}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.clock.install(time=datetime.datetime(2026, 11, 3, 9, 0, 0)); pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload()
    pg.click("#button-setup-save"); pg.click("#button-help-close")
    # 1. Schedule: nothing changes before the start date; the week after a test week is easy
    r = pg.evaluate("""() => { const cy = {start: '2026-10-05', first: 'hd', lengths: []}; const out = {early: [], easy: []};
      for (let i = 0; i < 40; i++){ const w = weekInfo(cy, addDays('2026-10-05', 7*i)); if (w.easy) out.easy.push([i, w.plan, w.easyAuto]); }
      for (let i = 0; i < 12; i++){ const w = weekInfo(cy, addDays('2026-10-05', 7*i)), bi = Math.floor(i/2), plan = bi%2===0?'hd':'pb';
        if (w.plan !== plan || w.easy || (plan==='pb' && w.fortnight !== Math.floor(bi/2)%3+1)) out.early.push(i); }
      return out; }""")
    check("first 12 weeks unchanged", not r["early"], r)
    check("easy week follows each test week (HD block, every 12th week)", r["easy"][:3] == [[12, "hd", True], [24, "hd", True], [36, "hd", True]], r["easy"])
    r = pg.evaluate("""() => { const cy = {start: '2026-10-05', first: 'pb', lengths: [7, 2]}; const out = [];
      for (let i = 0; i < 12; i++){ const w = weekInfo(cy, addDays('2026-10-05', 7*i)); out.push([i, w.plan, w.easy, w.fortnight, w.weekLetter, w.testWeek, w.pbWeek]); } return out; }""")
    check("PB block of 7: test week 6, easy week 7, wave carries on", r[5][5] is True and r[6][2] is True and r[6][1] == "pb" and r[6][5] is False, r[:8])
    r = pg.evaluate("""() => { const cy = {start: '2026-10-05', first: 'pb', lengths: [8, 2, 2]}; return [7, 8, 9, 10].map(i => { const w = weekInfo(cy, addDays('2026-10-05', 7*i)); return [i, w.plan, w.easy, w.fortnight, w.weekLetter]; }); }""")
    check("PB wave resumes at block 1 Week A after the easy week", r[0][1] == "pb" and r[0][3] == 1 and r[0][4] == "A" and r[0][2] is False, r)
    # 2. Hand-set weeks and turning the automatic one off
    r = pg.evaluate("""() => { let cy = {start: '2026-10-05', first: 'hd', lengths: []};
      const a = weekInfo(cy, '2026-11-09').easy; cy = withEasyWeek(cy, 5, true); const b = weekInfo(cy, '2026-11-09');
      cy = withEasyWeek(cy, 12, false); const c = weekInfo(cy, '2026-12-28'); const d = weekInfo(cy, '2026-12-21'); cy = withEasyWeek(cy, 12, null); const e = weekInfo(cy, '2026-12-28');
      const n = weekInfo({start: '2026-10-05', first: 'hd', lengths: [], easy: {}}, '2026-11-09').easy;
      return [a, b.easy, c.easy, d.easy, e.easy, n, JSON.stringify(withEasyOf({easy: {3: true}}, {}).easy)]; }""")
    check("toggle on, off, and back to automatic", r[:6] == [False, True, False, False, True, False], r)
    # 3. Nudge counter
    r = pg.evaluate("""() => { const cy = {start: '2026-10-05', first: 'hd', lengths: [20]}; return [4, 9, 10, 11].map(i => weekInfo(cy, addDays('2026-10-05', 7*i)).hardRun); }""")
    check("hard run counts from the start date and resets on an easy week", r == [0, 5, 6, 7], r)
    # 4. Sessions
    pg.evaluate("() => { state.ui.helpSeen = true; }")
    r = pg.evaluate("""() => { const cy = {start: '2026-10-05', first: 'pb', lengths: [7, 2]}, w = weekInfo(cy, '2026-11-16'), out = {};
      for (let n = 1; n <= 5; n++){ const s = buildSession('pb', n, w, {}); out[n] = {easy: s.easy, time: s.time, notes: s.notes[0], items: s.groups.flatMap(g => g.items).map(i => ({id: i.id, kind: i.kind, skipped: i.skipped, rows: i.rows.map(r => r.role + ':' + r.reps + ':' + r.left).join(','), sets: i.setsText, counted: i.counted})) }; }
      return out; }""")
    d1 = {i["id"]: i for i in r["1"]["items"]}; d2 = {i["id"]: i for i in r["2"]["items"]}; d4 = {i["id"]: i for i in r["4"]["items"]}; d3 = {i["id"]: i for i in r["3"]["items"]}; d5 = {i["id"]: i for i in r["5"]["items"]}
    check("PB easy: main lift 2 x 5 with 4 left", d1["pb-d1-squat"]["rows"] == "set:5:4,set:5:4" and d1["pb-d1-squat"]["sets"] == "2 × 5", d1["pb-d1-squat"])
    check("PB easy: 3-set accessory becomes 2 sets, 2-set becomes 1", d1["pb-d1-legpress"]["rows"].count("set") == 2 and d1["pb-d1-bss"]["rows"].count("set") == 1 and d1["pb-d1-legpress"]["sets"].startswith("2 ×"), (d1["pb-d1-legpress"], d1["pb-d1-bss"]))
    check("PB easy: accessories ask for 3 left", all(x.endswith(":3") for x in d1["pb-d1-legpress"]["rows"].split(",")), d1["pb-d1-legpress"])
    check("PB easy: carries, Nordics and sprints skipped", d2["pb-d2-suitcase"]["skipped"] and d3["pb-d3-nordic"]["skipped"] and d5["pb-d5-farmer"]["skipped"] and d5["pb-d5-sprints"]["skipped"])
    check("PB easy: bike and stretching kept", not d2["pb-d2-cardio"]["skipped"] and not d4["pb-d4-cardio"]["skipped"] and not d4["pb-d4-stretch"]["skipped"])
    check("PB easy: shorter time and a note on every day", all(r[str(n)]["easy"] and r[str(n)]["notes"].startswith("Easy week") for n in range(1, 6)) and r["1"]["time"] == "35–45 min", r["1"])
    check("PB easy: skipped items do not count", not d2["pb-d2-suitcase"]["counted"])
    r = pg.evaluate("""() => { const cy = {start: '2026-10-05', first: 'hd', lengths: []}, w = weekInfo(cy, '2026-12-28'), n = weekInfo(cy, '2026-12-14'), out = {};
      for (let d = 1; d <= 5; d++){ const s = buildSession('hd', d, w, {}), t = buildSession('hd', d, n, {}), it = s.groups.flatMap(g => g.items);
        out[d] = {kept: it.filter(i => !i.skipped).map(i => i.id), cut: it.filter(i => i.skipped).length, time: s.time, normal: t.time, notes: s.notes.length, normalNotes: t.notes.length, deload: it.filter(i => i.deload).length}; }
      return out; }""")
    check("HD easy: four exercises kept per day, the rest cut", all(len(r[str(d)]["kept"]) == 4 and r[str(d)]["cut"] >= 4 for d in range(1, 6)), r)
    check("HD easy: shorter estimate, with a note; normal weeks unchanged", all(int(r[str(d)]["time"].split("–")[0]) < int(r[str(d)]["normal"].split("–")[0]) and r[str(d)]["notes"] == 1 and r[str(d)]["normalNotes"] == 0 for d in range(1, 6)), {d: (r[str(d)]["time"], r[str(d)]["normal"]) for d in r})
    # 5. Targets
    r = pg.evaluate("""() => { const cy = {start: '2026-10-05', first: 'hd', lengths: []}, w = weekInfo(cy, '2026-12-28');
      const s = buildSession('hd', 1, w, {}), it = s.groups.flatMap(g => g.items).filter(i => i.id === 'd1-1')[0];
      const wi = it.rows.findIndex(r => r.role === 'work');
      const last = {unit: 'kg', sets: it.rows.map((r, i) => ({kg: r.role === 'work' ? '100' : '60', reps: r.role === 'work' ? '10' : '8', left: ''}))};
      const t = rowTarget(it, wi, {entry: null, last: last, unit: 'kg', streak: 0, cycle: cy});
      const none = rowTarget(it, wi, {entry: null, last: null, unit: 'kg', streak: 0, cycle: cy});
      const pw = weekInfo({start: '2026-10-05', first: 'pb', lengths: [7, 2]}, '2026-11-16'), ps = buildSession('pb', 1, pw, {}).groups.flatMap(g => g.items);
      const sq = ps.filter(i => i.id === 'pb-d1-squat')[0], lp = ps.filter(i => i.id === 'pb-d1-legpress')[0];
      const tm = rowTarget(sq, 0, {entry: null, last: {unit: 'kg', sets: [{kg: '150', reps: '1', left: '1'}]}, unit: 'kg', cycle: {start: '2026-10-05', first: 'pb', lengths: [7, 2]}});
      const ta = rowTarget(lp, 0, {entry: null, last: {unit: 'kg', sets: [{kg: '120', reps: '12', left: '2'}, {kg: '120', reps: '11', left: '2'}, {kg: '120', reps: '10', left: '1'}]}, unit: 'kg'});
      const tn = rowTarget(lp, 0, {entry: null, last: null, unit: 'kg'});
      return {hd: t, hdNone: none, main: tm, acc: ta, accNone: tn}; }""")
    check("HD easy target: last weight, 3 fewer reps", r["hd"]["kg"] == 100 and r["hd"]["reps"] == 7 and "3 short of failure" in r["hd"]["text"], r["hd"])
    check("HD easy target with no history gives guidance, no number", r["hdNone"]["kg"] is None and r["hdNone"]["text"], r["hdNone"])
    check("PB easy main target is lighter than a 150 single", r["main"]["kg"] and 100 <= r["main"]["kg"] < 150 and r["main"]["reps"] == 5, r["main"])
    check("PB easy accessory target repeats the weight", r["acc"]["kg"] == 120 and "same weight" in r["acc"]["text"], r["acc"])
    check("PB easy accessory with no history is blank", r["accNone"]["kg"] is None, r["accNone"])
    # 6. Rolling over an easy week keeps last week's numbers
    r = pg.evaluate("""() => { const cy = {start: '2026-10-05', first: 'hd', lengths: []}; const slot = freshSlot('2026-12-28');
      slot.lastWeek = {weekStart: '2026-12-07', exportedAt: '', entries: {}, missedDays: {}, extras: {}}; slot.entries = {};
      const sessions = [1,2,3,4,5].map(n => buildSession('hd', n, weekInfo(cy, '2026-12-28'), {}));
      startNewWeek(slot, 'hd', sessions, cy, '2027-01-04', new Date().toISOString());
      const keep = slot.lastWeek.weekStart;
      const slot2 = freshSlot('2026-12-14'); slot2.lastWeek = {weekStart: '2026-12-07', exportedAt: '', entries: {}, missedDays: {}, extras: {}};
      startNewWeek(slot2, 'hd', [1,2,3,4,5].map(n => buildSession('hd', n, weekInfo(cy, '2026-12-14'), {})), cy, '2026-12-21', new Date().toISOString());
      return [keep, slot.weekStart, slot2.lastWeek.weekStart]; }""")
    check("easy week does not replace last week; a normal week does", r[0] == "2026-12-07" and r[1] == "2027-01-04" and r[2] == "2026-12-14", r)
    # 7. Saves
    r = pg.evaluate("""() => { const st = normaliseState({cycle: {start: '2026-10-05', first: 'hd', lengths: [], easy: {"5": true, "x": true, "7": "yes", "12": false, "99999": true}}, ui: {}, entries: {}}, '2026-11-03'); return st.cycle.easy; }""")
    check("saved easy list keeps only valid entries", r == {"5": True, "12": False}, r)
    r = pg.evaluate("""() => { const st = normaliseState({cycle: {start: '2026-10-05', first: 'hd', lengths: [], easy: "nope"}, ui: {}, entries: {}}, '2026-11-03'); return 'easy' in st.cycle; }""")
    check("bad easy value is dropped", r is False)
    r = pg.evaluate("""() => { const c = JSON.parse(JSON.stringify(withEasyWeek({start: '2026-10-05', first: 'hd', lengths: [3]}, 8, true))); return [withBlockLength(c, 0, 4).easy, resetUpcomingBlocks(c, '2026-11-03').easy, switchCycleNow(c, '2026-11-03').easy]; }""")
    check("block changes keep hand-set easy weeks", r[0] == {"8": True} and r[1] == {"8": True} and r[2] == {"8": True}, r)
    # 8. Calendar UI
    pg.evaluate("() => { state.cycle = {start: '2026-10-05', first: 'hd', lengths: []}; ensurePbSlot(state, todayISO()); realignSlots(todayISO()); state.ui.tab = 'plan'; renderAll(); }")
    pg.click('.bottom-nav [data-tab="plan"]'); pg.wait_for_timeout(100)
    n0 = pg.locator("[data-cal-easy]").count()
    check("calendar offers a toggle on this and later weeks only", n0 > 0 and pg.locator(".cal-week.is-past [data-cal-easy]").count() == 0, n0)
    btn = pg.locator("[data-cal-easy]").nth(2); wk = btn.get_attribute("data-cal-easy")
    box = btn.bounding_box(); check("toggle is at least 44px tall", box["height"] >= 43.5, box)
    btn.click(); pg.wait_for_timeout(150)
    check("toggle makes the week easy", pg.evaluate("weekInfo(cycleOf(), addDays('2026-10-05', 7*%s)).easy" % wk) is True and pg.locator(".cal-week.is-easy").count() == 1)
    check("label and pressed state updated", "Make normal" in pg.inner_text('[data-cal-easy="%s"]' % wk) and pg.get_attribute('[data-cal-easy="%s"]' % wk, "aria-pressed") == "true")
    check("focus stays on the toggle", pg.evaluate("document.activeElement.dataset.calEasy") == wk)
    check("toast says which week", "Easy week set" in pg.inner_text("#toast"), pg.inner_text("#toast"))
    check("block note mentions the easy week", "easy week" in pg.inner_text(".cal-blocks").lower())
    pg.click('[data-cal-easy="%s"]' % wk); pg.wait_for_timeout(100)
    check("toggle again restores normal and clears the saved override", pg.evaluate("'easy' in cycleOf()") is False and pg.locator(".cal-week.is-easy").count() == 0)
    pg.screenshot(path="shots/easy-cal-360.png", full_page=True)
    # current week with sets logged cannot be flipped
    pg.evaluate("() => { state.ui.tab = 'train'; renderAll(); }")
    check("no page errors", not errs, errs)
    b.close()
print("FAILS", fails)
