const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
const snap = {
  type:'snapshot',scope:'public',site:'haksterai',box:'dell',ts:new Date().toISOString(),
  server:{status:'online',uptimeSec:500,node:'v24'},
  build:{id:'2026-11-20T16:00:00.000Z',builtAt:'2026-11-20T16:00:00.000Z',ageSec:60},
  job:{state:'IDLE',label:'Idle · no build running',percent:null,indeterminate:false},
  stability:{state:'STABLE',reason:'no failing check for 166s',window:{configuredSec:90,approved:true,remainingSec:0},timestamps:{lastCheckAt:new Date().toISOString()},evidence:{checks:11,passing:11,measured:11,ratio:1},heal:{healed:[],escalated:[]},checks:[]},
};
(async () => {
  const browser = await puppeteer.launch({ executablePath:'/usr/bin/chromium', headless:'new',
    args:['--no-sandbox','--disable-dev-shm-usage'], userDataDir:'/home/ghost/tmp-verify/chrome-gp-' + Date.now() });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.setRequestInterception(true);
  page.on('request', async (req) => {
    const u = req.url();
    if (u.includes('/api/version')) return req.respond({ status:200, contentType:'application/json', body: JSON.stringify({ build:'2026-11-20T16:00:00.000Z', server:{ build:'x', pending:0 } }) });
    if (u.includes('/api/applet/status')) return req.respond({ status:200, contentType:'application/json', body: JSON.stringify(snap) });
    if (u.includes('/api/applet/stream')) return req.respond({ status:200, contentType:'text/event-stream', body:'' });
    req.continue();
  });
  await page.goto('https://haksterai.com/', { waitUntil:'domcontentloaded', timeout:45000 });
  await new Promise(r => setTimeout(r, 1500));
  try { await page.click('#psa-tab', { delay: 40 }); } catch (_) {}
  await new Promise(r => setTimeout(r, 800));
  const m = await page.evaluate(() => {
    const root = document.getElementById('phantom-server-applet');
    const card = root.querySelector('.psa-card');
    const rr = root.getBoundingClientRect(), cr = card.getBoundingClientRect();
    const cs = getComputedStyle(card);
    return {
      innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth,
      rootLeft: Math.round(rr.left), rootRight: Math.round(window.innerWidth - rr.right), rootW: Math.round(rr.width),
      cardLeft: Math.round(cr.left), cardRight: Math.round(window.innerWidth - cr.right), cardW: Math.round(cr.width),
      cardCssWidth: cs.width, margin: cs.margin, rootRightCss: getComputedStyle(root).right,
    };
  });
  console.log(JSON.stringify(m, null, 1));
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
