#!/usr/bin/env python3
"""Append-only brain entry (both Junkalot copies): customer chat auto-resume."""
import time

ENTRY = """

## 2026-11-17 — Customer chat auto-resumes across reloads and server restarts

Owner: "add auto resume to my clients sessions ... if servers restarts etc". Mr Ed's own saved
Coach sessions, memory banks and course progress are untouched — this entry is about the
customer-facing assistants.

What changed (BOTH copies):

- `src/components/ChatButton.tsx` (site-wide chat bubble) and `src/app/pricing/PricingChat.tsx`
  (pricing page chat) now save the finished thread to this browser's `localStorage` under one
  shared key, `junkalot-chat-session-v1`, and restore it on mount. `/api/chat` is stateless and
  receives the whole thread on every request, so a reload, a deploy, or a server restart no
  longer drops a customer mid-conversation — the next message continues the same context.
- Rules: 7-day TTL (a stale thread is dropped on read), capped at the last 40 messages, only
  `user`/`assistant` turns with non-empty text are kept, malformed JSON is ignored, and a quota
  or private-mode failure is swallowed so the chat keeps working without resuming. Nothing is
  sent to any server and nothing is shared between visitors.
- The thread is saved only after a reply settles (never a half-streamed message) and only once
  the customer has actually spoken, so opening the bubble and closing it does not create a
  stored session.
- UI: a "Resumed your last chat." line appears above the restored thread, and a "New chat"
  control clears the saved thread and returns the assistant's greeting.
- Because both surfaces use the same key, a customer who starts on the pricing page and
  continues in the bubble keeps one continuous thread.

Checks: `npx tsc --noEmit` exit 0 in BOTH trees; the shipped store helpers were lifted verbatim
from both files and exercised against a fake `localStorage` — 8/8 PASS each (empty, roundtrip,
invalid-entry filtering, malformed JSON, 7-day expiry, 40-message cap, clear, quota failure).
Backups: `*.bak-autoresume-20261117T*` next to each patched file in both trees.

Source-only — no build and no restart was run. It reaches the live site with the next
`npm run build:update` (scripts/stage-update.mjs), together with the bottom-right update card.
"""

for p in (
    '/home/ghost694/junkalot/docs/junkalot-brain-current.md',
    '/home/ghost694/workspace/dekekenneth840@gmail.com/junkalot/docs/junkalot-brain-current.md',
):
    open(p, 'a', encoding='utf-8').write(ENTRY)
    print('APPENDED', p, time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()))
