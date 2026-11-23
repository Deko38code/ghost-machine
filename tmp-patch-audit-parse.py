#!/usr/bin/env python3
import io, sys

# ── 1. tolerate raw newlines inside the model's JSON ─────────────────────────
P = "/home/ghost694/junkalot/src/lib/security-audit.ts"
src = io.open(P, encoding="utf-8").read()

OLD = """      try {
        const jsonMatch = content.match(/\\{[\\s\\S]*\\}/)
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0])
          if (result && typeof result === 'object' && !Array.isArray(result)) {
            return shapeAudit({ ...result, provider: provider.name }, stats)
          }
        }
      } catch { /* not valid JSON, return as-is */ }"""

NEW = """      try {
        const jsonMatch = content.match(/\\{[\\s\\S]*\\}/)
        if (jsonMatch) {
          // 2026-11-20: small models answer with a literal newline inside a JSON
          // string, which strict JSON.parse rejects — the whole report then landed
          // in `summary` as raw text with zero findings (reports #79/#80). Newlines
          // outside strings are insignificant in JSON, so the second attempt only
          // flattens them and keeps the real findings.
          let result: any = null
          try {
            result = JSON.parse(jsonMatch[0])
          } catch {
            try { result = JSON.parse(jsonMatch[0].replace(/[\\n\\r\\t]+/g, ' ')) } catch { result = null }
          }
          if (result && typeof result === 'object' && !Array.isArray(result)) {
            return shapeAudit({ ...result, provider: provider.name }, stats)
          }
        }
      } catch { /* not valid JSON, return as-is */ }"""
if OLD not in src:
    sys.exit("FAIL anchor: json parse")
io.open(P, "w", encoding="utf-8").write(src.replace(OLD, NEW, 1))
print("PATCHED audit json parse")

# ── 2. an unparsed body is not "no findings" ────────────────────────────────
A = "/home/ghost694/junkalot/src/lib/auto-heal.ts"
src = io.open(A, encoding="utf-8").read()
OLD2 = """        } else if (findings !== null && findings.length === 0) {
          evidence = 'The audit recorded no findings'"""
NEW2 = """        } else if (findings !== null && findings.length === 0 && !String(report.summary || '').trim().startsWith('{')) {
          // A summary that is still raw JSON means the body never parsed, so an
          // empty findings list says nothing about the risk — never close on that.
          evidence = 'The audit recorded no findings'"""
if OLD2 not in src:
    sys.exit("FAIL anchor: no-findings rule")
io.open(A, "w", encoding="utf-8").write(src.replace(OLD2, NEW2, 1))
print("PATCHED resolver no-findings guard")
