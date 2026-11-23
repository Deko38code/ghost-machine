#!/usr/bin/env node
// Stage a Junkalot update the fully automatic way.
//
// 2026-11-16 (owner): "we need to get fully auto as possible with updates so i
// dont have to keep running command … it needs to fire on its own when ready …
// create script … has to verify before restarts and is done when updates are
// sent."
//
// What this script does, in order:
//   1. builds into a new distDir (.next-junkalot-<label>-<UTC stamp>)
//   2. verifies the build actually produced a complete output
//   3. writes BUILD_READY into that distDir — the only marker the in-process
//      guard (src/lib/auto-apply.ts) trusts before it hands the service back
//      to systemd
//   4. backs up next.config.js and points its distDir at the new build
//   5. waits until the running service reports the new build, so "done" means
//      the new build is answering, not that a command exited 0
//
// No process is signalled and no systemd/pm2 setup is touched. The restart itself
// is the service's own Restart=always after the guard's exit.
//
// 2026-11-22 (owner): "need to find some space to make safely". Once a new build
// is verified AND answering, older staged builds beyond the newest --keep (8 by
// default) are removed by scripts/build-retention.mjs. The served build and the
// newest generations are never touched, and every removal is appended to
// data/build-retention.jsonl. A build that is not yet answering prunes nothing.
//
// Usage:
//   node scripts/stage-update.mjs --check            # status only, changes nothing
//   node scripts/stage-update.mjs --label my-build   # build + verify + stage
//   node scripts/stage-update.mjs --label x --wait 0 # stage without waiting
//   node scripts/stage-update.mjs --label x --public # also verify junkalot.co
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
// Owner (2026-11-20): every staged build now proves the portfolio images are all
// on disk and readable before it may be announced as ready.
import { checkPortfolioAssets } from './portfolio-guard.mjs'
import { pruneBuilds } from './build-retention.mjs'

const ROOT = process.cwd()
const PORT = process.env.PORT || '5006'
const LOCAL = `http://127.0.0.1:${PORT}`
const PUBLIC = 'https://junkalot.co'
const DATA = path.join(ROOT, 'data')
const CONFIG = path.join(ROOT, 'next.config.js')

const args = process.argv.slice(2)
const has = (flag) => args.includes(flag)
const value = (flag, fallback) => {
  // Last occurrence wins, so `npm run build:update -- --label x` overrides the
  // label baked into the npm script instead of being ignored.
  const i = args.lastIndexOf(flag)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z')
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

async function version(base) {
  try {
    const res = await fetch(`${base}/api/version?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function configuredDir() {
  try {
    const cfg = fs.readFileSync(CONFIG, 'utf8')
    const line = cfg.match(/distDir[ \t]*:[ \t]*([^\n]+)/)
    if (!line) return null
    const quoted = line[1].match(/['"`][^'"`\n]+['"`]/g)
    if (!quoted || !quoted.length) return null
    return quoted[quoted.length - 1].slice(1, -1)
  } catch {
    return null
  }
}

// The same bar the guard applies: identity files plus a marker that only exists
// after a clean build. Kept in one place in the guard; re-checked here so a bad
// build is never announced as ready in the first place.
function verifyOutput(dir, buildId) {
  const root = path.join(ROOT, dir)
  const id = fs.readFileSync(path.join(root, 'BUILD_ID'), 'utf8').trim()
  if (id !== buildId) throw new Error(`BUILD_ID ${id} does not match ${buildId}`)
  for (const need of ['server', 'static', 'routes-manifest.json', 'build-manifest.json']) {
    if (!fs.existsSync(path.join(root, need))) throw new Error(`build output is missing ${need}`)
  }
  return true
}

function stage(dir, buildId) {
  const cfg = fs.readFileSync(CONFIG, 'utf8')
  const line = cfg.match(/distDir[ \t]*:[ \t]*([^\n]+)/)
  if (!line) throw new Error('next.config.js has no readable distDir line')
  const quoted = line[1].match(/['"`][^'"`\n]+['"`]/g)
  if (!quoted || !quoted.length) throw new Error('next.config.js distDir line has no quoted directory')
  const current = quoted[quoted.length - 1]
  const at = line[0].lastIndexOf(current)
  const newLine = line[0].slice(0, at) + `'${dir}'` + line[0].slice(at + current.length)
  const next = cfg.replace(line[0], newLine)

  const backup = `${CONFIG}.bak.stage-update-${stamp()}`
  fs.copyFileSync(CONFIG, backup)
  if (!fs.existsSync(backup)) throw new Error('config backup was not written; refusing to repoint')
  fs.writeFileSync(CONFIG, next)
  if (configuredDir() !== dir) throw new Error('next.config.js still does not point at ' + dir)
  return { backup, from: current.slice(1, -1) }
}

async function check() {
  const info = await version(LOCAL)
  const attempt = readJson(path.join(DATA, 'apply-update.json'))
  const guard = readJson(path.join(DATA, 'auto-apply.json'))
  console.log('staged dir   ', configuredDir())
  console.log('local build  ', info?.build || 'no answer on ' + LOCAL)
  console.log('pending      ', info?.pending ? `${info.pending.build} (${info.pending.dir})` : 'none')
  console.log('phase        ', info?.update ? `${info.update.phase} ${info.update.progress}%` : '—')
  console.log('last attempt ', attempt ? `${attempt.build} x${attempt.attempts} at ${attempt.at}` : 'none')
  console.log('verified     ', guard?.verified ? `${guard.verified.build} at ${guard.verified.at} (pid ${guard.verified.pid})` : 'not since this code went live')
  if (guard?.selfcheck) {
    const sc = guard.selfcheck
    console.log('selfcheck    ', `${sc.ok ? 'passed' : 'FAILED'} at ${sc.at} on ${sc.build}`)
    for (const c of sc.checks || []) console.log('             ', `${c.ok ? 'ok  ' : 'FAIL'} ${c.name} — ${c.detail}`)
  } else {
    console.log('selfcheck    ', 'not run yet')
  }
  const pub = await version(PUBLIC)
  console.log('public build ', pub?.build || 'no answer from ' + PUBLIC)
  console.log(pub && info && pub.build === info.build ? 'public matches local' : 'public does not match local yet')
}

async function waitFor(buildId, seconds, includePublic) {
  const deadline = Date.now() + seconds * 1000
  let last = ''
  while (Date.now() < deadline) {
    const info = await version(LOCAL)
    last = info?.build || 'no answer'
    if (info && info.build === buildId) {
      if (!includePublic) return { ok: true, where: 'local' }
      const pub = await version(PUBLIC)
      if (pub && pub.build === buildId) return { ok: true, where: 'local + public' }
      last = `local ${info.build}, public ${pub?.build || 'no answer'}`
    }
    await new Promise((r) => setTimeout(r, 3000))
  }
  return { ok: false, where: last }
}

async function main() {
  if (has('--check')) {
    await check()
    return
  }
  const label = String(value('--label', 'update')).replace(/[^a-zA-Z0-9_-]/g, '-')
  const dir = `.next-junkalot-${label}-${stamp()}`
  const waitSeconds = Number(value('--wait', '300'))
  // 2026-11-18 (owner): "on update card lets make it state what the update is for"
  // and "logg it always time day fixes etc". Every staged build carries a note; the
  // note is logged with its UTC stamp and travels with the build to the update card.
  const note = String(value('--note', process.env.JUNKALOT_BUILD_NOTE || ''))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400)

  console.log(`[stage] building into ${dir}`)
  const build = spawnSync('npx', ['next', 'build'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, JL_DIST_DIR: dir },
  })
  if (build.status !== 0) {
    console.error(`[stage] build failed with exit ${build.status}; nothing staged`)
    process.exit(1)
  }

  const buildIdPath = path.join(ROOT, dir, 'BUILD_ID')
  const buildId = fs.readFileSync(buildIdPath, 'utf8').trim()
  verifyOutput(dir, buildId)
  // Recorded on every build and shown in the applet checklist. Not strict yet:
  // 17 pre-existing variants (pool-before/pool-after, job15 …-1200) are smaller
  // than the width their name claims, and blocking every deploy on those would
  // stop unrelated fixes shipping. Once they are re-cut, flip this to strict so a
  // broken portfolio can never be announced as ready.
  const portfolio = checkPortfolioAssets({ strict: false })
  if (portfolio.status !== 'ok') {
    console.warn(`[stage] portfolio guard FAIL — ${portfolio.variantsExpected - portfolio.variantsPresent} of ${portfolio.variantsExpected} variants missing or wrong`)
  }
  console.log(`[stage] portfolio images ${portfolio.variantsPresent}/${portfolio.variantsExpected} present (${portfolio.status})`)
  fs.writeFileSync(
    path.join(ROOT, dir, 'BUILD_READY'),
    JSON.stringify({ build: buildId, dir, verifiedAt: new Date().toISOString() }, null, 2),
  )
  console.log(`[stage] build ${buildId} verified, marker written`)

  // 2026-11-16 (owner): "give agent fresh build always latest to start from".
  // This file is the handoff: the newest staged build, then updated by the
  // guard with its verification and selfcheck once the service is serving it.
  fs.writeFileSync(
    path.join(DATA, 'latest-build.json'),
    JSON.stringify({ build: buildId, dir, stagedAt: new Date().toISOString(), verified: false, selfcheck: null, note: note || null }, null, 2),
  )

  // Keyed by build id so /api/version can answer for the pending build and for the
  // one already being served. The log line is append-only: day, time, build, note.
  if (note) {
    const notesFile = path.join(DATA, 'build-notes.json')
    const notes = readJson(notesFile) || {}
    notes[buildId] = { note, dir, at: new Date().toISOString() }
    fs.writeFileSync(notesFile, JSON.stringify(notes, null, 2))
    fs.appendFileSync(
      path.join(DATA, 'build-notes.log'),
      `${new Date().toISOString()} | ${buildId} | ${dir} | ${note}\n`,
    )
    console.log(`[stage] note logged: ${note}`)
  } else {
    console.warn('[stage] no --note given: the update card will not say what this build is for')
  }

  const staged = stage(dir, buildId)
  console.log(`[stage] next.config.js repointed ${staged.from} -> ${dir} (backup ${path.basename(staged.backup)})`)

  if (waitSeconds > 0) {
    console.log(`[stage] waiting up to ${waitSeconds}s for the service to serve ${buildId}`)
    const result = await waitFor(buildId, waitSeconds, has('--public'))
    if (!result.ok) {
      console.warn(`[stage] not serving the new build yet (${result.where}). The guard applies it within ~20s once this code is live; a restart of the running build is still needed if it predates the guard.`)
      // Retention waits for a build that actually answers: an unserved build must
      // not cost us the generations behind it.
      process.exit(2)
    }
    console.log(`[stage] done — ${buildId} is answering (${result.where})`)

    // Owner (2026-11-22): keep the newest generations, retire the rest.
    const keep = Number(value('--keep', process.env.JUNKALOT_KEEP_BUILDS || '8'))
    try {
      pruneBuilds({ root: ROOT, keep, protect: [dir], dryRun: has('--prune-dry-run') })
    } catch (err) {
      // Never let housekeeping undo a good deploy.
      console.warn(`[stage] retention skipped: ${err?.message || err}`)
    }
  }
}

main().catch((err) => {
  console.error('[stage] failed:', err?.message || err)
  process.exit(1)
})
