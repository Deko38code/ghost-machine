const Database = require('better-sqlite3');
const db = new Database('/home/ghost694/junkalot/data/security.db', { readonly: true, fileMustExist: true });
const q = (label, sql) => {
  try { console.log('--- ' + label); console.log(JSON.stringify(db.prepare(sql).all(), null, 0)); }
  catch (e) { console.log('--- ' + label + ' ERR ' + e.message); }
};
q('auto_heal_log columns', "SELECT name FROM pragma_table_info('auto_heal_log')");
q('audit_reports columns', "SELECT name FROM pragma_table_info('audit_reports')");
q('auto_heal_state', "SELECT * FROM auto_heal_state");
q('audit_reports recent', "SELECT id, created_at, report_type, severity FROM audit_reports ORDER BY id DESC LIMIT 5");
q('audit_reports total', "SELECT COUNT(*) AS c FROM audit_reports");
q('security_events recent', "SELECT id, created_at, event_type, severity, details FROM security_events ORDER BY id DESC LIMIT 5");
