// Logo Beyond Events, d'après la charte : un point cyan émet trois ondes (cyan, orange, vert) vers une bulle verte cochée.
export function Symbol({ size = 32, on = 'dark' }: { size?: number; on?: 'dark' | 'light' }) {
  // Géométrie du fichier officiel assets/Logos/symbole-fond-*.svg de la charte
  const cy = on === 'dark' ? '#6EE7F9' : '#0891B2'
  const vt = on === 'dark' ? '#8FF573' : '#16A34A'
  const check = on === 'dark' ? '#0F1B2D' : '#FFFFFF'
  return (
    <svg width={size * 1.16} height={size} viewBox="0 0 116 100" aria-hidden="true" focusable="false">
      <circle cx="20" cy="50" r="11" fill={cy} />
      <path d="M34.1 33.1A22 22 0 0 1 34.1 66.9" fill="none" stroke={cy} strokeWidth="9" strokeLinecap="round" />
      <path d="M43.1 22.4A36 36 0 0 1 43.1 77.6" fill="none" stroke="#FF5F1F" strokeWidth="9" strokeLinecap="round" />
      <path d="M52.1 11.7A50 50 0 0 1 52.1 88.3" fill="none" stroke={vt} strokeWidth="9" strokeLinecap="round" />
      <path d="M84 12h24a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6h-14l-8 7v-7h-2a6 6 0 0 1-6-6V18a6 6 0 0 1 6-6z" fill={vt} />
      <path d="M89 26.5l5 5 9-9.5" fill="none" stroke={check} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
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
