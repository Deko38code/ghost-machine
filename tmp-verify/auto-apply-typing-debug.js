const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
const NEW_BUILD = '2026-11-20T18:30:00.000Z';
(async () => {
  const browser = await puppeteer.launch({ executablePath:'/usr/bin/chromium', headless:'new',
    args:['--no-sandbox','--disable-dev-shm-usage'], userDataDir:'/home/ghost/tmp-verify/chrome-aad-' + Date.now() });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('/api/version')) return req.respond({ status:200, contentType:'application/json', body: JSON.stringify({ build: NEW_BUILD, server:{build:'x',pending:0} }) });
    if (u.includes('/api/applet/status')) return req.respond({ status:200, contentType:'application/json', body: JSON.stringify({ type:'snapshot',scope:'public',site:'haksterai',ts:new Date().toISOString(),server:{status:'online',uptimeSec:100},build:{id:NEW_BUILD,ageSec:5},job:{state:'IDLE'},stability:{state:'STABLE',reason:'ok',timestamps:{},evidence:{checks:11,passing:11,ratio:1},heal:{healed:[],escalated:[]},checks:[]} }) });
    if (u.includes('/api/applet/stream')) return req.respond({ status:200, contentType:'text/event-stream', body:'' });
    req.continue();
  });
  let navs = 0;
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) navs += 1; });
  await page.goto('https://haksterai.com/', { waitUntil:'domcontentloaded', timeout:45000 });
  const nav0 = navs;
  await new Promise(r => setTimeout(r, 2000));
  await page.evaluate(() => {
    const i = document.createElement('input'); i.id='test-field'; i.style.cssText='position:fixed;top:8px;left:8px;z-index:99999;width:140px';
    document.body.appendChild(i); i.focus();
    window.__keys = 0;
    setInterval(() => { const el=document.getElementById('test-field'); if (el) { el.focus(); el.dispatchEvent(new KeyboardEvent('keydown',{key:'a',bubbles:true})); window.__keys += 1; } }, 1000);
  });
  const samples = [];
  for (let k = 0; k < 15; k++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const s = await page.evaluate(() => ({
        active: (document.activeElement && document.activeElement.tagName) + (document.activeElement && document.activeElement.id ? '#' + document.activeElement.id : ''),
        keys: window.__keys || 0,
        detail: (document.getElementById('psa-detail')||{}).textContent || '',
        mode: document.getElementById('phantom-server-applet').dataset.mode,
        state: document.getElementById('phantom-server-applet').dataset.state,
      }));
      s.t = k + 1; samples.push(s);
    } catch (e) { samples.push({ t: k + 1, error: e.message.slice(0, 60), navs }); }
  }
  console.log(JSON.stringify({ nav0, navs, reloaded: navs > nav0, samples }, null, 1));
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
