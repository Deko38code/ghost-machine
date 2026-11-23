// Read-only: load live pages, report the Phantom applet's real mode/state after settle.
// Tells us WHERE the card stays open and what the server told it.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');

const URLS = process.argv.slice(2).length ? process.argv.slice(2) : [
  'https://haksterai.com/',
  'https://phantomide.com/',
  'https://junkalot.co/',
];

async function probe(page) {
  return page.evaluate(() => {
    const root = document.getElementById('phantom-server-applet');
    if (!root) return { has: false };
    const vis = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { display: cs.display, visible: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0, w: Math.round(r.width), h: Math.round(r.height) };
    };
    return {
      has: true,
      mode: root.dataset.mode,
      state: root.dataset.state,
      ready: root.dataset.ready,
      site: root.querySelector('.psa-foot')?.textContent?.trim().slice(0, 60),
      pageBuild: document.documentElement.dataset.haksterBuild || document.documentElement.dataset.phantomBuild || '(none)',
      detail: document.getElementById('psa-detail')?.textContent?.trim(),
      title: document.getElementById('psa-title')?.textContent?.trim(),
      card: vis('.psa-card'),
      chip: vis('.psa-chip'),
      tab: vis('.psa-tab'),
    };
  });
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium', headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    userDataDir: '/home/ghost/tmp-verify/chrome-live-open-' + Date.now(),
  });
  const out = [];
  for (const url of URLS) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    const seen = { version: null, status: null };
    page.on('response', async (res) => {
      const u = res.url();
      try {
        if (u.includes('/api/version')) seen.version = await res.json();
        if (u.includes('/api/applet/status')) seen.status = await res.json();
      } catch {}
    });
    let rec = { url };
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await new Promise((r) => setTimeout(r, 5000));
      rec.probe = await probe(page);
      rec.version = seen.version;
      rec.statusJob = seen.status && seen.status.job;
      rec.statusStab = seen.status && seen.status.stability && seen.status.stability.state;
    } catch (e) { rec.error = e.message; }
    out.push(rec);
    await page.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
