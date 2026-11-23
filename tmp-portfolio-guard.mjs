// ─── Portfolio image guard ───────────────────────────────────────────────────
// Owner (2026-11-20): "add a portfolio image count guard to confirm all are
// present and rendering fully at build times each build update etc add checklist
// to the update applet".
//
// It checks the same list the portfolio grid renders from — src/app/portfolio/
// image-manifest.json — and proves, file by file, that every pre-built variant
// exists, is a real WebP (RIFF/WEBP container), and carries the width the variant
// name claims. Nothing here is inferred: a missing or wrong-sized file is a FAIL.
//
// Writes data/portfolio-guard.json so /api/version and the update applet can show
// the last real result, and exits non-zero when used from the command line with
// --strict so a broken portfolio can never be announced as a ready build.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST = path.join(ROOT, 'src', 'app', 'portfolio', 'image-manifest.json')
const OUT_DIR = path.join(ROOT, 'public', 'images', 'opt')
const RESULT = path.join(ROOT, 'data', 'portfolio-guard.json')
const MIN_BYTES = 512

function readWebpSize(buf) {
  if (buf.length < 30) return null
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null
  const chunk = buf.toString('ascii', 12, 16)
  if (chunk === 'VP8 ') {
    // Lossy: 3-byte frame tag, then the 14-bit width/height at 26/28.
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

export function checkPortfolioAssets({ strict = false } = {}) {
  const checkedAt = new Date().toISOString()
  const result = {
    checkedAt,
    status: 'fail',
    entries: 0,
    variantsExpected: 0,
    variantsPresent: 0,
    missing: [],
    unreadable: [],
    wrongWidth: [],
  }

  let manifest = null
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  } catch (err) {
    result.error = 'the portfolio manifest could not be read: ' + (err instanceof Error ? err.message : String(err))
  }

  if (manifest && typeof manifest === 'object') {
    const keys = Object.keys(manifest)
    result.entries = keys.length
    for (const key of keys) {
      const sizes = Array.isArray(manifest[key]) ? manifest[key] : []
      for (const size of sizes) {
        result.variantsExpected += 1
        const rel = path.join('images', 'opt', `${key}-${size}.webp`)
        const file = path.join(OUT_DIR, `${key}-${size}.webp`)
        let buf
        try {
          buf = fs.readFileSync(file)
        } catch {
          result.missing.push(rel)
          continue
        }
        if (buf.length < MIN_BYTES) {
          result.unreadable.push(`${rel} (${buf.length} bytes)`)
          continue
        }
        const dims = readWebpSize(buf)
        if (!dims || !dims.width || !dims.height) {
          result.unreadable.push(`${rel} (not a readable WebP)`)
          continue
        }
        if (dims.width !== Number(size)) {
          result.wrongWidth.push(`${rel} (declared ${size}px, file is ${dims.width}px)`)
          continue
        }
        result.variantsPresent += 1
      }
    }
    if (result.entries === 0) result.error = 'the portfolio manifest is empty'
    const clean = result.variantsExpected > 0
      && result.variantsPresent === result.variantsExpected
      && !result.missing.length && !result.unreadable.length && !result.wrongWidth.length
    result.status = clean ? 'ok' : 'fail'
  }

  try {
    fs.mkdirSync(path.dirname(RESULT), { recursive: true })
    fs.writeFileSync(RESULT, JSON.stringify(result, null, 2))
  } catch { /* the check itself already has a result; an unwritable file is reported by the caller */ }

  if (strict && result.status !== 'ok') {
    const why = result.error
      || `${result.variantsExpected - result.variantsPresent} of ${result.variantsExpected} portfolio images are missing or wrong`
    throw new Error('portfolio guard: ' + why)
  }
  return result
}

if (process.argv[1] && import.meta.url === 'file://' + path.resolve(process.argv[1])) {
  const strict = process.argv.includes('--strict')
  try {
    const r = checkPortfolioAssets({ strict })
    console.log(
      `[portfolio] ${r.variantsPresent}/${r.variantsExpected} variants present across ${r.entries} photos` +
      (r.missing.length ? ` · ${r.missing.length} missing` : '') +
      (r.unreadable.length ? ` · ${r.unreadable.length} unreadable` : '') +
      (r.wrongWidth.length ? ` · ${r.wrongWidth.length} wrong width` : '') +
      ` · ${r.status.toUpperCase()}`,
    )
    if (r.missing.length) console.log('[portfolio] missing: ' + r.missing.slice(0, 20).join(', '))
    if (r.unreadable.length) console.log('[portfolio] unreadable: ' + r.unreadable.slice(0, 20).join(', '))
    if (r.wrongWidth.length) console.log('[portfolio] wrong width: ' + r.wrongWidth.slice(0, 20).join(', '))
    process.exit(r.status === 'ok' ? 0 : 1)
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exit(2)
  }
}
