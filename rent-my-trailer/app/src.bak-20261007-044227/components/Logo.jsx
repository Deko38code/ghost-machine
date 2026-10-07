export function Logo({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="Rent My Trailer logo" role="img">
      {/* asphalt plate */}
      <rect width="64" height="64" rx="6" fill="#16181b" />
      {/* hazard corner */}
      <g clip-path="url(#hz)">
        <rect width="64" height="10" fill="none" />
      </g>
      <defs>
        <clipPath id="hz"><path d="M0 0h64v64H0z" /></clipPath>
      </defs>
      <path d="M0 0 L18 0 L0 18 Z" fill="#f5b325" />
      {/* trailer body */}
      <rect x="10" y="24" width="34" height="20" rx="2" fill="#f5b325" />
      <rect x="10" y="24" width="34" height="6" rx="1" fill="#c98f0a" />
      {/* box slats */}
      <path d="M15 24v20 M21 24v20 M27 24v20 M33 24v20 M39 24v20" stroke="#16181b" stroke-width="1.6" opacity="0.85" />
      {/* wheels */}
      <circle cx="17" cy="47" r="4.4" fill="#f4f1ea" stroke="#16181b" stroke-width="1.4" />
      <circle cx="17" cy="47" r="1.6" fill="#16181b" />
      <circle cx="36" cy="47" r="4.4" fill="#f4f1ea" stroke="#16181b" stroke-width="1.4" />
      <circle cx="36" cy="47" r="1.6" fill="#16181b" />
      {/* hitch tongue */}
      <path d="M44 30 L54 26 L54 29 L45 32 Z" fill="#f5b325" />
      <circle cx="52" cy="27.5" r="2.1" fill="none" stroke="#16181b" stroke-width="1.6" />
      {/* headlight */}
      <rect x="55.5" y="31" width="4" height="7" rx="1.5" fill="#ff5c1a" />
    </svg>
  );
}