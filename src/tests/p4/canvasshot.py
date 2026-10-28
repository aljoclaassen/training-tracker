import datetime, io
from playwright.sync_api import sync_playwright
from PIL import Image
URL = "file:///tmp/claude-0/-home-claude/ef2ea838-edd3-5f9a-a5d3-1743d048fa9e/scratchpad/work/site/new.html"
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
    pg.clock.install(time=datetime.datetime(2026, 11, 3, 9)); pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close")
    pg.evaluate("() => { state.ui.helpSeen = true; state.ui.tab = 'plan'; renderAll(); window.scrollTo(0, 0); }")
    for mode in ["light", "dark"]:
        ims = []
        for pal in ["pulse", "dune", "glacier", "forge", "bloom"]:
            pg.evaluate(f"applyTheme('{pal}'); applyMode('{mode}'); applyContrast(false); window.scrollTo(0, 0)"); pg.wait_for_timeout(320)
            pg.evaluate("document.querySelectorAll('body *').forEach(e => { if (getComputedStyle(e).position === 'fixed' && !e.matches('nav') && !e.closest('nav')) e.style.display = 'none'; })")
            ims.append(Image.open(io.BytesIO(pg.screenshot())).convert("RGB"))
        W = Image.new("RGB", (390 * 5 + 40, 844), (128, 128, 128))
        for i, im in enumerate(ims): W.paste(im, (i * 400, 0))
        W.save(f"shots/canvas-montage-{mode}.png")
    b.close()
