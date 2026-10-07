export function Logo({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="Rent My Trailer logo" role="img">
      <rect width="64" height="64" rx="7" fill="#16181b" />
      <defs>
        <linearGradient id="lgo-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffc94d" />
          <stop offset="1" stopColor="#f0a60c" />
        </linearGradient>
      </defs>
      {/* yellow hazard corner */}
      <path d="M0 0 L17 0 L0 17 Z" fill="#f5b325" />

      {/* enclosed cargo trailer — tapered nose, roof rail, rear doors */}
      <path d="M8 27 L46 27 L46 44 L8 44 Z" fill="url(#lgo-body)" />
      <path d="M8 27 C10 44 12 44 14 44" transform="translate(0 0)" fill="none" />
      {/* tapered front cap */}
      <path d="M8 27 L13 22 L46 22 L46 27 Z" fill="#ffd27a" />
      {/* roof rail */}
      <rect x="14" y="20.5" width="30" height="2.6" rx="1.3" fill="#16181b" opacity="0.55" />
      {/* top band */}
      <rect x="8" y="27" width="38" height="6" fill="#c98f0a" />
      {/* rear door split + latch */}
      <path d="M27 33 v11" stroke="#16181b" strokeWidth="1.6" opacity="0.85" />
      <circle cx="27" cy="39" r="1.4" fill="#16181b" opacity="0.85" />
      {/* lower slats */}
      <path d="M14 33 v8 M20.5 33 v8 M33.5 33 v8 M40 33 v8" stroke="#b57e07" strokeWidth="1.4" opacity="0.9" />
      <path d="M22 34.7 h5 M22 37 h5 M36 34.7 h5 M36 37 h5" stroke="#c98f0a" strokeWidth="1.2" opacity="0.8" />

      {/* fender + dual-axle wheels */}
      <path d="M11 47 a5.6 5.6 0 0 1 11.2 0 Z" fill="#f0a60c" />
      <circle cx="16.6" cy="47" r="4.6" fill="#f4f1ea" stroke="#16181b" strokeWidth="1.5" />
      <circle cx="16.6" cy="47" r="1.7" fill="#16181b" />
      <circle cx="36" cy="47" r="4.6" fill="#f4f1ea" stroke="#16181b" strokeWidth="1.5" />
      <circle cx="36" cy="47" r="1.7" fill="#16181b" />

      {/* hitch tongue + coupler */}
      <path d="M46 29 L57 25 L57 28 L47 32 Z" fill="#f5b325" />
      <path d="M57 25 a3 3 0 1 0 0 5.5 Z" fill="#ff5c1a" />
      {/* safety chains */}
      <path d="M47 32 q3 2.5 6 1" fill="none" stroke="#f4f1ea" strokeWidth="1" opacity="0.7" />
      {/* marker light */}
      <rect x="57.4" y="30" width="3.6" height="6.5" rx="1.6" fill="#ff5c1a" />
      {/* motion lines */}
      <path d="M4 31 h3 M2.5 36 h4 M4 41 h3" stroke="#f4f1ea" strokeWidth="1.3" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}