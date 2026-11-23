const Database = require('better-sqlite3');
const db = new Database('/home/ghost694/junkalot/data/security.db', { readonly: true, fileMustExist: true });
const rows = db.prepare("SELECT id, created_at, report_type, severity, resolved, risk_score, summary, details FROM audit_reports ORDER BY id DESC").all();
for (const r of rows) {
  let findings = null;
  try { findings = JSON.parse(r.details || '[]'); } catch { findings = 'unparsed'; }
  const n = Array.isArray(findings) ? findings.length : 'n/a';
  console.log(`#${r.id} ${r.created_at} ${r.report_type} sev=${r.severity} resolved=${r.resolved} risk=${r.risk_score} findings=${n} :: ${String(r.summary).slice(0, 110)}`);
}
const w = db.prepare("SELECT COUNT(*) c FROM security_events WHERE created_at > datetime('now','-24 hours') AND severity IN ('critical','warning')").get();
console.log('critical+warning events last 24h:', JSON.stringify(w));
const c = db.prepare("SELECT severity, COUNT(*) c FROM security_events WHERE created_at > datetime('now','-24 hours') GROUP BY severity").all();
console.log('by severity 24h:', JSON.stringify(c));
