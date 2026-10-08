import { useEffect, useState } from "react";
import { search, stats } from "../data/db.js";
import { money } from "../router.jsx";

const Card = ({ l }) => (
  <a className="card" href={`#/detail/${l.id}`}>
    <div className="card-media">
      {l.img ? <img src={l.img} alt={l.title} loading="lazy" /> : <div className="media-fallback">NO PHOTO</div>}
      <span className="card-cat">{l.cat}</span>
    </div>
    <div className="card-body">
      <h3>{l.title}</h3>
      <p className="card-loc">{l.city}, {l.state}</p>
      <div className="card-prices">
        <span className="price-day">{money(l.daily)}<small>/day</small></span>
        {l.weekly && <span className="price-week">{money(l.weekly)}<small>/wk</small></span>}
      </div>
    </div>
  </a>
);

export default function Home() {
  const [q, setQ] = useState("");
  const [feat, setFeat] = useState([]);
  const [meta, setMeta] = useState(null);
  useEffect(() => {
    search({ sort: "new" }).then((d) => setFeat(d.rows.filter((r) => r.img).slice(0, 8))).catch(() => {});
    stats().then(setMeta).catch(() => {});
  }, []);
  const cats = (meta?.cats || []).filter((c) => c.cat && c.cat.split(",").length === 1).slice(0, 8);
  const go = (e) => { e.preventDefault(); location.hash = `#/browse/${encodeURIComponent(q)}`; };
  return (
    <div className="page home">
      <section className="hero">
        <p className="hero-kicker">{meta && meta.stats ? `${Number(meta.stats.total || 0).toLocaleString()}+ trailers — live data` : "live marketplace"}</p>
        <h1>Haul it.<br /><span className="hazard-word">Rent the trailer.</span></h1>
        <p className="hero-sub">Dump, car hauler, utility, enclosed, flatbed, horse — owner-direct rates with weekly and monthly pricing built in.</p>
        <form className="hero-search" onSubmit={go}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="City, state, or trailer type…" aria-label="Search trailers" />
          <button type="submit">Search</button>
        </form>
        <div className="chiprow">
          {cats.map((c) => (
            <a key={c.cat} className="chip" href={`#/browse/?cat=${encodeURIComponent(c.cat)}`}>
              {c.cat.replace(" Trailer Rentals", "").replace(" Trailer Rental", "")} <b>{c.n.toLocaleString()}</b>
            </a>
          ))}
        </div>
      </section>
      <a href="#/post" style={{ display: "block", textDecoration: "none", margin: "14px 18px 0" }}>
        <div style={{ borderColor: "#f5b325", background: "linear-gradient(135deg,#1c1400,#241d05)", padding: 16, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", borderRadius: 12 }}>
          <span style={{ fontSize: 34 }}>💵</span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <b style={{ color: "var(--amber)", fontSize: 16, letterSpacing: ".04em" }}>POST YOUR TRAILER — EARN FAST CASH</b>
            <p style={{ color: "var(--muted)", fontSize: 13, margin: "4px 0 0" }}>Idle trailer = idle money. Owners average <b style={{ color: "#f2f6fa" }}>$120/day</b>, keep <b style={{ color: "#f2f6fa" }}>92%</b> <span style={{ color: "#f5b325" }}>(first 1,000 signups)</span>, get GPS-verified handovers and deposits held safe. One-tap Google signup.</p>
          </div>
          <span style={{ padding: "10px 22px", borderRadius: 24, background: "linear-gradient(135deg,#f5b325,#ff9d00)", color: "#16181b", fontWeight: 900, fontSize: 13, letterSpacing: ".06em" }}>LIST IT NOW →</span>
        </div>
      </a>

      {meta?.stats && (
        <section className="strip">
          <div className="stat"><b>${meta.stats.avg}</b><span>avg/day</span></div>
          <div className="stat"><b>{Number(meta.stats.total || 0).toLocaleString()}</b><span>live listings</span></div>
          <div className="stat"><b>{(meta.states || []).length}</b><span>states covered</span></div>
          <div className="stat"><b>$0</b><span>platform fee — beta</span></div>
        </section>
      )}

      <section className="featured">
        <h2 className="sec-title">Ready to haul</h2>
        <p className="sec-sub">Pick your rig — book by the day, week, or month.</p>
        <div className="grid">{feat.map((l) => <Card key={l.id} l={l} />)}</div>
        <a className="cta-line" href="#/browse">See all listings →</a>
      </section>

      <section className="how">
        <h2 className="sec-title">How it works</h2>
        <ol className="steps">
          <li><b>01</b><h3>Find the rig</h3><p>Search by city or trailer type. Every listing shows owner-direct day rates.</p></li>
          <li><b>02</b><h3>Book & coupon it</h3><p>Pick your dates, apply a coupon code, see the exact total before you commit.</p></li>
          <li><b>03</b><h3>Chat with the owner</h3><p>Message the owner right in the app — live thread, real booking.</p></li>
          <li><b>04</b><h3>Photos & deposit</h3><p>Refundable deposit held against drop-off/pickup photos on both sides.</p></li>
        </ol>
      </section>
    </div>
  );
}