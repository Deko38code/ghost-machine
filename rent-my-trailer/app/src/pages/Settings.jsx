import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { api, user, getToken } from "../lib/api.js";

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
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneState, setPhoneState] = useState("loading"); // loading | unverified | sent | verified
  const [phoneMsg, setPhoneMsg] = useState(null);
  const [tgMsg, setTgMsg] = useState(null);

  useEffect(() => {
    api("GET", "/api/2fa/status").then((r) => setTwoFa(r.enabled ? "on" : "off")).catch(() => setTwoFa("off"));
    if (getToken()) api("GET", "/api/profile/me").then((r) => {
      if (r.user?.phone_verified) { setPhone(r.user.phone); setPhoneState("verified"); }
      else if (r.user?.phone) { setPhone(r.user.phone); setPhoneState("unverified"); }
      else setPhoneState("unverified");
    }).catch(() => setPhoneState("unverified"));
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
  const sendPhoneCode = async (e) => {
    e?.preventDefault();
    setBusy(true); setPhoneMsg(null);
    try { await api("POST", "/api/phone/send", { phone }); setPhoneState("sent"); setPhoneMsg({ ok: true, t: "Verification code sent via SMS." }); }
    catch (ex) { setPhoneMsg({ ok: false, t: ex.message }); }
    setBusy(false);
  };
  const verifyPhone = async (e) => {
    e?.preventDefault();
    setBusy(true); setPhoneMsg(null);
    try { const r = await api("POST", "/api/phone/verify", { code: phoneCode }); setPhoneState("verified"); setPhoneMsg({ ok: true, t: "Phone verified — you'll get SMS alerts for new messages." }); }
    catch (ex) { setPhoneMsg({ ok: false, t: ex.message }); }
    setBusy(false);
  };
  const tgVerify = async () => {
    setBusy(true); setTgMsg(null);
    try {
      const r = await api("POST", "/api/tg/verify/start", {});
      window.open(r.url, "_blank", "noopener");
      setTgMsg({ ok: true, t: "Telegram opened — tap START in the bot to confirm. Watching for the link…" });
      const deadline = Date.now() + 120000;
      const poll = setInterval(async () => {
        try {
          const me = await api("GET", "/api/profile/me");
          if (me.user?.telegram_verified) {
            clearInterval(poll);
            setU((prev) => ({ ...(prev || {}), ...me.user }));
            setTgMsg({ ok: true, t: "✅ Telegram linked to your account!" });
            setBusy(false);
          } else if (Date.now() > deadline) {
            clearInterval(poll);
            setTgMsg({ ok: false, t: "Timed out — tap the START button in the bot, then try again." });
            setBusy(false);
          }
        } catch { /* keep polling */ }
      }, 3000);
    } catch (ex) { setTgMsg({ ok: false, t: ex.message }); setBusy(false); }
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

      <div className="dphoto" style={{ maxWidth: 460, marginTop: 14 }}>
        <div className="dphoto-head"><h3>Phone — SMS alerts</h3><span>{phoneState === "verified" ? "✓ verified" : "unverified"}</span></div>
        {phoneState === "verified" ? (
          <p className="ai-hint">Your phone {phone} is verified. You'll get SMS notifications when someone messages you about a booking.</p>
        ) : (
          <>
            <p className="ai-hint">Add your phone to get SMS alerts when renters message you about your trailers.</p>
            {phoneState !== "sent" ? (
              <form onSubmit={sendPhoneCode} className="bookform">
                <label>Phone number<input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" /></label>
                {phoneMsg && <p className={phoneMsg.ok ? "coupon-ok" : "coupon-no"}>{phoneMsg.t}</p>}
                <button className="bookbtn" disabled={busy}>{busy ? "…" : "Send verification code"}</button>
              </form>
            ) : (
              <form onSubmit={verifyPhone} className="bookform">
                <p className="ai-hint">Enter the 6-digit code we sent to {phone}.</p>
                <label>Verification code<input inputMode="numeric" pattern="[0-9]*" maxLength={6} value={phoneCode} onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" /></label>
                {phoneMsg && <p className={phoneMsg.ok ? "coupon-ok" : "coupon-no"}>{phoneMsg.t}</p>}
                <button className="bookbtn" disabled={busy}>{busy ? "…" : "Verify phone"}</button>
                <button type="button" className="ai-go" style={{ padding: "6px 10px", fontSize: 11 }} onClick={() => { setPhoneState("unverified"); setPhoneCode(""); }}>Change number</button>
              </form>
            )}
          </>
        )}
      </div>
      <div className="dphoto" style={{ maxWidth: 460, marginTop: 14 }}>
        <div className="dphoto-head"><h3>Telegram — verified account</h3><span>{u.telegram_verified ? "✓ linked" : "unlinked"}</span></div>
        {u.telegram_verified ? (
          <p className="ai-hint">Your Rent My Trailer account is linked to Telegram (@{u.telegram_handle || "your account"}). Booking alerts arrive free via the bot.</p>
        ) : (
          <>
            <p className="ai-hint">Verify instantly and free with Telegram — a bot DMs you a one-tap confirmation. No SMS needed.</p>
            <button className="bookbtn" onClick={tgVerify} disabled={busy}>{busy ? "…" : "Verify with Telegram"}</button>
            {tgMsg && <p className={tgMsg.ok ? "coupon-ok" : "coupon-no"}>{tgMsg.t}</p>}
          </>
        )}
      </div>
     </section>
  );
}
