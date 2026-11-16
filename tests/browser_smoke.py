"""Optional Playwright integration smoke test with no browser navigation.

Works in managed environments where Chromium URLs are blocked by policy.
Run: python tests/browser_smoke.py (requires playwright and Chromium).
"""
from pathlib import Path
import json,re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
DATA={p.stem:json.loads(p.read_text()) for p in (ROOT/'public/data').glob('*.json')}
HTML=(ROOT/'public/index.html').read_text()
HTML=re.sub(r'<link rel="stylesheet"[^>]+>','',HTML)
HTML=re.sub(r'<script type="module"[^>]*></script>','',HTML)
CSS=(ROOT/'public/styles.css').read_text()
CORE=(ROOT/'src/engine.mjs').read_text().replace('export const ','const ').replace('export class ','class ').replace('export function ','function ').replace('export async function ','async function ')
APP=(ROOT/'public/app.mjs').read_text();APP=re.sub(r"^import \{loadTranslator, normalize\} from './src/engine.mjs';\s*",'',APP)
JS=CORE+'\n'+APP
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    for label,size in [('desktop',{'width':1360,'height':900}),('mobile',{'width':390,'height':844})]:
        page=browser.new_page(viewport=size,device_scale_factor=1)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        mocked = "window.fetch=async function(u){ const m=String(u).match(/\\/([a-z]+)\\.json$/); if(m && window.__assets[m[1]])return {ok:true,json:async()=>window.__assets[m[1]]};return {ok:false,status:404,json:async()=>({})};};"
        page_html = HTML.replace('</head>','<style>'+CSS.replace('@import url(\'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap\');','')+'</style></head>')
        page_html = page_html.replace('</body>', '<script>window.__assets='+json.dumps(DATA,ensure_ascii=False,separators=(',',':')).replace('</','<\\/')+';'+mocked+JS+'</script></body>')
        page.set_content(page_html,wait_until='domcontentloaded',timeout=45000)
        page.wait_for_function("document.querySelector('#data-label').textContent.includes('Ready')",timeout=45000)
        assert page.locator('#resonance option').count()==16
        page.locator('#source-text').fill('I protect the home.')
        page.locator('#translate-btn').click()
        result=page.locator('#translation-result').inner_text()
        assert 'sen mi naro-m daru.' in result,(label,result)
        assert 'Provisional' in page.locator('#quality-pill').inner_text()
        page.locator('.nav-pill[data-view="dictionary"]').click()
        page.locator('#dictionary-query').fill('goro')
        page.wait_for_timeout(400)
        assert page.locator('.word-card').count()>=1
        assert 'fly' in page.locator('.word-card').first.inner_text().lower()
        page.locator('.nav-pill[data-view="translate"]').click()
        page.screenshot(path=f'/mnt/data/qaroshi-translator-{label}.png',full_page=True)
        print(label,'translated',result.splitlines()[0], 'js errors',errors)
        assert not errors,errors
        page.close()
    browser.close()
