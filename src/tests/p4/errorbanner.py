"""Error banner (9 November 2026): shows the error, copies details, closes; a failing hint or guide never stops the page drawing."""
import datetime
from playwright.sync_api import sync_playwright
URL = "file:///tmp/claude-0/-home-claude/ef2ea838-edd3-5f9a-a5d3-1743d048fa9e/scratchpad/work/site/new.html"
fails = []
def check(n, ok, info=""):
    print(("PASS " if ok else "FAIL ") + n, "" if ok else info)
    if not ok: fails.append(n)
with sync_playwright() as p:
    b = p.chromium.launch(); cx = b.new_context(viewport={"width": 390, "height": 844}, permissions=["clipboard-read", "clipboard-write"])
    pg = cx.new_page(); pg.clock.install(time=datetime.datetime(2026, 11, 10, 9))
    pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close")
    pg.evaluate("() => { state.ui.helpSeen = true; state.cycle = {start: '2026-11-02', first: 'hd', lengths: [2]}; realignSlots(todayISO()); state.ui.tab = 'train'; state.ui.day = 2; renderAll(); }")
    check("no banner on a clean run", pg.locator(".compat-banner").count() == 0)
    # A broken guide must not stop the day drawing
    pg.evaluate("() => { window.hdTechPicks = null; hdTechPicks = () => { throw new Error('test break'); }; renderAll(); }")
    check("day still draws with a broken guide", pg.locator("#exercise-list .exercise").count() >= 7)
    check("banner shows the error", "went wrong" in pg.inner_text(".compat-banner") and "test break" in pg.inner_text(".compat-banner"), pg.inner_text(".compat-banner") if pg.locator(".compat-banner").count() else "")
    pg.click(".compat-banner >> text=Copy error details"); pg.wait_for_timeout(200)
    clip = pg.evaluate("navigator.clipboard.readText()")
    check("details copied with version and place", "2026-11-09" in clip and "test break" in clip and "technique" in clip, clip)
    pg.click(".compat-banner >> text=Close")
    check("banner closes", pg.locator(".compat-banner").count() == 0)
    # Odd stored data does not throw
    r = pg.evaluate("""() => { const s = {lastWeek: {entries: {'d3-5': null, 'd1-1': {sets: []}}}, varHistory: {'d3-5|machine': null}, units: {}, history: {}};
      hdMoveSlot(s); hdSeedFromArchive({}, {hd: [null, {weekStart: 'x'}]}); return Object.keys(s.lastWeek.entries); }""")
    check("null entries are dropped, not fatal", r == ["d1-1"], r)
    b.close()
print("FAILS", fails)
