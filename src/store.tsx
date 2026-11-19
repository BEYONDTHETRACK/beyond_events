import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import * as demo from './data/demo'
import type { Message, MessageKind, MessageTarget, Participant, PostMessage, Report, Session, TeamMessage, Volunteer } from './data/types'

// État du prototype, en mémoire. En V1, chaque action deviendra un appel Supabase.

export function nowLabel() {
  const d = new Date()
  return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`
}

export interface NewMessage {
  title: string
  body: string
  kind: MessageKind
  target: MessageTarget
  requireConfirm: boolean
  sms: boolean
  smsDelayMin: number
}

export function matchTarget(p: Participant, t: MessageTarget) {
  return (t.distance === 'Toutes' || p.distance === t.distance)
    && (t.format === 'Tous' || p.format === t.format)
    && (t.status === 'Tous' || p.status === t.status)
}

interface Store {
  session: Session | null
  participants: Participant[]
  volunteers: Volunteer[]
  messages: Message[]
  postMessages: PostMessage[]
  reports: Report[]
  teamMessages: TeamMessage[]
  tracking: boolean
  toast: string | null
  me: Participant | null
  meVolunteer: Volunteer | null
  join: (code: string) => 'participant' | 'benevole' | null
  setSession: (s: Session | null) => void
  sendMessage: (m: NewMessage) => string
  readMessage: (id: string) => void
  confirmMessage: (id: string) => void
  report: (type: string, text: string, where: string) => void
  handleReport: (id: string) => void
  toggleCheckIn: () => void
  confirmPresence: () => void
  sendTeamMessage: (text: string) => void
  sendPostMessage: (postId: string, body: string) => void
  relaunch: (who: 'participants' | 'benevoles' | 'briefing') => void
  setTracking: (on: boolean) => void
  notify: (text: string) => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [participants, setParticipants] = useState(demo.participants)
  const [volunteers, setVolunteers] = useState(demo.volunteers)
  const [messages, setMessages] = useState(demo.messages)
  const [postMessages, setPostMessages] = useState(demo.postMessages)
  const [reports, setReports] = useState(demo.reports)
  const [teamMessages, setTeamMessages] = useState(demo.teamMessages)
  const [tracking, setTracking] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const notify = useCallback((text: string) => {
    setToast(text)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3200)
  }, [])

  const me = session?.role === 'participant' ? participants.find((p) => p.id === session.personId) ?? null : null
  const meVolunteer = session?.role === 'benevole' ? volunteers.find((v) => v.id === session.personId) ?? null : null

  const join = useCallback((code: string) => {
    const c = code.trim().toUpperCase()
    const p = participants.find((x) => x.code === c)
    if (p) {
      setSession({ role: 'participant', personId: p.id })
      setParticipants((list) => list.map((x) => (x.id === p.id ? { ...x, activated: true } : x)))
      return 'participant' as const
    }
    const v = volunteers.find((x) => x.code === c)
    if (v) {
      setSession({ role: 'benevole', personId: v.id })
      setVolunteers((list) => list.map((x) => (x.id === v.id ? { ...x, activated: true } : x)))
      return 'benevole' as const
    }
    return null
  }, [participants, volunteers])

  // Envoi d'un message : on simule la lecture progressive puis la bascule SMS.
  const sendMessage = useCallback((m: NewMessage) => {
    const id = `m${Date.now()}`
    const recipients = participants.filter((p) => matchTarget(p, m.target)).map((p) => p.id)
    const parts = [m.target.distance === 'Toutes' ? 'Tous' : m.target.distance, m.target.format !== 'Tous' ? m.target.format : '', m.target.status !== 'Tous' ? m.target.status : ''].filter(Boolean)
    const msg: Message = {
      id, title: m.title, body: m.body, kind: m.kind, target: m.target, targetLabel: `${parts.join(' · ')} (${recipients.length})`,
      requireConfirm: m.requireConfirm, sentAt: nowLabel(), sms: m.sms, smsDelayMin: m.smsDelayMin,
      recipients, readInApp: [], readAfterSms: [], smsSent: [],
    }
    setMessages((list) => [msg, ...list])
    const others = recipients.filter((r) => r !== 'p1207')
    const steps = [0.35, 0.62, 0.78, 0.86]
    steps.forEach((ratio, i) => {
      window.setTimeout(() => {
        setMessages((list) => list.map((x) => (x.id === id
          ? { ...x, readInApp: Array.from(new Set([...x.readInApp, ...others.slice(0, Math.round(others.length * ratio))])) }
          : x)))
      }, 900 * (i + 1))
    })
    if (m.sms) {
      window.setTimeout(() => {
        setMessages((list) => list.map((x) => {
          if (x.id !== id) return x
          const unread = x.recipients.filter((r) => !x.readInApp.includes(r) && r !== 'p1207')
          const after = unread.slice(0, Math.round(unread.length * 0.7))
          return { ...x, smsSent: unread, readAfterSms: after }
        }))
      }, 5200)
    }
    return id
  }, [participants])

  const readMessage = useCallback((id: string) => {
    if (!session || session.role !== 'participant') return
    const pid = session.personId
    setMessages((list) => {
      const target = list.find((x) => x.id === id)
      if (!target || target.requireConfirm || !target.recipients.includes(pid) || target.readInApp.includes(pid)) return list
      return list.map((x) => (x.id === id ? { ...x, readInApp: [...x.readInApp, pid] } : x))
    })
  }, [session])

  const confirmMessage = useCallback((id: string) => {
    if (!session) return
    setMessages((list) => list.map((x) => (x.id === id ? { ...x, readInApp: Array.from(new Set([...x.readInApp, session.personId])) } : x)))
    notify('Lecture confirmée. L’organisateur le voit tout de suite.')
  }, [session, notify])

  const report = useCallback((type: string, text: string, where: string) => {
    const from = session?.role === 'benevole'
      ? demo.posts.find((p) => p.id === meVolunteer?.postId)?.name ?? 'Bénévole'
      : `Dossard ${me?.bib ?? ''}`
    setReports((list) => [{ id: `r${Date.now()}`, from, role: session?.role ?? 'participant', type, text, at: nowLabel(), where, handled: false }, ...list])
    if (type === 'Abandon' && me) setParticipants((list) => list.map((p) => (p.id === me.id ? { ...p, status: 'abandon' } : p)))
    notify('Envoyé au PC course, avec ta position.')
  }, [session, me, meVolunteer, notify])

  const handleReport = useCallback((id: string) => {
    setReports((list) => list.map((r) => (r.id === id ? { ...r, handled: true } : r)))
  }, [])

  const toggleCheckIn = useCallback(() => {
    if (!meVolunteer) return
    setVolunteers((list) => list.map((v) => (v.id === meVolunteer.id ? { ...v, checkedIn: !v.checkedIn } : v)))
    notify(meVolunteer.checkedIn ? 'Départ du poste enregistré.' : 'Arrivée sur le poste enregistrée.')
  }, [meVolunteer, notify])

  const confirmPresence = useCallback(() => {
    if (!meVolunteer) return
    setVolunteers((list) => list.map((v) => (v.id === meVolunteer.id ? { ...v, confirmed: true } : v)))
  }, [meVolunteer])

  const sendTeamMessage = useCallback((text: string) => {
    if (!meVolunteer || !text.trim()) return
    setTeamMessages((list) => [...list, { id: `t${Date.now()}`, postId: meVolunteer.postId, from: 'Moi', text, at: nowLabel(), mine: true }])
  }, [meVolunteer])

  const sendPostMessage = useCallback((postId: string, body: string) => {
    setPostMessages((list) => [{ id: `pm${Date.now()}`, postId, body, at: nowLabel() }, ...list])
    notify('Message envoyé au poste.')
  }, [notify])

  const relaunch = useCallback((who: 'participants' | 'benevoles' | 'briefing') => {
    if (who === 'participants') {
      const n = participants.filter((p) => !p.activated).length
      notify(`Relance envoyée par e-mail à ${n} participants.`)
    } else if (who === 'benevoles') {
      const n = volunteers.filter((v) => !v.activated).length
      notify(`Relance envoyée par e-mail à ${n} bénévoles.`)
    } else {
      const n = participants.filter((p) => !p.briefingConfirmed).length
      notify(`Relance du briefing envoyée à ${n} participants.`)
    }
  }, [participants, volunteers, notify])

  const value = useMemo<Store>(() => ({
    session, participants, volunteers, messages, postMessages, reports, teamMessages, tracking, toast, me, meVolunteer,
    join, setSession, sendMessage, readMessage, confirmMessage, report, handleReport, toggleCheckIn, confirmPresence,
    sendTeamMessage, sendPostMessage, relaunch, setTracking, notify,
  }), [session, participants, volunteers, messages, postMessages, reports, teamMessages, tracking, toast, me, meVolunteer,
    join, sendMessage, readMessage, confirmMessage, report, handleReport, toggleCheckIn, confirmPresence, sendTeamMessage, sendPostMessage, relaunch, notify])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider manquant')
  return s
}
