import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store'
import { events, posts, DEMO_PARTICIPANT_CODE, DEMO_VOLUNTEER_CODE } from '../data/demo'
import type { Practice } from '../data/types'
import { BackBar, EventMap, Icon, Progress, TabBar } from '../components/ui'

const runnerTabs = [
  { to: '/app/course', label: 'Fil', end: true },
  { to: '/app/course/documents', label: 'Documents' },
  { to: '/app/course/messages', label: 'Messages' },
  { to: '/app/compte', label: 'Mon compte' },
]
const volunteerTabs = [
  { to: '/app/benevole', label: 'Mon poste', end: true },
  { to: '/app/benevole/equipe', label: 'Équipe' },
  { to: '/app/benevole/carte', label: 'Carte' },
  { to: '/app/compte', label: 'Mon compte' },
]

// Redirige vers le bon espace selon le rôle de la session.
function Gate() {
  const { session } = useStore()
  return <Navigate to={!session ? '/app/rejoindre' : session.role === 'benevole' ? '/app/benevole' : '/app/course'} replace />
}

// ---------- Visiteur ----------

export function Bienvenue() {
  return (
    <div className="screen" style={{ background: 'var(--ink)', color: '#fff', padding: '48px 24px 28px', gap: 14 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 }}>
        <div className="display" style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 22 }}>[N]</div>
        <h1 style={{ fontSize: 34, lineHeight: 1.1 }}>[Nom du produit]</h1>
        <p style={{ fontSize: 16, lineHeight: 1.5, color: '#C9D3CE' }}>Toutes les infos de ta course, au bon moment, dans ta langue.</p>
      </div>
      <Link className="btn big block" to="/app/evenements">Découvrir les événements</Link>
      <Link className="btn big block primary" to="/app/rejoindre">J'ai un code d'événement</Link>
      <Link className="btn big block" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.35)' }} to="/app/rejoindre">Me connecter (lien par e-mail)</Link>
      <Link to="/console" style={{ color: '#C9D3CE', textAlign: 'center', fontSize: 14, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Vous organisez une course ? Accéder à la console</Link>
    </div>
  )
}

const PRACTICES: (Practice | 'Tout')[] = ['Tout', 'Bikepacking', 'Gravel', 'Route', 'Trail', 'Triathlon']

export function Accueil() {
  const { session, me } = useStore()
  const [filter, setFilter] = useState<Practice | 'Tout'>('Tout')
  const live = events.filter((e) => e.live)
  const list = events.filter((e) => e.isPublic && !e.live && (filter === 'Tout' || e.practice === filter))
  return (
    <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
    <div className="screen">
      <div style={{ padding: '18px 20px 6px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="row">
          <h1 className="grow" style={{ fontSize: 26 }}>Événements</h1>
          <Link to="/app" className="icon-btn" aria-label="Accueil de l'app">{Icon.back}</Link>
        </div>
        <div className="chips" role="group" aria-label="Filtrer par pratique" style={{ flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 4 }}>
          {PRACTICES.map((p) => <button key={p} type="button" className="chip" aria-pressed={filter === p} onClick={() => setFilter(p)} style={{ flex: '0 0 auto' }}>{p}</button>)}
        </div>
      </div>
      <div className="screen-body" style={{ paddingBottom: 110 }}>
        {live.map((e) => (
          <Link key={e.id} to={`/app/live/${e.id}`} className="card" style={{ border: '2px solid var(--alert)', textDecoration: 'none', color: 'var(--ink)', flexDirection: 'row', alignItems: 'center' }}>
            <span className="pill live"><span className="dot" />EN DIRECT</span>
            <div className="grow" style={{ flex: 1 }}>
              <div className="card-title">{e.name}</div>
              <div className="small muted">142 coureurs suivis · ouvert à tous</div>
            </div>
            <span style={{ color: 'var(--alert)', fontWeight: 700, fontSize: 13 }}>Suivre</span>
          </Link>
        ))}
        {session && (
          <>
            <div className="label-up">Mes événements</div>
            <Link to={session.role === 'benevole' ? '/app/benevole' : '/app/course'} className="row" style={{ background: 'var(--ink)', color: '#fff', borderRadius: 16, padding: 14, textDecoration: 'none', gap: 12 }}>
              <div className="display" style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18 }}>BB</div>
              <div className="grow">
                <div style={{ fontWeight: 700 }}>Beyond Borders 2027</div>
                <div className="small" style={{ color: '#B9C4BE' }}>{session.role === 'benevole' ? 'Bénévole' : `Participant · dossard ${me?.bib ?? ''}`}</div>
              </div>
            </Link>
          </>
        )}
        <div className="label-up" style={{ marginTop: 4 }}>À découvrir</div>
        {list.length === 0 && <p className="muted small">Aucun événement pour cette pratique pour l'instant.</p>}
        {list.map((e) => (
          <Link key={e.id} to={`/app/evenement/${e.id}`} className="event-card">
            <div className="band" style={{ background: e.band }}><span>{e.practice}</span></div>
            <div className="body">
              <div className="card-title">{e.name}</div>
              <div className="small muted">{e.org}</div>
              <div className="small" style={{ color: 'var(--ink-2)' }}>{e.date} · {e.place} · {e.distances.join(' / ')}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
      <div className="fade-bottom" />
      <Link to="/app/rejoindre" className="floating">{Icon.key} Rejoindre un événement</Link>
    </div>
  )
}

export function Fiche() {
  const { id } = useParams()
  const e = events.find((x) => x.id === id)
  if (!e) return <Navigate to="/app/evenements" />
  return (
    <div className="screen">
      <div style={{ height: 190, background: e.band, padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <Link to="/app/evenements" className="icon-btn" aria-label="Retour">{Icon.back}</Link>
          <button type="button" className="icon-btn" aria-label="Partager">{Icon.share}</button>
        </div>
        <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>[Photo ou visuel de l'événement]</span>
      </div>
      <div className="screen-body">
        <span className="tag info">{e.practice}</span>
        <h1 style={{ fontSize: 26 }}>{e.name}</h1>
        <p className="muted">par {e.org}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[['Départ', e.date], ['Distance', e.distances.join(' / ')], ['Lieu', e.place]].map(([k, v]) => (
            <div key={k} className="card" style={{ padding: 10, gap: 2 }}><span className="small muted" style={{ fontSize: 11 }}>{k}</span><strong style={{ fontSize: 14 }}>{v}</strong></div>
          ))}
        </div>
        <p className="card-text">{e.description}</p>
        <div className="card">
          <div className="row"><span className="grow muted">Inscriptions</span><strong className={e.registrationOpen ? 'ok' : ''}>{e.registrationOpen ? 'Ouvertes' : 'Fermées'}</strong></div>
          <div className="row"><span className="grow muted">Tarif</span><strong>[Prix]</strong></div>
        </div>
      </div>
      <div className="sheet" style={{ borderRadius: 0 }}>
        <a className="btn big block primary" href="#" onClick={(ev) => ev.preventDefault()}>S'inscrire sur le site de l'organisateur {Icon.external}</a>
        <Link className="btn block" style={{ border: 0, color: 'var(--forest)' }} to="/app/rejoindre">Déjà inscrit ? Saisir mon code</Link>
      </div>
    </div>
  )
}

export function Rejoindre() {
  const { join } = useStore()
  const nav = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const submit = (ev: FormEvent) => {
    ev.preventDefault()
    const role = join(code)
    if (!role) { setError('Code non reconnu. Vérifie l’e-mail de l’organisateur.'); return }
    nav(role === 'benevole' ? '/app/benevole' : '/app/course')
  }
  return (
    <form className="screen" onSubmit={submit}>
      <BackBar to="/app" close />
      <div className="screen-body" style={{ padding: '8px 24px', gap: 14 }}>
        <h1 style={{ fontSize: 28 }}>Rejoindre un événement</h1>
        <p className="card-text" style={{ fontSize: 15 }}>Saisis le code personnel reçu par e-mail. Il t'ouvre l'espace de la course, comme participant ou comme bénévole.</p>
        <div className="field">
          <label htmlFor="code">Ton code personnel</label>
          <input id="code" className="input display" autoComplete="one-time-code" value={code} onChange={(e) => { setCode(e.target.value); setError('') }} placeholder="XXXX-XXXX" style={{ minHeight: 64, fontSize: 26, fontWeight: 700, letterSpacing: '.15em', textAlign: 'center', textTransform: 'uppercase', border: '2px solid var(--forest)' }} />
          {error && <p className="small ko" role="alert">{error}</p>}
        </div>
        <div className="card soft small">
          <strong>Codes de démo</strong>
          <button type="button" className="btn" onClick={() => setCode(DEMO_PARTICIPANT_CODE)}>Participant : {DEMO_PARTICIPANT_CODE}</button>
          <button type="button" className="btn" onClick={() => setCode(DEMO_VOLUNTEER_CODE)}>Bénévole : {DEMO_VOLUNTEER_CODE}</button>
        </div>
      </div>
      <div style={{ padding: '12px 24px 24px' }}>
        <button type="submit" className="btn big block primary" disabled={code.trim().length < 6}>Rejoindre l'espace de la course</button>
      </div>
    </form>
  )
}

export function Tracking() {
  const [q, setQ] = useState('')
  const [notif, setNotif] = useState(false)
  return (
    <div className="screen" style={{ background: '#E8EEE6' }}>
      <div className="bar" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        <div className="row">
          <Link to="/app/evenements" className="icon-btn plain" aria-label="Retour">{Icon.back}</Link>
          <h1 className="grow" style={{ fontSize: 19 }}>Gravel des Crêtes</h1>
          <span className="pill live"><span className="dot" />EN DIRECT</span>
        </div>
        <label htmlFor="q" className="sr-only">Chercher un coureur</label>
        <input id="q" className="input" style={{ borderRadius: 22, background: 'var(--bg)' }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un coureur : nom ou dossard" />
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <EventMap showPosts={false} showVolunteers={false} showRunners show850={false} followed={23} runners={60} height={420} />
      </div>
      <div className="sheet">
        <div className="grip" />
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="grow">
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)' }}>COUREUR SUIVI</div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{q ? `Résultat pour « ${q} »` : '[Nom du coureur] · 214'}</div>
            <div className="small muted">Km 128 sur 180 · position il y a 2 min</div>
          </div>
          <div style={{ textAlign: 'right' }}><div className="display" style={{ fontSize: 22, fontWeight: 700 }}>23e</div><div className="small muted">sur 142</div></div>
        </div>
        <Progress value={0.71} />
        <div className="row">
          <button type="button" className={`btn grow ${notif ? '' : 'primary'}`} onClick={() => setNotif(!notif)}>{notif ? '✓ Alerte activée' : 'M\'alerter à son arrivée'}</button>
          <button type="button" className="btn grow">Tête de course</button>
        </div>
        <p className="small muted" style={{ textAlign: 'center' }}>Accès libre pendant l'événement, sans compte</p>
      </div>
    </div>
  )
}

// ---------- Participant ----------

function RunnerHeader() {
  const { me, tracking } = useStore()
  return (
    <>
      <div className="app-header">
        <div className="row"><span className="title grow">Beyond Borders 2027</span><span className="pill dark">{me?.lang}</span></div>
        <span className="sub">Dossard {me?.bib} · {me?.distance} · {me?.status}</span>
      </div>
      {tracking && (
        <div className="row small" style={{ background: 'var(--forest-soft)', padding: '8px 16px' }}>
          <span className="dot" style={{ color: 'var(--forest)', width: 10, height: 10 }} />
          <span className="grow"><strong>Suivi GPS actif</strong> · visible sur la carte publique</span>
          <Link to="/app/compte" style={{ fontWeight: 600 }}>Gérer</Link>
        </div>
      )}
    </>
  )
}

export function Fil() {
  const { me, messages, confirmMessage, readMessage } = useStore()
  const mine = useMemo(() => (me ? messages.filter((m) => m.recipients.includes(me.id)) : []), [me, messages])
  const ids = mine.map((m) => m.id).join(',')
  useEffect(() => { ids.split(',').filter(Boolean).forEach((id) => readMessage(id)) }, [ids, readMessage])
  if (!me) return <Gate />
  return (
    <div className="screen">
      <RunnerHeader />
      <div className="screen-body">
        {mine.map((m) => {
          const done = m.readInApp.includes(me.id)
          const urgent = m.requireConfirm && !done
          return (
            <article key={m.id} className={`card ${urgent && m.kind === 'alerte' ? 'alert' : ''}`}>
              <div className="card-meta"><span className={`tag ${m.kind}`}>{m.kind === 'alerte' ? 'ALERTE' : m.kind === 'relance' ? 'RELANCE' : 'INFO'} · {m.sentAt}</span>{done && m.requireConfirm && <span className="ok" style={{ fontWeight: 600 }}>✓ Confirmé</span>}</div>
              <div className="card-title">{m.title}</div>
              <div className="card-text">{m.body}</div>
              {urgent && <button type="button" className={`btn ${m.kind === 'alerte' ? 'alert' : 'primary'}`} onClick={() => confirmMessage(m.id)}>J'ai lu et compris</button>}
            </article>
          )
        })}
      </div>
      <div style={{ padding: '0 16px 12px' }}><Link to="/app/course/incident" className="btn big block dark">Signaler un abandon ou un incident</Link></div>
      <TabBar items={runnerTabs} />
    </div>
  )
}

export function Documents() {
  const { me } = useStore()
  if (!me) return <Gate />
  return (
    <div className="screen">
      <RunnerHeader />
      <div className="screen-body">
        {['Manuel de course v2 (PDF)', `Trace GPX ${me.distance}`, 'Liste du matériel obligatoire', 'Plan des ravitaillements'].map((d) => (
          <div key={d} className="card" style={{ flexDirection: 'row', alignItems: 'center' }}>
            <div className="grow" style={{ flex: 1 }}><div className="card-title">{d}</div><div className="small ok">✓ Disponible hors ligne</div></div>
            <button type="button" className="btn">Ouvrir</button>
          </div>
        ))}
      </div>
      <TabBar items={runnerTabs} />
    </div>
  )
}

export function MessagesPrives() {
  const { me, notify } = useStore()
  const [list, setList] = useState([{ from: 'Organisation', text: 'Bonjour ! Pose-nous ici tes questions sur la course.', mine: false }])
  const [txt, setTxt] = useState('')
  if (!me) return <Gate />
  return (
    <div className="screen">
      <RunnerHeader />
      <div className="screen-body">
        {list.map((m, i) => <div key={i} className={`bubble ${m.mine ? 'mine' : ''}`}><span className="who">{m.from}</span><span className="text">{m.text}</span></div>)}
      </div>
      <form className="row" style={{ padding: '10px 12px', background: '#fff', borderTop: '1px solid var(--line)' }} onSubmit={(e) => { e.preventDefault(); if (!txt.trim()) return; setList([...list, { from: 'Moi', text: txt, mine: true }]); setTxt(''); notify('Message envoyé à l’organisation.') }}>
        <label htmlFor="pm" className="sr-only">Message à l'organisation</label>
        <input id="pm" className="input grow" style={{ borderRadius: 22 }} placeholder="Écrire à l'organisation…" value={txt} onChange={(e) => setTxt(e.target.value)} />
        <button type="submit" className="icon-btn" style={{ background: 'var(--forest)', color: '#fff', border: 0 }} aria-label="Envoyer">{Icon.send}</button>
      </form>
      <TabBar items={runnerTabs} />
    </div>
  )
}

const INCIDENTS = ['Abandon', 'Problème mécanique', 'Blessure ou malaise', 'Autre (route, météo, hébergement…)']

export function Incident() {
  const { me, report } = useStore()
  const nav = useNavigate()
  const [type, setType] = useState(INCIDENTS[0])
  const [txt, setTxt] = useState('')
  if (!me) return <Gate />
  return (
    <form className="screen" onSubmit={(e) => { e.preventDefault(); report(type, txt || type, 'Km 612 · entre CP2 et CP3'); nav('/app/course') }}>
      <BackBar to="/app/course" title="Prévenir le PC course" />
      <div className="screen-body">
        <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <legend style={{ fontWeight: 700, marginBottom: 8 }}>Que se passe-t-il ?</legend>
          {INCIDENTS.map((i) => (
            <label key={i} className="check" style={{ background: type === i ? 'var(--alert-soft)' : '#fff', border: type === i ? '2px solid var(--alert)' : '1px solid var(--line-2)', borderRadius: 12, padding: '0 14px', fontWeight: type === i ? 700 : 400, minHeight: 52 }}>
              <input type="radio" name="t" checked={type === i} onChange={() => setType(i)} style={{ accentColor: 'var(--alert)' }} /> {i === 'Abandon' ? 'J\'abandonne la course' : i}
            </label>
          ))}
        </fieldset>
        <div className="card"><span className="small muted">Ta position sera jointe</span><strong>45,0921 N · 6,4073 E · précision 12 m</strong><span className="small muted">Km 612 sur la trace · entre CP2 et CP3</span></div>
        <div className="field"><label htmlFor="d">Précisions (facultatif)</label><textarea id="d" className="textarea" rows={3} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Ex. : je rejoins la gare, pas besoin de rapatriement" /></div>
      </div>
      <div className="sheet" style={{ borderRadius: 0 }}>
        <button type="submit" className="btn big block alert">Envoyer au PC course</button>
        <p className="small" style={{ textAlign: 'center' }}>Sans réseau, l'envoi partira dès que le réseau revient.<br /><strong>Urgence vitale : appelle le 112.</strong></p>
      </div>
    </form>
  )
}

export function Compte() {
  const { session, me, meVolunteer, tracking, setTracking, setSession } = useStore()
  const nav = useNavigate()
  if (!session) return <Gate />
  return (
    <div className="screen">
      <div style={{ padding: 20 }} className="row">
        <div className="display" style={{ width: 56, height: 56, borderRadius: 28, background: 'var(--forest)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20 }}>T</div>
        <div className="grow"><h1 style={{ fontSize: 22 }}>{me?.name ?? meVolunteer?.name}</h1><div className="small muted">{session.role === 'benevole' ? 'Bénévole' : `Participant · dossard ${me?.bib}`}</div></div>
      </div>
      <div className="screen-body" style={{ paddingTop: 0 }}>
        <div className="card">
          <div className="label-up">Mes événements</div>
          <Link to={session.role === 'benevole' ? '/app/benevole' : '/app/course'} className="row" style={{ minHeight: 44, textDecoration: 'none', color: 'var(--ink)' }}><span className="grow" style={{ fontWeight: 600 }}>Beyond Borders 2027</span><span className="small ok">{session.role === 'benevole' ? 'Bénévole' : 'Participant'}</span></Link>
        </div>
        <div className="card">
          <div className="label-up">Préférences</div>
          <label className="check" style={{ justifyContent: 'space-between' }}>Langue <select className="select" defaultValue="Français"><option>Français</option><option>English</option><option>Español</option></select></label>
          <label className="check" style={{ justifyContent: 'space-between' }}>Notifications push <input type="checkbox" defaultChecked /></label>
          <label className="check" style={{ justifyContent: 'space-between' }}>SMS pour les alertes critiques <input type="checkbox" defaultChecked /></label>
          {session.role === 'participant' && <label className="check" style={{ justifyContent: 'space-between' }}>Suivi GPS pendant la course <input type="checkbox" checked={tracking} onChange={(e) => setTracking(e.target.checked)} /></label>}
        </div>
        <div className="card">
          <div className="label-up">Mes données</div>
          <button type="button" className="btn">Télécharger mes données</button>
          <button type="button" className="btn" style={{ color: 'var(--alert)' }}>Supprimer mon compte</button>
        </div>
        <button type="button" className="btn big block" onClick={() => { setSession(null); nav('/app') }}>Se déconnecter</button>
      </div>
      <TabBar items={session.role === 'benevole' ? volunteerTabs : runnerTabs} />
    </div>
  )
}

// ---------- Bénévole ----------

function VolunteerHeader() {
  const { meVolunteer } = useStore()
  return (
    <div className="app-header">
      <div className="row"><span className="title grow">Beyond Borders 2027</span><span className="pill sand">Bénévole</span></div>
      <span className="sub">{meVolunteer?.name} · [jour de la course]</span>
    </div>
  )
}

export function BenevolePoste() {
  const { meVolunteer, volunteers, postMessages, toggleCheckIn, confirmPresence, report } = useStore()
  const [rules, setRules] = useState(false)
  const [reporting, setReporting] = useState(false)
  if (!meVolunteer) return <Gate />
  const post = posts.find((p) => p.id === meVolunteer.postId)!
  const here = volunteers.filter((v) => v.postId === post.id && v.checkedIn).length
  const msgs = postMessages.filter((m) => m.postId === post.id || m.postId === 'tous')
  return (
    <div className="screen">
      <VolunteerHeader />
      <div className="screen-body">
        <section className="card">
          <div className="card-meta"><span className="label-up">Mon poste</span>{meVolunteer.confirmed ? <span className="ok" style={{ fontWeight: 700 }}>✓ Présence confirmée</span> : <button type="button" className="btn primary" onClick={confirmPresence}>Confirmer ma présence</button>}</div>
          <h2 style={{ fontSize: 22 }}>{post.name}</h2>
          <p className="card-text">[Lieu du poste]<br />{post.hours} · {here} sur {post.capacity} bénévoles sur place</p>
          <div className="row" style={{ borderTop: '1px solid #EEF1EF', paddingTop: 10 }}><span className="grow small"><span className="muted">Responsable :</span> <strong>{post.lead}</strong></span><a className="btn" href="tel:+33600000000">Appeler</a></div>
        </section>
        <button type="button" className={`btn big block ${meVolunteer.checkedIn ? '' : 'primary'}`} onClick={toggleCheckIn}>{meVolunteer.checkedIn ? '✓ Sur le poste · Pointer mon départ' : 'Je suis arrivé sur le poste'}</button>
        <section className="card" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <div style={{ flex: 1 }}><div className="card-title">Consignes du poste</div><div className={`small ${rules ? 'ok' : 'ko'}`} style={{ fontWeight: 600 }}>{rules ? '✓ Lues et confirmées' : 'À lire et confirmer'}</div></div>
          <button type="button" className="btn" onClick={() => setRules(true)}>{rules ? 'Relire' : 'Lire et confirmer'}</button>
        </section>
        {msgs.map((m) => (
          <section key={m.id} className="card soft">
            <div className="card-meta" style={{ color: 'var(--forest-dark)', fontWeight: 700 }}><span>PC course → {m.postId === 'tous' ? 'Tous les bénévoles' : post.name}</span><span>{m.at}</span></div>
            <p className="card-text" style={{ color: 'var(--ink)' }}>{m.body}</p>
          </section>
        ))}
        {reporting ? (
          <section className="card warn">
            <div className="card-title">Signaler au PC course</div>
            {['Besoin de ravitaillement', 'Coureur en difficulté', 'Incident sur le poste'].map((t) => (
              <button key={t} type="button" className="btn" onClick={() => { report(t, t, post.name); setReporting(false) }}>{t}</button>
            ))}
            <button type="button" className="btn" style={{ border: 0 }} onClick={() => setReporting(false)}>Annuler</button>
          </section>
        ) : (
          <button type="button" className="btn big block outline-alert" onClick={() => setReporting(true)}>Signaler au PC course</button>
        )}
      </div>
      <TabBar items={volunteerTabs} />
    </div>
  )
}

export function BenevoleEquipe() {
  const { meVolunteer, teamMessages, postMessages, volunteers, sendTeamMessage } = useStore()
  const [txt, setTxt] = useState('')
  if (!meVolunteer) return <Gate />
  const post = posts.find((p) => p.id === meVolunteer.postId)!
  const pinned = postMessages.find((m) => m.postId === post.id)
  const team = volunteers.filter((v) => v.postId === post.id)
  return (
    <div className="screen">
      <div className="bar">
        <div className="grow" style={{ padding: '4px 8px' }}><h1 style={{ fontSize: 18 }}>Équipe {post.name.replace('Ravitaillement', 'Ravito')}</h1><div className="small muted">{team.length} bénévoles · {team.filter((v) => v.checkedIn).length} sur le poste</div></div>
      </div>
      {pinned && <div style={{ background: 'var(--forest-soft)', padding: '10px 16px' }}><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--forest-dark)' }}>ÉPINGLÉ · PC COURSE</div><div className="small">{pinned.body}</div></div>}
      <div className="screen-body">
        {teamMessages.filter((m) => m.postId === post.id).map((m) => (
          <div key={m.id} className={`bubble ${m.mine ? 'mine' : ''}`}><span className="who">{m.from} · {m.at}</span><span className="text">{m.text}</span></div>
        ))}
      </div>
      <form className="row" style={{ padding: '10px 12px', background: '#fff', borderTop: '1px solid var(--line)' }} onSubmit={(e) => { e.preventDefault(); sendTeamMessage(txt); setTxt('') }}>
        <label htmlFor="tm" className="sr-only">Message à l'équipe</label>
        <input id="tm" className="input grow" style={{ borderRadius: 22 }} placeholder="Message à l'équipe…" value={txt} onChange={(e) => setTxt(e.target.value)} />
        <button type="submit" className="icon-btn" style={{ background: 'var(--forest)', color: '#fff', border: 0 }} aria-label="Envoyer">{Icon.send}</button>
      </form>
      <TabBar items={volunteerTabs} />
    </div>
  )
}

export function BenevoleCarte() {
  const { meVolunteer, volunteers } = useStore()
  const [share, setShare] = useState(true)
  if (!meVolunteer) return <Gate />
  const post = posts.find((p) => p.id === meVolunteer.postId)!
  return (
    <div className="screen" style={{ background: '#E8EEE6' }}>
      <div className="app-header" style={{ flexDirection: 'row', alignItems: 'center' }}><span className="title grow" style={{ fontSize: 18 }}>Carte · Beyond Borders 2027</span><span className="pill sand">Bénévole</span></div>
      <div style={{ flex: 1, minHeight: 0 }}><EventMap volunteers={volunteers} highlightPost={post.id} me={share} height={430} /></div>
      <div className="sheet">
        <div className="grip" />
        <div><div style={{ fontWeight: 700, fontSize: 17 }}>{post.name} · mon poste</div><div className="small muted">{volunteers.filter((v) => v.postId === post.id && v.checkedIn).length} sur {post.capacity} bénévoles sur place · tu es à 400 m</div></div>
        <div className="row"><button type="button" className="btn grow">Itinéraire</button><a className="btn grow primary" href="tel:+33600000000">Appeler le responsable</a></div>
        <label className="check" style={{ justifyContent: 'space-between', borderTop: '1px solid #EEF1EF' }}>Partager ma position pendant mon créneau <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} /></label>
      </div>
      <TabBar items={volunteerTabs} />
    </div>
  )
}
