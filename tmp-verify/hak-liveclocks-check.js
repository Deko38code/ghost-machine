const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium', headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    userDataDir: '/home/ghost/tmp-verify/chrome-liveclocks',
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('https://haksterai.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise(r => setTimeout(r, 2500));
  // open the card
  await page.evaluate(() => {
    const root = document.getElementById('phantom-server-applet');
    const b = root && root.querySelector('.psa-tab, .psa-chip');
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 800));
  const samples = [];
  const t0 = Date.now();
  for (let i = 0; i < 9; i++) {
    samples.push(await page.evaluate(() => {
      const stab = document.querySelector('#psa-stab-detail, [data-role="stab-detail"]');
      const root = document.getElementById('phantom-server-applet');
      const txt = root ? root.innerText.replace(/\s+/g, ' ') : '';
      const m = txt.match(/(\d+m \d+s|\d+s) left of ([^·]+?) window/);
      return { mode: root && root.dataset.mode, state: root && root.dataset.state, left: m ? m[1] + ' of ' + m[2].trim() : null, stab: txt.slice(0, 200) };
    }));
    await new Promise(r => setTimeout(r, 500));
  }
  console.log(JSON.stringify(samples.map(s => ({ t: Date.now() - t0, left: s.left, mode: s.mode, state: s.state })), null, 1));

  // pricing card check
  const p = await browser.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto('https://haksterai.com/plans', { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise(r => setTimeout(r, 2500));
  const plans = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  console.log('plans hasAdminDashboard:', /admin dashboard/i.test(plans), '| hasAdminControls:', /admin controls/i.test(plans));
  const idx = plans.search(/999/);
  console.log('around 999:', idx >= 0 ? plans.slice(Math.max(0, idx - 160), idx + 260) : 'not found');
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
