import { useEffect, useState } from "react";
import { api, getToken } from "../lib/api.js";

const box = { background: "var(--asphalt)", border: "1px solid var(--line)", borderRadius: 12, padding: 16 };
const field = { width: "100%", minWidth: 0, padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 8, background: "#11151b", color: "var(--paper)", font: "inherit" };
const statusLabel = { ownership_required: "Verify site ownership", verified: "Ready to request", requested: "Request submitted", in_review: "In review", building: "Migration in progress", completed: "Migration complete", declined: "Needs follow-up" };
export default function Migrate() {
  const [source, setSource] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("website");
  const [authorized, setAuthorized] = useState(false);
  const [scan, setScan] = useState(null);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const reload = () => api("GET", "/api/migrations").then((r) => setRows(r.rows || [])).catch((e) => setError(e.message));
  useEffect(() => { if (getToken()) reload(); }, []);
  const run = async (fn) => { setBusy(true); setError(""); setNote(""); try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const analyze = (e) => {
    e.preventDefault();
    run(async () => {
      const result = await api("POST", "/api/migrations/scan", { source_url: source, project_name: name, business_type: type, authorized });
      setScan(result); setSource(result.scan.sourceUrl); setNote("Scan complete. Review what we found, then verify your domain before submitting."); await reload();
    });
  };
  const verify = () => run(async () => { const r = await api("POST", `/api/migrations/${scan.id}/verify`, {}); setScan((s) => ({ ...s, status: r.status })); setNote("Domain ownership verified. You can now submit the migration request."); await reload(); });
  const submit = () => run(async () => { const r = await api("POST", `/api/migrations/${scan.id}/start`, {}); setScan((s) => ({ ...s, status: r.status })); setNote("Request submitted. Check this page for status updates while the migration team reviews the scan."); await reload(); });
  if (!getToken()) return <div className="page"><h1 className="sec-title">Bring your site to Hakster</h1><p className="sec-sub">Sign in to scan a site you own and start a migration request.</p><a className="ai-go" href="#/home">Sign in or create an account</a></div>;
  return <div className="page deposit" style={{ maxWidth: 1040 }}>
    <h1 className="sec-title">Bring your site to Hakster</h1>
    <p className="sec-sub">Scan your public website, review the migration plan, verify you control the domain, and submit when you’re ready. Your current site stays live while we review the move.</p>
    <div style={{ ...box, marginBottom: 16 }}>
      <h2 style={{ color: "var(--amber)", fontSize: 18, marginBottom: 8 }}>1 · Scan your website</h2>
      <form onSubmit={analyze} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
        <label style={{ fontSize: 12, color: "var(--muted)" }}>Current site URL<input required type="url" placeholder="https://example.com" value={source} onChange={(e) => setSource(e.target.value)} style={{ ...field, display: "block", marginTop: 5 }} /></label>
        <label style={{ fontSize: 12, color: "var(--muted)" }}>New site name<input required maxLength={100} placeholder="My business" value={name} onChange={(e) => setName(e.target.value)} style={{ ...field, display: "block", marginTop: 5 }} /></label>
        <label style={{ fontSize: 12, color: "var(--muted)" }}>Business type<select value={type} onChange={(e) => setType(e.target.value)} style={{ ...field, display: "block", marginTop: 5 }}>{[["website","Website"],["store","Online store"],["portfolio","Portfolio"],["community","Community"],["service","Service business"],["other","Other"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <label style={{ gridColumn: "1 / -1", display: "flex", gap: 9, alignItems: "flex-start", fontSize: 12, color: "var(--muted)" }}><input type="checkbox" checked={authorized} onChange={(e) => setAuthorized(e.target.checked)} />I own this site or have permission to copy and migrate its content.</label>
        <button className="ai-go" disabled={busy || !authorized} style={{ justifySelf: "start", padding: "9px 18px" }}>{busy ? "Scanning…" : "Scan and build plan"}</button>
      </form>
      <p style={{ color: "var(--muted)", fontSize: 11, marginTop: 9 }}>Scans up to seven public HTTPS pages and stores page titles, short text excerpts, links, and image URLs for the migration review. It won’t change your source site or billing. Payment methods and subscriptions are not transferred by this website scan.</p>
    </div>
    {error && <p role="alert" style={{ color: "#ff8787", margin: "10px 0" }}>{error}</p>}{note && <p role="status" style={{ color: "var(--amber)", margin: "10px 0" }}>{note}</p>}
    {scan?.scan && <div style={{ ...box, marginBottom: 16 }}>
      <h2 style={{ color: "var(--amber)", fontSize: 18 }}>2 · Review the scan</h2>
      <p style={{ color: "var(--muted)", fontSize: 12, overflowWrap: "anywhere", margin: "6px 0 12px" }}>{scan.scan.domain} · {scan.scan.scannedAt ? new Date(scan.scan.scannedAt).toLocaleString() : ""}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 8, marginBottom: 14 }}>{[["Pages found",scan.scan.signals.pages],["Internal links",scan.scan.signals.internalLinks],["Images",scan.scan.signals.images],["Checkout signals",scan.scan.signals.checkout?"Yes":"No"],["Contact forms",scan.scan.signals.contactForms],["Product data",scan.scan.signals.structuredProducts?"Found":"Not found"]].map(([k,v])=><div key={k} style={{ ...box, padding: 10 }}><small style={{ color: "var(--muted)" }}>{k}</small><b style={{ display: "block", color: "var(--amber)", fontSize: 18 }}>{v}</b></div>)}</div>
      <div style={{ display: "grid", gap: 6, maxHeight: 250, overflow: "auto" }}>{scan.scan.pages.map((p) => <div key={p.url} style={{ borderTop: "1px solid var(--line)", padding: "8px 0" }}><b>{p.title}</b><div style={{ color: "var(--muted)", fontSize: 11, overflowWrap: "anywhere" }}>{p.url}</div>{p.description && <p style={{ fontSize: 12, marginTop: 4 }}>{p.description}</p>}{p.text && <p style={{ color: "var(--muted)", fontSize: 11, lineHeight: 1.5, marginTop: 4 }}>{p.text.slice(0, 360)}</p>}</div>)}</div>
      {scan.status === "ownership_required" && <div style={{ borderTop: "1px solid var(--line)", marginTop: 12, paddingTop: 12 }}><h3 style={{ fontSize: 14 }}>3 · Prove domain control</h3><p style={{ color: "var(--muted)", fontSize: 12, margin: "6px 0" }}>Create a plain text file at <code>https://{scan.scan.domain}/.well-known/hakster-migration.txt</code> containing this exact line:</p><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", background: "#080b12", padding: 10, borderRadius: 8 }}>{scan.verification_token}</pre><button className="ai-go" disabled={busy} onClick={verify} style={{ marginTop: 9, padding: "8px 14px" }}>{busy ? "Checking…" : "Verify domain control"}</button></div>}
      {scan.status === "verified" && <div style={{ borderTop: "1px solid var(--line)", marginTop: 12, paddingTop: 12 }}><h3 style={{ fontSize: 14 }}>3 · Submit when ready</h3><p style={{ color: "var(--muted)", fontSize: 12, margin: "6px 0 10px" }}>This sends the scan to the migration queue. Your current site and billing remain unchanged until a separate cutover is agreed.</p><button className="ai-go" disabled={busy} onClick={submit} style={{ padding: "8px 14px" }}>{busy ? "Submitting…" : "Request migration"}</button></div>}
      {scan.status !== "ownership_required" && scan.status !== "verified" && <p style={{ color: "var(--amber)", marginTop: 10 }}>Status: {statusLabel[scan.status] || scan.status}</p>}
    </div>}
    <section style={box}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><h2 style={{ color: "var(--amber)", fontSize: 18 }}>Your migration requests</h2><button className="ai-go" onClick={reload} style={{ padding: "5px 9px", fontSize: 10 }}>Refresh</button></div>{!rows.length ? <p className="sec-sub" style={{ marginTop: 8 }}>No migration requests yet.</p> : <div style={{ display: "grid", gap: 9, marginTop: 10 }}>{rows.map((r)=><div key={r.id} style={{ border: "1px solid var(--line)", borderRadius: 9, padding: 11 }}><div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between" }}><b>{r.project_name} · {r.scan?.domain || r.source_url}</b><b style={{ color: "var(--amber)" }}>{statusLabel[r.status] || r.status}</b></div>{r.admin_note && <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 5 }}>{r.admin_note}</p>}<button className="ai-go" onClick={() => { setScan({ id: r.id, status: r.status, verification_token: r.verification_token, scan: r.scan }); setSource(r.source_url); setName(r.project_name); setType(r.business_type); }} style={{ padding: "5px 10px", fontSize: 10, marginTop: 7 }}>Open request</button></div>)}</div>}</section>
  </div>;
}
