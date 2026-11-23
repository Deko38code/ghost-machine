// Measure the real Tour component at the §18 viewports with a real browser
// and real timers (CSS transitions finish; virtual time does not advance them).
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer')

const SIZES = [
  [360, 640],
  [390, 844],
  [414, 896],
  [1440, 900],
  [1920, 1080],
]

;(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  })
  const page = await browser.newPage()
  const rows = []
  for (const [w, h] of SIZES) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 })
    await page.goto('http://127.0.0.1:3991/index.html?embed=1', { waitUntil: 'load' })
    await page.evaluate(() => { try { localStorage.clear() } catch {} })
    const steps = []
    for (let i = 0; i < 4; i++) {
      await new Promise(r => setTimeout(r, i === 0 ? 900 : 600))
      const rep = await page.evaluate(() => window.__report())
      steps.push(rep)
      if (i < 3) {
        await page.evaluate(() => {
          const root = document.querySelector('[aria-label="What\'s new tour"]')
          const next = root && Array.from(root.querySelectorAll('button')).find(b => /Next|Got it/.test(b.textContent || ''))
          if (next) next.click()
        })
      }
    }
    rows.push({ w, h, steps })
  }
  console.log(JSON.stringify(rows, null, 1))
  await browser.close()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
