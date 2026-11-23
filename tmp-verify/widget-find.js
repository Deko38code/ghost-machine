// Generic: list any fixed bottom-right widget/applet box on a page, whatever its ids.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
const URLS = process.argv.slice(2);
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium', headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    userDataDir: '/home/ghost/tmp-verify/chrome-wfind-' + Date.now(),
  });
  const out = [];
  for (const url of URLS) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    let rec = { url };
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 4000));
      rec = { url, ...(await page.evaluate(() => {
        const hits = [];
        for (const el of document.querySelectorAll('body *')) {
          const cs = getComputedStyle(el);
          if (cs.position !== 'fixed') continue;
          const r = el.getBoundingClientRect();
          if (r.width < 12 || r.height < 12) continue;
          const nearBR = (window.innerWidth - r.right) < 260 && (window.innerHeight - r.bottom) < 260;
          if (!nearBR) continue;
          const id = el.id || '';
          const cl = (el.className && String(el.className)) || '';
          if (!/applet|widget|psa-|jl-|phantom|update/i.test(id + ' ' + cl)) continue;
          hits.push({ tag: el.tagName.toLowerCase(), id, cls: cl.slice(0, 70), w: Math.round(r.width), h: Math.round(r.height), vis: cs.display !== 'none' && cs.visibility !== 'hidden', text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80) });
        }
        // dedupe by id/cls
        const seen = new Set(); return { hits: hits.filter((h) => { const k = h.id + '|' + h.cls; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 12) };
      })) };
    } catch (e) { rec.error = e.message; }
    out.push(rec);
    await page.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
