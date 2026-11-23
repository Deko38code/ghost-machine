import fs from 'node:fs'
import path from 'node:path'

/**
 * Live portfolio image check (owner, 2026-11-21: "need correct count of
 * portfolio images real time always for verification check").
 *
 * The build-time guard (scripts/portfolio-guard.mjs) answers the same question
 * once per build. This answers it on request, with a short cache, so the update
 * applet's checklist is the current state of the files on disk and not a
 * snapshot from the last deploy.
 *
 * What a variant must be to count as present: a readable WebP of at least
 * MIN_BYTES. Width is recorded, never judged — a source photo smaller than its
 * slot is a valid image (`smallerThanSlot`), not a missing one (owner,
 * 2026-11-21: "the size is correct"). Only absent or unreadable files fail.
 */

const ROOT = process.cwd()
const MANIFEST = path.join(ROOT, 'src', 'app', 'portfolio', 'image-manifest.json')
const OUT_DIR = path.join(ROOT, 'public', 'images', 'opt')
const MIN_BYTES = 512
const TTL_MS = 30_000
const HEAD_BYTES = 48

export type PortfolioReport = {
  checkedAt: string
  status: 'ok' | 'fail'
  entries: number
  variantsExpected: number
  variantsPresent: number
  variantsMissing: number
  variantsUnreadable: number
  variantsSmallerThanSlot: number
  missing: string[]
  unreadable: string[]
  smallerThanSlot: string[]
  error?: string
}

let cache: { at: number; manifestMtimeMs: number; report: PortfolioReport } | null = null

function readWebpSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 30) return null
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null
  const chunk = buf.toString('ascii', 12, 16)
  if (chunk === 'VP8 ') {
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff }
  }
  if (chunk === 'VP8L') {
    const b = buf.subarray(21, 25)
    const width = 1 + (((b[1] & 0x3f) << 8) | b[0])
    const height = 1 + (((b[3] & 0x0f) << 10) | (b[2] << 2) | ((b[1] & 0xc0) >> 6))
    return { width, height }
  }
  if (chunk === 'VP8X') {
    return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) }
  }
  return null
}

/** Reads only the container header — never the whole image. */
function readHead(file: string): { size: number; head: Buffer } | null {
  try {
    const st = fs.statSync(file)
    const fd = fs.openSync(file, 'r')
    try {
      const head = Buffer.alloc(Math.min(HEAD_BYTES, Math.max(0, st.size)))
      if (head.length) fs.readSync(fd, head, 0, head.length, 0)
      return { size: st.size, head }
    } finally {
      fs.closeSync(fd)
    }
  } catch {
    return null
  }
}

export function checkPortfolioAssets(): PortfolioReport {
  const manifestMtimeMs = (() => {
    try { return fs.statSync(MANIFEST).mtimeMs } catch { return 0 }
  })()
  if (cache && Date.now() - cache.at < TTL_MS && cache.manifestMtimeMs === manifestMtimeMs) {
    return cache.report
  }

  const report: PortfolioReport = {
    checkedAt: new Date().toISOString(),
    status: 'fail',
    entries: 0,
    variantsExpected: 0,
    variantsPresent: 0,
    variantsMissing: 0,
    variantsUnreadable: 0,
    variantsSmallerThanSlot: 0,
    missing: [],
    unreadable: [],
    smallerThanSlot: [],
  }

  let manifest: Record<string, unknown> | null = null
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  } catch (err) {
    report.error = 'the portfolio manifest could not be read: ' + (err instanceof Error ? err.message : String(err))
  }

  if (manifest && typeof manifest === 'object') {
    for (const key of Object.keys(manifest)) {
      report.entries += 1
      const sizes = Array.isArray(manifest[key]) ? (manifest[key] as unknown[]) : []
      for (const size of sizes) {
        report.variantsExpected += 1
        const rel = path.join('images', 'opt', `${key}-${size}.webp`)
        const file = path.join(OUT_DIR, `${key}-${size}.webp`)
        const got = readHead(file)
        if (!got) {
          report.missing.push(rel)
          continue
        }
        if (got.size < MIN_BYTES) {
          report.unreadable.push(`${rel} (${got.size} bytes)`)
          continue
        }
        const dims = readWebpSize(got.head)
        if (!dims || !dims.width || !dims.height) {
          report.unreadable.push(`${rel} (not a readable WebP)`)
          continue
        }
        report.variantsPresent += 1
        if (dims.width !== Number(size)) {
          report.smallerThanSlot.push(`${rel} (${dims.width}px in the ${size}px slot)`)
        }
      }
    }
    if (report.entries === 0) report.error = 'the portfolio manifest is empty'
  }

  report.variantsMissing = report.missing.length
  report.variantsUnreadable = report.unreadable.length
  report.variantsSmallerThanSlot = report.smallerThanSlot.length
  report.status = report.variantsExpected > 0
    && report.variantsPresent === report.variantsExpected
    && report.variantsMissing === 0
    && report.variantsUnreadable === 0
    ? 'ok'
    : 'fail'

  cache = { at: Date.now(), manifestMtimeMs, report }
  return report
}
