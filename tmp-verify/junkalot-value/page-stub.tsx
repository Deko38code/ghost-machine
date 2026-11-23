import { notFound } from 'next/navigation'

// The owner-only client value record was moved off this site on 2026-11-21
// (owner: "i rater u add to my admin in haksterai.com admin so client dosent
// accidentally see it"). It now lives in HaksterAI's owner admin at
// /admin/profit. This route stays as an unconditional 404 so the client can
// never load the record here, and so generated route types keep resolving.
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Not found', robots: { index: false, follow: false } }

export default function RemovedOwnerValuePage() {
  notFound()
}
