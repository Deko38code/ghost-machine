// Verify the miniforge applet close X: visible, tappable, closes the card.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
const read = (page) => page.evaluate(() => {
  const root = document.getElementById('phantom-server-applet');
  const x = document.getElementById('psa-x');
  const r = x ? x.getBoundingClientRect() : null;
  let top = null;
  if (r) { const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); top = e ? (e.id || e.className || e.tagName) : null; }
  return { mode: root?.dataset.mode, state: root?.dataset.state,
    x: r ? { w: Math.round(r.width), h: Math.round(r.height), right: Math.round(window.innerWidth - r.right), top: Math.round(r.top) } : null,
    topElementAtX: top, insideViewport: r ? (r.left >= 0 && r.right <= window.innerWidth && r.top >= 0) : false };
});
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'], userDataDir: '/home/ghost/tmp-verify/chrome-x-' + Date.now() });
  const out = [];
  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const p = await b.newPage(); await p.setViewport(vp);
    await p.goto('https://haksterai.com/miniforge/app/?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 45000 });
    await new Promise(r => setTimeout(r, 3000));
    // open the card (it rests as a tab): click the tab
    await p.evaluate(() => document.getElementById('psa-tab')?.click());
    await new Promise(r => setTimeout(r, 400));
    const open = await read(p);
    await p.evaluate(() => document.getElementById('psa-x')?.click());
    await new Promise(r => setTimeout(r, 400));
    const after = await read(p);
    out.push({ viewport: vp, cardOpen: open.mode, xBox: open.x, topAtX: open.topElementAtX, insideViewport: open.insideViewport, afterClose: after.mode });
    await p.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
