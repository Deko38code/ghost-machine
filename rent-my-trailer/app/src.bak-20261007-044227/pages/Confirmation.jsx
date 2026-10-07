import { useEffect, useState } from "react";
import { api, getToken, user } from "../lib/api.js";
import DepositPhotos from "../components/DepositPhotos.jsx";
import { routes, money } from "../router.jsx";

/* Confirmation — full booking lifecycle page: summary, extension requests,
   damage claims, deposit photo slots, AI receipt. Mirrors /confirmation +
   /booking-detail + /extension-request + /damageclaim of the real site. */
export default function Confirmation({ route }) {
  const code = route.param;
  const d = useBooking(code);

  if (!getToken()) return <div className="page"><h1 className="sec-title">Confirmation</h1><p className="sec-sub">Log in to view this booking.</p></div>;
  if (d === "missing") return <div className="page"><h1 className="sec-title">Booking not found</h1><a className="cta-line" href="#/bookings">All bookings →</a></div>;
  if (!d) return <div className="page"><h1 className="sec-title">Loading…</h1></div>;
  const { booking: b, logs, extensions, claims, is_owner } = d;

  return (
    <div className="page deposit">
      <h1 className="sec-title">Booking confirmed</h1>
      <p className="sec-sub">Reservation {b.code} is held. Complete the steps below to get on the road.</p>

      <BookingSummary b={b} />

      <div className="detail-cols" style={{ marginTop: 20, alignItems: "flex-start" }}>
        <section className="desc-col">
          <BookingActions b={b} extensions={extensions} claims={claims} isOwner={is_owner} reload={d.reload} />
          <h2 className="sec-title" style={{ marginTop: 24 }}>Event log</h2>
          {logs?.length > 0 && (
            <pre className="receiptbody">{logs.map((l) => `${l.logged_on}  ${l.event}${l.detail ? " — " + l.detail : ""}${l.actor ? " (" + l.actor + ")" : ""}`).join("\n")}</pre>
          )}
        </section>

        <section className="book-col">
          <DepositPhotos bookingCode={b.code} role={is_owner ? "owner" : "renter"} />
          <ConfirmationExtras b={b} />
        </section>
      </div>
    </div>
  );
}

function useBooking(code) {
  const [d, setD] = useState(null);
  useEffect(() => {
    setD(null);
    if (!getToken()) return;
    api("GET", `/api/bookings/${code}`)
      .then((r) => setD({ ...r, reload: () => api("GET", `/api/bookings/${code}`).then((r2) => setD({ ...r2, reload: d?.reload })) }))
      .catch(() => setD("missing"));
  }, [code]);
  return d;
}

export function BookingSummary({ b }) {
  return (
    <div className="booked-note" style={{ marginTop: 8 }}>
      <b style={{ color: "var(--amber)" }}>Reservation {b.code} — {b.title}</b>
      <p style={{ margin: "8px 0 0" }}>
        {b.start_date} · {b.days} day(s) · total <b style={{ color: "var(--amber)" }}>{money(b.total)}</b>
        {Number(b.deposit) ? ` · ${money(b.deposit)} refundable deposit at pickup` : ""}
        {b.coupon_code ? ` · coupon ${b.coupon_code}` : ""}
        {b.city ? ` · ${b.city}, ${b.state}` : ""}
      </p>
      <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 13 }}>
        Payment state: {b.payment_state} · Deposit state: {b.deposit_state}
      </p>
    </div>
  );
}

export function BookingActions({ b, extensions, claims, isOwner, reload }) {
  const [extForm, setExtForm] = useState(false);
  const [days, setDays] = useState(1);
  const [reason, setReason] = useState("");
  const [claimForm, setClaimForm] = useState(false);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const me = user();

  const askExtend = async () => {
    setErr(""); setMsg("");
    try {
      await api("POST", `/api/bookings/${b.code}/extension`, { days: Number(days), reason });
      setMsg("Extension request sent — the owner will approve or deny.");
      setExtForm(false); reload?.();
    } catch (e) { setErr(e.message); }
  };
  const decide = async (id, ok) => {
    setErr(""); setMsg("");
    try {
      await api("POST", `/api/bookings/${b.code}/extensions/${id}/decide`, { decide: ok ? "approve" : "deny" });
      setMsg(ok ? "Extension approved — booking days and total updated." : "Extension denied.");
      reload?.();
    } catch (e) { setErr(e.message); }
  };
  const resolve = async (id, ok) => {
    setErr(""); setMsg("");
    try {
      await api("POST", `/api/bookings/${b.code}/claims/${id}/resolve`, { decide: ok ? "resolve" : "deny", resolution: ok ? "resolved after review" : "" });
      setMsg("Claim updated.");
      reload?.();
    } catch (e) { setErr(e.message); }
  };
  const fileClaim = async () => {
    setErr(""); setMsg("");
    try {
      await api("POST", `/api/bookings/${b.code}/claim`, { description: desc, amount: Number(amount) || 0 });
      setMsg("Damage claim filed.");
      setClaimForm(false); setDesc(""); setAmount(""); reload?.();
    } catch (e) { setErr(e.message); }
  };

  const canExtend = !isOwner && b.payment_state !== "cancelled";
  return (
    <div>
      <h2 className="sec-title">Extensions &amp; claims</h2>
      {(extensions || []).length > 0 && (
        <div className="extension-list" style={{ display: "grid", gap: 8, marginBottom: 10 }}>
          {extensions.map((x) => (
            <div key={x.id} className="dphoto" style={{ padding: 10 }}>
              <b style={{ fontSize: 13 }}>+{x.added_days} day(s) · {money(x.extra_total)} extra · <span className={x.status === "approved" ? "coupon-ok" : x.status === "denied" ? "coupon-no" : ""}>{x.status}</span></b>
              {x.reason && <p style={{ fontSize: 12.5, margin: "4px 0 0", color: "var(--muted)" }}>“{x.reason}”</p>}
              {isOwner && x.status === "pending" && (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button className="ai-go" style={{ padding: "6px 10px", fontSize: 11 }} onClick={() => decide(x.id, true)}>Approve</button>
                  <button className="ai-go" style={{ padding: "6px 10px", fontSize: 11, background: "var(--char2)", color: "var(--orange)" }} onClick={() => decide(x.id, false)}>Deny</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {(claims || []).length > 0 && (
        <div className="claim-list" style={{ display: "grid", gap: 8, marginBottom: 10 }}>
          {claims.map((c) => (
            <div key={c.id} className="dphoto" style={{ padding: 10 }}>
              <b style={{ fontSize: 13 }}>{c.party} claim · {money(c.claimed_amount)} · <span className={c.status === "open" ? "" : c.status === "resolved" ? "coupon-ok" : "coupon-no"}>{c.status}</span></b>
              <p style={{ fontSize: 12.5, margin: "4px 0 0" }}>{c.description}</p>
              {c.resolution && <p style={{ fontSize: 12, margin: "4px 0 0", color: "var(--muted)" }}>Resolution: {c.resolution}</p>}
              {isOwner && c.status === "open" && (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button className="ai-go" style={{ padding: "6px 10px", fontSize: 11 }} onClick={() => resolve(c.id, true)}>Mark resolved</button>
                  <button className="ai-go" style={{ padding: "6px 10px", fontSize: 11, background: "var(--char2)", color: "var(--orange)" }} onClick={() => resolve(c.id, false)}>Deny</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {(canExtend || !isOwner) && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canExtend && (extForm
            ? (
              <div style={{ display: "grid", gap: 8, flex: 1, minWidth: 240 }}>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>Days to add
                  <input type="number" min="1" style={{ width: 80 }} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} />
                </label>
                <input placeholder="Optional reason" value={reason} onChange={(e) => setReason(e.target.value)} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="ai-go" onClick={askExtend}>Send request</button>
                  <button className="ai-go" style={{ background: "var(--char2)", color: "var(--orange)" }} onClick={() => setExtForm(false)}>Not now</button>
                </div>
              </div>
            )
            : <button className="ai-go" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => setExtForm(true)}>Request extension</button>)}
          {claimForm
            ? (
              <div style={{ display: "grid", gap: 8, flex: 1, minWidth: 240 }}>
                <textarea rows="3" placeholder="What happened? (10+ characters)" value={desc} onChange={(e) => setDesc(e.target.value)} />
                <input type="number" min="0" placeholder="Claimed amount $" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="ai-go" onClick={fileClaim}>File claim</button>
                  <button className="ai-go" style={{ background: "var(--char2)", color: "var(--orange)" }} onClick={() => setClaimForm(false)}>Nevermind</button>
                </div>
              </div>
            )
            : <button className="ai-go" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => setClaimForm(true)}>File damage claim</button>}
        </div>
      )}
      {msg && <p className="coupon-ok" style={{ marginTop: 8 }}>{msg}</p>}
      {err && <p className="coupon-no" style={{ marginTop: 8 }}>{err}</p>}
    </div>
  );
}

export function ConfirmationExtras({ b }) {
  const [receipt, setReceipt] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const aiReceipt = async () => {
    setAiBusy(true);
    try { const r = await api("POST", `/api/bookings/${b.code}/receipt`, { compose: "ai" }); setReceipt(r.receipt); }
    catch { /* SMTP off: body still lands in the receipt row */ }
    setAiBusy(false);
  };
  return (
    <div style={{ marginTop: 14 }}>
      <button className="ai-go" style={{ padding: "8px 12px", fontSize: 12 }} onClick={aiReceipt} disabled={aiBusy}>
        {aiBusy ? "Composing with AI…" : "Email receipt — written by AI"}
      </button>
      {receipt?.email_body && (
        <pre className="receiptbody" style={{ marginTop: 10 }}>{receipt.email_body}{receipt.status === "draft" ? `\n\n(status: draft — SMTP not configured yet, body is ready to send)` : ""}</pre>
      )}
      <div className="couplelist" style={{ marginTop: 14 }}>
        <b>Next steps</b>
        <span>• Dropoff photos: 4 slots (hitch, tires, corners, extras) unlock deposit hold.</span>
        <span>• Owner approval of any extension updates your booking days + total automatically.</span>
        <span>• Full history lives in <a href="#/bookings" style={{ color: "var(--amber)" }}>Bookings</a>; talk to the owner in <a href={`#/messages/${b.trailer_id}`} style={{ color: "var(--amber)" }}>Messages</a>.</span>
      </div>
    </div>
  );
}