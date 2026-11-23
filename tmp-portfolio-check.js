const puppeteer = require('/home/ghost694/haksterAi/node_modules/puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    userDataDir: '/home/ghost694/tmp-verify/chrome-portfolio',
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('https://junkalot.co/', { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise(r => setTimeout(r, 3000));
  // Open the applet card: click whichever docked control exists.
  const clicked = await page.evaluate(() => {
    const root = document.getElementById('junkalot-update-toast');
    if (!root) return 'no root';
    const btn = root.querySelector('button');
    if (btn) { btn.click(); return 'clicked ' + btn.textContent.slice(0, 40); }
    return 'no button; mode=' + root.dataset.mode;
  });
  await new Promise(r => setTimeout(r, 2500));
  const info = await page.evaluate(() => {
    const root = document.getElementById('junkalot-update-toast');
    const out = { clickedMode: root && root.dataset.mode };
    const grp = document.querySelector('[aria-label="Update checklist"]');
    out.checklist = grp ? grp.innerText : null;
    const all = root ? root.innerText : '';
    out.portfolioLines = all.split('\n').filter(l => /Portfolio|missing|present/i.test(l));
    return out;
  });
  console.log(JSON.stringify({ clicked, info }, null, 1));
  const rootEl = await page.$('#junkalot-update-toast');
  if (rootEl) await rootEl.screenshot({ path: '/home/ghost694/tmp-verify/portfolio-checklist.png' });
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
