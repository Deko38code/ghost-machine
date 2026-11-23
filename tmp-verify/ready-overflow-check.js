const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
const NEW_BUILD = '2026-11-20T19:20:00.000Z';
const views = [[360,640],[390,844],[414,896],[1440,900],[1920,1080]];
(async () => {
  const out = [];
  for (const [w,h] of views) {
    const browser = await puppeteer.launch({ executablePath:'/usr/bin/chromium', headless:'new',
      args:['--no-sandbox','--disable-dev-shm-usage'], userDataDir:'/home/ghost/tmp-verify/chrome-ro-' + Date.now() + '-' + w });
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h });
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const u = req.url();
      if (u.includes('/api/version')) return req.respond({ status:200, contentType:'application/json', body: JSON.stringify({ build: NEW_BUILD, server:{build:'x',stale:false,pending:0} }) });
      if (u.includes('/api/applet/status')) return req.respond({ status:200, contentType:'application/json', body: JSON.stringify({ type:'snapshot',scope:'public',site:'haksterai',ts:new Date().toISOString(),server:{status:'online',uptimeSec:100},build:{id:NEW_BUILD,ageSec:5},job:{state:'IDLE'},stability:{state:'STABLE',reason:'ok',window:{configuredSec:90,remainingSec:0},timestamps:{deployedBuildId:NEW_BUILD,buildFirstStableAt:new Date().toISOString(),stableForSec:5},evidence:{checks:11,passing:11,ratio:1},heal:{healed:[],escalated:[]},checks:[]} }) });
      if (u.includes('/api/applet/stream')) return req.respond({ status:200, contentType:'text/event-stream', body:'' });
      req.continue();
    });
    await page.goto('https://haksterai.com/', { waitUntil:'domcontentloaded', timeout:45000 });
    await new Promise(r => setTimeout(r, 2500));
    try { await page.click('#psa-tab', { delay: 30 }); } catch (_) {}
    await new Promise(r => setTimeout(r, 700));
    const m = await page.evaluate(() => {
      const root = document.getElementById('phantom-server-applet');
      const card = root.querySelector('.psa-card');
      const r = card.getBoundingClientRect();
      return {
        mode: root.dataset.mode,
        detail: (document.getElementById('psa-detail')||{}).textContent || '',
        left: Math.round(r.left), right: Math.round(window.innerWidth - r.right), width: Math.round(r.width),
        docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        bodyOverflow: document.body.scrollWidth > document.body.clientWidth,
      };
    });
    out.push({ viewport: w + 'x' + h, ...m, detail: m.detail.slice(0, 40) + '…' });
    await browser.close();
  }
  console.log(JSON.stringify(out, null, 1));
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
