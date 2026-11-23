// Verify miniforge applet after fix: rest as tab; new build announces then docks.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
const B1 = '2026-11-21T10:47:00.000Z';
const B2 = '2026-11-22T09:00:00.000Z';

const state = (page) => page.evaluate(() => {
  const root = document.getElementById('phantom-server-applet');
  if (!root) return { has: false };
  const c = document.querySelector('.psa-card');
  const cs = c ? getComputedStyle(c) : null; const r = c ? c.getBoundingClientRect() : null;
  return { mode: root.dataset.mode, state: root.dataset.state, card: !!cs && cs.display !== 'none' && r.width > 0,
    detail: (document.getElementById('psa-detail')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) };
});

function mock(page, ctrl) {
  page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (/\/api\/version/.test(u)) {
      return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({
        build: ctrl.build, bots: { build: ctrl.build, count: 4 },
        server: { build: ctrl.build, applying: false, stale: false, pending: 0, error: null },
      }) });
    }
    req.continue();
  });
}
async function seq(page, times) { const out = []; let last = 0; for (const ms of times) { await new Promise(r => setTimeout(r, ms - last)); last = ms; out.push({ at: ms, ...(await state(page)) }); } return out; }

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'], userDataDir: '/home/ghost/tmp-verify/chrome-mf2-' + Date.now() });

  // Scenario 1: plain load -> should rest as tab, never a pinned card
  const a = await browser.newPage(); await a.setViewport({ width: 1440, height: 900 });
  mock(a, { build: B1 });
  await a.goto('https://haksterai.com/miniforge/app/?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 45000 });
  const s1 = await seq(a, [4000, 20000, 65000]);
  await a.close();

  // Scenario 2: new build mid-session -> announce (card) then dock (chip/tab)
  const b = await browser.newPage(); await b.setViewport({ width: 1440, height: 900 });
  const ctrl = { build: B1 };
  mock(b, ctrl);
  await b.goto('https://haksterai.com/miniforge/app/?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise(r => setTimeout(r, 2500));
  await b.mouse.click(200, 300); await new Promise(r => setTimeout(r, 300));
  ctrl.build = B2;
  const s2 = await seq(b, [30000, 62000, 68000, 74000, 82000, 95000]);
  await b.close();

  console.log(JSON.stringify({ plainLoad: s1, newBuild: s2 }, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
