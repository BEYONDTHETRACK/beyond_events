import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { Pt } from '../lib/gpx'

interface Cp { id: string; name: string; km: number | null; kind?: string; track_id?: string | null }

const H = 180
const PAD = { l: 48, r: 12, t: 14, b: 26 }

function niceStep(range: number, target: number) {
  const raw = range / target
  const p = 10 ** Math.floor(Math.log10(raw))
  const n = raw / p
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p
}

// Profil altimétrique d'un tracé, avec les CP et un curseur qui suit la souris ou le doigt.
export function ElevationProfile({ points, checkpoints = [], color = '#0E7490', gain, onHover }: {
  points: Pt[]; checkpoints?: Cp[]; color?: string; gain?: number
  onHover?: (p: Pt | null) => void
}) {
  const svg = useRef<SVGSVGElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(800)
  const [hover, setHover] = useState<Pt | null>(null)
  useEffect(() => {
    if (!box.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))))
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [])
  const pts = useMemo(() => points.filter((p) => p[2] !== null), [points])

  const geo = useMemo(() => {
    if (pts.length < 2) return null
    const total = points[points.length - 1][3] || 1
    const eles = pts.map((p) => p[2] as number)
    let min = Math.min(...eles)
    let max = Math.max(...eles)
    const span = Math.max(max - min, 50)
    min = Math.floor((min - span * 0.08) / 10) * 10
    max = Math.ceil((max + span * 0.08) / 10) * 10
    const x = (km: number) => PAD.l + (km / total) * (W - PAD.l - PAD.r)
    const y = (e: number) => PAD.t + (1 - (e - min) / (max - min)) * (H - PAD.t - PAD.b)
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[3]).toFixed(1)},${y(p[2] as number).toFixed(1)}`).join('')
    const area = `${line}L${x(pts[pts.length - 1][3]).toFixed(1)},${H - PAD.b}L${x(pts[0][3]).toFixed(1)},${H - PAD.b}Z`
    const kmStep = niceStep(total, Math.max(3, Math.round(W / 110)))
    const eStep = niceStep(max - min, 4)
    const kmTicks: number[] = []
    for (let k = 0; k <= total + 1e-6; k += kmStep) kmTicks.push(k)
    const eTicks: number[] = []
    for (let e = Math.ceil(min / eStep) * eStep; e <= max; e += eStep) eTicks.push(e)
    return { total, min, max, x, y, line, area, kmTicks, eTicks, lo: Math.min(...eles), hi: Math.max(...eles) }
  }, [pts, points, W])

  if (!geo) return <p className="small muted">Ce fichier GPX ne contient pas d'altitudes : pas de profil à afficher.</p>

  const nearest = (km: number) => {
    let lo = 0
    let hi = pts.length - 1
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (pts[mid][3] < km) lo = mid; else hi = mid }
    return Math.abs(pts[lo][3] - km) < Math.abs(pts[hi][3] - km) ? pts[lo] : pts[hi]
  }
  const move = (e: PointerEvent<SVGSVGElement>) => {
    const r = svg.current!.getBoundingClientRect()
    const vx = ((e.clientX - r.left) / r.width) * W
    const km = Math.min(Math.max((vx - PAD.l) / (W - PAD.l - PAD.r), 0), 1) * geo.total
    const p = nearest(km)
    setHover(p)
    onHover?.(p)
  }
  const leave = () => { setHover(null); onHover?.(null) }
  const cps = checkpoints.filter((c) => c.km != null && c.km <= geo.total + 0.5)
    .flatMap((c) => (c.kind === 'Départ / Arrivée' ? [{ ...c, km: 0 }, { ...c, id: `${c.id}-fin`, km: geo.total }] : [c]))
  const label = `Profil altimétrique : ${geo.total.toFixed(1)} km, altitude de ${Math.round(geo.lo)} à ${Math.round(geo.hi)} m${gain != null ? `, ${gain} m de dénivelé positif` : ''}.`

  return (
    <div className="elev" ref={box}>
      <div className="elev-stats small">
        <span><strong>{geo.total.toFixed(1)}</strong> km</span>
        {gain != null && <span><strong>{gain}</strong> m D+</span>}
        <span>Alt. <strong>{Math.round(geo.lo)}</strong> – <strong>{Math.round(geo.hi)}</strong> m</span>
        {hover && <span className="elev-hover">km <strong>{hover[3].toFixed(1)}</strong> · <strong>{Math.round(hover[2] as number)}</strong> m</span>}
      </div>
      <svg ref={svg} width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}
        onPointerMove={move} onPointerDown={move} onPointerLeave={leave} style={{ touchAction: 'pan-y' }}>
        {geo.eTicks.map((e) => (
          <g key={`e${e}`}>
            <line x1={PAD.l} x2={W - PAD.r} y1={geo.y(e)} y2={geo.y(e)} stroke="#E6EBF0" strokeWidth="1" />
            <text x={PAD.l - 6} y={geo.y(e) + 4} textAnchor="end" className="elev-axis">{e}</text>
          </g>
        ))}
        {geo.kmTicks.map((k) => <text key={`k${k}`} x={geo.x(k)} y={H - 8} textAnchor="middle" className="elev-axis">{Math.round(k)}</text>)}
        <path d={geo.area} fill={color} fillOpacity="0.14" />
        <path d={geo.line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        {cps.map((c) => (
          <g key={c.id}>
            <line x1={geo.x(Number(c.km))} x2={geo.x(Number(c.km))} y1={PAD.t} y2={H - PAD.b} stroke="#FF5F1F" strokeWidth="1.5" strokeDasharray="4 3" />
            <title>{`${c.name} · km ${Number(c.km).toFixed(1)}`}</title>
          </g>
        ))}
        {hover && (
          <g pointerEvents="none">
            <line x1={geo.x(hover[3])} x2={geo.x(hover[3])} y1={PAD.t} y2={H - PAD.b} stroke="#0F1B2D" strokeWidth="1" />
            <circle cx={geo.x(hover[3])} cy={geo.y(hover[2] as number)} r="4" fill="#0F1B2D" />
          </g>
        )}
      </svg>
      {cps.length > 0 && (
        <div className="elev-cps">
          {cps.map((c) => { const pc = (geo.x(Number(c.km)) / W) * 100; return <span key={c.id} style={{ left: `${pc}%`, transform: pc < 10 ? 'none' : pc > 90 ? 'translateX(-100%)' : undefined }} title={`${c.name} · km ${Number(c.km).toFixed(1)}`}>{c.name}</span> })}
        </div>
      )}
    </div>
  )
}
