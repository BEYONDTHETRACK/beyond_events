import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { dateFr, getCodeSession, setCodeSession, usePoll } from '../lib/util'
import { PRACTICES } from '../lib/types'
import type { CodeSession, EventRow } from '../lib/types'
import { BackBar, ErrorNote, Icon, Loading } from '../components/ui'
import { Symbol, Wordmark } from '../components/Logo'

// Reprise automatique de la session au lancement de l'app (une seule fois par ouverture)
let resumed = false

export function Bienvenue() {
  const s = getCodeSession()
  if (s && !resumed) {
    resumed = true
    return <Navigate to={s.role === 'benevole' ? '/benevole' : '/course'} replace />
  }
  resumed = true
  return (
    <div className="screen welcome" style={{ background: 'var(--ink)', color: '#fff', padding: '48px 24px 28px', gap: 14 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 }}>
        <Symbol size={76} />
        <h1 aria-label="Beyond Events" style={{ fontSize: 44, lineHeight: 1, fontWeight: 700 }}><Wordmark size={44} /></h1>
        <p style={{ fontSize: 16, lineHeight: 1.5, color: '#B8C4D2' }}>Toutes les infos de ta course, au bon moment, dans ta langue.</p>
      </div>
      {s && (
        <Link className="btn big block primary" to={s.role === 'benevole' ? '/benevole' : '/course'}>
          Reprendre : {s.event_name} ({s.role === 'benevole' ? 'bénévole' : 'participant'})
        </Link>
      )}
      <Link className={`btn big block ${s ? '' : 'primary'}`} to="/rejoindre">J'ai un code personnel</Link>
      <Link className="btn big block" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.35)' }} to="/evenements">Découvrir les événements</Link>
      <Link to="/console" style={{ color: '#B8C4D2', textAlign: 'center', fontSize: 14, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Vous organisez une course ? Accéder à la console</Link>
      <Link to="/confidentialite" style={{ color: '#8A97A8', textAlign: 'center', fontSize: 12 }}>Confidentialité</Link>
    </div>
  )
}

type PubEvent = Pick<EventRow, 'id' | 'name' | 'practice' | 'starts_on' | 'place' | 'distances' | 'color' | 'description' | 'registration_url' | 'registration_status'>

export function Evenements() {
  const [filter, setFilter] = useState<string>('Tout')
  const { data, error, loading } = usePoll(async () => {
    const { data, error } = await supabase.from('events')
      .select('id,name,practice,starts_on,place,distances,color,description,registration_url,registration_status')
      .eq('is_public', true).eq('published', true).order('starts_on', { ascending: true, nullsFirst: false })
    if (error) throw error
    return data as PubEvent[]
  }, 30000)
  const list = (data ?? []).filter((e) => filter === 'Tout' || e.practice === filter)
  return (
    <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <div className="screen">
        <div style={{ padding: '18px 20px 6px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="row">
            <Link to="/" className="icon-btn plain" aria-label="Retour">{Icon.back}</Link>
            <h1 className="grow" style={{ fontSize: 26 }}>Événements</h1>
          </div>
          <div className="chips" role="group" aria-label="Filtrer par pratique" style={{ flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 4 }}>
            {['Tout', ...PRACTICES].map((p) => <button key={p} type="button" className="chip" aria-pressed={filter === p} onClick={() => setFilter(p)} style={{ flex: '0 0 auto' }}>{p}</button>)}
          </div>
        </div>
        <div className="screen-body events-grid" style={{ paddingBottom: 110 }}>
          {loading && !data && <Loading />}
          <ErrorNote error={error} />
          {data && list.length === 0 && <p className="muted small">Aucun événement public pour l'instant.</p>}
          {list.map((e) => (
            <Link key={e.id} to={`/evenement/${e.id}`} className="event-card">
              <div className="band" style={{ background: e.color }}><span>{e.practice}</span></div>
              <div className="body">
                <div className="card-title">{e.name}</div>
                <div className="small" style={{ color: 'var(--ink-2)' }}>{dateFr(e.starts_on)}{e.place ? ` · ${e.place}` : ''}{e.distances.length ? ` · ${e.distances.join(' / ')}` : ''}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <div className="fade-bottom" />
      <Link to="/rejoindre" className="floating">{Icon.key} Rejoindre un événement</Link>
    </div>
  )
}

export function Fiche() {
  const { id } = useParams()
  const { data: e, error, loading } = usePoll(async () => {
    const { data, error } = await supabase.from('events')
      .select('id,name,practice,starts_on,place,distances,color,description,registration_url,registration_status').eq('id', id!).maybeSingle()
    if (error) throw error
    return data as PubEvent | null
  }, 60000, [id])
  if (loading && !e) return <div className="screen"><BackBar to="/evenements" /><Loading /></div>
  if (!e) return <div className="screen"><BackBar to="/evenements" /><ErrorNote error={error} /><p className="muted" style={{ padding: 16 }}>Événement introuvable.</p></div>
  return (
    <div className="screen">
      <div style={{ minHeight: 170, background: e.color, padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <Link to="/evenements" className="icon-btn" aria-label="Retour">{Icon.back}</Link>
      </div>
      <div className="screen-body">
        <span className="tag info">{e.practice}</span>
        <h1 style={{ fontSize: 26 }}>{e.name}</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[['Départ', dateFr(e.starts_on)], ['Distance', e.distances.join(' / ') || '—'], ['Lieu', e.place || '—']].map(([k, v]) => (
            <div key={k} className="card" style={{ padding: 10, gap: 2 }}><span className="small muted" style={{ fontSize: 11 }}>{k}</span><strong style={{ fontSize: 14 }}>{v}</strong></div>
          ))}
        </div>
        {e.description && <p className="card-text">{e.description}</p>}
        <div className="card"><div className="row"><span className="grow muted">Inscriptions</span><strong>{e.registration_status}</strong></div></div>
      </div>
      <div className="sheet" style={{ borderRadius: 0 }}>
        {e.registration_url && <a className="btn big block primary" href={e.registration_url} target="_blank" rel="noreferrer">S'inscrire sur le site de l'organisateur {Icon.external}</a>}
        <Link className="btn block" style={{ border: 0, color: 'var(--forest)' }} to="/rejoindre">Déjà inscrit ? Saisir mon code</Link>
      </div>
    </div>
  )
}

export function Rejoindre() {
  const nav = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    setBusy(true)
    setError('')
    const { data, error } = await supabase.rpc('code_login', { p_code: code })
    setBusy(false)
    if (error) { setError(error.message); return }
    if (!data) { setError('Code non reconnu. Vérifie le message reçu de l’organisateur.'); return }
    const s = data as CodeSession
    setCodeSession(s)
    nav(s.role === 'benevole' ? '/benevole' : '/course')
  }
  return (
    <form className="screen" onSubmit={submit}>
      <BackBar to="/" close />
      <div className="screen-body" style={{ padding: '8px 24px', gap: 14 }}>
        <h1 style={{ fontSize: 28 }}>Rejoindre un événement</h1>
        <p className="card-text" style={{ fontSize: 15 }}>Saisis le code personnel envoyé par l'organisateur. Il t'ouvre l'espace de la course, comme participant ou comme bénévole.</p>
        <div className="field">
          <label htmlFor="code">Ton code personnel</label>
          <input id="code" className="input code" autoComplete="one-time-code" autoCapitalize="characters" value={code}
            onChange={(e) => { setCode(e.target.value); setError('') }} placeholder="XXXX-XXXX"
            style={{ minHeight: 64, fontSize: 26, fontWeight: 700, letterSpacing: '.15em', textAlign: 'center', textTransform: 'uppercase', border: '2px solid var(--forest)' }} />
          {error && <p className="small ko" role="alert">{error}</p>}
        </div>
      </div>
      <div style={{ padding: '12px 24px 24px' }}>
        <button type="submit" className="btn big block primary" disabled={busy || code.trim().length < 8}>{busy ? 'Vérification…' : 'Rejoindre l’espace de la course'}</button>
      </div>
    </form>
  )
}
