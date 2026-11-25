import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { dateFr, usePoll } from '../lib/util'
import type { EventRow } from '../lib/types'
import { ErrorNote, Loading, useToast } from '../components/ui'
import { useAuth } from './auth'
import { NewEvent } from './console'
import { Brand } from '../components/Logo'

export function Admin() {
  const { session } = useAuth()
  const notify = useToast()
  const { data, error, loading, reload } = usePoll(async () => {
    const admin = await supabase.from('platform_admins').select('user_id').eq('user_id', session!.user.id).maybeSingle()
    if (!admin.data) return { admin: false, events: [] as EventRow[], orgs: [] as { id: string; name: string }[] }
    const [ev, orgs] = await Promise.all([
      supabase.from('events').select('*').order('created_at', { ascending: false }),
      supabase.from('organizations').select('id,name').order('name'),
    ])
    if (ev.error) throw ev.error
    return { admin: true, events: ev.data as EventRow[], orgs: (orgs.data ?? []) as { id: string; name: string }[] }
  }, 15000)

  const claim = async () => {
    const { data: ok, error } = await supabase.rpc('claim_platform_admin')
    if (error) { notify(`Erreur : ${error.message}`); return }
    notify(ok ? 'Tu es administrateur de la plateforme.' : 'Un administrateur existe déjà.')
    reload()
  }
  const publish = async (e: EventRow, published: boolean) => {
    const { error } = await supabase.from('events').update({ published }).eq('id', e.id)
    if (error) notify(`Erreur : ${error.message}`)
    reload()
  }

  const orgName = (id: string) => data?.orgs.find((o) => o.id === id)?.name ?? '—'
  const pending = (data?.events ?? []).filter((e) => e.is_public && !e.published)

  return (
    <div className="console">
      <nav className="side admin" aria-label="Navigation admin">
        <span className="brand"><Brand size={18} /></span>
        <Link to="/admin" className="active">Administration</Link>
        <Link to="/console" style={{ marginTop: 'auto' }}>← Console organisateur</Link>
      </nav>
      <main className="main">
        <div className="page-head"><div><h1>Administration de la plateforme</h1><p>Validation des fiches publiques, organisations et événements</p></div></div>
        {loading && !data && <Loading />}
        <ErrorNote error={error} />
        {data && !data.admin && (
          <section className="panel" style={{ maxWidth: 560 }}>
            <h2>Accès administrateur</h2>
            <p className="small muted">Le premier compte qui le demande devient administrateur de la plateforme. Ensuite, la place est prise.</p>
            <button type="button" className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={claim}>Devenir administrateur</button>
          </section>
        )}
        {data?.admin && (
          <>
            <div className="kpis">
              <div className="kpi"><div className="k-label">Organisations</div><div className="k-value">{data.orgs.length}</div></div>
              <div className="kpi"><div className="k-label">Événements</div><div className="k-value">{data.events.length}</div></div>
              <div className="kpi"><div className="k-label">Fiches à valider</div><div className={`k-value ${pending.length ? 'ko' : ''}`}>{pending.length}</div></div>
            </div>
            <Organisations orgs={data.orgs} events={data.events} reload={reload} />
            <section className="panel">
              <h2>Fiches publiques à valider</h2>
              {pending.map((e) => (
                <div key={e.id} className="card warn">
                  <div className="card-meta"><span>{orgName(e.org_id)}</span><span>{dateFr(e.starts_on)}</span></div>
                  <div className="card-title">{e.name}</div>
                  <div className="small">{e.practice}{e.place ? ` · ${e.place}` : ''}</div>
                  {e.description && <div className="card-text">{e.description}</div>}
                  <div className="row"><button type="button" className="btn primary" onClick={() => publish(e, true)}>Valider et publier</button><Link className="btn" to={`/evenement/${e.id}`}>Voir la fiche</Link></div>
                </div>
              ))}
              {!pending.length && <p className="small muted">Aucune fiche en attente.</p>}
            </section>
            <section className="panel">
              <h2>Tous les événements</h2>
              <div className="table-wrap">
                <table className="t" style={{ minWidth: 620 }}>
                  <thead><tr><th>Événement</th><th>Organisation</th><th>Date</th><th>Statut</th><th><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody>
                    {data.events.map((e) => (
                      <tr key={e.id}>
                        <td style={{ fontWeight: 600 }}>{e.name}</td><td className="muted">{orgName(e.org_id)}</td><td className="muted">{dateFr(e.starts_on)}</td>
                        <td className="muted">{e.is_public ? (e.published ? 'Publique' : 'À valider') : 'Privée'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}><Link className="btn" style={{ minHeight: 36 }} to={`/console/e/${e.id}`}>Préparer</Link> {e.published && <button type="button" className="btn" style={{ minHeight: 36 }} onClick={() => publish(e, false)}>Dépublier</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}

function Organisations({ orgs, events, reload }: { orgs: { id: string; name: string }[]; events: EventRow[]; reload: () => void }) {
  const notify = useToast()
  const [name, setName] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const create = async (e: FormEvent) => {
    e.preventDefault()
    const { data, error } = await supabase.rpc('admin_create_organization', { p_name: name })
    if (error) { notify(`Erreur : ${error.message}`); return }
    setName('')
    setOpen(data as string)
    notify('Organisation créée. Ajoute ses événements et ses organisateurs.')
    reload()
  }
  return (
    <section className="panel">
      <h2>Organisations</h2>
      <p className="small muted">Prépare une organisation et ses événements pour un organisateur, puis rattache-le avec son e-mail. S'il n'a pas encore de compte, il est rattaché automatiquement à sa première connexion.</p>
      <form className="row" style={{ flexWrap: 'wrap' }} onSubmit={create}>
        <label htmlFor="ao" className="sr-only">Nom de la nouvelle organisation</label>
        <input id="ao" className="input" style={{ flex: '1 1 260px' }} required placeholder="Nom de la nouvelle organisation" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn primary" disabled={!name.trim()}>Créer l'organisation</button>
      </form>
      {orgs.map((o) => (
        <OrgCard key={o.id} org={o} events={events.filter((e) => e.org_id === o.id)} open={open === o.id} onToggle={() => setOpen(open === o.id ? null : o.id)} reload={reload} />
      ))}
      {!orgs.length && <p className="small muted">Aucune organisation pour l'instant.</p>}
    </section>
  )
}

function OrgCard({ org, events, open, onToggle, reload }: { org: { id: string; name: string }; events: EventRow[]; open: boolean; onToggle: () => void; reload: () => void }) {
  const notify = useToast()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const { data: members, reload: reloadMembers } = usePoll(async () => {
    if (!open) return null
    const { data, error } = await supabase.rpc('admin_org_members', { p_org: org.id })
    if (error) throw error
    return data as { email: string; status: string }[]
  }, 30000, [open, org.id])
  const add = async (e: FormEvent) => {
    e.preventDefault()
    const { data, error } = await supabase.rpc('admin_add_member', { p_org: org.id, p_email: email })
    if (error) { notify(`Erreur : ${error.message}`); return }
    notify(data === 'ajouté' ? `${email} a maintenant accès à ${org.name}.` : `${email} n'a pas encore de compte : il aura accès dès qu'il le créera avec cette adresse.`)
    setEmail('')
    reloadMembers()
  }
  const remove = async (m: string) => {
    if (!window.confirm(`Retirer ${m} de ${org.name} ?`)) return
    await supabase.rpc('admin_remove_member', { p_org: org.id, p_email: m })
    reloadMembers()
  }
  return (
    <div className="card">
      <button type="button" className="row" onClick={onToggle} aria-expanded={open} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }}>
        <span className="card-title grow">{org.name}</span>
        <span className="small muted">{events.length} événement{events.length > 1 ? 's' : ''} · {open ? 'Fermer' : 'Gérer'}</span>
      </button>
      {open && (
        <div className="stack" style={{ gap: 14 }}>
          <div>
            <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>Événements</div>
            {events.map((e) => (
              <div key={e.id} className="row" style={{ borderBottom: '1px solid var(--line)', padding: '8px 0', flexWrap: 'wrap' }}>
                <span className="grow" style={{ fontWeight: 600 }}>{e.name}</span>
                <span className="small muted">{dateFr(e.starts_on)} · {e.practice}</span>
                <button type="button" className="btn" style={{ minHeight: 36 }} onClick={() => nav(`/console/e/${e.id}`)}>Préparer</button>
              </div>
            ))}
            {!events.length && <p className="small muted">Pas encore d'événement.</p>}
            <div style={{ marginTop: 10 }}><NewEvent orgId={org.id} onCreated={(id) => { reload(); nav(`/console/e/${id}`) }} /></div>
          </div>
          <div>
            <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>Organisateurs</div>
            {(members ?? []).map((m) => (
              <div key={m.email} className="row" style={{ borderBottom: '1px solid var(--line)', padding: '6px 0' }}>
                <span className="grow">{m.email}</span>
                <span className={`tag ${m.status === 'membre' ? 'lu' : 'relance'}`}>{m.status === 'membre' ? 'A accès' : 'Invité, pas encore de compte'}</span>
                <button type="button" className="btn" style={{ minHeight: 36 }} onClick={() => remove(m.email)}>Retirer</button>
              </div>
            ))}
            {members && !members.length && <p className="small muted">Aucun organisateur rattaché.</p>}
            <form className="row" style={{ flexWrap: 'wrap', marginTop: 8 }} onSubmit={add}>
              <label htmlFor={`m-${org.id}`} className="sr-only">E-mail de l'organisateur</label>
              <input id={`m-${org.id}`} type="email" className="input" style={{ flex: '1 1 240px' }} required placeholder="E-mail de l'organisateur" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button type="submit" className="btn">Donner l'accès</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
