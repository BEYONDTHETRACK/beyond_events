import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { supabase } from '../lib/supabase'
import { usePoll } from '../lib/util'
import { downloadText, parseGpx, snap } from '../lib/gpx'
import type { Pt } from '../lib/gpx'
import { CP_KINDS, TRACK_COLORS, TrackMap } from '../components/TrackMap'
import type { MapCp } from '../components/TrackMap'
import { ErrorNote, Loading, useToast } from '../components/ui'
import { useEv } from './console'

interface Track { id: string; name: string; file_name: string; points: Pt[]; length_km: number; gain_m: number; position: number }
interface Cp extends MapCp { track_id: string | null }

// Place un point sur le tracé le plus proche et renvoie son kilométrage.
function locate(tracks: Track[], lat: number, lng: number) {
  let best: { track: Track; lat: number; lng: number; km: number; off: number } | null = null
  for (const t of tracks) {
    if (!t.points.length) continue
    const s = snap(t.points, lat, lng)
    if (!best || s.offKm < best.off) best = { track: t, lat: s.point[0], lng: s.point[1], km: s.point[3], off: s.offKm }
  }
  return best
}

export function Parcours() {
  const { ev } = useEv()
  const notify = useToast()
  const [name, setName] = useState(ev.distances[0] ?? '')
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Cp | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const { data, error, loading, reload } = usePoll(async () => {
    const [t, c] = await Promise.all([
      supabase.from('event_tracks').select('id,name,file_name,points,length_km,gain_m,position').eq('event_id', ev.id).order('position').order('name'),
      supabase.from('checkpoints').select('*').eq('event_id', ev.id).order('km', { nullsFirst: false }),
    ])
    if (t.error) throw t.error
    if (c.error) throw c.error
    return { tracks: t.data as Track[], cps: c.data as Cp[] }
  }, 20000, [ev.id])
  const tracks = useMemo(() => data?.tracks ?? [], [data])
  const cps = useMemo(() => [...(data?.cps ?? []), ...(draft ? [draft] : [])], [data, draft])

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 15_000_000) { notify('Fichier trop lourd (15 Mo maximum).'); return }
    setBusy(true)
    try {
      const text = await file.text()
      const g = parseGpx(text)
      const label = name.trim() || g.name || file.name.replace(/\.gpx$/i, '')
      const { error } = await supabase.from('event_tracks').insert({
        event_id: ev.id, name: label, file_name: file.name, gpx: text, points: g.points,
        length_km: g.lengthKm, gain_m: g.gainM, position: tracks.length,
      })
      if (error) throw error
      notify(`Tracé « ${label} » ajouté : ${g.lengthKm.toFixed(1)} km, ${g.gainM} m D+.`)
      reload()
    } catch (err) {
      notify(`Erreur : ${(err as Error).message}`)
    } finally { setBusy(false) }
  }
  const download = async (t: Track) => {
    const { data, error } = await supabase.from('event_tracks').select('gpx,file_name').eq('id', t.id).single()
    if (error) { notify(`Erreur : ${error.message}`); return }
    downloadText(data.file_name || `${t.name}.gpx`, data.gpx)
  }
  const removeTrack = async (t: Track) => {
    if (!window.confirm(`Supprimer le tracé « ${t.name} » ? Les CP restent sur la carte.`)) return
    await supabase.from('event_tracks').delete().eq('id', t.id)
    reload()
  }

  const onMapClick = (lat: number, lng: number) => {
    if (!adding) return
    const l = locate(tracks, lat, lng)
    const n = (data?.cps.length ?? 0) + 1
    setDraft({ id: 'draft', name: `CP${n}`, kind: 'CP', lat: l?.lat ?? lat, lng: l?.lng ?? lng, km: l ? l.km : null, track_id: l?.track.id ?? null })
    setSelected('draft')
  }
  const saveDraft = async () => {
    if (!draft) return
    const { error } = await supabase.from('checkpoints').insert({ event_id: ev.id, track_id: draft.track_id, name: draft.name.trim() || 'CP', kind: draft.kind, lat: draft.lat, lng: draft.lng, km: draft.km })
    if (error) { notify(`Erreur : ${error.message}`); return }
    setDraft(null); setSelected(null)
    reload()
  }
  const move = async (id: string, lat: number, lng: number) => {
    const l = locate(tracks, lat, lng)
    const patch = { lat: l?.lat ?? lat, lng: l?.lng ?? lng, km: l ? l.km : null, track_id: l?.track.id ?? null }
    if (id === 'draft') { setDraft((d) => (d ? { ...d, ...patch } : d)); return }
    await supabase.from('checkpoints').update(patch).eq('id', id)
    reload()
  }
  const update = async (cp: Cp, patch: Partial<Cp>) => {
    await supabase.from('checkpoints').update(patch).eq('id', cp.id)
    reload()
  }
  const removeCp = async (cp: Cp) => {
    await supabase.from('checkpoints').delete().eq('id', cp.id)
    reload()
  }

  if (loading && !data) return <Loading />
  return (
    <>
      <div className="page-head"><div><h1>Parcours et CP</h1><p>Les tracés sont visibles par les participants (téléchargeables) et par les bénévoles.</p></div></div>
      <ErrorNote error={error} />
      <section className="panel">
        <h2>Tracés GPX</h2>
        <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ width: 220 }}>
            <label htmlFor="tn">Nom du tracé</label>
            <input id="tn" className="input" list="tn-list" placeholder="Ex. : 300 km" value={name} onChange={(e) => setName(e.target.value)} />
            <datalist id="tn-list">{ev.distances.map((d) => <option key={d} value={d} />)}</datalist>
          </div>
          <label className={`btn primary ${busy ? 'disabled' : ''}`} style={{ cursor: 'pointer' }}>
            {busy ? 'Lecture du fichier…' : 'Charger un fichier GPX'}
            <input type="file" accept=".gpx,application/gpx+xml" onChange={upload} disabled={busy} className="sr-only" />
          </label>
        </div>
        <div className="table-wrap">
          <table className="t" style={{ minWidth: 520 }}>
            <thead><tr><th>Tracé</th><th>Distance</th><th>D+</th><th>Fichier</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {tracks.map((t, i) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}><span style={{ display: 'inline-block', width: 14, height: 4, borderRadius: 2, background: TRACK_COLORS[i % TRACK_COLORS.length], marginRight: 8, verticalAlign: 'middle' }} />{t.name}</td>
                  <td>{Number(t.length_km).toFixed(1)} km</td>
                  <td>{t.gain_m} m</td>
                  <td className="muted small">{t.file_name}</td>
                  <td style={{ whiteSpace: 'nowrap' }}><button type="button" className="btn" style={{ minHeight: 36 }} onClick={() => download(t)}>Télécharger</button> <button type="button" className="btn" style={{ minHeight: 36, color: 'var(--danger)' }} onClick={() => removeTrack(t)}>Supprimer</button></td>
                </tr>
              ))}
              {!tracks.length && <tr><td colSpan={5} className="muted">Aucun tracé. Charge le fichier GPX de chaque distance.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <h2 className="grow">Carte et points de contrôle</h2>
          <button type="button" className={`btn ${adding ? 'dark' : ''}`} aria-pressed={adding} onClick={() => { setAdding(!adding); setDraft(null); setSelected(null) }}>{adding ? 'Terminer l’ajout de CP' : 'Ajouter des CP sur la carte'}</button>
        </div>
        {adding && <p className="small" style={{ background: 'var(--cyan-soft)', padding: '8px 12px', borderRadius: 8 }}>Clique sur la carte à l'endroit du CP : il se cale sur le tracé le plus proche et son kilométrage est calculé. Tu peux ensuite déplacer un CP en le faisant glisser.</p>}
        {tracks.length > 0 && <div className="track-legend">{tracks.map((t, i) => <span key={t.id} style={{ ['--c' as string]: TRACK_COLORS[i % TRACK_COLORS.length] }}>{t.name}</span>)}</div>}
        <TrackMap tracks={tracks} checkpoints={cps} height={520} editable onMapClick={adding ? onMapClick : undefined} onCpMove={move} onCpClick={setSelected} selectedCp={selected} />
        {draft && (
          <div className="card soft">
            <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="field" style={{ flex: '1 1 200px' }}><label htmlFor="dn">Nom du point</label><input id="dn" className="input" autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
              <div className="field" style={{ width: 190 }}><label htmlFor="dk">Type</label><select id="dk" className="select" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>{CP_KINDS.map((k) => <option key={k}>{k}</option>)}</select></div>
              <div className="small" style={{ paddingBottom: 12 }}>{draft.km != null ? <>km <strong>{Number(draft.km).toFixed(1)}</strong> · {tracks.find((t) => t.id === draft.track_id)?.name}</> : 'Hors tracé'}</div>
              <button type="button" className="btn primary" onClick={saveDraft}>Enregistrer le point</button>
              <button type="button" className="btn" onClick={() => { setDraft(null); setSelected(null) }}>Annuler</button>
            </div>
          </div>
        )}
        <div className="table-wrap">
          <table className="t" style={{ minWidth: 560 }}>
            <thead><tr><th>Point</th><th>Type</th><th>Km</th><th>Tracé</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {(data?.cps ?? []).map((cp) => (
                <tr key={cp.id} style={selected === cp.id ? { background: 'var(--cyan-soft)' } : undefined}>
                  <td><input className="input" aria-label="Nom du point" defaultValue={cp.name} style={{ minHeight: 36 }} onBlur={(e) => e.target.value !== cp.name && update(cp, { name: e.target.value })} /></td>
                  <td><select className="select" aria-label="Type de point" value={cp.kind} style={{ minHeight: 36 }} onChange={(e) => update(cp, { kind: e.target.value })}>{CP_KINDS.map((k) => <option key={k}>{k}</option>)}</select></td>
                  <td className="code">{cp.km != null ? Number(cp.km).toFixed(1) : '—'}</td>
                  <td className="muted">{tracks.find((t) => t.id === cp.track_id)?.name ?? '—'}</td>
                  <td><button type="button" className="btn" style={{ minHeight: 36 }} onClick={() => removeCp(cp)}>Supprimer</button></td>
                </tr>
              ))}
              {data && !data.cps.length && <tr><td colSpan={5} className="muted">Aucun point. Active « Ajouter des CP sur la carte » puis clique sur le tracé.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
