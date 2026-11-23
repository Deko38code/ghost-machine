import { useEffect, useState } from "react";
import { api, getToken, user } from "../lib/api.js";

const field = { width: "100%", boxSizing: "border-box", padding: "11px 13px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--asphalt)", color: "var(--fg, #eee)", font: "inherit" };

export default function Community() {
  const [rows, setRows] = useState(null);
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [commentDraft, setCommentDraft] = useState({});
  const token = getToken();
  const load = () => api("GET", "/api/community/feed").then((r) => setRows(r.rows || [])).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const post = async (e) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true); setErr("");
    try {
      await api("POST", "/api/community/posts", { text, link });
      setText(""); setLink(""); await load();
    } catch (e2) { setErr(e2.message); }
    finally { setBusy(false); }
  };
  const like = async (id) => {
    try { await api("POST", `/api/community/posts/${id}/like`, {}); await load(); }
    catch (e) { setErr(e.message); }
  };
  const comment = async (e, id) => {
    e.preventDefault();
    const content = String(commentDraft[id] || "").trim();
    if (!content) return;
    try {
      await api("POST", `/api/community/posts/${id}/comments`, { text: content });
      setCommentDraft((d) => ({ ...d, [id]: "" })); await load();
    } catch (e2) { setErr(e2.message); }
  };
  const remove = async (id) => {
    try { await api("DELETE", `/api/community/posts/${id}`); await load(); }
    catch (e) { setErr(e.message); }
  };

  return (
    <div className="page" style={{ maxWidth: 850 }}>
      <div style={{ margin: "16px 0 22px" }}>
        <p style={{ color: "var(--amber)", fontSize: 11, fontWeight: 800, letterSpacing: ".16em", marginBottom: 6 }}>RENTERS · OWNERS · BUILDERS</p>
        <h1 className="sec-title" style={{ marginBottom: 6 }}>The Haul Community</h1>
        <p className="sec-sub">Share a haul, ask the group, find a local owner, or pass along a campaign from the network.</p>
      </div>
      {token ? <form onSubmit={post} className="dphoto" style={{ padding: 16, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <img src={user()?.picture || ""} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", background: "var(--char2)" }} />
          <div><b>{user()?.display_name || "Community member"}</b><small style={{ display: "block", color: "var(--muted)" }}>Start a conversation</small></div>
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={1200} placeholder="What are you hauling, building, or looking for?" style={{ ...field, resize: "vertical" }} />
        <div style={{ display: "flex", gap: 8, marginTop: 9, flexWrap: "wrap" }}>
          <input value={link} onChange={(e) => setLink(e.target.value)} maxLength={500} type="url" placeholder="Share a campaign or useful link (optional)" style={{ ...field, flex: "1 1 270px" }} />
          <button className="ai-go" disabled={busy || !text.trim()} style={{ padding: "9px 18px" }}>{busy ? "Posting…" : "Post to community"}</button>
        </div>
        <small style={{ display: "block", textAlign: "right", color: "var(--muted)", marginTop: 5 }}>{text.length}/1200</small>
      </form> : <div className="dphoto" style={{ padding: 16, marginBottom: 18 }}><b>Join the conversation</b><p className="sec-sub">Sign in to post, like, and reply.</p><button className="ai-go" onClick={() => dispatchEvent(new CustomEvent("rmt-auth", { detail: "google" }))}>Sign in to join</button></div>}
      {err && <p role="alert" className="coupon-no">{err}</p>}
      {rows === null && <p className="sec-sub">Loading community…</p>}
      {rows?.length === 0 && <div className="dphoto" style={{ padding: 24, textAlign: "center" }}><b>The feed starts here.</b><p className="sec-sub">Share the first tip, haul story, or campaign link.</p></div>}
      <div style={{ display: "grid", gap: 13 }}>
        {(rows || []).map((p) => <article key={p.id} className="dphoto" style={{ padding: 16 }}>
          <header style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center", overflow: "hidden", color: "#16181b", background: "var(--amber)", fontWeight: 900 }}>
              {p.picture ? <img src={p.picture} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : String(p.display_name || "H").slice(0, 1).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}><b>{p.display_name || "Community member"}</b><small style={{ display: "block", color: "var(--muted)" }}>{p.created_on}</small></div>
            {p.user_id === user()?.id || user()?.role === "admin" ? <button aria-label="Delete post" onClick={() => remove(p.id)} style={{ border: 0, background: "none", color: "var(--muted)", cursor: "pointer" }}>Delete</button> : null}
          </header>
          <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, margin: "0 0 12px" }}>{p.text}</p>
          {p.link && <a href={p.link} target="_blank" rel="noreferrer" style={{ display: "block", overflowWrap: "anywhere", color: "var(--amber)", border: "1px solid var(--line)", borderRadius: 9, padding: 11, marginBottom: 12 }}>{p.link} ↗</a>}
          <div style={{ display: "flex", gap: 12, alignItems: "center", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", padding: "8px 0", color: "var(--muted)", fontSize: 12 }}>
            <button disabled={!token} onClick={() => like(p.id)} style={{ border: 0, background: "none", color: p.liked ? "var(--amber)" : "var(--muted)", cursor: token ? "pointer" : "default", font: "inherit" }}>{p.liked ? "♥ Liked" : "♡ Like"} · {p.likes}</button>
            <span>{p.comments.length} replies</span>
          </div>
          {p.comments.map((c) => <div key={c.id} style={{ display: "flex", gap: 8, paddingTop: 11, fontSize: 12.5 }}><b style={{ color: "var(--amber)", whiteSpace: "nowrap" }}>{c.display_name}</b><span style={{ whiteSpace: "pre-wrap" }}>{c.text}</span></div>)}
          {token && <form onSubmit={(e) => comment(e, p.id)} style={{ display: "flex", gap: 8, marginTop: 11 }}><input value={commentDraft[p.id] || ""} maxLength={500} onChange={(e) => setCommentDraft((d) => ({ ...d, [p.id]: e.target.value }))} placeholder="Write a reply…" style={{ ...field, padding: "8px 10px" }} /><button className="ai-go" disabled={!String(commentDraft[p.id] || "").trim()} style={{ padding: "7px 12px" }}>Reply</button></form>}
        </article>)}
      </div>
    </div>
  );
}
