import { useEffect, useState } from "react";
import { api, getToken } from "./api.js";
import { BookingSummary, BookingActions } from "../pages/Confirmation.jsx";

/* Bookings dashboard: /mybooking + /booking-detail mirror — reservations with
   deposit state, extension requests, damage claims, and the full event log. */
export default function Bookings() {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState({});    // code -> booking detail {booking, logs, extensions, claims, is_owner}
  const [logs, setLogs] = useState({});
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!getToken()) return;
    api("GET", "/api/bookings").then((r) => setRows(r.rows)).catch((e) => setErr(e.message));
  }, []);
  const refresh = () => api("GET", "/api/bookings").then((r) => setRows(r.rows));

  const showLogs = (code) => {
    api("GET", `/api/bookings/${code}/logs`).then((r) => setLogs((m) => ({ ...m, [code]: r.rows })));
  };
  const openDetail = (code, force) => {
    if (!force) setOpen((o) => ({ ...o, [code]: o[code] ? null : "loading" }));
    api("GET", `/api/bookings/${code}`).then((r) => setOpen((o) => ({ ...o, [code]: r }))).catch(() => { if (!force) setOpen((o) => ({ ...o, [code]: null })); });
  };
  const cancel = async (code) => {
    await api("POST", `/api/bookings/${code}/cancel`, {});
    await refresh();
  };

  if (!getToken()) return <div className="page"><h1 className="sec-title">Bookings</h1><p className="sec-sub">Log in to see your rentals.</p></div>;
  return (
    <div className="page deposit">
      <h1 className="sec-title">My bookings</h1>
      <p className="sec-sub">Reservation codes, deposit state, extensions, damage claims, and the full event log for each rental.</p>
      {err && <p className="coupon-no">{err}</p>}
      {rows?.length === 0 && <div className="empty">No bookings yet — grab a trailer.</div>}
      {(rows || []).map((b) => (
        <div key={b.code} className="dphoto" style={{ marginBottom: 14 }}>
          <BookingSummary b={b} />
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button className="ai-go" style={{ padding: "6px 10px", fontSize: 11 }} onClick={() => openDetail(b.code)}>
              {open[b.code] ? "Hide lifecycle" : "Extensions & claims"}
            </button>
            <button className="ai-go" style={{ padding: "6px 10px", fontSize: 11 }} onClick={() => showLogs(b.code)}>Event log</button>
            <a href={`#/confirmation/${b.code}`}><button className="ai-go" style={{ padding: "6px 10px", fontSize: 11 }}>Confirmation</button></a>
            <a href={`#/detail/${b.trailer_id}`}><button className="ai-go" style={{ padding: "6px 10px", fontSize: 11 }}>Trailer page</button></a>
            {b.payment_state !== "cancelled" && <button className="ai-go" style={{ padding: "6px 10px", fontSize: 11, background: "var(--char2)", color: "var(--orange)" }} onClick={() => cancel(b.code)}>Cancel</button>}
          </div>
          {open[b.code] === "loading" && <p className="sec-sub">Loading lifecycle…</p>}
          {open[b.code] && open[b.code] !== "loading" && (
            <div style={{ marginTop: 12 }}>
              <BookingActions b={open[b.code].booking} extensions={open[b.code].extensions} claims={open[b.code].claims} isOwner={open[b.code].is_owner} reload={() => { refresh(); openDetail(b.code, true); }} />
            </div>
          )}
          {logs[b.code] && (
            <pre className="receiptbody" style={{ marginTop: 12 }}>{logs[b.code].map((l) => `${l.logged_on}  ${l.event}${l.detail ? " — " + l.detail : ""}${l.actor ? " (" + l.actor + ")" : ""}`).join("\n")}</pre>
          )}
        </div>
      ))}
    </div>
  );
}