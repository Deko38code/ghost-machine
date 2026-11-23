#!/usr/bin/env python3
"""Additive patch: Junkalot update applet — park bottom-right while updating,
auto-hide once the progress bar finishes. Applied to both copies."""
import sys

COPY = '/home/ghost694/workspace/dekekenneth840@gmail.com/junkalot/src/components/UpdateToast.tsx'
MASTER = '/home/ghost694/junkalot/src/components/UpdateToast.tsx'

EDITS = [
    # 1 — constants
    (
        "const HIDE_AFTER_MS = 20000\n",
        "const HIDE_AFTER_MS = 20000\n"
        "// 2026-11-17 (owner): \"if update is starting it shows but make to right bottom\"\n"
        "// and \"make the update applet auto hide after update progress is done\". While the\n"
        "// bar runs the card parks in the bottom-right corner; once the bar reaches the end\n"
        "// it leaves on its own, and the page it reloads into does not throw the full card\n"
        "// back over the page.\n"
        "const DONE_HIDE_MS = 6000\n"
        "const RELOAD_HIDE_MS = 2500\n"
        "const DONE_MARK_KEY = 'junkalot-update-done-at'\n",
    ),
    # 2 — state
    (
        "  const [hideArm, setHideArm] = useState(0)\n",
        "  const [hideArm, setHideArm] = useState(0)\n"
        "  // 2026-11-17 (owner): auto-hide once the update bar has finished.\n"
        "  const [doneHidden, setDoneHidden] = useState(false)\n"
        "  const wasBusy = useRef(false)\n",
    ),
    # 3 — effects, right after the dock/hide effect
    (
        "  }, [dockable, hideArm])\n\n  const expand = useCallback(() => {",
        "  }, [dockable, hideArm])\n"
        "\n"
        "  // 2026-11-17 (owner): \"make the update applet auto hide after update progress is\n"
        "  // done\" — when the bar reaches the end the applet leaves on its own. A new build\n"
        "  // or a problem brings the full card straight back; nothing else is hidden.\n"
        "  const finished = !busy && (phase === 'done' || stage === 'restored')\n"
        "  useEffect(() => {\n"
        "    if (!finished) return\n"
        "    const t = window.setTimeout(() => setDoneHidden(true), DONE_HIDE_MS)\n"
        "    return () => window.clearTimeout(t)\n"
        "  }, [finished])\n"
        "  useEffect(() => {\n"
        "    if (busy) { wasBusy.current = true; setDoneHidden(false); return }\n"
        "    if (!wasBusy.current) return\n"
        "    wasBusy.current = false\n"
        "    const t = window.setTimeout(() => setDoneHidden(true), DONE_HIDE_MS)\n"
        "    return () => window.clearTimeout(t)\n"
        "  }, [busy])\n"
        "  // A page that loads right after an update starts docked instead of covering the\n"
        "  // page, and leaves again shortly after the build it reloaded into answers.\n"
        "  useEffect(() => {\n"
        "    try {\n"
        "      const at = Number(sessionStorage.getItem(DONE_MARK_KEY) || 0)\n"
        "      if (!at || Date.now() - at > 120000) return\n"
        "      sessionStorage.removeItem(DONE_MARK_KEY)\n"
        "      const t = window.setTimeout(() => setDoneHidden(true), RELOAD_HIDE_MS)\n"
        "      return () => window.clearTimeout(t)\n"
        "    } catch { return }\n"
        "  }, [])\n"
        "  useEffect(() => {\n"
        "    if (actionable || warn) setDoneHidden(false)\n"
        "  }, [actionable, warn])\n"
        "\n"
        "  const expand = useCallback(() => {",
    ),
    # 4 — remember the finished update across the reload
    (
        "      log('reload')\n      window.setTimeout(() => window.location.reload(), 900)",
        "      log('reload')\n"
        "      // 2026-11-17 (owner): the page we reload into knows the update just finished,\n"
        "      // so it docks instead of parking the full card over the page again.\n"
        "      try { sessionStorage.setItem(DONE_MARK_KEY, String(Date.now())) } catch {}\n"
        "      window.setTimeout(() => window.location.reload(), 900)",
    ),
    # 5 — hide the applet once done
    (
        "  return (\n    <aside\n      id=\"junkalot-update-toast\"\n      data-docked=\"false\"",
        "  // 2026-11-17 (owner): once the bar is done the applet is gone until something\n"
        "  // real shows up again (a ready build, maintenance, or the site not answering).\n"
        "  if (doneHidden && !actionable && !warn) return null\n"
        "\n"
        "  return (\n    <aside\n      id=\"junkalot-update-toast\"\n      data-docked=\"false\"",
    ),
    # 6 — bottom-right while the update runs
    (
        "      style={{\n"
        "        position: 'fixed',\n"
        "        top: 14,\n"
        "        left: '50%',\n"
        "        transform: 'translateX(-50%)',\n"
        "        zIndex: 90,\n"
        "        width: 'min(560px, calc(100vw - 28px))',\n",
        "      style={{\n"
        "        position: 'fixed',\n"
        "        // 2026-11-17 (owner): \"if update is starting it shows but make to right\n"
        "        // bottom\" — while the bar runs the card parks in the bottom-right corner.\n"
        "        ...(busy || phase === 'done'\n"
        "          ? { right: 16, bottom: 16, width: 'min(420px, calc(100vw - 32px))' }\n"
        "          : { top: 14, left: '50%', transform: 'translateX(-50%)', width: 'min(560px, calc(100vw - 28px))' }),\n"
        "        zIndex: 90,\n",
    ),
]


def apply(path):
    src = open(path, encoding='utf-8').read()
    for i, (old, new) in enumerate(EDITS, 1):
        n = src.count(old)
        if n != 1:
            print(f'FAIL {path}: edit {i} matched {n} time(s)')
            return False
        src = src.replace(old, new)
    open(path, 'w', encoding='utf-8').write(src)
    print(f'PATCHED {path} ({len(EDITS)} edits)')
    return True


ok = True
for p in (COPY, MASTER):
    ok = apply(p) and ok
sys.exit(0 if ok else 1)
