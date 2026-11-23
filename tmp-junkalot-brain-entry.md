
---

## 2026-11-17 — Update applet: bottom-right while updating, auto-hide when done

**Owner:** "lets make the junkalot.co update applet auto hide after update progress is dont
autohide" · "if update is starting it shows but make to right bottom".

**Change (src/components/UpdateToast.tsx, additive — no existing behavior removed)**
- While an update is starting or running (`busy`), or the bar has reached `phase === 'done'`,
  the card is positioned `right:16/bottom:16` at `min(420px, calc(100vw - 32px))` instead of
  `top:14/left:50%` centred.
- New `doneHidden` state: after the bar finishes (`phase === 'done'` or `stage === 'restored'`,
  and whenever `busy` goes truthy→falsy) a 6 s timer (`DONE_HIDE_MS`) hides the applet.
- A `sessionStorage` marker `junkalot-update-done-at` is written just before the reload
  (`RELOAD_HIDE_MS` = 2.5 s on the next page), so the page reloaded into does not park the full
  card over the page again.
- Nothing is hidden while `actionable` (ready/live/restored) or `warn`
  (maintenance/offline) — a new build or a problem always brings the full card back.
- Timers re-arm through the existing `hideArm`/`expand` path; the dock→chip→tab resting
  behaviour for "up to date" is unchanged.

**State:** source patched in BOTH copies (master `/home/ghost694/junkalot` and editing copy
`/home/ghost694/workspace/dekekenneth840@gmail.com/junkalot`); `tsc --noEmit` on the master
exits 0 with no output. **Not deployed** — the owner said no server restarts until he says so,
so `scripts/stage-update.mjs` (which hands the service to systemd) has not been run. The live
site still serves the previous build.
**Backups:** `UpdateToast.tsx.bak-toastautohide-20261117T034124Z` in both copies; this file
backed up as `junkalot-brain-current.md.bak-toastautohide-20261117T034220Z`.
**Coach facts:** no change — the coach prompt does not promise update-applet behaviour.
