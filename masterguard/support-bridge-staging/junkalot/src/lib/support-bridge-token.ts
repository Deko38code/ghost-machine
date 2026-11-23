// Junkalot side of the PhantomIDE support bridge.
//
// The long-lived bridge key never leaves the server: this module signs a
// single-use, 60-second, audience-bound token for one call and nothing else.
// The browser never sees the key or a token, and no PhantomIDE identity is
// returned to the panel (PhantomIDE resolves its own account from its own
// server-side mapping).
import crypto from 'node:crypto'
import { promises as fs } from 'node:fs'

export const BRIDGE_KEY_FILE = '/home/ghost694/.config/junkalot-omp-ads-bridge.key'
export const PHANTOM_BRIDGE_BASE = (process.env.PHANTOMIDE_BRIDGE_URL || 'http://127.0.0.1:4000').replace(/\/+$/, '')
const AUDIENCE = 'phantomide-support'
const TOKEN_TTL_MS = 60_000

export type BridgeAction = 'support.session.create' | 'support.session.status' | 'support.session.end'

export async function readBridgeKey(): Promise<string | null> {
  try {
    const key = (await fs.readFile(BRIDGE_KEY_FILE, 'utf8')).trim()
    return key.length >= 48 ? key : null
  } catch {
    return null
  }
}

export function signBridgeToken(
  key: string,
  opts: { action: BridgeAction; agent: string; clientEmail: string; sessionId?: string },
): string {
  const issuedAt = Date.now()
  const body = Buffer.from(JSON.stringify({
    aud: AUDIENCE,
    act: opts.action,
    agt: opts.agent.trim().toLowerCase(),
    jcl: opts.clientEmail.trim().toLowerCase(),
    sid: opts.sessionId || null,
    jti: crypto.randomUUID(),
    iat: issuedAt,
    exp: issuedAt + TOKEN_TTL_MS,
  })).toString('base64url')
  const signature = crypto.createHmac('sha256', key).update(body).digest('base64url')
  return body + '.' + signature
}

export type BridgeCall = { ok: boolean; status: number; data: Record<string, unknown> | null; error?: string }

export async function callBridge(
  key: string,
  action: BridgeAction,
  path: string,
  init: { method: 'GET' | 'POST'; agent: string; clientEmail: string; sessionId?: string; body?: unknown },
): Promise<BridgeCall> {
  const token = signBridgeToken(key, { action, agent: init.agent, clientEmail: init.clientEmail, sessionId: init.sessionId })
  try {
    const response = await fetch(PHANTOM_BRIDGE_BASE + path, {
      method: init.method,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: init.method === 'POST' ? JSON.stringify(init.body ?? {}) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null
    if (!response.ok) return { ok: false, status: response.status, data, error: String(data?.error || 'PhantomIDE refused the support call') }
    return { ok: true, status: response.status, data }
  } catch {
    return { ok: false, status: 503, data: null, error: 'PhantomIDE support is unreachable' }
  }
}
