import { TrackView } from '../components/TrackView'
import { createContext, useContext, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ago, dateFr, dateTimeFr, statusLabel, getCodeSession, setCodeSession, usePoll } from '../lib/util'
import type { ParticipantState } from '../lib/types'
import { BackBar, ErrorNote, Icon, kindLabel, Loading, TabBar, useToast } from '../components/ui'

interface Ctx { s: ParticipantState; code: string; reload: () => Promise<void> }
const RunnerCtx = createContext<Ctx | null>(null)
const useRunner = () => useContext(RunnerCtx)!

const tabs = [
  { to: '/course', label: 'Fil', end: true },
  { to: '/course/infos', label: 'Infos' },
  { to: '/course/messages', label: 'Messages' },
  { to: '/course/compte', label: 'Compte' },
]

export function RunnerShell() {
  const session = getCodeSession()
  const code = session?.role === 'participant' ? session.code : ''
  const { data, error, loading, reload } = usePoll(async () => {
    const { data, error } = await supabase.rpc('participant_state', { p_code: code })
    if (error) throw error
    return data as ParticipantState | null
  }, 6000, [code])
  if (!code) return <Navigate to="/rejoindre" replace />
  if (loading && !data) return <Loading />
  if (!data) {
    return (
      <div className="screen" style={{ padding: 24, gap: 12 }}>
        <ErrorNote error={error} />
        <p>Ce code n'est plus valide. L'organisateur l'a peut-être supprimé.</p>
        <button type="button" className="btn primary" onClick={() => { setCodeSession(null); window.location.hash = '#/rejoindre' }}>Saisir un autre code</button>
      </div>
    )
  }
  return <RunnerCtx.Provider value={{ s: data, code, reload }}><Outlet /></RunnerCtx.Provider>
}

function Header() {
  const { s } = useRunner()
  const p = s.participant
  return (
    <div className="app-header" style={{ background: ['#0E5E4E', '#0F1B2D'].includes(s.event.color) ? 'var(--nuit)' : s.event.color }}>
      <div className="row"><span className="title grow">{s.event.name}</span><span className="pill dark">{p.lang}</span></div>
      <span className="sub">{p.bib ? `Dossard ${p.bib} · ` : ''}{p.distance || 'Distance à venir'} · {statusLabel(p.status)}</span>
    </div>
  )
}

export function Fil() {
  const { s, code, reload } = useRunner()
  const notify = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  // Marque comme lus les messages affichés (sans confirmation demandée)
  const unread = s.messages.filter((m) => !m.read_at).map((m) => m.id).join(',')
  useEffect(() => {
    if (!unread || document.visibilityState !== 'visible') return
    supabase.rpc('participant_mark_read', { p_code: code, p_ids: unread.split(',') }).then(() => {})
  }, [unread, code])
  const confirm = async (id: string) => {
    setBusy(id)
    const { error } = await supabase.rpc('participant_confirm', { p_code: code, p_message: id })
    setBusy(null)
    if (error) { notify(`Erreur : ${error.message}`); return }
    notify('Lecture confirmée. L’organisateur le voit tout de suite.')
    reload()
  }
  return (
    <div className="screen">
      <Header />
      <div className="screen-body">
        {s.messages.length === 0 && <p className="muted small">Aucun message pour l'instant. Les infos de l'organisateur arriveront ici.</p>}
        {s.messages.map((m) => {
          const todo = m.require_confirm && !m.confirmed_at
          return (
            <article key={m.id} className={`card ${todo && m.kind === 'alerte' ? 'alert' : ''}`}>
              <div className="card-meta">
                <span className={`tag ${m.kind}`}>{kindLabel(m.kind).toUpperCase()} · {dateTimeFr(m.created_at)}</span>
                {m.require_confirm && m.confirmed_at && <span className="ok" style={{ fontWeight: 600 }}>✓ Confirmé</span>}
              </div>
              <div className="card-title">{m.title}</div>
              {m.body && <div className="card-text">{m.body}</div>}
              {todo && <button type="button" disabled={busy === m.id} className={`btn ${m.kind === 'alerte' ? 'alert' : 'primary'}`} onClick={() => confirm(m.id)}>J'ai lu et compris</button>}
            </article>
          )
        })}
      </div>
      <div style={{ padding: '0 16px 12px' }}><Link to="/course/incident" className="btn big block dark">Signaler un abandon ou un incident</Link></div>
      <TabBar items={tabs} />
    </div>
  )
}

export function Infos() {
  const { s, code } = useRunner()
  const e = s.event
  return (
    <div className="screen">
      <Header />
      <div className="screen-body">
        <div className="card">
          <div className="label-up">L'événement</div>
          <div className="card-title" style={{ fontSize: 18 }}>{e.name}</div>
          <div className="small muted">Organisé par {e.org_name}</div>
          <div className="small">{dateFr(e.starts_on)}{e.place ? ` · ${e.place}` : ''}</div>
          {e.description && <p className="card-text">{e.description}</p>}
        </div>
        <div className="card">
          <div className="label-up">Mon inscription</div>
          <div className="row"><span className="grow muted">Distance</span><strong>{s.participant.distance || '—'}</strong></div>
          <div className="row"><span className="grow muted">Format</span><strong>{s.participant.format}</strong></div>
          <div className="row"><span className="grow muted">Dossard</span><strong>{s.participant.bib ?? '—'}</strong></div>
        </div>
        <TrackView code={code} canDownload highlight={s.participant.distance} />
      </div>
      <TabBar items={tabs} />
    </div>
  )
}

export function MessagesPrives() {
  const { s, code, reload } = useRunner()
  const [txt, setTxt] = useState('')
  const [busy, setBusy] = useState(false)
  const notify = useToast()
  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (!txt.trim()) return
    setBusy(true)
    const { error } = await supabase.rpc('participant_send_private', { p_code: code, p_body: txt })
    setBusy(false)
    if (error) { notify(`Erreur : ${error.message}`); return }
    setTxt('')
    reload()
  }
  return (
    <div className="screen">
      <Header />
      <div className="screen-body">
        <div className="bubble"><span className="who">{s.event.org_name}</span><span className="text">Une question sur la course ? Écris-nous ici, l'équipe te répond dès que possible.</span></div>
        {s.private.map((m) => (
          <div key={m.id} className={`bubble ${m.from_org ? '' : 'mine'}`}>
            <span className="who">{m.from_org ? s.event.org_name : 'Moi'} · {ago(m.created_at)}</span>
            <span className="text">{m.body}</span>
          </div>
        ))}
      </div>
      <form className="row" style={{ padding: '10px 12px', background: '#fff', borderTop: '1px solid var(--line)' }} onSubmit={send}>
        <label htmlFor="pm" className="sr-only">Message à l'organisation</label>
        <input id="pm" className="input grow" style={{ borderRadius: 22 }} placeholder="Écrire à l'organisation…" value={txt} onChange={(e) => setTxt(e.target.value)} />
        <button type="submit" disabled={busy} className="icon-btn" style={{ background: 'var(--forest)', color: '#fff', border: 0 }} aria-label="Envoyer">{Icon.send}</button>
      </form>
      <TabBar items={tabs} />
    </div>
  )
}

const INCIDENTS = ['Abandon', 'Problème mécanique', 'Blessure ou malaise', 'Autre']

export function Incident() {
  const { code, reload } = useRunner()
  const nav = useNavigate()
  const notify = useToast()
  const [type, setType] = useState(INCIDENTS[0])
  const [txt, setTxt] = useState('')
  const [pos, setPos] = useState<{ lat: number; lng: number; acc: number } | null>(null)
  const [posState, setPosState] = useState<'idle' | 'wait' | 'ok' | 'ko'>('idle')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!('geolocation' in navigator)) { setPosState('ko'); return }
    setPosState('wait')
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }); setPosState('ok') },
      () => setPosState('ko'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [])
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.rpc('participant_report', { p_code: code, p_type: type, p_body: txt, p_lat: pos?.lat ?? null, p_lng: pos?.lng ?? null })
    setBusy(false)
    if (error) { notify(`Erreur : ${error.message}`); return }
    notify('Envoyé au PC course.')
    await reload()
    nav('/course')
  }
  return (
    <form className="screen" onSubmit={submit}>
      <BackBar to="/course" title="Prévenir le PC course" />
      <div className="screen-body">
        <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <legend style={{ fontWeight: 700, marginBottom: 8 }}>Que se passe-t-il ?</legend>
          {INCIDENTS.map((i) => (
            <label key={i} className="check" style={{ background: type === i ? 'var(--danger-soft)' : '#fff', border: type === i ? '2px solid var(--danger)' : '1px solid var(--line-2)', borderRadius: 12, padding: '0 14px', fontWeight: type === i ? 700 : 400, minHeight: 52 }}>
              <input type="radio" name="t" checked={type === i} onChange={() => setType(i)} style={{ accentColor: 'var(--danger)' }} /> {i === 'Abandon' ? 'J’abandonne la course' : i}
            </label>
          ))}
        </fieldset>
        <div className="card small">
          {posState === 'wait' && <span className="muted">Recherche de ta position…</span>}
          {posState === 'ok' && pos && <><span className="muted">Ta position sera jointe</span><strong>{pos.lat.toFixed(4)} · {pos.lng.toFixed(4)} (± {pos.acc} m)</strong></>}
          {posState === 'ko' && <span className="muted">Position indisponible : le message partira sans position. Précise où tu es ci-dessous.</span>}
        </div>
        <div className="field"><label htmlFor="d">Précisions (facultatif)</label><textarea id="d" className="textarea" rows={3} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Ex. : je rejoins la gare, pas besoin de rapatriement" /></div>
      </div>
      <div className="sheet" style={{ borderRadius: 0 }}>
        <button type="submit" disabled={busy} className="btn big block danger">{busy ? 'Envoi…' : 'Envoyer au PC course'}</button>
        <p className="small" style={{ textAlign: 'center' }}><strong>Urgence vitale : appelle le 112.</strong></p>
      </div>
    </form>
  )
}

export function Compte() {
  const { s, code, reload } = useRunner()
  const nav = useNavigate()
  const setLang = async (l: string) => {
    await supabase.rpc('participant_set_lang', { p_code: code, p_lang: l })
    reload()
  }
  return (
    <div className="screen">
      <Header />
      <div className="screen-body">
        <div className="card">
          <div className="label-up">Mon accès</div>
          <div className="card-title">{s.participant.name}</div>
          <div className="small muted">Code personnel : <strong className="code" style={{ color: 'var(--ink)' }}>{s.participant.code}</strong></div>
          <p className="small muted">Garde ce code : il te permet de te reconnecter sur un autre appareil.</p>
        </div>
        <div className="card">
          <div className="label-up">Préférences</div>
          <label className="check" style={{ justifyContent: 'space-between' }}>Langue des messages
            <select className="select" value={s.participant.lang} onChange={(e) => setLang(e.target.value)}><option value="FR">Français</option><option value="EN">English</option><option value="ES">Español</option></select>
          </label>
          <p className="small muted">Pour recevoir les alertes même app fermée, ajoute Beyond Events à ton écran d'accueil (menu du navigateur › « Sur l'écran d'accueil »).</p>
        </div>
        <button type="button" className="btn big block" onClick={() => { setCodeSession(null); nav('/') }}>Se déconnecter de cette course</button>
        <Link to="/confidentialite" className="small muted" style={{ textAlign: 'center' }}>Politique de confidentialité</Link>
      </div>
      <TabBar items={tabs} />
    </div>
  )
}
