import { useState, useEffect } from "react";

const SLIDES = [
  { kicker: "WELCOME TO THE YARD", text: "Rent My Trailer", sub: "GPS-verified handovers · real deposits · real payouts" },
  { kicker: "LIST IT", text: "Your trailer can pay for itself", sub: "Snap pics, set prices, earn daily while you're not hauling" },
  { kicker: "RENT IT", text: "Book by the day, week or month", sub: "Coupon codes, deposits held safely, pickup pin verification" },
  { kicker: "1,000 SLOTS ONLY", text: "Founding member month", sub: "First 1,000 premium members: card required, month one free" },
];

let _introSeen = false;
function finish() {
  try { localStorage.setItem("rmt-intro-seen", "1"); } catch {}
  _introSeen = true;
}

export default function Intro() {
  const [idx, setIdx] = useState(0);
  const [gone, setGone] = useState(_introSeen || (() => { try { return localStorage.getItem("rmt-intro-seen") === "1"; } catch { return false; } })());
  const [slots, setSlots] = useState(null);
  const s = SLIDES[idx];
  const last = idx === SLIDES.length - 1;
  useEffect(() => {
    if (gone) return;
    const load = () => fetch("/api/member-count").then((r) => r.json()).then(setSlots).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    addEventListener("wheel", stop, { passive: false });
    return () => { clearInterval(t); removeEventListener("wheel", stop); };
  }, [gone]);
  if (gone || !s) return null;
  return (
    <div
      onClick={() => { if (last) { finish(); setGone(true); } else setIdx(idx + 1); }}
      style={{
        position: "fixed", inset: 0, zIndex: 20000,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        cursor: "pointer", padding: "14px 24px 10px", textAlign: "center",
      }}
    >

      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 120% at 50% 20%, rgba(28,33,40,.88) 0%, rgba(12,15,20,.94) 55%, rgba(5,7,10,.97) 100%)" }} />
      {/* yellow logo animation — slides play over it */}
      <div aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg
          viewBox="0 0 64 64"
          style={{
            width: "clamp(140px, 30vw, 320px)",
            height: "clamp(140px, 30vw, 320px)",
            filter: "drop-shadow(0 20px 60px rgba(245,179,37,.35))",
            animation: "rmtLogoPulse 4s ease-in-out infinite"
          }}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="64" height="64" rx="6" fill="#16181b" />
          <path d="M0 0 L18 0 L0 18 Z" fill="#f5b325" />
          <rect x="10" y="24" width="34" height="20" rx="2" fill="#f5b325" />
          <rect x="10" y="24" width="34" height="6" rx="1" fill="#c98f0a" />
          <path d="M15 24v20 M21 24v20 M27 24v20 M33 24v20 M39 24v20" stroke="#16181b" stroke-width="1.6" opacity="0.85" />
          <circle cx="17" cy="47" r="4.4" fill="#f4f1ea" stroke="#16181b" stroke-width="1.4" />
          <circle cx="17" cy="47" r="1.6" fill="#16181b" />
          <circle cx="36" cy="47" r="4.4" fill="#f4f1ea" stroke="#16181b" stroke-width="1.4" />
          <circle cx="36" cy="47" r="1.6" fill="#16181b" />
          <path d="M44 30 L54 26 L54 29 L45 32 Z" fill="#f5b325" />
          <circle cx="52" cy="27.5" r="2.1" fill="none" stroke="#16181b" stroke-width="1.6" />
          <rect x="55.5" y="31" width="4" height="7" rx="1.5" fill="#ff5c1a" />
        </svg>
        <style>{`
          @keyframes rmtLogoPulse {
            0%, 100% { transform: scale(1); opacity: 0.95; }
            50% { transform: scale(1.02); opacity: 1; }
          }
        `}</style>
      </div>

      {/* claim strip — top row IN FLOW: the centered group can never slide behind it */}
      <div style={{ position: "relative", zIndex: 1, flexShrink: 0, alignSelf: "center", marginTop: 4 }}>
        <button
          onClick={(e) => { e.stopPropagation(); if (last) { finish(); dispatchEvent(new CustomEvent("rmt-auth", { detail: "signup" })); } else setIdx(idx + 1); }}
          style={{
            padding: "9px 20px", borderRadius: 22, border: 0, cursor: "pointer",
            background: "linear-gradient(135deg,#f5b325,#ff9d00)", color: "#16181b",
            fontWeight: 800, fontSize: 12, letterSpacing: ".05em", boxShadow: "0 4px 16px rgba(245,179,37,.3)",
          }}
        >🔓 CLAIM YOUR FREE MONTH{slots && slots.remaining > 0 ? ` — ${slots.remaining} LEFT` : ""}</button>
      </div>
      {/* skip */}
      <div style={{ position: "absolute", top: 18, right: 20 }}>
        <button
          onClick={(e) => { e.stopPropagation(); finish(); setGone(true); }}
          style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #30363d", background: "#0d1117", color: "#8b949e", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
        >Skip →</button>
      </div>

      {/* yellow logo + slide text — centered in the space below the strip */}
      <div style={{ position: "relative", zIndex: 1, flex: "1 1 auto", width: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 0, paddingTop: 42 }}>
        <div key={idx} style={{ maxWidth: 760, padding: "0 4px", boxSizing: "border-box", position: "relative", zIndex: 2, animation: "rmtIntroIn .5s ease both" }}>
          <div style={{ color: "var(--amber,#f5b325)", fontSize: 12, fontWeight: 800, letterSpacing: ".22em", marginBottom: 12 }}>{s.kicker}</div>
          <div style={{ color: "#f2f6fa", fontSize: (idx === SLIDES.length - 1 && slots) ? "clamp(3rem, 14vw, 8.2rem)" : "clamp(2.6rem, 11vw, 6.4rem)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-.02em", textShadow: "0 6px 30px rgba(0,0,0,.55)", overflowWrap: "anywhere" }}>{(idx === SLIDES.length - 1 && slots) ? "1,000 SLOTS ONLY" : s.text}</div>
          <div style={{ color: "#b9c2cc", fontSize: "clamp(1rem, 3.6vw, 1.25rem)", marginTop: 16, fontWeight: 600, maxWidth: 600, marginInline: "auto", lineHeight: 1.4 }}>{(idx === SLIDES.length - 1 && slots) ? `${slots.claimed}/1000 premium members in — ${slots.remaining} free-month slots remain.` : s.sub}</div>
        </div>
      </div>

      {/* dots + CTA — pinned rows at the bottom */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", gap: 8, paddingBottom: 16, flexShrink: 0 }}>
        {SLIDES.map((_, i) => (
          <span key={i} onClick={(e) => { e.stopPropagation(); setIdx(i); }} style={{
            width: i === idx ? 26 : 8, height: 8, borderRadius: 4, cursor: "pointer",
            background: i === idx ? "var(--amber,#f5b325)" : "rgba(255,255,255,.18)", transition: "width .3s, background .3s",
          }} />
        ))}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); if (last) { finish(); setGone(true); } else setIdx(idx + 1); }}
        style={{ padding: "10px 26px", borderRadius: 24, border: 0, background: "linear-gradient(135deg,#f5b325,#ff9d00)", color: "#16181b", fontWeight: 900, fontSize: 14, cursor: "pointer", flexShrink: 0 }}
      >{last ? "START RENTING →" : "NEXT →"}</button>

      <style>{`
        @keyframes rmtIntroIn { from { opacity: 0; transform: translateY(14px) scale(.985); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}