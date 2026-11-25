import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePoll } from '../lib/util'
import { downloadText } from '../lib/gpx'
import type { Pt } from '../lib/gpx'
import { TRACK_COLORS, TrackMap } from './TrackMap'
import type { MapCp } from './TrackMap'
import { useToast } from './ui'
import { Profiles } from './Profiles'

interface Tr { id: string; name: string; points: Pt[]; length_km: number; gain_m: number }
interface Data { tracks: Tr[]; checkpoints: (MapCp & { track_id: string | null })[] }

// Parcours vu côté participant (avec téléchargement) ou bénévole (consultation).
export function TrackView({ code, canDownload, highlight }: { code: string; canDownload: boolean; highlight?: string }) {
  const notify = useToast()
  const [hoverPt, setHoverPt] = useState<[number, number] | null>(null)
  const { data } = usePoll(async () => {
    const { data, error } = await supabase.rpc('code_tracks', { p_code: code })
    if (error) throw error
    return data as Data | null
  }, 120000, [code])
  if (!data || !data.tracks.length) return <div className="card soft small">Le tracé de la course sera disponible ici dès que l'organisation l'aura ajouté.</div>
  const download = async (t: Tr) => {
    const { data: f, error } = await supabase.rpc('participant_track_gpx', { p_code: code, p_track: t.id })
    if (error || !f) { notify('Téléchargement impossible pour le moment.'); return }
    downloadText(f.file_name || `${t.name}.gpx`, f.gpx)
  }
  return (
    <div className="card" style={{ gap: 12 }}>
      <div className="label-up">Parcours</div>
      <TrackMap tracks={data.tracks} checkpoints={data.checkpoints} height={340} hoverPoint={hoverPt} />
      <Profiles tracks={data.tracks} checkpoints={data.checkpoints} onHover={setHoverPt} initial={highlight} />
      {data.tracks.map((t, i) => (
        <div key={t.id} className="row" style={{ flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          <span style={{ width: 14, height: 4, borderRadius: 2, background: TRACK_COLORS[i % TRACK_COLORS.length] }} />
          <div className="grow">
            <div style={{ fontWeight: 700 }}>{t.name}{highlight && t.name === highlight ? ' · ma distance' : ''}</div>
            <div className="small muted">{Number(t.length_km).toFixed(1)} km · {t.gain_m} m D+</div>
          </div>
          {canDownload && <button type="button" className="btn" onClick={() => download(t)}>Télécharger le GPX</button>}
        </div>
      ))}
      {data.checkpoints.length > 0 && (
        <div>
          <div className="small" style={{ fontWeight: 700, margin: '4px 0 6px' }}>Points de contrôle</div>
          {data.checkpoints.map((c) => (
            <div key={c.id} className="row small" style={{ padding: '6px 0', borderTop: '1px solid var(--line)' }}>
              <span className="code" style={{ width: 64 }}>{c.km != null ? `km ${Number(c.km).toFixed(0)}` : '—'}</span>
              <span className="grow" style={{ fontWeight: 600 }}>{c.name}</span>
              <span className="muted">{c.kind}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
