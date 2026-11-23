import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";

/* Real messaging: REST threads/messages + live refresh over /ws */

/* quick emoji set for the composer picker */
const EMOJIS = ["😀","😂","🤝","👍","🙏","🔥","🚚","🛻","📦","🪢","💪","🎉","😍","😎","🤔","😅","⚡","💰","📍","🕐","✅","❌","❤️","🤠"];
/* smart text: auto-correct common typos + punctuation/space cleanup as you type */
function smartText(s) {
  const fixes = { teh: "the", recieve: "receive", seperate: "separate", definately: "definitely", adress: "address", tomorow: "tomorrow", wich: "which", wich: "which", thier: "their", becuase: "because", wut: "what", u: "you", ur: "your", r: "are", plz: "please", thx: "thanks", tysm: "thanks so much", idk: "I don't know", imo: "IMO", asap: "ASAP", ill: "I'll", ive: "I've", cant: "can't", dont: "don't", wont: "won't", didnt: "didn't", doesnt: "doesn't", isnt: "isn't", wasnt: "wasn't", couldnt: "couldn't", shouldnt: "shouldn't", wouldnt: "wouldn't", youre: "you're", theyre: "they're", lets: "let's", thats: "that's", hes: "he's", shes: "she's", aint: "isn't", gonna: "going to", wanna: "want to", kinda: "kind of", ok: "OK", okk: "OK", okey: "OK", yeah: "yeah", yes: "yes", no: "no", hey: "Hey", hi: "Hi", hello: "Hello", thnakyou: "thank you", thankyou: "thank you", welcom: "welcome", great: "great", awsome: "awesome", awsome1: "awesome", grat: "great", gret: "great", trailor: "trailer", traler: "trailer", trailr: "trailer", hich: "hitch", hitck: "hitch", toad: "tow", monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday" };
  return s
    .replace(/\b\w+\b/g, (w) => { const k = w.toLowerCase(); return fixes[k] ? (w[0] === w[0].toUpperCase() ? fixes[k][0].toUpperCase() + fixes[k].slice(1) : fixes[k]) : w; })
    .replace(/\s+([,.!?;:])/g, "$1")            // no space before punctuation
    .replace(/([,.!?;:])(?=[^\s\d])/g, "$1 ")   // space after punctuation
    .replace(/ {2,}/g, " ");                    // collapse doubles
}

/* per-user identity: deterministic hue from user_id (stable across threads) */
const PALETTE = ["#f5b325", "#ff8a3d", "#59d499", "#5ba7f7", "#c678dd", "#f7b85b", "#7fd1c0", "#e0a458"];
function userColor(id) { const n = Math.abs(Number(id) || 0); return PALETTE[n % PALETTE.length]; }
function initials(name) {
  const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
}
function Avatar({ id, name, size = 28 }) {
  return (
    <span className="bav" style={{ width: size, height: size, fontSize: size * 0.4, background: userColor(id) }}>
      {initials(name)}
    </span>
  );
}

export default function Messages({ route }) {
  const [threads, setThreads] = useState(null);
  const [activeId, setActiveId] = useState(route.param ? Number(route.param) : null);
  const [thread, setThread] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [err, setErr] = useState("");
  const scroller = useRef(null);
  const wsRef = useRef(null);

  const loadThreads = () => api("GET", "/api/messages/threads").then((r) => { setThreads(r.rows); if (!activeId && r.rows[0]) setActiveId(r.rows[0].id); }).catch((e) => setErr(e.message));
  useEffect(() => { loadThreads(); }, []);
  useEffect(() => {
    if (!activeId) return;
    api("GET", `/api/messages/${activeId}`).then((r) => { setThread(r.thread); setMsgs(r.rows); loadThreads(); }).catch((e) => setErr(e.message));
  }, [activeId]);
  // live: watch thread ids over websocket
  useEffect(() => {
    if (!threads || !getToken()) return;
    const tok = getToken();
    const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws?token=${tok}&threads=${threads.map((t) => t.id).join(",")}`);
    ws.onmessage = (ev) => {
      try {
        if (JSON.parse(ev.data).type === "refresh") {
          loadThreads();
          if (activeId) api("GET", `/api/messages/${activeId}`).then((r) => setMsgs(r.rows));
        }
      } catch {}
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

  if (getToken() === "") return <div className="page"><h1 className="sec-title">Messages</h1><p className="sec-sub">Log in first — messaging is account-based: <button className="cta-line" style={{ background: "none", border: 0, padding: 0, font: "inherit", color: "var(--amber)", cursor: "pointer" }} onClick={() => { location.href = "/api/auth/google"; }}>log in with Google</button></p></div>;

  return (
    <div className="page messages">
      <h1 className="sec-title">Messages</h1>
      {err && <p className="coupon-no">{err}</p>}
      <div className="msg-shell">
        <aside className="inbox">
          {threads?.map((t) => (
            <button key={t.id} className={"thread" + (t.id === activeId ? " on" : "") + (t.unread ? " has-unread" : "")} onClick={() => setActiveId(t.id)}>
              <b>{t.title && t.title.indexOf("Team") >= 0 ? "🚚 Rent My Trailer — Team" : t.role === "owner" ? "Renter" : t.title}</b>
              <span>{t.last ? t.last.slice(0, 60) : "no messages yet"}</span>
              {t.unread > 0 && <em className="unreadchip" title={`${t.unread} unread`}>{t.unread > 9 ? "9+" : t.unread}</em>}
              {t.clearance !== "approved" && <em className="gatechip">{t.clearance}</em>}
            </button>
          ))}
          {threads && threads.length === 0 && (
            <div className="dnote inbox-empty" style={{ padding: 18 }}>
              <b>No conversations yet</b>
              <p style={{ margin: "6px 0 10px" }}>Find a trailer you like and hit <b>Message owner</b> — your chats land here.</p>
              <a className="cta-line" href="#/browse" style={{ display: "inline-block" }}>Browse trailers →</a>
            </div>
          )}
        </aside>
        <section className="threadbar">
          {!thread ? <div className="empty" style={{ paddingTop: "18vh" }}>Pick a conversation</div> : (
            <>
              <header className="threadhead">
                <Avatar id={thread.id * 7 + 3} name={thread.title} size={38} />
                <div>
                  <h3>{thread.title}</h3>
                  <span className="threadhead-meta">#{thread.id} · clearance: <b style={{ color: thread.clearance === "approved" ? "var(--ok)" : "var(--amber)" }}>{thread.clearance}</b> · you are the {thread.role}</span>
                  <span className="threadhead-meta" style={{ display: "block", marginTop: 2 }}>📱 founding 1,000 share phone numbers free · after the seats fill it's premium + 10% fee &amp; CA tax</span>
                </div>
              </header>
              <div className="bubbles" ref={scroller}>
                {msgs.map((m) => (
                  <div key={m.id} className={"bubble " + (m.user_id === user?.()?.id ? "mine" : "theirs")}>
                    <Avatar id={m.user_id} name={m.display_name} />
                    <div className="bwrap">
                      <p>{m.text}</p>
                      <small>{m.display_name} · {m.sent_on}</small>
                    </div>
                  </div>
                ))}
              </div>
              <div className="composer" style={{ position: "relative" }}>
                {emojiOpen && (
                  <div style={{ position: "absolute", bottom: "100%", right: 8, marginBottom: 6, background: "var(--char2)", border: "1px solid var(--amber)", borderRadius: 10, padding: 8, display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 2, boxShadow: "0 10px 30px rgba(0,0,0,.5)", zIndex: 5 }}>
                    {EMOJIS.map((em) => (
                      <button key={em} onClick={() => { setDraft((d) => d + em); }} style={{ background: "none", border: 0, fontSize: 18, cursor: "pointer", padding: "3px 4px", lineHeight: 1 }}>{em}</button>
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => setEmojiOpen(!emojiOpen)} title="Emoji" aria-label="Insert emoji" style={{ background: "none", border: 0, fontSize: 20, cursor: "pointer", padding: "0 10px", lineHeight: 1 }}>😀</button>
                <input value={draft} onChange={(e) => setDraft(smartText(e.target.value))} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Message…" aria-label="Message draft" style={{ background: "transparent", border: 0, color: "var(--paper)", padding: "14px 10px", outline: "none", flex: 1 }} />
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
