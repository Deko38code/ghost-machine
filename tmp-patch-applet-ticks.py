import io, sys, shutil
P = "/home/ghost/haksterAi/src/layouts/Layout.astro"
shutil.copyfile(P, P + ".bak-liveclocks-20261121Z")
src = io.open(P, encoding="utf-8").read()

def sub(old, new, label):
    global src
    if old not in src:
        sys.exit("FAIL anchor: " + label)
    src = src.replace(old, new, 1)
    print("PATCHED", label)

sub("""        const live = { job: null, stability: null, at: 0, connected: false, audited: {}, lastStage: '', lastState: '', closedBuild: '' };""",
"""        const live = { job: null, stability: null, at: 0, connected: false, audited: {}, lastStage: '', lastState: '', closedBuild: '', jobBase: null, stabBase: null };""",
"live state fields")

sub("""          const firstFrame = !live.at;
          live.at = Date.now();
          const job = snap.job || {};""",
"""          const firstFrame = !live.at;
          live.at = Date.now();
          const job = snap.job || {};
          // Baseline for the one-second clock. Every value in it was measured on
          // the server; the local second hand only advances it from the moment
          // this frame arrived. Without it the elapsed/ETA/remaining text sat
          // frozen on the 5 s poll and read as stuck at zero (owner 2026-11-21:
          // "make sure the secs and update time ... is correct live always").
          live.jobBase = (Number.isFinite(job.elapsedSec) || Number.isFinite(job.etaSec)) ? {
            elapsed: Number.isFinite(job.elapsedSec) ? Number(job.elapsedSec) : null,
            eta: Number.isFinite(job.etaSec) ? Number(job.etaSec) : null,
            state: String(job.state || ''),
            stage: job.stage && job.stage.label ? String(job.stage.label) : '',
            at: live.at,
          } : null;""",
"job baseline")

sub("""            if (stabDetailEl) stabDetailEl.textContent = detail;
            if (state === 'STABLE' && live.lastState !== 'STABLE') {""",
"""            if (stabDetailEl) stabDetailEl.textContent = detail;
            live.stabBase = {
              state,
              remaining: Number.isFinite(win.remainingSec) ? Number(win.remainingSec) : null,
              configured: Number.isFinite(win.configuredSec) ? Number(win.configuredSec) : null,
              at: live.at,
            };
            if (state === 'STABLE' && live.lastState !== 'STABLE') {""",
"stability baseline")

sub("""        window.setInterval(() => {
          if (document.visibilityState !== 'visible') return;
          if (uptimeBase && Date.now() - uptimeBase.at <= 60000) paintUptime();
          if (checkedEl && lastCheck) checkedEl.textContent = ago(lastCheck);
        }, 1000);""",
"""        // Move the measured build and stability clocks forward between frames.
        // The base is always a server value; nothing here invents progress, the
        // percent stays exactly what the server reported, and every clock stops
        // once its frame is past the 30 s telemetry limit (the watchdog below
        // then turns the whole panel to UNKNOWN).
        const tickLiveClocks = () => {
          if (!live.at || Date.now() - live.at > 30000) return;
          const delta = (Date.now() - live.at) / 1000;
          const b = live.jobBase;
          if (b && (b.state === 'RUNNING' || b.state === 'QUEUED')) {
            const elapsed = b.elapsed == null ? null : b.elapsed + delta;
            const eta = b.eta == null ? null : Math.max(0, b.eta - delta);
            if (elapsedEl && elapsed != null) elapsedEl.textContent = 'elapsed ' + fmtSecs(elapsed);
            if (etaEl) etaEl.textContent = eta == null ? 'ETA unknown' : 'ETA ~' + fmtSecs(eta);
            if (detailEl) {
              detailEl.textContent = (b.stage ? b.stage + ' · ' : '')
                + 'elapsed ' + fmtSecs(elapsed == null ? NaN : elapsed)
                + ' · ' + (eta == null ? 'ETA unknown' : 'ETA ~' + fmtSecs(eta));
            }
          }
          const s = live.stabBase;
          if (s && s.state === 'VERIFYING' && s.remaining != null && s.configured != null && stabDetailEl) {
            stabDetailEl.textContent = '· ' + fmtSecs(Math.max(0, s.remaining - delta)) + ' left of ' + fmtSecs(s.configured) + ' window';
          }
        };

        window.setInterval(() => {
          if (document.visibilityState !== 'visible') return;
          if (uptimeBase && Date.now() - uptimeBase.at <= 60000) paintUptime();
          if (checkedEl && lastCheck) checkedEl.textContent = ago(lastCheck);
          tickLiveClocks();
        }, 1000);""",
"one-second clocks")

io.open(P, "w", encoding="utf-8").write(src)
print("ALL PATCHED")
