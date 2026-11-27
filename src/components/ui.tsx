import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Brand } from './Logo'

export const Icon = {
  back: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>,
  close: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  key: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3M15 8l2 2" /></svg>,
  send: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>,
  console: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M8 21h8M7 9h4M7 13h7" /></svg>,
  external: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" /></svg>,
}

// ---------- Notifications courtes ----------
const ToastCtx = createContext<(t: string) => void>(() => {})
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const notify = useCallback((t: string) => {
    setToast(t)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(null), 3500)
  }, [])
  return (
    <ToastCtx.Provider value={notify}>
      {children}
      {toast && <div className="toast" role="status">{toast}</div>}
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx)

// ---------- Mise en page mobile ----------
export function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="phone-stage">
      <header className="web-top">
        <Link to="/" className="web-brand" aria-label="Beyond Events, accueil"><Brand size={22} /></Link>
        <nav aria-label="Navigation principale">
          <NavLink to="/evenements">Événements</NavLink>
          <NavLink to="/rejoindre">Rejoindre avec un code</NavLink>
          <Link to="/console">Espace organisateur</Link>
        </nav>
      </header>
      <div className="phone">{children}</div>
    </div>
  )
}

export function TabBar({ items }: { items: { to: string; label: string; end?: boolean; badge?: number }[] }) {
  return (
    <nav className="tabbar" aria-label="Navigation de l'app">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => (isActive ? 'active' : '')}>
          {i.label}{i.badge ? <span className="count" style={{ marginLeft: 6 }}>{i.badge}</span> : null}
        </NavLink>
      ))}
    </nav>
  )
}

export function BackBar({ to, title, close }: { to: string; title?: string; close?: boolean }) {
  return (
    <div className="bar">
      <Link to={to} className="icon-btn plain" aria-label="Retour">{close ? Icon.close : Icon.back}</Link>
      {title ? <h1>{title}</h1> : <span style={{ flex: 1 }} />}
    </div>
  )
}

export function Progress({ value }: { value: number }) {
  const v = Math.max(0, Math.min(1, value || 0))
  return <div className="progress" role="img" aria-label={`${Math.round(v * 100)} %`}><div style={{ width: `${Math.round(v * 100)}%` }} /></div>
}

export function Loading({ text = 'Chargement…' }: { text?: string }) {
  return <p className="muted small" style={{ padding: 16 }}>{text}</p>
}

export function ErrorNote({ error }: { error: string | null }) {
  return error ? <p className="small ko" role="alert" style={{ padding: '0 16px' }}>Erreur : {error}</p> : null
}

export function kindLabel(k: string) {
  return k === 'alerte' ? 'Alerte' : k === 'relance' ? 'Relance' : 'Info'
}
