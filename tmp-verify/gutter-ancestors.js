const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
const snap = {
  type:'snapshot',scope:'public',site:'haksterai',box:'dell',ts:new Date().toISOString(),
  server:{status:'online',uptimeSec:500,node:'v24'},
  build:{id:'2026-11-20T16:00:00.000Z',builtAt:'2026-11-20T16:00:00.000Z',ageSec:60},
  job:{state:'IDLE',label:'Idle',percent:null,indeterminate:false},
  stability:{state:'STABLE',reason:'ok',window:{configuredSec:90,approved:true,remainingSec:0},timestamps:{lastCheckAt:new Date().toISOString()},evidence:{checks:11,passing:11,ratio:1},heal:{healed:[],escalated:[]},checks:[]},
};
(async () => {
  const browser = await puppeteer.launch({ executablePath:'/usr/bin/chromium', headless:'new',
    args:['--no-sandbox','--disable-dev-shm-usage'], userDataDir:'/home/ghost/tmp-verify/chrome-ga-' + Date.now() });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.setRequestInterception(true);
  page.on('request', async (req) => {
    const u = req.url();
    if (u.includes('/api/version')) return req.respond({ status:200, contentType:'application/json', body:'{"build":"2026-11-20T16:00:00.000Z","server":{"build":"x","pending":0}}' });
    if (u.includes('/api/applet/status')) return req.respond({ status:200, contentType:'application/json', body: JSON.stringify(snap) });
    if (u.includes('/api/applet/stream')) return req.respond({ status:200, contentType:'text/event-stream', body:'' });
    req.continue();
  });
  await page.goto('https://haksterai.com/', { waitUntil:'domcontentloaded', timeout:45000 });
  await new Promise(r => setTimeout(r, 1200));
  const m = await page.evaluate(() => {
    let el = document.getElementById('phantom-server-applet');
    const chain = [];
    while (el && el !== document.documentElement) {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      chain.push({ tag: el.tagName, id: el.id || '', cls: (el.className || '').toString().slice(0,40),
        left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width),
        transform: cs.transform, zoom: cs.zoom, position: cs.position, right_css: cs.right, paddingRight: cs.paddingRight, overflow: cs.overflow });
      el = el.parentElement;
    }
    return { inner: window.innerWidth, chain };
  });
  console.log(JSON.stringify(m, null, 1));
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
