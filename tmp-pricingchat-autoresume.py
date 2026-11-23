#!/usr/bin/env python3
"""PricingChat: same auto-resume store as the site chat widget (shared key)."""
import shutil, sys, time

COPIES = [
    '/home/ghost694/workspace/dekekenneth840@gmail.com/junkalot/src/app/pricing/PricingChat.tsx',
    '/home/ghost694/junkalot/src/app/pricing/PricingChat.tsx',
]

CONSTANTS = '''
// 2026-11-17 (owner): "add auto resume to my clients sessions ... if servers restarts etc".
// Same store and same key as the site-wide chat widget, so a customer who starts on the
// pricing page and continues in the bubble (or reloads through a deploy) keeps one thread.
// Browser-only: nothing is sent to a server and nothing is shared between visitors.
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

function writeStoredSession(thread: Message[]) {
  try {
    if (!thread.length) {
      localStorage.removeItem(STORE_KEY)
      return
    }
    const payload: StoredSession = { at: Date.now(), messages: thread.slice(-MAX_STORED_MESSAGES) }
    localStorage.setItem(STORE_KEY, JSON.stringify(payload))
  } catch {
    // Private mode or full quota: the chat still works, it just will not resume.
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
    (
        "\nexport default function PricingChat() {\n",
        CONSTANTS + "export default function PricingChat() {\n",
    ),
    (
        "  const [streaming, setStreaming] = useState(false)\n",
        "  const [streaming, setStreaming] = useState(false)\n"
        "  const [resumed, setResumed] = useState(false)\n",
    ),
    (
        "  useEffect(() => {\n    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })\n  }, [messages])\n",
        "  // Resume the saved thread after a reload, a deploy, or a server restart.\n"
        "  useEffect(() => {\n"
        "    const stored = readStoredSession()\n"
        "    if (stored.length) {\n"
        "      setMessages(stored)\n"
        "      setResumed(true)\n"
        "    }\n"
        "  }, [])\n"
        "\n"
        "  // Persist once the reply has settled, and only after the customer has spoken.\n"
        "  useEffect(() => {\n"
        "    if (loading || streaming) return\n"
        "    if (!messages.some((m) => m.role === 'user')) return\n"
        "    writeStoredSession(messages)\n"
        "  }, [messages, loading, streaming])\n"
        "\n"
        "  function startFresh() {\n"
        "    clearStoredSession()\n"
        "    setResumed(false)\n"
        "    setMessages([\n"
        "      {\n"
        '        role: \'assistant\',\n'
        '        content: "Hi! I\'m here to help you book a junk removal appointment or answer questions about our services.\\n\\nFor pricing, call (510) 435-4721 or book online for a free, no-obligation estimate. We\'ll confirm the exact price on-site before we start — no surprises!",\n'
        "      },\n"
        "    ])\n"
        "  }\n"
        "\n"
        "  useEffect(() => {\n    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })\n  }, [messages])\n",
    ),
    (
        '        <span className="text-xs text-gray-600 ml-auto">Contra Costa & East Bay AI</span>\n',
        '        <span className="ml-auto flex items-center gap-3">\n'
        '          {messages.some((m) => m.role === \'user\') && (\n'
        '            <button onClick={startFresh} className="text-xs text-gray-300 hover:text-white underline" title="Start a new conversation">\n'
        '              New chat\n'
        '            </button>\n'
        '          )}\n'
        '          <span className="text-xs text-gray-600">Contra Costa & East Bay AI</span>\n'
        '        </span>\n',
    ),
    (
        '      <div className="h-80 overflow-y-auto p-4 space-y-3 bg-[#f0eee7]">\n',
        '      <div className="h-80 overflow-y-auto p-4 space-y-3 bg-[#f0eee7]">\n'
        '        {resumed && (\n'
        '          <div className="text-[11px] text-gray-500 bg-[#f8f6f0] border border-[#c8c3b8] rounded-lg px-2 py-1">\n'
        '            Resumed your last chat.\n'
        '          </div>\n'
        '        )}\n',
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
