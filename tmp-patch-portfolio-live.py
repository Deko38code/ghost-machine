#!/usr/bin/env python3
"""Junkalot portfolio count: live exact counts, slot width is informational.

Owner 2026-11-21: "need correct count of portfolio images real time always for
verification check", "the size is correct", "dont change any sizes".
No image file is touched; only how the count is measured and displayed.
"""
import io, sys

BASE = "/home/ghost694/junkalot/"
ROUTE = BASE + "src/app/api/version/route.ts"
GUARD = BASE + "scripts/portfolio-guard.mjs"
TOAST = BASE + "src/components/UpdateToast.tsx"
STAMP = ".bak-portfolio-live-20261121Z"

def sub(path, old, new, label, count=1):
    src = io.open(path, encoding="utf-8").read()
    if old not in src:
        sys.exit("FAIL anchor %s: %s" % (path, label))
    io.open(path, "w", encoding="utf-8").write(src.replace(old, new, count))
    print("PATCHED", path, "-", label)

# ── 1. version route: live check, build-time file as fallback ────────────────
sub(ROUTE,
"""import { readUpdateState } from '@/lib/update-state'""",
"""import { readUpdateState } from '@/lib/update-state'
import { checkPortfolioAssets } from '@/lib/portfolio-assets'""",
"import live checker")

sub(ROUTE,
"""function readPortfolioGuard() {
  try {
    return JSON.parse(readFileSync(path.join(process.cwd(), 'data', 'portfolio-guard.json'), 'utf8'))
  } catch {
    return null
  }
}""",
"""function readPortfolioGuard() {
  try {
    return JSON.parse(readFileSync(path.join(process.cwd(), 'data', 'portfolio-guard.json'), 'utf8'))
  } catch {
    return null
  }
}

// Owner (2026-11-21): the checklist must show the CURRENT count, not the last
// build's snapshot. The live check reads each variant's header (never the whole
// image) and is cached for 30 s, so every visitor's 2 s poll stays cheap while
// the number is never older than half a minute. The build-time file is only a
// fallback if the live read itself throws.
function readPortfolio() {
  try {
    return checkPortfolioAssets()
  } catch {
    return readPortfolioGuard()
  }
}""",
"live readPortfolio")

sub(ROUTE,
"""      portfolio: readPortfolioGuard(),""",
"""      portfolio: readPortfolio(),""",
"use live portfolio")

# ── 2. build-time guard: same semantics, exact counts ────────────────────────
sub(GUARD,
"""    variantsPresent: 0,
    missing: [],
    unreadable: [],
    wrongWidth: [],
  }""",
"""    variantsPresent: 0,
    variantsMissing: 0,
    variantsUnreadable: 0,
    variantsSmallerThanSlot: 0,
    missing: [],
    unreadable: [],
    smallerThanSlot: [],
  }""",
"guard counters")

sub(GUARD,
"""        if (dims.width !== Number(size)) {
          result.wrongWidth.push(`${rel} (declared ${size}px, file is ${dims.width}px)`)
          continue
        }
        result.variantsPresent += 1""",
"""        result.variantsPresent += 1
        if (dims.width !== Number(size)) {
          // Owner (2026-11-21): "the size is correct" — a photo smaller than
          // its slot is still a real, renderable image. Recorded, never failed.
          result.smallerThanSlot.push(`${rel} (${dims.width}px in the ${size}px slot)`)
        }""",
"slot width informational")

sub(GUARD,
"""    const clean = result.variantsExpected > 0
      && result.variantsPresent === result.variantsExpected
      && !result.missing.length && !result.unreadable.length && !result.wrongWidth.length
    result.status = clean ? 'ok' : 'fail'""",
"""    const clean = result.variantsExpected > 0
      && result.variantsPresent === result.variantsExpected
      && !result.missing.length && !result.unreadable.length
    result.variantsMissing = result.missing.length
    result.variantsUnreadable = result.unreadable.length
    result.variantsSmallerThanSlot = result.smallerThanSlot.length
    result.status = clean ? 'ok' : 'fail'""",
"clean rule")

sub(GUARD,
"""      || `${result.variantsExpected - result.variantsPresent} of ${result.variantsExpected} portfolio images are missing or wrong`""",
"""      || `${result.variantsMissing + result.variantsUnreadable} of ${result.variantsExpected} portfolio images are missing or unreadable`""",
"strict message")

sub(GUARD,
"""    if (r.wrongWidth.length) console.log('[portfolio] wrong width: ' + r.wrongWidth.slice(0, 20).join(', '))""",
"""    if (r.smallerThanSlot.length) console.log('[portfolio] smaller than its slot (valid image, informational): ' + r.smallerThanSlot.slice(0, 20).join(', '))""",
"guard log line")

# ── 3. applet: type, mapping, exact wording ─────────────────────────────────
sub(TOAST,
"""type PortfolioGuard = {
  checkedAt: string
  status: 'ok' | 'fail'
  entries: number
  variantsExpected: number
  variantsPresent: number
  missing?: string[]
  unreadable?: string[]
  wrongWidth?: string[]
}""",
"""type PortfolioGuard = {
  checkedAt: string
  status: 'ok' | 'fail'
  entries: number
  variantsExpected: number
  variantsPresent: number
  // Exact counts from the checker (2026-11-21). The arrays below are capped for
  // display; these numbers always describe the whole set.
  variantsMissing?: number
  variantsUnreadable?: number
  variantsSmallerThanSlot?: number
  missing?: string[]
  unreadable?: string[]
  smallerThanSlot?: string[]
  // Older build-time snapshots used wrongWidth for the same fact.
  wrongWidth?: string[]
}""",
"toast type")

sub(TOAST,
"""              variantsPresent: Number(data.portfolio.variantsPresent) || 0,
              missing: Array.isArray(data.portfolio.missing) ? data.portfolio.missing.slice(0, 20).map(String) : [],
              unreadable: Array.isArray(data.portfolio.unreadable) ? data.portfolio.unreadable.slice(0, 20).map(String) : [],
              wrongWidth: Array.isArray(data.portfolio.wrongWidth) ? data.portfolio.wrongWidth.slice(0, 20).map(String) : [],""",
"""              variantsPresent: Number(data.portfolio.variantsPresent) || 0,
              variantsMissing: Number(data.portfolio.variantsMissing) || 0,
              variantsUnreadable: Number(data.portfolio.variantsUnreadable) || 0,
              variantsSmallerThanSlot: Number(data.portfolio.variantsSmallerThanSlot) || 0,
              missing: Array.isArray(data.portfolio.missing) ? data.portfolio.missing.slice(0, 20).map(String) : [],
              unreadable: Array.isArray(data.portfolio.unreadable) ? data.portfolio.unreadable.slice(0, 20).map(String) : [],
              smallerThanSlot: Array.isArray(data.portfolio.smallerThanSlot) ? data.portfolio.smallerThanSlot.slice(0, 20).map(String) : [],
              wrongWidth: Array.isArray(data.portfolio.wrongWidth) ? data.portfolio.wrongWidth.slice(0, 20).map(String) : [],""",
"toast mapping")

sub(TOAST,
"""                    value: portfolio.status === 'ok'
                      ? portfolio.variantsPresent + '/' + portfolio.variantsExpected + ' present · ' + portfolio.entries + ' photos'
                      : (portfolio.variantsExpected - portfolio.variantsPresent) + ' of ' + portfolio.variantsExpected + ' missing or the wrong size',""",
"""                    value: [
                      portfolio.variantsPresent + '/' + portfolio.variantsExpected + ' present',
                      (portfolio.variantsMissing ?? portfolio.missing?.length ?? 0) + ' missing',
                      ...((portfolio.variantsUnreadable ?? portfolio.unreadable?.length ?? 0) > 0
                        ? [(portfolio.variantsUnreadable ?? portfolio.unreadable?.length ?? 0) + ' unreadable']
                        : []),
                      ...((portfolio.variantsSmallerThanSlot ?? portfolio.smallerThanSlot?.length ?? 0) > 0
                        ? [(portfolio.variantsSmallerThanSlot ?? portfolio.smallerThanSlot?.length ?? 0) + ' smaller than slot (valid image)']
                        : []),
                      portfolio.entries + ' photos',
                    ].join(' · '),""",
"toast wording")

print("ALL PATCHED")
