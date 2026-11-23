const Database = require('better-sqlite3');
const db = new Database('/home/ghost694/junkalot/data/security.db', { readonly: true, fileMustExist: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
console.log('tables:', tables.join(','));
const q = (label, sql) => {
  try { console.log('--- ' + label); console.log(JSON.stringify(db.prepare(sql).all())); }
  catch (e) { console.log('--- ' + label + ' ERR ' + e.message); }
};
q('auto_heal_log by action', "SELECT action, COUNT(*) AS c FROM auto_heal_log GROUP BY action ORDER BY c DESC");
q('auto_heal_log last 5', "SELECT id, created_at, action, details FROM auto_heal_log ORDER BY id DESC LIMIT 5");
q('auto_heal_log total', "SELECT COUNT(*) AS c FROM auto_heal_log");
q('blocked_ips', "SELECT COUNT(*) AS c FROM blocked_ips");
q('audit_reports by status', "SELECT status, COUNT(*) AS c FROM audit_reports GROUP BY status");
q('security_events by type', "SELECT event_type, COUNT(*) AS c FROM security_events GROUP BY event_type ORDER BY c DESC LIMIT 10");
