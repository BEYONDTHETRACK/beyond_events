import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { dateTimeFr, usePoll } from '../lib/util'
import { DOC_KINDS } from '../lib/types'
import type { DocAudience, EventDoc } from '../lib/types'
import { ErrorNote, Loading, useToast } from '../components/ui'
import { sizeLabel } from '../components/DocumentsCard'
import { useEv } from './console'

const MAX = 8_000_000
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.doc,.docx,.xls,.xlsx,.csv'
const AUD: Record<DocAudience, string> = { tous: 'Participant·es et bénévoles', participants: 'Participant·es', benevoles: 'Bénévoles' }

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

// Envoi des documents de l'épreuve : l'organisation dépose un fichier, les personnes concernées le retrouvent dans l'app.
export function Documents() {
  const { ev } = useEv()
  const notify = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<string>(DOC_KINDS[0])
  const [title, setTitle] = useState('')
  const [audience, setAudience] = useState<DocAudience>('tous')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const { data, error, loading, reload } = usePoll(async () => {
    const { data, error } = await supabase.from('event_documents').select('id,kind,title,file_name,mime,size_bytes,audience,created_at').eq('event_id', ev.id).order('position').order('created_at')
    if (error) throw error
    return data as EventDoc[]
  }, 30000, [ev.id])

  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (!file) return
    if (file.size > MAX) { notify('Fichier trop lourd (8 Mo maximum).'); return }
    setBusy(true)
    try {
      const label = title.trim() || kind
      const { data: d, error } = await supabase.from('event_documents').insert({
        event_id: ev.id, kind, title: label, file_name: file.name, mime: file.type || 'application/octet-stream',
        size_bytes: file.size, audience, position: data?.length ?? 0,
      }).select('id').single()
      if (error) throw error
      const { error: e2 } = await supabase.from('event_document_files').insert({ document_id: d.id, data: await toBase64(file) })
      if (e2) {
        await supabase.from('event_documents').delete().eq('id', d.id)
        throw e2
      }
      notify(`« ${label} » est disponible dans l'app.`)
      setTitle('')
      setFile(null)
      if (input.current) input.current.value = ''
      reload()
    } catch (err) {
      notify(`Erreur : ${err instanceof Error ? err.message : 'envoi impossible'}`)
    }
    setBusy(false)
  }
  const remove = async (d: EventDoc) => {
    if (!window.confirm(`Retirer « ${d.title} » ? Il disparaît de l'app.`)) return
    await supabase.from('event_documents').delete().eq('id', d.id)
    reload()
  }

  return (
    <>
      <div className="page-head"><div><h1>Documents</h1><p>Road book, règlement, plans… Dépose un fichier : il apparaît aussitôt dans l'app, chez les participant·es et/ou les bénévoles que tu choisis.</p></div></div>
      <ErrorNote error={error} />
      <form className="panel" onSubmit={send} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <h2 style={{ gridColumn: '1 / -1' }}>Ajouter un document</h2>
        <div className="field">
          <label htmlFor="dk">Type</label>
          <select id="dk" className="input" value={kind} onChange={(e) => setKind(e.target.value)}>{DOC_KINDS.map((k) => <option key={k}>{k}</option>)}</select>
        </div>
        <div className="field"><label htmlFor="dt">Titre affiché</label><input id="dt" className="input" placeholder={kind} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="field">
          <label htmlFor="da">Visible par</label>
          <select id="da" className="input" value={audience} onChange={(e) => setAudience(e.target.value as DocAudience)}>
            {(Object.keys(AUD) as DocAudience[]).map((a) => <option key={a} value={a}>{AUD[a]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="df">Fichier (8 Mo max)</label>
          <input id="df" ref={input} type="file" className="input" accept={ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}><button type="submit" className="btn primary" disabled={busy || !file}>{busy ? 'Envoi…' : 'Mettre à disposition'}</button></div>
      </form>
      {loading && !data && <Loading />}
      {data && data.length === 0 && <p className="muted">Aucun document pour l'instant.</p>}
      {data && data.length > 0 && (
        <div className="panel table-wrap" style={{ padding: 0 }}>
          <table className="t">
            <thead><tr><th>Document</th><th>Type</th><th>Visible par</th><th>Taille</th><th>Ajouté</th><th /></tr></thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.id}>
                  <td><strong>{d.title}</strong><div className="small muted">{d.file_name}</div></td>
                  <td>{d.kind}</td>
                  <td>{AUD[d.audience ?? 'tous']}</td>
                  <td>{sizeLabel(d.size_bytes)}</td>
                  <td>{dateTimeFr(d.created_at)}</td>
                  <td><button type="button" className="btn" onClick={() => remove(d)}>Retirer</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
