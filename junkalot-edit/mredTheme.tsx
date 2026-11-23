'use client'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

/**
 * One theme preference for everything Mr Ed draws: the floating panel, the inline card on the
 * Security Center, and the full-window terminal (owner, 2026-11-22: "add theme prefrenece in
 * mr ed tabs", then "the mr ed term color picker theme selector" — presets AND a colour picker).
 *
 * It lives in this browser only (localStorage), never in the account or on the server, because
 * it is a display preference: it changes no data, no route and no model (CLAUDE.md §19, §22).
 */
export type MredTheme = 'auto' | 'light' | 'dark' | 'custom'
export const MRED_THEME_KEY = 'junkalot:mred-theme'
export const MRED_TINT_KEY = 'junkalot:mred-tint'
export const MRED_DEFAULT_TINT = '#0f172a'

export function isHex(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value)
}

export function hexToRgb(hex: string) {
  if (!isHex(hex)) return null
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  }
}

/** 0 (black) … 1 (white). Used to decide whether text on this colour must be dark or light. */
export function hexLuminance(hex: string) {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
}

export function rgba(hex: string, alpha: number) {
  const rgb = hexToRgb(hex)
  if (!rgb) return `rgba(11, 11, 20, ${alpha})`
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

/** Read the saved preference. Never throws (private mode, cleared storage). */
export function readMredPreference(): { theme: MredTheme; tint: string } {
  let theme: MredTheme = 'auto'
  let tint = MRED_DEFAULT_TINT
  try {
    const savedTheme = localStorage.getItem(MRED_THEME_KEY)
    if (savedTheme === 'auto' || savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'custom') theme = savedTheme
    const savedTint = localStorage.getItem(MRED_TINT_KEY) || ''
    if (isHex(savedTint)) tint = savedTint
  } catch { /* private mode: the defaults apply */ }
  return { theme, tint }
}

export type MredThemeControls = {
  theme: MredTheme
  tint: string
  choose: (next: MredTheme) => void
  chooseTint: (hex: string) => void
}

export function useMredTheme(): MredThemeControls {
  const [theme, setTheme] = useState<MredTheme>('auto')
  const [tint, setTint] = useState(MRED_DEFAULT_TINT)
  useEffect(() => {
    const saved = readMredPreference()
    setTheme(saved.theme)
    setTint(saved.tint)
  }, [])
  const choose = (next: MredTheme) => {
    setTheme(next)
    try { localStorage.setItem(MRED_THEME_KEY, next) } catch { /* this visit only */ }
  }
  const chooseTint = (hex: string) => {
    if (!isHex(hex)) return
    setTint(hex)
    setTheme('custom')
    try {
      localStorage.setItem(MRED_TINT_KEY, hex)
      localStorage.setItem(MRED_THEME_KEY, 'custom')
    } catch { /* this visit only */ }
  }
  return { theme, tint, choose, chooseTint }
}

/**
 * The floating panel's glass for the chosen tone. 'auto' and the two presets are pure CSS
 * (globals.css, `.mred-tone-*`); a custom colour is passed through CSS variables so the text
 * and rows on it are always derived from that one colour.
 */
export function mredGlassStyle(theme: MredTheme, tint: string): CSSProperties | undefined {
  if (theme !== 'custom') return undefined
  const light = hexLuminance(tint) > 0.55
  return {
    '--mred-tint-bg': rgba(tint, 0.62),
    '--mred-tint-row': rgba(tint, 0.5),
    '--mred-tint-fg': light ? '#0b0b14' : '#f8fafc',
    '--mred-tint-strong': light ? '#6b4e00' : '#F5E6B8',
    '--mred-tint-muted': light ? '#3f3f46' : '#cbd5e1',
    '--mred-tint-border': light ? 'rgba(11, 11, 20, 0.14)' : 'rgba(255, 255, 255, 0.16)',
  } as CSSProperties
}

/** The terminal palette. The transcript draws its lines from these variables, so a light
 *  background gets dark text instead of green-on-black becoming invisible. */
export type TerminalPalette = {
  background: string
  foreground: string
  sys: string
  prompt: string
  user: string
  command: string
  output: string
  error: string
  id: string
}

const DARK_TERMINAL: TerminalPalette = {
  background: '#000000', foreground: '#e5e7eb', sys: '#15803d', prompt: '#22c55e',
  user: '#ffffff', command: '#fcd34d', output: '#4ade80', error: '#f87171', id: '#166534',
}
const LIGHT_TERMINAL: TerminalPalette = {
  background: '#f7f6f2', foreground: '#1f2937', sys: '#15803d', prompt: '#15803d',
  user: '#111827', command: '#92400e', output: '#166534', error: '#b91c1c', id: '#4b5563',
}

export function mredTerminalPalette(theme: MredTheme, tint: string, adminTheme: 'light' | 'dark'): TerminalPalette {
  if (theme === 'light') return LIGHT_TERMINAL
  if (theme === 'dark') return DARK_TERMINAL
  if (theme === 'custom') {
    const light = hexLuminance(tint) > 0.55
    return { ...(light ? LIGHT_TERMINAL : DARK_TERMINAL), background: tint, foreground: light ? '#111827' : '#e5e7eb' }
  }
  return adminTheme === 'light' ? { ...LIGHT_TERMINAL } : DARK_TERMINAL
}

/** Inline style for the terminal pane: the palette as CSS variables plus the two base colours. */
export function mredTerminalStyle(palette: TerminalPalette): CSSProperties {
  return {
    backgroundColor: palette.background,
    color: palette.foreground,
    '--coach-fg': palette.foreground,
    '--coach-sys': palette.sys,
    '--coach-prompt': palette.prompt,
    '--coach-user': palette.user,
    '--coach-cmd': palette.command,
    '--coach-out': palette.output,
    '--coach-err': palette.error,
    '--coach-id': palette.id,
  } as CSSProperties
}

const OPTIONS: { value: MredTheme; label: string }[] = [
  { value: 'auto', label: 'Match admin theme' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'custom', label: 'Custom colour' },
]

/**
 * The one theme control, used by the floating panel, the inline card and the terminal.
 * Owner rule (2026-11-20): multi-option admin controls ship as a dropdown, not tabs.
 */
export function MredThemePicker({ theme, tint, onChange, onTint, className = '', variant = 'panel' }: {
  theme: MredTheme
  tint: string
  onChange: (next: MredTheme) => void
  onTint: (hex: string) => void
  className?: string
  variant?: 'panel' | 'terminal'
}) {
  // The floating panel follows the admin theme, the terminal bar is always dark, so the
  // control takes the muted colour of the surface it sits on.
  const muted = variant === 'terminal' ? 'text-green-400' : 'mred-muted'
  const selectClass = variant === 'terminal'
    ? 'rounded border border-green-800 bg-transparent px-1.5 py-1 text-[11px] font-semibold text-green-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600'
    : 'mred-muted rounded-lg border border-white/15 bg-transparent px-2 py-1 text-[11px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A840]'
  const swatchClass = variant === 'terminal'
    ? 'h-8 w-9 cursor-pointer rounded border border-green-800 bg-transparent p-0.5'
    : 'h-8 w-9 cursor-pointer rounded-md border border-white/15 bg-transparent p-0.5'
  return (
    <span className={'flex shrink-0 items-center gap-1.5 text-[11px] font-semibold ' + className}>
      <label className="flex items-center gap-1.5">
        <span className={muted}>Theme</span>
        <select
          value={theme}
          onChange={event => onChange(event.target.value as MredTheme)}
          aria-label="Mr Ed theme"
          className={selectClass}
          style={{ minHeight: 32 }}
        >
          {OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <input
        type="color"
        value={tint}
        onChange={event => onTint(event.target.value)}
        aria-label="Mr Ed colour"
        title="Pick the Mr Ed colour — the text follows it"
        className={swatchClass}
      />
    </span>
  )
}
