'use client'

// Owner (2026-11-20): "when she earns a badge can you add some real achievements animations
// like fireworks etc — something real for earning and passing a quiz".
//
// Real means: the celebration only fires from a real event — a badge that newly appears on the
// server record, or a questionnaire that actually reached the pass mark. It never plays on a
// page load for something that was already earned. The overlay is pointer-events-none, so it can
// never block a click or cover a button, and it is skipped entirely when the viewer asks for
// reduced motion.

import { useEffect, useRef } from 'react'

type Kind = 'badge' | 'quiz'

export function celebrate(kind: Kind, title: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('junkalot:celebrate', { detail: { kind, title } }))
}

type Particle = { x: number; y: number; vx: number; vy: number; life: number; hue: number }

export default function Celebration() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const bannerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const banner = bannerRef.current
    if (!canvas || !banner) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let particles: Particle[] = []
    let raf = 0
    let until = 0

    function size() {
      canvas!.width = window.innerWidth * devicePixelRatio
      canvas!.height = window.innerHeight * devicePixelRatio
      canvas!.style.width = window.innerWidth + 'px'
      canvas!.style.height = window.innerHeight + 'px'
      ctx!.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
    }
    size()
    window.addEventListener('resize', size)

    function burst(x: number, y: number, hue: number) {
      const count = 64
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 0.8 + Math.random() * 4.4
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.1,
          life: 1,
          hue: hue + Math.random() * 45,
        })
      }
    }

    function frame() {
      const now = performance.now()
      ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight)
      particles = particles.filter(p => p.life > 0)
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.055
        p.vx *= 0.992
        p.life -= 0.012
        ctx!.globalAlpha = Math.max(0, p.life)
        ctx!.fillStyle = `hsl(${p.hue} 95% 62%)`
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, 1.6, 0, Math.PI * 2)
        ctx!.fill()
      }
      ctx!.globalAlpha = 1
      if (particles.length > 0 || now < until) raf = requestAnimationFrame(frame)
      else { ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight); raf = 0 }
    }

    function onCelebrate(event: Event) {
      const detail = (event as CustomEvent).detail || {}
      const kind: Kind = detail.kind === 'quiz' ? 'quiz' : 'badge'
      const title = String(detail.title || (kind === 'quiz' ? 'Questionnaire passed' : 'Badge earned'))

      banner!.textContent = (kind === 'badge' ? '🏅 ' : '✅ ') + title
      banner!.style.opacity = '1'
      banner!.style.transform = 'translateY(0)'

      if (!reduce) {
        const hues = kind === 'quiz' ? [140, 170] : [38, 48, 8]
        const shots = kind === 'quiz' ? 2 : 4
        for (let i = 0; i < shots; i++) {
          setTimeout(() => {
            burst(
              window.innerWidth * (0.25 + Math.random() * 0.5),
              window.innerHeight * (0.18 + Math.random() * 0.35),
              hues[Math.floor(Math.random() * hues.length)],
            )
            until = performance.now() + 2400
            if (!raf) raf = requestAnimationFrame(frame)
          }, i * 220)
        }
      }

      window.setTimeout(() => {
        if (banner) {
          banner.style.opacity = '0'
          banner.style.transform = 'translateY(-8px)'
        }
      }, kind === 'quiz' ? 3200 : 4200)
    }

    window.addEventListener('junkalot:celebrate', onCelebrate as EventListener)
    return () => {
      window.removeEventListener('junkalot:celebrate', onCelebrate as EventListener)
      window.removeEventListener('resize', size)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <>
      {/* Pointer-events-none: it can never take a click away from her. */}
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[55]" />
      <div className="pointer-events-none fixed inset-x-0 top-16 z-[56] flex justify-center px-4">
        <div
          ref={bannerRef}
          role="status"
          aria-live="polite"
          className="max-w-full rounded-full border border-amber-300/60 bg-gray-950/95 px-4 py-2 text-center text-sm font-bold text-amber-200 opacity-0 shadow-xl transition-all duration-300"
        />
      </div>
    </>
  )
}
