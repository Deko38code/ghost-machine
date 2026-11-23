#!/usr/bin/env python3
import io, sys

P = "/home/ghost694/junkalot/src/components/UpdateToast.tsx"
src = io.open(P, encoding="utf-8").read()

OLD = """              bytes: Number.isFinite(Number(data.update.bytes)) ? Number(data.update.bytes) : null,
            }
          : null,
      }"""
NEW = """              bytes: Number.isFinite(Number(data.update.bytes)) ? Number(data.update.bytes) : null,
            }
          : null,
        // 2026-11-20: fetchVersion rebuilds the answer field by field, so the
        // portfolio guard result has to be carried through explicitly or the
        // checklist always reports "no build has run the guard yet".
        portfolio: data.portfolio && (data.portfolio.status === 'ok' || data.portfolio.status === 'fail')
          ? {
              checkedAt: String(data.portfolio.checkedAt || ''),
              status: data.portfolio.status === 'ok' ? 'ok' as const : 'fail' as const,
              entries: Number(data.portfolio.entries) || 0,
              variantsExpected: Number(data.portfolio.variantsExpected) || 0,
              variantsPresent: Number(data.portfolio.variantsPresent) || 0,
              missing: Array.isArray(data.portfolio.missing) ? data.portfolio.missing.slice(0, 20).map(String) : [],
              unreadable: Array.isArray(data.portfolio.unreadable) ? data.portfolio.unreadable.slice(0, 20).map(String) : [],
              wrongWidth: Array.isArray(data.portfolio.wrongWidth) ? data.portfolio.wrongWidth.slice(0, 20).map(String) : [],
            }
          : null,
      }"""
if OLD not in src:
    sys.exit("FAIL anchor: return object")
src = src.replace(OLD, NEW, 1)

# keep the checklist live on every poll, not only at mount
OLD2 = """    latestBuild.current = info.build
    // Cleared every check, and set again only where a note applies.
    setBuildNote('')"""
NEW2 = """    latestBuild.current = info.build
    setPortfolio(info.portfolio ?? null)
    // Cleared every check, and set again only where a note applies.
    setBuildNote('')"""
if OLD2 not in src:
    sys.exit("FAIL anchor: poll assign")
src = src.replace(OLD2, NEW2, 1)

io.open(P, "w", encoding="utf-8").write(src)
print("PATCHED portfolio fetch passthrough")
