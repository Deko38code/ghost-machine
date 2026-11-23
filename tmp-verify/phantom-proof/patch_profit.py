#!/usr/bin/env python3
"""PhantomIDE: owner-only live profit tab (wheels, grids, charts) + read bridge.

Owner 2026-11-21: "i want live profit wheels grids charts etc" and
"admin tab its hiddien to only me".

Adds to phantom-ide.html:
  * a Profit tab in the admin panel (owner session + PIN gated like the rest)
  * a pane that renders /api/admin/profit-watch: donut wheels, stat grid,
    snapshot bars, clients by margin, Junkalot coach + worklog
  * auto-refresh every 30 s while the pane is visible

Adds to phantom-server.js:
  * GET /api/internal/profit-bridge - the same profit payload for HaksterAI's
    admin, key-gated with the bridge key HaksterAI already reads over SSH.
    Read-only: computes and returns; never writes, never charges.
"""
import datetime
import io
import sys

SERVER = "/home/ghost694/phantom-server.js"
PAGE = "/home/ghost694/phantom-ide.html"
UI = "/tmp/profit-ui.js"
STAMP = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")

BRIDGE_ANCHOR = "  }catch(error){return res.status(503).json({ok:false,error:'Junkalot payoff source could not be reached'});}\n});\n"
BRIDGE = BRIDGE_ANCHOR + """
// --- INTERNAL PROFIT BRIDGE - HaksterAI admin reads PhantomIDE read-only -------
// Owner 2026-11-21: "haksterai.com admin to both live". HaksterAI's admin shows
// PhantomIDE's profit without a browser session: same bridge key it already reads
// over SSH for the payoff card, compared in constant time. Read-only accounting:
// it computes and returns; it never writes, never charges and never changes a plan.
app.get('/api/internal/profit-bridge', async (req, res) => {
  try {
    const provided = String(req.headers['x-junkalot-payoff-bridge'] || '');
    const key = String(fs.readFileSync(JUNKALOT_PAYOFF_BRIDGE_KEY_FILE, 'utf8')).trim();
    const a = Buffer.from(provided, 'utf8');
    const b = Buffer.from(key, 'utf8');
    if (a.length !== b.length || a.length < 48 || !require('crypto').timingSafeEqual(a, b)) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }
    const data = await computeProfitWatch();
    res.set('Cache-Control', 'private, no-store');
    return res.json({
      ok: true,
      site: 'phantomide',
      box: 'parrot',
      checkedAt: data.checkedAt,
      windowDays: data.windowDays,
      totals: data.totals,
      verdict: data.verdict,
      advice: data.advice,
      clients: data.clients,
      coach: data.coach,
      worklog: data.worklog,
      history: data.history,
    });
  } catch (error) {
    return res.status(503).json({ ok: false, error: 'Profit bridge unavailable' });
  }
});
"""

NAV_OLD = "['invoices','\U0001F9FE Invoice Dashboard']]"
NAV_NEW = "['invoices','\U0001F9FE Invoice Dashboard'],['profit','\U0001F4B0 Profit']]"

PANE_OLD = "  const apiPane=createAdminApiMonitorPane();"
PANE_NEW = "  const apiPane=createAdminApiMonitorPane();\n  const profitPane=createAdminProfitPane();"

APPEND_OLD = "  apiPane.dataset.adminTabContent='api';body.appendChild(apiPane);"
APPEND_NEW = "  apiPane.dataset.adminTabContent='api';body.appendChild(apiPane);\n  profitPane.dataset.adminTabContent='profit';body.appendChild(profitPane);"

HOOK_OLD = "  if(name==='api')loadPhantomApiMonitor();"
HOOK_NEW = "  if(name==='api')loadPhantomApiMonitor();\n  if(name==='profit')loadAdminProfit();"

FN_ANCHOR = "function installAdminVaultTab(modal){"


def patch(path, pairs):
    text = io.open(path, encoding="utf-8").read()
    for old, new, label in pairs:
        n = text.count(old)
        if n != 1:
            print("ABORT: %s anchor found %d times in %s" % (label, n, path))
            sys.exit(1)
        text = text.replace(old, new)
    backup = path + ".bak-profit-live-" + STAMP
    io.open(backup, "w", encoding="utf-8").write(io.open(path, encoding="utf-8").read())
    io.open(path, "w", encoding="utf-8").write(text)
    print("PATCHED", path)
    print("BACKUP ", backup)


ui = io.open(UI, encoding="utf-8").read()
if "loadAdminProfit" in ui and "createAdminProfitPane" in ui:
    pass
else:
    print("ABORT: UI file does not contain the expected functions")
    sys.exit(1)

patch(SERVER, [(BRIDGE_ANCHOR, BRIDGE, "junkalot-payoff route")])
patch(PAGE, [
    (NAV_OLD, NAV_NEW, "admin tab array"),
    (PANE_OLD, PANE_NEW, "api pane creation"),
    (APPEND_OLD, APPEND_NEW, "api pane append"),
    (HOOK_OLD, HOOK_NEW, "tab hook"),
    (FN_ANCHOR, ui + "\n" + FN_ANCHOR, "insert profit UI functions"),
])

for path, needles in ((SERVER, ["/api/internal/profit-bridge", "profit-bridge"]),
                      (PAGE, ["createAdminProfitPane", "admin-profit-pane", "loadAdminProfit()"])):
    text = io.open(path, encoding="utf-8").read()
    print("CHECK", path, {n: text.count(n) for n in needles})
