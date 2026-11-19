import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { posts } from '../data/demo'
import type { Volunteer } from '../data/types'

export const Icon = {
  back: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>,
  close: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  search: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>,
  key: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3M15 8l2 2" /></svg>,
  send: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>,
  locate: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>,
  share: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v14" /></svg>,
  external: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" /></svg>,
}

export function TabBar({ items }: { items: { to: string; label: string; end?: boolean }[] }) {
  return (
    <nav className="tabbar" aria-label="Navigation de l'app">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => (isActive ? 'active' : '')}>{i.label}</NavLink>
      ))}
    </nav>
  )
}

export function BackBar({ to, title, close, right }: { to: string; title?: string; close?: boolean; right?: ReactNode }) {
  return (
    <div className="bar">
      <Link to={to} className="icon-btn plain" aria-label="Retour">{close ? Icon.close : Icon.back}</Link>
      {title ? <h1>{title}</h1> : <span style={{ flex: 1 }} />}
      {right}
    </div>
  )
}

export function Progress({ value }: { value: number }) {
  return <div className="progress" role="img" aria-label={`${Math.round(value * 100)} %`}><div style={{ width: `${Math.round(value * 100)}%` }} /></div>
}

// Tracé schématique commun à toutes les cartes (en V1 : trace GPX réelle sur fond de carte).
const TRACE = 'M80 540 C 140 470, 170 440, 200 420 S 270 360, 300 330 S 420 280, 470 260 S 540 230, 560 220 S 700 160, 820 120'
const TRACE_850 = 'M300 330 C 330 400, 420 420, 520 400 S 640 330, 700 300'

interface MapProps {
  volunteers?: Volunteer[]
  showPosts?: boolean
  showVolunteers?: boolean
  showRunners?: boolean
  show850?: boolean
  highlightPost?: string
  me?: boolean
  followed?: number
  runners?: number
  height?: number
}

export function EventMap({ volunteers = [], showPosts = true, showVolunteers = true, showRunners = false, show850 = true, highlightPost, me, followed, runners = 40, height }: MapProps) {
  const pathRef = useRef<SVGPathElement>(null)
  const [t, setT] = useState(0)
  const [pts, setPts] = useState<{ x: number; y: number; id: number }[]>([])

  useEffect(() => {
    if (!showRunners) return
    const id = window.setInterval(() => setT((v) => v + 1), 1200)
    return () => window.clearInterval(id)
  }, [showRunners])

  useEffect(() => {
    const path = pathRef.current
    if (!path || !showRunners) return
    const len = path.getTotalLength()
    const list = Array.from({ length: runners }, (_, i) => {
      const base = (0.15 + ((i * 0.6180339) % 1) * 0.7)
      const f = Math.min(0.98, base + t * 0.002 * (1 + (i % 5) / 10))
      const p = path.getPointAtLength(len * f)
      return { x: p.x + ((i % 3) - 1) * 4, y: p.y + ((i % 2) ? 3 : -3), id: i }
    })
    setPts(list)
  }, [t, showRunners, runners])

  const byPost = (id: string) => volunteers.filter((v) => v.postId === id && v.checkedIn).length
  const followedPt = followed !== undefined ? pts[followed] : undefined

  return (
    <svg viewBox="0 0 900 620" width="100%" height={height} preserveAspectRatio="xMidYMid slice" role="img" aria-label="Carte de l'événement avec le tracé, les postes et les positions en direct" style={{ display: 'block' }}>
      <rect width="900" height="620" fill="#E8EEE6" />
      <path d="M0 470 C 150 430, 260 520, 420 470 S 700 380, 900 420" fill="none" stroke="#B9D3E6" strokeWidth="14" />
      <path d="M60 120 C 200 80, 300 160, 420 110 S 640 60, 760 140" fill="none" stroke="#D6DECF" strokeWidth="2" />
      <path d="M40 200 C 180 160, 320 240, 460 190 S 680 140, 840 220" fill="none" stroke="#D6DECF" strokeWidth="2" />
      <path ref={pathRef} d={TRACE} fill="none" stroke="#0E5E4E" strokeWidth="6" strokeLinecap="round" />
      {show850 && <path d={TRACE_850} fill="none" stroke="#3E6E8E" strokeWidth="5" strokeDasharray="12 8" strokeLinecap="round" />}
      {showRunners && pts.map((p) => <circle key={p.id} cx={p.x} cy={p.y} r="6" fill="#F2A774" stroke="#16201C" strokeWidth="1.5" style={{ transition: 'cx 1s linear, cy 1s linear' }} />)}
      {followedPt && (
        <g>
          <circle cx={followedPt.x} cy={followedPt.y} r="18" fill="#1E5AA8" fillOpacity="0.2" />
          <circle cx={followedPt.x} cy={followedPt.y} r="9" fill="#1E5AA8" stroke="#fff" strokeWidth="3" />
        </g>
      )}
      {showPosts && posts.map((p) => {
        const n = byPost(p.id)
        const missing = n < p.capacity && ['km34', 'cp1', 'cp2', 'arrivee'].includes(p.id)
        const fill = highlightPost === p.id ? '#0E5E4E' : missing ? '#A33A0D' : '#16201C'
        return (
          <g key={p.id} fontFamily="Inter, sans-serif" fontWeight="700">
            <rect x={p.x - 15} y={p.y - 15} width="30" height="30" rx="7" fill={fill} />
            <text x={p.x} y={p.y + 5} fill="#fff" textAnchor="middle" fontSize="14">{n}</text>
            <text x={p.x + 22} y={p.y + 5} fill="#16201C" fontSize="14">{p.name.replace('Ravitaillement ', '').replace('Accueil et retrait des dossards', 'Départ')}{highlightPost === p.id ? ' · mon poste' : ''}</text>
          </g>
        )
      })}
      {showVolunteers && volunteers.filter((v) => v.checkedIn).map((v, i) => {
        const p = posts.find((x) => x.id === v.postId)!
        const a = (i * 2.4) % (Math.PI * 2)
        return <circle key={v.id} cx={p.x + Math.cos(a) * 26} cy={p.y + Math.sin(a) * 26} r="6" fill="#FFFFFF" stroke="#0E5E4E" strokeWidth="2.5" />
      })}
      {me && (
        <g>
          <circle cx="532" cy="262" r="18" fill="#1E5AA8" fillOpacity="0.18" />
          <circle cx="532" cy="262" r="9" fill="#1E5AA8" stroke="#fff" strokeWidth="3" />
        </g>
      )}
    </svg>
  )
}
