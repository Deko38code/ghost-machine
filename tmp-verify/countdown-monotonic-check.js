// The stability countdown must never move backwards, even when the feed hands
// back a cached frame with a larger "remainingSec".
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');

let i = 0;
// Deliberate replay: 60, 55, 55 (cached replay of an older value), 45, 40, 35...
const seq = [60, 55, 55, 45, 40, 35, 30, 25, 20];
const snap = () => {
  const remainingSec = seq[Math.min(i, seq.length - 1)];
  i += 1;
  return {
    type: 'snapshot', scope: 'public', site: 'haksterai', box: 'dell', ts: new Date().toISOString(),
    server: { status: 'online', uptimeSec: 600, node: 'v24' },
    build: { id: '2026-11-20T16:00:00.000Z', builtAt: '2026-11-20T16:00:00.000Z', ageSec: 60 },
    job: { state: 'IDLE', label: 'Idle · no build running', percent: null, indeterminate: false },
    stability: { state: 'VERIFYING', reason: 'observation window 30s of 90s',
      window: { configuredSec: 90, approved: true, remainingSec },
      timestamps: { lastCheckAt: new Date().toISOString() },
      evidence: { checks: 11, passing: 11, measured: 11, ratio: 1 }, watchdog: { stale: false, evidenceAgeSec: 2 }, checks: [] },
  };
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'], userDataDir: '/home/ghost/tmp-verify/chrome-countdown-' + Date.now() });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('/api/version')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ build: '2026-11-20T16:00:00.000Z', server: { build: 'x', pending: 0 } }) });
    if (u.includes('/api/applet/') && !u.includes('/api/applet/status')) {
      console.log('OTHER-APPLET', u.split('?')[0]);
      return req.respond({ status: 200, contentType: 'text/event-stream', body: '' });
    }
    if (u.includes('/api/applet/status')) {
      const body = snap();
      console.log('FRAME', new Date().toISOString().slice(17, 23), 'remaining', body.stability.window.remainingSec);
      return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    }
    req.continue();
  });
  await page.goto('https://haksterai.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.evaluate(() => { document.getElementById('psa-tab').click(); });
  const samples = [];
  for (let k = 0; k < 110; k += 1) {
    await new Promise((r) => setTimeout(r, 100));
    const t = await page.evaluate(() => (document.getElementById('psa-stab-detail') || {}).textContent || '');
    const m = t.match(/·\s*((?:\d+m\s*)?\d+s)\s+left/);
    samples.push({ t, sec: m ? m[1] : null, at: new Date().toISOString().slice(17, 23) });
  }
  const toSec = (s) => {
    if (!s) return NaN;
    const mm = s.match(/(?:(\d+)m\s*)?(\d+)s/);
    return mm ? (Number(mm[1] || 0) * 60) + Number(mm[2]) : NaN;
  };
  let backwards = null;
  let prev = null;
  const jumps = [];
  samples.forEach((s, idx) => {
    const v = toSec(s.sec);
    if (!Number.isNaN(v) && prev != null && v > prev) { backwards = { prev, next: v, text: s.t }; jumps.push({ idx, prev, next: v, text: s.t }); }
    if (!Number.isNaN(v)) prev = v;
  });
  console.log('JUMPS', JSON.stringify(jumps));
  console.log('ORDERED', samples.map((s, i) => i + ':' + s.sec).join(' '));
  const parsed = samples.filter((s) => toSec(s.sec) === toSec(s.sec));
  console.log(JSON.stringify({ backwards, first: parsed[0] && parsed[0].t, last: parsed[parsed.length - 1] && parsed[parsed.length - 1].t, values: parsed.map((s) => s.sec) }, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
