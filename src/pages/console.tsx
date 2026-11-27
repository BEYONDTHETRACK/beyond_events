import { createContext, useContext, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { appUrl, supabase } from '../lib/supabase'
import { ago, dateFr, download, mapColumns, normLang, parseCsv, pct, toCsv, usePoll } from '../lib/util'
import { PRACTICES } from '../lib/types'
import type { DotationPack, EventRow, Message, Participant, Post, PrivateMessage, Report, Volunteer } from '../lib/types'
import { ErrorNote, kindLabel, Loading, Progress, useToast } from '../components/ui'
import { useAuth } from './auth'
import { PlaceInput } from '../components/PlaceInput'
import { Brand } from '../components/Logo'

// ====================== Accueil console : organisation et événements ======================

export function ConsoleHome() {
  const { session } = useAuth()
  const nav = useNavigate()
  const notify = useToast()
  const [orgName, setOrgName] = useState('')
  const [busy, setBusy] = useState(false)
  const { data, error, loading, reload } = usePoll(async () => {
    await supabase.rpc('claim_invites') // rattache les invitations faites par l'admin
    const [orgs, events, admin] = await Promise.all([
      supabase.from('org_members').select('org_id, organizations(id,name)').eq('user_id', session!.user.id),
      supabase.from('events').select('*').order('created_at', { ascending: false }),
      supabase.from('platform_admins').select('user_id').eq('user_id', session!.user.id).maybeSingle(),
    ])
    if (orgs.error) throw orgs.error
    if (events.error) throw events.error
    let list = (orgs.data ?? []).map((o) => o.organizations as unknown as { id: string; name: string }).filter(Boolean)
    // L'admin de la plateforme voit toutes les organisations et tous les événements dans la console.
    if (admin.data) {
      const all = await supabase.from('organizations').select('id,name').order('name')
      if (all.error) throw all.error
      list = all.data
    }
    const mine = new Set(list.map((o) => o.id))
    return { orgs: list, events: (events.data as EventRow[]).filter((e) => mine.has(e.org_id)), admin: !!admin.data }
  }, 30000)

  const createOrg = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.rpc('create_organization', { p_name: orgName })
    setBusy(false)
    if (error) { notify(`Erreur : ${error.message}`); return }
    setOrgName('')
    reload()
  }
  const demo = async (org: string) => {
    setBusy(true)
    const { data: id, error } = await supabase.rpc('create_demo_event', { p_org: org })
    setBusy(false)
    if (error) { notify(`Erreur : ${error.message}`); return }
    nav(`/console/e/${id}`)
  }

  return (
    <div className="console-home">
      <header className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div><Link to="/" aria-label="Beyond Events, accueil" style={{ textDecoration: 'none' }}><Brand on="light" size={22} /></Link><h1 style={{ fontSize: 30, marginTop: 6 }}>Console organisateur</h1></div>
        <div className="row">
          {data?.admin && <Link className="btn" to="/admin">Admin plateforme</Link>}
          <span className="small muted">{session?.user.email}</span>
          <button type="button" className="btn" onClick={() => supabase.auth.signOut()}>Se déconnecter</button>
        </div>
      </header>
      {loading && !data && <Loading />}
      <ErrorNote error={error} />
      {data && data.orgs.length === 0 && (
        <form className="panel" style={{ maxWidth: 520 }} onSubmit={createOrg}>
          <h2>Crée ton organisation</h2>
          <p className="small muted">Le nom de ton association ou de ta structure. Tu pourras ensuite créer tes événements.</p>
          <label htmlFor="on" className="sr-only">Nom de l'organisation</label>
          <input id="on" className="input" required placeholder="Ex. : Beyond The Track" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
          <button type="submit" className="btn primary" disabled={busy || !orgName.trim()}>Créer l'organisation</button>
        </form>
      )}
      {data?.orgs.map((o) => (
        <section key={o.id} className="panel">
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <h2 className="grow">{o.name}</h2>
            <button type="button" className="btn" disabled={busy} onClick={() => demo(o.id)}>Créer un événement de démo</button>
          </div>
          <NewEvent orgId={o.id} onCreated={(id) => nav(`/console/e/${id}`)} />
          <div className="table-wrap">
            <table className="t" style={{ minWidth: 520 }}>
              <thead><tr><th>Événement</th><th>Date</th><th>Pratique</th><th>Visibilité</th></tr></thead>
              <tbody>
                {data.events.filter((e) => e.org_id === o.id).map((e) => (
                  <tr key={e.id} className="clickable" onClick={() => nav(`/console/e/${e.id}`)}>
                    <td><Link to={`/console/e/${e.id}`} style={{ fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>{e.name}</Link></td>
                    <td className="muted">{dateFr(e.starts_on)}</td>
                    <td className="muted">{e.practice}</td>
                    <td className="muted">{e.is_public ? (e.published ? 'Publique' : 'En attente de validation') : 'Privée'}</td>
                  </tr>
                ))}
                {!data.events.some((e) => e.org_id === o.id) && <tr><td colSpan={4} className="muted">Aucun événement. Crée le premier, ou un événement de démo pour tester.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}

export function NewEvent({ orgId, onCreated }: { orgId: string; onCreated: (id: string) => void }) {
  const notify = useToast()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: '', practice: 'Bikepacking', starts_on: '', place: '', distances: '' })
  if (!open) return <button type="button" className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>Nouvel événement</button>
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const { data, error } = await supabase.from('events').insert({
      org_id: orgId, name: f.name, practice: f.practice, starts_on: f.starts_on || null, place: f.place,
      distances: f.distances.split(/[,;/]/).map((x) => x.trim()).filter(Boolean),
    }).select('id').single()
    if (error) { notify(`Erreur : ${error.message}`); return }
    onCreated(data.id)
  }
  return (
    <form className="card" onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
      <div className="field" style={{ gridColumn: '1 / -1' }}><label htmlFor="ne">Nom de l'événement</label><input id="ne" className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div className="field"><label htmlFor="np">Pratique</label><select id="np" className="select" value={f.practice} onChange={(e) => setF({ ...f, practice: e.target.value })}>{PRACTICES.map((p) => <option key={p}>{p}</option>)}</select></div>
      <div className="field"><label htmlFor="nd">Date de départ</label><input id="nd" type="date" className="input" value={f.starts_on} onChange={(e) => setF({ ...f, starts_on: e.target.value })} /></div>
      <div className="field"><label htmlFor="nl">Lieu</label><PlaceInput id="nl" value={f.place} onChange={(v) => setF({ ...f, place: v })} /></div>
      <div className="field"><label htmlFor="nk">Distances (séparées par des virgules)</label><input id="nk" className="input" placeholder="300 km, 600 km" value={f.distances} onChange={(e) => setF({ ...f, distances: e.target.value })} /></div>
      <div className="row" style={{ gridColumn: '1 / -1' }}><button type="submit" className="btn primary">Créer</button><button type="button" className="btn" onClick={() => setOpen(false)}>Annuler</button></div>
    </form>
  )
}

// ====================== Espace d'un événement ======================

interface EvCtx { ev: EventRow; reloadEvent: () => Promise<void> }
const EventCtx = createContext<EvCtx | null>(null)
export const useEv = () => useContext(EventCtx)!

export function EventShell() {
  const { id } = useParams()
  const { data, error, loading, reload } = usePoll(async () => {
    const [ev, open, unread] = await Promise.all([
      supabase.from('events').select('*').eq('id', id!).maybeSingle(),
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('event_id', id!).is('handled_at', null),
      supabase.from('private_messages').select('id', { count: 'exact', head: true }).eq('event_id', id!).eq('from_org', false).is('read_at', null),
    ])
    if (ev.error) throw ev.error
    return { ev: ev.data as EventRow | null, inbox: (open.count ?? 0) + (unread.count ?? 0) }
  }, 8000, [id])
  if (loading && !data) return <Loading />
  if (!data?.ev) return <div style={{ padding: 24 }}><ErrorNote error={error} /><p>Événement introuvable ou accès refusé.</p><Link to="/console">Retour à la console</Link></div>
  const base = `/console/e/${id}`
  const links: [string, string, number?][] = [
    [base, 'Tableau de bord'], [`${base}/messages`, 'Messages'], [`${base}/participants`, 'Participants'],
    [`${base}/parcours`, 'Parcours et CP'], [`${base}/benevoles`, 'Bénévoles et postes'], [`${base}/dotations`, 'Dotations'], [`${base}/contacts`, 'Contacts'], [`${base}/inbox`, 'Boîte de réception', data.inbox], [`${base}/fiche`, 'Fiche et réglages'],
  ]
  return (
    <EventCtx.Provider value={{ ev: data.ev, reloadEvent: reload }}>
      <div className="console">
        <nav className="side" aria-label="Navigation de la console">
          <Link to="/console" className="brand" aria-label="Beyond Events, mes événements" style={{ textDecoration: 'none' }}><Brand size={18} /></Link>
          <div className="event"><small>Événement</small><strong>{data.ev.name}</strong></div>
          {links.map(([to, label, n]) => (
            <NavLink key={to} to={to} end={to === base} className={({ isActive }) => (isActive ? 'active' : '')}>
              {label}{n ? <span className="count">{n}</span> : null}
            </NavLink>
          ))}
          <Link to="/console" style={{ marginTop: 'auto' }}>← Tous mes événements</Link>
        </nav>
        <main className="main"><Outlet /></main>
      </div>
    </EventCtx.Provider>
  )
}

function Head({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return <div className="page-head"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{children && <div className="row" style={{ flexWrap: 'wrap' }}>{children}</div>}</div>
}

interface Stat { message_id: string; recipients: number; read: number; confirmed: number }

function useMessages(eventId: string) {
  return usePoll(async () => {
    const [m, s] = await Promise.all([
      supabase.from('messages').select('*').eq('event_id', eventId).order('created_at', { ascending: false }),
      supabase.rpc('event_message_stats', { p_event: eventId }),
    ])
    if (m.error) throw m.error
    if (s.error) throw s.error
    const stats = new Map((s.data as Stat[]).map((x) => [x.message_id, x]))
    return (m.data as Message[]).map((x) => ({ ...x, stat: stats.get(x.id) ?? { message_id: x.id, recipients: 0, read: 0, confirmed: 0 } }))
  }, 5000, [eventId])
}

function exportCodes(evName: string, rows: { bib?: number | null; name: string; email: string | null; phone: string | null; distance?: string; post?: string; code: string }[], kind: 'participants' | 'benevoles') {
  const link = `${appUrl()}#/rejoindre`
  const header = kind === 'participants' ? ['Dossard', 'Nom', 'E-mail', 'Téléphone', 'Distance', 'Code', 'Lien'] : ['Nom', 'E-mail', 'Téléphone', 'Poste', 'Code', 'Lien']
  const body = rows.map((r) => (kind === 'participants' ? [r.bib, r.name, r.email, r.phone, r.distance, r.code, link] : [r.name, r.email, r.phone, r.post, r.code, link]))
  download(`${evName.replace(/[^\w-]+/g, '_')}_codes_${kind}.csv`, toCsv([header, ...body]))
}

// ---------- Tableau de bord ----------
export function Dashboard() {
  const { ev } = useEv()
  const msgs = useMessages(ev.id)
  const { data } = usePoll(async () => {
    const [p, v, r] = await Promise.all([
      supabase.from('participants').select('id,activated_at,status,distance').eq('event_id', ev.id).range(0, 9999),
      supabase.from('volunteers').select('id,confirmed_at,checked_in_at,checked_out_at,activated_at').eq('event_id', ev.id).range(0, 9999),
      supabase.from('reports').select('*').eq('event_id', ev.id).is('handled_at', null).order('created_at', { ascending: false }).limit(5),
    ])
    return { p: (p.data ?? []) as Pick<Participant, 'id' | 'activated_at' | 'status' | 'distance'>[], v: (v.data ?? []) as Volunteer[], r: (r.data ?? []) as Report[] }
  }, 6000, [ev.id])
  const n = data?.p.length ?? 0
  const act = data?.p.filter((x) => x.activated_at).length ?? 0
  const lastConfirm = msgs.data?.find((m) => m.require_confirm)
  const vols = data?.v ?? []
  const base = `/console/e/${ev.id}`
  return (
    <>
      <Head title="Tableau de bord" sub={`${ev.name} · ${dateFr(ev.starts_on)}`}>
        <Link className="btn" to={`${base}/participants`}>Importer des participants</Link>
        <Link className="btn primary" to={`${base}/messages/nouveau`}>Nouveau message</Link>
      </Head>
      <div className="kpis">
        <div className="kpi"><div className="k-label">Participants</div><div className="k-value">{n}</div><div className="k-sub">{[...new Set(data?.p.map((x) => x.distance).filter(Boolean))].map((d) => `${d} : ${data!.p.filter((x) => x.distance === d).length}`).join(' · ') || '—'}</div></div>
        <div className="kpi"><div className="k-label">Code activé</div><div className="k-value">{act} <small>/ {n}</small></div><Progress value={n ? act / n : 0} /><div className={`k-sub ${n - act ? 'alert' : ''}`}>{n - act} pas encore activé</div></div>
        <div className="kpi"><div className="k-label">{lastConfirm ? `Confirmé : ${lastConfirm.title}` : 'Confirmations'}</div>{lastConfirm ? <><div className="k-value">{lastConfirm.stat.confirmed} <small>/ {lastConfirm.stat.recipients}</small></div><Progress value={lastConfirm.stat.recipients ? lastConfirm.stat.confirmed / lastConfirm.stat.recipients : 0} /></> : <div className="k-sub">Aucun message avec confirmation pour l'instant</div>}</div>
        <div className="kpi"><div className="k-label">Bénévoles</div><div className="k-value">{vols.filter((v) => v.confirmed_at).length} <small>/ {vols.length}</small></div><div className="k-sub">présences confirmées · {vols.filter((v) => v.checked_in_at && !v.checked_out_at).length} sur place</div></div>
      </div>
      <div className="cols">
        <section className="panel" style={{ flex: '2 1 480px' }}>
          <div className="row"><h2 className="grow">Messages récents</h2><Link to={`${base}/messages`} style={{ fontWeight: 600, fontSize: 14 }}>Tout voir</Link></div>
          <MessagesTable rows={(msgs.data ?? []).slice(0, 5)} base={base} />
        </section>
        <section className="panel" style={{ flex: '1 1 300px' }}>
          <h2>À traiter</h2>
          {n - act > 0 && <div className="card warn"><div><strong>{n - act} participants</strong> n'ont pas encore activé leur code.</div><Link className="btn" to={`${base}/participants?filtre=inactifs`}>Voir et exporter leurs codes</Link></div>}
          {(data?.r ?? []).map((r) => (
            <div key={r.id} className="card warn"><div className="card-meta" style={{ color: 'var(--ink)', fontWeight: 700 }}><span>{r.type}</span><span>{ago(r.created_at)}</span></div><div className="small">{r.source_label}{r.body && r.body !== r.type ? ` : ${r.body}` : ''}</div></div>
          ))}
          {data && !data.r.length && n - act === 0 && <p className="small ok">Rien à traiter pour l'instant.</p>}
          <Link className="small" style={{ fontWeight: 600 }} to={`${base}/inbox`}>Ouvrir la boîte de réception</Link>
        </section>
      </div>
    </>
  )
}

type MsgWithStat = Message & { stat: Stat }

function MessagesTable({ rows, base }: { rows: MsgWithStat[]; base: string }) {
  const nav = useNavigate()
  if (!rows.length) return <p className="small muted">Aucun message envoyé pour l'instant.</p>
  return (
    <div className="table-wrap">
      <table className="t" style={{ minWidth: 560 }}>
        <thead><tr><th>Message</th><th>Cible</th><th>Envoi</th><th>Lu</th><th>Confirmé</th></tr></thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className="clickable" onClick={() => nav(`${base}/messages/${m.id}`)}>
              <td><Link to={`${base}/messages/${m.id}`} style={{ color: 'var(--ink)', fontWeight: 600, textDecoration: 'none' }}>{m.title}</Link><div className="small muted">{kindLabel(m.kind)}{m.require_confirm ? ' · confirmation demandée' : ''}</div></td>
              <td className="muted">{m.target_label || 'Tous'} ({m.stat.recipients})</td>
              <td className="muted">{ago(m.created_at)}</td>
              <td style={{ fontWeight: 700 }}>{pct(m.stat.read, m.stat.recipients)} %</td>
              <td style={{ fontWeight: 700 }}>{m.require_confirm ? `${pct(m.stat.confirmed, m.stat.recipients)} %` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------- Messages ----------
export function MessagesList() {
  const { ev } = useEv()
  const msgs = useMessages(ev.id)
  const base = `/console/e/${ev.id}`
  return (
    <>
      <Head title="Messages" sub="Clique sur un message pour voir qui l'a lu."><Link className="btn primary" to={`${base}/messages/nouveau`}>Nouveau message</Link></Head>
      <section className="panel">{msgs.loading && !msgs.data ? <Loading /> : <MessagesTable rows={msgs.data ?? []} base={base} />}</section>
    </>
  )
}

export function Compose() {
  const { ev } = useEv()
  const nav = useNavigate()
  const notify = useToast()
  const { data: people } = usePoll(async () => {
    const { data, error } = await supabase.from('participants').select('id,distance,format,status,lang').eq('event_id', ev.id).range(0, 9999)
    if (error) throw error
    return data as Pick<Participant, 'id' | 'distance' | 'format' | 'status' | 'lang'>[]
  }, 30000, [ev.id])
  const distances = useMemo(() => ['Toutes', ...new Set([...ev.distances, ...(people ?? []).map((p) => p.distance).filter(Boolean)])], [ev.distances, people])
  const [kind, setKind] = useState<'info' | 'alerte' | 'relance'>('info')
  const [t, setT] = useState({ distance: 'Toutes', format: 'Tous', status: 'Tous', lang: 'Tous' })
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [sms, setSms] = useState(false)
  const [delay, setDelay] = useState(ev.sms_default_delay_min)
  const [busy, setBusy] = useState(false)
  const match = (p: Pick<Participant, 'distance' | 'format' | 'status' | 'lang'>) =>
    (t.distance === 'Toutes' || p.distance === t.distance) && (t.format === 'Tous' || p.format === t.format)
    && (t.status === 'Tous' || p.status === t.status) && (t.lang === 'Tous' || p.lang === t.lang)
  const count = (people ?? []).filter(match).length
  const label = [t.distance !== 'Toutes' ? t.distance : '', t.format !== 'Tous' ? t.format : '', t.status !== 'Tous' ? t.status : '', t.lang !== 'Tous' ? t.lang : ''].filter(Boolean).join(' · ') || 'Tous'
  const send = async () => {
    setBusy(true)
    const { data, error } = await supabase.rpc('send_message', {
      p_event: ev.id, p_title: title, p_body: body, p_kind: kind, p_target: t, p_label: label,
      p_require_confirm: confirm, p_sms: sms, p_sms_delay: delay,
    })
    setBusy(false)
    if (error) { notify(`Erreur : ${error.message}`); return }
    notify(`Message publié pour ${count} participants.`)
    nav(`/console/e/${ev.id}/messages/${data}`)
  }
  const chipRow = (labelTxt: string, key: keyof typeof t, opts: string[]) => (
    <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <span className="small muted" style={{ width: 80, paddingTop: 10 }}>{labelTxt}</span>
      <div className="chips" style={{ flex: 1 }}>{opts.map((o) => <button key={o} type="button" className="chip green" aria-pressed={t[key] === o} onClick={() => setT({ ...t, [key]: o })}>{o}</button>)}</div>
    </div>
  )
  return (
    <>
      <Head title="Nouveau message" sub={<Link to={`/console/e/${ev.id}/messages`}>← Messages</Link>}>
        <button type="button" className={`btn ${kind === 'alerte' ? 'alert' : 'primary'}`} disabled={busy || !count || !title.trim()} onClick={send}>{busy ? 'Envoi…' : `Publier pour ${count} participants`}</button>
      </Head>
      <div className="cols">
        <div className="stack" style={{ flex: '3 1 520px', gap: 16, minWidth: 0 }}>
          <section className="panel">
            <h2 style={{ fontSize: 16 }}>Type de message</h2>
            <div className="chips">{([['info', 'Information'], ['alerte', 'Alerte critique'], ['relance', 'Relance']] as const).map(([k, l]) => <button key={k} type="button" className="chip green" aria-pressed={kind === k} onClick={() => { setKind(k); if (k === 'alerte') setConfirm(true) }}>{l}</button>)}</div>
          </section>
          <section className="panel">
            <div className="row"><h2 className="grow" style={{ fontSize: 16 }}>Destinataires</h2><span className="pill" style={{ background: 'var(--forest-soft)', color: 'var(--forest-dark)' }}>{count} participants</span></div>
            {chipRow('Distance', 'distance', distances)}
            {chipRow('Format', 'format', ['Tous', 'Solo', 'Duo'])}
            {chipRow('Statut', 'status', ['Tous', 'inscrit', 'en course', 'abandon', 'finisher'])}
            {chipRow('Langue', 'lang', ['Tous', 'FR', 'EN', 'ES'])}
          </section>
          <section className="panel">
            <div className="field"><label htmlFor="ti">Titre</label><input id="ti" className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="field"><label htmlFor="bo">Message</label><textarea id="bo" className="textarea" rows={6} value={body} onChange={(e) => setBody(e.target.value)} /></div>
            <label className="check"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> Demander une confirmation de lecture</label>
          </section>
          <section className="panel">
            <h2 style={{ fontSize: 16 }}>Bascule SMS</h2>
            <label className="check"><input type="checkbox" checked={sms} onChange={(e) => setSms(e.target.checked)} /> Envoyer en SMS si non lu après</label>
            <select className="select" aria-label="Délai avant SMS" value={delay} disabled={!sms} onChange={(e) => setDelay(Number(e.target.value))} style={{ maxWidth: 220 }}><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={60}>1 heure</option></select>
            <p className="small muted">Réglage enregistré. L'envoi réel des SMS sera branché dans une prochaine version.</p>
          </section>
        </div>
        <aside className="panel" style={{ flex: '2 1 320px' }}>
          <h2 style={{ fontSize: 16 }}>Aperçu côté participant</h2>
          <div className="card">
            <span className={`tag ${kind}`}>{kindLabel(kind).toUpperCase()}</span>
            <div className="card-title">{title || 'Titre du message'}</div>
            <div className="card-text">{body || 'Texte du message'}</div>
            {confirm && <div className={`btn ${kind === 'alerte' ? 'alert' : 'primary'}`}>J'ai lu et compris</div>}
          </div>
          <p className="small muted">Le message apparaît dans le fil de chaque participant ciblé, dès qu'il ouvre l'app. Les notifications, e-mails et la traduction automatique arrivent dans une prochaine version.</p>
        </aside>
      </div>
    </>
  )
}

interface RecipientRow { participant_id: string; read_at: string | null; confirmed_at: string | null; participants: Pick<Participant, 'bib' | 'name' | 'distance' | 'lang' | 'activated_at' | 'phone' | 'email' | 'code'> }

export function MessageDetail() {
  const { ev } = useEv()
  const { mid } = useParams()
  const [tab, setTab] = useState<'todo' | 'done'>('todo')
  const { data, error, loading } = usePoll(async () => {
    const [m, r] = await Promise.all([
      supabase.from('messages').select('*').eq('id', mid!).single(),
      supabase.from('message_recipients').select('participant_id,read_at,confirmed_at,participants(bib,name,distance,lang,activated_at,phone,email,code)').eq('message_id', mid!).range(0, 9999),
    ])
    if (m.error) throw m.error
    if (r.error) throw r.error
    return { m: m.data as Message, r: r.data as unknown as RecipientRow[] }
  }, 4000, [mid])
  if (loading && !data) return <Loading />
  if (!data) return <ErrorNote error={error} />
  const { m, r } = data
  const total = r.length
  const read = r.filter((x) => x.read_at).length
  const conf = r.filter((x) => x.confirmed_at).length
  const doneOf = (x: RecipientRow) => (m.require_confirm ? !!x.confirmed_at : !!x.read_at)
  const todo = r.filter((x) => !doneOf(x))
  const rows = (tab === 'todo' ? todo : r.filter(doneOf)).sort((a, b) => (a.participants.bib ?? 0) - (b.participants.bib ?? 0))
  return (
    <>
      <Head title={m.title} sub={<><Link to={`/console/e/${ev.id}/messages`}>← Messages</Link> · {kindLabel(m.kind)} · {m.target_label || 'Tous'} · envoyé {ago(m.created_at)}</>}>
        <button type="button" className="btn" disabled={!todo.length} onClick={() => exportCodes(ev.name, todo.map((x) => x.participants), 'participants')}>Exporter les {todo.length} à relancer</button>
      </Head>
      <div className="kpis">
        <div className="kpi"><div className="k-label">Destinataires</div><div className="k-value">{total}</div></div>
        <div className="kpi"><div className="k-label">Lu</div><div className="k-value">{read} <small>{pct(read, total)} %</small></div><Progress value={total ? read / total : 0} /></div>
        {m.require_confirm && <div className="kpi"><div className="k-label">Confirmé</div><div className="k-value">{conf} <small>{pct(conf, total)} %</small></div><Progress value={total ? conf / total : 0} /></div>}
        <div className="kpi" style={{ background: 'var(--orange-soft)', borderColor: '#FFC9AE' }}><div className="k-label ko" style={{ fontWeight: 600 }}>{m.require_confirm ? 'Pas encore confirmé' : 'Pas encore lu'}</div><div className="k-value ko">{todo.length}</div></div>
      </div>
      <section className="panel">
        {m.body && <p className="card-text" style={{ background: 'var(--bg)', padding: 12, borderRadius: 10 }}>{m.body}</p>}
        <div className="chips" role="tablist">
          <button type="button" role="tab" className="chip" aria-pressed={tab === 'todo'} onClick={() => setTab('todo')}>{m.require_confirm ? 'Pas confirmé' : 'Pas lu'} ({todo.length})</button>
          <button type="button" role="tab" className="chip" aria-pressed={tab === 'done'} onClick={() => setTab('done')}>{m.require_confirm ? 'Confirmé' : 'Lu'} ({total - todo.length})</button>
        </div>
        <div className="table-wrap">
          <table className="t" style={{ minWidth: 620 }}>
            <thead><tr><th>Dossard</th><th>Participant</th><th>Distance</th><th>Code activé</th><th>Lu</th><th>Téléphone</th></tr></thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.participant_id}>
                  <td style={{ fontWeight: 700 }}>{x.participants.bib ?? '—'}</td><td>{x.participants.name}</td><td className="muted">{x.participants.distance}</td>
                  <td className={x.participants.activated_at ? 'ok' : 'ko'}>{x.participants.activated_at ? 'Oui' : 'Non'}</td>
                  <td className="muted">{x.read_at ? ago(x.read_at) : '—'}</td>
                  <td>{x.participants.phone ? <a href={`tel:${x.participants.phone.replace(/\s/g, '')}`}>{x.participants.phone}</a> : <span className="muted">—</span>}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={6} className="muted">Personne dans cette liste.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

// ---------- Participants ----------
const P_FIELDS = { bib: ['dossard', 'bib', 'numero', 'num'], name: ['nom', 'name', 'participant', 'prenomnom', 'nomcomplet'], first: ['prenom', 'firstname'], last: ['nomdefamille', 'lastname'], email: ['email', 'mail', 'courriel', 'adresseemail'], phone: ['telephone', 'tel', 'phone', 'portable', 'mobile'], distance: ['distance', 'parcours', 'course', 'epreuve'], format: ['format', 'categorie', 'solo'], lang: ['langue', 'lang', 'language'] }

export function Participants() {
  const { ev } = useEv()
  const notify = useToast()
  const initial = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('filtre') === 'inactifs' ? 'inactive' : 'all'
  const [only, setOnly] = useState<'all' | 'inactive'>(initial)
  const [q, setQ] = useState('')
  const [importing, setImporting] = useState(false)
  const { data, error, loading, reload } = usePoll(async () => {
    const { data, error } = await supabase.from('participants').select('*').eq('event_id', ev.id).order('bib', { ascending: true, nullsFirst: false }).range(0, 9999)
    if (error) throw error
    return data as Participant[]
  }, 8000, [ev.id])
  const list = (data ?? []).filter((p) => (only === 'all' || !p.activated_at) && `${p.bib ?? ''} ${p.name} ${p.email ?? ''}`.toLowerCase().includes(q.toLowerCase()))
  const setStatus = async (p: Participant, status: string) => {
    const { error } = await supabase.from('participants').update({ status }).eq('id', p.id)
    if (error) notify(`Erreur : ${error.message}`)
    reload()
  }
  const remove = async (p: Participant) => {
    if (!window.confirm(`Supprimer ${p.name} ? Son code ne fonctionnera plus.`)) return
    await supabase.from('participants').delete().eq('id', p.id)
    reload()
  }
  return (
    <>
      <Head title="Participants" sub={`${data?.length ?? 0} inscrits · ${(data ?? []).filter((p) => p.activated_at).length} codes activés`}>
        <button type="button" className="btn" onClick={() => setImporting(!importing)}>{importing ? 'Fermer l’import' : 'Importer / ajouter'}</button>
        <button type="button" className="btn primary" disabled={!list.length} onClick={() => exportCodes(ev.name, list, 'participants')}>Exporter les codes ({list.length})</button>
      </Head>
      {importing && <ImportPeople kind="participants" eventId={ev.id} onDone={() => { setImporting(false); reload() }} />}
      <section className="panel">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <label htmlFor="sq" className="sr-only">Rechercher</label>
          <input id="sq" className="input" style={{ flex: '1 1 240px' }} placeholder="Rechercher un nom, un dossard, un e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="chips">
            <button type="button" className="chip" aria-pressed={only === 'all'} onClick={() => setOnly('all')}>Tous</button>
            <button type="button" className="chip" aria-pressed={only === 'inactive'} onClick={() => setOnly('inactive')}>Code non activé</button>
          </div>
        </div>
        <p className="small muted">L'envoi automatique des codes par e-mail arrive dans une prochaine version. En attendant, exporte les codes en CSV pour les envoyer avec ton outil d'e-mailing (publipostage). Lien à indiquer : <strong>{appUrl()}#/rejoindre</strong></p>
        {loading && !data && <Loading />}
        <ErrorNote error={error} />
        <div className="table-wrap">
          <table className="t" style={{ minWidth: 820 }}>
            <thead><tr><th>Dossard</th><th>Nom</th><th>Distance</th><th>Langue</th><th>Code</th><th>Activé</th><th>Statut</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 700 }}>{p.bib ?? '—'}</td>
                  <td>{p.name}<div className="small muted">{p.email}</div></td>
                  <td className="muted">{p.distance} · {p.format}</td>
                  <td className="muted">{p.lang}</td>
                  <td className="code">{p.code}</td>
                  <td className={p.activated_at ? 'ok' : 'ko'}>{p.activated_at ? ago(p.activated_at) : 'Non'}</td>
                  <td><select className="select" aria-label={`Statut de ${p.name}`} value={p.status} onChange={(e) => setStatus(p, e.target.value)} style={{ minHeight: 36 }}>{['inscrit', 'en course', 'abandon', 'finisher'].map((s) => <option key={s}>{s}</option>)}</select></td>
                  <td><button type="button" className="btn" style={{ minHeight: 36 }} onClick={() => remove(p)}>Supprimer</button></td>
                </tr>
              ))}
              {data && !list.length && <tr><td colSpan={8} className="muted">Aucun participant. Importe un fichier CSV ou ajoute-les un par un.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

const V_FIELDS = { name: ['nom', 'name', 'benevole', 'nomcomplet'], first: ['prenom', 'firstname'], last: ['nomdefamille', 'lastname'], email: ['email', 'mail', 'courriel'], phone: ['telephone', 'tel', 'phone', 'portable', 'mobile'], post: ['poste', 'post', 'affectation'], pack: ['dotation', 'typededotation', 'pack'] }

function ImportPeople({ kind, eventId, posts = [], packs = [], onDone }: { kind: 'participants' | 'benevoles'; eventId: string; posts?: Post[]; packs?: DotationPack[]; onDone: () => void }) {
  const notify = useToast()
  const [text, setText] = useState('')
  const [one, setOne] = useState({ name: '', email: '', phone: '', distance: '', bib: '', post: '' })
  const [busy, setBusy] = useState(false)
  const rows = useMemo(() => parseCsv(text), [text])
  const fields = kind === 'participants' ? P_FIELDS : V_FIELDS
  const cols = rows.length ? mapColumns(rows[0], fields) : {}
  const records = rows.slice(1).map((r) => {
    const g = (k: string) => (cols[k] !== undefined ? r[cols[k]] ?? '' : '')
    const name = g('name') || [g('first'), g('last')].filter(Boolean).join(' ')
    return { r, name, g }
  }).filter((x) => x.name)
  const doImport = async () => {
    setBusy(true)
    let payload: Record<string, unknown>[]
    if (kind === 'participants') {
      payload = records.map(({ name, g }) => ({ event_id: eventId, name, bib: parseInt(g('bib'), 10) || null, email: g('email') || null, phone: g('phone') || null, distance: g('distance'), format: /duo/i.test(g('format')) ? 'Duo' : 'Solo', lang: normLang(g('lang')) }))
    } else {
      // Les postes cités dans le fichier qui n'existent pas encore sont créés automatiquement.
      const key = (t: string) => t.trim().toLowerCase()
      const known = new Map(posts.map((p) => [key(p.name), p.id]))
      const missing = [...new Set(records.map(({ g }) => g('post').trim()).filter((n) => n && !known.has(key(n))))]
      if (missing.length) {
        const { data: created, error: perr } = await supabase.from('posts')
          .insert(missing.map((n, i) => ({ event_id: eventId, name: n, capacity: records.filter(({ g }) => key(g('post')) === key(n)).length, position: posts.length + i + 1 })))
          .select('id,name')
        if (perr) { setBusy(false); notify(`Erreur : ${perr.message}`); return }
        for (const c of created ?? []) known.set(key(c.name), c.id)
      }
      payload = records.map(({ name, g }) => ({ event_id: eventId, name, email: g('email') || null, phone: g('phone') || null, post_id: known.get(key(g('post'))) ?? null }))
      // Colonne « Dotation » : type de dotation individuel (créé s'il n'existe pas).
      const packNames = records.map(({ g }) => g('pack').trim())
      if (packNames.some(Boolean)) {
        const kp = new Map(packs.map((k) => [key(k.name), k.id]))
        const newPacks = [...new Set(packNames.filter((n) => n && !kp.has(key(n))))]
        if (newPacks.length) {
          const { data: cp } = await supabase.from('dotation_packs').insert(newPacks.map((n) => ({ event_id: eventId, name: n }))).select('id,name')
          for (const c of cp ?? []) kp.set(key(c.name), c.id)
        }
        const { data: ins, error: verr } = await supabase.from('volunteers').insert(payload).select('id')
        setBusy(false)
        if (verr) { notify(`Erreur : ${verr.message}`); return }
        const links = (ins ?? []).map((v, i) => ({ pack_id: kp.get(key(packNames[i])), volunteer_id: v.id, event_id: eventId })).filter((x) => x.pack_id)
        if (links.length) await supabase.from('dotation_pack_volunteers').insert(links)
        notify(`${payload.length} bénévoles importés, ${links.length} avec une dotation individuelle.`)
        setText('')
        onDone()
        return
      }
    }
    const { error } = await supabase.from(kind === 'participants' ? 'participants' : 'volunteers').insert(payload)
    setBusy(false)
    if (error) { notify(`Erreur : ${error.message}`); return }
    notify(`${payload.length} ${kind === 'participants' ? 'participants' : 'bénévoles'} importés, chacun avec son code personnel.`)
    setText('')
    onDone()
  }
  const addOne = async (e: FormEvent) => {
    e.preventDefault()
    const row: Record<string, unknown> = kind === 'participants'
      ? { event_id: eventId, name: one.name, email: one.email || null, phone: one.phone || null, distance: one.distance, bib: parseInt(one.bib, 10) || null }
      : { event_id: eventId, name: one.name, email: one.email || null, phone: one.phone || null, post_id: one.post || null }
    const { error } = await supabase.from(kind === 'participants' ? 'participants' : 'volunteers').insert(row)
    if (error) { notify(`Erreur : ${error.message}`); return }
    setOne({ name: '', email: '', phone: '', distance: '', bib: '', post: '' })
    onDone()
  }
  const sample = kind === 'participants'
    ? 'Dossard;Nom;E-mail;Téléphone;Distance;Format;Langue\n101;Léa Martin;lea@example.com;0600000000;300 km;Solo;FR'
    : 'Nom;E-mail;Téléphone;Poste;Dotation\nPaul Durand;paul@example.com;0600000000;Ravitaillement CP1;Haute montagne'
  return (
    <section className="panel">
      <h2>Ajouter des {kind === 'participants' ? 'participants' : 'bénévoles'}</h2>
      <form className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }} onSubmit={addOne}>
        {kind === 'participants' && <div className="field" style={{ width: 100 }}><label htmlFor="ob">Dossard</label><input id="ob" className="input" value={one.bib} onChange={(e) => setOne({ ...one, bib: e.target.value })} /></div>}
        <div className="field grow" style={{ minWidth: 180 }}><label htmlFor="onm">Nom</label><input id="onm" className="input" required value={one.name} onChange={(e) => setOne({ ...one, name: e.target.value })} /></div>
        <div className="field grow" style={{ minWidth: 180 }}><label htmlFor="oe">E-mail</label><input id="oe" type="email" className="input" value={one.email} onChange={(e) => setOne({ ...one, email: e.target.value })} /></div>
        <div className="field" style={{ width: 150 }}><label htmlFor="oph">Téléphone</label><input id="oph" className="input" value={one.phone} onChange={(e) => setOne({ ...one, phone: e.target.value })} /></div>
        {kind === 'participants'
          ? <div className="field" style={{ width: 130 }}><label htmlFor="od">Distance</label><input id="od" className="input" value={one.distance} onChange={(e) => setOne({ ...one, distance: e.target.value })} /></div>
          : <div className="field" style={{ width: 200 }}><label htmlFor="op">Poste</label><select id="op" className="select" value={one.post} onChange={(e) => setOne({ ...one, post: e.target.value })}><option value="">Non affecté</option>{posts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>}
        <button type="submit" className="btn primary">Ajouter</button>
      </form>
      <div className="field">
        <label htmlFor="csv">Ou importe un fichier CSV / Excel (enregistré en CSV)</label>
        <input id="csv" type="file" accept=".csv,.txt,text/csv" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()) }} />
        <textarea className="textarea" rows={4} aria-label="Contenu CSV" placeholder={`Ou colle les lignes ici. Exemple :\n${sample}`} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      {rows.length > 0 && (
        <div className="card soft small">
          <div>Colonnes reconnues : {Object.keys(cols).length ? Object.keys(cols).map((k) => `${k} → « ${rows[0][cols[k]]} »`).join(', ') : 'aucune'}</div>
          <div><strong>{records.length}</strong> lignes prêtes à importer.{(cols as Record<string, number>).name === undefined && (cols as Record<string, number>).first === undefined && ' Il faut au moins une colonne « Nom ».'}</div>
          {records.length > 0 && <button type="button" className="btn primary" disabled={busy} onClick={doImport} style={{ alignSelf: 'flex-start' }}>{busy ? 'Import…' : `Importer ${records.length} ${kind === 'participants' ? 'participants' : 'bénévoles'}`}</button>}
        </div>
      )}
    </section>
  )
}

// ---------- Bénévoles et postes ----------
export function Benevoles() {
  const { ev } = useEv()
  const notify = useToast()
  const [importing, setImporting] = useState(false)
  const [editing, setEditing] = useState<Post | 'new' | null>(null)
  const [pmPost, setPmPost] = useState('tous')
  const [pmText, setPmText] = useState('')
  const [chatPost, setChatPost] = useState('')
  const { data, reload } = usePoll(async () => {
    const [p, v, pk, pp, pv] = await Promise.all([
      supabase.from('posts').select('*').eq('event_id', ev.id).order('position').order('name'),
      supabase.from('volunteers').select('*').eq('event_id', ev.id).order('name').range(0, 9999),
      supabase.from('dotation_packs').select('*').eq('event_id', ev.id).order('created_at'),
      supabase.from('dotation_pack_posts').select('pack_id,post_id').eq('event_id', ev.id),
      supabase.from('dotation_pack_volunteers').select('pack_id,volunteer_id').eq('event_id', ev.id),
    ])
    if (p.error) throw p.error
    if (v.error) throw v.error
    return {
      posts: p.data as Post[], vols: v.data as Volunteer[], packs: (pk.data ?? []) as DotationPack[],
      packPosts: (pp.data ?? []) as { pack_id: string; post_id: string }[], packVols: (pv.data ?? []) as { pack_id: string; volunteer_id: string }[],
    }
  }, 6000, [ev.id])
  const posts = data?.posts ?? []
  const vols = data?.vols ?? []
  const packs = data?.packs ?? []
  const postPacks = (postId: string) => packs.filter((k) => k.for_all || data?.packPosts.some((x) => x.pack_id === k.id && x.post_id === postId)).map((k) => k.name)
  const volPack = (vId: string) => data?.packVols.find((x) => x.volunteer_id === vId)?.pack_id ?? ''
  const setVolPack = async (v: Volunteer, packId: string) => {
    await supabase.from('dotation_pack_volunteers').delete().eq('volunteer_id', v.id)
    if (packId) {
      const { error } = await supabase.from('dotation_pack_volunteers').insert({ pack_id: packId, volunteer_id: v.id, event_id: ev.id })
      if (error) notify(`Erreur : ${error.message}`)
    }
    reload()
  }
  const here = (v: Volunteer) => !!v.checked_in_at && !v.checked_out_at
  const assign = async (v: Volunteer, post: string) => {
    const { error } = await supabase.from('volunteers').update({ post_id: post || null }).eq('id', v.id)
    if (error) notify(`Erreur : ${error.message}`)
    reload()
  }
  const sendPm = async () => {
    const { error } = await supabase.from('post_messages').insert({ event_id: ev.id, post_id: pmPost === 'tous' ? null : pmPost, body: pmText })
    if (error) { notify(`Erreur : ${error.message}`); return }
    setPmText('')
    notify('Message publié pour les bénévoles concernés.')
  }
  return (
    <>
      <Head title="Bénévoles et postes" sub={`${vols.length} bénévoles · ${posts.length} postes`}>
        <button type="button" className="btn" onClick={() => setEditing('new')}>Créer un poste</button>
        <button type="button" className="btn" onClick={() => setImporting(!importing)}>{importing ? 'Fermer l’import' : 'Importer / ajouter des bénévoles'}</button>
        <button type="button" className="btn primary" disabled={!vols.length} onClick={() => exportCodes(ev.name, vols.map((v) => ({ ...v, post: posts.find((p) => p.id === v.post_id)?.name ?? '' })), 'benevoles')}>Exporter les codes</button>
      </Head>
      <div className="kpis">
        <div className="kpi"><div className="k-label">Code activé</div><div className="k-value">{vols.filter((v) => v.activated_at).length} <small>/ {vols.length}</small></div></div>
        <div className="kpi"><div className="k-label">Présence confirmée</div><div className="k-value">{vols.filter((v) => v.confirmed_at).length} <small>/ {vols.length}</small></div></div>
        <div className="kpi"><div className="k-label">Consignes lues</div><div className="k-value">{vols.filter((v) => v.instructions_read_at).length} <small>/ {vols.length}</small></div></div>
        <div className="kpi"><div className="k-label">Sur leur poste</div><div className="k-value">{vols.filter(here).length} <small>/ {vols.length}</small></div><div className="k-sub">pointage en direct</div></div>
      </div>
      {editing && <PostForm eventId={ev.id} post={editing === 'new' ? null : editing} packs={packs.filter((k) => !k.for_all)} linked={editing === 'new' ? [] : (data?.packPosts ?? []).filter((x) => x.post_id === editing.id).map((x) => x.pack_id)} onDone={() => { setEditing(null); reload() }} />}
      {importing && <ImportPeople kind="benevoles" eventId={ev.id} posts={posts} packs={packs} onDone={() => { setImporting(false); reload() }} />}
      <div className="cols">
        <section className="panel" style={{ flex: '2 1 560px' }}>
          <h2>Postes</h2>
          <div className="table-wrap">
            <table className="t" style={{ minWidth: 600 }}>
              <thead><tr><th>Poste</th><th>Horaires</th><th>Responsable</th><th>Dotation</th><th>Confirmés</th><th>Sur place</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {posts.map((p) => {
                  const team = vols.filter((v) => v.post_id === p.id)
                  const c = team.filter((v) => v.confirmed_at).length
                  const h = team.filter(here).length
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.name}</td><td className="muted">{p.hours}</td><td className="muted">{p.lead_name}</td>
                      <td className="small">{postPacks(p.id).join(', ') || <span className="muted">—</span>}</td>
                      <td className={c >= p.capacity ? 'ok' : 'ko'} style={{ fontWeight: 600 }}>{c} / {p.capacity}</td>
                      <td className={h >= p.capacity ? 'ok' : 'muted'}>{h} / {p.capacity}</td>
                      <td style={{ whiteSpace: 'nowrap' }}><button type="button" className="btn" style={{ minHeight: 36 }} onClick={() => setEditing(p)}>Modifier</button> <button type="button" className="btn" style={{ minHeight: 36 }} onClick={() => setChatPost(p.id)}>Groupe</button></td>
                    </tr>
                  )
                })}
                {!posts.length && <tr><td colSpan={7} className="muted">Aucun poste. Crée tes postes (accueil, ravitaillements, signaleurs…) puis affecte les bénévoles.</td></tr>}
              </tbody>
            </table>
          </div>
          <h2 style={{ marginTop: 8 }}>Bénévoles</h2>
          <div className="table-wrap">
            <table className="t" style={{ minWidth: 860 }}>
              <thead><tr><th>Nom</th><th>Poste</th><th>Dotation perso</th><th>Code</th><th>Activé</th><th>Présence</th><th>Sur place</th></tr></thead>
              <tbody>
                {vols.map((v) => (
                  <tr key={v.id}>
                    <td>{v.name}<div className="small muted">{v.phone ?? v.email}</div></td>
                    <td><select className="select" aria-label={`Poste de ${v.name}`} value={v.post_id ?? ''} onChange={(e) => assign(v, e.target.value)} style={{ minHeight: 36 }}><option value="">Non affecté</option>{posts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
                    <td><select className="select" aria-label={`Dotation individuelle de ${v.name}`} value={volPack(v.id)} onChange={(e) => setVolPack(v, e.target.value)} style={{ minHeight: 36 }}><option value="">Celle du poste</option>{packs.filter((k) => !k.for_all).map((k) => <option key={k.id} value={k.id}>+ {k.name}</option>)}</select></td>
                    <td className="code">{v.code}</td>
                    <td className={v.activated_at ? 'ok' : 'ko'}>{v.activated_at ? 'Oui' : 'Non'}</td>
                    <td className={v.confirmed_at ? 'ok' : 'ko'}>{v.confirmed_at ? 'Confirmée' : 'En attente'}</td>
                    <td className={here(v) ? 'ok' : 'muted'}>{here(v) ? `Depuis ${ago(v.checked_in_at)}` : '—'}</td>
                  </tr>
                ))}
                {!vols.length && <tr><td colSpan={7} className="muted">Aucun bénévole.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <div className="stack" style={{ flex: '1 1 320px', gap: 16 }}>
          <section className="panel">
            <h2>Message aux bénévoles</h2>
            <select className="select" aria-label="Destinataires" value={pmPost} onChange={(e) => setPmPost(e.target.value)}><option value="tous">Tous les bénévoles</option>{posts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <textarea className="textarea" rows={3} aria-label="Message" placeholder="Ex. : premiers coureurs attendus vers 16 h" value={pmText} onChange={(e) => setPmText(e.target.value)} />
            <button type="button" className="btn primary" disabled={!pmText.trim()} onClick={sendPm}>Publier</button>
          </section>
          {chatPost && <TeamChat eventId={ev.id} post={posts.find((p) => p.id === chatPost)!} onClose={() => setChatPost('')} />}
        </div>
      </div>
    </>
  )
}

function PostForm({ eventId, post, packs, linked, onDone }: { eventId: string; post: Post | null; packs: DotationPack[]; linked: string[]; onDone: () => void }) {
  const notify = useToast()
  const [sel, setSel] = useState<string[]>(linked)
  const [f, setF] = useState({ name: post?.name ?? '', hours: post?.hours ?? '', place: post?.place ?? '', lead_name: post?.lead_name ?? '', lead_phone: post?.lead_phone ?? '', capacity: post?.capacity ?? 2, instructions: post?.instructions ?? '' })
  const save = async (e: FormEvent) => {
    e.preventDefault()
    const res = post ? await supabase.from('posts').update(f).eq('id', post.id).select('id').single() : await supabase.from('posts').insert({ ...f, event_id: eventId }).select('id').single()
    if (res.error) { notify(`Erreur : ${res.error.message}`); return }
    // Types de dotation rattachés au poste
    const postId = res.data.id as string
    const toAdd = sel.filter((id) => !linked.includes(id))
    const toDel = linked.filter((id) => !sel.includes(id))
    if (toDel.length) await supabase.from('dotation_pack_posts').delete().eq('post_id', postId).in('pack_id', toDel)
    if (toAdd.length) await supabase.from('dotation_pack_posts').insert(toAdd.map((pack_id) => ({ pack_id, post_id: postId, event_id: eventId })))
    onDone()
  }
  const del = async () => {
    if (!post || !window.confirm(`Supprimer le poste « ${post.name} » ? Les bénévoles seront désaffectés.`)) return
    await supabase.from('posts').delete().eq('id', post.id)
    onDone()
  }
  return (
    <form className="panel" onSubmit={save} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
      <h2 style={{ gridColumn: '1 / -1' }}>{post ? 'Modifier le poste' : 'Nouveau poste'}</h2>
      <div className="field"><label htmlFor="pn">Nom</label><input id="pn" className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div className="field"><label htmlFor="ph">Horaires</label><input id="ph" className="input" placeholder="14 h – 22 h" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></div>
      <div className="field"><label htmlFor="pl">Lieu</label><input id="pl" className="input" value={f.place} onChange={(e) => setF({ ...f, place: e.target.value })} /></div>
      <div className="field"><label htmlFor="pc">Nombre de bénévoles</label><input id="pc" type="number" min={1} className="input" value={f.capacity} onChange={(e) => setF({ ...f, capacity: Number(e.target.value) })} /></div>
      <div className="field"><label htmlFor="pr">Responsable</label><input id="pr" className="input" value={f.lead_name} onChange={(e) => setF({ ...f, lead_name: e.target.value })} /></div>
      <div className="field"><label htmlFor="pt">Téléphone du responsable</label><input id="pt" className="input" value={f.lead_phone} onChange={(e) => setF({ ...f, lead_phone: e.target.value })} /></div>
      <div className="field" style={{ gridColumn: '1 / -1' }}><label htmlFor="pi">Consignes (les bénévoles doivent confirmer les avoir lues)</label><textarea id="pi" className="textarea" rows={3} value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} /></div>
      <fieldset style={{ gridColumn: '1 / -1', border: 0, padding: 0, margin: 0 }}>
        <legend className="small" style={{ fontWeight: 700, marginBottom: 6 }}>Dotation du poste</legend>
        {packs.length ? (
          <div className="chips">{packs.map((k) => <button key={k.id} type="button" className="chip green" aria-pressed={sel.includes(k.id)} onClick={() => setSel(sel.includes(k.id) ? sel.filter((x) => x !== k.id) : [...sel, k.id])}>{k.name}</button>)}</div>
        ) : <p className="small muted">Crée des types de dotation dans l'onglet Dotations pour les rattacher au poste.</p>}
      </fieldset>
      <div className="row" style={{ gridColumn: '1 / -1' }}><button type="submit" className="btn primary">Enregistrer</button><button type="button" className="btn" onClick={onDone}>Annuler</button>{post && <button type="button" className="btn" style={{ color: 'var(--danger)', marginLeft: 'auto' }} onClick={del}>Supprimer</button>}</div>
    </form>
  )
}

function TeamChat({ eventId, post, onClose }: { eventId: string; post: Post; onClose: () => void }) {
  const [txt, setTxt] = useState('')
  const { data, reload } = usePoll(async () => {
    const { data } = await supabase.from('team_messages').select('*').eq('post_id', post.id).order('created_at').limit(200)
    return (data ?? []) as { id: string; author: string; body: string; created_at: string; from_org: boolean }[]
  }, 4000, [post.id])
  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (!txt.trim()) return
    await supabase.from('team_messages').insert({ event_id: eventId, post_id: post.id, author: 'PC course', from_org: true, body: txt })
    setTxt('')
    reload()
  }
  return (
    <section className="panel">
      <div className="row"><h2 className="grow">Groupe · {post.name}</h2><button type="button" className="btn" onClick={onClose}>Fermer</button></div>
      <div className="stack" style={{ maxHeight: 320, overflowY: 'auto' }}>
        {(data ?? []).map((m) => <div key={m.id} className={`bubble ${m.from_org ? 'mine' : ''}`}><span className="who">{m.author} · {ago(m.created_at)}</span><span className="text">{m.body}</span></div>)}
        {data && !data.length && <p className="small muted">Pas encore de message dans ce groupe.</p>}
      </div>
      <form className="row" onSubmit={send}><input className="input grow" aria-label="Message au groupe" placeholder="Écrire au groupe en tant que PC course" value={txt} onChange={(e) => setTxt(e.target.value)} /><button type="submit" className="btn primary">Envoyer</button></form>
    </section>
  )
}

// ---------- Boîte de réception ----------
export function Inbox() {
  const { ev, reloadEvent } = useEv()
  const notify = useToast()
  const [open, setOpen] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const { data, reload } = usePoll(async () => {
    const [r, pm, people] = await Promise.all([
      supabase.from('reports').select('*').eq('event_id', ev.id).order('created_at', { ascending: false }).limit(200),
      supabase.from('private_messages').select('*').eq('event_id', ev.id).order('created_at').range(0, 4999),
      supabase.from('participants').select('id,name,bib,phone').eq('event_id', ev.id).range(0, 9999),
    ])
    return { reports: (r.data ?? []) as Report[], pms: (pm.data ?? []) as PrivateMessage[], people: (people.data ?? []) as Pick<Participant, 'id' | 'name' | 'bib' | 'phone'>[] }
  }, 5000, [ev.id])
  const threads = useMemo(() => {
    const m = new Map<string, PrivateMessage[]>()
    for (const x of data?.pms ?? []) m.set(x.participant_id, [...(m.get(x.participant_id) ?? []), x])
    return [...m.entries()].map(([pid, msgs]) => ({ pid, msgs, who: data!.people.find((p) => p.id === pid), unread: msgs.filter((x) => !x.from_org && !x.read_at).length, last: msgs[msgs.length - 1] }))
      .sort((a, b) => b.last.created_at.localeCompare(a.last.created_at))
  }, [data])
  const handle = async (r: Report) => {
    await supabase.from('reports').update({ handled_at: new Date().toISOString() }).eq('id', r.id)
    reload(); reloadEvent()
  }
  const openThread = async (pid: string) => {
    setOpen(pid)
    await supabase.from('private_messages').update({ read_at: new Date().toISOString() }).eq('participant_id', pid).eq('from_org', false).is('read_at', null)
    reload(); reloadEvent()
  }
  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (!open || !reply.trim()) return
    const { error } = await supabase.from('private_messages').insert({ event_id: ev.id, participant_id: open, from_org: true, body: reply })
    if (error) { notify(`Erreur : ${error.message}`); return }
    setReply('')
    reload()
  }
  const thread = threads.find((t) => t.pid === open)
  return (
    <>
      <Head title="Boîte de réception" sub="Abandons, incidents, remontées des postes et questions des participants" />
      <div className="cols">
        <section className="panel" style={{ flex: '1 1 420px' }}>
          <h2>Signalements</h2>
          {(data?.reports ?? []).map((r) => (
            <div key={r.id} className={`card ${r.handled_at ? '' : 'warn'}`}>
              <div className="card-meta"><span className={`tag ${r.type === 'Abandon' ? 'danger' : 'alerte'}`}>{r.type}</span><span>{r.participant_id ? 'Participant' : 'Bénévole'} · {ago(r.created_at)}</span></div>
              <div className="card-title">{r.source_label}</div>
              {r.body && r.body !== r.type && <div className="small">{r.body}</div>}
              {r.lat !== null && r.lng !== null && <a className="small" href={`https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}#map=14/${r.lat}/${r.lng}`} target="_blank" rel="noreferrer">Voir la position sur une carte</a>}
              {r.handled_at ? <span className="small ok" style={{ fontWeight: 700 }}>✓ Traité</span> : <button type="button" className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={() => handle(r)}>Marquer comme traité</button>}
            </div>
          ))}
          {data && !data.reports.length && <p className="small muted">Aucun signalement.</p>}
        </section>
        <section className="panel" style={{ flex: '1 1 420px' }}>
          <h2>Messages des participants</h2>
          {!open && threads.map((t) => (
            <button key={t.pid} type="button" className="card" style={{ textAlign: 'left', cursor: 'pointer', background: t.unread ? 'var(--alert-soft)' : '#fff' }} onClick={() => openThread(t.pid)}>
              <div className="card-meta"><strong style={{ color: 'var(--ink)' }}>{t.who ? `${t.who.bib ? `${t.who.bib} · ` : ''}${t.who.name}` : 'Participant'}</strong><span>{ago(t.last.created_at)}{t.unread ? ` · ${t.unread} non lu` : ''}</span></div>
              <div className="small">{t.last.from_org ? 'Vous : ' : ''}{t.last.body}</div>
            </button>
          ))}
          {!open && data && !threads.length && <p className="small muted">Aucune question pour l'instant.</p>}
          {thread && (
            <>
              <div className="row"><button type="button" className="btn" onClick={() => setOpen(null)}>← Toutes les conversations</button><strong className="grow">{thread.who?.name}</strong>{thread.who?.phone && <a href={`tel:${thread.who.phone.replace(/\s/g, '')}`}>{thread.who.phone}</a>}</div>
              <div className="stack" style={{ maxHeight: 380, overflowY: 'auto' }}>
                {thread.msgs.map((m) => <div key={m.id} className={`bubble ${m.from_org ? 'mine' : ''}`}><span className="who">{m.from_org ? 'Organisation' : thread.who?.name} · {ago(m.created_at)}</span><span className="text">{m.body}</span></div>)}
              </div>
              <form className="row" onSubmit={send}><input className="input grow" aria-label="Réponse" placeholder="Répondre…" value={reply} onChange={(e) => setReply(e.target.value)} /><button type="submit" className="btn primary">Envoyer</button></form>
            </>
          )}
        </section>
      </div>
    </>
  )
}

// ---------- Fiche et réglages ----------
export function Fiche() {
  const { ev, reloadEvent } = useEv()
  const notify = useToast()
  const nav = useNavigate()
  const [f, setF] = useState({
    name: ev.name, practice: ev.practice, starts_on: ev.starts_on ?? '', place: ev.place, distances: ev.distances.join(', '),
    description: ev.description, registration_url: ev.registration_url ?? '', registration_status: ev.registration_status,
    is_public: ev.is_public, color: ev.color, relaunch_every_days: ev.relaunch_every_days, relaunch_until_days_before: ev.relaunch_until_days_before,
    sms_default_delay_min: ev.sms_default_delay_min,
  })
  const save = async (e: FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('events').update({
      ...f, starts_on: f.starts_on || null, registration_url: f.registration_url || null,
      distances: f.distances.split(/[,;/]/).map((x) => x.trim()).filter(Boolean),
      published: f.is_public ? ev.published : false,
    }).eq('id', ev.id)
    if (error) { notify(`Erreur : ${error.message}`); return }
    notify(f.is_public && !ev.published ? 'Enregistré. La fiche sera visible après validation par la plateforme.' : 'Enregistré.')
    reloadEvent()
  }
  const remove = async () => {
    if (!window.confirm(`Supprimer définitivement « ${ev.name} » et toutes ses données (participants, messages, bénévoles) ?`)) return
    const { error } = await supabase.from('events').delete().eq('id', ev.id)
    if (error) { notify(`Erreur : ${error.message}`); return }
    nav('/console')
  }
  return (
    <form onSubmit={save} className="stack" style={{ gap: 16 }}>
      <Head title="Fiche et réglages" sub={ev.is_public ? (ev.published ? 'Fiche publique visible dans « Découvrir les événements »' : 'Fiche publique en attente de validation') : 'Événement privé : accès par code uniquement'}>
        <button type="submit" className="btn primary">Enregistrer</button>
      </Head>
      <section className="panel">
        <h2 style={{ fontSize: 16 }}>Visibilité</h2>
        <div className="chips">
          <button type="button" className="chip green" aria-pressed={f.is_public} onClick={() => setF({ ...f, is_public: true })}>Publique : visible dans l'app</button>
          <button type="button" className="chip green" aria-pressed={!f.is_public} onClick={() => setF({ ...f, is_public: false })}>Privée : accès par code seulement</button>
        </div>
      </section>
      <section className="panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <div className="field" style={{ gridColumn: '1 / -1' }}><label htmlFor="fn">Nom de l'événement</label><input id="fn" className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="field"><label htmlFor="fp">Pratique</label><select id="fp" className="select" value={f.practice} onChange={(e) => setF({ ...f, practice: e.target.value })}>{PRACTICES.map((p) => <option key={p}>{p}</option>)}</select></div>
        <div className="field"><label htmlFor="fd">Date de départ</label><input id="fd" type="date" className="input" value={f.starts_on} onChange={(e) => setF({ ...f, starts_on: e.target.value })} /></div>
        <div className="field"><label htmlFor="fl">Lieu</label><PlaceInput id="fl" value={f.place} onChange={(v) => setF({ ...f, place: v })} /></div>
        <div className="field"><label htmlFor="fk">Distances</label><input id="fk" className="input" value={f.distances} onChange={(e) => setF({ ...f, distances: e.target.value })} /></div>
        <div className="field" style={{ gridColumn: '1 / -1' }}><label htmlFor="fe">Présentation</label><textarea id="fe" className="textarea" rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div className="field"><label htmlFor="fu">Lien d'inscription</label><input id="fu" type="url" className="input" placeholder="https://" value={f.registration_url} onChange={(e) => setF({ ...f, registration_url: e.target.value })} /></div>
        <div className="field"><label htmlFor="fs">Inscriptions</label><select id="fs" className="select" value={f.registration_status} onChange={(e) => setF({ ...f, registration_status: e.target.value })}>{['ouvertes', 'bientôt ouvertes', 'complet', 'fermées'].map((s) => <option key={s}>{s}</option>)}</select></div>
        <div className="field"><label htmlFor="fc">Couleur</label><input id="fc" type="color" className="input" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} style={{ padding: 4 }} /></div>
      </section>
      <section className="panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <h2 style={{ fontSize: 16, gridColumn: '1 / -1' }}>Relances et SMS</h2>
        <div className="field"><label htmlFor="rf">Relancer les codes non activés tous les</label><select id="rf" className="select" value={f.relaunch_every_days} onChange={(e) => setF({ ...f, relaunch_every_days: Number(e.target.value) })}><option value={1}>jours</option><option value={3}>3 jours</option><option value={7}>7 jours</option></select></div>
        <div className="field"><label htmlFor="ru">Jusqu'à (jours avant le départ)</label><input id="ru" type="number" min={0} className="input" value={f.relaunch_until_days_before} onChange={(e) => setF({ ...f, relaunch_until_days_before: Number(e.target.value) })} /></div>
        <div className="field"><label htmlFor="sd">Délai par défaut avant SMS (minutes)</label><input id="sd" type="number" min={5} className="input" value={f.sms_default_delay_min} onChange={(e) => setF({ ...f, sms_default_delay_min: Number(e.target.value) })} /></div>
        <p className="small muted" style={{ gridColumn: '1 / -1' }}>Réglages enregistrés : les relances automatiques par e-mail et les SMS seront activés dans une prochaine version.</p>
      </section>
      <section className="panel"><h2 style={{ fontSize: 16 }}>Zone sensible</h2><button type="button" className="btn" style={{ color: 'var(--danger)', alignSelf: 'flex-start' }} onClick={remove}>Supprimer l'événement</button></section>
    </form>
  )
}
