import datetime, shutil, re
from playwright.sync_api import sync_playwright
URL="http://localhost:8765/training-tracker/"
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":360,"height":780})
    pg=ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
    pg.goto(URL); pg.wait_for_function("navigator.serviceWorker.controller !== null || true")
    pg.evaluate("navigator.serviceWorker.ready"); pg.reload(); pg.wait_for_timeout(500)
    print("controlled:", pg.evaluate("!!navigator.serviceWorker.controller"))
    pg.click("#button-setup-save"); pg.wait_for_timeout(300)
    ctx.set_offline(True)
    pg.reload(); pg.wait_for_timeout(500)
    print("offline header:", pg.inner_text("#header-plan"), "|", pg.inner_text("#header-week"))
    ctx.set_offline(False)
    # release new version
    f="srv/training-tracker/sw.js"; s=open(f).read().replace('2026-10-10.1','2026-10-10.2'); open(f,'w').write(s)
    pg.reload(); pg.wait_for_timeout(3000)
    print("reg state:", pg.evaluate("navigator.serviceWorker.getRegistration().then(r => [!!r.installing, !!r.waiting, !!r.active])"))
    print("update bar visible:", pg.is_visible("#update-bar"))
    if pg.is_visible("#update-bar"):
        pg.click("#button-update"); pg.wait_for_timeout(1500)
        print("after update caches:", pg.evaluate("caches.keys()"), "bar:", pg.is_visible("#update-bar"), "data kept:", pg.inner_text("#header-plan"))
    print("errors:", errs)
    b.close()
