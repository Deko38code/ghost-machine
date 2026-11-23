#!/usr/bin/env python3
import io, sys

P = "/home/ghost694/junkalot/src/components/UpdateToast.tsx"
src = io.open(P, encoding="utf-8").read()

# ---- 1. ring sizing moves into CSS so it can grow on big screens ----
CSS_OLD = """  '@media (prefers-reduced-motion: reduce){#junkalot-update-toast{animation:none !important}}'"""
CSS_NEW = """  '@media (prefers-reduced-motion: reduce){#junkalot-update-toast{animation:none !important}}' +
  // 2026-11-20 (codex vision review): 32 px read too small from couch distance and the
  // caption repeated the number, so the ring carries the count alone and sizes itself:
  // 40 px on phones, 48 px from 1024 px wide up (desktop and TV).
  '.jl-ring{position:relative;display:inline-block;flex:none;width:40px;height:40px;line-height:1}' +
  '.jl-ring>svg{display:block;width:100%;height:100%}' +
  '.jl-ring>span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#00ff41;font-weight:800;font-size:15px;font-variant-numeric:tabular-nums}' +
  '.jl-ring-tab{width:30px;height:30px}.jl-ring-tab>span{font-size:11px}' +
  '.jl-ring-chip{width:20px;height:20px}.jl-ring-chip>span{font-size:9px}' +
  '@media (min-width:1024px){.jl-ring{width:48px;height:48px}.jl-ring>span{font-size:18px}}'"""
if CSS_OLD not in src:
    sys.exit("FAIL: css anchor")
src = src.replace(CSS_OLD, CSS_NEW, 1)

# ---- 2. component: CSS-sized, no numeric prop ----
start = src.find("function CountdownRing(")
if start < 0:
    sys.exit("FAIL: ring function not found")
end = src.find("export default function UpdateToast()", start)
if end < 0:
    sys.exit("FAIL: ring function end not found")

RING = '''// 2026-11-20 (owner, "add the ring under my ghost with real sec to update fires
// open ... when queing"; then "have codex rweak it"): the ring is drawn from the
// same measured countdown the copy prints, so the arc and the number always agree.
// It only exists while an update is actually queued (countdown > 0) — never a
// decorative animation. Size comes from .jl-ring in SPIN_CSS so it grows on TV.
function CountdownRing({ countdown, variant = 'card' }: { countdown: number; variant?: 'card' | 'tab' | 'chip' }) {
  const total = Math.max(1, AUTO_SECS)
  const left = Math.max(0, Math.min(total, countdown))
  const circumference = 2 * Math.PI * 44
  const done = (total - left) / total
  return (
    <span aria-hidden="true" className={'jl-ring' + (variant === 'card' ? '' : ' jl-ring-' + variant)}>
      <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ display: 'block', transform: 'rotate(-90deg)' }}>
        <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(0,255,65,.2)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke="#00ff41"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - done)}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset .35s linear' }}
        />
      </svg>
      <span>{left}</span>
    </span>
  )
}

'''
src = src[:start] + RING + src[end:]

# ---- 3. usages ----
for old, new in (
    ("{countdown > 0 ? <CountdownRing countdown={countdown} size={30} /> : null}",
     "{countdown > 0 ? <CountdownRing countdown={countdown} variant=\"tab\" /> : null}"),
    ("{countdown > 0 ? <CountdownRing countdown={countdown} size={20} /> : null}",
     "{countdown > 0 ? <CountdownRing countdown={countdown} variant=\"chip\" /> : null}"),
):
    if old not in src:
        sys.exit("FAIL: usage anchor " + old)
    src = src.replace(old, new, 1)

# card: ring alone, no repeated caption (codex review)
CARD_OLD = """          {countdown > 0 ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}>
              <CountdownRing countdown={countdown} size={34} />
              <span style={{ color: '#00ff41', fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                applies in {countdown}s
              </span>
            </span>
          ) : null}"""
CARD_NEW = """          {countdown > 0 ? <CountdownRing countdown={countdown} /> : null}"""
if CARD_OLD not in src:
    sys.exit("FAIL: card usage anchor")
src = src.replace(CARD_OLD, CARD_NEW, 1)

io.open(P, "w", encoding="utf-8").write(src)
print("PATCHED ring per codex review")
