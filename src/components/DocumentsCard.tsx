import { supabase } from '../lib/supabase'
import { usePoll } from '../lib/util'
import { saveBase64 } from '../lib/native'
import type { EventDoc } from '../lib/types'
import { useToast } from './ui'

export function sizeLabel(n: number) {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(n / 1000))} ko`
}

// Documents de l'événement vus côté participant ou bénévole : la liste, puis un bouton pour ouvrir ou enregistrer le fichier.
export function DocumentsCard({ code }: { code: string }) {
  const notify = useToast()
  const { data } = usePoll(async () => {
    const { data, error } = await supabase.rpc('code_documents', { p_code: code })
    if (error) throw error
    return data as EventDoc[] | null
  }, 60000, [code])
  if (!data || data.length === 0) return null
  const open = async (d: EventDoc) => {
    const { data: f, error } = await supabase.rpc('code_document_file', { p_code: code, p_doc: d.id })
    if (error || !f) { notify('Téléchargement impossible pour le moment.'); return }
    try { await saveBase64(f.file_name, f.data, f.mime) } catch { notify('Impossible d’enregistrer le fichier.') }
  }
  return (
    <div className="card" style={{ gap: 10 }}>
      <div className="label-up">Documents</div>
      {data.map((d) => (
        <div key={d.id} className="row" style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          <div className="grow">
            <div style={{ fontWeight: 700 }}>{d.title}</div>
            <div className="small muted">{d.kind} · {sizeLabel(d.size_bytes)}</div>
          </div>
          <button type="button" className="btn" onClick={() => open(d)}>Ouvrir</button>
        </div>
      ))}
    </div>
  )
}
