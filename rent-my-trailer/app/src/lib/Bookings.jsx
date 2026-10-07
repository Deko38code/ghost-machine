import { useEffect, useState } from "react";
import { api, getToken, user, setToken, setUser } from "./api.js";

/* Bookings dashboard: real bookings, receipts, deposit states, logs */
/* ─── calendar links (Google Workspace Calendar / ICS) ── */
const day = (d, days = 1) => new Date(`${String(d).slice(0, 10)}T09:00:00`);
const fmt = (dt) => dt.toISOString().replace(/[-:]/g, "").replace(/\.000Z/, "Z").slice(0, 15) + "00Z";
const gcalUrl = (b) => {
  const s = day(b.start_date), e = new Date(s.getTime() + Number(b.days) * 86400_000);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Trailer rental ${b.code} — ${b.title}`)}&dates=${fmt(s)}/${fmt(e)}&details=${encodeURIComponent(`Rent My Trailer booking ${b.code}\nTotal $${b.total}\nhttps://rmt.haksterai.com/#/bookings`)}&location=${encodeURIComponent(`${b.city || ""} ${b.state || ""}`)}`;
};
const icsFor = (b) => {
  const s = day(b.start_date), e = new Date(s.getTime() + Number(b.days) * 86400_000);
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//RentMyTrailer//EN", "BEGIN:VEVENT",
    `UID:${b.code}@rentmytrailer`, `DTSTART:${fmt(s)}`, `DTEND:${fmt(e)}`,
    `SUMMARY:Trailer rental ${b.code} — ${b.title}`,
    `DESCRIPTION:Total $${b.total}\nhttps://rmt.haksterai.com/#/bookings`,
    `LOCATION:${b.city || ""} ${b.state || ""}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
};
/* ─── GPS-verified handover (check-out / check-in) ────── */
function getPosition() {
  return new Promise((ok, bad) => {
    if (!navigator.geolocation) return bad(new Error("GPS not available on this device"));
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }),
      (e) => bad(new Error("location access denied — enable it to verify the handover")),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}
const parseGps = (b, key) => { try { return b[key] ? JSON.parse(b[key]) : null; } catch { return null; } };
export default function Bookings() {
  const [rows, setRows] = useState(null);
  const [logs, setLogs] = useState({});
  useEffect(() => {
    if (!getToken()) return;
    api("GET", "/api/bookings").then((r) => setRows(r.rows)).catch((e) => setErr(e.message));
  }, []);
  const [err, setErr] = useState("");
  const showLogs = (code) => {
    api("GET", `/api/bookings/${code}/logs`).then((r) => setLogs((m) => ({ ...m, [code]: r.rows })));
  };
  const cancel = (code) => {
    api("POST", `/api/bookings/${code}/cancel`, {}).then(() => api("GET", "/api/bookings").then((r) => setRows(r.rows)));
  };
  const doHandover = async (code, stage) => {
    setBusyH(code);
    setHandover((m) => ({ ...m, [code]: { msg: stage === "checkout" ? "Getting your location — pick-up verification…" : "Getting your location — return verification…", pending: true } }));
    try {
      const gps = await getPosition();
      const r = await api("POST", `/api/bookings/${code}/${stage}`, { gps });
      const fenceTxt = !r.fence.center ? "" : ` · ${r.in_fence ? "inside geofence" : "OUTSIDE geofence"} (${r.distance_mi}mi of pickup point)`;
      setHandover((m) => ({ ...m, [code]: { msg: `${stage === "checkout" ? "✓ Picked up" : "✓ Returned"} at ${r.at} — GPS ${r.gps.lat.toFixed(4)}, ${r.gps.lng.toFixed(4)} ±${r.gps.acc}m${fenceTxt}`, ok: r.in_fence !== false } }));
      api("GET", "/api/bookings").then((r2) => setRows(r2.rows));
    } catch (ex) {
      setHandover((m) => ({ ...m, [code]: { msg: "✗ " + ex.message, ok: false, pending: false } }));
    }
    setBusyH(null);
  };
  if (!getToken()) return <div className="page"><h1 className="sec-title">Bookings</h1><p className="sec-sub">Log in to see your rentals.</p></div>;
  return (
    <div className="page deposit">
      <h1 className="sec-title">My bookings</h1>
      <p className="sec-sub">Reservation codes, deposit state, and the full event log for each rental.</p>
      {err && <p className="coupon-no">{err}</p>}
      {rows?.length === 0 && <div className="empty">No bookings yet — grab a trailer.</div>}
      {(rows || []).map((b) => (
        <div key={b.code} className="dphoto" style={{ marginBottom: 14 }}>
          <div className="dphoto-head">
            <h3>{b.code} — {b.title}</h3>
            {(() => { const okk = b.payment_state === "paid" || b.payment_state === "paid_full"; return (
              <span>{okk ? "✅ PAID IN FULL" : `💵 DUE BEFORE PICKUP $${b.total + Number(b.deposit || 0)} (rental + deposit)`} · deposit {b.deposit_state}{b.checkin_at ? " · ✓ RETURNED" : b.checkout_at ? " · OUT (in your possession)" : ""}</span>
            ); })()}
            {(() => { const idSt = Number(b.id_verified) === 1; const okk = b.payment_state === "paid" || b.payment_state === "paid_full";
              if (idSt) return null; // verified identity — no prompt
              return (
                <IdVerifyRow code={b.code} onDone={() => api("GET", "/api/bookings").then((r) => setRows(r.rows))} />
              );
            })()}
            {(() => { const okk2 = b.payment_state === "paid" || b.payment_state === "paid_full"; if (okk2 || b.payment_state === "cancelled") return <KycRow />; return (
              <button className="ai-go" style={{ padding: "6px 10px", fontSize: 11, background: "#0ca678" }}
                onClick={async () => {
                  try { const r = await api("POST", `/api/bookings/${b.code}/pay/start`); if (r.url) location.href = r.url; else if (r.already) setHandover((m) => ({ ...m, [b.code]: { msg: "✓ " + r.already } })); else if (r.manual) setHandover((m) => ({ ...m, [b.code]: { msg: "💵 " + r.note + ` Bring $${r.total_due}.`, pending: true } })); }
                  catch (ex) { setHandover((m) => ({ ...m, [b.code]: { msg: "✗ " + ex.message } })); }
                }}>Pay full total + deposit</button>
            ); })()}
          </div>
          {b.img && <img className="booking-img-thumb" src={b.img} alt={b.title} style={{ width: "100%", maxHeight: 130, objectFit: "cover", borderRadius: 8, marginBottom: 8, display: "block" }} loading="lazy" />}
          <p style={{ fontSize: 13.5 }}>
{/*UI-OK:imgdone*/}
            {b.start_date} · {b.days} day(s) · total <b style={{ color: "var(--amber)" }}>${b.total}</b>{Number(b.deposit) ? ` + $${b.deposit} deposit` : ""}{b.coupon_code ? ` · coupon ${b.coupon_code}` : ""}
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {b.payment_state !== "cancelled" && !b.checkout_at && (
              <button className="ai-go" style={{ padding: "6px 10px", fontSize: 11, background: "#f5b325", color: "#16181b" }} disabled={busyH === b.code} onClick={() => doHandover(b.code, "checkout")}>{busyH === b.code ? "Locating…" : "✓ Check out — picked up"}</button>
            )}
            {b.payment_state !== "cancelled" && b.checkout_at && !b.checkin_at && (
              <button className="ai-go" style={{ padding: "6px 10px", fontSize: 11, background: "#f5b325", color: "#16181b" }} disabled={busyH === b.code} onClick={() => doHandover(b.code, "checkin")}>{busyH === b.code ? "Locating…" : "✓ Check in — returned"}</button>
            )}
          </div>
          {(b.insurance === "roamly" || b.insurance === "jerry") && <p style={{ fontSize: 12, color: "var(--amber)" }}>🛡️ Damage coverage included — {b.insurance_daily ? "$" + b.insurance_daily + "/day" : "see policy"} · manage on your carrier's site</p>}
          {!b.insurance && b.payment_state !== "cancelled" && b.checkout_at && <p style={{ fontSize: 12 }}>🛡️ Trailer damage & theft coverage available via <a href="/api/aff/insurance" target="_blank" rel="noreferrer" style={{ color: "var(--amber)" }}>Roamly — trailer specialists</a> (get a real quote in ~60s)</p>}
          {handover[b.code]?.msg && <p style={{ fontSize: 12, marginTop: 6, color: handover[b.code].pending ? "var(--muted)" : handover[b.code].ok === false ? "#ff5c1a" : "var(--amber)" }}>{handover[b.code].msg}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="ai-go" style={{ padding: "6px 10px", fontSize: 11 }} onClick={() => showLogs(b.code)}>Event log</button>
            {b.payment_state !== "cancelled" && <button className="ai-go" style={{ padding: "6px 10px", fontSize: 11, background: "var(--char2)", color: "var(--orange)" }} onClick={() => cancel(b.code)}>Cancel</button>}
            <a href={gcalUrl(b)} target="_blank" rel="noreferrer"><button className="ai-go" style={{ padding: "6px 10px", fontSize: 11, background: "#1a73e8", color: "#fff" }}>+ Google Calendar</button></a>
            <a href={`data:text/calendar;charset=utf-8,${encodeURIComponent(icsFor(b))}`} download={`${b.code}.ics`}><button className="ai-go" style={{ padding: "6px 10px", fontSize: 11 }}>ICS</button></a>
            {b.lat && b.lng && <a href={`https://waze.com/ul?ll=${b.lat}%2C${b.lng}&navigate=yes`} target="_blank" rel="noreferrer"><button className="ai-go" style={{ padding: "6px 10px", fontSize: 11, background: "#33ccff", color: "#16181b" }}>🚙 Waze</button></a>}
          </div>
          {logs[b.code] && (
            <pre className="receiptbody">{logs[b.code].map((l) => `${l.logged_on}  ${l.event}${l.detail ? " — " + l.detail : ""}${l.actor ? " (" + l.actor + ")" : ""}`).join("\n")}</pre>
          )}
        </div>
      ))}
      {rows && rows.length === 0 && null}
      <div style={{ marginTop: 26 }} />
      <h2 className="sec-title">Incoming — my listings</h2>
      <p className="sec-sub">Renters booked your trailers: mark payment received and verify their ID to unlock pickup.</p>
      <IncomingPanel />
    </div>
  );
}

/* owner console: incoming bookings → mark paid + ID verification */
function IncomingPanel() {
  const [rows, setRows] = useState(null);
  const [msg, setMsg] = useState({});
  useEffect(() => {
    if (!getToken()) return;
    api("GET", "/api/bookings/incoming").then((r) => setRows(r.rows)).catch(() => setRows([]));
  }, []);
  if (!getToken()) return null;
  const say = (code, m) => setMsg((x) => ({ ...x, [code]: m }));
  const viewId = async (code) => {
    try {
      const r = await fetch(`/api/bookings/${code}/id-photo`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!r.ok) throw new Error("no ID on file");
      const blob = await r.blob();
      const w = window.open(URL.createObjectURL(blob), "_blank");
      if (w) say(code, "ID opened in a new tab.");
    } catch (e) { say(code, "✗ " + e.message); }
  };
  return (
    <>
      {rows?.length === 0 && <div className="empty">No bookings on your listings yet.</div>}
      {(rows || []).map((b) => {
        const okk = b.payment_state === "paid" || b.payment_state === "paid_full";
        return (
          <div key={"in" + b.code} className="dphoto" style={{ marginBottom: 12 }}>
            <div className="dphoto-head">
              <h3>{b.code} — {b.title}</h3>
              <span>{okk ? "✅ paid" : "unpaid"} · ID: {Number(b.id_verified) === 1 ? "verified ✓" : Number(b.id_verified) === -1 ? "rejected" : b.id_photo_file ? "uploaded — review" : "not uploaded"}</span>
            </div>
            <p style={{ fontSize: 13 }}>
              {b.start_date} · {b.days} day(s) · renter total <b style={{ color: "var(--amber)" }}>${b.total}</b> + deposit <b style={{ color: "var(--amber)" }}>${Number(b.deposit) || 0}</b> · your payout <b style={{ color: "var(--amber)" }}>${Number(b.owner_payout || 0).toFixed(2)}</b>
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
              {!okk && <button className="ai-go" style={{ padding: "6px 10px", fontSize: 11, background: "#f5b325", color: "#16181b" }} onClick={async () => { try { await api("POST", `/api/bookings/${b.code}/pay`, { method: "in-person" }); say(b.code, "Payment recorded — pickup unlocked."); api("GET", "/api/bookings/incoming").then((r) => setRows(r.rows)); } catch (e) { say(b.code, "✗ " + e.message); } }}>💵 Mark paid in person</button>}
              {b.id_photo_file && Number(b.id_verified) !== 1 && <button className="ai-go" style={{ padding: "6px 10px", fontSize: 11 }} onClick={() => viewId(b.code)}>🪪 View ID</button>}
              {b.id_photo_file && Number(b.id_verified) !== 1 && <button className="ai-go" style={{ padding: "6px 10px", fontSize: 11, background: "#0ca678" }} onClick={async () => { try { await api("POST", `/api/bookings/${b.code}/id-decide`, { decide: "approve" }); say(b.code, "ID verified — pickup unlocked."); api("GET", "/api/bookings/incoming").then((r) => setRows(r.rows)); } catch (e) { say(b.code, "✗ " + e.message); } }}>✓ Verify ID</button>}
              {b.id_photo_file && Number(b.id_verified) !== -1 && <button className="ai-go" style={{ padding: "6px 10px", fontSize: 11, background: "var(--char2)", color: "var(--orange)" }} onClick={async () => { try { await api("POST", `/api/bookings/${b.code}/id-decide`, { decide: "reject" }); say(b.code, "ID rejected — renter must re-upload."); api("GET", "/api/bookings/incoming").then((r) => setRows(r.rows)); } catch (e) { say(b.code, "✗ " + e.message); } }}>✗ Reject ID</button>}
              <a href={`#/detail/${b.trailer_id}`}><button className="ai-go" style={{ padding: "6px 10px", fontSize: 11 }}>Details</button></a>
            </div>
            {msg[b.code] && <p style={{ fontSize: 12, color: "var(--amber)" }}>{msg[b.code]}</p>}
          </div>
        );
      })}
    </>
  );
}

/* renter identity verification via Stripe Identity (doc + selfie, ~30s) */
function IdVerifyRow({ code, onDone }) {
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const start = async () => {
    setBusy(true);
    try {
      const r = await api("POST", "/api/identity/start", { code });
      if (r.url) { location.href = r.url; return; }
      setSt(r.status);
      poll(r.session);
    } catch (e) {
      setSt("config-error: " + e.message);
    }
    setBusy(false);
  };
  const poll = async (sid) => {
    for (let i = 0; i < 6; i++) {
      await new Promise((r0) => setTimeout(r0, 5000));
      try {
        const q = sid ? `?session=${sid}` : "";
        const r = await api("GET", `/api/identity/check${q}`);
        setSt(r.status);
        if (r.verified) { onDone(); return; }
        if (r.url && !url) setUrl(r.url);
      } catch {}
    }
  };
  return (
    <small style={{ display: "block", marginTop: 4 }}>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", background: "var(--asphalt)", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 10px" }} onClick={!busy ? start : undefined}>
        🪪 {busy ? "starting Stripe Identity…" : "Verify my government ID (license + selfie — takes ~30 s, required before payment)"}
        <input type="file" style={{ display: "none" }} />
      </label>
      {url && <span> · <a href={url} target="_blank" rel="noreferrer" style={{ color: "var(--amber)" }}>open verification page</a></span>}
      {st && <span style={{ display: "block", color: "var(--muted)" }}>status: {String(st)}</span>}
    </small>
  );
}

let kycCache = null;
function KycRow() {
  const [st, setSt] = useState(kycCache);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { api("GET", "/api/kyc/status").then((r) => { kycCache = r; setSt(r); }).catch(() => {}); }, []);
  const submit = async (files) => {
    if (!files.length || busy) return;
    setBusy(true); setMsg("uploading…");
    const fd = new FormData();
    for (const f of files.slice(0, 3)) fd.append("docs", f);
    try {
      const r = await fetch("/api/kyc/submit", { method: "POST", headers: { Authorization: `Bearer ${getToken()}` }, body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "upload failed");
      kycCache = j; setSt(j); setMsg("ID received — verify completes before your pickup.");
    } catch (ex) { setMsg("✗ " + ex.message); }
    setBusy(false);
  };
  return (
    <small style={{ display: "block", marginTop: 4 }}>
      {st?.state === "verified" ? <span style={{ color: "#38d9a9" }}>✓ ID verified — pickup unlocked</span>
        : st?.state === "pending" ? <span style={{ color: "#f5b325" }}>⏳ ID pending verification</span>
        : <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", background: "var(--asphalt)", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 10px" }}>
            🪪 Verify ID (license front + back)
            <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => submit(Array.from(e.target.files || []))} disabled={busy} />
          </label>}
      {msg && <span style={{ display: "block", color: "var(--muted)" }}>{msg}</span>}
    </small>
  );
}