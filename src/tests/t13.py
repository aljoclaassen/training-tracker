import datetime
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":360,"height":780})
    pg.goto("file:///tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/site/new.html")
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close")
    out=[]
    for pal in ["steel","bush","ember","iron","volt","ultraviolet","tide","mono"]:
        for mode in ["light","dark"]:
            pg.evaluate(f"applyTheme('{pal}'); applyMode('{mode}'); applyContrast(false)"); pg.wait_for_timeout(260)
            r=pg.evaluate("""() => { const n=document.querySelector('.bottom-nav'), cs=getComputedStyle(n);
              // worst case: 10% of the content behind is pure black (light) or pure white (dark), the extremes under the blur
              const sur=getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim();
              const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
              const L=c=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return .2126*f(c[0])+.7152*f(c[1])+.0722*f(c[2]);};
              const rgb=s=>s.match(/[\\d.]+/g).map(Number);
              const s=hex(sur); const worst=[]; for (const under of [[0,0,0],[255,255,255]]){ const bg=s.map((v,i)=>v*.9+under[i]*.1);
                document.querySelectorAll('.bottom-nav__button').forEach(btn=>{ const fg=rgb(getComputedStyle(btn).color); const a=L(fg),b=L(bg); worst.push(((Math.max(a,b)+.05)/(Math.min(a,b)+.05))); }); }
              return [cs.backgroundColor, Math.min(...worst).toFixed(2)]; }""")
            out.append((pal,mode,r))
    for o in out: print(o)
