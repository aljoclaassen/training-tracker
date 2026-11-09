"""Plans page split into Plan and Blocks (9 November 2026), collapsible blocks with a jump strip,
and the Powerbuilding squat guess reading only back squat from the new squat slot."""
import datetime
from playwright.sync_api import sync_playwright
URL = "file:///tmp/claude-0/-home-claude/ef2ea838-edd3-5f9a-a5d3-1743d048fa9e/scratchpad/work/site/new.html"
fails = []
def check(n, ok, info=""):
    print(("PASS " if ok else "FAIL ") + n, "" if ok else info)
    if not ok: fails.append(n)
OPEN = "Array.from(document.querySelectorAll('[data-cal-block]')).filter(d => d.open).map(d => Number(d.dataset.calBlock))"
with sync_playwright() as p:
    b = p.chromium.launch()
    for w in (360, 1440):
        pg = b.new_page(viewport={"width": w, "height": 844}); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.clock.install(time=datetime.datetime(2026, 11, 10, 9, 0, 0))
        pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close")
        pg.evaluate("() => { state.ui.helpSeen = true; state.cycle = Object.assign({}, cycleOf(), {start: '2026-11-02', first: 'hd'}); realignSlots(todayISO()); renderAll(); save(); }")
        pg.click('.bottom-nav [data-tab="plan"]'); pg.wait_for_timeout(100)
        check("%d: Plan section shows first" % w, pg.is_visible("#plan-days") and not pg.is_visible("#calendar"))
        check("%d: two section buttons" % w, pg.locator("[data-plan-section]").count() == 2)
        check("%d: rest day tile looks like rest" % w, pg.locator(".week-tile--rest").count() == 3)
        pg.click('[data-plan-section="blocks"]'); pg.wait_for_timeout(100)
        check("%d: Blocks section shows the calendar only" % w, pg.is_visible("#calendar") and not pg.is_visible("#plan-days"))
        check("%d: focus stays on the section button" % w, pg.evaluate("document.activeElement.dataset.planSection") == "blocks")
        txt = pg.inner_text(".cal-now")
        check("%d: now and next card" % w, "Heavy Duty," in txt and "week 2 of 2" in txt and "Powerbuilding" in txt and "16 November" in txt, txt)
        check("%d: only the current block starts open" % w, pg.evaluate(OPEN) == [0], pg.evaluate(OPEN))
        check("%d: block rules sit in one guide" % w, pg.locator(".calendar > details.guide").count() == 1)
        check("%d: page does not scroll sideways" % w, pg.evaluate("document.documentElement.scrollWidth <= innerWidth"))
        chips = pg.locator("[data-cal-jump]")
        check("%d: strip has a chip per block, current marked" % w, chips.count() == pg.locator("[data-cal-block]").count() and pg.locator('.cal-chip[aria-current="true"]').count() == 1)
        hs = pg.eval_on_selector_all(".cal-chip, .cal-block__summary, [data-plan-section]", "els => els.map(e => e.getBoundingClientRect().height)")
        check("%d: tap targets 44px or more" % w, min(hs) >= 44, min(hs))
        chips.nth(2).click(); pg.wait_for_timeout(400)
        check("%d: jumping opens that block and focuses it" % w, 2 in pg.evaluate(OPEN) and pg.evaluate("document.activeElement.id") == "cal-b-2", (pg.evaluate(OPEN), pg.evaluate("document.activeElement.id")))
        pg.locator('[data-cal-block="0"] > summary').click(); pg.wait_for_timeout(100)
        check("%d: closing a block is remembered" % w, pg.evaluate("state.ui.calOpen") == [2], pg.evaluate("state.ui.calOpen"))
        pg.locator('[data-cal-block="2"] [data-cal-easy]').first.click(); pg.wait_for_timeout(150)
        check("%d: block stays open after making a week easy" % w, pg.evaluate(OPEN) == [2], pg.evaluate(OPEN))
        pg.keyboard.press("Tab")
        pg.evaluate("() => { state.ui.planSection = 'plan'; state.ui.tab = 'train'; renderAll(); }")
        pg.evaluate("() => { const b = document.querySelector('#view-train [data-go-calendar]'); if (b) b.click(); }"); pg.wait_for_timeout(150)
        check("%d: Change in calendar opens Blocks" % w, pg.evaluate("state.ui.planSection") == "blocks" and pg.is_visible("#calendar") and pg.evaluate("document.activeElement.id") == "calendar-title")
        check("%d: no page errors" % w, not errs, errs)
        pg.close()
    # Powerbuilding squat guess: back squat only, never a Zercher set
    pg = b.new_page(); pg.goto(URL)
    g = pg.evaluate("""() => { const s = {entries: {}, lastWeek: {entries: {'d1-1': {variant: 'zercher', sets: [{reps: '12', kg: '50'}, {reps: '8', kg: '90'}]}}}, varHistory: {'d1-1|back': {sets: [{reps: '12', kg: '60'}, {reps: '10', kg: '80'}, {reps: '9', kg: '120'}]}}, history: {}};
      return topSetGuess('squat', null, s).kg; }""")
    check("PB squat guess reads back squat (120 x 1.05), not Zercher", g == 125, g)
    b.close()
print("FAILS", fails)
