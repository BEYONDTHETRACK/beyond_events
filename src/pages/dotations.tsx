import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { dateFr, download, toCsv, usePoll } from '../lib/util'
import type { DotationItem, DotationPack, PackItem, Post, VolunteerDotationRow } from '../lib/types'
import { ErrorNote, Loading, useToast } from '../components/ui'
import { useEv } from './console'

const SIZE_PRESETS: [string, string[]][] = [
  ['Textile XS → XXL', ['XS', 'S', 'M', 'L', 'XL', 'XXL']],
  ['Textile + 3XL', ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']],
  ['Pointures 36 → 47', ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47']],
  ['Sans taille', []],
]
const parseSizes = (t: string) => t.split(/[,;/]/).map((s) => s.trim()).filter(Boolean)
const kindLabel = (k: string) => (k === 'pret' ? 'Prêt à rendre' : 'Don')

interface Data {
  items: DotationItem[]
  packs: DotationPack[]
  packItems: PackItem[]
  packPosts: { pack_id: string; post_id: string }[]
  packVols: { pack_id: string; volunteer_id: string }[]
  posts: Post[]
  vols: { id: string; name: string; post_id: string | null }[]
  rows: VolunteerDotationRow[]
}

export function useDotationData(eventId: string) {
  return usePoll<Data>(async () => {
    const q = (t: string) => supabase.from(t).select('*').eq('event_id', eventId).range(0, 9999)
    const [items, packs, pi, pp, pv, posts, vols, rows] = await Promise.all([
      supabase.from('dotation_items').select('*').eq('event_id', eventId).order('position').order('name'),
      supabase.from('dotation_packs').select('*').eq('event_id', eventId).order('created_at'),
      q('dotation_pack_items'), q('dotation_pack_posts'), q('dotation_pack_volunteers'),
      supabase.from('posts').select('*').eq('event_id', eventId).order('position').order('name'),
      supabase.from('volunteers').select('id,name,post_id').eq('event_id', eventId).order('name').range(0, 9999),
      supabase.rpc('event_volunteer_dotation', { p_event: eventId }),
    ])
    for (const r of [items, packs, pi, pp, pv, posts, vols, rows]) if (r.error) throw r.error
    return {
      items: items.data as DotationItem[], packs: packs.data as DotationPack[], packItems: pi.data as PackItem[],
      packPosts: pp.data as Data['packPosts'], packVols: pv.data as Data['packVols'], posts: posts.data as Post[],
      vols: vols.data as Data['vols'], rows: rows.data as VolunteerDotationRow[],
    }
  }, 8000, [eventId])
}

export function Dotations() {
  const { ev, reloadEvent } = useEv()
  const notify = useToast()
  const [tab, setTab] = useState<'types' | 'remise' | 'prets' | 'besoins'>('types')
  const { data, error, loading, reload } = useDotationData(ev.id)
  const [deadline, setDeadline] = useState(ev.sizes_deadline ?? '')

  const saveDeadline = async (v: string) => {
    setDeadline(v)
    const { error } = await supabase.from('events').update({ sizes_deadline: v || null }).eq('id', ev.id)
    if (error) { notify(`Erreur : ${error.message}`); return }
    notify(v ? `Les bénévoles peuvent choisir leurs tailles jusqu'au ${dateFr(v)} inclus.` : 'Pas de date limite pour les tailles.')
    reloadEvent()
  }

  if (loading && !data) return <Loading />
  const loans = (data?.rows ?? []).filter((r) => r.kind === 'pret')
  const out = loans.filter((r) => r.given_at && !r.returned_at).length
  const tabs: [typeof tab, string][] = [['types', 'Articles et types'], ['remise', 'Remise par bénévole'], ['prets', `Prêts en cours${out ? ` (${out})` : ''}`], ['besoins', 'Besoins et tailles']]
  return (
    <>
      <div className="page-head">
        <div><h1>Dotations</h1><p>Textile, matériel donné ou prêté aux bénévoles : attribué à tous, par poste ou à la personne.</p></div>
        <div className="field" style={{ minWidth: 240 }}>
          <label htmlFor="dl">Choix des tailles par les bénévoles jusqu'au</label>
          <input id="dl" type="date" className="input" value={deadline} onChange={(e) => saveDeadline(e.target.value)} />
        </div>
      </div>
      <ErrorNote error={error} />
      <div className="chips" role="tablist" aria-label="Sections des dotations">
        {tabs.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className="chip" aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {data && tab === 'types' && <TypesTab data={data} eventId={ev.id} reload={reload} />}
      {data && tab === 'remise' && <RemiseTab data={data} eventId={ev.id} reload={reload} />}
      {data && tab === 'prets' && <PretsTab data={data} eventId={ev.id} reload={reload} />}
      {data && tab === 'besoins' && <BesoinsTab data={data} evName={ev.name} />}
    </>
  )
}

// ---------- Articles et types de dotation ----------
function TypesTab({ data, eventId, reload }: { data: Data; eventId: string; reload: () => void }) {
  const notify = useToast()
  const [f, setF] = useState({ name: '', kind: 'don', sizes: '' })
  const [packName, setPackName] = useState('')
  const addItem = async (e: FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('dotation_items').insert({ event_id: eventId, name: f.name.trim(), kind: f.kind, sizes: parseSizes(f.sizes), position: data.items.length })
    if (error) { notify(`Erreur : ${error.message}`); return }
    setF({ name: '', kind: f.kind, sizes: '' })
    reload()
  }
  const updItem = async (i: DotationItem, patch: Partial<DotationItem>) => {
    const { error } = await supabase.from('dotation_items').update(patch).eq('id', i.id)
    if (error) notify(`Erreur : ${error.message}`)
    reload()
  }
  const delItem = async (i: DotationItem) => {
    if (!window.confirm(`Supprimer l'article « ${i.name} » ? Il disparaît aussi des types de dotation et du suivi.`)) return
    await supabase.from('dotation_items').delete().eq('id', i.id)
    reload()
  }
  const addPack = async (e: FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('dotation_packs').insert({ event_id: eventId, name: packName.trim() })
    if (error) { notify(`Erreur : ${error.message}`); return }
    setPackName('')
    reload()
  }
  return (
    <>
      <section className="panel">
        <h2>Articles</h2>
        <form className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }} onSubmit={addItem}>
          <div className="field" style={{ flex: '1 1 200px' }}><label htmlFor="in">Article</label><input id="in" className="input" required placeholder="Ex. : T-shirt bénévole, talkie-walkie, tracker GPS" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="field" style={{ width: 170 }}><label htmlFor="ik">Type</label><select id="ik" className="select" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="don">Don</option><option value="pret">Prêt à rendre</option></select></div>
          <div className="field" style={{ flex: '1 1 220px' }}><label htmlFor="is">Tailles (vide = sans taille)</label><input id="is" className="input" placeholder="S, M, L, XL" value={f.sizes} onChange={(e) => setF({ ...f, sizes: e.target.value })} /></div>
          <button type="submit" className="btn primary">Ajouter</button>
        </form>
        <div className="chips">{SIZE_PRESETS.map(([l, s]) => <button key={l} type="button" className="chip" onClick={() => setF({ ...f, sizes: s.join(', ') })}>{l}</button>)}</div>
        <div className="table-wrap">
          <table className="t" style={{ minWidth: 640 }}>
            <thead><tr><th>Article</th><th>Type</th><th>Tailles proposées</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {data.items.map((i) => (
                <tr key={i.id}>
                  <td><input className="input" aria-label="Nom de l'article" defaultValue={i.name} style={{ minHeight: 36 }} onBlur={(e) => e.target.value.trim() && e.target.value !== i.name && updItem(i, { name: e.target.value.trim() })} /></td>
                  <td><select className="select" aria-label={`Type de ${i.name}`} value={i.kind} style={{ minHeight: 36 }} onChange={(e) => updItem(i, { kind: e.target.value as DotationItem['kind'] })}><option value="don">Don</option><option value="pret">Prêt à rendre</option></select></td>
                  <td><input className="input" aria-label={`Tailles de ${i.name}`} defaultValue={i.sizes.join(', ')} placeholder="Sans taille" style={{ minHeight: 36 }} onBlur={(e) => e.target.value !== i.sizes.join(', ') && updItem(i, { sizes: parseSizes(e.target.value) })} /></td>
                  <td><button type="button" className="btn" style={{ minHeight: 36 }} onClick={() => delItem(i)}>Supprimer</button></td>
                </tr>
              ))}
              {!data.items.length && <tr><td colSpan={4} className="muted">Aucun article. Ajoute le textile (dons) et le matériel prêté (talkies, trackers…).</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h2>Types de dotation</h2>
        <p className="small muted">Un type regroupe des articles (ex. « Standard » : t-shirt + gilet ; « Haute montagne » : bonnet + gants). Attribue-le à tous les bénévoles, à un ou plusieurs postes, ou à des bénévoles précis. Un bénévole reçoit tous les types qui le concernent.</p>
        <form className="row" style={{ flexWrap: 'wrap' }} onSubmit={addPack}>
          <label htmlFor="pn" className="sr-only">Nom du type de dotation</label>
          <input id="pn" className="input" style={{ flex: '1 1 240px' }} required placeholder="Nom du type, ex. : Haute montagne" value={packName} onChange={(e) => setPackName(e.target.value)} />
          <button type="submit" className="btn">Créer le type</button>
        </form>
        {data.packs.map((p) => <PackCard key={p.id} pack={p} data={data} eventId={eventId} reload={reload} />)}
        {!data.packs.length && <p className="small muted">Aucun type de dotation pour l'instant.</p>}
      </section>
    </>
  )
}

function PackCard({ pack, data, eventId, reload }: { pack: DotationPack; data: Data; eventId: string; reload: () => void }) {
  const notify = useToast()
  const items = data.packItems.filter((x) => x.pack_id === pack.id)
  const posts = new Set(data.packPosts.filter((x) => x.pack_id === pack.id).map((x) => x.post_id))
  const vols = data.packVols.filter((x) => x.pack_id === pack.id).map((x) => x.volunteer_id)
  const [addItem, setAddItem] = useState('')
  const [addVol, setAddVol] = useState('')
  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await p
    if (error) notify(`Erreur : ${error.message}`)
    reload()
  }
  const togglePost = (id: string) => run(posts.has(id)
    ? supabase.from('dotation_pack_posts').delete().eq('pack_id', pack.id).eq('post_id', id)
    : supabase.from('dotation_pack_posts').insert({ pack_id: pack.id, post_id: id, event_id: eventId }))
  const remove = async () => {
    if (!window.confirm(`Supprimer le type « ${pack.name} » ? Les bénévoles concernés ne recevront plus ces articles.`)) return
    run(supabase.from('dotation_packs').delete().eq('id', pack.id))
  }
  const covered = new Set(data.vols.filter((v) => pack.for_all || (v.post_id && posts.has(v.post_id)) || vols.includes(v.id)).map((v) => v.id))
  return (
    <div className="card" style={{ gap: 12 }}>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <input className="input card-title" aria-label="Nom du type" defaultValue={pack.name} style={{ flex: '1 1 220px', minHeight: 40 }} onBlur={(e) => e.target.value.trim() && e.target.value !== pack.name && run(supabase.from('dotation_packs').update({ name: e.target.value.trim() }).eq('id', pack.id))} />
        <span className="pill" style={{ background: 'var(--cyan-soft)', color: 'var(--cyan-ink)' }}>{covered.size} bénévole{covered.size > 1 ? 's' : ''}</span>
        <button type="button" className="btn" onClick={remove}>Supprimer</button>
      </div>
      <div>
        <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>Contenu</div>
        {items.map((pi) => {
          const it = data.items.find((i) => i.id === pi.item_id)
          if (!it) return null
          return (
            <div key={pi.item_id} className="row" style={{ padding: '4px 0' }}>
              <span className="grow">{it.name} <span className={`tag ${it.kind === 'pret' ? 'alerte' : 'lu'}`} style={{ marginLeft: 6 }}>{kindLabel(it.kind)}</span></span>
              <label className="small muted" htmlFor={`q-${pack.id}-${it.id}`}>Qté</label>
              <input id={`q-${pack.id}-${it.id}`} type="number" min={1} className="input" style={{ width: 70, minHeight: 36 }} defaultValue={pi.qty} onBlur={(e) => Number(e.target.value) !== pi.qty && Number(e.target.value) > 0 && run(supabase.from('dotation_pack_items').update({ qty: Number(e.target.value) }).eq('pack_id', pack.id).eq('item_id', it.id))} />
              <button type="button" className="btn" style={{ minHeight: 36 }} aria-label={`Retirer ${it.name}`} onClick={() => run(supabase.from('dotation_pack_items').delete().eq('pack_id', pack.id).eq('item_id', it.id))}>Retirer</button>
            </div>
          )
        })}
        <div className="row" style={{ marginTop: 6 }}>
          <select className="select" aria-label="Ajouter un article" value={addItem} onChange={(e) => setAddItem(e.target.value)} style={{ maxWidth: 320 }}>
            <option value="">Ajouter un article…</option>
            {data.items.filter((i) => !items.some((x) => x.item_id === i.id)).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <button type="button" className="btn" disabled={!addItem} onClick={() => { run(supabase.from('dotation_pack_items').insert({ pack_id: pack.id, item_id: addItem, event_id: eventId, qty: 1 })); setAddItem('') }}>Ajouter</button>
        </div>
      </div>
      <div>
        <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>Pour qui</div>
        <label className="check"><input type="checkbox" checked={pack.for_all} onChange={(e) => run(supabase.from('dotation_packs').update({ for_all: e.target.checked }).eq('id', pack.id))} /> Tous les bénévoles de l'événement</label>
        {!pack.for_all && (
          <>
            <div className="small muted" style={{ margin: '8px 0 4px' }}>Postes (un ou plusieurs)</div>
            <div className="chips">
              {data.posts.map((p) => <button key={p.id} type="button" className="chip green" aria-pressed={posts.has(p.id)} onClick={() => togglePost(p.id)}>{p.name}</button>)}
              {!data.posts.length && <span className="small muted">Aucun poste créé.</span>}
            </div>
            <div className="small muted" style={{ margin: '10px 0 4px' }}>Bénévoles précis</div>
            <div className="chips">
              {vols.map((id) => {
                const v = data.vols.find((x) => x.id === id)
                return <button key={id} type="button" className="chip" aria-pressed="true" aria-label={`Retirer ${v?.name}`} onClick={() => run(supabase.from('dotation_pack_volunteers').delete().eq('pack_id', pack.id).eq('volunteer_id', id))}>{v?.name ?? '?'} ✕</button>
              })}
            </div>
            <div className="row" style={{ marginTop: 6 }}>
              <select className="select" aria-label="Ajouter un bénévole" value={addVol} onChange={(e) => setAddVol(e.target.value)} style={{ maxWidth: 320 }}>
                <option value="">Ajouter un bénévole…</option>
                {data.vols.filter((v) => !vols.includes(v.id)).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <button type="button" className="btn" disabled={!addVol} onClick={() => { run(supabase.from('dotation_pack_volunteers').insert({ pack_id: pack.id, volunteer_id: addVol, event_id: eventId })); setAddVol('') }}>Ajouter</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ---------- Remise par bénévole ----------
async function setTrack(row: { volunteer_id: string; item_id: string }, eventId: string, patch: Record<string, unknown>) {
  return supabase.from('volunteer_dotation').upsert({ volunteer_id: row.volunteer_id, item_id: row.item_id, event_id: eventId, ...patch }, { onConflict: 'volunteer_id,item_id' })
}

function RemiseTab({ data, eventId, reload }: { data: Data; eventId: string; reload: () => void }) {
  const notify = useToast()
  const [q, setQ] = useState('')
  const [post, setPost] = useState('')
  const groups = useMemo(() => {
    const m = new Map<string, VolunteerDotationRow[]>()
    for (const r of data.rows) m.set(r.volunteer_id, [...(m.get(r.volunteer_id) ?? []), r])
    return [...m.values()]
  }, [data.rows])
  const shown = groups.filter((g) => g[0].volunteer_name.toLowerCase().includes(q.toLowerCase()) && (!post || g[0].post_name === post))
  const upd = async (r: VolunteerDotationRow, patch: Record<string, unknown>) => {
    const { error } = await setTrack(r, eventId, patch)
    if (error) notify(`Erreur : ${error.message}`)
    reload()
  }
  const giveAll = async (g: VolunteerDotationRow[]) => {
    const now = new Date().toISOString()
    const { error } = await supabase.from('volunteer_dotation').upsert(g.filter((r) => !r.given_at).map((r) => ({ volunteer_id: r.volunteer_id, item_id: r.item_id, event_id: eventId, given_at: now })), { onConflict: 'volunteer_id,item_id' })
    if (error) notify(`Erreur : ${error.message}`)
    reload()
  }
  const exportCsv = () => {
    download('remise_dotations.csv', toCsv([['Bénévole', 'Poste', 'Article', 'Type', 'Quantité', 'Taille', 'Remis', 'Rendu'],
      ...data.rows.map((r) => [r.volunteer_name, r.post_name ?? '', r.item_name, kindLabel(r.kind), r.qty, r.size ?? '', r.given_at ? 'oui' : '', r.kind === 'pret' ? (r.returned_at ? 'oui' : '') : '—'])]))
  }
  return (
    <section className="panel">
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <label htmlFor="rq" className="sr-only">Rechercher un bénévole</label>
        <input id="rq" className="input" style={{ flex: '1 1 220px' }} placeholder="Rechercher un bénévole" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" aria-label="Filtrer par poste" value={post} onChange={(e) => setPost(e.target.value)} style={{ maxWidth: 260 }}>
          <option value="">Tous les postes</option>
          {data.posts.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
        <button type="button" className="btn" disabled={!data.rows.length} onClick={exportCsv}>Exporter (CSV)</button>
      </div>
      {!groups.length && <p className="small muted">Aucune dotation attribuée. Crée des articles et des types de dotation, puis attribue-les.</p>}
      {shown.map((g) => (
        <div key={g[0].volunteer_id} className="card" style={{ gap: 6 }}>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <div className="grow"><strong>{g[0].volunteer_name}</strong> <span className="small muted">· {g[0].post_name ?? 'Non affecté'}</span></div>
            {g.some((r) => !r.given_at) ? <button type="button" className="btn" style={{ minHeight: 36 }} onClick={() => giveAll(g)}>Tout marquer remis</button> : <span className="tag lu">Tout remis</span>}
          </div>
          {g.map((r) => (
            <div key={r.item_id} className="row" style={{ flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 6 }}>
              <span className="grow">{r.qty > 1 ? `${r.qty} × ` : ''}{r.item_name} <span className="small muted">({r.packs})</span></span>
              {r.sizes.length > 0 && (
                <select className="select" aria-label={`Taille ${r.item_name} pour ${r.volunteer_name}`} value={r.size ?? ''} style={{ minHeight: 36, width: 110 }} onChange={(e) => upd(r, { size: e.target.value || null })}>
                  <option value="">Taille ?</option>{r.sizes.map((s) => <option key={s}>{s}</option>)}
                </select>
              )}
              <label className="check small"><input type="checkbox" checked={!!r.given_at} onChange={(e) => upd(r, { given_at: e.target.checked ? new Date().toISOString() : null, ...(e.target.checked ? {} : { returned_at: null }) })} /> Remis</label>
              {r.kind === 'pret' && <label className="check small"><input type="checkbox" checked={!!r.returned_at} disabled={!r.given_at} onChange={(e) => upd(r, { returned_at: e.target.checked ? new Date().toISOString() : null })} /> Rendu</label>}
            </div>
          ))}
        </div>
      ))}
    </section>
  )
}

// ---------- Prêts en cours ----------
function PretsTab({ data, eventId, reload }: { data: Data; eventId: string; reload: () => void }) {
  const notify = useToast()
  const loans = data.rows.filter((r) => r.kind === 'pret')
  const out = loans.filter((r) => r.given_at && !r.returned_at)
  const notGiven = loans.filter((r) => !r.given_at)
  const back = loans.filter((r) => r.returned_at)
  const markBack = async (r: VolunteerDotationRow) => {
    const { error } = await setTrack(r, eventId, { returned_at: new Date().toISOString() })
    if (error) notify(`Erreur : ${error.message}`)
    reload()
  }
  const table = (rows: VolunteerDotationRow[], action: boolean) => (
    <div className="table-wrap">
      <table className="t" style={{ minWidth: 560 }}>
        <thead><tr><th>Matériel</th><th>Bénévole</th><th>Poste</th><th>{action ? 'Sorti' : 'Statut'}</th>{action && <th><span className="sr-only">Action</span></th>}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.volunteer_id}-${r.item_id}`}>
              <td style={{ fontWeight: 600 }}>{r.qty > 1 ? `${r.qty} × ` : ''}{r.item_name}</td><td>{r.volunteer_name}</td><td className="muted">{r.post_name ?? '—'}</td>
              <td className="muted small">{action ? dateTime(r.given_at) : r.returned_at ? `Rendu ${dateTime(r.returned_at)}` : 'À remettre'}</td>
              {action && <td><button type="button" className="btn" style={{ minHeight: 36 }} onClick={() => markBack(r)}>Marquer rendu</button></td>}
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={action ? 5 : 4} className="muted">Rien ici.</td></tr>}
        </tbody>
      </table>
    </div>
  )
  return (
    <>
      <div className="kpis">
        <div className="kpi"><div className="k-label">Sortis, pas encore rendus</div><div className={`k-value ${out.length ? 'ko' : ''}`}>{out.length}</div></div>
        <div className="kpi"><div className="k-label">À remettre</div><div className="k-value">{notGiven.length}</div></div>
        <div className="kpi"><div className="k-label">Rendus</div><div className="k-value ok">{back.length}</div></div>
      </div>
      <section className="panel"><h2>Sortis, pas encore rendus</h2>{table(out, true)}</section>
      <section className="panel"><h2>À remettre</h2>{table(notGiven, false)}</section>
      {back.length > 0 && <section className="panel"><h2>Rendus</h2>{table(back, false)}</section>}
    </>
  )
}
const dateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')

// ---------- Besoins et tailles ----------
function BesoinsTab({ data, evName }: { data: Data; evName: string }) {
  const lines = data.items.map((i) => {
    const rows = data.rows.filter((r) => r.item_id === i.id)
    const total = rows.reduce((s, r) => s + r.qty, 0)
    const bySize = new Map<string, number>()
    for (const r of rows) if (i.sizes.length) bySize.set(r.size ?? '?', (bySize.get(r.size ?? '?') ?? 0) + r.qty)
    return { i, total, given: rows.filter((r) => r.given_at).reduce((s, r) => s + r.qty, 0), bySize }
  })
  const exportCsv = () => {
    const out: (string | number)[][] = [['Article', 'Type', 'Taille', 'Quantité']]
    for (const l of lines) {
      if (!l.i.sizes.length) out.push([l.i.name, kindLabel(l.i.kind), '', l.total])
      else for (const s of [...l.i.sizes, '?']) if (l.bySize.get(s)) out.push([l.i.name, kindLabel(l.i.kind), s === '?' ? 'non choisie' : s, l.bySize.get(s)!])
    }
    download(`${evName.replace(/[^\w-]+/g, '_')}_besoins_dotations.csv`, toCsv(out))
  }
  return (
    <section className="panel">
      <div className="row"><h2 className="grow">Besoins par article</h2><button type="button" className="btn" onClick={exportCsv}>Exporter pour la commande (CSV)</button></div>
      <p className="small muted">Quantités à prévoir d'après les types de dotation attribués et les tailles choisies par les bénévoles.</p>
      <div className="table-wrap">
        <table className="t" style={{ minWidth: 620 }}>
          <thead><tr><th>Article</th><th>Type</th><th>Total</th><th>Par taille</th><th>Remis</th></tr></thead>
          <tbody>
            {lines.map(({ i, total, given, bySize }) => (
              <tr key={i.id}>
                <td style={{ fontWeight: 600 }}>{i.name}</td>
                <td className="muted">{kindLabel(i.kind)}</td>
                <td style={{ fontWeight: 700 }}>{total}</td>
                <td>{i.sizes.length ? (
                  <div className="chips">
                    {i.sizes.filter((s) => bySize.get(s)).map((s) => <span key={s} className="pill" style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}>{s} : <strong>{bySize.get(s)}</strong></span>)}
                    {bySize.get('?') ? <span className="pill" style={{ background: 'var(--orange-soft)', color: 'var(--orange-ink)' }}>Non choisie : <strong>{bySize.get('?')}</strong></span> : null}
                  </div>
                ) : <span className="muted">—</span>}</td>
                <td className={given === total && total ? 'ok' : 'muted'}>{given} / {total}</td>
              </tr>
            ))}
            {!lines.length && <tr><td colSpan={5} className="muted">Aucun article.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}
