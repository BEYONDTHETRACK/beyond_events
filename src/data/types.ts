// Modèle de données du prototype.
// Il reprend les futures tables Supabase : events, participants, volunteers, posts, messages, reads, reports, team_messages.

export type Lang = 'FR' | 'EN' | 'ES'
export type Role = 'participant' | 'benevole'
export type RunnerStatus = 'inscrit' | 'en course' | 'abandon' | 'finisher'
export type MessageKind = 'info' | 'alerte' | 'relance'
export type Practice = 'Bikepacking' | 'Gravel' | 'Route' | 'Trail' | 'Triathlon'

export interface EventItem {
  id: string
  name: string
  org: string
  practice: Practice
  date: string
  place: string
  distances: string[]
  live: boolean
  isPublic: boolean
  band: string
  description: string
  registrationOpen: boolean
}

export interface Participant {
  id: string
  bib: number
  name: string
  distance: string
  format: 'Solo' | 'Duo'
  lang: Lang
  status: RunnerStatus
  code: string
  activated: boolean
  briefingConfirmed: boolean
  phone: string
}

export interface Post {
  id: string
  name: string
  hours: string
  lead: string
  capacity: number
  x: number
  y: number
}

export interface Volunteer {
  id: string
  name: string
  code: string
  postId: string
  activated: boolean
  confirmed: boolean
  checkedIn: boolean
}

export interface MessageTarget {
  distance: string | 'Toutes'
  format: 'Tous' | 'Solo' | 'Duo'
  status: RunnerStatus | 'Tous'
}

export interface Message {
  id: string
  title: string
  body: string
  kind: MessageKind
  target: MessageTarget
  targetLabel: string
  requireConfirm: boolean
  sentAt: string
  sms: boolean
  smsDelayMin: number
  recipients: string[]
  readInApp: string[]
  readAfterSms: string[]
  smsSent: string[]
}

export interface PostMessage {
  id: string
  postId: string | 'tous'
  body: string
  at: string
}

export interface Report {
  id: string
  from: string
  role: Role
  type: string
  text: string
  at: string
  where: string
  handled: boolean
}

export interface TeamMessage {
  id: string
  postId: string
  from: string
  text: string
  at: string
  mine?: boolean
}

export interface Session {
  role: Role
  personId: string
}
