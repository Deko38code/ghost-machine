import { useEffect, useMemo, useState } from "react";
import { search, stats } from "../data/db.js";
import { money } from "../router.jsx";

export default function Browse({ route }) {
  const qs = useMemo(() => new URLSearchParams((route.param || "").split("?")[1] || ""), [route.param]);
  const q = qs.get("q") || (route.param || "").split("?")[0] || "";
  const [cat, setCat] = useState(qs.get("cat") || "");
  const [state, setState] = useState("");
  const [max, setMax] = useState(qs.get("max") || "");
  const [sort, setSort] = useState("new");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState(null);

  useEffect(() => { setPage(1); }, [q, cat, state, max, sort]);
  useEffect(() => {
    search({ q, cat, state, max: max !== "" ? max : "", sort, page }).then(setData).catch(() => setData(null));
  }, [q, cat, state, max, sort, page]);
  useEffect(() => { stats().then(setMeta).catch(() => {}); }, []);
  const cats = (meta?.cats || []).filter((c) => c.cat && c.cat.split(",").length === 1);

  return (
    <div className="page browse">
      <h1 className="sec-title">Browse trailers</h1>
      <p className="sec-sub">{data ? `${data.total.toLocaleString()} listings match` : "loading…"} {q && `for “${q}”`}</p>
      <div className="filters">
        <select value={state} onChange={(e) => setState(e.target.value)} aria-label="State">
          <option value="">All states</option>
          {(meta?.states || []).map((s) => <option key={s.state} value={s.state}>{s.state} ({s.n})</option>)}
        </select>
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Type">
          <option value="">All types</option>
          {cats.map((c) => <option key={c.cat} value={c.cat}>{c.cat} ({c.n})</option>)}
        </select>
        <select value={max} onChange={(e) => setMax(e.target.value)} aria-label="Max daily price">
          <option value="">Any daily rate</option>
          <option value="50">≤ $50/day</option>
          <option value="100">≤ $100/day</option>
          <option value="200">≤ $200/day</option>
          <option value="500">≤ $500/day</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          <option value="new">Newest</option>
          <option value="price-asc">Price ↑</option>
          <option value="price-desc">Price ↓</option>
        </select>
      </div>
      <div className="grid">
        {(data?.rows || []).map((l) => (
          <a className="card" key={l.id} href={`#/detail/${l.id}`}>
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
        ))}
      </div>
      {data && data.total > data.per && (
        <div className="pager">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
          <span>Page {data.page} / {Math.ceil(data.total / data.per)}</span>
          <button disabled={page * data.per >= data.total} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      )}
      {data && data.rows.length === 0 && <div className="empty">No trailers match — clear a filter.</div>}
    </div>
  );
}