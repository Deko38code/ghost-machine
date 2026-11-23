#!/usr/bin/env node
// §18 viewport verification for the HaksterAI plans page ("make our stand out").
// Measures real rendered boxes: no horizontal overflow, cards inside the
// viewport with a gutter, TEAM badges present, team cards carry the green accent.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer');

const URL = process.argv[2] || 'http://127.0.0.1:3579/plans/';
const VIEWPORTS = [
  { w: 360, h: 640, label: 'phone 360x640' },
  { w: 390, h: 844, label: 'phone 390x844' },
  { w: 414, h: 896, label: 'phone 414x896' },
  { w: 1440, h: 900, label: 'desktop 1440x900' },
  { w: 1920, h: 1080, label: 'TV 1920x1080' },
];

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  let bad = 0;
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1 });
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 45000 });
    // Cards are rendered client-side from /api/stripe/plans.
    await page.waitForFunction(
      () => document.body.innerText.includes('Try Me Now')
        && document.querySelectorAll('#mcp-list > span').length === 20
        && Number((document.getElementById('skill-count') || {}).textContent) > 50,
      { timeout: 20000 }
    ).catch(() => {});

    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const gutter = window.innerWidth < 480 ? 20 : 12;
      const cards = Array.from(document.querySelectorAll('h2'))
        .filter(h => h.parentElement && h.parentElement.className.includes('rounded-2xl'))
        .map(h => ({ card: h.parentElement, title: h.textContent.trim() }));
      const boxes = cards.map(c => {
        const r = c.card.getBoundingClientRect();
        return {
          title: c.title,
          left: Math.round(r.left),
          right: Math.round(r.right),
          width: Math.round(r.width),
          inside: r.left >= gutter - 1 && r.right <= window.innerWidth - gutter + 1,
          teamBadge: Array.from(c.card.querySelectorAll('div')).some(d => d.textContent.trim() === 'TEAM'),
          green: (c.card.className || '').includes('00ff41'),
          badgeText: Array.from(c.card.querySelectorAll('div')).map(d => d.textContent.trim()).filter(t => t === 'TEAM' || t === 'First month free' || t === 'Intro offer').join(','),
          cliNote: /CLI \+ API/.test(c.card.innerText),
          perkNote: /PhantomIDE site builder/.test(c.card.innerText),
          buttons: c.card.querySelectorAll('button').length,
        };
      });
      return {
        scrollWidth: de.scrollWidth,
        innerWidth: window.innerWidth,
        horizontalOverflow: de.scrollWidth > window.innerWidth + 1,
        hasTryMe: document.body.innerText.includes('Try Me Now'),
        has1645: /\$16\.45/.test(document.body.innerText),
        teamCards: boxes.filter(b => b.teamBadge).length,
        greenCards: boxes.filter(b => b.green).length,
        trialBadges: boxes.filter(b => /First month free/.test(b.badgeText)).length,
        cliNotes: boxes.filter(b => b.cliNote).length,
        perkCards: boxes.filter(b => b.perkNote).length,
        totalButtons: boxes.reduce((n, b) => n + b.buttons, 0),
        mcpChips: document.querySelectorAll('#mcp-list > span').length,
        mcpCount: (document.getElementById('mcp-count') || {}).textContent,
        skillCount: (document.getElementById('skill-count') || {}).textContent,
        skillChips: document.querySelectorAll('#skill-list > li').length,
        skillCatVisible: !!document.getElementById('skill-cat') && !document.getElementById('skill-cat').hidden,
        featureItems: document.querySelectorAll('#mcp-belt ul > li').length,
        mcpInside: (function () {
          const el = document.getElementById('mcp-belt');
          if (!el) return false;
          const r = el.getBoundingClientRect();
          const g = window.innerWidth < 480 ? 20 : 12;
          return r.left >= g - 1 && r.right <= window.innerWidth - g + 1;
        })(),
        outsideCards: boxes.filter(b => !b.inside).map(b => b.title),
        sample: boxes.slice(0, 12),
      };
    });

    const ok = !m.horizontalOverflow && m.outsideCards.length === 0 &&
      m.teamCards === 4 && m.greenCards === 4 && m.trialBadges >= 1 &&
      m.mcpChips === 20 && m.mcpCount === '20' && m.mcpInside && m.cliNotes >= 4 &&
      Number(m.skillCount) > 50 && m.skillChips === Number(m.skillCount) && m.skillCatVisible &&
      m.featureItems >= 5 && m.perkCards === 1 && m.totalButtons >= 20;
    if (!ok) bad++;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${vp.label}  scrollWidth=${m.scrollWidth}/${m.innerWidth}` +
      ` overflow=${m.horizontalOverflow} tryMe=${m.hasTryMe} $16.45=${m.has1645}` +
      ` teamCards=${m.teamCards} green=${m.greenCards} trialBadges=${m.trialBadges}` +
      ` outside=${JSON.stringify(m.outsideCards)}`);
    for (const b of m.sample) {
      console.log(`    ${b.title}  l=${b.left} r=${b.right} w=${b.width} inside=${b.inside} badge="${b.badgeText}" green=${b.green}`);
    }
    await page.close();
  }
  await browser.close();
  console.log(bad === 0 ? 'RESULT: all viewports pass' : `RESULT: ${bad} viewport(s) failing`);
  process.exit(bad === 0 ? 0 : 1);
})().catch(e => { console.error('ERR', e.message); process.exit(2); });
