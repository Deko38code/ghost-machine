import { useState } from "react";
import { api } from "../lib/api.js";

/* Password reset landing — link comes from the email: #/reset/<token> */
export default function Reset({ route }) {
  const token = route.param || "";
  const [pw, setPw] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await api("POST", "/api/auth/reset", { token, password: pw });
      setDone(true);
      setTimeout(() => { location.hash = "#/home"; }, 1500);
    } catch (ex) { setErr(ex.message); }
    setBusy(false);
  };

  return (
    <section className="section">
      <h1 className="sec-title">Set a new password</h1>
      <p className="sec-sub">Reset links are single-use and valid for 30 minutes.</p>
      {!token && <div className="empty">Invalid link — request a new one from the log-in modal ("Forgot password?").</div>}
      {token && done && <div className="empty">Password updated — 2FA resets too. Redirecting home…</div>}
      {token && !done && (
        <form onSubmit={submit} className="bookform" style={{ maxWidth: 360 }}>
          <label>New password<input type="password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="min 8 chars" /></label>
          {err && <p className="coupon-no">{err}</p>}
          <button className="bookbtn" disabled={busy}>{busy ? "…" : "Update password"}</button>
        </form>
      )}
    </section>
  );
}
