import { useState } from 'react'
import type { Pt } from '../lib/gpx'
import { ElevationProfile } from './ElevationProfile'
import { TRACK_COLORS } from './TrackMap'

interface T { id: string; name: string; points: Pt[]; gain_m: number }
interface C { id: string; name: string; km: number | null; track_id?: string | null }

export function Profiles({ tracks, checkpoints, onHover, initial }: { tracks: T[]; checkpoints: C[]; onHover: (p: [number, number] | null) => void; initial?: string }) {
  const start = Math.max(0, tracks.findIndex((t) => t.name === initial))
  const [i, setI] = useState(start)
  const idx = Math.min(i, tracks.length - 1)
  const t = tracks[idx]
  if (!t) return null
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <span className="small" style={{ fontWeight: 700 }}>Profil altimétrique</span>
        {tracks.length > 1 && (
          <div className="elev-tabs" role="tablist" aria-label="Choisir le tracé">
            {tracks.map((tr, k) => <button key={tr.id} type="button" role="tab" aria-selected={k === idx} className="chip" aria-pressed={k === idx} onClick={() => setI(k)}>{tr.name}</button>)}
          </div>
        )}
      </div>
      <ElevationProfile key={t.id} points={t.points} gain={t.gain_m} color={TRACK_COLORS[idx % TRACK_COLORS.length] === '#FF5F1F' ? '#0E7490' : TRACK_COLORS[idx % TRACK_COLORS.length]}
        checkpoints={checkpoints.filter((c) => !c.track_id || c.track_id === t.id)} onHover={(p) => onHover(p ? [p[0], p[1]] : null)} />
    </div>
  )
}
