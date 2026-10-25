"""Opens every superset in many states, widths and text sizes and reports overlapping or clipped text."""
import datetime, json, sys
from playwright.sync_api import sync_playwright
URL="file:///tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/site/new.html"
CHECK = """() => {
  const root = document.querySelector('.pair-group.is-open'); if (!root) return {err: 'no pair open'};
  const boxes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()){
    const n = walker.currentNode; if (!n.textContent.trim()) continue;
    const el = n.parentElement; if (el.closest('[hidden]') || getComputedStyle(el).visibility === 'hidden' || el.closest('.visually-hidden') || el.closest('select')) continue;
    const r = document.createRange(); r.selectNodeContents(n);
    for (const b of r.getClientRects()) if (b.width > 1 && b.height > 1) boxes.push({t: n.textContent.trim().slice(0, 20), el: el, x1: b.left, y1: b.top, x2: b.right, y2: b.bottom});
  }
  const bad = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++){
    const a = boxes[i], b = boxes[j]; if (a.el === b.el) continue;
    const ox = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1), oy = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
    if (ox > 2 && oy > 2) bad.push('overlap: "' + a.t + '" / "' + b.t + '"');
  }
  // text that spills outside its own box or its column
  root.querySelectorAll('.pair-group__cols > .exercise').forEach(col => {
    const cr = col.getBoundingClientRect();
    boxes.filter(b => col.contains(b.el)).forEach(b => { if (b.x1 < cr.left - 1 || b.x2 > cr.right + 1) bad.push('outside column: "' + b.t + '"'); });
  });
  root.querySelectorAll('*').forEach(el => { if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'visible' && el.clientWidth > 0 && el.tagName !== 'SELECT' && !el.matches('.visually-hidden, .text-input')) bad.push('clipped: ' + (el.className || el.tagName)); });
  if (document.documentElement.scrollWidth > window.innerWidth + 1) bad.push('page scrolls sideways');
  return {n: boxes.length, bad: [...new Set(bad)].slice(0, 8)};
}"""
PAIRS = [("pb-d2-chin", 2), ("pb-d3-csrow", 3), ("pb-d4-lateral", 4), ("pb-d4-inccurl", 4), ("pb-d4-fly", 4), ("pb-d4-skull", 4), ("pb-d5-pushup", 5)]
STATES = ["fresh", "middle", "done", "swapped", "plates"]
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []; fails = []; total = 0
    for w in [320, 360, 390, 412]:
        for scale in [1.0, 1.3]:
            pg = b.new_page(viewport={"width": w, "height": 800}); pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.clock.install(time=datetime.datetime(2026, 10, 19, 9, 0, 0))
            pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close")
            if scale != 1.0:   # like Android's text size setting: every font size token grows
                pg.add_style_tag(content=":root{ " + " ".join("--font-size-%s: %.1fpx !important;" % (k, v * scale) for k, v in [("xs", 12), ("small", 14), ("base", 16), ("large", 20), ("title", 34), ("section", 22), ("metric", 28), ("numeral", 22), ("timer", 28)]) + " }")
            for pid, day in PAIRS:
                for st in STATES:
                    pg.evaluate("""([pid, day, st]) => { const c = ctx(); state.ui.day = day; const it = itemOf(c, pid); const partner = itemOf(c, pairPartnerId(c, it));
                      [it, partner].forEach(x => { delete c.slot.entries[x.id]; delete c.slot.units[unitKey(x)]; delete activeRows[x.id]; });
                      const fill = (x, n) => { const e = ensureEntry(c.slot, x); e.sets = x.rows.map((r, k) => k < n ? {reps: '12', kg: '102.5', left: '1'} : {reps: '', kg: ''}); e.doneAt = c.today; };
                      if (st === 'middle'){ fill(it, 1); fill(partner, 1); }
                      if (st === 'done'){ fill(it, it.rows.length); fill(partner, partner.rows.length); }
                      if (st === 'swapped'){ const e = ensureEntry(c.slot, partner); startSwap(e, partner, null, c.today); e.repl.name = 'Cable lateral raise with a long name'; e.repl.sets[0] = {reps: '15', kg: '7.5', left: '2'}; }
                      if (st === 'plates'){ c.slot.units[unitKey(it)] = 'plates'; c.slot.units[unitKey(partner)] = 'plates'; fill(it, 2); }
                      state.ui.openEx = pid; state.ui.tab = 'train'; renderAll(); }""", [pid, day, st])
                    pg.wait_for_timeout(40)
                    for row in [None, 0, 2]:   # also open an earlier set for editing
                        if row is not None: pg.evaluate("([pid, r]) => { activeRows[pid] = r; rerenderExercise(pid); }", [pid, row])
                        r = pg.evaluate(CHECK); total += 1
                        if r.get("err") or r["bad"]: fails.append((w, scale, pid, st, row, r.get("err") or r["bad"]))
            if (w, scale) in ((360, 1.3), (390, 1.0)):
                pg.evaluate("() => { const c = ctx(); state.ui.day = 4; state.ui.openEx = 'pb-d4-lateral'; renderAll(); }"); pg.wait_for_timeout(80)
                pg.screenshot(path="/tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/shots/ov-%d-%d.png" % (w, scale*10) + "")
                pg.locator(".pair-group.is-open").evaluate("e => e.scrollTop = 600"); pg.screenshot(path="/tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/shots/ov-%d-%db.png" % (w, scale*10) + "")
            pg.close()
    print("layouts checked:", total, "with problems:", len(fails))
    for f in fails[:25]: print(f)
    print("ERR", errs[:3])
