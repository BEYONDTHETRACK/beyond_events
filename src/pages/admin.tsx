import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { dateFr, usePoll } from '../lib/util'
import type { EventRow } from '../lib/types'
import { ErrorNote, Loading, useToast } from '../components/ui'
import { useAuth } from './auth'
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
                        <td>{e.published && <button type="button" className="btn" style={{ minHeight: 36 }} onClick={() => publish(e, false)}>Dépublier</button>}</td>
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
