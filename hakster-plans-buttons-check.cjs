#!/usr/bin/env node
// "Don't break other cards": every Subscribe/Buy button must still create a
// live checkout session. The in-page fetch wrapper records the real
// /api/stripe/checkout reply, then hands the page a url-less body so it never
// redirects to Stripe — nothing navigates, nothing is charged.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer');
const URL = process.argv[2] || 'http://127.0.0.1:3579/plans/';

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.evaluateOnNewDocument(() => {
    const orig = window.fetch;
    window.fetch = async function (...args) {
      const res = await orig.apply(this, args);
      if (!String(args[0]).includes('/api/stripe/checkout')) return res;
      let rec = { status: res.status, text: '' };
      try { rec.text = await res.clone().text(); } catch (_) {}
      window.__ck = rec;
      // Hand the page a url-less 200 so startCheckout() re-enables the button
      // instead of navigating to Stripe.
      return new Response(JSON.stringify({ __verified: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => document.body.innerText.includes('Try Me Now'), { timeout: 30000 });

  const total = await page.$$eval('#plan-grid button', (els) => els.length);
  const results = [];
  for (let i = 0; i < total; i++) {
    const info = await page.evaluate((idx) => {
      const b = document.querySelectorAll('#plan-grid button')[idx];
      if (!b) return null;
      const card = b.closest('.rounded-2xl');
      return { title: card ? card.querySelector('h2').textContent.trim() : '?', label: b.textContent.trim() };
    }, i);
    if (!info) { results.push({ i, title: '(missing)', label: '', ok: false, detail: 'no button' }); continue; }

    await page.evaluate(() => { window.__ck = null; });
    await page.evaluate((idx) => { const b = document.querySelectorAll('#plan-grid button')[idx]; if (b) b.click(); }, i);
    await page.waitForFunction(() => window.__ck !== null, { timeout: 30000 }).catch(() => {});
    const ck = await page.evaluate(() => window.__ck);
    let ok = false, detail = 'no reply';
    if (ck) {
      let body = {};
      try { body = JSON.parse(ck.text); } catch (_) {}
      ok = ck.status === 200 && typeof body.url === 'string' && body.url.includes('checkout.stripe.com');
      detail = ck.status + (body.url ? ' url=ok' : ' ' + (body.error || 'no url'));
    }
    results.push({ i, ...info, ok, detail });
    console.log(`${ok ? 'OK  ' : 'FAIL'} #${i} ${info.title} [${info.label}] -> ${detail}`);
  }
  await browser.close();
  const bad = results.filter((r) => !r.ok);
  console.log(`RESULT: ${results.length - bad.length}/${results.length} buttons created a live session`);
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error('ERR', e.message); process.exit(2); });
