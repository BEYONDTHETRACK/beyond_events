import { useEffect, useId, useRef, useState } from 'react'

// Champ « Lieu » avec suggestions de villes françaises issues d'OpenStreetMap (géocodeur Photon de komoot).
interface Place { label: string; name: string; detail: string }

const URL = 'https://photon.komoot.io/api/'

async function search(q: string, signal: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({ q, lang: 'fr', limit: '15' })
  for (const t of ['place:city', 'place:town', 'place:village', 'place:hamlet']) params.append('osm_tag', t)
  // France métropolitaine et Corse
  params.set('bbox', '-5.3,41.3,9.7,51.2')
  const res = await fetch(`${URL}?${params}`, { signal })
  if (!res.ok) return []
  const json = await res.json()
  const seen = new Set<string>()
  const out: Place[] = []
  for (const f of json.features ?? []) {
    const p = f.properties ?? {}
    if (p.countrycode && p.countrycode !== 'FR') continue
    const dep = p.county || p.state || ''
    const cp = p.postcode ? String(p.postcode).split(';')[0] : ''
    const label = dep ? `${p.name} (${dep})` : p.name
    if (!p.name || seen.has(label)) continue
    seen.add(label)
    out.push({ label, name: p.name, detail: [cp, dep, p.state && p.state !== dep ? p.state : ''].filter(Boolean).join(' · ') })
    if (out.length >= 8) break
  }
  return out
}

export function PlaceInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const [items, setItems] = useState<Place[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [typed, setTyped] = useState(false)
  const listId = useId()
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!typed || value.trim().length < 2) { setItems([]); return }
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      search(value.trim(), ctrl.signal).then((r) => { setItems(r); setOpen(true); setActive(-1) }).catch(() => {})
    }, 250)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [value, typed])

  useEffect(() => {
    const close = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const pick = (p: Place) => { onChange(p.label); setOpen(false); setTyped(false); setItems([]) }
  const show = open && items.length > 0

  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <input
        id={id} className="input" autoComplete="off" placeholder="Commence à taper une ville"
        role="combobox" aria-expanded={show} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={show && active >= 0 ? `${listId}-${active}` : undefined}
        value={value}
        onChange={(e) => { onChange(e.target.value); setTyped(true) }}
        onFocus={() => items.length && setOpen(true)}
        onKeyDown={(e) => {
          if (!show) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
          else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(items[active]) }
          else if (e.key === 'Escape') setOpen(false)
        }}
      />
      {show && (
        <ul id={listId} role="listbox" className="place-list">
          {items.map((p, i) => (
            <li key={p.label} id={`${listId}-${i}`} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(p) }} onMouseEnter={() => setActive(i)}>
              <strong>{p.name}</strong><span>{p.detail}</span>
            </li>
          ))}
          <li className="place-credit" aria-hidden="true">Données © les contributeurs d'OpenStreetMap</li>
        </ul>
      )}
    </div>
  )
}
