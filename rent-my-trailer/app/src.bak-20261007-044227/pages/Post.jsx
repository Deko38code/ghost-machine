import { useEffect, useState } from "react";
import { api, getToken, user } from "../lib/api.js";
import { useEffect as useEffectX } from "react";
import { AuthModal } from "../lib/Auth.jsx";

const CATS = ["Dump Trailer", "Car Hauler", "Utility Trailer", "Enclosed Trailer", "Flatbed", "Horse Trailer", "Motorcycle Trailer", "Boat Trailer"];

export default function Post() {
  const [form, setForm] = useState({
    title: "", cat: "Utility Trailer", dims: "", weight: "", hitch: "Bumper Pull",
    city: "", state: "", zip: "", daily: "", weekly: "", monthly: "", deposit: 100,
    delivery: false, deliveryRadius: 15, desc: "",
  });
  const [saved, setSaved] = useState(null);
  const [mine, setMine] = useState(null);
  const [err, setErr] = useState("");
  const [auth, setAuth] = useState(false);   // login modal open
  const [aiDraft, setAiDraft] = useState(null);
  const [lib, setLib] = useState([]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const loadMine = () => { if (getToken()) api("GET", "/api/mytrailers").then((r) => setMine(r.rows)).catch(() => setMine([])); };
  useEffect(() => { loadMine(); }, []);
  useEffect(() => {
    const onAi = (e) => { if (e.detail) setAiDraft(e.detail); };
    addEventListener("rmt-ai-listing", onAi);
    return () => removeEventListener("rmt-ai-listing", onAi);
  }, []);
  useEffect(() => {
    if (!aiDraft) return;
    setForm((f) => ({
      ...f,
      title: aiDraft.title || f.title,
      cat: aiDraft.cat || f.cat,
      daily: aiDraft.daily ?? f.daily,
      weekly: aiDraft.weekly ?? f.weekly,
      monthly: aiDraft.monthly ?? f.monthly,
      deposit: aiDraft.deposit ?? f.deposit,
      city: aiDraft.city || f.city,
      state: aiDraft.state || f.state,
      zip: aiDraft.zip || f.zip,
      hitch: aiDraft.hitch || f.hitch,
      dims: aiDraft.dims || f.dims,
      weight: aiDraft.weight || f.weight,
      delivery: !!aiDraft.delivery,
      deliveryRadius: aiDraft.delivery_radius ?? f.deliveryRadius,
      desc: aiDraft.desc || f.desc,
    }));
  }, [aiDraft]);

  useEffect(() => {
    const ctl = new AbortController();
    fetch(`/api/pictures?cat=${encodeURIComponent(form.cat)}`, { signal: ctl.signal })
      .then((r) => r.json())
      .then((j) => setLib((j.rows || []).map((x) => x.img)))
      .catch(() => {});
    return () => ctl.abort();
  }, [form.cat]);

  const hint = (() => {
    const avg = { "Dump Trailer": 165, "Car Hauler": 120, "Utility Trailer": 95, "Enclosed Trailer": 135, Flatbed: 128, "Horse Trailer": 210, "Motorcycle Trailer": 85, "Boat Trailer": 130 }[form.cat] || 110;
    const d = Number(form.daily);
    if (!d) return { cls: "ai-hint", msg: `${form.cat} market avg: $${avg}/day` };
    const pct = Math.round(((d - avg) / avg) * 100);
    if (pct > 25) return { cls: "coupon-no", msg: `${pct}% ABOVE market ($${avg}/day) — will rent slower` };
    if (pct < -25) return { cls: "coupon-ok", msg: `${-pct}% BELOW market ($${avg}/day) — strong deal` };
    return { cls: "coupon-ok", msg: `✅ Well-priced — market avg $${avg}, yours $${d}/day` };
  })();

  const publish = async (e) => {
    if (e) e.preventDefault();
    if (!getToken()) { setAuth(true); return; }
    setErr("");
    try {
      const r = await api("POST", "/api/trailers", form);
      setSaved(r);
      loadMine();
    } catch (ex) { setErr(ex.message === "login required" ? (setAuth(true), "") : ex.message); }
  };

  return (
    <div className="page deposit">
      <h1 className="sec-title">List your trailer</h1>
      <p className="sec-sub">Post a personal trailer for rent — day, week, and month rates go live right away.</p>
      <div className="detail-cols">
        <section className="desc-col" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <b>Real-market pricing guidance</b>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>Anchors from the live snapshot. Feedback updates as you type.</span>
          <div className="bookform" style={{ marginTop: 10 }}>
            <div className={hint.cls}>{hint.msg}</div>
            <div className="coupon-ok">{Number(form.weekly) ? `Weekly $${form.weekly} = $${(form.weekly / 7).toFixed(0)}/day effective` : "Tip: weekly ≈ 5.5–6 day-days"}</div>
            <div className="coupon-ok">{Number(form.monthly) ? `Monthly $${form.monthly} = $${(form.monthly / 30).toFixed(0)}/day effective` : "Monthly ≈ 25–30% off day rate"}</div>
            {aiDraft && <div className="coupon-ok">✨ AI draft applied — edit anything before publishing.</div>}
          </div>
        </section>
        <section className="book-col">
          <div className="bookform">
            <label>Trailer headline<input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="7x14 dump trailer — 14k GVWR" /></label>
            <label>Type<select value={form.cat} onChange={(e) => set("cat", e.target.value)}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label>Daily rate<input type="number" min="0" value={form.daily} onChange={(e) => set("daily", e.target.value)} placeholder="e.g. 120" /></label>
              <label>Weekly rate<input type="number" min="0" value={form.weekly} onChange={(e) => set("weekly", e.target.value)} placeholder="e.g. 600" /></label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <label>Monthly<input type="number" value={form.monthly} onChange={(e) => set("monthly", e.target.value)} /></label>
              <label>Deposit<input type="number" value={form.deposit} onChange={(e) => set("deposit", e.target.value)} /></label>
              <label>Delivery mi<input type="number" value={form.deliveryRadius} onChange={(e) => set("deliveryRadius", e.target.value)} /></label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <label>City<input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Kerrville" /></label>
              <label>State<input value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="TX" /></label>
              <label>ZIP<input value={form.zip} onChange={(e) => set("zip", e.target.value)} /></label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label>Size<input value={form.dims} onChange={(e) => set("dims", e.target.value)} placeholder="7x14" /></label>
              <label>Weight capacity<input value={form.weight} onChange={(e) => set("weight", e.target.value)} placeholder="10,000 lbs" /></label>
            </div>
            <label style={{ flexDirection: "row", alignItems: "center", gap: 8, display: "flex" }}>
              <input type="checkbox" style={{ width: "auto" }} checked={form.delivery} onChange={(e) => set("delivery", e.target.checked)} /> I deliver within my radius
            </label>
            <label>Description<textarea rows="3" value={form.desc} onChange={(e) => set("desc", e.target.value)} style={{ background: "var(--asphalt)", border: "1px solid var(--line)", color: "var(--paper)", padding: 10, fontFamily: "var(--mono)" }} /></label>
            {err && <p className="coupon-no">{err}</p>}
            <div className="libpick">
              <b>Pick a picture from the library ({form.cat})</b>
              <div className="libgrid">
                {lib.slice(0, 12).map((u, i) => (
                  <button key={i} className={"libimg" + (form.img === u ? " on" : "")} onClick={() => set("img", u)}>
                    <img src={u} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
              {form.img && <small className="coupon-ok">✓ picture attached</small>}
            </div>
            <button className="bookbtn" onClick={publish}>Publish listing</button>
            {saved && <div className="booked-note"><b style={{ color: "var(--amber)" }}>✅ Live — listing #{saved.id}</b><p>It's searchable right now in Browse.</p><a href={`#/detail/${saved.id}`}>Open my listing →</a></div>}
          </div>
          {mine?.length > 0 && (
            <div className="couplelist">
              <b>My trailers ({mine.length})</b>
              {mine.map((m) => <span key={m.id}>• {m.title} — ${m.daily}/day · <a href={`#/detail/${m.id}`} style={{ color: "var(--amber)" }}>view</a></span>)}
            </div>
          )}
        </section>
      </div>
      {auth && <AuthModal onClose={() => setAuth(false)} onDone={loadMine} />}
    </div>
  );
}