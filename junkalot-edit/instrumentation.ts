// Next calls register() once when the server process starts. Two things happen
// here, both purely local:
//
//  1. The build this process booted on is recorded (data/served-build.json).
//     Next fixes its distDir at boot, so this is the only moment the config and
//     the running build are guaranteed to agree. Without it, editing
//     next.config.js ahead of a restart would make the running server report a
//     build it is not actually serving.
//  2. The hourly compaction schedule is armed, so WAL files and oversized JSONL
//     logs are condensed without anybody pressing a button.
//
// Neither touches config, the service, or any other process.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // `next build` also evaluates this module. Recording then would point the
  // served-build file at a build that is not running yet, so skip it.
  const building = process.env.NEXT_PHASE === 'phase-production-build'
  if (!building) {
    try {
      const { recordServedBuild } = await import('./lib/build-id')
      const pointer = recordServedBuild()
      if (pointer) console.log('[build-id] serving', pointer.build, 'from', pointer.dir)
    } catch (err: any) {
      console.warn('[build-id] could not record the served build:', err?.message || err)
    }

    // 2026-11-16 (owner): fully automatic updates. A build staged by
    // scripts/stage-update.mjs and verified (BUILD_READY + matching BUILD_ID)
    // hands the process back to systemd on its own, so no command is needed;
    // after the restart the guard verifies the new build and runs a selfcheck.
    try {
      const { startAutoApplyGuard } = await import('./lib/auto-apply')
      startAutoApplyGuard()
    } catch (err: any) {
      console.warn('[auto-apply] guard not started:', err?.message || err)
    }

    // 2026-11-20 (owner): full-auto AI Audit. Arms the 10-second check loop; the
    // loop only takes reversible security actions (block an abusive address,
    // release its own quiet blocks, resolve healed reports). The owner switch in
    // the Security Center turns it off, and JL_AUTO_HEAL=off hard-disables it.
    try {
      const { startAutoHealScheduler } = await import('./lib/auto-heal')
      startAutoHealScheduler()
    } catch (err: any) {
      console.warn('[auto-heal] scheduler not started:', err?.message || err)
    }

    // 2026-11-22 (owner): "her history must always be recoverable". Susie's Coach
    // conversation store (data/coach-memory.db) is snapshotted and verified once
    // after each server start and once a day after that, into
    // data/backups/coach-memory/. Snapshots are never deleted or trimmed.
    try {
      const { startCoachBackupScheduler } = await import('./lib/coach-backup')
      startCoachBackupScheduler()
    } catch (err: any) {
      console.warn('[coach-backup] scheduler not started:', err?.message || err)
    }
  }

  try {
    const { startAutoCompactScheduler } = await import('./lib/auto-compact')
    startAutoCompactScheduler()
  } catch (err: any) {
    console.warn('[auto-compact] scheduler not started:', err?.message || err)
  }
}
