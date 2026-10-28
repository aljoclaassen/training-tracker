import datetime, io
from playwright.sync_api import sync_playwright
from PIL import Image
URL = "file:///tmp/claude-0/-home-claude/ef2ea838-edd3-5f9a-a5d3-1743d048fa9e/scratchpad/work/site/new.html"
def lum(c):
    f = lambda v: (v/255/12.92) if v/255 <= .03928 else ((v/255+.055)/1.055)**2.4
    return .2126*f(c[0]) + .7152*f(c[1]) + .0722*f(c[2])
def cr(a, b):
    x, y = lum(a), lum(b); return (max(x, y)+.05)/(min(x, y)+.05)
def rgb(s):
    import re; v = [float(x) for x in re.findall(r"[\d.]+", s)][:3]; return v
bad = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 390, "height": 844})
    pg.clock.install(time=datetime.datetime(2026, 11, 3, 9)); pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close")
    for pal in ["pulse", "dune", "glacier", "forge", "bloom"]:
        for mode in ["light", "dark"]:
            pg.evaluate(f"applyTheme('{pal}'); applyMode('{mode}'); applyContrast(false)"); pg.wait_for_timeout(300)
            txt = rgb(pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--color-text')") if False else pg.evaluate("(()=>{const e=document.createElement('i');e.style.color='var(--color-text)';document.body.appendChild(e);const c=getComputedStyle(e).color;e.remove();return c})()"))
            mut = rgb(pg.evaluate("(()=>{const e=document.createElement('i');e.style.color='var(--color-text-muted)';document.body.appendChild(e);const c=getComputedStyle(e).color;e.remove();return c})()"))
            pg.evaluate("document.body.style.setProperty('--x','1'); document.querySelectorAll('body > *').forEach(e => e.style.visibility='hidden')")
            im = Image.open(io.BytesIO(pg.screenshot())).convert("RGB")
            px = list(im.resize((97, 211)).getdata())
            worst = min(cr(mut, c) for c in px); worstt = min(cr(txt, c) for c in px)
            print(pal, mode, "muted worst %.2f" % worst, "text worst %.2f" % worstt)
            if worst < 4.5 or worstt < 7: bad.append((pal, mode, worst, worstt))
            pg.evaluate("document.querySelectorAll('body > *').forEach(e => e.style.visibility='')")
            pg.evaluate("document.querySelectorAll('body > *').forEach(e => { if (getComputedStyle(e).position === 'fixed') e.style.display = 'none'; })")
            if mode == "light" or pal == "pulse":
                pg.screenshot(path=f"shots/canvas-{pal}-{mode}.png")
            pg.evaluate("document.querySelectorAll('body > *').forEach(e => e.style.display='')")
    print("BAD", bad); b.close()
