import { useEffect, useState } from "react";
import { routes } from "./router.jsx";
import { user } from "./lib/api.js";
import rmtBadge from "./assets/rmt-badge.webp";
import AiWidget from "./components/AiWidget.jsx";
import { AuthModal } from "./lib/Auth.jsx";
import { AccountChip } from "./lib/Auth.jsx";
import Bookings from "./lib/Bookings.jsx";
import Confirmation from "./pages/Confirmation.jsx";
import Intro from "./components/Intro.jsx";
import Home from "./pages/Home.jsx";
import Browse from "./pages/Browse.jsx";
import Detail from "./pages/Detail.jsx";
import Messages from "./pages/Messages.jsx";
import Deposit from "./pages/Deposit.jsx";
import Post from "./pages/Post.jsx";
import Settings from "./pages/Settings.jsx";
import Admin from "./pages/Admin.jsx";
import Reset from "./pages/Reset.jsx";
import badge from "./assets/rmt-badge.jpg";

let _rmtInstallEvt = null;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); _rmtInstallEvt = e; });
function InstallChip() {
  const [ready, setReady] = useState(!!_rmtInstallEvt);
  useEffect(() => {
    const t = setInterval(() => setReady(!!_rmtInstallEvt), 1500);
    return () => clearInterval(t);
  }, []);
  return ready ? (
    <button onClick={_rmtInstallEvt?.prompt ? () => _rmtInstallEvt.prompt() : undefined}
      style={{ color: "var(--amber)", fontWeight: 700, fontSize: 12, background: "none", border: 0, cursor: "pointer", padding: "3px 0", letterSpacing: ".05em", textAlign: "left" }}>
      📲 Install the app
    </button>
  ) : null;
}

/* referral landing: #/r/<code> — stash the code, land home */
function RefGate({ route }) {
  useEffect(() => {
    try {
      if (route.param) localStorage.setItem("rmt-ref", String(route.param).toUpperCase());
    } catch {}
    location.replace("#/home");
  }, [route.param]);
  return (
    <div className="page"><h1 className="sec-title">Invite accepted</h1><p className="sec-sub">Setting up your $5 welcome credit…</p></div>
  );
}
const PAGES = { admin: Admin, home: Home, browse: Browse, detail: Detail, messages: Messages, deposit: Deposit, post: Post, bookings: Bookings, settings: Settings, reset: Reset, r: RefGate };
const fLink = { display: "block", color: "var(--muted)", fontSize: 13, padding: "3px 0", textDecoration: "none", cursor: "pointer" };

/* ─── first-signup onboarding: avatar + bio, 2 quick taps ── */
function Onboarding({ u, onDone }) {
  const [bio, setBio] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState((localStorage.getItem("rmt-user") && JSON.parse(localStorage.getItem("rmt-user")).picture) || "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("bio", bio);
      if (file) fd.append("avatar", file);
      const r = await fetch("/api/profile", { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("rmt-token") || ""}` }, body: fd });
      if (r.ok) {
        const j = await r.json().catch(() => ({}));
        try { localStorage.setItem("rmt-user", JSON.stringify({ ...JSON.parse(localStorage.getItem("rmt-user") || "{}"), bio, picture: j.user.picture || preview })); } catch {}
      }
    } catch {}
    localStorage.setItem("rmt-onboarded", "1");
    onDone();
  };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 22000, background: "rgba(5,7,10,.93)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 26, textAlign: "center" }}>
      <img src={file ? preview : (u.picture || preview || rmtBadge)} alt="avatar preview" style={{ width: 104, height: 104, borderRadius: "50%", objectFit: "cover", boxShadow: "0 8px 30px rgba(0,0,0,.6), 0 0 40px rgba(245,179,37,.3)" }} onError={(e) => { if (u.picture) e.currentTarget.src = u.picture; }} />
      <div style={{ color: "var(--amber)", fontWeight: 800, letterSpacing: ".14em", fontSize: 12, margin: "16px 0 4px" }}>WELCOME{u.promo_rank ? ` — FOUNDING MEMBER #${u.promo_rank}` : ""}</div>
      <h2 style={{ color: "#f2f6fa", fontSize: 24, fontWeight: 900, margin: "0 0 16px" }}>Let's set up your profile</h2>
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <label style={{ cursor: "pointer", border: "1px solid var(--line)", background: "var(--asphalt)", borderRadius: 10, padding: "9px 14px", fontSize: 12.5, color: "var(--paper)" }}>
          {file ? "📷 change photo" : "📷 add a profile photo"}
          <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setPreview(URL.createObjectURL(f)); } }} />
        </label>
        {!u.picture && !file && <small style={{ color: "var(--muted)", alignSelf: "center" }}>optional — renters trust faces</small>}
      </div>
      <textarea rows="2" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="One line about you (how you haul, what you rent...) — shows on your listings" style={{ maxWidth: 440, width: "100%", background: "var(--asphalt)", border: "1px solid var(--line)", color: "var(--paper)", padding: 10, borderRadius: 10, fontSize: 13 }} />
      <button onClick={save} disabled={busy} style={{ marginTop: 14, padding: "12px 34px", borderRadius: 24, border: 0, background: "linear-gradient(135deg,#f5b325,#ff9d00)", color: "#16181b", fontWeight: 900, fontSize: 14, cursor: "pointer" }}>{busy ? "saving…" : "Save — let's haul →"}</button>
      <button onClick={() => { localStorage.setItem("rmt-onboarded", "1"); onDone(); }} style={{ marginTop: 10, background: "none", border: 0, color: "#8b949e", fontSize: 12, cursor: "pointer" }}>skip for now</button>
    </div>
  );
}
/* ─── founding-member prompt: first 1000 — card required, month one free ── */
function FoundingPrompt({ onClose }) {
  const [cnt, setCnt] = useState(null);
  useEffect(() => {
    fetch("/api/member-count").then((r) => r.json()).then(setCnt).catch(() => {});
    const t = setInterval(() => fetch("/api/member-count").then((r) => r.json()).then(setCnt).catch(() => {}), 30000);
    return () => clearInterval(t);
  }, []);
  if (cnt && cnt.remaining <= 0) { onClose(); return null; }
  const claim = () => { try { localStorage.removeItem("rmt-founding-prompt"); } catch {}; location.hash = "#/membership"; onClose(); };
  const row = { display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, color: "#d5dbe2", textAlign: "left", lineHeight: 1.45 };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 21000, background: "rgba(5,7,10,.93)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
      <div style={{ maxWidth: 520, width: "100%", background: "#0d1117", border: "2px solid #f5b325", borderRadius: 18, padding: "26px 26px 20px", boxShadow: "0 14px 50px rgba(0,0,0,.6)" }}>
        <div style={{ color: "var(--amber,#f5b325)", fontWeight: 800, letterSpacing: ".16em", fontSize: 12 }}>
          🔓 FOUNDING MEMBER — {cnt ? `${cnt.claimed}/1000 CLAIMED (LIVE)` : "/1000 CLAIMED — LIVE COUNTER"}
        </div>
        <h2 style={{ color: "#f2f6fa", fontSize: 26, fontWeight: 900, margin: "10px 0 14px" }}>Your bonus: first month free</h2>
        <div style={{ display: "grid", gap: 10, margin: "0 auto 16px", maxWidth: 460 }}>
          <div style={row}><span>💳</span><span><b style={{ color: "#f2f6fa" }}>Credit card required to sign</b> — cards are verified to claim the founding rate. Nothing is charged for month one.</span></div>
          <div style={row}><span>💸</span><span><b style={{ color: "#f2f6fa" }}>You must pay rental fees before pickup</b> — and a booking deposit is required before pickup (returned in full after a clean handover).</span></div>
          <div style={row}><span>⚖️</span><span><b style={{ color: "#f2f6fa" }}>10% platform fee</b> on rental fees — owners keep 90%. The fee is never taken out of your deposit.</span></div>
          <div style={row}><span>🛡️</span><span>Trailer insurance available via <b style={{ color: "#f2f6fa" }}>Jerry</b> (3rd-party, optional).</span></div>
        </div>
        <button onClick={claim} style={{ width: "100%", padding: "13px 0", borderRadius: 24, border: 0, background: "linear-gradient(135deg,#f5b325,#ff9d00)", color: "#16181b", fontWeight: 900, fontSize: 15, cursor: "pointer" }}>
          ADD CARD → CLAIM MY FREE MONTH
        </button>
        <button onClick={onClose} style={{ marginTop: 10, background: "none", border: 0, color: "#8b949e", fontSize: 12, cursor: "pointer" }}>maybe later</button>
      </div>
    </div>
  );
}


function MaintBanner() {
  const [st, setSt] = useState(null);
  useEffect(() => {
    let dead = false;
    const load = () => fetch("/api/site-status").then((r) => r.json()).then((d) => { if (!dead) setSt(d); }).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => { dead = true; clearInterval(t); };
  }, []);
  if (!st?.on) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", background: "linear-gradient(90deg,#1c1400,#2a1c00)", borderBottom: "2px solid #f5b325", flexWrap: "wrap" }}>
      <img src={badge} alt="" style={{ width: 52, height: 52, borderRadius: "50%", boxShadow: "0 0 18px rgba(245,179,37,.35)" }} />
      <div>
        <b style={{ color: "#f5b325", fontWeight: 800, letterSpacing: ".12em", fontSize: 12 }}>{st.title || "MEMBERS' YARD — LIVE"}</b>
        <div style={{ color: "#f2f6fa", fontSize: 13 }}>{st.msg || st.message || ""}</div>
      </div>
    </div>
  );
}

function PlanCard() {
  const [p, setP] = useState(null);
  const [count, setCount] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch("/api/pricing").then((r) => r.json()).then(setP).catch(() => {});
    fetch("/api/member-count").then((r) => r.json()).then(setCount).catch(() => {});
  }, []);
  const start = async () => {
    try {
      const token = localStorage.getItem("rmt-token") || "";
      const r = await fetch("/api/auth/upgrade/start", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ sid: "membership" }) });
      const j = await r.json();
      if (j.url) { location.href = j.url; return; }
      throw new Error(j.error || "checkout unavailable");
    } catch (e) { setErr(e.message); }
  };
  return (
    <div style={{ maxWidth: 440, margin: "0 auto", border: "2px solid #f5b325", borderRadius: 16, background: "#0d1117", padding: "22px 26px", boxShadow: "0 10px 40px rgba(0,0,0,.45)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <img src={badge} alt="" style={{ width: 44, height: 44, borderRadius: "50%" }} />
        <b style={{ color: "#f5b325", letterSpacing: ".14em", fontSize: 12 }}>PREMIUM MEMBERSHIP</b>
      </div>
      {p && (
        <>
          <div style={{ color: "#f2f6fa", fontSize: 34, fontWeight: 900 }}>
            ${p.monthly_incl_tax}<span style={{ fontSize: 15, color: "#8b949e", fontWeight: 600 }}> /month — tax included</span>
          </div>
          <div style={{ color: "#8b949e", fontSize: 12, marginTop: 4 }}>Base ${p.monthly} + {(p.tax_rate * 100).toFixed(2)}% tax — baked in, live-watched</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
            <div style={{ border: "1px solid #2a2e35", borderRadius: 10, padding: "8px 10px" }}>
              <div style={{ color: "#8b949e", fontSize: 11 }}>+ refundable deposits per rental</div>
            </div>
            <div style={{ border: "1px solid #2a2e35", borderRadius: 10, padding: "8px 10px" }}>
              <div style={{ color: "#8b949e", fontSize: 11, letterSpacing: ".1em" }}>OWNERS EARN</div>
              <div style={{ color: "#f2f6fa", fontWeight: 800 }}>{(100 - (p.owner_fee_pct ?? 10)).toFixed(0)}% of every rental</div>
            </div>
          </div>
        </>
      )}
      <ul style={{ color: "#c9d1d9", fontSize: 13, lineHeight: 1.7, paddingLeft: 18, margin: "12px 0" }}>
        {p?.perks?.map((x) => <li key={x}>{x}</li>)}
      </ul>
      {count && (
        <div style={{ color: "#f5b325", fontSize: 12, fontWeight: 800, marginBottom: 10 }}>
          {count.claimed}/1000 premium in — {count.remaining} free-month slots remain (first-1000: card required, nothing charged for month one)
        </div>
      )}
      {err && <div style={{ color: "#ff5c1a", fontSize: 12, marginBottom: 8 }}>{err}</div>}
      <button onClick={start} style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: 0, background: "linear-gradient(135deg,#f5b325,#ff9d00)", color: "#16181b", fontWeight: 900, fontSize: 15, cursor: "pointer" }}>
        {count?.remaining > 0 ? "Claim free first month — add card" : "Go premium"}
      </button>
      <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 10, lineHeight: 1.6 }}>
        Cancel anytime — free cancellation before pickup; after pickup deposit rules apply. Owners: 10% platform fee only on completed rentals.
      </div>
    </div>
  );
}

/* ─── profile completion % — used on chip + leaderboard (top rankers) ── */
export function completionScore(u) {
  if (!u) return 0;
  let got = 0, total = 6;
  if (u.email) got++;
  if (u.picture || u.avatar_file) got++;
  if (u.bio && String(u.bio).length >= 40) got += 2;
  else if (u.bio) got++;
  if (u.phone) got++;
  if (u.phone_verified) got++;
  return Math.round((got / total) * 100);
}
function TopRankers() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    fetch("/api/profile/top").then((r) => r.json()).then((d) => setRows(d.rows || [])).catch(() => {});
  }, []);
  if (!rows || !rows.length) return null;
  return (
    <div className="strip-like" style={{ display: "flex", gap: 10, overflowX: "auto", padding: "2px 0 10px" }}>
      {rows.map((u, i) => (
        <div key={u.id} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 10, background: "var(--asphalt)", border: "1px solid var(--line)", borderRadius: 12, padding: "8px 14px", minWidth: 210 }}>
          <span style={{ color: "var(--amber)", fontWeight: 900, fontSize: 16 }}>#{i + 1}</span>
          {u.picture ? (
            <img src={u.picture} alt="" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            <img src={rmtBadge} alt="" style={{ width: 30, height: 30, borderRadius: "50%" }} />
          )}
          <span style={{ display: "flex", flexDirection: "column" }}>
            <b style={{ color: "#f2f6fa", fontSize: 13 }}>{u.display_name || u.email?.split("@")[0]}</b>
            <small style={{ color: "var(--muted)", fontSize: 11 }}>{u.bio ? (u.bio.slice(0, 30) + (u.bio.length > 30 ? "…" : "") + " · ") : ""}{u.score}% ranked</small>
          </span>
        </div>
      ))}
    </div>
  );
}
export default function App() {
  const [authOpen, setAuthOpen] = useState(false);
  const [onbDone, setOnbDone] = useState(false);
  const [foundingOpen, setFoundingOpen] = useState(() => { try { return localStorage.getItem("rmt-founding-prompt") === "1"; } catch { return false; } });
  const maybeFounding = () => {
    try {
      const open = localStorage.getItem("rmt-founding-prompt") === "1";
      if (open) { localStorage.removeItem("rmt-founding-prompt"); setFoundingOpen(true); }
    } catch {}
  };
  useEffect(() => {
    const on = (e) => setAuthOpen(true);
    addEventListener("rmt-auth", on);
    return () => removeEventListener("rmt-auth", on);
  }, []);
  useEffect(() => { maybeFounding(); }, [authOpen]);
  /* auto logout after 30 min idle */
  useEffect(() => {
    const LIMIT = 30 * 60 * 1000;
    let timer;
    const evt = ["mousemove", "keydown", "wheel", "touchstart", "scroll", "click"];
    const reset = () => { clearTimeout(timer); timer = setTimeout(() => {
      if (localStorage.getItem("rmt-token")) {
        try { localStorage.clear(); } catch {}
        location.hash = "#/home";
        dispatchEvent(new CustomEvent("rmt-autologout"));
        location.reload();
      }
    }, LIMIT); };
    evt.forEach((e) => addEventListener(e, reset, { passive: true }));
    reset();
    return () => { evt.forEach((e) => removeEventListener(e, reset)); clearTimeout(timer); };
  }, []);
  const [route, setRoute] = useState(() => routes.parse(location.hash));
  useEffect(() => {
    const onHash = () => setRoute(routes.parse(location.hash));
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => { scrollTo(0, 0); }, [route.name, route.param]);

  const showPlans = route.name === "membership";
  const Page = PAGES[route.name] || Home;
  const active = (n) => (route.name === n ? " navlink active" : " navlink");
  return (
    <div className="shell">
      {!(() => {
        try {
          const u = JSON.parse(localStorage.getItem("rmt-user") || "null");
          return u && u.tier && !u.bio && !localStorage.getItem("rmt-onboarded");
        } catch { return false; }
      })() && <Intro />}
      <MaintBanner />
      <header className="topbar">
        <a className="brand" href="#/home">
          <img src={rmtBadge} alt="Rent My Trailer" style={{ width: 68, height: 68, borderRadius: "50%", display: "block" }} />
          <span className="brand-word">Rent My <em>Trailer</em></span>
        </a>
        <nav>
          <a className={active("browse")} href="#/browse">Browse Trailers</a>
          <a className={active("deposit")} href="#/deposit">Deposits</a>
          <a className={active("messages")} href="#/messages">Messages</a>
          <a className={active("post")} href="#/post">List Your Trailer</a>
          <a className={active("bookings")} href="#/bookings">Bookings</a>
        </nav>
        <AccountChip />
          {user()?.role === "admin" && <a className={active("admin")} href="#/admin">🛡️ Admin</a>}
      </header>

      <main>
        {showPlans ? (
          <div className="page">
            <p className="sec-sub">Premium unlocks sharing, priority booking and fleet deals. Tax-in pricing — owners keep 90%.</p>
            <PlanCard />
          </div>
        ) : (
          <>
            <Page route={route} />
            {route.name === "home" && <div className="page"><TopRankers /></div>}
          </>
        )}
      </main>

      <footer className="sitefoot">
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "30px 24px 4px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px 24px" }}>
          <div>
            <div style={{ color: "var(--muted)", fontSize: 11, letterSpacing: ".16em", fontWeight: 700, marginBottom: 10 }}>RENT</div>
            <a href="#/browse" style={fLink}>Browse trailers</a>
            <a href="#/post" style={fLink}>List your trailer</a>
            <a href="#/membership" style={fLink}>Premium plans</a>
          </div>
          <div>
            <div style={{ color: "var(--muted)", fontSize: 11, letterSpacing: ".16em", fontWeight: 700, marginBottom: 10 }}>ACCOUNT</div>
            <a href="#/bookings" style={fLink}>Bookings</a>
            <a href="#/messages" style={fLink}>Messages</a>
            <a href="#/deposit" style={fLink}>Deposits</a>
          </div>
          <div>
            <div style={{ color: "var(--muted)", fontSize: 11, letterSpacing: ".16em", fontWeight: 700, marginBottom: 10 }}>PROTECT</div>
            <a href="https://www.getjerry.com/" target="_blank" rel="noreferrer" style={fLink}>Trailer insurance — Jerry</a>
            <button onClick={() => fetch("/api/donate").then((r) => r.json()).then((d) => { if (d.url) location.href = d.url; }).catch(() => {})} style={{ ...fLink, background: "none", border: 0, textAlign: "left", cursor: "pointer" }}>Support the yard</button>
            <a href="#/membership" style={fLink}>Membership</a>
          </div>
          <div>
            <div style={{ color: "var(--muted)", fontSize: 11, letterSpacing: ".16em", fontWeight: 700, marginBottom: 10 }}>COMPANY</div>
            <a href="https://haksterai.com" target="_blank" rel="noreferrer" style={fLink}>HaksterAI</a>
            <a href="#/home" style={fLink}>rmt.haksterai.com</a>
            <InstallChip />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "0 22px 16px", fontSize: 12, color: "var(--muted)", flexWrap: "wrap" }}>
          <img src="/logo.png" alt="HaksterAI — Hack smarter. AI stronger." style={{ width: 92, height: "auto", borderRadius: 10, display: "block", opacity: 0.9 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span>Built by</span>
            <a href="https://haksterai.com" target="_blank" rel="noreferrer" style={{ color: "var(--amber)", fontWeight: 700, letterSpacing: ".05em" }}>HaksterAI</a>
            <span>· Powered by</span>
            <a href="https://haksterai.com" target="_blank" rel="noreferrer" style={{ color: "var(--paper)" }}>haksterai.com</a>
          </div>
        </div>
        <div style={{ borderTop: "1px solid var(--line)", marginTop: 20, padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <span style={{ color: "var(--muted)", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
            © {new Date().getFullYear()} Rent My Trailer — powered by
            <a href="https://haksterai.com" target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none" }}>
              <img src="/logo.png" alt="haksterAi" width={16} height={16} style={{ borderRadius: 4 }} loading="lazy" />
              <span style={{ color: "var(--amber)", fontWeight: 700 }}>HaksterAI</span>
            </a>
          </span>
          <span style={{ color: "var(--muted)", fontSize: 11, letterSpacing: ".06em" }}>HAUL MORE · PAY LESS · GO FURTHER</span>
        </div>
      </footer>
      <AiWidget onListingDraft={(d) => { location.hash = "#/post"; dispatchEvent(new CustomEvent("rmt-ai-listing", { detail: d })); }} />
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
      {(() => {
        const u0 = (() => { try { return JSON.parse(localStorage.getItem("rmt-user") || "null"); } catch { return null; } })();
        const need = !onbDone && u0 && u0.tier && !u0.bio && !localStorage.getItem("rmt-onboarded");
        return need ? <Onboarding u={u0} onDone={() => { setOnbDone(true); localStorage.setItem("rmt-onboarded", "1"); }} /> : null;
      })()}
      {foundingOpen && <FoundingPrompt onClose={() => setFoundingOpen(false)} />}
    </div>
  );
}