import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Brand } from './Logo'

// Protection d'accès pendant la phase de test : un code commun, vérifié par son empreinte SHA-256.
// Ce n'est pas une sécurité forte (le contrôle se fait dans le navigateur) : les données restent protégées par Supabase.
const HASH = import.meta.env.VITE_ACCESS_HASH ?? '6d08e71a535ecb5896a63a1607b10a5c21e289904b7546fa906e804f5c004a07'
const KEY = 'be.access'

async function sha256(t: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function AccessGate({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null)
  const [code, setCode] = useState('')
  const [err, setErr] = useState(false)
  useEffect(() => {
    let v: string | null = null
    try { v = localStorage.getItem(KEY) } catch { /* stockage indisponible */ }
    setOk(v === HASH)
  }, [])
  if (ok === null) return null
  if (ok) return <>{children}</>
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const h = await sha256(code.trim().toUpperCase())
    if (h === HASH) {
      try { localStorage.setItem(KEY, h) } catch { /* rien */ }
      setOk(true)
    } else setErr(true)
  }
  return (
    <div className="login-wrap" style={{ background: 'var(--nuit)' }}>
      <form className="panel login" onSubmit={submit}>
        <Brand on="light" size={26} />
        <h1 style={{ fontSize: 24 }}>Version de test</h1>
        <p className="small muted">Version de test privée. Entre le code d'accès qu'on t'a transmis.</p>
        <div className="field">
          <label htmlFor="gate">Code d'accès</label>
          <input id="gate" className="input code" autoComplete="off" autoCapitalize="characters" required value={code} onChange={(e) => { setCode(e.target.value); setErr(false) }} />
        </div>
        {err && <p className="small ko" role="alert">Code incorrect.</p>}
        <button type="submit" className="btn big primary">Entrer</button>
      </form>
    </div>
  )
}
