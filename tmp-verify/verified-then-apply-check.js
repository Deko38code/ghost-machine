// Flow check: new build -> "verifying stability" (no reload) -> STABLE ->
// "Update ready" with a real countdown -> reload. Then a second page checks the
// one-shot "Update applied · stable" note.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
const NEW_BUILD = '2026-11-20T19:05:00.000Z';
const PAGE_BUILD = '2026-11-20T16:5X'; // read from the page at runtime

function appletStatus(stabState, remaining) {
  return {
    type:'snapshot', scope:'public', site:'haksterai', ts:new Date().toISOString(),
    server:{ status:'online', uptimeSec:100, node:'v24' },
    build:{ id:NEW_BUILD, ageSec:5 },
    job:{ state:'IDLE', label:'Idle', percent:null, indeterminate:false },
    stability: {
      state: stabState, reason: stabState === 'STABLE' ? 'no failing check for 90s' : 'observing the new build',
      window: { configuredSec: 90, approved: true, startedAt: new Date(Date.now()-20000).toISOString(), elapsedSec: 20, remainingSec: remaining },
      timestamps: {
        lastCheckAt: new Date().toISOString(),
        deployedBuildId: NEW_BUILD,
        buildFirstStableAt: stabState === 'STABLE' ? new Date().toISOString() : null,
        stableForSec: stabState === 'STABLE' ? 3 : 0,
      },
      evidence: { checks: 11, passing: 11, measured: 11, ratio: 1 },
      heal: { healed: [], escalated: [] },
      checks: [],
    },
  };
}

async function flowCheck() {
  const browser = await puppeteer.launch({ executablePath:'/usr/bin/chromium', headless:'new',
    args:['--no-sandbox','--disable-dev-shm-usage'], userDataDir:'/home/ghost/tmp-verify/chrome-vta-' + Date.now() });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.setRequestInterception(true);
  const t0 = Date.now();
  page.on('request', (req) => {
    const u = req.url();
    const stable = Date.now() - t0 > 16000;
    if (u.includes('/api/version')) return req.respond({ status:200, contentType:'application/json', body: JSON.stringify({ build: NEW_BUILD, server:{ build:'x', stale:false, pending:0 } }) });
    if (u.includes('/api/applet/status')) return req.respond({ status:200, contentType:'application/json', body: JSON.stringify(appletStatus(stable ? 'STABLE' : 'VERIFYING', stable ? 0 : Math.max(0, Math.round((16000 - (Date.now()-t0))/1000)))) });
    if (u.includes('/api/applet/stream')) return req.respond({ status:200, contentType:'text/event-stream', body:'' });
    req.continue();
  });
  let navs = 0;
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) navs += 1; });
  await page.goto('https://haksterai.com/', { waitUntil:'domcontentloaded', timeout:45000 });
  const nav0 = navs;
  const samples = [];
  for (let k = 0; k < 34; k++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const s = await page.evaluate(() => ({
        title: (document.getElementById('psa-title')||{}).textContent || '',
        detail: (document.getElementById('psa-detail')||{}).textContent || '',
        mode: document.getElementById('phantom-server-applet').dataset.mode,
        state: document.getElementById('phantom-server-applet').dataset.state,
        stab: (document.getElementById('psa-stab-state')||{}).textContent || '',
      }));
      s.t = k + 1; s.navs = navs;
      samples.push(s);
    } catch (e) { samples.push({ t:k+1, error:e.message.slice(0,50), navs }); }
  }
  await browser.close();
  return { reloaded: navs > nav0, samples };
}

async function appliedNoteCheck() {
  const browser = await puppeteer.launch({ executablePath:'/usr/bin/chromium', headless:'new',
    args:['--no-sandbox','--disable-dev-shm-usage'], userDataDir:'/home/ghost/tmp-verify/chrome-note-' + Date.now() });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  // Seed a marker for the page's own build, exactly what apiApply leaves behind.
  await page.evaluateOnNewDocument(() => {
    const b = document.documentElement.dataset.haksterBuild || '';
    if (b) sessionStorage.setItem('phantom-applet-applied', JSON.stringify({ build: b, at: Date.now() }));
  });
  await page.setRequestInterception(true);
  let own = '';
  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('/api/version')) return req.respond({ status:200, contentType:'application/json', body: JSON.stringify({ build: own, server:{ build:'x', stale:false, pending:0 } }) });
    if (u.includes('/api/applet/status')) return req.respond({ status:200, contentType:'application/json', body: JSON.stringify(appletStatus('STABLE', 0)) });
    if (u.includes('/api/applet/stream')) return req.respond({ status:200, contentType:'text/event-stream', body:'' });
    if (u === 'https://haksterai.com/') {
      return req.continue().then(() => {}).catch(() => {});
    }
    req.continue();
  });
  await page.goto('https://haksterai.com/', { waitUntil:'domcontentloaded', timeout:45000 });
  own = await page.evaluate(() => document.documentElement.dataset.haksterBuild || '');
  await new Promise(r => setTimeout(r, 3500));
  const out = await page.evaluate(() => ({
    detail: (document.getElementById('psa-detail')||{}).textContent || '',
    mode: document.getElementById('phantom-server-applet').dataset.mode,
    marker: (() => { try { return sessionStorage.getItem('phantom-applet-applied'); } catch { return 'err'; } })(),
  }));
  await browser.close();
  return out;
}

(async () => {
  const flow = await flowCheck();
  const note = await appliedNoteCheck();
  console.log(JSON.stringify({ flow: { reloaded: flow.reloaded, samples: flow.samples.filter((s,i) => i % 2 === 0 || s.navs) }, note }, null, 1));
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
