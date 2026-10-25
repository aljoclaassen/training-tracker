from playwright.sync_api import sync_playwright
URL = "file:///tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/site/new.html"
SH = "/tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/shots/"
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 390, "height": 844})
    pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close")
    pg.evaluate("() => { state.ui.helpSeen = true; const c = ctx(); state.cycle = withBlockLength(cycleOf(), c.now.blockIndex, 6); state.cycle = withBlockLength(state.cycle, c.now.blockIndex + 1, 4); realignSlots(todayISO()); state.ui.tab = 'plan'; renderAll(); }")
    pg.wait_for_timeout(3000)
    for mode in ("light", "dark"):
        pg.evaluate("m => document.documentElement.setAttribute('data-theme', m)", mode)
        for i, y in enumerate((0, 700)):
            pg.evaluate("y => window.scrollTo(0, y)", y); pg.wait_for_timeout(100)
            pg.screenshot(path=SH + "cal-%s-%d.png" % (mode, i))
