import { useState, useEffect, useRef } from "react";
import { api, setToken, setUser, user, getToken } from "./api.js";


let clientConfig = null;
async function googleClientId() {
  if (!clientConfig) { try { clientConfig = await api("GET", "/api/config"); } catch { clientConfig = { google_client_id: null }; } }
  return { google_client_id: null, ...(clientConfig || {}) }.google_client_id;
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
  const finishSignIn = () => { onDone?.(); onClose?.(); location.reload(); };
  useEffect(() => { if (mode === "google") setMsg(""); setErr(""); }, [mode]);
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
        try { localStorage.setItem("rmt-founding-prompt", "1"); } catch {}
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
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {[["google", "Google"], ["email", "Email log in"], ["signup", "Sign up"]].map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: "8px 0", borderRadius: 8, cursor: "pointer", fontSize: 12.5, fontWeight: 700,
              border: "1px solid " + (mode === m ? "#f5b325" : "#30363d"),
              background: mode === m ? "linear-gradient(135deg,#f5b325,#ff9d00)" : "#0d1117",
              color: mode === m ? "#16181b" : "#8b949e",
            }}>{label}</button>
          ))}
        </div>
        <h2 className="sec-title">{mode === "google" ? "Welcome — quick sign up" : mode === "email" ? "Email log in" : mode === "signup" ? "Create account" : mode === "forgot" ? "Password reset" : "Two-factor"}</h2>
        {mode === "google" && (
          <div style={{ textAlign: "center", marginTop: 10 }}>
            <button className="gsi-fallback" onClick={() => { location.href = "/api/auth/google"; }}
              style={{ display: "inline-flex", width: "100%", justifyContent: "center", alignItems: "center", gap: 8, padding: "12px 0", borderRadius: 10, border: "1px solid #30363d", background: "#fff", color: "#1f1f1f", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 10 }}>
              <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.7 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.5 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-2.8-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6C44 38.6 46.5 32.5 46.5 24.5z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.9-6.2C1 16.5 0 20.2 0 24s1 7.5 2.6 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.6l-7.7-6c-2.1 1.4-4.8 2.3-7.6 2.3-6.3 0-11.6-4-13.5-9.7l-7.9 6.2C6.5 42.6 14.6 48 24 48z"/></svg>
              Continue with Google
            </button>
            <div style={{ color: "#8b949e", fontSize: 11, marginTop: 8 }}>Secure Google sign-in — returns you here automatically.</div>
          </div>
        )}

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
  const onHome = () => { const h = String(location.hash || ""); return !h || h === "#/" || h.startsWith("#/home"); };
  const [home, setHome] = useState(onHome());
  useEffect(() => {
    const on = () => setHome(onHome());
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);

  const [u, setU] = useState(() => { try { return user(); } catch { return null; } });
  // heal a stale cached role (e.g. promoted to admin after this device logged in)
  useEffect(() => {
    if (!getToken()) return;
    api("GET", "/api/auth/me").then((r) => { if (r?.user) { setUser(r.user); setU(r.user); } }).catch(() => {});
  }, [u]);
  const [btnGone, setBtnGone] = useState(false);
  // hide the Sign in chip when Google isn't configured on the server
  useEffect(() => {
    let dead = false;
    (async () => {
      const cid = await googleClientId().catch(() => null);
      if (!dead && !cid) setBtnGone(true);
    })();
    return () => { dead = true; };
  }, [u]);

  if (btnGone) return null;
  if (u && Object.keys(u || {}).length) return (
    <span className="acct acct-in" onClick={() => setOpen(!open)} title="Account">
      {u.picture ? <img className="acct-ava" src={u.picture} alt="" referrerPolicy="no-referrer" loading="lazy" /> : <span className="acct-ava" style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--char2,#222)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--amber)", fontSize: 11, fontWeight: 800 }}>{(u.display_name || u.email || "?")[0].toUpperCase()}</span>}'

        <b>{u.display_name || u.email || "Account"}</b>
        <small>{u.tier === "paid" ? "✦ paid" : "free"} · {(() => { const role = u.role || "user"; if (role === "admin") return "admin"; if (role === "owner" || u.owns_trailers) return "owner"; return "renter"; })()} · {u.email || ""}</small>
      {open && (
        <span className="acct-pop">
          <button onClick={() => { setOpen(false); location.hash = "#/settings"; }}>Settings</button>
          <button onClick={() => { localStorage.clear(); setU(null); setOpen(false); setBtnGone(false); location.hash = "#/home"; }}>Log out</button>
        </span>
      )}
    </span>
  );
  if (!home) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button className="gsi-fallback" onClick={() => dispatchEvent(new CustomEvent("rmt-auth", { detail: "google" }))}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 14px", borderRadius: 999, border: "1px solid #30363d", background: "#0d1117", color: "#f2f6fa", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
          <svg width="15" height="15" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.7 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.5 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-2.8-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6C44 38.6 46.5 32.5 46.5 24.5z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.9-6.2C1 16.5 0 20.2 0 24s1 7.5 2.6 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.6l-7.7-6c-2.1 1.4-4.8 2.3-7.6 2.3-6.3 0-11.6-4-13.5-9.7l-7.9 6.2C6.5 42.6 14.6 48 24 48z"/></svg>
          Sign in
        </button>
    </span>
  );
}