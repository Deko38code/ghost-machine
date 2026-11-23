import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { isOwnerEmail } from '@/lib/auth'
import { readBridgeKey, callBridge } from '@/lib/support-bridge-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Ends one support session. The agent is re-checked here and again by
// PhantomIDE, and the session must belong to the named client.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const agent = String(session?.user?.email || '').trim().toLowerCase()
  if (!agent || !isOwnerEmail(agent)) {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const sessionId = String(body?.session_id || '').trim()
  const clientEmail = String(body?.client_email || '').trim().toLowerCase()
  if (!/^[a-f0-9-]{8,64}$/i.test(sessionId)) {
    return NextResponse.json({ error: 'A session id is required' }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
    return NextResponse.json({ error: 'A client email is required' }, { status: 400 })
  }
  const key = await readBridgeKey()
  if (!key) return NextResponse.json({ error: 'Remote support is not connected to PhantomIDE on this server.' }, { status: 503 })

  const result = await callBridge(key, 'support.session.end', '/api/agents/remote-support/bridge/session/' + encodeURIComponent(sessionId) + '/end', {
    method: 'POST',
    agent,
    clientEmail,
    sessionId,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result.data, { headers: { 'Cache-Control': 'no-store' } })
}
