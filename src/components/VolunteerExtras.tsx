import { supabase } from '../lib/supabase'
import { dateFr, usePoll } from '../lib/util'
import type { VolunteerExtras } from '../lib/types'
import { useToast } from './ui'

export function useExtras(code: string) {
  return usePoll(async () => {
    const { data, error } = await supabase.rpc('volunteer_extras', { p_code: code })
    if (error) throw error
    return data as VolunteerExtras | null
  }, 30000, [code])
}

// Contacts utiles de l'événement, avec bouton d'appel.
export function ContactsCard({ x }: { x: VolunteerExtras }) {
  if (!x.contacts.length) return null
  return (
    <section className="card">
      <div className="label-up">Contacts de l'événement</div>
      {x.contacts.map((c) => (
        <div key={c.id} className="row" style={{ borderTop: '1px solid var(--line)', paddingTop: 10, flexWrap: 'wrap' }}>
          <div className="grow" style={{ minWidth: 160 }}>
            <div style={{ fontWeight: 700 }}>{c.role}</div>
            <div className="small muted">{[c.name, c.phone].filter(Boolean).join(' · ')}{c.note ? ` · ${c.note}` : ''}</div>
          </div>
          {c.phone && <a className="btn" href={`tel:${c.phone.replace(/\s/g, '')}`} aria-label={`Appeler ${c.role}`}>Appeler</a>}
          {!c.phone && c.email && <a className="btn" href={`mailto:${c.email}`}>E-mail</a>}
        </div>
      ))}
    </section>
  )
}

// Dotation du bénévole : articles, choix de taille jusqu'à la date limite, statut remis / rendu.
export function DotationCard({ x, code, reload }: { x: VolunteerExtras; code: string; reload: () => void }) {
  const notify = useToast()
  if (!x.dotation.length) return null
  const sized = x.dotation.filter((d) => d.sizes.length)
  const missing = sized.filter((d) => !d.size).length
  const setSize = async (item: string, size: string) => {
    const { error } = await supabase.rpc('volunteer_set_size', { p_code: code, p_item: item, p_size: size })
    if (error) { notify(error.message); return }
    notify('Taille enregistrée.')
    reload()
  }
  return (
    <section className="card">
      <div className="card-meta"><span className="label-up">Ma dotation</span>{x.post_packs.length > 0 && <span>{x.post_packs.join(' · ')}</span>}</div>
      {sized.length > 0 && (
        <p className={`small ${missing && x.can_choose ? 'ko' : 'muted'}`} style={{ fontWeight: missing && x.can_choose ? 600 : 400 }}>
          {x.can_choose
            ? `${missing ? `Choisis ta taille pour ${missing} article${missing > 1 ? 's' : ''}` : 'Tes tailles sont enregistrées'}${x.sizes_deadline ? `, modifiable jusqu'au ${dateFr(x.sizes_deadline)} inclus.` : '.'}`
            : `Le choix des tailles est clos depuis le ${dateFr(x.sizes_deadline)}. Pour un changement, contacte l'organisation.`}
        </p>
      )}
      {x.dotation.map((d) => (
        <div key={d.item_id} className="row" style={{ borderTop: '1px solid var(--line)', paddingTop: 10, flexWrap: 'wrap' }}>
          <div className="grow" style={{ minWidth: 150 }}>
            <div style={{ fontWeight: 700 }}>{d.qty > 1 ? `${d.qty} × ` : ''}{d.name}</div>
            <div className="small">
              <span className={`tag ${d.kind === 'pret' ? 'alerte' : 'lu'}`}>{d.kind === 'pret' ? 'Prêt, à rendre' : 'Don'}</span>{' '}
              {d.given_at
                ? <span className="ok">Remis{d.kind === 'pret' ? (d.returned_at ? ' · rendu' : ' · à rendre après la course') : ''}</span>
                : <span className="muted">À récupérer</span>}
            </div>
          </div>
          {d.sizes.length > 0 && (x.can_choose ? (
            <select className="select" aria-label={`Taille pour ${d.name}`} value={d.size ?? ''} onChange={(e) => e.target.value && setSize(d.item_id, e.target.value)} style={{ width: 120, borderColor: d.size ? undefined : 'var(--orange)' }}>
              <option value="">Ma taille…</option>
              {d.sizes.map((s) => <option key={s}>{s}</option>)}
            </select>
          ) : <span className="pill" style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}>Taille : <strong>{d.size ?? '—'}</strong></span>)}
        </div>
      ))}
    </section>
  )
}
