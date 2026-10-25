import datetime, json
from playwright.sync_api import sync_playwright
AUDIT = """() => {
  function rgb(s){ const m=s.match(/[\\d.]+/g); if(!m) return null; const v=m.map(Number); if(s.startsWith('color(')){ const o=v.slice(0,3).map(x=>x*255); if(v.length>3) o.push(v[3]); return o; } return v; }
  function L(c){ const f=v=>{v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)}; return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]); }
  function bgOf(el){ while(el){ const c=rgb(getComputedStyle(el).backgroundColor); if(c && (c.length<4 || c[3]>0.5)) return c; el=el.parentElement;} return rgb(getComputedStyle(document.body).backgroundColor); }
  const bad=[]; let n=0; document.querySelectorAll('body *').forEach(el=>{ const r=el.getBoundingClientRect(); if(!r.width||!r.height) return; const txt=[...el.childNodes].some(x=>x.nodeType===3&&x.textContent.trim()); if(!txt) return;
    const st=getComputedStyle(el); if(st.visibility==='hidden'||el.closest('[hidden]')||el.closest('[disabled]')||el.closest('dialog:not([open])')) return; if(parseFloat(st.opacity)<0.5 && !el.closest('.toast')) return;
    let fg=rgb(el.tagName==='text'?st.fill:st.color); const bg=bgOf(el); const a=L(fg),b=L(bg); const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05); n++;
    if(ratio<4.5) bad.push((typeof el.className==='string'?el.className:el.tagName)+':'+el.textContent.trim().slice(0,18)+':'+ratio.toFixed(2)); });
  return {n:n,bad:bad}; }"""
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":390,"height":3000}); errs=[]
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.clock.install(time=datetime.datetime(2026,10,21,9,0,0))
    pg.goto("file:///tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad/site/new.html")
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.click("#button-setup-save"); pg.click("#button-help-close"); pg.wait_for_timeout(300)
    # log a set so done, beat, rest bar and toast states exist
    pg.evaluate("() => { const c=ctx(); state.ui.day=1; renderAll(); }")
    fails=[]; n=0
    for pal in ["pulse","dune","glacier","forge","bloom"]:
        for mode in ["light","dark"]:
            for more in [False, True]:
                pg.evaluate(f"applyTheme('{pal}'); applyMode('{mode}'); applyContrast({'true' if more else 'false'})"); pg.wait_for_timeout(260)
                for tab in ["train","plan","history","sheet"]:
                    pg.evaluate(f"showTab('{tab}')" if tab!='sheet' else "showTab('train'); state.ui.day=2; state.ui.openEx=\x27pb-d2-chin\x27; renderAll(); startRest(90,\x27Weighted Dip\x27)"); pg.wait_for_timeout(40)
                    r=pg.evaluate(AUDIT); n+=r["n"]
                    if r["bad"]: fails.append((pal,mode,more,tab,r["bad"][:4]))
                pg.evaluate("state.ui.openEx=null; stopRest(); showTab('train')")
                pg.click("#button-settings"); pg.wait_for_timeout(60)
                r=pg.evaluate(AUDIT); n+=r["n"]
                if r["bad"]: fails.append((pal,mode,more,"settings",r["bad"][:4]))
                pg.keyboard.press("Escape"); pg.wait_for_timeout(60)
    print("checks", n, "fails", len(fails)); print(json.dumps(fails, ensure_ascii=False)[:3000]); print("ERR", errs)
