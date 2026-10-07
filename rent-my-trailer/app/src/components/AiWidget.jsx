import { useState, useRef, useEffect } from "react";
import badge from "../assets/rmt-badge.jpg";

/* Floating AI assistant — bottom-right tab. Real backend: POST /api/ai/chat,
   POST /api/ai/listing (description → structured draft that prefills Post). */

export default function AiWidget({ onListingDraft, contextLine }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("chat"); // chat | list
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState([]); // {me, text}
  const [extracted, setExtracted] = useState(null);
  const scroller = useRef(null);

  useEffect(() => { scroller.current?.scrollTo(0, scroller.current.scrollHeight); }, [msgs, busy]);

  const token = localStorage.getItem("rmt-token") || "";
  const call = async (url, body, needAuth = false) => {
    const headers = { "Content-Type": "application/json", ...(needAuth && token ? { Authorization: `Bearer ${token}` } : {}) };
    const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `${r.status}`);
    return j;
  };

  const sendChat = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    const next = [...msgs, { me: 1, text }];
    setMsgs(next);
    setBusy(true);
    try {
      const j = await call("/api/ai/chat", {
        messages: next.slice(-10).map((m) => ({ role: m.me ? "user" : "assistant", content: m.text })),
      });
      setMsgs((prev) => [...prev, { me: 0, text: j.reply }]);
    } catch (e) {
      setMsgs((prev) => [...prev, { me: 0, text: `AI unavailable (${e.message}) — check RMT_OLLAMA connectivity.` }]);
    }
    setBusy(false);
  };

  const extractListing = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const j = await call("/api/ai/listing", { text }, true);
      setExtracted(j.listing);
    } catch (e) {
      setMsgs((prev) => [...prev, { me: 0, text: `Listing extraction failed: ${e.message}. Log in first (it calls /api/ai/listing with your token).` }]);
    }
    setBusy(false);
    setDraft("");
  };

  return (
    <>
      <button className="ai-fab" onClick={() => setOpen(!open)} aria-label="AI assistant" title="AI assistant">
        {open ? "×" : <img src={badge} alt="HaksterAI" style={{ width: "68%", height: "68%", objectFit: "cover", borderRadius: "50%", pointerEvents: "none", display: "block" }} />}
      </button>
      {open && (
        <div className="ai-panel">
          <div className="ai-head">
            <b>RMT Assistant</b>
            <div className="ai-modes">
              <button className={mode === "chat" ? "on" : ""} onClick={() => setMode("chat")}>Chat</button>
              <button className={mode === "list" ? "on" : ""} onClick={() => setMode("list")}>List my trailer</button>
            </div>
          </div>
          {mode === "list" ? (
            <div className="ai-body">
              <p className="ai-hint">
                Paste <b>your trailer description</b> — anything: make, size, rates, where it sits. The AI drafts a listing; you edit and publish.
              </p>
              <textarea
                rows="4"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={'e.g. "2021 Big Tex 7x14 dump trailer, 14k GVWR, ramps, sits in Kerrville TX, want ~$150/day, $200 deposit, deliver 20 miles"'}
              />
              <button className="ai-go" disabled={busy || !draft.trim()} onClick={extractListing}>
                {busy ? "Drafting…" : "Draft my listing →"}
              </button>
              {extracted && (
                <div className="ai-extracted">
                  <b>Structured draft</b>
                  <pre>{JSON.stringify(extracted, null, 1)}</pre>
                  <a
                    href={"#/post"}
                    onClick={() => { onListingDraft?.(extracted); setOpen(false); }}
                    className="cta-line"
                  >
                    Open in publish form with this prefilled →
                  </a>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="ai-body bubbles" ref={scroller}>
                {msgs.length === 0 && (
                  <p className="ai-hint">
                    Ask about trailers, rates ({COUPONS[0]?.code} and friends), deposits, or the photo check.{" "}
                    {contextLine ? `Context: ${contextLine}` : ""}
                  </p>
                )}
                {msgs.map((m, i) => (
                  <div key={i} className={"bubble " + (m.me ? "mine" : "theirs")}><p>{m.text}</p></div>
                ))}
                {busy && <div className="bubble theirs"><p>…</p></div>}
              </div>
              <div className="composer">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                  placeholder="Ask the assistant…"
                />
                <button onClick={sendChat}>Send</button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}