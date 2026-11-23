import { useEffect, useState } from "react";
import badge from "../assets/rmt-badge.jpg";

export default function Membership() {
  const [pricing, setPricing] = useState(null);
  const [count, setCount] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let dead = false;
    Promise.all([
      fetch("/api/pricing").then((r) => r.json()),
      fetch("/api/member-count").then((r) => r.json()),
    ]).then(([p, c]) => {
      if (dead) return;
      setPricing(p);
      setCount(c);
    }).catch(() => {});
    return () => { dead = true; };
  }, []);

  const startCheckout = async () => {
    try {
      const token = localStorage.getItem("rmt-token") || "";
      const r = await fetch("/api/auth/upgrade/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ sid: "membership" }),
      });
      const j = await r.json();
      if (j.url) {
        location.href = j.url;
        return;
      }
      throw new Error(j.error || "checkout unavailable");
    } catch (e) {
      setErr(e.message);
    }
  };

  const founder = pricing?.founder;
  const ownerKeep = 100 - (founder?.fee_pct ?? pricing?.owner_fee_pct ?? 10);

  return (
    <section className="page" style={{ maxWidth: 1080 }}>
      <p className="sec-sub">
        Premium unlocks sharing, priority booking and fleet deals. First 1,000 signups keep 92% of every rental · CA tax added at checkout for California.
      </p>

      <div className="membership-grid">
        <div style={{ maxWidth: 440, border: "2px solid #f5b325", borderRadius: 16, background: "#0d1117", padding: "22px 26px", boxShadow: "0 10px 40px rgba(0,0,0,.45)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <img src={badge} alt="" style={{ width: 44, height: 44, borderRadius: "50%" }} />
            <b style={{ color: "#f5b325", letterSpacing: ".14em", fontSize: 12 }}>PREMIUM MEMBERSHIP</b>
          </div>

          {pricing && (
            <>
              <div style={{ color: "#f2f6fa", fontSize: 34, fontWeight: 900 }}>
                ${pricing.monthly_incl_tax}
                <span style={{ fontSize: 15, color: "#8b949e", fontWeight: 600 }}> /month — tax included</span>
              </div>
              <div style={{ color: "#8b949e", fontSize: 12, marginTop: 4 }}>
                Base ${pricing.monthly} + {(pricing.tax_rate * 100).toFixed(2)}% tax — baked in, live-watched
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                <div style={{ border: "1px solid #2a2e35", borderRadius: 10, padding: "8px 10px" }}>
                  <div style={{ color: "#8b949e", fontSize: 11 }}>+ refundable deposits per rental</div>
                </div>
                <div style={{ border: "1px solid #2a2e35", borderRadius: 10, padding: "8px 10px" }}>
                  <div style={{ color: "#8b949e", fontSize: 11, letterSpacing: ".1em" }}>OWNERS EARN</div>
                  <div style={{ color: "#f2f6fa", fontWeight: 800 }}>{ownerKeep.toFixed(0)}% of every rental</div>
                  {founder && founder.remaining > 0 && (
                    <div style={{ color: "#f5b325", fontSize: 11, marginTop: 3 }}>first {founder.cap.toLocaleString()} signups · {founder.remaining} left</div>
                  )}
                </div>
              </div>
            </>
          )}

          <ul style={{ color: "#c9d1d9", fontSize: 13, lineHeight: 1.7, paddingLeft: 18, margin: "12px 0" }}>
            {pricing?.perks?.map((perk) => (
              <li key={perk}>{perk}</li>
            ))}
          </ul>

          {count && (
            <div style={{ color: "#f5b325", fontSize: 12, fontWeight: 800, marginBottom: 10 }}>
              {count.claimed}/1000 premium in — {count.remaining} free-month slots remain (first-1000: card required, nothing charged for month one)
            </div>
          )}
          {err && <div style={{ color: "#ff5c1a", fontSize: 12, marginBottom: 8 }}>{err}</div>}

          <button
            onClick={startCheckout}
            style={{
              width: "100%", padding: "12px 0", borderRadius: 10, border: 0,
              background: "linear-gradient(135deg,#f5b325,#ff9d00)",
              color: "#16181b", fontWeight: 900, fontSize: 15, cursor: "pointer",
            }}
          >
            {count?.remaining > 0 ? "Claim free first month — add card" : "Go premium"}
          </button>

          <div style={{ color: "#8b949e", fontSize: 11, marginTop: 10, lineHeight: 1.6 }}>
            Cancel anytime — free cancellation before pickup; after pickup deposit rules apply. Owners: 10% platform fee only on completed rentals.
          </div>
        </div>

        <div className="dphoto" style={{ alignSelf: "start", maxWidth: 460 }}>
          <div className="dphoto-head"><h3>Why members switch</h3><span>owner-first</span></div>
          <div className="membership-facts">
            <div><b>92% earnings</b><span>for the founding 1,000 cohort</span></div>
            <div><b>Priority placement</b><span>on browse and search</span></div>
            <div><b>Direct chat</b><span>no middleman for booking details</span></div>
            <div><b>No surprise tax</b><span>monthly pricing already includes tax</span></div>
          </div>
          <a href="#/faq" className="ai-hint" style={{ display: "inline-block", marginTop: 12 }}>Read the FAQ →</a>
        </div>
      </div>
    </section>
  );
}
