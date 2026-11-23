import { useEffect, useState } from "react";

/* On-site ad popup: promotes the latest posted social ad (from Ad Studio's
 * social_posts table). Shows once per browser session, 5s after load. */
export function AdPopup() {
  const [post, setPost] = useState(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    let timer = null;
    fetch("/api/ads/popup")
      .then((r) => r.json())
      .then((d) => {
        if (!d?.post) return;
        setPost(d.post);
        if (!sessionStorage.getItem("rmt-adpopup")) {
          timer = setTimeout(() => {
            sessionStorage.setItem("rmt-adpopup", "1");
            setShow(true);
          }, 5000);
        }
      })
      .catch(() => {});
    const onKey = (e) => { if (e.key === "Escape") setShow(false); };
    addEventListener("keydown", onKey);
    return () => { clearTimeout(timer); removeEventListener("keydown", onKey); };
  }, []);

  if (!show || !post) return null;

  const chipStyle = post.channel === "instagram"
    ? { background: "#1ce1e2", color: "#0d1117" }
    : { background: "#4067a9", color: "#fff" };

  return (
    <div
      onClick={() => setShow(false)}
      style={{ position: "fixed", inset: 0, zIndex: 20000, background: "rgba(5,7,10,.93)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", maxWidth: 420, width: "100%", background: "#0d1117", border: "1px solid #f5b325", borderRadius: 18, padding: 22, boxShadow: "0 14px 50px rgba(0,0,0,.6)" }}
      >
        <button
          onClick={() => setShow(false)}
          aria-label="Dismiss"
          style={{ position: "absolute", top: 10, right: 12, background: "none", border: "none", color: "#8b949e", fontSize: 20, cursor: "pointer", lineHeight: 1 }}
        >×</button>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ ...chipStyle, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, letterSpacing: ".04em", textTransform: "capitalize" }}>
            {post.channel === "instagram" ? "Instagram" : "Facebook"}
          </span>
        </div>
        {post.img && <img src={post.img} alt="" style={{ width: "100%", borderRadius: 12, display: "block", marginBottom: 12 }} />}
        {post.caption && <div style={{ fontSize: 13.5, color: "#d5dbe2", whiteSpace: "pre-wrap", marginBottom: 12 }}>{post.caption}</div>}
        {post.post_url && (
          <a href={post.post_url} target="_blank" rel="noreferrer" style={{ color: "var(--amber)", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
            See it live →
          </a>
        )}
        <div style={{ marginTop: 14, color: "#8b949e", fontSize: 11 }}>Rent My Trailer — founders keep 92%</div>
      </div>
    </div>
  );
}