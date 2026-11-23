const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
function status(build, stabState) {
  return { type:'snapshot',scope:'public',site:'haksterai',ts:new Date().toISOString(),
    server:{status:'online',uptimeSec:100,node:'v24'}, build:{id:build,ageSec:5},
    job:{state:'IDLE',label:'Idle'},
    stability:{state:stabState,reason:stabState==='STABLE'?'no failing check for 90s':'observing',window:{configuredSec:90,approved:true,remainingSec:0},
      timestamps:{lastCheckAt:new Date().toISOString(),deployedBuildId:build,buildFirstStableAt:stabState==='STABLE'?new Date().toISOString():null,stableForSec:stabState==='STABLE'?4:0},
      evidence:{checks:11,passing:11,ratio:1},heal:{healed:[],escalated:[]},checks:[]} };
}
(async () => {
  const browser = await puppeteer.launch({ executablePath:'/usr/bin/chromium', headless:'new',
    args:['--no-sandbox','--disable-dev-shm-usage'], userDataDir:'/home/ghost/tmp-verify/chrome-note2-' + Date.now() });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.setRequestInterception(true);
  let own = '';
  const stab = process.argv[2] === 'verifying' ? 'VERIFYING' : 'STABLE';
  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('/api/version')) return req.respond({ status:200, contentType:'application/json', body: JSON.stringify({ build: own, server:{build:'x',stale:false,pending:0} }) });
    if (u.includes('/api/applet/status')) return req.respond({ status:200, contentType:'application/json', body: JSON.stringify(status(own, stab)) });
    if (u.includes('/api/applet/stream')) return req.respond({ status:200, contentType:'text/event-stream', body:'' });
    req.continue();
  });
  await page.goto('https://haksterai.com/', { waitUntil:'domcontentloaded', timeout:45000 });
  own = await page.evaluate(() => document.documentElement.dataset.haksterBuild || '');
  // Seed the one-shot marker exactly as apiApply does, then reload like the tab would.
  await page.evaluate((b) => { sessionStorage.setItem('phantom-applet-applied', JSON.stringify({ build: b, at: Date.now() })); }, own);
  await page.reload({ waitUntil:'domcontentloaded' });
  await new Promise(r => setTimeout(r, 3000));
  const out = await page.evaluate(() => ({
    detail: (document.getElementById('psa-detail')||{}).textContent || '',
    title: (document.getElementById('psa-title')||{}).textContent || '',
    mode: document.getElementById('phantom-server-applet').dataset.mode,
    state: document.getElementById('phantom-server-applet').dataset.state,
    marker: (() => { try { return sessionStorage.getItem('phantom-applet-applied'); } catch { return 'err'; } })(),
  }));
  console.log(JSON.stringify({ own, stab, ...out }, null, 1));
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
