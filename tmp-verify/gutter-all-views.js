const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
const snap = {
  type:'snapshot',scope:'public',site:'haksterai',box:'dell',ts:new Date().toISOString(),
  server:{status:'online',uptimeSec:500,node:'v24'},
  build:{id:'2026-11-20T16:00:00.000Z',builtAt:'2026-11-20T16:00:00.000Z',ageSec:60},
  job:{state:'IDLE',label:'Idle',percent:null,indeterminate:false},
  stability:{state:'STABLE',reason:'no failing check',window:{configuredSec:90,approved:true,remainingSec:0},timestamps:{lastCheckAt:new Date().toISOString()},evidence:{checks:11,passing:11,ratio:1},heal:{healed:[],escalated:[]},checks:[]},
};
const VIEWS = [[360,640],[390,844],[414,896],[1440,900],[1920,1080]];
(async () => {
  const out = [];
  for (const [w,h] of VIEWS) {
    const browser = await puppeteer.launch({ executablePath:'/usr/bin/chromium', headless:'new',
      args:['--no-sandbox','--disable-dev-shm-usage'], userDataDir:'/home/ghost/tmp-verify/chrome-gv-' + Date.now() + '-' + w });
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h });
    await page.setRequestInterception(true);
    page.on('request', async (req) => {
      const u = req.url();
      if (u.includes('/api/version')) return req.respond({ status:200, contentType:'application/json', body:'{"build":"2026-11-20T16:00:00.000Z","server":{"build":"x","pending":0}}' });
      if (u.includes('/api/applet/status')) return req.respond({ status:200, contentType:'application/json', body: JSON.stringify(snap) });
      if (u.includes('/api/applet/stream')) return req.respond({ status:200, contentType:'text/event-stream', body:'' });
      req.continue();
    });
    await page.goto('https://haksterai.com/', { waitUntil:'domcontentloaded', timeout:45000 });
    await new Promise(r => setTimeout(r, 1400));
    try { await page.click('#psa-tab', { delay: 40 }); } catch (_) {}
    await new Promise(r => setTimeout(r, 800));
    const card = await page.evaluate(() => {
      const root = document.getElementById('phantom-server-applet');
      const c = root.querySelector('.psa-card');
      const r = c.getBoundingClientRect();
      return { mode: root.dataset.mode, cardLeft: Math.round(r.left), cardRight: Math.round(window.innerWidth - r.right),
        cardW: Math.round(r.width), overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth };
    });
    // chip mode: docked position must stay bottom-right
    const chip = await page.evaluate(() => {
      const root = document.getElementById('phantom-server-applet');
      root.dataset.mode = 'chip';
      const el = document.getElementById('psa-chip');
      const r = el.getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(window.innerWidth - r.right), bottom: Math.round(window.innerHeight - r.bottom), w: Math.round(r.width) };
    });
    // tab mode position
    const tab = await page.evaluate(() => {
      const root = document.getElementById('phantom-server-applet');
      root.dataset.mode = 'tab';
      const el = document.getElementById('psa-tab');
      const r = el.getBoundingClientRect();
      return { right: Math.round(window.innerWidth - r.right), bottom: Math.round(window.innerHeight - r.bottom) };
    });
    out.push({ viewport: w + 'x' + h, card, chip, tab });
    await browser.close();
  }
  console.log(JSON.stringify(out, null, 1));
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
