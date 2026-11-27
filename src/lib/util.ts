import { saveFile } from './native'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CodeSession } from './types'

// ---------- Session par code (participant ou bénévole), gardée sur l'appareil ----------
const KEY = 'be.codeSession'

export function getCodeSession(): CodeSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as CodeSession) : null
  } catch {
    return null
  }
}
export function setCodeSession(s: CodeSession | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s))
    else localStorage.removeItem(KEY)
  } catch {
    /* stockage indisponible */
  }
}

// ---------- Rafraîchissement régulier (en attendant le temps réel) ----------
export function usePoll<T>(fn: () => Promise<T>, ms = 5000, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const fnRef = useRef(fn)
  fnRef.current = fn
  const reload = useCallback(async () => {
    try {
      const d = await fnRef.current()
      setData(d)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    setLoading(true)
    reload()
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') reload()
    }, ms)
    const onVis = () => document.visibilityState === 'visible' && reload()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return { data, error, loading, reload, setData }
}

// ---------- Dates ----------
export function ago(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  const s = Math.round((Date.now() - d.getTime()) / 1000)
  if (s < 60) return "à l'instant"
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`
  if (s < 86400 && d.getDate() === new Date().getDate()) return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`
  if (s < 7 * 86400) return `il y a ${Math.round(s / 86400)} j`
  return d.toLocaleDateString('fr-FR')
}
export function dateFr(iso: string | null | undefined) {
  if (!iso) return 'Date à venir'
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}
export function pct(a: number, b: number) {
  return b ? Math.round((a / b) * 100) : 0
}
// Niveau d'un taux de lecture ou de confirmation : vert dès 75 %, jaune de 50 à 74 %, orange en dessous.
export function rateLevel(p: number): 'ok' | 'mid' | 'low' {
  return p >= 75 ? 'ok' : p >= 50 ? 'mid' : 'low'
}

// ---------- CSV ----------
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '')
  const firstLine = clean.split(/\r?\n/)[0] ?? ''
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : firstLine.includes('\t') ? '\t' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (q) {
      if (c === '"' && clean[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === sep) { row.push(cell.trim()); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++
      row.push(cell.trim()); cell = ''
      if (row.some((x) => x !== '')) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell.trim())
  if (row.some((x) => x !== '')) rows.push(row)
  return rows
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '')

// Associe les colonnes d'un fichier aux champs attendus, quel que soit l'ordre ou l'intitulé exact.
export function mapColumns(header: string[], fields: Record<string, string[]>) {
  const out: Record<string, number> = {}
  header.forEach((h, i) => {
    const n = norm(h)
    for (const [field, names] of Object.entries(fields)) {
      if (out[field] === undefined && names.some((x) => n === x || n.startsWith(x))) out[field] = i
    }
  })
  return out
}

export function toCsv(rows: (string | number | null | undefined)[][]) {
  return '﻿' + rows.map((r) => r.map((c) => {
    const s = c === null || c === undefined ? '' : String(c)
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }).join(';')).join('\r\n')
}

export function download(name: string, content: string, type = 'text/csv;charset=utf-8') {
  saveFile(name, content, type).catch(() => {})
}

export function normLang(s: string | undefined): 'FR' | 'EN' | 'ES' {
  const v = (s ?? '').trim().toUpperCase()
  if (v.startsWith('EN') || v.startsWith('ANG')) return 'EN'
  if (v.startsWith('ES') || v.startsWith('SP')) return 'ES'
  return 'FR'
}
