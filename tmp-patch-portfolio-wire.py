#!/usr/bin/env python3
import io, sys, shutil, os

JL = "/home/ghost694/junkalot/"

def sub(path, old, new, label):
    src = io.open(path, encoding="utf-8").read()
    if old not in src:
        sys.exit("FAIL anchor %s: %s" % (path, label))
    io.open(path, "w", encoding="utf-8").write(src.replace(old, new, 1))
    print("PATCHED", path, "-", label)

# ── stage-update: run the guard as part of every build ───────────────────────
STAGE = JL + "scripts/stage-update.mjs"
shutil.copyfile(STAGE, STAGE + ".bak-portfolio-guard-20261120")
sub(STAGE,
"""import { spawnSync } from 'node:child_process'""",
"""import { spawnSync } from 'node:child_process'
// Owner (2026-11-20): every staged build now proves the portfolio images are all
// on disk and readable before it may be announced as ready.
import { checkPortfolioAssets } from './portfolio-guard.mjs'""",
"import")

sub(STAGE,
"""  verifyOutput(dir, buildId)
  fs.writeFileSync(""",
"""  verifyOutput(dir, buildId)
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
  fs.writeFileSync(""",
"guard call")

# ── /api/version: publish the guard result ──────────────────────────────────
ROUTE = JL + "src/app/api/version/route.ts"
shutil.copyfile(ROUTE, ROUTE + ".bak-portfolio-20261120")
sub(ROUTE,
"""import { NextResponse } from 'next/server'""",
"""import { readFileSync } from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'""",
"imports")

sub(ROUTE,
"""export async function GET() {""",
"""// Owner (2026-11-20): "add a portfolio image count guard ... add checklist to
// the update applet". The last result written at build time, read from disk —
// never recomputed here and never estimated. Null means no build has run the
// guard yet, and the applet says so instead of showing a made-up pass.
function readPortfolioGuard() {
  try {
    return JSON.parse(readFileSync(path.join(process.cwd(), 'data', 'portfolio-guard.json'), 'utf8'))
  } catch {
    return null
  }
}

export async function GET() {""",
"reader")

sub(ROUTE,
"""      update: readUpdateState(),""",
"""      update: readUpdateState(),
      portfolio: readPortfolioGuard(),""",
"payload")

print("WIRED portfolio guard")
