import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { usePoll } from '../lib/util'
import type { EventContact } from '../lib/types'
import { ErrorNote, Loading, useToast } from '../components/ui'
import { useEv } from './console'

export const CONTACT_ROLES = [
  'PC course', 'Responsable bénévoles', 'Responsable sécurité', 'Poste de secours', 'Médecin de course',
  'Directeur de course', 'Responsable logistique', 'Responsable ravitaillements', 'Navette / transport',
]

const empty = { role: CONTACT_ROLES[0], name: '', phone: '', email: '', note: '' }

// Annuaire de l'événement : visible par tous les bénévoles dans leur espace.
export function Contacts() {
  const { ev } = useEv()
  const notify = useToast()
  const [f, setF] = useState(empty)
  const [editing, setEditing] = useState<string | null>(null)
  const { data, error, loading, reload } = usePoll(async () => {
    const { data, error } = await supabase.from('event_contacts').select('*').eq('event_id', ev.id).order('position').order('role')
    if (error) throw error
    return data as EventContact[]
  }, 30000, [ev.id])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const row = { role: f.role.trim(), name: f.name.trim(), phone: f.phone.trim() || null, email: f.email.trim() || null, note: f.note.trim() }
    const { error } = editing
      ? await supabase.from('event_contacts').update(row).eq('id', editing)
      : await supabase.from('event_contacts').insert({ ...row, event_id: ev.id, position: data?.length ?? 0 })
    if (error) { notify(`Erreur : ${error.message}`); return }
    setF(empty)
    setEditing(null)
    reload()
  }
  const edit = (c: EventContact) => {
    setEditing(c.id)
    setF({ role: c.role, name: c.name, phone: c.phone ?? '', email: c.email ?? '', note: c.note })
  }
  const remove = async (c: EventContact) => {
    if (!window.confirm(`Retirer « ${c.role} » des contacts ?`)) return
    await supabase.from('event_contacts').delete().eq('id', c.id)
    reload()
  }
  const moveUp = async (c: EventContact, i: number) => {
    if (!data || i === 0) return
    const prev = data[i - 1]
    await Promise.all([
      supabase.from('event_contacts').update({ position: i - 1 }).eq('id', c.id),
      supabase.from('event_contacts').update({ position: i }).eq('id', prev.id),
    ])
    reload()
  }

  return (
    <>
      <div className="page-head"><div><h1>Contacts</h1><p>Les numéros utiles de l'événement. Chaque bénévole les retrouve dans son espace, avec un bouton pour appeler.</p></div></div>
      <ErrorNote error={error} />
      <form className="panel" onSubmit={save} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        <h2 style={{ gridColumn: '1 / -1' }}>{editing ? 'Modifier le contact' : 'Ajouter un contact'}</h2>
        <div className="field">
          <label htmlFor="cr">Rôle</label>
          <input id="cr" className="input" list="cr-list" required value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} />
          <datalist id="cr-list">{CONTACT_ROLES.map((r) => <option key={r} value={r} />)}</datalist>
        </div>
        <div className="field"><label htmlFor="cn">Nom</label><input id="cn" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="field"><label htmlFor="cp">Téléphone</label><input id="cp" type="tel" className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        <div className="field"><label htmlFor="ce">E-mail</label><input id="ce" type="email" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="field" style={{ gridColumn: '1 / -1' }}><label htmlFor="cnote">Précision (facultatif)</label><input id="cnote" className="input" placeholder="Ex. : joignable de 6 h à 20 h, canal radio 3" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        <div className="row" style={{ gridColumn: '1 / -1' }}>
          <button type="submit" className="btn primary">{editing ? 'Enregistrer' : 'Ajouter le contact'}</button>
          {editing && <button type="button" className="btn" onClick={() => { setEditing(null); setF(empty) }}>Annuler</button>}
        </div>
      </form>
      <section className="panel">
        <h2>Annuaire ({data?.length ?? 0})</h2>
        {loading && !data && <Loading />}
        <div className="table-wrap">
          <table className="t" style={{ minWidth: 640 }}>
            <thead><tr><th>Rôle</th><th>Nom</th><th>Téléphone</th><th>E-mail</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {(data ?? []).map((c, i) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 700 }}>{c.role}{c.note && <div className="small muted" style={{ fontWeight: 400 }}>{c.note}</div>}</td>
                  <td>{c.name || <span className="muted">—</span>}</td>
                  <td>{c.phone ? <a href={`tel:${c.phone.replace(/\s/g, '')}`}>{c.phone}</a> : <span className="muted">—</span>}</td>
                  <td>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : <span className="muted">—</span>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn" style={{ minHeight: 36 }} disabled={i === 0} aria-label={`Monter ${c.role}`} onClick={() => moveUp(c, i)}>↑</button>{' '}
                    <button type="button" className="btn" style={{ minHeight: 36 }} onClick={() => edit(c)}>Modifier</button>{' '}
                    <button type="button" className="btn" style={{ minHeight: 36 }} onClick={() => remove(c)}>Retirer</button>
                  </td>
                </tr>
              ))}
              {data && !data.length && <tr><td colSpan={5} className="muted">Aucun contact. Commence par le PC course et le responsable des bénévoles.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
