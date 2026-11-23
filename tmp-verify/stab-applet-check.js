// Measures the live haksterai.com applet with a DEGRADED stability frame whose
// reason carries a long failing-check detail — the widest text this panel can
// now show — at every viewport the rule requires.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
const VPS = [[360, 640], [390, 844], [414, 896], [1440, 900], [1920, 1080]];

const snap = {
  type: 'snapshot', scope: 'public', site: 'haksterai', box: 'dell',
  ts: new Date().toISOString(),
  server: { status: 'online', uptimeSec: 4211, node: 'v24.14.0' },
  build: { id: '2026-11-20T15:45:58.297Z', builtAt: '2026-11-20T15:46:01.379Z', ageSec: 600 },
  job: { state: 'IDLE', label: 'Idle · no build running', percent: null, indeterminate: false },
  stability: {
    state: 'DEGRADED',
    reason: 'failing: resources (mem available 54.6% · load 2.85/core · disk free 30.8%) · error-rate (12 lines/60s)',
    window: { configuredSec: 600, proposedRangeSec: [300, 900], approved: true, startedAt: new Date().toISOString(), elapsedSec: 0, remainingSec: 600 },
    timestamps: { lastCheckAt: new Date().toISOString(), lastDeployedAt: '2026-11-20T15:46:01.379Z', deployedBuildId: '2026-11-20T15:45:58.297Z', buildFirstStableAt: null, stableForSec: 0, deployedAgeSec: 600 },
    evidence: { checks: 11, passing: 9, measured: 11, ratio: 0.82, evidenceRatio: 1 },
    watchdog: { stale: false, evidenceAgeSec: 3 },
    checks: [{ id: 'resources', status: 'fail' }, { id: 'error-rate', status: 'fail' }],
  },
};

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium', headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    userDataDir: '/home/ghost/tmp-verify/chrome-stab-applet',
  });
  const out = [];
  for (const [w, h] of VPS) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h });
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.url().includes('/api/applet/status')) {
        return req.respond({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(snap) });
      }
      req.continue();
    });
    await page.goto('https://haksterai.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await new Promise((r) => setTimeout(r, 2500));
    // Expand the collapsed tab so the card's real box can be measured.
    await page.evaluate(() => { const t = document.getElementById('psa-tab'); if (t) t.click(); });
    await new Promise((r) => setTimeout(r, 800));
    // Open the debug strip the way a tap does.
    await page.evaluate(() => { const b = document.getElementById('psa-stab'); if (b && !b.hidden) b.click(); });
    await new Promise((r) => setTimeout(r, 600));
    const read = await page.evaluate(() => {
      const root = document.getElementById('phantom-server-applet');
      const card = root && root.querySelector('.psa-card');
      const st = root && root.querySelector('#psa-stab');
      const dbgEl = root && root.querySelector('#psa-debug');
      const dbgBody = dbgEl ? dbgEl.querySelector('.psa-debug-body') : null;
      const dbgRect = dbgEl && !dbgEl.hidden ? dbgEl.getBoundingClientRect() : null;
      const r = card ? card.getBoundingClientRect() : null;
      return {
        mode: root && root.dataset.mode,
        card: r ? { w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) } : null,
        viewport: { w: window.innerWidth, h: window.innerHeight },
        overflowX: document.documentElement.scrollWidth > window.innerWidth,
        appletH: getComputedStyle(document.documentElement).getPropertyValue('--phantom-applet-h').trim(),
        stabilityText: st ? st.innerText.replace(/\s+/g, ' ').slice(0, 200) : null,
        debugOpen: dbgRect ? true : false,
        debugBox: dbgRect ? { w: Math.round(dbgRect.width), h: Math.round(dbgRect.height), right: Math.round(dbgRect.right), bottom: Math.round(dbgRect.bottom) } : null,
        debugText: dbgBody ? dbgBody.textContent.split('\n').slice(0, 6).join(' | ') : null,
        rootText: root ? root.innerText.replace(/\s+/g, ' ').slice(0, 260) : null,
      };
    });
    out.push({ vp: w + 'x' + h, ...read });
    await page.screenshot({ path: '/home/ghost/tmp-verify/stab-applet-' + w + 'x' + h + '.png' });
    await page.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
