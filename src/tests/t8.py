import datetime, json
from playwright.sync_api import sync_playwright
import sheetfix
BASE="file:///tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/site/new.html"
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":360,"height":780}); pg=ctx.new_page(); errs=[]
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.clock.install(time=datetime.datetime(2026,10,12,9,0,0))
    pg.goto(BASE); pg.evaluate("localStorage.clear()")
    # old-style state with theme in ui
    pg.evaluate("localStorage.setItem('heavy-duty-tracker-v1', JSON.stringify({weekStart:'2026-10-12',entries:{},ui:{theme:'ember',mode:'dark',helpSeen:true},cycle:{start:'2026-10-05',first:'hd'}}))")
    pg.reload(); pg.wait_for_timeout(300)
    print("migrated:", pg.evaluate("localStorage.getItem('training-tracker-theme')"), pg.evaluate("document.documentElement.getAttribute('data-palette')+'/'+document.documentElement.getAttribute('data-theme')"))
    pg.wait_for_timeout(400)
    print("ui in training data:", pg.evaluate("Object.keys(JSON.parse(localStorage.getItem('heavy-duty-tracker-v1')).ui)"))
    print("meta:", pg.get_attribute('meta[name="theme-color"]','content'))
    # export without ui
    exp=json.loads(pg.evaluate("() => { const c=ctx(); const o=slotOf(state,'pb'); return JSON.stringify(buildExport(c.slot,c.plan,c.sessions,{plan:'pb',slot:slotForExport(o)},'x')); }"))
    print("otherPlan keys:", list(exp['backup']['otherPlan']['slot'].keys()), "theme in export:", 'theme' in json.dumps(exp) or 'ember' in json.dumps(exp))
    # screenshots per theme
    for th in ["steel","volt","mono"]:
        for mode in ["light","dark"]:
            pg.evaluate(f"applyTheme('{th}'); applyMode('{mode}')"); pg.wait_for_timeout(250)
            pg.screenshot(path=f"shots/t-{th}-{mode}.png")
    pg.click("#button-settings"); pg.check("#settings-contrast"); pg.wait_for_timeout(200)
    print("contrast attr:", pg.evaluate("document.documentElement.getAttribute('data-contrast')"), pg.evaluate("localStorage.getItem('training-tracker-theme')"))
    # computed contrast audit on live page: every visible text element vs its effective background
    audit = pg.evaluate("""() => {
      function rgb(s){ const m=s.match(/[\\d.]+/g); return m?m.map(Number):null; }
      function L(c){ const f=v=>{v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)}; return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]); }
      function bgOf(el){ while(el){ const c=rgb(getComputedStyle(el).backgroundColor); if(c && (c.length<4 || c[3]>0.5)) return c; el=el.parentElement;} return [255,255,255]; }
      const bad=[]; document.querySelectorAll('body *').forEach(el=>{ if(!el.offsetParent && getComputedStyle(el).position!=='fixed') return; const txt=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()); if(!txt) return;
        const st=getComputedStyle(el); if(st.visibility==='hidden'||st.opacity==='0') return; const fg=rgb(st.color), bg=bgOf(el); const a=L(fg),b=L(bg); const r=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
        if(r<4.5 && !el.closest('[hidden]')) bad.push(el.className+':'+el.textContent.trim().slice(0,20)+':'+r.toFixed(2)); }); return bad.slice(0,15); }""")
    print("live contrast <4.5:", audit)
    print("ERR", errs); b.close()
