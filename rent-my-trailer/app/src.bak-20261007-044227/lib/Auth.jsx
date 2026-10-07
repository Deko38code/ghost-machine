import { useState, useEffect, useRef } from "react";
import { api, setToken, setUser, user } from "./api.js";

/* ─── Google Identity Services loader ─── */
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

async function googleClientId() {
  const c = await api("GET", "/api/config");
  return c.google_client_id || null;
}

async function googleSignIn(credential, done, fail) {
  try {
    const r = await api("POST", "/api/auth/google", { credential });
    setUser(r.user);
    setToken(r.token);
    done?.();
  } catch (ex) { fail?.(ex); }
}

const G_LOGO = (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

/* ─── branded Google button ─── */
export function GoogleButton({ onSignedIn, onError, mode = "login" }) {
  const [armed, setArmed] = useState(false);   // gsi script + initialize done
  const [busy, setBusy] = useState(false);
  const clientRef = useRef(null);

  useEffect(() => {
    let dead = false;
    (async () => {
      const cid = await googleClientId().catch(() => null);
      if (!cid || dead) return;
      try { await loadGsi(); } catch { return; }
      if (dead || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: cid,
        callback: (resp) => {
          setBusy(true);
          window.google.accounts.id.cancel();
          googleSignIn(resp.credential, () => { setBusy(false); onSignedIn?.(); }, (e) => { setBusy(false); onError?.(e.message); });
        },
      });
      clientRef.current = true;
      setArmed(true);
    })();
    return () => { dead = true; };
  }, []);

  const click = () => {
    if (armed) {
      // One-Tap chooser; if Google declines (rare) fall back to the full-page flow
      window.google.accounts.id.prompt((n) => {
        const shown = n && (n.isNotDisplayed() ? false : !n.isSkippedMoment?.());
        if (!shown) setTimeout(() => { if (!busy) location.href = "/api/auth/google"; }, 700);
      });
      return;
    }
    location.href = "/api/auth/google";   // redirect code flow as fallback
  };

  const hover = "0 2px 6px rgba(0,0,0,.18), 0 1px 3px rgba(0,0,0,.08)";
  const rest = "0 1px 2px rgba(0,0,0,.12), 0 1px 3px rgba(0,0,0,.06)";
  return (
    <button type="button" className="gauthbtn" onClick={click} disabled={busy}
      aria-label={busy ? "Signing in with Google" : (mode === "signup" ? "Continue with Google" : "Sign in with Google")}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
        width: "100%", padding: "11px 16px", cursor: "pointer", minHeight: 44,
        background: "#fff", color: "#1f1f1f", border: "1px solid #dadce0",
        borderRadius: 24, fontSize: 14.5, fontWeight: 500, letterSpacing: 0.2,
        boxShadow: busy ? rest : hover, // hover-by-default: white chip reads best on the dark card
        transition: "box-shadow .15s ease, transform .05s ease, opacity .15s ease",
        fontFamily: "'Roboto', system-ui, -apple-system, sans-serif",
        opacity: busy ? 0.7 : 1,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = hover)}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = rest)}
      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(.985)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "")}
      onMouseTouchStart={(e) => (e.currentTarget.style.transform = "scale(.985)")}
    >
      {G_LOGO}
      <span>{busy ? "Signing you in\u2026" : (mode === "signup" ? "Continue with Google" : "Sign in with Google")}</span>
    </button>
  );
}

export function AuthModal({ onDone, onClose, action = "login" }) {
  const [mode, setMode] = useState(action);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleOn, setGoogleOn] = useState(false);

  useEffect(() => {
    googleClientId().then((cid) => cid && setGoogleOn(true)).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      let r;
      if (mode === "signup") {
        r = await api("POST", "/api/auth/signup", { email, password, display_name: name });
      } else {
        r = await api("POST", "/api/auth/login", { email, password });
      }
      setUser(r.user);
      setToken(r.token);
      onDone?.();
      onClose?.();
    } catch (ex) { setErr(ex.message); }
    setBusy(false);
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="sec-title">{mode === "signup" ? "Create account" : "Log in"}</h2>
        {googleOn && <>
          <GoogleButton mode={mode} onSignedIn={() => { onDone?.(); onClose?.(); }} onError={setErr} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0", color: "var(--muted)", fontSize: 12 }}>
            <span style={{ flex: 1, height: 1, background: "var(--line)" }} />or with email<span style={{ flex: 1, height: 1, background: "var(--line)" }} />
          </div>
        </>}
        <form onSubmit={submit} className="bookform">
          {mode === "signup" && (
            <label>Display name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Deko" /></label>
          )}
          <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
          <label>Password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min 8 chars" /></label>
          {err && <p className="coupon-no">{err}</p>}
          <button className="bookbtn" disabled={busy}>{busy ? "…" : mode === "signup" ? "Sign up" : "Log in"}</button>
        </form>
        <p className="ai-hint" style={{ marginTop: 8 }}>
          {mode === "signup" ? "Already have one? " : "New here? "}
          <a href="#/" onClick={(e) => { e.preventDefault(); setMode(mode === "signup" ? "login" : "signup"); }} style={{ color: "var(--amber)" }}>
            {mode === "signup" ? "log in" : "create account"}
          </a>
        </p>
      </div>
    </div>
  );
}

export function AccountChip() {
  const [u, setU] = useState(user());
  const [open, setOpen] = useState(false);
  if (u) return (
    <span className="acct" onClick={() => setOpen(!open)} title="Account">
      <b>{u.display_name}</b>
      <small>{u.tier === "paid" ? "✦ paid" : "free"} · {u.role}</small>
      {open && (
        <span className="acct-pop">
          <button onClick={() => { localStorage.clear(); setU(null); setOpen(false); location.hash = "#/home"; }}>Log out</button>
        </span>
      )}
    </span>
  );
  return (
    <button className="navlink loginbtn" onClick={() => { dispatchEvent(new CustomEvent("rmt-auth", { detail: "login" })); }}>
      Log in
    </button>
  );
}

// keep the old helper name importable for any other callers
export { loadGsi };