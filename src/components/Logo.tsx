// Symbole Beyond Events : un point cyan émet trois ondes (cyan, orange, vert) vers une bulle verte cochée.
// « dark » : pour fond nuit ; « light » : cyan et vert foncés d'un cran, coche blanche.
export function Symbol({ size = 32, on = 'dark' }: { size?: number; on?: 'dark' | 'light' }) {
  const cy = on === 'dark' ? '#6EE7F9' : '#0891B2'
  const vt = on === 'dark' ? '#8FF573' : '#16A34A'
  const check = on === 'dark' ? '#0F1B2D' : '#FFFFFF'
  return (
    <svg width={size * 1.8} height={size} viewBox="0 0 180 100" aria-hidden="true" focusable="false">
      <circle cx="22" cy="50" r="12" fill={cy} />
      <path d="M41.8 30.2A28 28 0 0 1 41.8 69.8" fill="none" stroke={cy} strokeWidth="8" strokeLinecap="round" />
      <path d="M55.9 16.1A48 48 0 0 1 55.9 83.9" fill="none" stroke="#FF5F1F" strokeWidth="8" strokeLinecap="round" />
      <path d="M67.3 4.7A64 64 0 0 1 67.3 95.3" fill="none" stroke={vt} strokeWidth="8" strokeLinecap="round" />
      <rect x="104" y="22" width="70" height="50" rx="10" fill={vt} />
      <path d="M114 70h18l-18 16z" fill={vt} />
      <path d="M124 47l10 10 20-21" fill="none" stroke={check} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Wordmark({ on = 'dark', size = 18 }: { on?: 'dark' | 'light'; size?: number }) {
  return (
    <span className="wordmark" style={{ fontSize: size, color: on === 'dark' ? '#fff' : 'var(--ink)' }}>
      BEYOND<span style={{ color: '#FF5F1F' }}>.</span>EVENTS
    </span>
  )
}

export function Brand({ on = 'dark', size = 22 }: { on?: 'dark' | 'light'; size?: number }) {
  return <span className="brand-lockup"><Symbol size={size} on={on} /><Wordmark on={on} size={size * 0.82} /></span>
}
