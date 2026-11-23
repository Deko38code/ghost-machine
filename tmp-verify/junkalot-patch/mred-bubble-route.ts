import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { isAdminEmail } from '@/lib/auth'
import { hasGmailConnection } from '@/data/coach-gmail-db'
import { buttonStatus, listClientAccess, isClientEmail, CLIENT_EMAILS } from '@/lib/phantomide-billing'
import { getBusinessUnread } from '@/lib/gmail-business'
import { saveMrEdMessages } from '@/data/mred-inbox'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// The short "messages from PhantomIDE" feed shown when she taps Mr Ed.
// Every bubble is built from real server state — nothing is invented, and an
// unread count is only ever what Gmail actually reports.

type Bubble = {
  id: string
  kind: 'hello' | 'todo' | 'mail' | 'feedback' | 'update' | 'client'
  title: string
  body: string
  at?: string
  href?: string
  action?: 'connect-gmail'
}

// This desk is Susie's, and Mr Ed greets her by name every time. The signed-in
// Google profile is never used for the greeting: the developer signs into the
// same business account, and his name must never be written into her admin
// (owner, 2026-11-21: "he should never call her my name ever" / "no data with
// my name go in her admin"). The Coach still tells the two accounts apart from
// the signed-in email, internally.
const CLIENT_FIRST_NAME = 'Susie'

export async function GET() {
  const session = await getServerSession(authOptions)
  const email = String(session?.user?.email || '').trim().toLowerCase()
  if (!email || !isAdminEmail(email)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 401 })
  }

  // Greet her by her own name, on every account that reaches this desk.
  const person = CLIENT_FIRST_NAME
  const bubbles: Bubble[] = [{
    id: 'hello',
    kind: 'hello',
    title: 'Mr Ed · messages from PhantomIDE',
    body: `Hi ${person} — this is your Junkalot desk, powered by PhantomIDE. Mr Ed brings you anything the server needs you to see, and tells you here when mail arrives.`,
  }]

  // Her accounts and the addresses her own sign-ins came from. Real recorded
  // values only: the stored client-access log, never a guess. The owner asked
  // to be able to see her IP and email from this panel.
  try {
    const accounts = isClientEmail(email) ? listClientAccess(email) : listClientAccess()
    const emails = CLIENT_EMAILS.join(', ')
    const devices = accounts
      .flatMap((row) => row.devices.filter((device) => !device.box))
      .sort((a, b) => String(b.lastSeen).localeCompare(String(a.lastSeen)))
    const latest = devices[0]
    bubbles.push({
      id: 'client-record',
      kind: 'client',
      title: 'Client record · ' + person,
      body: 'Emails: ' + emails + (latest
        ? ' · Last sign-in from ' + latest.ip + ' (' + (latest.where || 'admin') + ') at ' + latest.lastSeen.replace('T', ' ').replace(/\.\d+Z$/, '') + ' UTC.'
        : ' · No sign-in address recorded yet — her IP appears here after she signs in.'),
    })
  } catch {
    // An unreadable access log never blocks the rest of the feed.
  }

  let gmailConnected = false
  try { gmailConnected = hasGmailConnection() } catch { gmailConnected = false }
  if (!gmailConnected) {
    bubbles.push({
      id: 'connect-gmail',
      kind: 'todo',
      title: 'Connect your business Gmail',
      body: 'Press the button and sign in as 1junkalot@gmail.com. Google gives read-only access, so Mr Ed can see and explain your mail and can never send from it.',
      action: 'connect-gmail',
    })
  }

  let buttonConfirmed = false
  try { buttonConfirmed = Boolean(buttonStatus()) } catch { buttonConfirmed = false }
  // Stays on the desk until her confirmation is logged (owner, 2026-11-21:
  // "make sure he ask her about pay button til she confirms logged"). The
  // Coach is told the same thing on every turn.
  if (!buttonConfirmed) {
    bubbles.push({
      id: 'pay-button',
      kind: 'todo',
      title: 'Have you seen the new Pay PhantomIDE button?',
      body: 'It is the green button at the top of the Monthly service price notice on your Invoices page. It switches on for the $249/month care plan on January 1, 2027 — nothing is due today. When you have seen it, tap it, or tell Mr Ed “I saw the Pay button”, and he logs the confirmation on the payments record. Mr Ed keeps asking until it is logged.',
      href: '/admin/invoices',
    })
  }

  let unreadCount = 0
  if (gmailConnected) {
    try {
      const inbox = await getBusinessUnread(5)
      unreadCount = inbox.unread.length
      for (const mail of inbox.unread) {
        bubbles.push({
          id: 'mail-' + mail.id,
          kind: 'mail',
          title: 'You got mail',
          body: (mail.from ? 'From ' + mail.from + ' — ' : '') + mail.subject,
          at: mail.date,
          href: '/admin/security?tab=ai',
        })
      }
    } catch {
      // A Gmail read failure never breaks the bubble; the panel simply shows
      // the server messages it does have.
    }
  }

  // Post-booking survey answers travel with the PhantomIDE messages too, so she
  // sees fresh customer feedback without opening Analytics. One bubble per
  // booking, and only while the answer is recent.
  try {
    const { getSurveyFeedbackStats } = await import('@/data/bookings-db')
    const feedback = getSurveyFeedbackStats()
    const latest = feedback.comments[0]
    if (latest) {
      const raw = String(latest.created_at || '')
      const stamp = raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z'
      const at = Date.parse(stamp)
      if (Number.isFinite(at) && Date.now() - at < 14 * 24 * 60 * 60_000) {
        const stars = latest.ease >= 1 && latest.ease <= 5 ? '★'.repeat(latest.ease) + '☆'.repeat(5 - latest.ease) + ' · ' : ''
        const comment = String(latest.comment || '').trim()
        bubbles.push({
          id: 'feedback-' + latest.booking_id,
          kind: 'feedback',
          title: 'New customer feedback',
          body: stars + (comment ? '“' + comment.slice(0, 180) + '”' : 'Rated ' + latest.ease + '/5') + (latest.heard_from ? ' — heard about you via ' + latest.heard_from : ''),
          at: stamp,
          href: '/admin/analytics',
        })
      }
    }
  } catch {
    // Feedback is optional; the panel still shows the messages it has.
  }

  // Save what she has actually been shown into the Inbox tab. Append-only and
  // idempotent: a message id is written once, so later visits never rewrite it.
  try { await saveMrEdMessages(bubbles) } catch { /* the live list still renders */ }

  return NextResponse.json(
    { bubbles, unread: unreadCount, gmailConnected, buttonConfirmed },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
