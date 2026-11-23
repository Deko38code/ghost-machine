// Verifies the 12 s auto-apply:
//  A) no interaction -> the tab reloads with the newer build
//  B) "Later" -> no reload
//  C) focused input + typing -> waits for quiet, no reload
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
const NEW_BUILD = '2026-11-20T18:30:00.000Z';

async function run(name, mode) {
  const browser = await puppeteer.launch({ executablePath:'/usr/bin/chromium', headless:'new',
    args:['--no-sandbox','--disable-dev-shm-usage'], userDataDir:'/home/ghost/tmp-verify/chrome-aa-' + name + '-' + Date.now() });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('/api/version')) return req.respond({ status:200, contentType:'application/json', body: JSON.stringify({ build: NEW_BUILD, server: { build:'x', pending:0 } }) });
    if (u.includes('/api/applet/status')) return req.respond({ status:200, contentType:'application/json', body: JSON.stringify({ type:'snapshot', scope:'public', site:'haksterai', ts:new Date().toISOString(), server:{status:'online',uptimeSec:100,node:'v24'}, build:{id:NEW_BUILD,ageSec:5}, job:{state:'IDLE',label:'Idle'}, stability:{state:'STABLE',reason:'ok',window:{configuredSec:90,remainingSec:0},timestamps:{deployedBuildId:NEW_BUILD,buildFirstStableAt:new Date().toISOString(),stableForSec:5},evidence:{checks:11,passing:11,ratio:1},heal:{healed:[],escalated:[]},checks:[]} }) });
    if (u.includes('/api/applet/stream')) return req.respond({ status:200, contentType:'text/event-stream', body:'' });
    req.continue();
  });
  let navigations = 0;
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) navigations += 1; });
  await page.goto('https://haksterai.com/', { waitUntil:'domcontentloaded', timeout:45000 });
  const firstNav = navigations;
  await new Promise(r => setTimeout(r, 2500));   // let the first check land

  let text0 = await page.evaluate(() => (document.getElementById('psa-detail')||{}).textContent || '');
  if (mode === 'later') { try { await page.click('#psa-later'); } catch (e) { text0 += ' [later-click-failed]'; } }
  if (mode === 'typing') {
    await page.evaluate(() => {
      const i = document.createElement('input'); i.id = 'test-field'; i.style.cssText = 'position:fixed;top:8px;left:8px;z-index:99999;width:120px'; document.body.appendChild(i); i.focus();
    });
    const t = setInterval(() => { page.evaluate(() => { const i = document.getElementById('test-field'); if (i) { i.focus(); i.dispatchEvent(new KeyboardEvent('keydown', {key:'a'})); } }).catch(()=>{}); }, 2000);
    setTimeout(() => clearInterval(t), 20000);
  }
  await new Promise(r => setTimeout(r, 16000));
  const res = await page.evaluate(() => ({
    detail: (document.getElementById('psa-detail')||{}).textContent || '',
    state: document.getElementById('phantom-server-applet').dataset.state,
    mode: document.getElementById('phantom-server-applet').dataset.mode,
    actionsHidden: document.getElementById('psa-actions').hidden,
  }));
  await browser.close();
  return { name, mode, firstNav, navigations, reloaded: navigations > firstNav, text0, ...res };
}

(async () => {
  const out = [];
  out.push(await run('plain', 'none'));
  out.push(await run('later', 'later'));
  out.push(await run('typing', 'typing'));
  console.log(JSON.stringify(out, null, 1));
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
