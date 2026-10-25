import datetime, json
from playwright.sync_api import sync_playwright
AUDIT = """() => {
  function rgb(s){ const m=s.match(/[\\d.]+/g); if(!m) return null; const v=m.map(Number); if(s.startsWith('color(')){ const o=v.slice(0,3).map(x=>x*255); if(v.length>3) o.push(v[3]); return o; } return v; }
  function L(c){ const f=v=>{v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)}; return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]); }
  function bgOf(el){ while(el){ const c=rgb(getComputedStyle(el).backgroundColor); if(c && (c.length<4 || c[3]>0.5)) return c; el=el.parentElement;} return rgb(getComputedStyle(document.body).backgroundColor); }
  const bad=[]; document.querySelectorAll('body *').forEach(el=>{ if(!el.offsetParent && getComputedStyle(el).position!=='fixed') return; const txt=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()); if(!txt) return;
    const st=getComputedStyle(el); if(st.visibility==='hidden'||st.opacity==='0'||el.closest('[hidden]')) return; const fg=rgb(st.color), bg=bgOf(el); const a=L(fg),b=L(bg); const r=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    if(r<4.5) bad.push((el.className||el.tagName)+':'+el.textContent.trim().slice(0,18)+':'+r.toFixed(2)); }); return bad; }"""
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":360,"height":780}); pg=ctx.new_page(); errs=[]
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.clock.install(time=datetime.datetime(2026,10,26,9,0,0))
    pg.goto("file:///tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/site/new.html")
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close")
    # seed two weeks of history on PB day 1
    pg.evaluate("""() => { const c=ctx(); const e=ensureEntry(c.slot, itemOf(c,'pb-d1-legpress')); e.sets=[{reps:'12',kg:'100'},{reps:'11',kg:'100'},{reps:'10',kg:'100'}];
      const prev=JSON.parse(JSON.stringify(buildExport(c.slot,c.plan,c.sessions,null,'x'))); prev.weekStart='2026-10-19'; prev.entries['pb-d1-legpress'].sets=[{reps:'12',kg:'95'}];
      archiveWeek('pb', prev); save(); renderAll(); }""")
    pg.wait_for_timeout(400)
    worst=[]
    for pal in ["steel","bush","ember","iron","volt","ultraviolet","tide","mono"]:
        for mode in ["light","dark"]:
            for more in [False, True]:
                pg.evaluate(f"applyTheme('{pal}'); applyMode('{mode}'); applyContrast({'true' if more else 'false'})"); pg.wait_for_timeout(260)
                pg.evaluate("showTab('train'); state.ui.openEx='pb-d1-legpress'; renderAll()"); pg.wait_for_timeout(60)
                a=pg.evaluate(AUDIT)
                pg.evaluate("showTab('history'); state.ui.histEx='pb-d1-legpress'; renderAll()"); pg.wait_for_timeout(60)
                h=pg.evaluate(AUDIT)
                if a or h: worst.append((pal,mode,more,a[:4],h[:4]))
                if (pal,mode,more) in [("steel","dark",False),("steel","light",False),("volt","dark",False),("ember","light",False)]:
                    pg.screenshot(path=f"shots/app-{pal}-{mode}-hist.png", full_page=True)
                    pg.evaluate("showTab('train')"); pg.wait_for_timeout(60); pg.screenshot(path=f"shots/app-{pal}-{mode}-train.png", full_page=False)
    print("contrast failures:", json.dumps(worst, ensure_ascii=False)[:2000])
    print("trend:", pg.evaluate("showTab('history'); document.querySelector('.hist-table') && document.querySelector('.hist-table').innerText"))
    print("ERR", errs)
