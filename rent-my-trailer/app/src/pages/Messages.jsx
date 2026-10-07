import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";

/* Real messaging: REST threads/messages + live refresh over /ws */
export default function Messages({ route }) {
  const [threads, setThreads] = useState(null);
  const [activeId, setActiveId] = useState(route.param ? Number(route.param) : null);
  const [thread, setThread] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState("");
  const scroller = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => { api("GET", "/api/messages/threads").then((r) => { setThreads(r.rows); if (!activeId && r.rows[0]) setActiveId(r.rows[0].id); }).catch((e) => setErr(e.message)); }, []);
  useEffect(() => {
    if (!activeId) return;
    api("GET", `/api/messages/${activeId}`).then((r) => { setThread(r.thread); setMsgs(r.rows); }).catch((e) => setErr(e.message));
  }, [activeId]);
  // live: watch thread ids over websocket
  useEffect(() => {
    if (!threads || !getToken()) return;
    const tok = getToken();
    const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws?token=${tok}&threads=${threads.map((t) => t.id).join(",")}`);
    ws.onmessage = (ev) => {
      try { if (JSON.parse(ev.data).type === "refresh" && activeId) api("GET", `/api/messages/${activeId}`).then((r) => setMsgs(r.rows)); } catch {}
    };
    wsRef.current = ws;
    return () => ws.close();
  }, [threads?.length && activeId]); // eslint-disable-line
  useEffect(() => { scroller.current?.scrollTo(0, scroller.current.scrollHeight); }, [msgs.length, activeId]);

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    try {
      const r = await api("POST", `/api/messages/${activeId}`, { text });
      const got = await api("GET", `/api/messages/${activeId}`);
      setMsgs(got.rows); setThread(got.thread);
    } catch (e) { setErr(e.message); }
  };

  if (getToken() === "") return <div className="page"><h1 className="sec-title">Messages</h1><p className="sec-sub">Log in first — messaging is account-based: <a className="cta-line" href="#/post">log in / sign up</a></p></div>;

  return (
    <div className="page messages">
      <h1 className="sec-title">Messages</h1>
      {err && <p className="coupon-no">{err}</p>}
      <div className="msg-shell">
        <aside className="inbox">
          {threads?.map((t) => (
            <button key={t.id} className={"thread" + (t.id === activeId ? " on" : "")} onClick={() => setActiveId(t.id)}>
              <b>{t.role === "owner" ? "Renter" : t.title}</b>
              <span>{t.last ? t.last.slice(0, 60) : "no messages yet"}</span>
              {t.clearance !== "approved" && <em className="gatechip">{t.clearance}</em>}
            </button>
          ))}
          {threads && threads.length === 0 && <div className="dnote" style={{ padding: 14 }}>No conversations yet — message from any listing or book one.</div>}
        </aside>
        <section className="threadbar">
          {!thread ? <div className="empty" style={{ paddingTop: "18vh" }}>Pick a conversation</div> : (
            <>
              <header className="threadhead">
                <h3>{thread.title}</h3>
                <span>#{thread.id} · clearance: {thread.clearance} · you are the {thread.role}</span>
              </header>
              <div className="bubbles" ref={scroller}>
                {msgs.map((m) => (
                  <div key={m.id} className={"bubble " + (m.user_id === user?.()?.id ? "mine" : "theirs")}>
                    <p>{m.text}</p>
                    <small>{m.display_name} · {m.sent_on}</small>
                  </div>
                ))}
              </div>
              <div className="composer">
                <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Message…" aria-label="Message draft" />
                <button onClick={send}>Send</button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function getToken() { return localStorage.getItem("rmt-token") || ""; }
function user() { try { return JSON.parse(localStorage.getItem("rmt-user") || "null"); } catch { return null; } }
