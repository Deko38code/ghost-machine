#!/usr/bin/env python3
import io, sys, shutil

P = "/home/ghost694/junkalot/src/components/UpdateToast.tsx"
shutil.copyfile(P, P + ".bak-checklist-20261120")
src = io.open(P, encoding="utf-8").read()

def sub(old, new, label):
    global src
    if old not in src:
        sys.exit("FAIL anchor: " + label)
    src = src.replace(old, new, 1)

# 1. types
sub(
"""type VersionInfo = {
  build: string""",
"""// Owner (2026-11-20): the result of the portfolio image guard, written on this
// box at build time by scripts/portfolio-guard.mjs. Read, never recomputed here.
type PortfolioGuard = {
  checkedAt: string
  status: 'ok' | 'fail'
  entries: number
  variantsExpected: number
  variantsPresent: number
  missing?: string[]
  unreadable?: string[]
  wrongWidth?: string[]
}
type VersionInfo = {
  build: string""",
"portfolio type")

sub(
"""  update?: SharedUpdateState | null
}""",
"""  update?: SharedUpdateState | null
  portfolio?: PortfolioGuard | null
}""",
"versioninfo field")

# 2. state
sub(
"""  const [countdown, setCountdown] = useState(0)""",
"""  const [countdown, setCountdown] = useState(0)
  const [portfolio, setPortfolio] = useState<PortfolioGuard | null>(null)""",
"portfolio state")

# 3. keep it fresh from each poll
sub(
"""    latestBuild.current = info.build""",
"""    latestBuild.current = info.build
    setPortfolio(info.portfolio ?? null)""",
"poll assign")

# 4. checklist in the card, right under the detail line
OLD = """          <span id="junkalot-update-detail" style={{ color: '#9fe8b4', fontSize: 12, overflowWrap: 'anywhere' }}>"""
NEW = """          {/* Owner (2026-11-20): "add checklist to the update applet" — the
              portfolio guard's last real result, plus the two facts this applet
              measured for itself. Nothing is ticked that was not checked. */}
          <span style={{ display: 'block', fontSize: 11.5, lineHeight: 1.7 }} role="group" aria-label="Update checklist">
            {[
              {
                ok: Boolean(servedBuild),
                label: 'Build on disk',
                value: servedBuild ? servedBuild.slice(0, 12) : 'not reported yet',
              },
              { ok: true, label: 'Service answering', value: 'this check came back' },
              portfolio
                ? {
                    ok: portfolio.status === 'ok',
                    label: 'Portfolio images',
                    value: portfolio.status === 'ok'
                      ? portfolio.variantsPresent + '/' + portfolio.variantsExpected + ' present · ' + portfolio.entries + ' photos'
                      : (portfolio.variantsExpected - portfolio.variantsPresent) + ' of ' + portfolio.variantsExpected + ' missing or the wrong size',
                  }
                : { ok: false, label: 'Portfolio images', value: 'no build has run the guard yet' },
            ].map((row) => (
              <span key={row.label} style={{ display: 'block' }}>
                <span aria-hidden="true" style={{ color: row.ok ? '#00ff41' : '#ffb4b4', fontWeight: 800 }}>{row.ok ? '✓' : '✗'}</span>{' '}
                <span style={{ color: '#d7ffe4', fontWeight: 700 }}>{row.label}</span>{' '}
                <span style={{ color: row.ok ? '#9fe8b4' : '#ffb4b4', overflowWrap: 'anywhere' }}>— {row.value}</span>
              </span>
            ))}
            {portfolio?.checkedAt ? (
              <span style={{ display: 'block', color: '#64748b' }}>last checked {ago(portfolio.checkedAt)}</span>
            ) : null}
          </span>
          <span id="junkalot-update-detail" style={{ color: '#9fe8b4', fontSize: 12, overflowWrap: 'anywhere' }}>"""
sub(OLD, NEW, "checklist block")

io.open(P, "w", encoding="utf-8").write(src)
print("PATCHED checklist")
