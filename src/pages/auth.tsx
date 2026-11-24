import { createContext, useContext, useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { appUrl, supabase } from '../lib/supabase'
import { Brand } from '../components/Logo'

const AuthCtx = createContext<{ session: Session | null; ready: boolean }>({ session: null, ready: false })
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return <AuthCtx.Provider value={{ session, ready }}>{children}</AuthCtx.Provider>
}

export function RequireOrganizer({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth()
  if (!ready) return <p className="muted" style={{ padding: 24 }}>Chargement…</p>
  if (!session) return <Login />
  return <>{children}</>
}

function Login() {
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    if (mode === 'in') {
      // Un identifiant sans @ (ex. « admin ») correspond à un compte interne.
      const login = email.includes('@') ? email.trim() : `${email.trim().toLowerCase()}@beyond-events.local`
      const { error } = await supabase.auth.signInWithPassword({ email: login, password })
      if (error) setMsg({ ok: false, text: error.message === 'Email not confirmed' ? 'Adresse pas encore confirmée : clique sur le lien reçu par e-mail.' : 'E-mail ou mot de passe incorrect.' })
    } else if (mode === 'up') {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: appUrl() } })
      if (error) setMsg({ ok: false, text: error.message })
      else if (!data.session) setMsg({ ok: true, text: 'Compte créé. Confirme ton adresse avec le lien reçu par e-mail, puis connecte-toi.' })
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: appUrl() })
      setMsg(error ? { ok: false, text: error.message } : { ok: true, text: 'Si un compte existe, un e-mail de réinitialisation vient de partir.' })
    }
    setBusy(false)
  }
  return (
    <div className="login-wrap">
      <form className="panel login" onSubmit={submit}>
        <Link to="/" aria-label="Beyond Events, accueil" style={{ textDecoration: 'none' }}><Brand on="light" size={24} /></Link>
        <h1 style={{ fontSize: 28 }}>Console organisateur</h1>
        <div className="chips">
          <button type="button" className="chip green" aria-pressed={mode === 'in'} onClick={() => setMode('in')}>Se connecter</button>
          <button type="button" className="chip green" aria-pressed={mode === 'up'} onClick={() => setMode('up')}>Créer un compte</button>
        </div>
        <div className="field"><label htmlFor="em">{mode === 'in' ? 'E-mail ou identifiant' : 'E-mail'}</label><input id="em" type={mode === 'in' ? 'text' : 'email'} required autoComplete="username" autoCapitalize="none" className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        {mode !== 'reset' && (
          <div className="field"><label htmlFor="pw">Mot de passe</label><input id="pw" type="password" required minLength={mode === 'up' ? 6 : 1} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} className="input" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        )}
        {msg && <p className={`small ${msg.ok ? 'ok' : 'ko'}`} role="status">{msg.text}</p>}
        <button type="submit" className="btn big primary" disabled={busy}>{busy ? '…' : mode === 'in' ? 'Se connecter' : mode === 'up' ? 'Créer mon compte' : 'Envoyer le lien'}</button>
        {mode === 'in' && <button type="button" className="btn" style={{ border: 0 }} onClick={() => setMode('reset')}>Mot de passe oublié ?</button>}
      </form>
    </div>
  )
}

// Après un lien de réinitialisation, Supabase ouvre une session de récupération : on propose un nouveau mot de passe.
export function PasswordRecovery() {
  const [open, setOpen] = useState(false)
  const [pw, setPw] = useState('')
  const [done, setDone] = useState(false)
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((e) => { if (e === 'PASSWORD_RECOVERY') setOpen(true) })
    return () => data.subscription.unsubscribe()
  }, [])
  if (!open) return null
  return (
    <div className="modal">
      <form className="panel login" onSubmit={async (e) => { e.preventDefault(); const { error } = await supabase.auth.updateUser({ password: pw }); if (!error) setDone(true) }}>
        <h2>Nouveau mot de passe</h2>
        {done ? <><p className="ok">Mot de passe changé.</p><button type="button" className="btn primary" onClick={() => setOpen(false)}>Fermer</button></> : (
          <>
            <input type="password" className="input" minLength={6} required value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Nouveau mot de passe" />
            <button type="submit" className="btn primary">Enregistrer</button>
          </>
        )}
      </form>
    </div>
  )
}
