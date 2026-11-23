import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { isOwnerEmail } from '@/lib/auth'
import { readBridgeKey, callBridge } from '@/lib/support-bridge-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Opens a support session for one client. PhantomIDE is the authority: this
// route only signs a single-use token naming the client, and PhantomIDE
// resolves the mapped paid account, checks presence and enforces capacity.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const agent = String(session?.user?.email || '').trim().toLowerCase()
  if (!agent || !isOwnerEmail(agent)) {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const clientEmail = String(body?.client_email || '').trim().toLowerCase()
  const minutes = Number(body?.invite_expires_minutes)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
    return NextResponse.json({ error: 'A client email is required for this session' }, { status: 400 })
  }
  if (![5, 10, 15, 20].includes(minutes)) {
    return NextResponse.json({ error: 'Choose a 5, 10, 15, or 20 minute invite window.' }, { status: 400 })
  }
  const key = await readBridgeKey()
  if (!key) return NextResponse.json({ error: 'Remote support is not connected to PhantomIDE on this server.' }, { status: 503 })

  const result = await callBridge(key, 'support.session.create', '/api/agents/remote-support/bridge/session', {
    method: 'POST',
    agent,
    clientEmail,
    body: { invite_expires_minutes: minutes },
  })
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, client_not_present: result.data?.client_not_present === true, paid_required: result.data?.paid_required === true, mapping_required: result.data?.mapping_required === true },
      { status: result.status },
    )
  }
  return NextResponse.json(result.data, { headers: { 'Cache-Control': 'no-store' } })
}
