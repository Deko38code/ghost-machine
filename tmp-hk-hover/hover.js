const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:3997/dashboard/index.html', { waitUntil: 'networkidle2', timeout: 40000 }).catch(e=>console.log('goto',e.message));
  await new Promise(r => setTimeout(r, 2500));
  const info = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('body *'));
    const draggable = all.filter(e => e.draggable === true).map(e => e.tagName + '.' + (e.className||'').toString().slice(0,40) + ' src=' + (e.getAttribute('src')||'') + ' href=' + (e.getAttribute('href')||''));
    const fixedBig = all.filter(e => { const cs = getComputedStyle(e); if (cs.position !== 'fixed' && cs.position !== 'absolute') return false; const r = e.getBoundingClientRect(); return r.width > 300 && r.height > 300 && cs.pointerEvents !== 'none'; }).map(e => e.tagName + '#' + e.id + '.' + (e.className||'').toString().slice(0,40) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height) + ' pe=' + getComputedStyle(e).pointerEvents + ' z=' + getComputedStyle(e).zIndex);
    return { total: all.length, draggable, fixedBig: fixedBig.slice(0, 20) };
  });
  console.log('ELEMENTS', JSON.stringify(info, null, 1).slice(0, 3000));
  // hover sweep: record rects, move pointer across, record again
  const pts = [];
  for (let y = 80; y < 880; y += 60) for (let x = 40; x < 1400; x += 120) pts.push([x, y]);
  const snap = () => page.evaluate(() => {
    const out = [];
    for (const e of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(e);
      if (cs.position !== 'fixed') continue;
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      out.push({ id: (e.id || e.className || e.tagName).toString().slice(0,40), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), op: cs.opacity });
    }
    return out;
  });
  const before = await snap();
  for (const [x, y] of pts) { await page.mouse.move(x, y); }
  const after = await snap();
  const moved = after.filter(a => { const b = before.find(v => v.id === a.id); return b && (Math.abs(b.x-a.x) > 2 || Math.abs(b.y-a.y) > 2 || b.w !== a.w || b.h !== a.h || b.op !== a.op); });
  console.log('FIXED ELEMENTS BEFORE', JSON.stringify(before).slice(0,1200));
  console.log('FIXED ELEMENTS THAT CHANGED ON HOVER', JSON.stringify(moved).slice(0,1200));
  const sel = await page.evaluate(() => String(window.getSelection && window.getSelection().toString()).slice(0,80));
  console.log('SELECTION AFTER SWEEP:', JSON.stringify(sel));
  await browser.close();
})();
