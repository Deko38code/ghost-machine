import { useEffect, useRef, useState } from "react";
import { api, getToken, user } from "../lib/api.js";
import { useEffect as useEffectX } from "react";
import { AuthModal } from "../lib/Auth.jsx";

const CATS = ["Dump Trailer", "Car Hauler", "Utility Trailer", "Enclosed Trailer", "Flatbed", "Horse Trailer", "Motorcycle Trailer", "Boat Trailer"];

const FALLBACK_AVG = { "Dump Trailer": 165, "Car Hauler": 120, "Utility Trailer": 95, "Enclosed Trailer": 135, Flatbed: 128, "Horse Trailer": 210, "Motorcycle Trailer": 85, "Boat Trailer": 130 };

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
  const [livePics, setLivePics] = useState([]);
  const [upNote, setUpNote] = useState("");
  const [realAvg, setRealAvg] = useState({});
  const [pin, setPin] = useState(null);           // {lat,lng} pickup door point
  const [pinAddr, setPinAddr] = useState("");     // reverse-geocoded street/city
  const [pinBusy, setPinBusy] = useState(false);
  const mapRef = useRef(null);                    // leaflet map instance
  const mapDiv = useRef(null);
  const markerRef = useRef(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  /* ─── pickup pin picker: click-to-drop + auto address fill ─── */
  let leafletPromise = null;
  const loadLeaflet = () => {
    if (window.L) return Promise.resolve(window.L);
    if (!leafletPromise) leafletPromise = new Promise((ok, bad) => {
      const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(css);
      const s = document.createElement("script"); s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      s.onload = () => ok(window.L); s.onerror = () => bad(new Error("map load failed")); document.head.appendChild(s);
    });
    return leafletPromise;
  };
  const reverseGeocode = async (lat, lng) => {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, { headers: { "User-Agent": "RentMyTrailer/1.0" } });
      const j = await r.json();
      const a = j.address || {};
      setForm((f) => ({
        ...f,
        city: a.city || a.town || a.village || a.hamlet || a.county || f.city,
        state: (a.state_code || a.state || f.state || "").slice(0, 3),
        zip: a.postcode || f.zip,
      }));
      setPinAddr([a.house_number, a.road, a.city || a.town || a.village || a.county, a.state].filter(Boolean).join(" "));
    } catch { setPinAddr(""); }
  };
  const dropPin = (lat, lng, doGeocode = true) => {
    setPin({ lat, lng });
    if (mapRef.current && markerRef.current) markerRef.current.setLatLng([lat, lng]);
    else if (mapRef.current) markerRef.current = window.L.marker([lat, lng]).addTo(mapRef.current);
    mapRef.current?.panTo?.([lat, lng]);
    if (doGeocode) reverseGeocode(lat, lng);
  };
  const initMap = async () => {
    try {
      const L = await loadLeaflet();
      if (mapRef.current || !mapDiv.current) return;
      const start = pin || null;
      mapRef.current = L.map(mapDiv.current, { zoomControl: true }).setView(start ? [start.lat, start.lng] : [39.5, -98.35], start ? 15 : 4);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(mapRef.current);
      if (start) dropPin(start.lat, start.lng, false);
      mapRef.current.on("click", (e) => dropPin(e.latlng.lat, e.latlng.lng));
    } catch {}
  };
  useEffect(() => { initMap(); return () => { try { mapRef.current?.remove?.(); mapRef.current = null; markerRef.current = null; } catch {} }; }, []);
  const useMyLocation = () => {
    setPinBusy(true);
    navigator.geolocation?.getCurrentPosition(
      (p) => { setPinBusy(false); dropPin(p.coords.latitude, p.coords.longitude, true); },
      () => setPinBusy(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const uploadLive = async (id, files) => {
    if (!files.length || !id) return false;
    const fd = new FormData();
    for (const f of files) fd.append("photos", f);
    try {
      const rr = await fetch(`/api/trailers/${id}/photos`, { method: "POST", headers: { Authorization: `Bearer ${getToken()}` }, body: fd });
      if (!rr.ok) throw new Error((await rr.json())?.error || "upload failed");
      return true;
    } catch (ex) { setUpNote("✗ " + ex.message); return false; }
  };

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
  useEffect(() => {
    fetch("/api/pricing/averages").then((r) => r.json()).then((j) => setRealAvg(j.cats || {})).catch(() => {});
  }, []);

  const hint = (() => {
    const c = realAvg[form.cat];
    const avg = (c?.avg ?? FALLBACK_AVG[form.cat] ?? 110);
    const n = c?.listings ?? 0;
    const d = Number(form.daily);
    if (!d) return { cls: "ai-hint", msg: `${form.cat} market avg: $${avg}/day${n ? ` · from ${n} live listings` : ""}` };
    const pct = Math.round(((d - avg) / avg) * 100);
    if (pct > 25) return { cls: "coupon-no", msg: `${pct}% ABOVE market ($${avg}/day from ${n || "anchor"} listings) — will rent slower` };
    if (pct < -25) return { cls: "coupon-ok", msg: `${-pct}% BELOW market ($${avg}/day${n ? `, ${n} live listings` : ""}) — strong deal` };
    return { cls: "coupon-ok", msg: `✅ Well-priced — real market avg $${avg}, yours $${d}/day` };
  })();

  const publish = async (e) => {
    if (e) e.preventDefault();
    if (!getToken()) { setAuth(true); return; }
    setErr("");
    try {
      const r = await api("POST", "/api/trailers", { ...form, lat: pin?.lat ?? null, lng: pin?.lng ?? null });
      if (livePics.length) await uploadLive(r.id, livePics);
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
            {/* pickup pin — click map or use-device GPS; address auto-fills */}
            <div className="libpick" style={{ marginTop: 4 }}>
              <b>📍 Pickup point — drop the pin on the door (auto-fills address)</b>
              <div ref={mapDiv} style={{ height: 210, borderRadius: 10, border: "1px solid var(--line)", margin: "8px 0" }} />
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button type="button" className="ai-go" style={{ padding: "6px 12px", fontSize: 11 }} onClick={useMyLocation}>{pinBusy ? "Locating…" : "📍 Use my current spot"}</button>
                {pin && <small className="coupon-ok" style={{ userSelect: "all" }}>pin: {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}{pinAddr ? ` — ${pinAddr}` : ""}</small>}
                {!pin && <small style={{ color: "var(--muted)", fontSize: 11 }}>tap the map to drop the pin (zoom in for door precision) → gives renters turn-by-turn + locks your GPS geofence</small>}
              </div>
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

            {(livePics.length || form.img) && (
              <div className="post-preview" style={{ marginTop: 12 }}>
                <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--line)", background: "#0d0f13" }}>
                  {livePics[0] || form.img
                    ? <img src={livePics[0] ? URL.createObjectURL(livePics[0]) : form.img} alt="cover preview" style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }} />
                    : <div className="media-fallback big">NO PHOTO</div>}
                  <div style={{ padding: "8px 12px", color: "var(--muted)", fontSize: 11 }}>COVER — what renter sees first</div>
                </div>
                {(livePics.length > 1 || (livePics.length === 0 && form.img)) && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(86px, 1fr))", gap: 6, marginTop: 8 }}>
                    {livePics.slice(1).map((f, i) => (
                      <img key={"lp" + i} src={URL.createObjectURL(f)} alt="" style={{ width: "100%", height: 60, objectFit: "cover", borderRadius: 6, border: "1px solid var(--line)" }} />
                    ))}
                    {form.img && livePics.length >= 1 && <img src={form.img} alt="" style={{ width: "100%", height: 60, objectFit: "cover", borderRadius: 6, border: "1px solid var(--line)" }} />}
                  </div>
                )}
                <small style={{ color: "var(--muted)", fontSize: 11 }}>Your listing: cover up top, gallery under — exactly like the detail page.</small>
              </div>
            )}

            <div className="libpick" style={{ marginTop: 10 }}>
              <b>Your real live photos (shown first — replaces library pic as the cover)</b>
              <input type="file" accept="image/*" multiple onChange={(e) => setLivePics(Array.from(e.target.files || []))} style={{ fontSize: 12, color: "var(--paper)" }} />
              {livePics.length > 0 && <small className="coupon-ok">{livePics.length} live photo(s) ready — they upload when you publish</small>}
              {upNote && <small className="coupon-no">{upNote}</small>}
            </div>
            <button className="bookbtn" onClick={publish}>Publish listing</button>
            {saved && <div className="booked-note"><b style={{ color: "var(--amber)" }}>✅ Live — listing #{saved.id}</b><p>It's searchable right now in Browse.</p><a href={`#/detail/${saved.id}`}>Open my listing →</a></div>}
          </div>
          {mine?.length > 0 && (
            <div className="couplelist" style={{ gap: 10 }}>
              <b style={{ fontSize: 13 }}>My trailers ({mine.length}) — manage photos</b>
              {mine.map((m) => {
                const pics = (() => { try { return (m.pics_json ? JSON.parse(m.pics_json) : []).filter(Boolean); } catch { return []; } })();
                return (
                  <div key={m.id} className="dphoto" style={{ padding: "10px 12px", borderRadius: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12.5 }}>• <b style={{ color: "#f2f6fa" }}>{(m.title || "").slice(0, 38)}</b> — ${m.daily}/day · <a href={`#/detail/${m.id}`} style={{ color: "var(--amber)" }}>view</a></span>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--amber)", cursor: "pointer" }}>＋ add pics
                        <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { uploadLive(m.id, Array.from(e.target.files || [])).then((okk) => { if (okk) loadMine(); }); }} />
                      </label>
                    </div>
                    {pics.length > 0 && (
                      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                        {pics.map((p, i) => (
                          <span key={i} style={{ position: "relative", display: "inline-block" }}>
                            <img src={p} alt="" loading="lazy" style={{ width: 74, height: 54, objectFit: "cover", borderRadius: 6, border: m.img === p ? "2px solid var(--amber)" : "1px solid var(--line)", display: "block" }} />
                            {m.img === p && <small style={{ position: "absolute", bottom: -14, left: 0, right: 0, textAlign: "center", color: "var(--amber)", fontSize: 8.5, letterSpacing: ".08em" }}>COVER</small>}
                            <button title="Set as cover" onClick={async () => { await api("POST", `/api/trailers/${m.id}/cover`, { url: p }); loadMine(); }} style={{ position: "absolute", top: 3, left: 3, width: 20, height: 20, borderRadius: 5, border: 0, background: "rgba(10,10,10,.75)", color: "var(--amber)", fontSize: 11, cursor: "pointer", lineHeight: 1 }}>★</button>
                            <button title="Remove photo" onClick={async () => { if (!confirm("Remove this photo from the listing?")) return; await api("POST", `/api/trailers/${m.id}/photos/remove`, { url: p }); loadMine(); }} style={{ position: "absolute", top: 3, right: 3, width: 20, height: 20, borderRadius: 5, border: 0, background: "rgba(10,10,10,.75)", color: "#ff5c1a", fontSize: 11, cursor: "pointer", lineHeight: 1 }}>✕</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
      {auth && <AuthModal onClose={() => setAuth(false)} onDone={loadMine} />}
    </div>
  );
}
