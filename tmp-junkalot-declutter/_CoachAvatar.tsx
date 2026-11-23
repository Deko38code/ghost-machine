'use client'

// The coach's mark: a small monogram avatar. Used wherever Mr Ed speaks on a course page,
// so the quiz, the questionnaire list and the feedback panel all carry the same face.
// Owner (2026-11-21): "make pages neat organized not sloppy the questions etc nice icons avatars".

export default function CoachAvatar({ size = 40 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="relative flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-gold/30 via-gray-900 to-black ring-2 ring-brand-gold/40"
    >
      <span className="font-mono text-[12px] font-extrabold tracking-tight text-brand-gold">ME</span>
      <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[9px] font-bold text-black ring-2 ring-gray-950">✓</span>
    </span>
  )
}
