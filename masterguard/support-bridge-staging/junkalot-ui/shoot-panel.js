#!/usr/bin/env node
// Visual verification of the live Inbox panel and its popout workspaces.
// Runs on Parrot against http://localhost:5006 (the served build). It mints a
// short-lived admin session in memory only (never written to disk, never printed)
// so the owner-only admin page can be opened headlessly, then screenshots the five
// CLAUDE.md §18 viewports plus each expanded workspace, and records real measured
// boxes next to each picture.
const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer')
const { encode } = require('/home/ghost694/junkalot/node_modules/next-auth/jwt')

const OUT = '/home/ghost694/codex-vision-20261123'
const BASE = 'http://localhost:5006'
const OWNER = 'dekekenneth840@gmail.com'

function envFromFile(name) {
  const env = fs.readFileSync('/home/ghost694/junkalot/.env.local', 'utf8')
  for (const line of env.split('\n')) {
    const m = new RegExp('^\\s*(?:export\\s+)?' + name + '\\s*=\\s*(.*)$').exec(line)
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  }
  return ''
}

const VIEWPORTS = [
  { name: '360x640', width: 360, height: 640 },
  { name: '390x844', width: 390, height: 844 },
  { name: '414x896', width: 414, height: 896 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1440x900', width: 1440, height: 900 },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function measure(page) {
  return page.evaluate(() => {
    const box = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) }
    }
    const section = document.querySelector('section[aria-label="Live notices from PhantomIDE"]')
    const close = document.querySelector('[aria-label="Close the expanded panel"]')
    const ws = close ? close.closest('div[class*="fixed inset-0"]') : null
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      pageOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      bodyOverflowY: document.body.style.overflow,
      htmlOverflowY: document.documentElement.style.overflow,
      panel: box(section),
      workspace: box(ws),
      closeButton: box(close),
    }
  })
}

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const secret = envFromFile('NEXTAUTH_SECRET')
  if (!secret) throw new Error('NEXTAUTH_SECRET not found in .env.local')
  const secure = String(envFromFile('NEXTAUTH_URL')).startsWith('https:')
  const jwt = await encode({ token: { name: 'Owner', email: OWNER, sub: 'visual-verify', role: 'admin' }, secret, maxAge: 3600 })

  // NextAuth v4 names this cookie __Secure-… whenever NEXTAUTH_URL is https, which it is
  // on the public site; try the matching name and the plain one, and keep whichever the
  // server actually accepts.
  let cookieName = ''
  for (const name of [secure ? '__Secure-next-auth.session-token' : 'next-auth.session-token', 'next-auth.session-token', '__Secure-next-auth.session-token']) {
    const res = await fetch(BASE + '/api/auth/session', { headers: { cookie: name + '=' + jwt } })
    const session = await res.json().catch(() => ({}))
    if (session && session.user && String(session.user.email).toLowerCase() === OWNER) { cookieName = name; break }
  }
  if (!cookieName) throw new Error('the minted session was not accepted')

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    protocolTimeout: 120000,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
  })
  const report = { at: new Date().toISOString(), shots: [], errors: [] }
  try {
    const page = await browser.newPage()
    page.on('pageerror', (err) => report.errors.push('pageerror: ' + String(err).slice(0, 200)))
    await page.setViewport(VIEWPORTS[4])
    await page.setCookie({ name: cookieName, value: jwt, url: BASE, path: '/', httpOnly: true, secure: cookieName.startsWith('__Secure-') })
    await page.goto(BASE + '/admin/security?tab=ai', { waitUntil: 'domcontentloaded', timeout: 90000 })
    // The Inbox tab lives in the Coach nav; its title text changes once mail counts load,
    // so find it by its own label instead of by title.
    await page.waitForFunction(
      () => Boolean(Array.from(document.querySelectorAll('nav[aria-label="Admin sections"] button')).find((b) => /inbox/i.test(b.textContent || ''))),
      { timeout: 60000 }
    )
    const inboxBtn = await page.evaluateHandle(() => Array.from(document.querySelectorAll('nav[aria-label="Admin sections"] button')).find((b) => /inbox/i.test(b.textContent || '')))
    await page.evaluate((el) => el.click(), inboxBtn)
    await page.waitForSelector('section[aria-label="Live notices from PhantomIDE"]', { timeout: 30000 })
    await sleep(1500)
    // The panel opens as a centred window. Close the tour if it appeared.
    await page.evaluate(() => {
      const skip = Array.from(document.querySelectorAll('button')).find((b) => /skip|got it|close/i.test(b.textContent || '') && b.offsetParent !== null && /tour|skip/i.test(b.textContent || ''))
      if (skip) skip.click()
    })

    for (const vp of VIEWPORTS) {
      await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 })
      await sleep(900)
      const shot = (name) => page.screenshot({ path: path.join(OUT, vp.name + '-' + name + '.png') })

      const embedded = await measure(page)
      await shot('panel')
      report.shots.push({ ...vp, view: 'panel', ...embedded })

      // Expand the inbox list.
      const listExpand = await page.$('[aria-label="Expand the list to the whole window"]')
      if (listExpand) {
        await page.evaluate((el) => el.click(), listExpand)
        await sleep(600)
        const m = await measure(page)
        await shot('list')
        report.shots.push({ ...vp, view: 'list-workspace', ...m })
        const close = await page.$('[aria-label="Close the expanded panel"]')
        if (close) { await page.evaluate((el) => el.click(), close); await sleep(400) }
      } else {
        report.errors.push(vp.name + ': list expand control not found')
      }

      // Snapshot workspace — captured at desktop/TV widths where the pane is on screen.
      if (vp.width >= 1440) {
        const snapTab = await page.evaluateHandle(() => Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === 'Snapshot'))
        if (snapTab && snapTab.asElement()) {
          await page.evaluate((el) => el.click(), snapTab.asElement())
          await sleep(400)
          const snapExpand = await page.$('[aria-label="Expand the snapshot"]')
          if (snapExpand) {
            await page.evaluate((el) => el.click(), snapExpand)
            await sleep(600)
            const m = await measure(page)
            await shot('snapshot')
            report.shots.push({ ...vp, view: 'snapshot-workspace', ...m })
            const close = await page.$('[aria-label="Close the expanded panel"]')
            if (close) { await page.evaluate((el) => el.click(), close); await sleep(400) }
          } else {
            report.errors.push(vp.name + ': snapshot expand control not found')
          }
        }
      }

      // Support tab, then expand it. On a phone the right pane is folded away to start
      // with (its "i" button), so reveal it first the way a person would.
      const reveal = await page.$('[aria-label="Show the live snapshot"]')
      if (reveal) { await page.evaluate((el) => el.click(), reveal); await sleep(500) }
      const supportTab = await page.evaluateHandle(() => Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === 'Support'))
      if (supportTab && supportTab.asElement()) {
        await page.evaluate((el) => el.click(), supportTab.asElement())
        await sleep(400)
        await shot('support')
        const supportExpand = await page.$('[aria-label="Expand video support"]')
        if (supportExpand) {
          await page.evaluate((el) => el.click(), supportExpand)
          await sleep(600)
          const m = await measure(page)
          await shot('video')
          report.shots.push({ ...vp, view: 'video-workspace', ...m })
          const close = await page.$('[aria-label="Close the expanded panel"]')
          if (close) { await page.evaluate((el) => el.click(), close); await sleep(400) }
        } else {
          report.errors.push(vp.name + ': video expand control not found')
        }
      } else {
        report.errors.push(vp.name + ': Support tab not found')
      }
    }
  } finally {
    await browser.close().catch(() => {})
    fs.writeFileSync(path.join(OUT, 'measurements.json'), JSON.stringify(report, null, 1))
    console.log('shots:', report.shots.length, 'errors:', report.errors.length)
    for (const e of report.errors) console.log(' -', e)
  }
})().catch((err) => { console.error('FAILED:', err.message); process.exit(1) })
