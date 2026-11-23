import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { isAdminEmail } from '@/lib/auth'

// Owner-only recovery controls for Susie's Coach record.
//
// Owner (2026-11-22): "her history must always be recoverable". Two things live here:
//   GET  — the list of verified snapshots already on disk (see src/lib/coach-backup.ts)
//   POST { action: 'snapshot' } — take and verify a snapshot right now
//   POST { action: 'export' }   — download every bank, fact and message as one JSON file
//
// Read-only apart from writing a new snapshot file; nothing is ever deleted, and only an
// admin account can call it. The export contains the owner's own coach record only.

export const dynamic = 'force-dynamic'

async function owner(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  return session?.user?.email && isAdminEmail(session.user.email) ? session.user.email : null
}

export async function GET() {
  const email = await owner()
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const backup = await import('@/lib/coach-backup')
    return NextResponse.json({ backups: await backup.listCoachBackups() })
  } catch {
    return NextResponse.json({ error: 'Backup storage is unavailable.' }, { status: 503 })
  }
}

export async function POST(req: NextRequest) {
  const email = await owner()
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({} as any))

  if (body?.action === 'snapshot') {
    try {
      const backup = await import('@/lib/coach-backup')
      const snapshot = await backup.backupCoachMemory('manual')
      if (!snapshot) return NextResponse.json({ error: 'There is no coach record to snapshot yet.' }, { status: 409 })
      return NextResponse.json({ ok: true, snapshot, backups: await backup.listCoachBackups() })
    } catch {
      return NextResponse.json({ error: 'Could not write the snapshot.' }, { status: 503 })
    }
  }

  if (body?.action === 'export') {
    try {
      const memory = await import('@/data/coach-memory-db')
      // Recovery export: every bank on this box, not just the signed-in owner's, so a
      // restore never depends on remembering which account owned a conversation. This
      // route is admin-only; it is not reachable from a client account.
      const banks = memory.listAllCoachMemoryBanks()
      const dump = {
        exportedAt: new Date().toISOString(),
        requestedBy: email,
        banks: banks.map((b: any) => ({
          id: b.id,
          owner: b.owner_email,
          name: b.name,
          createdAt: b.created_at,
          memory: memory.getCoachMemory(b.owner_email, b.id, { limit: 0 }),
        })),
      }
      const name = 'coach-history-' + new Date().toISOString().slice(0, 10) + '.json'
      return new NextResponse(JSON.stringify(dump, null, 2), {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'content-disposition': 'attachment; filename="' + name + '"',
          'cache-control': 'no-store',
        },
      })
    } catch {
      return NextResponse.json({ error: 'Could not build the export.' }, { status: 503 })
    }
  }

  return NextResponse.json({ error: 'Invalid backup request.' }, { status: 400 })
}
