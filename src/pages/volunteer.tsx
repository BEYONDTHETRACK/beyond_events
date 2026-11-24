import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ago, getCodeSession, setCodeSession, usePoll } from '../lib/util'
import type { VolunteerState } from '../lib/types'
import { ErrorNote, Icon, Loading, TabBar, useToast } from '../components/ui'

interface Ctx { s: VolunteerState; code: string; reload: () => Promise<void> }
const VolCtx = createContext<Ctx | null>(null)
const useVol = () => useContext(VolCtx)!

const tabs = [
  { to: '/benevole', label: 'Mon poste', end: true },
  { to: '/benevole/equipe', label: 'Équipe' },
  { to: '/benevole/postes', label: 'Postes' },
  { to: '/benevole/compte', label: 'Compte' },
]

export function VolunteerShell() {
  const session = getCodeSession()
  const code = session?.role === 'benevole' ? session.code : ''
  const { data, error, loading, reload } = usePoll(async () => {
    const { data, error } = await supabase.rpc('volunteer_state', { p_code: code })
    if (error) throw error
    return data as VolunteerState | null
  }, 5000, [code])
  if (!code) return <Navigate to="/rejoindre" replace />
  if (loading && !data) return <Loading />
  if (!data) {
    return (
      <div className="screen" style={{ padding: 24, gap: 12 }}>
        <ErrorNote error={error} />
        <p>Ce code n'est plus valide.</p>
        <button type="button" className="btn primary" onClick={() => { setCodeSession(null); window.location.hash = '#/rejoindre' }}>Saisir un autre code</button>
      </div>
    )
  }
  return <VolCtx.Provider value={{ s: data, code, reload }}><Outlet /></VolCtx.Provider>
}

function Header() {
  const { s } = useVol()
  return (
    <div className="app-header">
      <div className="row"><span className="title grow">{s.event.name}</span><span className="pill sand">Bénévole</span></div>
      <span className="sub">{s.volunteer.name}</span>
    </div>
  )
}

export function Poste() {
  const { s, code, reload } = useVol()
  const notify = useToast()
  const [showRules, setShowRules] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [busy, setBusy] = useState(false)
  const v = s.volunteer
  const here = !!v.checked_in_at && !v.checked_out_at
  const act = async (action: string, msg: string) => {
    setBusy(true)
    const { error } = await supabase.rpc('volunteer_action', { p_code: code, p_action: action })
    setBusy(false)
    if (error) { notify(`Erreur : ${error.message}`); return }
    notify(msg)
    reload()
  }
  const report = async (t: string) => {
    const { error } = await supabase.rpc('volunteer_report', { p_code: code, p_type: t, p_body: t })
    setReporting(false)
    notify(error ? `Erreur : ${error.message}` : 'Envoyé au PC course.')
  }
  const post = s.post
  return (
    <div className="screen">
      <Header />
      <div className="screen-body">
        {!post && <div className="card warn">Tu n'es pas encore affecté à un poste. L'organisateur va te l'indiquer.</div>}
        {post && (
          <section className="card">
            <div className="card-meta">
              <span className="label-up">Mon poste</span>
              {v.confirmed_at
                ? <span className="ok" style={{ fontWeight: 700 }}>✓ Présence confirmée</span>
                : <button type="button" className="btn primary" disabled={busy} onClick={() => act('confirm', 'Présence confirmée, merci !')}>Confirmer ma présence</button>}
            </div>
            <h2 style={{ fontSize: 22 }}>{post.name}</h2>
            <p className="card-text">{[post.place, post.hours].filter(Boolean).join(' · ') || 'Lieu et horaires à venir'}<br />{s.team.filter((t) => t.here).length} sur {post.capacity} bénévoles sur place</p>
            {post.lead_name && (
              <div className="row" style={{ borderTop: '1px solid #EEF1EF', paddingTop: 10 }}>
                <span className="grow small"><span className="muted">Responsable :</span> <strong>{post.lead_name}</strong>{post.lead_phone ? ` · ${post.lead_phone}` : ''}</span>
                {post.lead_phone && <a className="btn" href={`tel:${post.lead_phone.replace(/\s/g, '')}`}>Appeler</a>}
              </div>
            )}
          </section>
        )}
        {post && (
          <button type="button" disabled={busy} className={`btn big block ${here ? '' : 'primary'}`}
            onClick={() => act(here ? 'checkout' : 'checkin', here ? 'Départ du poste enregistré.' : 'Arrivée sur le poste enregistrée.')}>
            {here ? '✓ Sur le poste · Pointer mon départ' : 'Je suis arrivé sur le poste'}
          </button>
        )}
        {post?.instructions && (
          <section className="card">
            <div className="row">
              <div className="grow"><div className="card-title">Consignes du poste</div><div className={`small ${v.instructions_read_at ? 'ok' : 'ko'}`} style={{ fontWeight: 600 }}>{v.instructions_read_at ? '✓ Lues et confirmées' : 'À lire et confirmer'}</div></div>
              <button type="button" className="btn" onClick={() => setShowRules(!showRules)}>{showRules ? 'Fermer' : 'Lire'}</button>
            </div>
            {showRules && (
              <>
                <p className="card-text">{post.instructions}</p>
                {!v.instructions_read_at && <button type="button" className="btn primary" onClick={() => act('instructions', 'Consignes confirmées.')}>J'ai lu les consignes</button>}
              </>
            )}
          </section>
        )}
        {s.post_messages.map((m) => (
          <section key={m.id} className="card soft">
            <div className="card-meta" style={{ color: 'var(--forest-dark)', fontWeight: 700 }}><span>PC course → {m.all ? 'Tous les bénévoles' : post?.name}</span><span>{ago(m.created_at)}</span></div>
            <p className="card-text" style={{ color: 'var(--ink)' }}>{m.body}</p>
          </section>
        ))}
        {reporting ? (
          <section className="card warn">
            <div className="card-title">Signaler au PC course</div>
            {['Besoin de ravitaillement', 'Coureur en difficulté', 'Incident sur le poste'].map((t) => <button key={t} type="button" className="btn" onClick={() => report(t)}>{t}</button>)}
            <button type="button" className="btn" style={{ border: 0 }} onClick={() => setReporting(false)}>Annuler</button>
          </section>
        ) : (
          <button type="button" className="btn big block outline-alert" onClick={() => setReporting(true)}>Signaler au PC course</button>
        )}
      </div>
      <TabBar items={tabs} />
    </div>
  )
}

export function Equipe() {
  const { s, code, reload } = useVol()
  const [txt, setTxt] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const count = s.team_messages.length
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [count])
  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (!txt.trim()) return
    await supabase.rpc('volunteer_send_team', { p_code: code, p_body: txt })
    setTxt('')
    reload()
  }
  if (!s.post) return <div className="screen"><Header /><p className="muted" style={{ padding: 16 }}>Le groupe d'équipe s'ouvre quand tu es affecté à un poste.</p><TabBar items={tabs} /></div>
  const pinned = s.post_messages.find((m) => !m.all)
  return (
    <div className="screen">
      <div className="bar">
        <div className="grow" style={{ padding: '4px 8px' }}>
          <h1 style={{ fontSize: 18 }}>Équipe {s.post.name}</h1>
          <div className="small muted">{s.team.length} bénévoles · {s.team.filter((t) => t.here).length} sur le poste</div>
        </div>
      </div>
      {pinned && <div style={{ background: 'var(--forest-soft)', padding: '10px 16px' }}><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--forest-dark)' }}>ÉPINGLÉ · PC COURSE</div><div className="small">{pinned.body}</div></div>}
      <div className="screen-body">
        {s.team_messages.length === 0 && <p className="muted small">Pas encore de message. Lance la discussion avec ton équipe.</p>}
        {s.team_messages.map((m) => (
          <div key={m.id} className={`bubble ${m.mine ? 'mine' : ''}`}><span className="who">{m.mine ? 'Moi' : m.author} · {ago(m.created_at)}</span><span className="text">{m.body}</span></div>
        ))}
        <div ref={end} />
      </div>
      <form className="row" style={{ padding: '10px 12px', background: '#fff', borderTop: '1px solid var(--line)' }} onSubmit={send}>
        <label htmlFor="tm" className="sr-only">Message à l'équipe</label>
        <input id="tm" className="input grow" style={{ borderRadius: 22 }} placeholder="Message à l'équipe…" value={txt} onChange={(e) => setTxt(e.target.value)} />
        <button type="submit" className="icon-btn" style={{ background: 'var(--forest)', color: '#fff', border: 0 }} aria-label="Envoyer">{Icon.send}</button>
      </form>
      <TabBar items={tabs} />
    </div>
  )
}

export function Postes() {
  const { s } = useVol()
  return (
    <div className="screen">
      <Header />
      <div className="screen-body">
        <p className="small muted">Tous les postes de l'événement et le nombre de bénévoles pointés. La carte avec le tracé arrive dans une prochaine version.</p>
        {s.posts.map((p) => {
          const mine = p.id === s.volunteer.post_id
          const short = p.here < p.capacity
          return (
            <div key={p.id} className={`card ${mine ? 'soft' : ''}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <div className="grow" style={{ flex: 1 }}>
                <div className="card-title">{p.name}{mine ? ' · mon poste' : ''}</div>
                <div className="small muted">{p.hours || 'Horaires à venir'} · {p.assigned} affectés</div>
              </div>
              <strong className={short ? 'ko' : 'ok'}>{p.here} / {p.capacity}</strong>
            </div>
          )
        })}
      </div>
      <TabBar items={tabs} />
    </div>
  )
}

export function CompteBenevole() {
  const { s } = useVol()
  const nav = useNavigate()
  return (
    <div className="screen">
      <Header />
      <div className="screen-body">
        <div className="card">
          <div className="label-up">Mon accès</div>
          <div className="card-title">{s.volunteer.name}</div>
          <div className="small muted">Code personnel : <strong className="code" style={{ color: 'var(--ink)' }}>{s.volunteer.code}</strong></div>
          <p className="small muted">Garde ce code pour te reconnecter sur un autre appareil.</p>
        </div>
        <button type="button" className="btn big block" onClick={() => { setCodeSession(null); nav('/') }}>Se déconnecter de cet événement</button>
      </div>
      <TabBar items={tabs} />
    </div>
  )
}
