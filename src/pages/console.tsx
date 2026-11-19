import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom'
import { matchTarget, useStore } from '../store'
import { posts } from '../data/demo'
import type { MessageKind, MessageTarget, RunnerStatus } from '../data/types'
import { EventMap, Progress } from '../components/ui'

function pct(a: number, b: number) { return b ? Math.round((a / b) * 100) : 0 }

export function ConsoleLayout({ children }: { children: ReactNode }) {
  const { reports } = useStore()
  const open = reports.filter((r) => !r.handled).length
  const links: [string, string, number?][] = [
    ['/console', 'Tableau de bord'], ['/console/messages', 'Messages'], ['/console/participants', 'Participants'],
    ['/console/benevoles', 'Bénévoles et postes'], ['/console/carte', 'Carte'], ['/console/fiche', 'Fiche publique'],
    ['/console/inbox', 'Boîte de réception', open],
  ]
  return (
    <div className="console">
      <nav className="side" aria-label="Navigation de la console">
        <div className="brand">[Nom du produit]</div>
        <div className="event"><small>Course</small><strong>Beyond Borders 2027</strong></div>
        {links.map(([to, label, n]) => (
          <NavLink key={to} to={to} end={to === '/console'} className={({ isActive }) => (isActive ? 'active' : '')}>
            {label}{n ? <span className="count">{n}</span> : null}
          </NavLink>
        ))}
      </nav>
      <main className="main">{children}</main>
    </div>
  )
}

export function Dashboard() {
  const { participants, volunteers, messages, reports, relaunch } = useStore()
  const nav = useNavigate()
  const n = participants.length
  const activated = participants.filter((p) => p.activated).length
  const briefing = participants.filter((p) => p.briefingConfirmed).length
  const n850 = participants.filter((p) => p.distance === '850 km').length
  const open = reports.filter((r) => !r.handled).length
  return (
    <ConsoleLayout>
      <div className="page-head">
        <div><h1>Tableau de bord</h1><p>Beyond Borders 2027 · données d'exemple</p></div>
        <div className="row"><button type="button" className="btn" onClick={() => nav('/console/participants')}>Importer des participants (CSV)</button><Link className="btn primary" to="/console/messages/nouveau">Nouveau message</Link></div>
      </div>
      <div className="kpis">
        <div className="kpi"><div className="k-label">Inscrits importés</div><div className="k-value">{n}</div><div className="k-sub">850 km : {n850} · 1300 km : {n - n850}</div></div>
        <div className="kpi"><div className="k-label">Code activé</div><div className="k-value">{activated} <small>/ {n}</small></div><Progress value={activated / n} /><div className="k-sub alert">{n - activated} à relancer · relance auto tous les 3 jours</div></div>
        <div className="kpi"><div className="k-label">Briefing confirmé</div><div className="k-value">{briefing} <small>/ {n}</small></div><Progress value={briefing / n} /><div className="k-sub alert">{n - briefing} en attente</div></div>
        <div className="kpi"><div className="k-label">Bénévoles</div><div className="k-value">{volunteers.filter((v) => v.confirmed).length} <small>/ {volunteers.length}</small></div><div className="k-sub">présences confirmées</div></div>
      </div>
      <div className="cols">
        <section className="panel" style={{ flex: '2 1 480px' }}>
          <div className="row"><h2 className="grow">Messages récents</h2><Link to="/console/messages" style={{ fontWeight: 600, fontSize: 14 }}>Tout voir</Link></div>
          <MessagesTable limit={5} />
        </section>
        <section className="panel" style={{ flex: '1 1 300px' }}>
          <h2>À traiter</h2>
          <div className="card warn"><div><strong>{n - activated} participants</strong> n'ont pas encore activé leur code</div><button type="button" className="btn alert" onClick={() => relaunch('participants')}>Relancer par e-mail</button></div>
          <div className="card" style={{ background: 'var(--bg)' }}><div><strong>{n - briefing} briefings</strong> pas encore confirmés</div><button type="button" className="btn" onClick={() => relaunch('briefing')}>Relancer</button></div>
          <div className="card" style={{ background: 'var(--bg)' }}><div><strong>{open} signalements</strong> à traiter</div><Link className="btn" to="/console/inbox">Ouvrir la boîte de réception</Link></div>
          <p className="small muted">{messages.length} messages envoyés depuis l'ouverture des inscriptions.</p>
        </section>
      </div>
    </ConsoleLayout>
  )
}

function MessagesTable({ limit }: { limit?: number }) {
  const { messages } = useStore()
  const nav = useNavigate()
  const list = limit ? messages.slice(0, limit) : messages
  return (
    <div className="table-wrap">
      <table className="t" style={{ minWidth: 560 }}>
        <thead><tr><th>Message</th><th>Cible</th><th>Envoi</th><th>Lu</th></tr></thead>
        <tbody>
          {list.map((m) => {
            const read = m.readInApp.length + m.readAfterSms.length
            return (
              <tr key={m.id} className="clickable" onClick={() => nav(`/console/messages/${m.id}`)}>
                <td><Link to={`/console/messages/${m.id}`} style={{ color: 'var(--ink)', fontWeight: 600, textDecoration: 'none' }}>{m.title}</Link><div className="small muted">{m.kind === 'alerte' ? 'Alerte critique' : m.kind === 'relance' ? 'Relance' : 'Information'}{m.requireConfirm ? ' · confirmation requise' : ''}</div></td>
                <td className="muted">{m.targetLabel}</td>
                <td className="muted">{m.sentAt}</td>
                <td style={{ fontWeight: 700 }}>{pct(read, m.recipients.length)} %</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function MessagesList() {
  return (
    <ConsoleLayout>
      <div className="page-head"><div><h1>Messages</h1><p>Clique sur un message pour voir qui l'a lu.</p></div><Link className="btn primary" to="/console/messages/nouveau">Nouveau message</Link></div>
      <section className="panel"><MessagesTable /></section>
    </ConsoleLayout>
  )
}

const DIST = ['Toutes', '850 km', '1300 km'] as const
const FORMATS = ['Tous', 'Solo', 'Duo'] as const
const STATUS: (RunnerStatus | 'Tous')[] = ['Tous', 'inscrit', 'en course', 'abandon', 'finisher']

export function Compose() {
  const { participants, sendMessage } = useStore()
  const nav = useNavigate()
  const [kind, setKind] = useState<MessageKind>('alerte')
  const [target, setTarget] = useState<MessageTarget>({ distance: '1300 km', format: 'Tous', status: 'Tous' })
  const [title, setTitle] = useState('Orages sur le secteur CP2')
  const [body, setBody] = useState('Orages annoncés entre 15 h et 20 h après le CP2. Ne vous engagez pas sur le col après 14 h : abri prévu au refuge du CP2. Confirmez la lecture de ce message.')
  const [confirm, setConfirm] = useState(true)
  const [sms, setSms] = useState(true)
  const [delay, setDelay] = useState(30)
  const [lang, setLang] = useState<'FR' | 'EN' | 'ES'>('FR')
  const count = useMemo(() => participants.filter((p) => matchTarget(p, target)).length, [participants, target])
  const byLang = (l: string) => participants.filter((p) => matchTarget(p, target) && p.lang === l).length
  const send = () => { const id = sendMessage({ title, body, kind, target, requireConfirm: confirm, sms, smsDelayMin: delay }); nav(`/console/messages/${id}`) }
  return (
    <ConsoleLayout>
      <div className="page-head">
        <div><Link to="/console" style={{ fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>← Tableau de bord</Link><h1 style={{ marginTop: 6 }}>Nouveau message</h1></div>
        <button type="button" className={`btn ${kind === 'alerte' ? 'alert' : 'primary'}`} disabled={!count || !title} onClick={send}>Envoyer à {count} participants</button>
      </div>
      <div className="cols">
        <div className="stack" style={{ flex: '3 1 520px', gap: 16, minWidth: 0 }}>
          <section className="panel">
            <h2 style={{ fontSize: 16 }}>Type de message</h2>
            <div className="chips">
              {([['info', 'Information'], ['alerte', 'Alerte critique'], ['relance', 'Relance']] as [MessageKind, string][]).map(([k, l]) => <button key={k} type="button" className="chip green" aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}
            </div>
          </section>
          <section className="panel">
            <div className="row"><h2 className="grow" style={{ fontSize: 16 }}>Destinataires</h2><span className="pill" style={{ background: 'var(--forest-soft)', color: 'var(--forest-dark)' }}>{count} participants ciblés</span></div>
            <div className="row" style={{ flexWrap: 'wrap' }}><span className="small muted" style={{ width: 80 }}>Distance</span><div className="chips">{DIST.map((d) => <button key={d} type="button" className="chip green" aria-pressed={target.distance === d} onClick={() => setTarget({ ...target, distance: d })}>{d}</button>)}</div></div>
            <div className="row" style={{ flexWrap: 'wrap' }}><span className="small muted" style={{ width: 80 }}>Format</span><div className="chips">{FORMATS.map((d) => <button key={d} type="button" className="chip green" aria-pressed={target.format === d} onClick={() => setTarget({ ...target, format: d })}>{d}</button>)}</div></div>
            <div className="row" style={{ flexWrap: 'wrap' }}><span className="small muted" style={{ width: 80 }}>Statut</span><div className="chips">{STATUS.map((d) => <button key={d} type="button" className="chip green" aria-pressed={target.status === d} onClick={() => setTarget({ ...target, status: d })}>{d === 'Tous' ? 'Tous' : d}</button>)}</div></div>
          </section>
          <section className="panel">
            <div className="field"><label htmlFor="ti">Titre</label><input id="ti" className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="field"><label htmlFor="bo">Message</label><textarea id="bo" className="textarea" rows={5} value={body} onChange={(e) => setBody(e.target.value)} /></div>
            <label className="check"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> Demander une confirmation de lecture</label>
            <button type="button" className="btn" style={{ borderStyle: 'dashed', alignSelf: 'flex-start' }}>Joindre un document ou un GPX</button>
          </section>
          <section className="panel" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
            <div className="stack" style={{ flex: '1 1 220px' }}>
              <h2 style={{ fontSize: 16 }}>Envoi</h2>
              <label className="check"><input type="radio" name="w" defaultChecked /> Maintenant</label>
              <label className="check"><input type="radio" name="w" /> Programmé le…</label>
            </div>
            <div className="card warn" style={{ flex: '1 1 260px' }}>
              <h2 style={{ fontSize: 16 }}>Bascule SMS</h2>
              <label className="check"><input type="checkbox" checked={sms} onChange={(e) => setSms(e.target.checked)} style={{ accentColor: 'var(--alert)' }} /> Envoyer en SMS si non lu après</label>
              <label htmlFor="de" className="small muted">Délai (réglé par l'organisateur)</label>
              <select id="de" className="select" value={delay} onChange={(e) => setDelay(Number(e.target.value))} disabled={!sms}><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={60}>1 heure</option></select>
              <span className="small">Coût estimé : jusqu'à {count} SMS, facturés à l'organisateur</span>
            </div>
          </section>
        </div>
        <aside className="panel" style={{ flex: '2 1 340px' }}>
          <div className="row"><h2 className="grow" style={{ fontSize: 16 }}>Aperçu par langue</h2><span className="small muted">Traduction automatique</span></div>
          <div className="chips" role="tablist">{(['FR', 'EN', 'ES'] as const).map((l) => <button key={l} type="button" role="tab" className="chip" aria-pressed={lang === l} onClick={() => setLang(l)}>{l} · {byLang(l)}</button>)}</div>
          <div className="card">
            <span className={`tag ${kind}`}>{kind === 'alerte' ? 'ALERTE CRITIQUE' : kind === 'relance' ? 'RELANCE' : 'INFORMATION'}</span>
            <div className="card-title">{title || 'Titre du message'}</div>
            <div className="card-text">{lang === 'FR' ? body : `[Traduction automatique en ${lang === 'EN' ? 'anglais' : 'espagnol'} : branchée dans la V1]\n\n${body}`}</div>
          </div>
          <p className="small muted">Chaque participant reçoit le message dans la langue de son inscription. L'organisateur peut corriger la traduction avant l'envoi.</p>
        </aside>
      </div>
    </ConsoleLayout>
  )
}

export function MessageDetail() {
  const { id } = useParams()
  const { messages, participants, notify } = useStore()
  const [tab, setTab] = useState<'unread' | 'sms' | 'read'>('unread')
  const m = messages.find((x) => x.id === id)
  if (!m) return <ConsoleLayout><p>Message introuvable.</p></ConsoleLayout>
  const total = m.recipients.length
  const readApp = m.readInApp.length
  const afterSms = m.readAfterSms.length
  const unread = m.recipients.filter((r) => !m.readInApp.includes(r) && !m.readAfterSms.includes(r))
  const rows = (tab === 'unread' ? unread : tab === 'sms' ? m.readAfterSms : m.readInApp).slice(0, 30).map((pid) => participants.find((p) => p.id === pid)!).filter(Boolean)
  return (
    <ConsoleLayout>
      <div className="page-head">
        <div>
          <Link to="/console/messages" style={{ fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>← Messages</Link>
          <div className="row" style={{ marginTop: 8 }}><span className={`tag ${m.kind}`}>{m.kind === 'alerte' ? 'ALERTE CRITIQUE' : m.kind.toUpperCase()}</span><span className="small muted">Envoyé {m.sentAt.startsWith('Il y a') ? m.sentAt.toLowerCase() : `à ${m.sentAt}`} · {m.targetLabel}</span></div>
          <h1 style={{ marginTop: 6 }}>{m.title}</h1>
        </div>
        <button type="button" className="btn alert" disabled={!unread.length} onClick={() => notify(`Relance envoyée à ${unread.length} participants (push + SMS).`)}>Relancer les {unread.length} non-lus</button>
      </div>
      <div className="kpis">
        <div className="kpi"><div className="k-label">Destinataires</div><div className="k-value">{total}</div></div>
        <div className="kpi"><div className="k-label">{m.requireConfirm ? 'Lu et confirmé' : 'Lu'}</div><div className="k-value">{readApp + afterSms} <small>{pct(readApp + afterSms, total)} %</small></div></div>
        <div className="kpi"><div className="k-label">SMS de bascule envoyés{m.sms ? ` (à ${m.smsDelayMin} min)` : ''}</div><div className="k-value">{m.sms ? m.smsSent.length : '—'}</div>{m.sms && <div className="k-sub">{m.smsSent.length ? `dont ${afterSms} ont lu ensuite` : 'en attente du délai…'}</div>}</div>
        <div className="kpi" style={{ background: 'var(--alert-soft)', borderColor: '#F0C9B3' }}><div className="k-label ko" style={{ fontWeight: 600 }}>Toujours non lu</div><div className="k-value ko">{unread.length}</div></div>
      </div>
      <section className="panel">
        <div className="split-bar" role="img" aria-label={`${readApp} lus sans relance, ${afterSms} lus après le SMS, ${unread.length} non lus`}>
          <div style={{ width: `${pct(readApp, total)}%`, background: 'var(--forest)' }} />
          <div style={{ width: `${pct(afterSms, total)}%`, background: '#5FA593' }} />
          <div style={{ width: `${pct(unread.length, total)}%`, background: 'var(--alert)' }} />
        </div>
        <div className="chips" role="tablist">
          <button type="button" role="tab" className="chip" aria-pressed={tab === 'unread'} onClick={() => setTab('unread')}>Toujours non lus ({unread.length})</button>
          <button type="button" role="tab" className="chip" aria-pressed={tab === 'sms'} onClick={() => setTab('sms')}>Lus après le SMS ({afterSms})</button>
          <button type="button" role="tab" className="chip" aria-pressed={tab === 'read'} onClick={() => setTab('read')}>Lus sans relance ({readApp})</button>
        </div>
        <div className="table-wrap">
          <table className="t" style={{ minWidth: 640 }}>
            <thead><tr><th>Dossard</th><th>Participant</th><th>Distance</th><th>Langue</th><th>Code activé</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 700 }}>{p.bib}</td><td>{p.name}</td><td className="muted">{p.distance}</td><td className="muted">{p.lang}</td>
                  <td className={p.activated ? 'ok' : 'ko'}>{p.activated ? 'Oui' : 'Non'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><button type="button" className="btn">Appeler</button> <button type="button" className="btn primary" onClick={() => notify(`Message privé ouvert avec le dossard ${p.bib}.`)}>Message privé</button></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={6} className="muted">Personne dans cette liste.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </ConsoleLayout>
  )
}

export function Participants() {
  const { participants, relaunch } = useStore()
  const [q, setQ] = useState('')
  const [only, setOnly] = useState<'all' | 'inactive' | 'nobrief'>('all')
  const list = participants.filter((p) => (only === 'all' || (only === 'inactive' ? !p.activated : !p.briefingConfirmed)) && (`${p.bib} ${p.name}`.toLowerCase().includes(q.toLowerCase())))
  return (
    <ConsoleLayout>
      <div className="page-head">
        <div><h1>Participants</h1><p>{participants.length} inscrits importés · un code personnel envoyé à chacun</p></div>
        <div className="row"><button type="button" className="btn">Importer un fichier CSV / Excel</button><button type="button" className="btn alert" onClick={() => relaunch('participants')}>Relancer les codes non activés</button></div>
      </div>
      <section className="panel">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <label htmlFor="sq" className="sr-only">Rechercher</label>
          <input id="sq" className="input" style={{ flex: '1 1 260px' }} placeholder="Rechercher un nom ou un dossard" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="chips">
            <button type="button" className="chip" aria-pressed={only === 'all'} onClick={() => setOnly('all')}>Tous</button>
            <button type="button" className="chip" aria-pressed={only === 'inactive'} onClick={() => setOnly('inactive')}>Code non activé</button>
            <button type="button" className="chip" aria-pressed={only === 'nobrief'} onClick={() => setOnly('nobrief')}>Briefing non confirmé</button>
          </div>
        </div>
        <div className="table-wrap">
          <table className="t" style={{ minWidth: 720 }}>
            <thead><tr><th>Dossard</th><th>Nom</th><th>Distance</th><th>Format</th><th>Langue</th><th>Code</th><th>Activé</th><th>Briefing</th></tr></thead>
            <tbody>
              {list.slice(0, 60).map((p) => (
                <tr key={p.id}><td style={{ fontWeight: 700 }}>{p.bib}</td><td>{p.name}</td><td className="muted">{p.distance}</td><td className="muted">{p.format}</td><td className="muted">{p.lang}</td><td style={{ fontFamily: 'monospace' }}>{p.code}</td><td className={p.activated ? 'ok' : 'ko'}>{p.activated ? 'Oui' : 'Non'}</td><td className={p.briefingConfirmed ? 'ok' : 'ko'}>{p.briefingConfirmed ? 'Confirmé' : 'En attente'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.length > 60 && <p className="small muted">60 premiers affichés sur {list.length}.</p>}
      </section>
    </ConsoleLayout>
  )
}

export function Benevoles() {
  const { volunteers, reports, relaunch, sendPostMessage } = useStore()
  const [postId, setPostId] = useState('cp2')
  const [txt, setTxt] = useState('')
  const [freq, setFreq] = useState('Tous les 3 jours')
  const active = volunteers.filter((v) => v.activated).length
  const confirmed = volunteers.filter((v) => v.confirmed).length
  const here = volunteers.filter((v) => v.checkedIn).length
  return (
    <ConsoleLayout>
      <div className="page-head">
        <div><h1>Bénévoles et postes</h1><p>Beyond Borders 2027 · données d'exemple</p></div>
        <div className="row"><button type="button" className="btn">Importer les bénévoles (CSV)</button><button type="button" className="btn">Créer un poste</button></div>
      </div>
      <div className="kpis">
        <div className="kpi"><div className="k-label">Bénévoles affectés</div><div className="k-value">{volunteers.length}</div><div className="k-sub">sur {posts.length} postes</div></div>
        <div className="kpi"><div className="k-label">Code activé</div><div className="k-value">{active} <small>/ {volunteers.length}</small></div><div className="k-sub alert">{volunteers.length - active} relancés automatiquement</div></div>
        <div className="kpi"><div className="k-label">Présence confirmée</div><div className="k-value">{confirmed} <small>/ {volunteers.length}</small></div><div className="k-sub">{volunteers.length - confirmed} sans réponse</div></div>
        <div className="kpi"><div className="k-label">Pointés sur leur poste</div><div className="k-value">{here} <small>/ {volunteers.length}</small></div><div className="k-sub">jour J, en direct</div></div>
      </div>
      <div className="cols">
        <section className="panel" style={{ flex: '2 1 560px' }}>
          <h2>Postes</h2>
          <div className="table-wrap">
            <table className="t" style={{ minWidth: 620 }}>
              <thead><tr><th>Poste</th><th>Horaires</th><th>Responsable</th><th>Confirmés</th><th>Sur place</th></tr></thead>
              <tbody>
                {posts.map((p) => {
                  const team = volunteers.filter((v) => v.postId === p.id)
                  const c = team.filter((v) => v.confirmed).length
                  const h = team.filter((v) => v.checkedIn).length
                  return <tr key={p.id}><td style={{ fontWeight: 600 }}>{p.name}</td><td className="muted">{p.hours}</td><td className="muted">{p.lead}</td><td className={c === team.length ? 'ok' : 'ko'} style={{ fontWeight: 600 }}>{c} / {team.length}</td><td className="muted">{h ? `${h} / ${team.length}` : '—'}</td></tr>
                })}
              </tbody>
            </table>
          </div>
        </section>
        <div className="stack" style={{ flex: '1 1 320px', gap: 16 }}>
          <section className="panel">
            <h2>Message à un poste</h2>
            <label htmlFor="po" className="sr-only">Poste</label>
            <select id="po" className="select" value={postId} onChange={(e) => setPostId(e.target.value)}><option value="tous">Tous les bénévoles</option>{posts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <label htmlFor="pt" className="sr-only">Message</label>
            <textarea id="pt" className="textarea" rows={3} placeholder="Ex. : premiers coureurs attendus vers 16 h" value={txt} onChange={(e) => setTxt(e.target.value)} />
            <button type="button" className="btn primary" disabled={!txt.trim()} onClick={() => { sendPostMessage(postId, txt); setTxt('') }}>Envoyer</button>
          </section>
          <section className="panel">
            <h2>Remontées des postes</h2>
            {reports.filter((r) => r.role === 'benevole').slice(0, 4).map((r) => <div key={r.id} className={`card ${r.handled ? '' : 'warn'}`}><div className="card-meta" style={{ fontWeight: 700, color: 'var(--ink)' }}><span>{r.from}</span><span>{r.at}</span></div><div className="small">{r.text}</div></div>)}
            <Link to="/console/inbox" className="small" style={{ fontWeight: 600 }}>Tout voir dans la boîte de réception</Link>
          </section>
          <section className="panel">
            <h2>Relance des codes non activés</h2>
            <label className="check"><input type="checkbox" defaultChecked /> Relancer par e-mail</label>
            <div className="row">
              <div className="field grow"><label htmlFor="fq" className="small muted" style={{ fontWeight: 400 }}>Fréquence</label><select id="fq" className="select" value={freq} onChange={(e) => setFreq(e.target.value)}><option>Tous les jours</option><option>Tous les 3 jours</option><option>Chaque semaine</option></select></div>
              <div className="field grow"><label htmlFor="ju" className="small muted" style={{ fontWeight: 400 }}>Jusqu'à</label><select id="ju" className="select" defaultValue="J-2"><option>J-7</option><option>J-2</option><option>Le jour J</option></select></div>
            </div>
            <p className="small muted">S'applique aussi aux participants.</p>
            <button type="button" className="btn" onClick={() => relaunch('benevoles')}>Relancer maintenant</button>
          </section>
        </div>
      </div>
    </ConsoleLayout>
  )
}

export function Carte() {
  const { volunteers } = useStore()
  const [layers, setLayers] = useState({ t1300: true, t850: true, posts: true, vols: true, runners: false })
  const toggle = (k: keyof typeof layers) => setLayers({ ...layers, [k]: !layers[k] })
  const here = volunteers.filter((v) => v.checkedIn).length
  const short = posts.map((p) => ({ p, n: volunteers.filter((v) => v.postId === p.id && v.checkedIn).length })).filter(({ p, n }) => ['km34', 'cp1', 'cp2', 'arrivee'].includes(p.id) && n < p.capacity)
  return (
    <ConsoleLayout>
      <div className="page-head">
        <div><h1>Carte de l'événement</h1><p>Beyond Borders 2027 · en direct · données d'exemple</p></div>
        <div className="row"><button type="button" className="btn">Importer une trace GPX</button><button type="button" className="btn">Placer un poste</button></div>
      </div>
      <div className="cols">
        <div className="map-wrap" style={{ flex: '3 1 620px' }}>
          <EventMap volunteers={volunteers} showPosts={layers.posts} showVolunteers={layers.vols} showRunners={layers.runners} show850={layers.t850} />
        </div>
        <aside className="stack" style={{ flex: '1 1 300px', gap: 16 }}>
          <section className="panel" style={{ gap: 4 }}>
            <h2 style={{ fontSize: 17, marginBottom: 6 }}>Calques</h2>
            <label className="check"><input type="checkbox" checked={layers.t1300} onChange={() => toggle('t1300')} /> Tracé 1300 km</label>
            <label className="check"><input type="checkbox" checked={layers.t850} onChange={() => toggle('t850')} /> Tracé 850 km</label>
            <label className="check"><input type="checkbox" checked={layers.posts} onChange={() => toggle('posts')} /> Postes</label>
            <label className="check"><input type="checkbox" checked={layers.vols} onChange={() => toggle('vols')} /> Bénévoles en direct ({here})</label>
            <label className="check"><input type="checkbox" checked={layers.runners} onChange={() => toggle('runners')} /> Participants (tracking de l'app ou API)</label>
            <p className="small muted">Plusieurs traces possibles selon le sport : natation, vélo, course à pied, ou plusieurs distances.</p>
          </section>
          <section className="panel">
            <h2 style={{ fontSize: 17 }}>À surveiller</h2>
            {short.map(({ p, n }) => <div key={p.id} className="card warn small"><span><strong>{p.name} :</strong> {n} bénévoles sur {p.capacity} pointés.</span></div>)}
            {!short.length && <p className="small ok">Tous les postes sont au complet.</p>}
          </section>
          <p className="small muted">La position des bénévoles n'est partagée que pendant leur créneau, avec leur accord.</p>
        </aside>
      </div>
    </ConsoleLayout>
  )
}

export function FicheEditeur() {
  const { notify } = useStore()
  const [name, setName] = useState('Raid Bikepacking Jura')
  const [desc, setDesc] = useState('[Esprit de la course, terrain, niveau attendu…]')
  const [pub, setPub] = useState(true)
  return (
    <ConsoleLayout>
      <div className="page-head">
        <div><h1>Fiche publique de l'événement</h1><p>Ce que voient les visiteurs dans « À découvrir » sur l'app</p></div>
        <div className="row"><button type="button" className="btn">Enregistrer le brouillon</button><button type="button" className="btn primary" onClick={() => notify('Fiche envoyée à la validation de la plateforme.')}>Publier la fiche</button></div>
      </div>
      <div className="cols">
        <div className="stack" style={{ flex: '3 1 520px', gap: 16, minWidth: 0 }}>
          <section className="panel">
            <h2 style={{ fontSize: 16 }}>Visibilité</h2>
            <div className="chips"><button type="button" className="chip green" aria-pressed={pub} onClick={() => setPub(true)}>Publique : visible dans « À découvrir »</button><button type="button" className="chip green" aria-pressed={!pub} onClick={() => setPub(false)}>Privée : accès par code seulement</button></div>
          </section>
          <section className="panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div className="field" style={{ gridColumn: '1 / -1' }}><label htmlFor="fn">Nom de l'événement</label><input id="fn" className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="field"><label htmlFor="fp">Pratique</label><select id="fp" className="select"><option>Bikepacking</option><option>Gravel</option><option>Route</option><option>Trail</option><option>Triathlon</option></select></div>
            <div className="field"><label htmlFor="fl">Lieu de départ</label><input id="fl" className="input" defaultValue="Jura" /></div>
            <div className="field"><label htmlFor="fd">Date de départ</label><input id="fd" className="input" defaultValue="28/08/2027" /></div>
            <div className="field"><label htmlFor="fk">Distances</label><input id="fk" className="input" defaultValue="600 km" /></div>
            <div className="field" style={{ gridColumn: '1 / -1' }}><label htmlFor="fe">Présentation</label><textarea id="fe" className="textarea" rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} /><span className="small muted">Traduite automatiquement en anglais et en espagnol</span></div>
            <div className="field"><label htmlFor="fu">Lien d'inscription</label><input id="fu" className="input" defaultValue="https://[site-organisateur]/inscription" /></div>
            <div className="field"><label htmlFor="fs">Inscriptions</label><select id="fs" className="select"><option>Ouvertes</option><option>Bientôt ouvertes</option><option>Complet</option><option>Fermées</option></select></div>
          </section>
        </div>
        <aside className="stack" style={{ flex: '2 1 320px', alignItems: 'center' }}>
          <span className="small muted" style={{ fontWeight: 700, alignSelf: 'flex-start' }}>Aperçu sur l'app</span>
          <div className="preview-phone">
            <div style={{ height: 110, background: '#3E6E8E' }} />
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="tag info">Bikepacking</span>
              <div className="display" style={{ fontSize: 20, fontWeight: 700 }}>{name}</div>
              <div className="small muted">28 août 2027 · Jura · 600 km</div>
              <div className="small" style={{ color: 'var(--ink-2)' }}>{desc}</div>
              <div className="btn primary" style={{ marginTop: 8 }}>S'inscrire sur le site de l'organisateur</div>
            </div>
          </div>
          <p className="small muted" style={{ textAlign: 'center', maxWidth: 300 }}>{pub ? 'Publication soumise à validation par l\'administrateur de la plateforme.' : 'Fiche non visible publiquement : seuls les détenteurs d\'un code y ont accès.'}</p>
        </aside>
      </div>
    </ConsoleLayout>
  )
}

export function Inbox() {
  const { reports, handleReport } = useStore()
  return (
    <ConsoleLayout>
      <div className="page-head"><div><h1>Boîte de réception</h1><p>Abandons, incidents et remontées des postes, en temps réel</p></div></div>
      <section className="panel">
        {reports.map((r) => (
          <div key={r.id} className={`card ${r.handled ? '' : 'warn'}`} style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px' }}>
              <div className="card-meta" style={{ justifyContent: 'flex-start' }}><span className={`tag ${r.type === 'Abandon' ? 'alert' : 'relance'}`}>{r.type}</span><span>{r.role === 'benevole' ? 'Bénévole' : 'Participant'} · {r.at}</span></div>
              <div className="card-title" style={{ marginTop: 6 }}>{r.from}</div>
              <div className="small">{r.text} · <span className="muted">{r.where}</span></div>
            </div>
            {r.handled ? <span className="small ok" style={{ fontWeight: 700 }}>✓ Traité</span> : <button type="button" className="btn primary" onClick={() => handleReport(r.id)}>Marquer comme traité</button>}
          </div>
        ))}
      </section>
    </ConsoleLayout>
  )
}

export function Admin() {
  const { notify } = useStore()
  const [pending, setPending] = useState(['Raid Bikepacking Jura', 'Gravel des Crêtes'])
  return (
    <div className="console">
      <nav className="side admin" aria-label="Administration">
        <div className="brand">[Nom du produit]<div className="small" style={{ color: '#D4CCE6', fontFamily: 'Inter', fontWeight: 400 }}>Administration plateforme</div></div>
        <a className="active" href="#" onClick={(e) => e.preventDefault()}>Vue d'ensemble</a><a href="#" onClick={(e) => e.preventDefault()}>Organisations</a><a href="#" onClick={(e) => e.preventDefault()}>Fiches à valider</a><a href="#" onClick={(e) => e.preventDefault()}>Abonnements et factures</a><a href="#" onClick={(e) => e.preventDefault()}>SMS et e-mails</a><a href="#" onClick={(e) => e.preventDefault()}>Support</a>
      </nav>
      <main className="main">
        <div className="page-head"><div><h1>Vue d'ensemble</h1><p>Toutes les organisations · données d'exemple</p></div></div>
        <div className="kpis">
          {[['Organisations', '18', '3 en essai gratuit'], ['Événements actifs', '27', '9 dans les 30 jours'], ['Participants', '4 380', '92 % ont activé leur code'], ['SMS envoyés ce mois', '1 240', 'refacturés aux organisateurs']].map(([a, b, c]) => <div key={a} className="kpi"><div className="k-label">{a}</div><div className="k-value">{b}</div><div className="k-sub">{c}</div></div>)}
        </div>
        <div className="cols">
          <section className="panel" style={{ flex: '1 1 340px' }}>
            <h2>Fiches à valider ({pending.length})</h2>
            {pending.map((p) => <div key={p} className="card"><div className="card-title">{p}</div><div className="row"><button type="button" className="btn primary" onClick={() => { setPending(pending.filter((x) => x !== p)); notify(`« ${p} » est publiée dans À découvrir.`) }}>Valider</button><button type="button" className="btn">Voir</button><button type="button" className="btn" style={{ color: 'var(--alert)' }} onClick={() => setPending(pending.filter((x) => x !== p))}>Refuser</button></div></div>)}
            {!pending.length && <p className="small ok">Tout est validé.</p>}
          </section>
          <section className="panel" style={{ flex: '2 1 520px' }}>
            <h2>Organisations</h2>
            <div className="table-wrap"><table className="t" style={{ minWidth: 540 }}><thead><tr><th>Organisation</th><th>Offre</th><th>Événements</th><th>SMS du mois</th><th>Paiement</th></tr></thead><tbody>
              {[['Beyond The Track', 'Saison', '3', '86', 'À jour'], ['[Organisateur A]', 'Saison', '25', '612', 'À jour'], ['[Organisateur B]', 'Événement M', '1', '0', 'En retard'], ['[Organisateur C]', 'Découverte', '1', '—', 'Gratuit']].map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={i === 4 ? (c === 'En retard' ? 'ko' : 'ok') : i ? 'muted' : ''} style={i === 0 || i === 4 ? { fontWeight: 600 } : undefined}>{c}</td>)}</tr>)}
            </tbody></table></div>
          </section>
        </div>
      </main>
    </div>
  )
}
