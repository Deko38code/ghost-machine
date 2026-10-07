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
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [logs, setLogs] = useState({});
  const [msg, setMsg] = useState({});

  const load = () => api("GET", "/api/admin/bookings").then((r) => setData(r)).catch((e) => setErr(e.message));
  useEffect(() => { if (getToken() && user()?.role === "admin") load(); }, []);

  const act = async (code, kind) => {
    try {
      if (kind === "cancel") { await api("POST", `/api/admin/bookings/${code}/cancel`, {}); setMsg((m) => ({ ...m, [code]: "✓ cancelled by admin" })); }
      if (kind === "pay") { await api("POST", `/api/bookings/${code}/pay`, { method: "in-person" }); setMsg((m) => ({ ...m, [code]: "✓ marked paid" })); }
      if (kind === "logs") { const r = await api("GET", `/api/bookings/${code}/logs`); setLogs((m) => ({ ...m, [code]: r.rows })); return; }
      load();
    } catch (e) { setMsg((m) => ({ ...m, [code]: "✗ " + e.message })); }
  };

  if (!getToken()) return <div className="page"><h1 className="sec-title">Admin</h1><p className="sec-sub">Log in with an admin account.</p></div>;
  if (user()?.role !== "admin") return <div className="page"><h1 className="sec-title">Admin</h1><p className="sec-sub">Admins only.</p></div>;
  if (err) return <div className="page"><h1 className="sec-title">Admin</h1><p className="coupon-no">{err}</p></div>;
  if (!data) return <div className="page"><h1 className="sec-title">Admin</h1><p className="sec-sub">Loading bookings…</p></div>;

  const rows = (data.rows || []).filter((b) => {
    if (filter !== "all" && b.payment_state !== filter) return false;
    if (!q) return true;
    const s = `${b.code} ${b.title} ${b.renter_email || ""} ${b.owner_email || ""}`.toLowerCase();
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
      <h1 className="sec-title">Admin — bookings</h1>
      <p className="sec-sub">Every booking on the platform, with renter/owner, payment state, and admin actions.</p>
      <BootChecklist />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        {statBox("TOTAL", data.stats.total)}
        {statBox("PAID", data.stats.paid)}
        {statBox("PENDING", data.stats.pending)}
        <small style={{ color: "var(--muted)", fontSize: 12, alignSelf: "center" }}>revenue view — rent + deposit per booking, money settles to the platform ledger</small>
      </div>
      <input placeholder="Search code, trailer, renter or owner email…" value={q} onChange={(e) => setQ(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--asphalt)", color: "var(--fg, #eee)", marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
        <span style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>PAYMENT STATE</span>
        {["all", "pending", "paid", "cancelled"].map((f) => (
          <button key={f} className="ai-go" onClick={() => setFilter(f)} style={{ padding: "5px 12px", fontSize: 11, ...(filter === f ? {} : { background: "var(--asphalt)", color: "var(--fg, #eee)", border: "1px solid var(--line)" }) }}>{f}</button>
        ))}
      </div>

      {(rows || []).map((b) => (
        <div key={b.code} className="dphoto" style={{ marginBottom: 12 }}>
          <div className="dphoto-head">
            <h3>{b.code} — {b.title}</h3>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {stateChip(b.payment_state)}
              {b.pay_method && <small style={{ color: "var(--muted)", fontWeight: 400 }}>{b.pay_method}</small>}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 2 }}>
            <div>{dollars(b.total)} rent{b.deposit ? " + " + dollars(b.deposit) + " deposit" : ""}</div>
            <div><b style={{ color: "var(--fg, #eee)" }}>{b.renter_email}</b> → <b style={{ color: "var(--fg, #eee)" }}>{b.owner_email || "—"}</b></div>
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


/* SMS test-send + delivery log (textbee.dev free tier — no card) */
function SmsAdminPanel() {
  const [phone, setPhone] = useState("");
  const [text, setText] = useState("Test from Rent My Trailer — SMS pipeline is live.");
  const [result, setResult] = useState(null);
  const [log, setLog] = useState(null);
  const [configured, setConfigured] = useState(null);
  const loadLog = () => api("GET", "/api/admin/sms-log").then((r) => { setLog(r.rows); setConfigured(r.configured); }).catch(() => setLog([]));
  useEffect(() => { loadLog(); }, []);
  const send = async () => {
    setResult("sending…");
    try {
      const r = await api("POST", "/api/admin/sms-test", { phone, text });
      setResult(r.sent ? "✓ sent" : "✗ " + (r.note || r.error || r.body || "not sent"));
      loadLog();
    } catch (e) { setResult("✗ " + e.message); }
  };
  const inputStyle = { padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--asphalt)", color: "var(--fg, #eee)" };
  return (
    <div className="dphoto" style={{ marginTop: 24 }}>
      <div className="dphoto-head"><h3>SMS — customer texts (textbee.dev, free tier)</h3>
        <span>{configured === null ? "…" : configured ? "API key configured ✓" : "API key not set"}</span></div>
      {!configured && (
        <p style={{ fontSize: 12, color: "var(--amber)" }}>
          Free setup, no card: <a href="https://app.textbee.dev/register" target="_blank" rel="noreferrer" style={{ color: "var(--amber)" }}>app.textbee.dev/register</a> →
          install their Android app on a phone with a SIM → link it in the dashboard → create an API key →
          add <code>RMT_TEXTBEE_API_KEY=…</code> to <code>server/.env</code> → restart rmt-server. 300 texts/month free.
        </p>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
        <input placeholder="+15551234567" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ ...inputStyle, width: 160 }} />
        <input placeholder="Message" value={text} onChange={(e) => setText(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 220 }} />
        <button className="ai-go" style={{ padding: "8px 14px", fontSize: 12 }} onClick={send}>Send test SMS</button>
      </div>
      {result && <p style={{ fontSize: 12, color: "var(--amber)", marginTop: 6 }}>{result}</p>}
      {log && log.length > 0 && (
        <pre className="receiptbody" style={{ marginTop: 10, maxHeight: 220, overflow: "auto" }}>
{log.map((s) => `${s.created_on}  ${s.status}  ${s.to_phone || "—"}  [${s.provider}] ${s.text.slice(0, 60)}${s.detail ? " · " + s.detail.slice(0, 80) : ""}`).join("\n")}
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