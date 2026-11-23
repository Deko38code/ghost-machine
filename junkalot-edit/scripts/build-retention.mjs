#!/usr/bin/env node
// Keep the newest N staged Junkalot builds and remove the older ones.
//
// 2026-11-22 (owner): "need to find some space to make safely". Every update
// stages its own distDir (`.next-junkalot-<label>-<UTC stamp>`) and nothing ever
// retired them, so 242 generations accumulated in six days — 12.6 GB — and the
// disk filled. The owner approved retaining the newest 8 and a retention step in
// the pipeline so it stops recurring.
//
// What may be removed: a directory directly under the project root whose name
// starts with `.next-junkalot-`, older than the newest `keep` generations.
//
// What is never removed, whatever the count says:
//   * the dir next.config.js currently points at (the served build)
//   * the dir named on the command line as the live one
//   * any dir whose name does not match `^.next-junkalot-[A-Za-z0-9._-]+$`
//   * symlinks, files, `.next`, `.next.bak-*`, `.next-backup-*`
//
// Nothing else is deleted and no process is touched. Every removal is appended
// to data/build-retention.jsonl before the directory goes, so the record exists
// even if the run is interrupted.
//
// Usage:
//   node scripts/build-retention.mjs --dry-run            # list, remove nothing
//   node scripts/build-retention.mjs --keep 8             # remove older ones
//   node scripts/build-retention.mjs --keep 8 --live .next-junkalot-x-2026…
import fs from 'node:fs'
import path from 'node:path'

export const BUILD_DIR_RE = /^\.next-junkalot-[A-Za-z0-9._-]+$/

function configuredDistDir(root) {
  try {
    const cfg = fs.readFileSync(path.join(root, 'next.config.js'), 'utf8')
    const line = cfg.match(/distDir[ \t]*:[ \t]*([^\n]+)/)
    if (!line) return null
    const quoted = line[1].match(/['"`][^'"`\n]+['"`]/g)
    if (!quoted || !quoted.length) return null
    return quoted[quoted.length - 1].slice(1, -1)
  } catch {
    return null
  }
}

/** Every real directory under `root` that looks like a staged build, newest first. */
function listBuildDirs(root) {
  const found = []
  for (const name of fs.readdirSync(root)) {
    if (!BUILD_DIR_RE.test(name)) continue
    const full = path.join(root, name)
    let st
    try {
      st = fs.lstatSync(full)
    } catch {
      continue
    }
    if (!st.isDirectory()) continue // symlink or plain file: never ours to move
    found.push({ name, full, mtimeMs: st.mtimeMs })
  }
  found.sort((a, b) => (b.mtimeMs - a.mtimeMs) || (a.name < b.name ? 1 : -1))
  return found
}

/**
 * @param {object} opts
 * @param {string} opts.root        project root (must hold next.config.js + package.json)
 * @param {number} [opts.keep]      generations to retain, newest first (default 8)
 * @param {string[]} [opts.protect] exact directory names that must never be removed
 * @param {boolean} [opts.dryRun]   report the plan, remove nothing
 * @param {(msg: string) => void} [opts.log]
 */
export function pruneBuilds({ root, keep = 8, protect = [], dryRun = false, log = console.log } = {}) {
  const absRoot = path.resolve(root)
  // Refuse to act anywhere that is not the Junkalot project. A wrong cwd must
  // never turn into a delete somewhere else.
  for (const need of ['next.config.js', 'package.json']) {
    if (!fs.existsSync(path.join(absRoot, need))) {
      throw new Error(`refusing to prune: ${absRoot} has no ${need}`)
    }
  }

  const retain = Math.min(100, Math.max(1, Math.trunc(Number(keep) || 8)))
  const live = configuredDistDir(absRoot)
  const guarded = new Set(protect.filter(Boolean))
  if (live) guarded.add(live)

  const all = listBuildDirs(absRoot)
  const keepSet = new Set(all.slice(0, retain).map((d) => d.name))
  for (const name of guarded) keepSet.add(name)

  const candidates = all.filter((d) => !keepSet.has(d.name))

  // The served build and the newest generations always survive, however many
  // candidates there are. If we somehow see fewer builds than we must keep,
  // there is nothing to do and nothing to fear.
  const retained = all.filter((d) => keepSet.has(d.name)).map((d) => d.name)
  const removed = []

  log(`[retention] ${all.length} staged builds found; keeping ${retained.length}: ${retained.join(', ') || '(none)'}`)
  log(`[retention] ${candidates.length} candidate(s) older than the newest ${retain}`)

  for (const dir of candidates) {
    // Re-check the invariant on the exact path we are about to touch: a direct
    // child of the project root, named like a staged build, a real directory.
    if (path.dirname(dir.full) !== absRoot) {
      log(`[retention] SKIP (not a direct child): ${dir.name}`)
      continue
    }
    if (!BUILD_DIR_RE.test(dir.name)) {
      log(`[retention] SKIP (name not a staged build): ${dir.name}`)
      continue
    }
    if (guarded.has(dir.name)) {
      log(`[retention] SKIP (protected): ${dir.name}`)
      continue
    }
    try {
      if (!fs.lstatSync(dir.full).isDirectory()) {
        log(`[retention] SKIP (not a directory): ${dir.name}`)
        continue
      }
    } catch {
      continue
    }

    if (dryRun) {
      removed.push(dir.name)
      continue
    }

    const record = { at: new Date().toISOString(), dir: dir.name, action: 'prune', kept: retain, live: live || null }
    try {
      fs.appendFileSync(path.join(absRoot, 'data', 'build-retention.jsonl'), `${JSON.stringify(record)}\n`)
    } catch {
      log(`[retention] could not write the record for ${dir.name}; leaving it in place`)
      continue
    }
    try {
      fs.rmSync(dir.full, { recursive: true, force: false })
      removed.push(dir.name)
    } catch (err) {
      log(`[retention] FAILED to remove ${dir.name}: ${err?.message || err}`)
    }
  }

  log(`[retention] ${dryRun ? 'would remove' : 'removed'} ${removed.length} director${removed.length === 1 ? 'y' : 'ies'}`)
  return { retained, removed, candidates: candidates.map((d) => d.name), dryRun }
}

function main() {
  const args = process.argv.slice(2)
  const flag = (name, fallback) => {
    const i = args.lastIndexOf(name)
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback
  }
  const root = process.cwd()
  const result = pruneBuilds({
    root,
    keep: Number(flag('--keep', process.env.JUNKALOT_KEEP_BUILDS || '8')),
    protect: [flag('--live', '')].filter(Boolean),
    dryRun: args.includes('--dry-run'),
  })
  if (args.includes('--json')) process.stdout.write(`${JSON.stringify(result)}\n`)
}

// Only run when invoked directly; importing this module must have no effect.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main()
}
