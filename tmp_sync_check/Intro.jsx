import { useState, useEffect } from "react";
import rmtLogo from "../assets/rmt-logo.webp";

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
  useEffect(() => {
    document.body.classList.add("intro-open");
    const load = () => fetch("/api/member-count").then((r) => r.json()).then(setSlots).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    addEventListener("wheel", stop, { passive: false });
    return () => { document.body.classList.remove("intro-open"); clearInterval(t); removeEventListener("wheel", stop); };
  }, []);
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

      {/* claim strip — top row IN FLOW: the centered group can never slide behind it */}
      <div style={{ position: "relative", zIndex: 1, flexShrink: 0, alignSelf: "center", marginTop: 4 }}>
        <button
          onClick={(e) => { e.stopPropagation(); finish(); setGone(true); dispatchEvent(new CustomEvent("rmt-auth", { detail: "signup" })); }}
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
        <img
          src={rmtLogo}
          alt="Rent My Trailer logo"
          aria-hidden="true"
          style={{
            width: "clamp(120px, 20vw, 210px)",
            height: "auto",
            marginBottom: 22,
            flexShrink: 0,
            filter: "drop-shadow(0 18px 50px rgba(245,179,37,.4))",
            animation: "rmtLogoPulse 4s ease-in-out infinite"
          }}
        />
        <style>{`
          @keyframes rmtLogoPulse {
            0%, 100% { transform: scale(1); opacity: 0.95; }
            50% { transform: scale(1.02); opacity: 1; }
          }
        `}</style>
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