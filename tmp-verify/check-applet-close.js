// Verify applet close X on a given URL: visible, tappable, closes card.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
const URL = process.argv[2] || 'https://haksterai.com/';
const read = (page) => page.evaluate(() => {
  const root = document.getElementById('phantom-server-applet');
  const x = document.getElementById('psa-x');
  const card = document.querySelector('.psa-card');
  const r = x ? x.getBoundingClientRect() : null;
  const cr = card ? card.getBoundingClientRect() : null;
  let top = null, covered = null;
  if (r) {
    const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    top = e ? (e.id || e.className || e.tagName) : null;
    covered = !(e && (e === x || x.contains(e)));
  }
  return { mode: root?.dataset.mode, state: root?.dataset.state,
    x: r ? { w: Math.round(r.width), h: Math.round(r.height), right: Math.round(window.innerWidth - r.right), top: Math.round(r.top) } : null,
    withinCard: (r && cr) ? (r.left >= cr.left && r.right <= cr.right && r.top >= cr.top && r.bottom <= cr.bottom) : null,
    inViewport: r ? (r.left >= 0 && r.right <= window.innerWidth && r.top >= 0 && r.bottom <= window.innerHeight) : null,
    covered, topAtX: top };
});
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'], userDataDir: '/home/ghost/tmp-verify/chrome-ax-' + Date.now() });
  const out = [];
  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 360, height: 640 }]) {
    const p = await b.newPage(); await p.setViewport(vp);
    await p.goto(URL + (URL.includes('?') ? '&' : '?') + 'cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 45000 });
    await new Promise(r => setTimeout(r, 3500));
    // open the card via the resting tab
    await p.evaluate(() => document.getElementById('psa-tab')?.click());
    await new Promise(r => setTimeout(r, 500));
    const open = await read(p);
    await p.evaluate(() => document.getElementById('psa-x')?.click());
    await new Promise(r => setTimeout(r, 400));
    const after = await read(p);
    out.push({ viewport: vp, cardOpen: open.mode, state: open.state, xBox: open.x, withinCard: open.withinCard, inViewport: open.inViewport, covered: open.covered, topAtX: open.topAtX, afterClose: after.mode });
    await p.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
