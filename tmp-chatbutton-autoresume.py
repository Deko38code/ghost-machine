#!/usr/bin/env python3
"""Additive patch: client chat auto-resume across reloads / deploys / server restarts."""
import shutil, sys, time

COPIES = [
    '/home/ghost694/workspace/dekekenneth840@gmail.com/junkalot/src/components/ChatButton.tsx',
    '/home/ghost694/junkalot/src/components/ChatButton.tsx',
]

CONSTANTS = '''
// 2026-11-17 (owner): "add auto resume to my clients sessions ... if servers restarts etc".
//
// /api/chat is stateless — the widget resends the whole thread every time — so the
// conversation only needs to survive in the browser. Each finished exchange is written
// to this browser's localStorage and restored on load, which means a page reload, a
// deploy, or a server restart no longer drops a customer mid-conversation. Nothing is
// sent to any server or shared between visitors; "New chat" clears it.
const STORE_KEY = 'junkalot-chat-session-v1'
const STORE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_STORED_MESSAGES = 40

type StoredSession = { at: number; messages: Message[] }

function readStoredSession(): Message[] {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as StoredSession
    if (!parsed || !Array.isArray(parsed.messages)) return []
    if (!Number.isFinite(parsed.at) || Date.now() - parsed.at > STORE_TTL_MS) {
      localStorage.removeItem(STORE_KEY)
      return []
    }
    return parsed.messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .slice(-MAX_STORED_MESSAGES)
  } catch {
    return []
  }
}

function writeStoredSession(messages: Message[]) {
  try {
    if (!messages.length) {
      localStorage.removeItem(STORE_KEY)
      return
    }
    const payload: StoredSession = { at: Date.now(), messages: messages.slice(-MAX_STORED_MESSAGES) }
    localStorage.setItem(STORE_KEY, JSON.stringify(payload))
  } catch {
    // Private mode or a full quota: the chat still works, it just will not resume.
  }
}

function clearStoredSession() {
  try {
    localStorage.removeItem(STORE_KEY)
  } catch {
    // Nothing stored to clear.
  }
}

'''

EDITS = [
    # 1 — store helpers before the component
    (
        "\nexport default function ChatButton() {\n",
        CONSTANTS + "export default function ChatButton() {\n",
    ),
    # 2 — resumed flag
    (
        "  const [streaming, setStreaming] = useState(false)\n",
        "  const [streaming, setStreaming] = useState(false)\n"
        "  const [resumed, setResumed]     = useState(false)\n",
    ),
    # 3 — restore on mount + persist when an exchange settles
    (
        "  useEffect(() => {\n    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })\n  }, [messages, open, streaming])\n",
        "  // 2026-11-17 (owner): resume the customer's thread after a reload or a server restart.\n"
        "  useEffect(() => {\n"
        "    const stored = readStoredSession()\n"
        "    if (stored.length) {\n"
        "      setMessages(stored)\n"
        "      setResumed(true)\n"
        "    }\n"
        "  }, [])\n"
        "\n"
        "  // Save once the reply has settled — never a half-streamed message, and never a\n"
        "  // thread where the customer has not said anything yet.\n"
        "  useEffect(() => {\n"
        "    if (loading || streaming) return\n"
        "    if (!messages.some((m) => m.role === 'user')) return\n"
        "    writeStoredSession(messages)\n"
        "  }, [messages, loading, streaming])\n"
        "\n"
        "  useEffect(() => {\n    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })\n  }, [messages, open, streaming])\n",
    ),
    # 4 — start-fresh helper
    (
        "  function dismissTooltip() {\n",
        "  // Clear the saved thread so the next visit starts clean.\n"
        "  function startFresh() {\n"
        "    clearStoredSession()\n"
        "    setResumed(false)\n"
        "    setGreeting(false)\n"
        "    setMessages([])\n"
        "  }\n"
        "\n"
        "  function dismissTooltip() {\n",
    ),
    # 5 — header control
    (
        '            <button onClick={() => setOpen(false)} className="text-gray-600 hover:text-white text-lg leading-none">✕</button>\n',
        '            <div className="flex items-center gap-3">\n'
        '              {messages.length > 0 && (\n'
        '                <button onClick={startFresh} className="text-gray-300 hover:text-white text-[11px] underline" title="Start a new conversation">\n'
        '                  New chat\n'
        '                </button>\n'
        '              )}\n'
        '              <button onClick={() => setOpen(false)} className="text-gray-600 hover:text-white text-lg leading-none">✕</button>\n'
        '            </div>\n',
    ),
    # 6 — resume notice above the thread
    (
        '          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f0eee7]">\n',
        '          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f0eee7]">\n'
        '            {resumed && messages.length > 0 && (\n'
        '              <div className="text-[11px] text-gray-500 bg-[#f8f6f0] border border-[#c8c3b8] rounded-lg px-2 py-1">\n'
        '                Resumed your last chat.\n'
        '              </div>\n'
        '            )}\n',
    ),
]


def apply(path):
    src = open(path, encoding='utf-8').read()
    if 'STORE_KEY' in src:
        print('SKIP already patched', path)
        return True
    for i, (old, new) in enumerate(EDITS, 1):
        n = src.count(old)
        if n != 1:
            print(f'FAIL {path}: edit {i} matched {n} time(s)')
            return False
        src = src.replace(old, new)
    open(path, 'w', encoding='utf-8').write(src)
    print('PATCHED', path)
    return True


ok = True
stamp = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())
for p in COPIES:
    shutil.copy2(p, p + '.bak-autoresume-' + stamp)
    ok = apply(p) and ok
sys.exit(0 if ok else 1)
