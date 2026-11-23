#!/usr/bin/env python3
import io, sys

P = "/home/ghost694/junkalot/src/components/UpdateToast.tsx"
src = io.open(P, encoding="utf-8").read()

if "CountdownRing" in src:
    sys.exit("SKIP: ring already present")

RING = '''
// 2026-11-20 (owner, "add the ring under my ghost with real sec to update fires
// open ... when queing"): the ring is drawn from the same measured countdown the
// copy prints, so the arc and the number always agree. It only exists while an
// update is actually queued (countdown > 0) — never a decorative animation.
function CountdownRing({ countdown, size }: { countdown: number; size: number }) {
  const total = Math.max(1, AUTO_SECS)
  const left = Math.max(0, Math.min(total, countdown))
  const stroke = size >= 34 ? 3 : 2
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const done = (total - left) / total
  return (
    <span
      aria-hidden="true"
      style={{ position: 'relative', width: size, height: size, display: 'inline-block', flex: 'none', lineHeight: 1 }}
    >
      <svg
        width={size}
        height={size}
        viewBox={'0 0 ' + size + ' ' + size}
        style={{ display: 'block', transform: 'rotate(-90deg)' }}
      >
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(0,255,65,.2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#00ff41"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - done)}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset .35s linear' }}
        />
      </svg>
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#00ff41',
          fontWeight: 800,
          fontSize: Math.max(9, Math.round(size * 0.42)),
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {left}
      </span>
    </span>
  )
}

export default function UpdateToast() {'''

ANCHOR_DEFAULT = "\nexport default function UpdateToast() {"
if ANCHOR_DEFAULT not in src:
    sys.exit("FAIL: component anchor")
src = src.replace(ANCHOR_DEFAULT, "\n" + RING, 1)

# --- tab mode: ring under the ghost (button is already a column stack) ---
TAB_OLD = '''          <span aria-hidden="true" className={deployWorking ? 'phantom-spin' : undefined} style={{ color: '#00ff41', fontSize: 11, display: 'inline-block' }}>👻</span>
          <span aria-hidden="true" style={{ color: '#64748b', fontSize: 10 }}>◂</span>'''
TAB_NEW = '''          <span aria-hidden="true" className={deployWorking ? 'phantom-spin' : undefined} style={{ color: '#00ff41', fontSize: 11, display: 'inline-block' }}>👻</span>
          {countdown > 0 ? <CountdownRing countdown={countdown} size={30} /> : null}
          <span aria-hidden="true" style={{ color: '#64748b', fontSize: 10 }}>◂</span>'''
if TAB_OLD not in src:
    sys.exit("FAIL: tab anchor")
src = src.replace(TAB_OLD, TAB_NEW, 1)

# --- chip mode: small ring beside the same ghost ---
CHIP_OLD = '''          <span aria-hidden="true" className={deployWorking ? 'phantom-spin' : undefined} style={{ color: '#00ff41', display: 'inline-block' }}>👻</span>
          <span style={{ fontWeight: 700, color: countdown > 0 ? '#00ff41' : '#d7ffe4' }}>'''
CHIP_NEW = '''          <span aria-hidden="true" className={deployWorking ? 'phantom-spin' : undefined} style={{ color: '#00ff41', display: 'inline-block' }}>👻</span>
          {countdown > 0 ? <CountdownRing countdown={countdown} size={20} /> : null}
          <span style={{ fontWeight: 700, color: countdown > 0 ? '#00ff41' : '#d7ffe4' }}>'''
if CHIP_OLD not in src:
    sys.exit("FAIL: chip anchor")
src = src.replace(CHIP_OLD, CHIP_NEW, 1)

# --- expanded card: ring directly under the PHANTOM IDE ghost header ---
CARD_OLD = '''            <span style={{ color: '#00cc33', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Update from PhantomIDE server
            </span>
          </span>'''
CARD_NEW = '''            <span style={{ color: '#00cc33', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Update from PhantomIDE server
            </span>
          </span>
          {countdown > 0 ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}>
              <CountdownRing countdown={countdown} size={34} />
              <span style={{ color: '#00ff41', fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                applies in {countdown}s
              </span>
            </span>
          ) : null}'''
if CARD_OLD not in src:
    sys.exit("FAIL: card anchor")
src = src.replace(CARD_OLD, CARD_NEW, 1)

io.open(P, "w", encoding="utf-8").write(src)
print("PATCHED UpdateToast ring")
