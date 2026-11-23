import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { isAdminEmail } from '@/lib/auth'

export const dynamic='force-dynamic'
async function owner() {
  const session=await getServerSession(authOptions)
  return session?.user?.email && isAdminEmail(session.user.email) ? session.user.email : null
}
export async function GET(req:NextRequest) {
  const email=await owner()
  if(!email) return NextResponse.json({error:'Unauthorized'},{status:401})
  try {
    const memory=await import('@/data/coach-memory-db')
    const banks=memory.listCoachMemoryBanks(email)
    const id=req.nextUrl.searchParams.get('bankId') || banks[0].id
    // 2026-11-22 (owner): "need all the chats back and output" — the lesson panel asks
    // for the bank's whole conversation; every other caller keeps the 24-message default.
    const wantAll=req.nextUrl.searchParams.get('history')==='all'
    // 2026-11-22 (owner): "live counter as chats grow" — a count-only read for the inbox
    // badge. It returns numbers, never message text, so it is cheap enough to poll.
    if(req.nextUrl.searchParams.get('history')==='count') {
      const counted=memory.countCoachMemoryMessages(email,id)
      // 2026-11-22 (Codex review): a bank this account does not own used to come back as
      // 200 with zero counts, which looks exactly like an empty bank. Refuse it instead —
      // ownership is never reported as an empty result.
      if(!counted) return NextResponse.json({error:'That bank is not on this account.'},{status:404})
      const after=Number(req.nextUrl.searchParams.get('after')||'')
      const since=req.nextUrl.searchParams.get('since')||''
      // Unread by record id when the caller has one (exact on every device and timezone).
      // The time cursor is kept only for a device that marked read before ids were stored;
      // with neither cursor, everything saved is unread — never a guessed number.
      const unread=Number.isFinite(after)&&after>0
        ? memory.countCoachMessagesAfterId(email,id,after)
        : (since?memory.countCoachMessagesSince(email,id,since):counted.count)
      return NextResponse.json({banks,bankId:id,count:counted.count,unread,lastAt:counted.lastAt??null,lastId:counted.lastId??0})
    }
    return NextResponse.json({banks,selected:memory.getCoachMemory(email,id,wantAll?{limit:0}:undefined),bankId:id})
  } catch { return NextResponse.json({error:'Memory storage is unavailable.'},{status:503}) }
}
export async function POST(req:NextRequest) {
  const email=await owner()
  if(!email) return NextResponse.json({error:'Unauthorized'},{status:401})
  const body=await req.json().catch(()=>({}))
  try {
    const memory=await import('@/data/coach-memory-db')
    if(body.action==='create') {
      const id=memory.createCoachMemoryBank(email,String(body.name||'Client'))
      return NextResponse.json({bankId:id,banks:memory.listCoachMemoryBanks(email)})
    }
    if(body.action==='remember' && typeof body.bankId==='string' && typeof body.fact==='string' && memory.addCoachMemoryFact(email,body.bankId,body.fact))
      return NextResponse.json({ok:true})
    return NextResponse.json({error:'Invalid memory request.'},{status:400})
  } catch { return NextResponse.json({error:'Memory storage is unavailable.'},{status:503}) }
}
