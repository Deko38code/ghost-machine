const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new',
    args: ['--no-sandbox','--disable-dev-shm-usage'], userDataDir: '/home/ghost/tmp-verify/chrome-mf-checked' });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto('https://haksterai.com/miniforge/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise(r => setTimeout(r, 3000));
  await p.evaluate(() => { const t = document.getElementById('psa-tab'); if (t) t.click(); });
  const out = [];
  for (let i = 0; i < 9; i++) {
    out.push(await p.evaluate(() => {
      const c = document.getElementById('psa-checked');
      const root = document.getElementById('phantom-server-applet') || document.body;
      const m = (root.innerText || '').match(/Checked\s+(\S+\s+ago|—)/i);
      return { checked: c ? c.textContent : null, line: m ? m[1] : null };
    }));
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
