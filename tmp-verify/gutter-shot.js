const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
const snap = {
  type:'snapshot',scope:'public',site:'haksterai',box:'dell',ts:new Date().toISOString(),
  server:{status:'online',uptimeSec:500,node:'v24'},
  build:{id:'2026-11-20T16:00:00.000Z',builtAt:'2026-11-20T16:00:00.000Z',ageSec:60},
  job:{state:'IDLE',label:'Idle',percent:null,indeterminate:false},
  stability:{state:'STABLE',reason:'no failing check',window:{configuredSec:90,approved:true,remainingSec:0},timestamps:{lastCheckAt:new Date().toISOString(),buildFirstStableAt:'2026-11-20T16:44:46.688Z',stableForSec:100},evidence:{checks:11,passing:11,ratio:1},heal:{healed:[],escalated:[]},checks:[]},
};
(async () => {
  const browser = await puppeteer.launch({ executablePath:'/usr/bin/chromium', headless:'new',
    args:['--no-sandbox','--disable-dev-shm-usage'], userDataDir:'/home/ghost/tmp-verify/chrome-gs-' + Date.now() });
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
  await new Promise(r => setTimeout(r, 1400));
  try { await page.click('#psa-tab', { delay: 40 }); } catch (_) {}
  await new Promise(r => setTimeout(r, 900));
  await page.screenshot({ path: '/home/ghost/tmp-verify/gutter-390-card.png' });
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
