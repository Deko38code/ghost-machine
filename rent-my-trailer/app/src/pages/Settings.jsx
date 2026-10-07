import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { api, user } from "../lib/api.js";

/* Account settings: password, 2FA (Duo Mobile / any TOTP authenticator) */
export default function Settings() {
  const [u, setU] = useState(() => user() || null);
  const [cur, setCur] = useState("");
  const [npw, setNpw] = useState("");
  const [pwMsg, setPwMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [twoFaState, setTwoFa] = useState("loading"); // loading | off | stage | on
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [faMsg, setFaMsg] = useState(null);

  useEffect(() => {
    api("GET", "/api/2fa/status").then((r) => setTwoFa(r.enabled ? "on" : "off")).catch(() => setTwoFa("off"));
  }, []);

  const changePw = async (e) => {
    e.preventDefault();
    setBusy(true); setPwMsg(null);
    try {
      await api("POST", "/api/auth/change-password", { current: cur, next: npw });
      setPwMsg({ ok: true, t: "Password updated." });
      setCur(""); setNpw("");
    } catch (ex) { setPwMsg({ ok: false, t: ex.message }); }
    setBusy(false);
  };

  const start2fa = async () => {
    setBusy(true); setFaMsg(null);
    try {
      const r = await api("POST", "/api/2fa/setup");
      setSecret(r.secret);
      setQr(await QRCode.toDataURL(r.otpauth, { width: 180, margin: 1, color: { dark: "#16181b", light: "#f4f1ea" } }));
      setTwoFa("stage");
    } catch (ex) { setFaMsg(ex.message); }
    setBusy(false);
  };
  const enable2fa = async (e) => {
    e.preventDefault();
    setBusy(true); setFaMsg(null);
    try {
      await api("POST", "/api/2fa/enable", { code });
      setTwoFa("on"); setQr(""); setSecret(""); setCode("");
      setFaMsg("2FA active — Duo Mobile / authenticator codes required at login.");
    } catch (ex) { setFaMsg(ex.message); }
    setBusy(false);
  };
  const disable2fa = async (e) => {
    e.preventDefault();
    setBusy(true); setFaMsg(null);
    try {
      await api("POST", "/api/2fa/disable", { code });
      setTwoFa("off"); setCode("");
      setFaMsg("2FA disabled.");
    } catch (ex) { setFaMsg(ex.message); }
    setBusy(false);
  };

  if (!u || !Object.keys(u).length) return (
    <section className="section">
      <h1 className="sec-title">Settings</h1>
      <p className="sec-sub">Log in to manage your account. Use the Google button or <a href="#/" style={{ color: "var(--amber)" }}>email log in</a>.</p>
    </section>
  );

  return (
    <section className="section">
      <h1 className="sec-title">Settings</h1>
      <p className="sec-sub">Account & security — {u.email}</p>

      <div className="dphoto" style={{ maxWidth: 460, marginBottom: 14 }}>
        <div className="dphoto-head"><h3>Password</h3></div>
        <form onSubmit={changePw} className="bookform">
          <label>Current password<input type="password" required value={cur} onChange={(e) => setCur(e.target.value)} /></label>
          <label>New password<input type="password" required minLength={8} value={npw} onChange={(e) => setNpw(e.target.value)} placeholder="min 8 chars" /></label>
          {pwMsg && <p className={pwMsg.ok ? "coupon-ok" : "coupon-no"}>{pwMsg.t}</p>}
          <button className="bookbtn" disabled={busy}>{busy ? "…" : "Change password"}</button>
        </form>
      </div>

      <div className="dphoto" style={{ maxWidth: 460 }}>
        <div className="dphoto-head"><h3>Two-factor authentication</h3><span>{twoFaState === "on" ? "active" : "off"}</span></div>
        {twoFaState === "loading" && <p className="ai-hint">Checking…</p>}
        {twoFaState === "off" && (
          <>
            <p className="ai-hint">Add a second step at login with Duo Mobile or any authenticator (Google Authenticator, Authy, Microsoft).</p>
            <button className="bookbtn" onClick={start2fa} disabled={busy}>{busy ? "…" : "Set up 2FA"}</button>
          </>
        )}
        {twoFaState === "stage" && (
          <form onSubmit={enable2fa} className="bookform">
            <p className="ai-hint">1 · Open Duo Mobile → Add Account → scan this QR (or type the secret).</p>
            {qr && <img src={qr} alt="2FA QR code" width={180} style={{ borderRadius: 8, margin: "8px 0" }} />}
            <p className="ai-hint" style={{ userSelect: "all" }}>Secret: <b>{secret}</b></p>
            <label>2 · Enter the 6-digit code<input inputMode="numeric" pattern="[0-9]*" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" /></label>
            {faMsg && <p className={"coupon-ok"}>{faMsg}</p>}
            <button className="bookbtn" disabled={busy}>{busy ? "…" : "Enable 2FA"}</button>
          </form>
        )}
        {twoFaState === "on" && (
          <form onSubmit={disable2fa} className="bookform">
            {faMsg && <p className={"coupon-ok"}>{faMsg}</p>}
            <p className="ai-hint">Enter a current code to switch 2FA off.</p>
            <label>6-digit code<input inputMode="numeric" pattern="[0-9]*" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" /></label>
            <button className="bookbtn" disabled={busy}>{busy ? "…" : "Disable 2FA"}</button>
          </form>
        )}
      </div>
    </section>
  );
}
