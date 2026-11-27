export type Lang = 'FR' | 'EN' | 'ES'
export type Kind = 'info' | 'alerte' | 'relance'
export type RunnerStatus = 'inscrit' | 'valide' | 'dns' | 'en course' | 'abandon' | 'finisher'
export const PRACTICES = ['Bikepacking', 'Gravel', 'Route', 'Trail', 'Course à pied', 'Triathlon'] as const

export interface EventRow {
  id: string
  org_id: string
  name: string
  practice: string
  starts_on: string | null
  place: string
  distances: string[]
  description: string
  registration_url: string | null
  registration_status: string
  is_public: boolean
  published: boolean
  color: string
  relaunch_every_days: number
  relaunch_until_days_before: number
  sms_default_delay_min: number
  sizes_deadline?: string | null
  created_at: string
}

export interface Participant {
  id: string
  event_id: string
  bib: number | null
  name: string
  email: string | null
  phone: string | null
  distance: string
  format: string
  lang: Lang
  status: RunnerStatus
  code: string
  activated_at: string | null
  last_seen_at: string | null
}

export interface Post {
  id: string
  event_id: string
  name: string
  hours: string
  place: string
  lead_name: string
  lead_phone: string
  capacity: number
  instructions: string
  position: number
}

export interface Volunteer {
  id: string
  event_id: string
  post_id: string | null
  name: string
  email: string | null
  phone: string | null
  code: string
  activated_at: string | null
  confirmed_at: string | null
  instructions_read_at: string | null
  checked_in_at: string | null
  checked_out_at: string | null
}

export interface Message {
  id: string
  event_id: string
  title: string
  body: string
  kind: Kind
  target: Record<string, string>
  target_label: string
  require_confirm: boolean
  sms_fallback: boolean
  sms_delay_min: number
  created_at: string
}

export interface Report {
  id: string
  event_id: string
  participant_id: string | null
  volunteer_id: string | null
  source_label: string
  type: string
  body: string
  lat: number | null
  lng: number | null
  handled_at: string | null
  created_at: string
}

export interface PrivateMessage {
  id: string
  event_id: string
  participant_id: string
  from_org: boolean
  body: string
  read_at: string | null
  created_at: string
}

export interface PublicEvent {
  id: string
  name: string
  practice: string
  starts_on: string | null
  place: string
  distances: string[]
  description: string
  color: string
  registration_url: string | null
  org_name: string
}

export interface ParticipantState {
  participant: { id: string; bib: number | null; name: string; distance: string; format: string; lang: Lang; status: RunnerStatus; code: string; email: string | null }
  event: PublicEvent
  messages: { id: string; title: string; body: string; kind: Kind; require_confirm: boolean; created_at: string; read_at: string | null; confirmed_at: string | null }[]
  private: { id: string; from_org: boolean; body: string; created_at: string }[]
}

export interface VolunteerState {
  volunteer: { id: string; name: string; code: string; post_id: string | null; confirmed_at: string | null; instructions_read_at: string | null; checked_in_at: string | null; checked_out_at: string | null }
  event: PublicEvent
  post: { id: string; name: string; hours: string; place: string; lead_name: string; lead_phone: string; capacity: number; instructions: string } | null
  posts: { id: string; name: string; hours: string; capacity: number; assigned: number; here: number }[]
  team: { name: string; me: boolean; confirmed: boolean; here: boolean }[]
  post_messages: { id: string; body: string; all: boolean; created_at: string }[]
  team_messages: { id: string; author: string; body: string; created_at: string; mine: boolean; from_org: boolean }[]
}

export interface CodeSession {
  role: 'participant' | 'benevole'
  code: string
  name: string
  event_name: string
}

export interface EventContact { id: string; event_id: string; role: string; name: string; phone: string | null; email: string | null; note: string; position: number }
export interface DotationItem { id: string; event_id: string; name: string; kind: 'don' | 'pret'; sizes: string[]; position: number }
export interface DotationPack { id: string; event_id: string; name: string; for_all: boolean }
export interface PackItem { pack_id: string; item_id: string; qty: number }
export interface VolunteerDotationRow {
  volunteer_id: string; volunteer_name: string; post_name: string | null; item_id: string; item_name: string; kind: 'don' | 'pret'
  sizes: string[]; qty: number; packs: string; size: string | null; given_at: string | null; returned_at: string | null
}
export interface VolunteerExtras {
  sizes_deadline: string | null
  can_choose: boolean
  contacts: { id: string; role: string; name: string; phone: string | null; email: string | null; note: string }[]
  dotation: { item_id: string; name: string; kind: 'don' | 'pret'; sizes: string[]; qty: number; packs: string; size: string | null; given_at: string | null; returned_at: string | null }[]
  post_packs: string[]
}
