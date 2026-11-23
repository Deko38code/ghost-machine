#!/usr/bin/env python3
"""PhantomIDE admin: 'active since' session card on the Profit pane.

Owner (2026-11-21): "if any admin are live make card say active since with
counter til logged out or signed out". The start time is derived from the
session token's fixed expiry (expires - SESSION_TTL); sign-out rotates the token
and the next refresh finds no session, so the counter stops.
Read-only: nothing here changes a session, a plan, a route or a provider.
"""
import io, sys, datetime

SERVER = "/home/ghost694/phantom-server.js"
HTML = "/home/ghost694/phantom-ide.html"
STAMP = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")

# -- server: report session facts with the profit payload -------------------
S_OLD = """    const data = await computeProfitWatch();
    res.set('Cache-Control', 'private, no-store');
    res.json(data);"""
S_NEW = """    const data = await computeProfitWatch();
    // Admin session facts for the "active since" card. Session tokens carry a
    // fixed TTL, so the issue time is expiry minus that TTL - a recorded value,
    // never an estimate. Sign-out removes the token; the next refresh then has
    // no session and the page stops its counter instead of inventing an end.
    const _sessEntry = token ? _sessions.get(token) : null;
    data.session = {
      email: String(email).toLowerCase(),
      issuedAt: _sessEntry && _sessEntry.expires ? new Date(_sessEntry.expires - SESSION_TTL * 1000).toISOString() : null,
      expiresAt: _sessEntry && _sessEntry.expires ? new Date(_sessEntry.expires).toISOString() : null,
    };
    res.set('Cache-Control', 'private, no-store');
    res.json(data);"""

# -- page: a slot for the card ----------------------------------------------
H_OLD = "'<div data-profit-status role=\"status\" aria-live=\"polite\" style=\"margin-bottom:10px;color:#9ba99f;font-size:.62rem;\">Loading live profit&#8230;</div>',"
H_NEW = H_OLD + "\n    '<div data-profit-session style=\"margin-bottom:10px;\"></div>',"

# -- page: render the card ---------------------------------------------------
R_OLD = "  const history=Array.isArray(data.history)?data.history.slice(-14):[];"
R_NEW = """  const sessionSlot=pane.querySelector('[data-profit-session]');
  if(sessionSlot){
    const s=data.session||{};
    const utcLabel=ms=>new Date(ms).toISOString().replace('T',' ').slice(0,16)+' UTC';
    const elapsed=ms=>{const t=Math.max(0,Math.floor(ms/1000));const h=Math.floor(t/3600),m=Math.floor((t%3600)/60),sec=t%60;return h+'h '+String(m).padStart(2,'0')+'m '+String(sec).padStart(2,'0')+'s';};
    if(window.__phantomProfitClock){clearInterval(window.__phantomProfitClock);window.__phantomProfitClock=null;}
    if(s.issuedAt){
      const start=new Date(s.issuedAt).getTime();
      sessionSlot.innerHTML='<div style="display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px;padding:10px;border:1px solid #2d6443;border-radius:9px;background:#080d0a;">'
        +'<div style="font:700 9.5px/1 ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;color:#84958a;">Admin session</div>'
        +'<span style="padding:2px 7px;border:1px solid #166534;border-radius:999px;background:#052e16;color:#4ade80;font:700 9.5px/1.4 ui-monospace,monospace;">LIVE</span>'
        +'<div style="font:700 13px/1.3 ui-monospace,monospace;color:#eafff0;">Active since '+utcLabel(start)+'</div>'
        +'<div id="phantom-profit-session-clock" style="font:800 20px/1.2 ui-monospace,monospace;color:#4ade80;font-variant-numeric:tabular-nums;">'+elapsed(Date.now()-start)+'</div>'
        +'<div style="font-size:.58rem;color:#9ba99f;overflow-wrap:anywhere;">'+(s.email||'owner account')+' &middot; counter runs until sign-out</div>'
        +'</div>';
      const tick=()=>{const el=document.getElementById('phantom-profit-session-clock');if(!el){clearInterval(window.__phantomProfitClock);window.__phantomProfitClock=null;return;}el.textContent=elapsed(Date.now()-start);};
      tick();window.__phantomProfitClock=setInterval(tick,1000);
    }else{
      sessionSlot.innerHTML='<div style="padding:10px;border:1px solid #20382a;border-radius:9px;background:#080d0a;font-size:.6rem;color:#84958a;line-height:1.5;">'
        +'<strong style="color:#9af0b4;letter-spacing:.08em;">ADMIN SESSION</strong><br>This server does not report a session start yet, so no counter is shown rather than an invented one. It appears after the next PhantomIDE restart.'
        +'</div>';
    }
  }
  const history=Array.isArray(data.history)?data.history.slice(-14):[];"""


def patch(path, pairs):
    text = io.open(path, encoding="utf-8").read()
    for old, new, label in pairs:
        n = text.count(old)
        if n != 1:
            print("ABORT: %s anchor found %d times in %s" % (label, n, path))
            sys.exit(1)
        text = text.replace(old, new)
    backup = path + ".bak-sessioncard-" + STAMP
    io.open(backup, "w", encoding="utf-8").write(io.open(path, encoding="utf-8").read())
    io.open(path, "w", encoding="utf-8").write(text)
    print("PATCHED", path, "backup", backup)


if __name__ == "__main__":
    patch(SERVER, [(S_OLD, S_NEW, "profit-watch session facts")])
    patch(HTML, [(H_OLD, H_NEW, "session slot"), (R_OLD, R_NEW, "session render")])
