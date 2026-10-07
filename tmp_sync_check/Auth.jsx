import { useState, useEffect, useRef } from "react";
import { api, setToken, setUser, user } from "./api.js";
import rmtBadge from "../assets/rmt-badge.webp";

let gsiPromise = null;
function loadGsi() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gsiPromise) gsiPromise = new Promise((ok, bad) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.onload = ok; s.onerror = () => bad(new Error("failed to load Google script"));
    document.head.appendChild(s);
  });
  return gsiPromise;
}

let clientConfig = null;
async function googleClientId() {
  if (!clientConfig) { try { clientConfig = await api("GET", "/api/config"); } catch { clientConfig = { google_client_id: null }; } }
  return { google_client_id: null, ...(clientConfig || {}) }.google_client_id;
}

async function googleSignIn(credential, done, fail) {
  try {
    let refCode = null;
    try { refCode = localStorage.getItem("rmt-ref"); } catch {}
    const r = await api("POST", "/api/auth/google", { credential, ref: refCode });
    if (r.referral) { try { localStorage.setItem("rmt-my-ref", JSON.stringify(r.referral)); localStorage.removeItem("rmt-ref"); } catch {} }
    const u = r.user || {};
    try {
      const parts = String(credential).split(".");
      const pl = parts.length === 3 ? JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) : null;
      if (pl) { u.picture = pl.picture || ""; u.email = pl.email || ""; }
    } catch {}
    try {
      localStorage.setItem("rmt-user", JSON.stringify({ ...u, picture: u.picture || (user() || {}).picture || "", email: u.email || (user() || {}).email || "" }));
    } catch {}
    setUser(u);
    setToken(r.token);
    done?.(u);
  } catch (ex) { fail?.(ex); }
}

export function AuthModal({ onDone, onClose }) {
  const [mode, setMode] = useState("google");          // google | email | signup | forgot | 2fa
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [gsiOn, setGsiOn] = useState(false);
  const gsiDiv = useRef(null);
  const finishSignIn = () => { onDone?.(); onClose?.(); location.reload(); };
  useEffect(() => { if (mode === "google") setMsg(""); setErr(""); }, [mode]);
  useEffect(() => {
    let dead = false;
    (async () => {
      const cid = await googleClientId().catch(() => null);
      if (dead) return;
      if (!cid) { if (!dead) setGsiOn(true); return; }
      try { await loadGsi(); } catch { return; }
      if (dead || !window.google?.accounts?.id || !gsiDiv.current) return;
      window.google.accounts.id.initialize({
        client_id: cid,
        callback: (resp) => {
          if (!dead && resp && resp.credential) {
            setBusy(true); setErr("");
            googleSignIn(resp.credential, finishSignIn, (ex) => { setErr(ex.message || String(ex)); setBusy(false); });
          }
        },
      });
      window.google.accounts.id.renderButton(gsiDiv.current, { theme: "outline", size: "large", text: "continue_with", shape: "pill", logo_alignment: "left" });
      if (!dead) setGsiOn(true);
    })();
    return () => { dead = true; };
  }, []);
  // the Google button re-renders into whichever card is showing (log in or sign up)
  useEffect(() => {
    let dead = false;
    (async () => {
      const cid = await googleClientId().catch(() => null);
      if (!cid || dead) return;
      if (mode !== "google" && mode !== "signup") return;
      try { await loadGsi(); } catch { return; }
      if (dead || !window.google?.accounts?.id || !gsiDiv.current) return;
      window.google.accounts.id.renderButton(gsiDiv.current, { theme: "outline", size: "large", text: "continue_with", shape: "pill", logo_alignment: "left" });
      if (!dead) setGsiOn(true);
    })();
    return () => { dead = true; };
  }, [mode]);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(""); setMsg("");
    try {
      if (mode === "email") {
        const r = await api("POST", "/api/auth/login", { email, password });
        if (r.need2fa) { setChallenge(r.challenge); setMode("2fa"); setBusy(false); return; }
        setUser(r.user); setToken(r.token); return finishSignIn();
      }
      if (mode === "signup") {
        let refCode = null;
        try { refCode = localStorage.getItem("rmt-ref"); } catch {}
        const r = await api("POST", "/api/auth/signup", { email, password, display_name: name, ref: refCode });
        try { localStorage.removeItem("rmt-ref"); } catch {}
        setUser(r.user); setToken(r.token); return finishSignIn();
      }
      if (mode === "forgot") {
        const r = await api("POST", "/api/auth/forgot", { email });
        setMsg("That email may need email login: " + (r.devLink || "check your inbox — a reset link works for 30 minutes."));
        setBusy(false); return;
      }
      if (mode === "2fa") {
        const r = await api("POST", "/api/auth/login/verify", { challenge, code });
        setUser(r.user); setToken(r.token); return finishSignIn();
      }
    } catch (ex) { setErr(ex.message); }
    setBusy(false);
  };
  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="sec-title">{mode === "email" ? "Email log in" : mode === "signup" ? "Create account" : mode === "forgot" ? "Password reset" : mode === "2fa" ? "Two-factor" : "Log in"}</h2>
        {(mode === "google" || mode === "signup") && !!gsiOn && (
          <div style={{ textAlign: "center", marginTop: 10 }}>
            <div ref={gsiDiv}></div>
          </div>
        )}
        {mode === "google" && (
          <p className="ai-hint" style={{ marginTop: 10 }}>
            <a href="#/" onClick={(e) => { e.preventDefault(); setMode("email"); }}>or log in with email</a> · <a href="#/" onClick={(e) => { e.preventDefault(); setMode("signup"); }}>create account</a>
          </p>
        )}
        {mode === "signup" && <p className="ai-hint" style={{ marginTop: 8 }}>or sign up with email ↓</p>}

        {mode !== "google" && (
          <form onSubmit={submit} className="bookform">
            {mode === "signup" && <label>Display name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Deko" /></label>}
            {mode !== "2fa" && <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@host.com" /></label>}
            {mode !== "forgot" && mode !== "2fa" && <label>Password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></label>}
            {mode === "2fa" && (
              <label>6-digit code from Duo / authenticator<input inputMode="numeric" pattern="[0-9]*" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" /></label>
            )}
            {(msg || err) && <p className={err ? "coupon-no" : "ai-hint"}>{err || msg}</p>}
            <button className="bookbtn" disabled={busy}>{busy ? "…" : mode === "signup" ? "Sign up" : mode === "forgot" ? "Send reset link" : mode === "2fa" ? "Verify" : "Log in"}</button>
            <p className="ai-hint" style={{ marginTop: 2 }}>
              {mode === "email" && <a href="#/" onClick={(e) => { e.preventDefault(); setMode("forgot"); }}>Forgot password?</a>}
              {(mode === "email" || mode === "signup") && " · "}
              {mode === "signup" && <a href="#/" onClick={(e) => { e.preventDefault(); setMode("email"); }}>have an account? log in</a>}
              {mode === "forgot" && <a href="#/" onClick={(e) => { e.preventDefault(); setMode("email"); }}>back to log in</a>}
              {mode === "2fa" && <a href="#/" onClick={(e) => { e.preventDefault(); setMode("google"); }}>other ways to log in</a>}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

/* Header account area: Google button fades out on sign-in; profile chip fades in */
export function AccountChip() {
  const [u, setU] = useState(() => { try { return user(); } catch { return null; } });
  const [open, setOpen] = useState(false);
  const [btnGone, setBtnGone] = useState(false);
  const gsiNav = useRef(null);

  const signedIn = (uObj) => {
    if (gsiNav.current) {
      const el = gsiNav.current;
      el.style.transition = "opacity .4s ease";
      el.style.opacity = "0";
      setTimeout(() => setBtnGone(true), 400);
    } else {
      setBtnGone(true);
    }
    setU((uObj && Object.keys(uObj).length) ? uObj : (user() || null));
  };

  useEffect(() => {
    let dead = false;
    (async () => {
      const cid = await googleClientId().catch(() => null);
      if (dead) return;
      if (!cid) { if (!dead) setBtnGone(true); return; }
      try { await loadGsi(); } catch { return; }
      if (dead || (user() && user().display_name) || !window.google?.accounts?.id || !gsiNav.current) return;
      window.google.accounts.id.initialize({
        client_id: cid,
        callback: (resp) => {
          if (resp && resp.credential) googleSignIn(resp.credential, (uu) => signedIn(uu), () => {});
        },
      });
      window.google.accounts.id.renderButton(gsiNav.current, { theme: "outline", size: "medium", text: "signin_with", shape: "pill", logo_alignment: "left" });
      if (!dead) setGsiOn(true);
    })();
    return () => { dead = true; };
  }, [u]);

  if (u && Object.keys(u || {}).length) return (
    <span className="acct acct-in" onClick={() => setOpen(!open)} title="Account">
      {u.picture ? <img className="acct-ava" src={u.picture} alt="" referrerPolicy="no-referrer" loading="lazy" /> : <img className="acct-ava" src={rmtBadge} alt="" style={{ width: 26, height: 26, borderRadius: "50%", display: "block", objectFit: "cover" }} />}
      <span className="acct-txt">
        <b>{u.display_name || u.email || "Account"}</b>
        <small>{u.tier === "paid" ? "✦ paid" : "free"} · {u.role || "user"}</small>
      </span>
      {open && (
        <span className="acct-pop">
          <button onClick={() => { setOpen(false); location.hash = "#/settings"; }}>Settings</button>
          <button onClick={() => { localStorage.clear(); setU(null); setOpen(false); setBtnGone(false); location.hash = "#/home"; }}>Log out</button>
        </span>
      )}
    </span>
  );
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span ref={gsiNav}></span>
      {btnGone && (
        <button className="gsi-fallback" onClick={() => dispatchEvent(new CustomEvent("rmt-auth"))}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 14px", borderRadius: 999, border: "1px solid #30363d", background: "#0d1117", color: "#f2f6fa", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
          <svg width="15" height="15" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.7 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.5 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-2.8-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6C44 38.6 46.5 32.5 46.5 24.5z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.9-6.2C1 16.5 0 20.2 0 24s1 7.5 2.6 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.6l-7.7-6c-2.1 1.4-4.8 2.3-7.6 2.3-6.3 0-11.6-4-13.5-9.7l-7.9 6.2C6.5 42.6 14.6 48 24 48z"/></svg>
          Sign in
        </button>
      )}
    </span>
  );
}