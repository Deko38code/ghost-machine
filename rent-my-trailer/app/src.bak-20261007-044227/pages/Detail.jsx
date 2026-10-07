import { useEffect, useMemo, useState } from "react";
import { getListing } from "../data/db.js";
import { money, COUPONS as FALLBACK_COUPONS, directionsUrl, mapEmbedUrl } from "../router.jsx";

import { api } from "../lib/api.js";

const Gallery = ({ l }) => {
  const [main, setMain] = useState(l.img);
  const pics = (l.pics && l.pics.length ? l.pics : [l.img]).filter(Boolean);
  return (
    <>
      <div className="detail-media mainimg">
        {main ? <img src={main.replace("width=640", "width=1200")} alt={l.title} /> : <div className="media-fallback big">NO PHOTO</div>}
        <span className="card-cat overlay">{l.cat}</span>
      </div>
      {pics.length > 1 && (
        <div className="thumbs">
          {pics.map((p, i) => (
            <button key={i} className={"thumb" + (p === main ? " on" : "")} onClick={() => setMain(p)}>
              <img src={p} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </>
  );
};

const today = () => new Date().toISOString().slice(0, 10);

export default function Detail({ route }) {
  const id = route.param;
  const [l, setL] = useState(null);
  const [gone, setGone] = useState(false);
  const [start, setStart] = useState(today());
  const [days, setDays] = useState(3);
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState(null);
  const [err, setErr] = useState("");

  const [coupons, setCoupons] = useState(FALLBACK_COUPONS);
  useEffect(() => {
    setL(null); setGone(false); setApplied(null);
    getListing(id).then(setL).catch(() => setGone(true));
  }, [id]);
  useEffect(() => { api("GET", "/api/coupons").then((c) => c.rows?.length && setCoupons(c.rows)).catch(() => {}); }, []);

  useEffect(() => {
    if (!l || !coupon) return;
    const t = setTimeout(() => {
      api("POST", "/api/coupons/validate", { code: coupon }).then((r) => setApplied(r.valid ? r : null)).catch(() => setApplied(null));
    }, 250);
    return () => clearTimeout(t);
  }, [coupon, l]);

  const quote = useMemo(() => {
    if (!l) return null;
    const daily = l.daily ?? 0;
    let base = daily * days;
    if (l.weekly) base = Math.min(base, Math.floor(days / 7) * l.weekly + (days % 7) * daily);
    if (l.monthly) base = Math.min(base, Math.floor(days / 30) * l.monthly + (days % 30) * daily);
    const disc = applied ? (base * applied.percent) / 100 : 0;
    const total = base - disc;
    return { base: Math.round(base * 100) / 100, discount: Math.round(disc * 100) / 100, total: Math.round(total * 100) / 100, deposit: l.deposit ?? 0 };
  }, [l, days, applied]);

  if (gone) return <div className="page"><h1>Trailer not found</h1><a className="cta-line" href="#/browse">Back to browse</a></div>;
  if (!l || !quote) return <div className="page"><h1 className="sec-title">Loading…</h1></div>;

  const book = async () => {
    setErr("");
    try {
      const r = await api("POST", "/api/bookings", { trailer_id: l.id, start_date: start, days, coupon: applied?.code });
      location.hash = `#/confirmation/${r.booking.code}`;   // full lifecycle lives on Confirmation
    } catch (e) { setErr(e.message); }
  };

  return (
    <div className="page detail">
      <div className="detail-hero">
        <div className="detail-hero-media">
          <Gallery l={l} />
        </div>
        <div className="detail-head">
          <h1>{l.title}</h1>
          <p className="card-loc">{l.year || ""} {l.make || ""} {l.model || ""} {l.year || l.make || l.model ? "· " : ""}{l.city}, {l.state} {l.zip || ""}</p>
          <div className="pricerow">
            <div><b>{money(l.daily)}</b><span>/day</span></div>
            {l.weekly && <div><b>{money(l.weekly)}</b><span>/week</span></div>}
            {l.monthly && <div><b>{money(l.monthly)}</b><span>/month</span></div>}
          </div>
          <dl className="specs">
            {l.hitch && <div><dt>Hitch</dt><dd>{l.hitch}</dd></div>}
            {l.dims && <div><dt>Size</dt><dd>{l.dims}</dd></div>}
            {l.weight && <div><dt>Capacity</dt><dd>{l.weight}</dd></div>}
            {l.deposit != null && <div><dt>Refundable deposit</dt><dd>{money(l.deposit)}</dd></div>}
            <div><dt>Delivery</dt><dd>{Number(l.delivery) ? `Within ${l.delivery_radius ?? 15} mi` : "Pickup only"}</dd></div>
          </dl>
        </div>
      </div>

      <div className="detail-cols">
        <section className="desc-col">
          <h2 className="sec-title">About this trailer</h2>
          <p className="desc">{l.desc}</p>
          <a className="cta-line" href={`#/messages/${l.id}`}>Message about this trailer →</a>

          <h2 className="sec-title" style={{ marginTop: 26 }}>Pickup location</h2>
          <div style={{ border: "1px solid var(--line)" }}>
            {mapEmbedUrl(l) ? (
              <iframe title="Pickup map" src={mapEmbedUrl(l)} style={{ width: "100%", height: 280, border: 0, filter: "grayscale(1) invert(0.92) hue-rotate(180deg) contrast(0.9)" }} loading="lazy" />
            ) : (
              <div className="media-fallback big">NO COORDINATES</div>
            )}
          </div>
          <div className="couplelist" style={{ marginTop: 14 }}>
            <b>Directions & delivery</b>
            <span>• Pickup: {l.city}, {l.state} {l.zip || ""}</span>
            <span>• Delivery: {Number(l.delivery) ? `within ${l.delivery_radius ?? 15} mi radius` : "pickup only"}</span>
            {l.lat && l.lng && <span>• <a href={directionsUrl(l)} target="_blank" rel="noreferrer" style={{ color: "var(--amber)" }}>Google Maps directions (opens app)</a></span>}
          </div>
        </section>

        <section className="book-col">
          <h2 className="sec-title">Book it</h2>
          <div className="bookform">
            <label>Pickup date<input type="date" value={start} min={today()} onChange={(e) => setStart(e.target.value)} /></label>
            <label>Days<input type="number" min="1" max="60" value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value)))} /></label>
            <div className="couponbox">
              <input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="Coupon code" aria-label="Coupon code" />
              <button type="button" onClick={() => applied && applied.code === coupon.toUpperCase() ? null : setCoupon((c) => c.toUpperCase())}>Check</button>
            </div>
            {coupon && <p className={applied ? "coupon-ok" : "coupon-no"}>{applied ? `✅ ${applied.code} — ${applied.percent}% off` : `❌ “${coupon}” invalid or expired`}</p>}
            <table className="quotetab"><tbody>
              <tr><td>Base</td><td>{money(quote.base)}</td></tr>
              {quote.discount > 0 && <tr className="disc"><td>{applied?.code} discount</td><td>−{money(quote.discount)}</td></tr>}
              <tr><td>Refundable deposit (at pickup)</td><td>{money(quote.deposit)}</td></tr>
              <tr className="due"><td>Due at booking</td><td><b>{money(quote.total)}</b></td></tr>
            </tbody></table>
            {err && <p className="coupon-no">{err}</p>}
            <button className="bookbtn" onClick={book}>Book {days} day{days > 1 ? "s" : ""} — {money(quote.total)}</button>
          </div>
          <div className="couplelist">
            <b>Working coupon codes</b>
            {coupons.map((c) => <span key={c.code}>• {c.code} — {c.note ?? `${c.percent}% off`}</span>)}
          </div>
        </section>
      </div>
    </div>
  );
}

