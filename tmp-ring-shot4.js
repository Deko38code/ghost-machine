// Verification harness: the real deployed widget, driven into its real queued state.
// The page build reference is made stale for the first poll only, so the widget sees the
// live build as "newer" exactly as it would during a deploy. Capture triggers on the real
// .jl-ring element, not on copy text.
const puppeteer = require('puppeteer-core');
const URL = 'http://127.0.0.1:5006/';
const VIEWPORTS = [
  { w: 360, h: 640, name: '360x640' },
  { w: 390, h: 844, name: '390x844' },
  { w: 414, h: 896, name: '414x896' },
  { w: 1440, h: 900, name: '1440x900' },
  { w: 1920, h: 1080, name: '1920x1080' },
];
const OUT = '/home/ghost694/tmp-verify/ring-shots3/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--user-data-dir=/home/ghost694/tmp-verify/tmp/chrome2'],
  });
  const page = await browser.newPage();
  let versionCalls = 0;
  await page.setRequestInterception(true);
  page.on('request', async (req) => {
    if (req.url().indexOf('/api/version') >= 0) {
      versionCalls += 1;
      if (versionCalls === 1) {
        try {
          const real = await fetch(req.url(), { cache: 'no-store' }).then((r) => r.json());
          const stale = Object.assign({}, real, { build: 'stale00000000000', pending: null });
          return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(stale) });
        } catch (e) {
          return req.continue();
        }
      }
    }
    req.continue();
  });
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => document.getElementById('junkalot-update-toast'), { timeout: 30000 });
  let text = '';
  let ring = false;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const seen = await page.evaluate(() => {
      const el = document.getElementById('junkalot-update-toast');
      return { text: el ? el.innerText : '', ring: Boolean(el && el.querySelector('.jl-ring')) };
    }).catch(() => ({ text: '', ring: false }));
    if (seen.ring) { text = seen.text; ring = true; break; }
    await sleep(120);
  }
  console.log('RING SEEN:', ring);
  console.log('STATE:', JSON.stringify(text.replace(/\n/g, ' | ')));
  const size = await page.evaluate(() => {
    const r = document.querySelector('.jl-ring');
    if (!r) return null;
    const b = r.getBoundingClientRect();
    const host = document.getElementById('junkalot-update-toast').getBoundingClientRect();
    return { ringW: Math.round(b.width), ringH: Math.round(b.height), hostW: Math.round(host.width), hostH: Math.round(host.height), overflowRight: Math.round(host.right - window.innerWidth) };
  }).catch(() => null);
  console.log('MEASURED:', JSON.stringify(size));
  for (const v of VIEWPORTS) {
    await page.setViewport({ width: v.w, height: v.h });
    await sleep(150);
    const m = await page.evaluate(() => {
      const r = document.querySelector('.jl-ring');
      const h = document.getElementById('junkalot-update-toast');
      if (!r || !h) return null;
      const rb = r.getBoundingClientRect();
      const hb = h.getBoundingClientRect();
      return { ring: [Math.round(rb.width), Math.round(rb.height)], hostRight: Math.round(hb.right), vw: window.innerWidth };
    }).catch(() => null);
    console.log('MEASURE', v.name, JSON.stringify(m));
    await page.screenshot({ path: OUT + 'ring-' + v.name + '.png' });
  }
  await browser.close();
})();
