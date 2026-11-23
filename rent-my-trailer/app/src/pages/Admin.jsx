import { useEffect, useState } from "react";
import { api, getToken, user } from "../lib/api.js";

/* Admin panel — all bookings across the platform, with revenue stats and
   admin actions (cancel, mark paid). Additive page; only role==='admin' sees it. */
const chip = { padding: "3px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, display: "inline-block" };
const stateChip = (s) => {
  const paid = s === "paid" || s === "paid_full";
  const map = {
    paid: ["#d3f9e8", "#087f5b"], paid_full: ["#d3f9e8", "#087f5b"],
    pending: ["#fff3bf", "#e8590c"], failed: ["#ffe3e3", "#c92a2a"], cancelled: ["#e9ecef", "#868e96"],
  };
  const [bg, fg] = map[s] || ["#e9ecef", "#495057"];
  return <span style={{ ...chip, background: paid ? map.paid[0] : bg, color: paid ? map.paid[1] : fg }}>{s}</span>;
};

export default function Admin() {
  const [data, setData] = useState(null);
  const [users, setUsers] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("bookings");
  const [uidFilter, setUidFilter] = useState(null);
  const [filter, setFilter] = useState("all");
  const [logs, setLogs] = useState({});
  const [msg, setMsg] = useState({});

  const load = () => api("GET", "/api/admin/bookings").then((r) => setData(r)).catch((e) => setErr(e.message));
  useEffect(() => { if (getToken() && ["admin", "owner"].includes(user()?.role)) { load(); if (user()?.role === "admin") loadUsers(""); } }, []);
  const loadUsers = (userQ) => api("GET", `/api/admin/users${userQ ? `?q=${encodeURIComponent(userQ)}` : ""}`).then((r) => setUsers(r.rows)).catch(() => setUsers([]));

  const act = async (code, kind) => {
    try {
      if (kind === "cancel") { await api("POST", `/api/admin/bookings/${code}/cancel`, {}); setMsg((m) => ({ ...m, [code]: "✓ cancelled by admin" })); }
      if (kind === "pay") { await api("POST", `/api/bookings/${code}/pay`, { method: "in-person" }); setMsg((m) => ({ ...m, [code]: "✓ marked paid" })); }
      if (kind === "logs") { const r = await api("GET", `/api/bookings/${code}/logs`); setLogs((m) => ({ ...m, [code]: r.rows })); return; }
      load();
    } catch (e) { setMsg((m) => ({ ...m, [code]: "✗ " + e.message })); }
  };

  if (!getToken()) return <div className="page"><h1 className="sec-title">Admin</h1><p className="sec-sub">Log in with an admin account.</p></div>;
  if (!["admin", "owner"].includes(user()?.role)) return <div className="page"><h1 className="sec-title">Admin</h1><p className="sec-sub">Admins only.</p></div>;
  if (err) return <div className="page"><h1 className="sec-title">Admin</h1><p className="coupon-no">{err}</p></div>;
  if (!data) return <div className="page"><h1 className="sec-title">Admin</h1><p className="sec-sub">Loading bookings…</p></div>;

  const rows = (data.rows || []).filter((b) => {
    if (uidFilter !== null && Number(b.user_id) !== uidFilter && Number(b.owner_id) !== uidFilter) return false;
    if (filter !== "all" && b.payment_state !== filter) return false;
    if (!q) return true;
    const s = `${b.id} ${b.code} ${b.trailer_id} ${b.title} ${b.user_id || ""} ${b.user_email || ""} ${b.owner_id || ""} ${b.owner_email || ""}`.toLowerCase();
    return s.includes(q.toLowerCase());
  });
  const dollars = (c) => `$${(Number(c || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  const statBox = (label, val) => (
    <div style={{ background: "var(--asphalt)", border: "1px solid var(--line)", borderRadius: 10, padding: "12px 16px", minWidth: 130 }}>
      <div style={{ color: "var(--muted)", fontSize: 11, letterSpacing: ".08em", fontWeight: 700 }}>{label}</div>
      <div style={{ color: "var(--amber)", fontSize: 22, fontWeight: 800 }}>{val}</div>
    </div>
  );

  return (
    <div className="page deposit">
      <h1 className="sec-title">Admin — registry</h1>
      <p className="sec-sub">Every booking id, user id, and the trail between them — searchable, cross-linked, exportable.</p>
      <SecurityScore />
      <BootChecklist />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        {statBox("TOTAL", data.stats.total)}
        {statBox("PAID", data.stats.paid)}
        {statBox("PENDING", data.stats.pending)}
        <small style={{ color: "var(--muted)", fontSize: 12, alignSelf: "center" }}>revenue view — rent + deposit per booking, money settles to the platform ledger</small>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {["bookings", "users", "messages", "security", "campaigns", "migrations", "ad agent"].map((t) => (
            <button key={t} className="ai-go" onClick={() => setTab(t)} style={{ padding: "6px 16px", fontSize: 12, textTransform: "uppercase", ...(tab === t ? {} : { background: "var(--asphalt)", color: "var(--fg, #eee)", border: "1px solid var(--line)" }) }}>{t}</button>
          ))}
        </div>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <a href="/api/admin/export/bookings.csv" style={{ textDecoration: "none" }}><button className="ai-go" style={{ padding: "6px 12px", fontSize: 11, background: "var(--asphalt)", color: "var(--fg, #eee)", border: "1px solid var(--line)" }}>⬇ bookings.csv</button></a>
          <a href="/api/admin/export/users.csv" style={{ textDecoration: "none" }}><button className="ai-go" style={{ padding: "6px 12px", fontSize: 11, background: "var(--asphalt)", color: "var(--fg, #eee)", border: "1px solid var(--line)" }}>⬇ users.csv</button></a>
        </span>
      </div>
      {uidFilter !== null && (
        <p style={{ fontSize: 12, marginBottom: 10 }}>Showing bookings for user #{uidFilter} · <a href="#/" onClick={(e) => { e.preventDefault(); setUidFilter(null); setQ(""); }} style={{ color: "var(--amber)" }}>clear</a></p>
      )}
      <input placeholder="Search booking id, code, user id, email, trailer…" value={q} onChange={(e) => { setQ(e.target.value); if (tab === "users") loadUsers(e.target.value); }} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--asphalt)", color: "var(--fg, #eee)", marginBottom: 14 }} />
      {tab === "bookings" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
          <span style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>PAYMENT STATE</span>
          {["all", "pending", "paid", "cancelled"].map((f) => (
            <button key={f} className="ai-go" onClick={() => setFilter(f)} style={{ padding: "5px 12px", fontSize: 11, ...(filter === f ? {} : { background: "var(--asphalt)", color: "var(--fg, #eee)", border: "1px solid var(--line)" }) }}>{f}</button>
          ))}
        </div>
      )}

      {tab === "security" ? <SecurityTab /> : tab === "messages" ? <AdminMessages /> : tab === "campaigns" ? <CampaignManager /> : tab === "migrations" ? <MigrationQueue /> : tab === "ad agent" ? <AdAgentChat /> : tab === "users" && user()?.role === "admin" ? <UsersReg users={users} pick={(u) => { setUidFilter(u.id); setTab("bookings"); setQ(String(u.id)); }} /> : (rows || []).map((b) => (
        <div key={b.code} className="dphoto" style={{ marginBottom: 12 }}>
          <div className="dphoto-head">
            <h3>#{b.id} · {b.code} — {b.title}</h3>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {stateChip(b.payment_state)}
              {b.pay_method && <small style={{ color: "var(--muted)", fontWeight: 400 }}>{b.pay_method}</small>}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 2 }}>
            <div>{dollars(b.total)} rent{b.deposit ? " + " + dollars(b.deposit) + " deposit" : ""}</div>
            <div><b style={{ color: "var(--fg, #eee)" }}>user #{b.user_id} · {b.user_email}</b> → owner #{b.owner_id || "—"} · <b style={{ color: "var(--fg, #eee)" }}>{b.owner_email || "—"}</b></div>
            <div>{b.deposit_state || "—"}{b.checkin_at ? " · checked in ✓" : b.checkout_at ? " · trailer out (renter has it)" : ""}</div>
            <div style={{ opacity: 0.6 }}>{(b.created_on || "").replace("T", " ")}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button className="ai-go" onClick={() => act(b.code, "logs")} style={{ padding: "6px 10px", fontSize: 11, background: "var(--asphalt)", color: "var(--fg, #eee)", border: "1px solid var(--line)" }}>Activity log</button>
            {b.payment_state !== "paid" && b.payment_state !== "paid_full" && (
              <button className="ai-go" onClick={() => act(b.code, "pay")} style={{ padding: "6px 10px", fontSize: 11 }}>Mark paid</button>
            )}
            {b.payment_state !== "cancelled" && <button className="ai-go" onClick={() => act(b.code, "cancel")} style={{ padding: "6px 10px", fontSize: 11, background: "#c92a2a" }}>Cancel booking</button>}
          </div>
          {msg[b.code] && <p style={{ fontSize: 12, color: "var(--amber)" }}>{msg[b.code]}</p>}
          {logs[b.code] && (
            <pre className="receiptbody">{logs[b.code].map((l) => `${l.logged_on}  ${l.event}${l.detail ? " — " + l.detail : ""}${l.actor ? " (" + l.actor + ")" : ""}`).join("\n")}</pre>
          )}
        </div>
      ))}
      <DmPanel />
      <AdStudio />
      <UsersAdmin />
      <SmsAdminPanel />
    </div>
  );
}
/* startup initialization checklist — run on admin load + manual refresh */
function BootChecklist() {
  const [st, setSt] = useState(null);
  const [err, setErr] = useState("");
  const load = () => api("GET", "/api/admin/bootcheck").then(setSt).catch((e) => setErr("✗ " + e.message));
  useEffect(() => { load(); }, []);
  const badge = (okv) => (
    <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: okv === true ? "#d3f9e8" : "#ffe3e3", color: okv === true ? "#087f5b" : "#c92a2a", minWidth: 34, textAlign: "center" }}>
      {okv === true ? "✓ OK" : "✗ FIX"}
    </span>
  );
  return (
    <div className="dphoto" style={{ marginBottom: 18, padding: "12px 16px" }}>
      <div className="dphoto-head">
        <h3>🚦 Startup initialization checklist</h3>
        <span>
          {st === null ? "checking…" : st.all_ok ? "ALL SYSTEMS GO ✓" : `${st.checks.filter((c0) => !c0.ok).length} item(s) need attention`}
          {" · "}
          <a href="#/" onClick={(e) => { e.preventDefault(); load(); }} style={{ color: "var(--amber)" }}>re-run</a>
        </span>
      </div>
      {err && <p className="coupon-no">{err}</p>}
      {st && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 6 }}>
          {st.checks.map((c0, i0) => (
            <div key={i0} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--asphalt)", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
              {badge(c0.ok)}
              <b style={{ color: "#f2f6fa" }}>{c0.name}</b>
              <small style={{ color: "var(--muted)", flex: 1, textAlign: "right" }}>{c0.note}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/* outbound test-send + delivery log — Telegram (free) first, SMS (Zavu/textbee) fallback */
function SmsAdminPanel() {
  const [channel, setChannel] = useState("telegram");
  const [to, setTo] = useState("");
  const [text, setText] = useState("Test from Rent My Trailer — alert pipeline is live.");
  const [result, setResult] = useState(null);
  const [log, setLog] = useState(null);
  const [logMeta, setLogMeta] = useState(null);
  const loadLog = () => api("GET", "/api/admin/sms-log").then((r) => { setLog(r.rows || []); setLogMeta({ telegram: !!r.telegram, sms: !!r.sms }); }).catch(() => setLog([]));
  useEffect(() => { loadLog(); }, []);
  const send = async () => {
    setResult("sending…");
    try {
      const r = await api("POST", "/api/admin/sms-test", { to, text, channel });
      setResult("✓ sent via " + (r.provider || channel));
      loadLog();
    } catch (e) { setResult("✗ " + e.message); }
  };
  const inputStyle = { padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--asphalt)", color: "var(--fg, #eee)" };
  const chip = (c0, label) => (
    <button key={c0} onClick={() => setChannel(c0)} style={{ ...inputStyle, width: 96, cursor: "pointer", fontWeight: 700, borderColor: channel === c0 ? "var(--amber)" : "var(--line)", color: channel === c0 ? "var(--amber)" : "var(--muted)" }}>{label}</button>
  );
  return (
    <div className="dphoto" style={{ marginTop: 24 }}>
      <div className="dphoto-head"><h3>Notifications — Telegram push first, SMS fallback</h3>
        <span>{logMeta === null ? "…" : [logMeta.telegram && "telegram ✓", logMeta.sms && "sms ✓"].filter(Boolean).join(" · ") || "no channel configured"}</span></div>
      <p style={{ fontSize: 12, color: "var(--muted)" }}>
        Users link Telegram in Settings (free, unlimited) — alerts use it first, then verified-phone SMS.
        Test with a Telegram chat id (e.g. 7131543047) or a phone number.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6, alignItems: "center" }}>
        {chip("telegram", "Telegram")}
        {chip("sms", "SMS")}
        <input placeholder={channel === "telegram" ? "chat id e.g. 7131543047" : "+15551234567"} value={to} onChange={(e) => setTo(e.target.value)} style={{ ...inputStyle, width: 200 }} />
        <input placeholder="Message" value={text} onChange={(e) => setText(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 220 }} />
        <button className="ai-go" style={{ padding: "8px 14px", fontSize: 12 }} onClick={send}>Send test</button>
      </div>
      {result && <p style={{ fontSize: 12, color: "var(--amber)", marginTop: 6 }}>{result}</p>}
      {log && log.length > 0 && (
        <pre className="receiptbody" style={{ marginTop: 10, maxHeight: 220, overflow: "auto" }}>
{log.map((s) => `${s.at}  ${s.state}  ${s.to_}  ${String(s.text).slice(0, 60)}`).join("\n")}
        </pre>
      )}
    </div>
  );
}

/* users — KYC decide + force-logout kick + traffic stats */
function UsersAdmin() {
  const [uid, setUid] = useState("");
  const [visits, setVisits] = useState(null);
  const [result, setResult] = useState(null);
  const loadVisits = () => api("GET", "/api/admin/visits").then((r) => setVisits(r)).catch(() => {});
  useEffect(() => { loadVisits(); }, []);
  const run = async (url, body) => {
    setResult("…");
    try {
      const r = await api("POST", url, body);
      setResult(url === "/api/admin/kick" ? (r.ok ? "✓ kicked user #" + r.kicked : "✗ not sent") : (r.ok ? "✓ kyc " + r.state : "✗ not applied"));
    } catch (e) { setResult("✗ " + e.message); }
  };
  return (
    <div className="dphoto" style={{ marginTop: 24 }}>
      <div className="dphoto-head"><h3>Users — KYC & sessions</h3>
        <span>{visits ? `${visits.total} visits · ${visits.uniques} uniques · top: ${(visits.byRef || []).slice(0, 3).map((v) => v.ref).join(", ")}` : "…"}</span></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="user id" value={uid} onChange={(e) => setUid(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--asphalt)", color: "var(--fg, #eee)", width: 90 }} />
        <button className="ai-go" style={{ padding: "8px 14px", fontSize: 12 }} onClick={() => run("/api/kyc/decide", { user_id: Number(uid) })}>Verify KYC</button>
        <button className="ai-go" style={{ padding: "8px 14px", fontSize: 12, background: "var(--asphalt)", color: "var(--fg, #eee)", border: "1px solid var(--line)" }} onClick={() => run("/api/kyc/decide", { user_id: Number(uid), decide: "reject" })}>Reject</button>
        <button className="ai-go" style={{ padding: "8px 14px", fontSize: 12, background: "#c92a2a" }} onClick={() => run("/api/admin/kick", { user_id: Number(uid) })}>Force logout (kick)</button>
      </div>
      {visits?.daily?.length > 0 && (
        <pre className="receiptbody" style={{ marginTop: 10 }}>
{visits.daily.map((d) => `${d.d}  ${"▮".repeat(Math.min(24, d.n))} ${d.n}`).join("\n")}
        </pre>
      )}
      {result && <p style={{ fontSize: 12, color: "var(--amber)", marginTop: 6, whiteSpace: "pre-wrap" }}>{result}</p>}
    </div>
  );
}
/* live security score — /api/admin/security-score (0-100, deterministic from server signals) */
function SecurityScore() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const load = () => api("GET", "/api/admin/security-score").then(setD).catch((e) => setErr("✗ " + e.message));
  useEffect(() => { load(); }, []);
  const col = (sc) => (sc >= 90 ? "#087f5b" : sc >= 75 ? "#2b8a3e" : sc >= 60 ? "#e8590c" : "#c92a2a");
  return (
    <div className="dphoto" style={{ marginBottom: 18, padding: "12px 16px" }}>
      <div className="dphoto-head">
        <h3>🛡️ Security score</h3>
        <span>
          {d === null ? (err ? err : "scoring…") : (
            <>
              <b style={{ color: col(d.score), fontSize: 18, marginRight: 8 }}>{d.score}/100 — {d.grade}</b>
              <a href="#/" onClick={(e) => { e.preventDefault(); load(); }} style={{ color: "var(--amber)" }}>re-run</a>
            </>
          )}
        </span>
      </div>
      {d && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 6, marginTop: 8 }}>
          {d.checks.map((c) => (
            <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--asphalt)", border: `1px solid ${c.ok ? "#2f3a46" : "#c92a2a"}`, borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
              <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: c.ok ? "#d3f9e8" : "#ffe3e3", color: c.ok ? "#087f5b" : "#c92a2a" }}>
                +{c.pts}
              </span>
              <b style={{ color: "#f2f6fa" }}>{c.name}</b>
              <small style={{ color: "var(--muted)", flex: 1, textAlign: "right" }}>{c.note || (c.ok ? "ok" : "not ok")}</small>
            </div>
          ))}
          {d.failed_logins_24h?.length > 0 && (
            <pre className="receiptbody">failed logins (24h){d.failed_logins_24h.map((f) => `\n${f.at}  ${f.email}  ${f.ip}`).join("")}</pre>
          )}
        </div>
      )}
    </div>
  );
}

/* owner DM — direct messages into any user's inbox + broadcast to all */
function DmPanel() {
  const [users, setUsers] = useState(null);
  const [sel, setSel] = useState({});
  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [q, setQ] = useState("");
  const load = () => api("GET", "/api/admin/dm/users").then((r) => setUsers(r)).catch((e) => setResult("✗ " + e.message));
  useEffect(() => { load(); }, []);
  const send = async (broadcast) => {
    const ids = Object.keys(sel).filter((k) => sel[k]).map(Number);
    if (!text.trim() || (!broadcast && !ids.length)) { setResult("pick a user (or broadcast) and write the message"); return; }
    setResult("sending…");
    try {
      const body = broadcast ? { text, broadcast: true } : { text, user_ids: ids };
      const r = await api("POST", "/api/admin/dm", body);
      setResult(`✓ delivered to ${r.sent} inbox${r.sent === 1 ? "" : "es"}`);
      setText(""); setSel({});
    } catch (e) { setResult("✗ " + e.message); }
  };
  const rows = (users?.rows || []).filter((u) => !q || `${u.email} ${u.display_name}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="dphoto" style={{ marginTop: 24 }}>
      <div className="dphoto-head"><h3>✉️ Direct messages (team ↔ users)</h3>
        <span>{users ? `${(users.rows || []).length} users` : "…"}</span></div>
      <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Messages land in the user's Messages inbox (thread: 🚚 Rent My Trailer — Team). They reply straight to you.</p>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <input placeholder="Search users…" value={q} onChange={(e) => setQ(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--asphalt)", color: "var(--fg, #eee)", flex: 1, minWidth: 180 }} />
      </div>
      <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 8, marginTop: 8, background: "var(--asphalt)" }}>
        {(rows || []).map((u) => (
          <label key={u.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 12px", cursor: "pointer", fontSize: 12.5, color: "var(--fg, #eee)", borderBottom: "1px solid #1b1f26" }}>
            <input type="checkbox" checked={!!sel[u.id]} onChange={(e) => setSel((s0) => ({ ...s0, [u.id]: e.target.checked }))} disabled={u.id === users.me} />
            <b>{u.display_name}</b>
            <span style={{ color: "var(--muted)" }}>{u.email}</span>
            <small style={{ marginLeft: "auto", color: "var(--amber)" }}>{u.tier === "paid" ? "paid" : ""} {u.role}</small>
          </label>
        ))}
      </div>
      <textarea rows="3" value={text} onChange={(e) => setText(e.target.value)} placeholder="Message text…" style={{ width: "100%", marginTop: 10, background: "var(--asphalt)", border: "1px solid var(--line)", color: "var(--paper)", padding: 10, borderRadius: 10, fontFamily: "var(--mono)", fontSize: 13, boxSizing: "border-box" }} />
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button className="ai-go" style={{ padding: "8px 14px", fontSize: 12 }} onClick={() => send(false)}>Send to selected</button>
        <button className="ai-go" style={{ padding: "8px 14px", fontSize: 12, background: "var(--asphalt)", color: "var(--fg, #eee)", border: "1px solid var(--line)" }} onClick={() => send(true)}>📣 Broadcast to ALL users</button>
        <button className="ai-go" style={{ padding: "8px 14px", fontSize: 12, background: "var(--asphalt)", color: "var(--fg, #eee)", border: "1px solid var(--line)" }} onClick={load}>Reload</button>
      </div>
      {result && <p style={{ fontSize: 12, color: "var(--amber)", marginTop: 6 }}>{result}</p>}
    </div>
  );
}
/* ═══ Ad Studio — FB/IG organic post creator + posting autopilot ═══ */
/* ═══ Security tab — access log, IP intelligence, failed logins, live events ═══ */

/* ═══ Admin messages console — every thread on the platform, reply as admin or as any participant ═══ */
function AdminMessages() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState(null);
  const [th, setTh] = useState(null);
  const [text, setText] = useState("");
  const [asUser, setAsUser] = useState("");       // "" = admin voice
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const load = () => api("GET", `/api/admin/threads${q ? `?q=${encodeURIComponent(q)}` : ""}`).then((r) => setRows(r.rows)).catch((e) => setErr("✗ " + e.message));
  useEffect(() => { load(); }, [q]);
  const open = async (id) => {
    setOpenId(id); setTh(null); setNote(""); setAsUser(""); setText("");
    try {
      const r = await api("GET", `/api/admin/threads/${id}`);
      setTh(r);
    } catch (e) { setErr("✗ " + e.message); }
  };
  const send = async () => {
    if (!text.trim()) { setNote("write something first"); return; }
    setNote("sending…");
    try {
      const r = await api("POST", `/api/admin/threads/${openId}`, { text, as_user_id: asUser ? Number(asUser) : undefined });
      setNote(r.impersonated ? `sent as user #${r.as}` : "sent as Admin (team)");
      setText("");
      open(openId);
      load();
    } catch (e) { setNote("✗ " + e.message); }
  };
  const list = (rows || []).filter(Boolean);
  return (
    <div>
      {err && <p className="coupon-no">{err}</p>}
      <input placeholder="Search thread id, renter/owner email, trailer, text…" value={q} onChange={(e) => setQ(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--asphalt)", color: "var(--fg, #eee)", marginBottom: 14 }} />
      {rows === null && <p className="sec-sub">loading threads…</p>}
      {list.length === 0 && rows !== null && <div className="empty">No threads yet.</div>}
      {list.slice(0, 60).map((t) => (
        <div key={t.id} className="dphoto" style={{ marginBottom: 10 }}>
          <div className="dphoto-head">
            <h3>thread {t.id} — {t.title}</h3>
            <span><b style={{ color: "var(--amber)" }}>{t.msg_count}</b> msg · {t.clearance}</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.8 }}>
            <div>renter: <b style={{ color: "var(--fg, #eee)" }}>{t.renter_email}</b> (#{t.renter_id}) → owner: <b style={{ color: "var(--fg, #eee)" }}>{t.owner_email || "—"}</b>{t.owner_id ? ` (#${t.owner_id})` : ""}</div>
            {t.last_text && <div style={{ opacity: 0.75 }}>“{t.last_text.slice(0, 140)}”</div>}
            <div style={{ opacity: 0.6 }}>{(t.last_at || "").replace("T", " ")}</div>
          </div>
          <div style={{ marginTop: 8 }}><button className="ai-go" onClick={() => open(t.id)} style={{ padding: "6px 14px", fontSize: 11 }}>{openId === t.id ? "Hide" : "Open thread"}</button></div>
          {openId === t.id && (
            <div style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
              {(th === null || th?.thread?.id !== t.id) && <p className="sec-sub">loading messages…</p>}
              {Array.isArray(th?.rows) && th.thread.id === t.id && (
                <>
                  <pre className="receiptbody" style={{ maxHeight: 240, overflow: "auto" }}>{th.rows.map((m) => `${m.sent_on.replace("T", " ")}  #${m.user_id} ${(m.email || "")}: ${m.text}`).join("\n")}</pre>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
                    <select value={asUser} onChange={(e) => setAsUser(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--asphalt)", color: "var(--fg, #eee)", fontSize: 12 }}>
                      <option value="">🚚 Send as Admin (team)</option>
                      <option value={th.thread.renter_id}>🎭 As renter — {th.thread.renter_id}</option>
                      {th.thread.owner_id && <option value={th.thread.owner_id}>🎭 As owner — {th.thread.owner_id}</option>}
                    </select>
                    <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Message… (Enter sends)" style={{ flex: 1, minWidth: 220, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--asphalt)", color: "var(--fg, #eee)" }} />
                    <button className="ai-go" onClick={send} style={{ padding: "8px 16px", fontSize: 12 }}>Send</button>
                  </div>
                  {note && <small style={{ display: "block", marginTop: 4, color: "var(--amber)" }}>{note}</small>}
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
function SecurityTab() {
  const [rows, setRows] = useState(null);
  const [score, setScore] = useState(null);
  const [err, setErr] = useState("");
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const [ipView, setIpView] = useState(null);
  const [ipData, setIpData] = useState(null);
  const load = () => {
    api("GET", "/api/admin/access-log?limit=200").then((r) => setRows(r.rows)).catch((e) => setErr("✗ " + e.message));
    api("GET", "/api/admin/security-score").then(setScore).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  const viewIp = (ip) => {
    setIpView(ip); setIpData(null);
    api("GET", `/api/admin/access-log/ip/${encodeURIComponent(ip)}`).then(setIpData).catch(() => setIpData({ ip, rows: [], users: [] }));
  };
  const kick = async (uid) => {
    try { const r = await api("POST", "/api/admin/kick", { user_id: Number(uid) }); setErr(r.ok ? "✓ kicked user #" + r.kicked : "✗ not kicked"); }
    catch (e) { setErr("✗ " + e.message); }
  };
  const KINDS = ["all", "login", "signup", "booking", "booking-cancel", "password-reset", "ad-post", "aff-insurance"];
  const feed = (rows || []).filter((r) => (kind === "all" || r.kind === kind) && (!q || `${r.kind} ${r.email} ${r.ip} ${r.ua} ${r.detail} ${r.user_id || ""}`.toLowerCase().includes(q.toLowerCase())));
  const rowSt = { display: "flex", gap: 10, padding: "5px 10px", borderBottom: "1px solid #1b1f26", fontSize: 12, alignItems: "baseline" };
  return (
    <div>
      {err && <p className="coupon-no">{err}</p>}
      {ipView && (
        <div className="dphoto" style={{ marginBottom: 14, padding: "12px 16px" }}>
          <div className="dphoto-head">
            <h3>IP drilldown — {ipView}</h3>
            <a href="#/" onClick={(e) => { e.preventDefault(); setIpView(null); setIpData(null); }} style={{ color: "var(--amber)" }}>close ×</a>
          </div>
          {!ipData && <p className="sec-sub">loading…</p>}
          {ipData && (
            <>
              <div style={{ fontSize: 12.5, marginBottom: 8 }}>
                <b style={{ color: "var(--amber)" }}>{(ipData.rows || []).length}</b> events from this IP ·{" "}
                <b style={{ color: (ipData.users || []).length > 2 ? "#ff5c1a" : "var(--amber)" }}>{(ipData.users || []).length}</b> distinct account(s) tied to it
                {(ipData.users || []).length > 2 ? " — multi-account IP, worth reviewing" : ""}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                {(ipData.users || []).map((u0) => (
                  <span key={u0.user_id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--asphalt)", border: "1px solid var(--line)", borderRadius: 999, padding: "5px 10px", fontSize: 12 }}>
                    user #{u0.user_id} · {u0.email}
                    <button className="ai-go" onClick={() => kick(u0.user_id)} style={{ padding: "3px 8px", fontSize: 10, background: "#c92a2a" }}>kick</button>
                  </span>
                ))}
              </div>
              <pre className="receiptbody" style={{ maxHeight: 180, overflow: "auto" }}>{(ipData.rows || []).map((r) => `${r.created_on}  ${r.kind}  ${r.email || "—"}  ${r.detail || ""}`).join("\n")}</pre>
            </>
          )}
        </div>
      )}
      {score && score.failed_logins_24h?.length > 0 && (
        <div className="dphoto" style={{ marginBottom: 14, padding: "12px 16px" }}>
          <div className="dphoto-head"><h3>⚠️ Failed logins (24h)</h3><b style={{ color: "var(--amber)", fontSize: 18 }}>{score.failed_logins_24h.length}</b></div>
          <pre className="receiptbody" style={{ maxHeight: 160, overflow: "auto" }}>{score.failed_logins_24h.map((f) => `${f.at}  ${f.email}  ${f.ip}`).join("\n")}</pre>
        </div>
      )}
      {score && score.security_events_24h?.length > 0 && (
        <div className="dphoto" style={{ marginBottom: 14, padding: "12px 16px" }}>
          <div className="dphoto-head"><h3>🚨 Live security events (in-memory, since last restart)</h3><span>{score.security_events_24h.length} event(s)</span></div>
          <pre className="receiptbody" style={{ maxHeight: 160, overflow: "auto" }}>{score.security_events_24h.map((e) => `[${e.at}] ${e.kind} (w${e.weight}) — ${e.detail}`).join("\n")}</pre>
        </div>
      )}
      <div className="dphoto" style={{ padding: "12px 16px" }}>
        <div className="dphoto-head">
          <h3>Access log — every login, signup, booking, with IP + device</h3>
          <span>
            {rows ? `${feed.length}/${rows.length} shown` : "…"}
            {" · "}
            <a href="#/" onClick={(e) => { e.preventDefault(); load(); }} style={{ color: "var(--amber)" }}>refresh</a>
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "10px 0" }}>
          <input placeholder="Search email, IP, device, detail…" value={q} onChange={(e) => setQ(e.target.value)} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--asphalt)", color: "var(--fg, #eee)", flex: 1, minWidth: 200 }} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {KINDS.map((k) => (
              <button key={k} className="ai-go" onClick={() => setKind(k)} style={{ padding: "4px 10px", fontSize: 10.5, ...(kind === k ? { background: "#f5b325", color: "#16181b" } : { background: "var(--asphalt)", color: "var(--fg, #eee)", border: "1px solid var(--line)" }) }}>{k}</button>
            ))}
          </div>
        </div>
        {rows === null && <p className="sec-sub">loading access log…</p>}
        {rows?.length === 0 && <div className="empty">No access events recorded yet.</div>}
        {feed.length === 0 && rows?.length > 0 && <div className="empty">No rows match the filter.</div>}
        <div style={{ maxHeight: 460, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 8, background: "var(--asphalt)" }}>
          {feed.map((r, i) => (
            <div key={i} style={rowSt}>
              <span style={{ color: "var(--muted)", minWidth: 150 }}>{(r.created_on || "").replace("T", " ")}</span>
              <span style={{ padding: "1px 8px", borderRadius: 999, background: "var(--char2)", color: "var(--orange)", fontSize: 10.5, fontWeight: 700 }}>{r.kind}</span>
              <span style={{ minWidth: 190 }}>{r.email || "—"}</span>
              <a href="#/" onClick={(e) => { e.preventDefault(); viewIp(r.ip); }} style={{ color: "var(--amber)", minWidth: 130 }}>{r.ip || "—"}</a>
              <span style={{ color: "var(--muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.detail || r.ua || ""}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function AdStudio() {
  const [d, setD] = useState(null);
  const [count, setCount] = useState(2);
  const [every, setEvery] = useState(120);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const load = () => api("GET", "/api/admin/ads").then(setD).catch((e) => setNote("✗ " + e.message));
  useEffect(() => { load(); }, []);
  const run = async (fn) => { setBusy(true); try { await fn(); await load(); } catch (e) { setNote("✗ " + e.message); } setBusy(false); };
  const ch = (c) => c === "instagram" ? ["#1ce1e2", "#16181b"] : ["#4067a9", "#fff"];
  return (
    <div className="dphoto" style={{ marginTop: 24 }}>
      <div className="dphoto-head">
        <h3>📣 Ad Studio — Facebook + Instagram</h3>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ ...chip, background: d?.config?.fb ? "#d3f9e8" : "#ffe3e3", color: d?.config?.fb ? "#087f5b" : "#c92a2a" }}>FB {d?.config?.fb ? "✓" : "—"}</span>
          <span style={{ ...chip, background: d?.config?.ig ? "#d3f9e8" : "#ffe3e3", color: d?.config?.ig ? "#087f5b" : "#c92a2a" }}>IG {d?.config?.ig ? "✓" : "—"}</span>
        </span>
      </div>
      {d && !d.config.fb && (
        <p style={{ fontSize: 12, color: "var(--amber)" }}>
          Free setup: create a Facebook Page → developers.facebook.com app → generate a <b>long-lived Page access token</b> →
          add to <code>server/.env</code>: <code>RMT_FB_PAGE_ID=…</code> <code>RMT_FB_PAGE_TOKEN=…</code> (IG feed posts also need
          <code> RMT_IG_USER_ID=…</code> from a linked IG business account) → restart rmt-server.
        </p>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
        <button className="ai-go" disabled={busy} onClick={() => run(() => api("POST", "/api/admin/ads/generate", { count }))} style={{ padding: "8px 14px", fontSize: 12 }}>✨ Generate {count} drafts</button>
        <input type="number" min="1" max="8" value={count} onChange={(e) => setCount(Number(e.target.value))} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--asphalt)", color: "var(--fg, #eee)", width: 70 }} />
        <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
          Autopilot
          <input type="number" min="15" max="10080" value={every} onChange={(e) => setEvery(Number(e.target.value))} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--asphalt)", color: "var(--fg, #eee)", width: 82 }} />
          min
          <button className="ai-go" disabled={busy} onClick={() => run(() => api("POST", "/api/admin/ads/autopilot", { on: !(d?.autopilot?.on), every_min: every }))} style={{ padding: "8px 14px", fontSize: 12, background: d?.autopilot?.on ? "#d3f9e8" : undefined, color: d?.autopilot?.on ? "#087f5b" : undefined }}>
            {d?.autopilot?.on ? `ON — every ${d.autopilot.every_min}m` : "OFF"}
          </button>
        </span>
      </div>
      {d?.autopilot?.last_at && <small style={{ color: "var(--muted)", display: "block", marginTop: 4 }}>last autopilot tick: {d.autopilot.last_at.replace("T", " ")}</small>}
      {note && <p style={{ fontSize: 12, color: "var(--amber)", marginTop: 6 }}>{note}</p>}
      {(d?.rows || []).map((p) => (
        <div key={p.id} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid #1b1f26", alignItems: "flex-start" }}>
          {p.img && <img src={p.img} alt="" style={{ width: 54, height: 54, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} loading="lazy" />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ ...chip, background: ch(p.channel)[0], color: ch(p.channel)[1] }}>{p.channel === "instagram" ? "Instagram" : "Facebook"}</span>
              <small style={{ color: "var(--muted)" }}>#{p.id} · {p.created_on.replace("T", " ")}{p.autopilot ? " · auto" : ""}</small>
              {p.status === "posted" && <a href={p.post_url} target="_blank" rel="noreferrer" style={{ color: "#38d9a9", fontSize: 12 }}>view post ✓</a>}
              {p.status === "failed" && <small style={{ color: "#ff5c1a" }}>failed: {p.error}</small>}
            </div>
            {p.status !== "posted" ? (
              <textarea defaultValue={p.caption} id={"cap" + p.id} rows={3} style={{ width: "100%", marginTop: 6, background: "var(--asphalt)", color: "var(--fg, #eee)", border: "1px solid var(--line)", borderRadius: 8, padding: 8, fontSize: 12.5, resize: "vertical" }} />
            ) : (
              <p style={{ fontSize: 12.5, marginTop: 6, whiteSpace: "pre-wrap" }}>{p.caption}</p>
            )}
            {p.status !== "posted" && (
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button className="ai-go" disabled={busy} onClick={() => run(async () => { await api("POST", `/api/admin/ads/${p.id}/update`, { caption: document.getElementById("cap" + p.id).value }); if (d?.config[p.channel === "instagram" ? "ig" : "fb"]) return api("POST", `/api/admin/ads/${p.id}/post`, {}); setNote("Draft saved — channel not configured yet."); })} style={{ padding: "6px 12px", fontSize: 11 }}>
                  {d?.config?.[p.channel === "instagram" ? "ig" : "fb"] ? "🚀 Post now" : "💾 Save caption"}
                </button>
                <button className="ai-go" disabled={busy} onClick={() => run(() => api("POST", `/api/admin/ads/${p.id}/delete`, {}))} style={{ padding: "6px 12px", fontSize: 11, background: "var(--asphalt)", color: "var(--fg, #eee)", border: "1px solid var(--line)" }}>✕</button>
              </div>
            )}
          </div>
        </div>
      ))}
      {d?.rows?.length === 0 && <div className="empty">No drafts — hit Generate.</div>}
    </div>
  );
}

function CampaignManager() {
  const blank = { source: "owner", title: "", headline: "", support: "", image: "", href: "", cta: "LEARN MORE" };
  const [form, setForm] = useState(blank);
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const load = () => api("GET", "/api/admin/network-campaigns").then((r) => setRows(r.rows || [])).catch((e) => setNote("✗ " + e.message));
  useEffect(() => { load(); }, []);
  const create = async (e) => {
    e.preventDefault(); setBusy(true); setNote("");
    try { await api("POST", "/api/admin/network-campaigns", form); setForm(blank); setNote("Campaign added to the shared feed."); await load(); }
    catch (e2) { setNote("✗ " + e2.message); }
    finally { setBusy(false); }
  };
  const changeStatus = async (row) => {
    const status = row.status === "active" ? "paused" : "active";
    try { await api("PATCH", `/api/admin/network-campaigns/${row.id}`, { status }); await load(); }
    catch (e) { setNote("✗ " + e.message); }
  };
  const fieldStyle = { padding: "9px 11px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--asphalt)", color: "var(--fg, #eee)", minWidth: 0, flex: "1 1 220px" };
  return <section className="dphoto" style={{ marginTop: 16 }}>
    <div className="dphoto-head"><h3>🌐 Shared Campaign Manager</h3><small>One campaign feed · event-linked</small></div>
    <p className="sec-sub">Create or pause ads served by the Dell campaign feed. Active creatives are returned from <code>/api/network-ads/feed</code>.</p>
    <form onSubmit={create} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
      {[["source", "Product/source key"], ["title", "Campaign title"], ["headline", "Headline"], ["support", "Supporting copy"], ["image", "Public HTTPS image URL"], ["href", "Destination URL"], ["cta", "Button label"]].map(([key, placeholder]) => <input key={key} required={!["support", "cta"].includes(key)} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} style={fieldStyle} />)}
      <button className="ai-go" disabled={busy || !form.title.trim() || !form.headline.trim()} style={{ padding: "9px 18px" }}>{busy ? "Adding…" : "Add to shared feed"}</button>
    </form>
    {note && <p style={{ color: "var(--amber)", fontSize: 12 }}>{note}</p>}
    <details style={{ marginTop: 14, border: "1px solid var(--line)", borderRadius: 8, padding: 10, background: "var(--asphalt)" }}>
      <summary style={{ cursor: "pointer", fontWeight: 800, color: "var(--amber)" }}>Event hooks &amp; code locations</summary>
      <p className="sec-sub" style={{ margin: "8px 0" }}>Line references for the campaign pipeline. Changes are staged in source; restart-gated services are not active yet.</p>
      <div style={{ display: "grid", gap: 6, fontFamily: "ui-monospace,monospace", fontSize: 11 }}>
        {[
          ["Feed API", "rent-my-trailer/server/server.js:2242", "Combines existing PhantomIDE campaigns with Dell campaigns"],
          ["Feed widget", "rent-my-trailer/server/server.js:2264", "Responsive image creative and synchronized 8-second rotation"],
          ["Signed event intake", "rent-my-trailer/server/server.js:2276", "Deduplicates payment events using the shared secret"],
          ["RMT membership payment", "rent-my-trailer/server/server.js:1399", "Activates one RMT campaign after a verified payment relay"],
          ["HaksterAI Stripe event", "haksterAi/server/src/index.js:830", "Mirrors paid product events to the campaign registry"],
          ["PhantomIDE Stripe event", "phantom-server.js:13916", "Mirrors payment events to the ad registry; it does not migrate websites"],
        ].map(([name, loc, detail]) => <div key={name} style={{ display: "grid", gridTemplateColumns: "130px minmax(170px,1fr) minmax(180px,1.4fr)", gap: 8, borderBottom: "1px solid var(--line)", padding: "6px 0" }}><b>{name}</b><code>{loc}</code><span style={{ color: "var(--muted)" }}>{detail}</span></div>)}
      </div>
    </details>
    {rows === null && <p className="sec-sub">Loading campaigns…</p>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12, marginTop: 14 }}>
      <div><b style={{ fontSize: 12 }}>Live feed preview</b><iframe title="Shared campaign feed preview" src="/api/network-ads/widget" loading="eager" style={{ display: "block", width: "100%", height: 220, border: "1px solid var(--line)", borderRadius: 10, marginTop: 7 }} /></div>
      <div><b style={{ fontSize: 12 }}>Campaign terminal · feed JSON</b><pre style={{ height: 220, overflow: "auto", whiteSpace: "pre-wrap", background: "#080b12", color: "#b8c5d8", padding: 10, border: "1px solid var(--line)", borderRadius: 10, font: "11px/1.55 ui-monospace,monospace", marginTop: 7 }}>{(rows || []).slice(0, 16).map((r, i) => `${String(i + 1).padStart(2, "0")}  [${r.status.toUpperCase()}] ${r.source} · ${r.title}\n    ${r.headline}\n    ${r.href}`).join("\n") || "No campaign rows loaded."}</pre></div>
    </div>
    <div style={{ display: "grid", gap: 8, marginTop: 12 }}>{(rows || []).map((r) => <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 8, background: "var(--asphalt)", border: "1px solid var(--line)" }}>
      <img src={r.image} alt="" loading="eager" style={{ width: 70, height: 48, objectFit: "cover", borderRadius: 6 }} />
      <div style={{ minWidth: 0, flex: 1 }}><b>{r.title}</b><small style={{ display: "block", color: "var(--muted)", overflowWrap: "anywhere" }}>{r.headline} · {r.source} · {r.status}</small><small style={{ display: "block", color: "var(--muted)" }}>Impressions {Number(r.impressions || 0).toLocaleString()} · Clicks {Number(r.clicks || 0).toLocaleString()} · CTR {((Number(r.ctr) || 0) * 100).toFixed(2)}%</small></div>
      <button className="ai-go" onClick={() => changeStatus(r)} style={{ padding: "6px 10px" }}>{r.status === "active" ? "Pause" : "Activate"}</button>
    </div>)}</div>
  </section>;
}

function MigrationQueue() {
  const [rows, setRows] = useState(null);
  const [notes, setNotes] = useState({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(null);
  const load = () => api("GET", "/api/admin/migrations").then((r) => setRows(r.rows || [])).catch((e) => setMessage("✗ " + e.message));
  useEffect(() => { load(); }, []);
  const update = async (row, status) => {
    setBusy(row.id); setMessage("");
    try { await api("PATCH", `/api/admin/migrations/${row.id}`, { status, admin_note: notes[row.id] ?? row.admin_note ?? "" }); setMessage(`Migration #${row.id} updated.`); await load(); }
    catch (e) { setMessage("✗ " + e.message); }
    finally { setBusy(null); }
  };
  return <section className="dphoto" style={{ marginTop: 16 }}>
    <div className="dphoto-head"><h3>🌐 Website migration queue</h3><button className="ai-go" onClick={load} style={{ padding: "6px 10px", fontSize: 11 }}>Refresh</button></div>
    <p className="sec-sub">Review site migration requests and record follow-up. This queue does not copy payment credentials or switch DNS.</p>
    {message && <p style={{ color: "var(--amber)", fontSize: 12 }}>{message}</p>}
    {rows === null ? <p className="sec-sub">Loading requests…</p> : rows.length === 0 ? <p className="sec-sub">No website migration requests yet.</p> : <div style={{ display: "grid", gap: 10, marginTop: 10 }}>{rows.map((r) => <article key={r.id} style={{ border: "1px solid var(--line)", borderRadius: 9, padding: 12, background: "var(--asphalt)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between" }}><b>#{r.id} · {r.project_name} · {r.scan?.domain || r.source_url}</b><b style={{ color: "var(--amber)" }}>{r.status}</b></div>
      <small style={{ display: "block", color: "var(--muted)", margin: "4px 0 8px" }}>{r.display_name} · {r.email} · {r.business_type} · {r.scan?.signals?.pages || 0} pages · {r.scan?.signals?.images || 0} images · {r.created_on}</small>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 8 }}>{(r.scan?.pages || []).map((p) => <a key={p.url} href={p.url} target="_blank" rel="noreferrer" style={{ color: "var(--amber)", fontSize: 11 }}>{p.title || p.url}</a>)}</div>
      <textarea value={notes[r.id] ?? r.admin_note ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} rows={2} placeholder="Migration note for the customer…" style={{ ...{ width: "100%", background: "#11151b", color: "var(--paper)", border: "1px solid var(--line)", borderRadius: 7, padding: 8, boxSizing: "border-box" } }} />
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 8 }}>{[["in_review","Start review"],["building","Mark building"],["completed","Mark complete"],["declined","Needs follow-up"]].map(([status,label])=><button key={status} className="ai-go" disabled={busy === r.id} onClick={() => update(r,status)} style={{ padding: "6px 9px", fontSize: 10 }}>{label}</button>)}</div>
    </article>)}</div>}
  </section>;
}

function AdAgentChat() {
  const [messages, setMessages] = useState([{ role: "assistant", content: "I’m the campaign ad assistant. I can review the shared house-ad feed and help plan copy or creative. I don’t publish or change live campaigns from this chat." }]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const send = async (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || busy) return;
    const next = [...messages, { role: "user", content }];
    setMessages(next); setDraft(""); setBusy(true); setErr("");
    try {
      const r = await api("POST", "/api/admin/ad-agent/chat", { messages: next.filter((m) => m.role !== "system").slice(-12) });
      setMessages((m) => [...m, { role: "assistant", content: r.reply }]);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };
  return (
    <section className="dphoto" style={{ marginTop: 24 }}>
      <div className="dphoto-head"><h3>📣 Live Ad Agent</h3><small style={{ color: "var(--muted)" }}>OMP house ads · chat only</small></div>
      <p style={{ fontSize: 12, color: "var(--muted)" }}>Discuss the shared ads shown on PhantomIDE, HaksterAI, and RMT. Replies use the local ad model when available. This panel cannot publish ads or modify campaigns.</p>
      <div aria-live="polite" style={{ minHeight: 180, maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, padding: 10, background: "var(--asphalt)", border: "1px solid var(--line)", borderRadius: 8 }}>
        {messages.map((m, i) => <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "90%", whiteSpace: "pre-wrap", padding: "8px 11px", borderRadius: 10, background: m.role === "user" ? "#f5b325" : "var(--char2)", color: m.role === "user" ? "#16181b" : "var(--fg, #eee)", fontSize: 13 }}>{m.content}</div>)}
        {busy && <small style={{ color: "var(--muted)" }}>Ad Agent is responding…</small>}
      </div>
      {err && <p role="alert" style={{ color: "#ff8787", fontSize: 12 }}>{err}</p>}
      <form onSubmit={send} style={{ display: "flex", gap: 8, marginTop: 9 }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} placeholder="Ask about the shared campaign feed or draft ad copy…" aria-label="Message the ad agent" style={{ flex: 1, minWidth: 0, padding: "9px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--asphalt)", color: "var(--fg, #eee)" }} />
        <button className="ai-go" disabled={busy || !draft.trim()} style={{ padding: "8px 16px" }}>{busy ? "Working…" : "Send"}</button>
      </form>
    </section>
  );
}

/* user registry — every id with role/tier/kyc, booking trail counts, one tap into their bookings */
function UsersReg({ users, pick }) {
  const kycChip = (s) => {
    const map = { verified: ["#d3f9e8", "#087f5b"], "needs-review": ["#fff3bf", "#e8590c"], pending: ["#fff3bf", "#e8590c"], rejected: ["#ffe3e3", "#c92a2a"], none: ["#e9ecef", "#868e96"] };
    const [bg, fg] = map[s] || map.none;
    return <span style={{ ...chip, background: bg, color: fg }}>{s || "none"}</span>;
  };
  return (
    <div>
      {users === null && <p className="sec-sub">Loading users…</p>}
      {users?.length === 0 && <div className="empty">No users match.</div>}
      {(users || []).map((u) => (
        <div key={u.id} className="dphoto" style={{ marginBottom: 10 }}>
          <div className="dphoto-head">
            <h3>user #{u.id} — {u.email}</h3>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {kycChip(u.kyc_state)}
              <small style={{ color: "var(--muted)" }}>{u.role} · {u.tier}</small>
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 2 }}>
            <div>bookings as renter <b style={{ color: "var(--amber)" }}>{u.bookings_count}</b> · hosted <b style={{ color: "var(--amber)" }}>{u.hosting_count}</b> · listings <b style={{ color: "var(--amber)" }}>{u.listings_count}</b></div>
            <div style={{ opacity: 0.6 }}>joined {(u.created_on || "").replace("T", " ")} · rank #{u.signup_rank ?? "—"}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {(Number(u.bookings_count) > 0 || Number(u.hosting_count) > 0) && (
              <button className="ai-go" onClick={() => pick(u)} style={{ padding: "6px 12px", fontSize: 11 }}>All bookings for #{u.id} →</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
