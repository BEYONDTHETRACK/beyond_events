import type { EventItem, Message, Participant, Post, PostMessage, Report, TeamMessage, Volunteer, Lang } from './types'

// Données d'exemple. Tout est inventé pour la démo.

export const DEMO_PARTICIPANT_CODE = 'BB27-X4K9'
export const DEMO_VOLUNTEER_CODE = 'BB27-V7Q2'

export const events: EventItem[] = [
  {
    id: 'bb27', name: 'Beyond Borders 2027', org: 'Beyond The Track', practice: 'Bikepacking',
    date: '[date 2027]', place: '[lieu de départ]', distances: ['850 km', '1300 km'], live: false, isPublic: false,
    band: '#0E5E4E', description: 'Course de bikepacking en autonomie sur deux distances.', registrationOpen: false,
  },
  {
    id: 'gdc', name: 'Gravel des Crêtes', org: '[Organisateur]', practice: 'Gravel',
    date: 'En cours', place: 'Vosges', distances: ['180 km'], live: true, isPublic: true,
    band: '#5FA593', description: '[Présentation rédigée par l’organisateur : esprit de la course, terrain, niveau attendu.]', registrationOpen: false,
  },
  {
    id: 'utl', name: 'Ultra Trail des Lacs', org: '[Organisateur]', practice: 'Trail',
    date: '3 juillet 2027', place: 'Savoie', distances: ['42 km', '110 km'], live: false, isPublic: true,
    band: '#C9785A', description: '[Présentation rédigée par l’organisateur : esprit de la course, terrain, niveau attendu.]', registrationOpen: true,
  },
  {
    id: 'rbj', name: 'Raid Bikepacking Jura', org: '[Organisateur]', practice: 'Bikepacking',
    date: '28 août 2027', place: 'Jura', distances: ['600 km'], live: false, isPublic: true,
    band: '#3E6E8E', description: '[Présentation rédigée par l’organisateur : esprit de la course, terrain, niveau attendu.]', registrationOpen: true,
  },
  {
    id: 'tri', name: 'Triathlon du Lac', org: '[Organisateur]', practice: 'Triathlon',
    date: '18 septembre 2027', place: 'Annecy', distances: ['M', 'L'], live: false, isPublic: true,
    band: '#7A5BA8', description: '[Présentation rédigée par l’organisateur : esprit de la course, terrain, niveau attendu.]', registrationOpen: true,
  },
]

const FIRST = ['Léa', 'Hugo', 'Emma', 'Lucas', 'Chloé', 'Nathan', 'Manon', 'Tom', 'Inès', 'Louis', 'Jade', 'Arthur', 'Sarah', 'Paul', 'Lina', 'Jules', 'Anna', 'Noah', 'Clara', 'Max', 'Pablo', 'Lucía', 'James', 'Sophie']
const LAST = 'ABCDEFGHJKLMNPRSTVW'

// Générateur pseudo-aléatoire stable pour que la démo soit toujours la même.
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const rand = rng(42)

export const participants: Participant[] = Array.from({ length: 212 }, (_, i) => {
  const bib = 1200 + i
  const r = rand()
  const lang: Lang = r < 0.55 ? 'FR' : r < 0.85 ? 'EN' : 'ES'
  const distance = i < 138 ? '850 km' : '1300 km'
  const isDemo = bib === 1207
  return {
    id: `p${bib}`,
    bib,
    name: isDemo ? 'Toi (démo)' : `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}.`,
    distance: isDemo ? '1300 km' : distance,
    format: rand() < 0.85 ? 'Solo' : 'Duo',
    lang: isDemo ? 'FR' : lang,
    status: 'inscrit',
    code: isDemo ? 'BB27-X4K9' : `BB27-${(bib * 37).toString(36).toUpperCase().slice(-4)}`,
    activated: isDemo ? true : rand() > 0.065,
    briefingConfirmed: isDemo ? false : rand() > 0.17,
    phone: '+33 6 •• •• •• ••',
  }
})

export const posts: Post[] = [
  { id: 'accueil', name: 'Accueil et retrait des dossards', hours: '7 h – 12 h', lead: '[Responsable]', capacity: 6, x: 80, y: 540 },
  { id: 'controle', name: 'Contrôle matériel', hours: '7 h – 10 h', lead: '[Chef de contrôle]', capacity: 5, x: 110, y: 505 },
  { id: 'km34', name: 'Signaleurs km 34', hours: '9 h – 13 h', lead: '[Responsable]', capacity: 4, x: 200, y: 420 },
  { id: 'cp1', name: 'Ravitaillement CP1', hours: '10 h – 20 h', lead: '[Responsable]', capacity: 6, x: 300, y: 330 },
  { id: 'cp2', name: 'Ravitaillement CP2', hours: '14 h – 22 h', lead: '[Responsable]', capacity: 6, x: 560, y: 220 },
  { id: 'arrivee', name: 'Arrivée', hours: '18 h – 2 h', lead: '[Responsable]', capacity: 11, x: 820, y: 120 },
]

const VNAMES = ['Bénévole', 'Bénévole', 'Bénévole']
export const volunteers: Volunteer[] = posts.flatMap((p) =>
  Array.from({ length: p.capacity }, (_, k) => {
    const isDemo = p.id === 'cp2' && k === 0
    const r = rand()
    return {
      id: `v-${p.id}-${k}`,
      name: isDemo ? 'Toi (démo)' : `${VNAMES[k % 3]} ${p.id.toUpperCase()}-${k + 1}`,
      code: isDemo ? 'BB27-V7Q2' : `BB27-V${(k * 13 + p.capacity * 7).toString(36).toUpperCase()}`,
      postId: p.id,
      activated: isDemo ? true : r > 0.08,
      confirmed: isDemo ? true : r > 0.16,
      checkedIn: isDemo ? false : ['km34', 'cp1', 'cp2', 'arrivee'].includes(p.id) && r > 0.3,
    }
  }),
)

const all = participants.map((p) => p.id)
const pick = (ids: string[], ratio: number, seed: number) => {
  const r2 = rng(seed)
  return ids.filter((id) => id !== 'p1207' && r2() < ratio)
}

export const messages: Message[] = [
  {
    id: 'm3', title: 'Manuel de course v2', kind: 'info', requireConfirm: true,
    body: 'Le manuel de course a été mis à jour (section ravitaillements). Il est disponible hors ligne dans Documents.',
    target: { distance: 'Toutes', format: 'Tous', status: 'Tous' }, targetLabel: 'Tous (212)', sentAt: 'Il y a 2 jours',
    sms: false, smsDelayMin: 30, recipients: all, readInApp: pick(all, 0.91, 7), readAfterSms: [], smsSent: [],
  },
  {
    id: 'm2', title: 'Navettes vers le départ', kind: 'info', requireConfirm: false,
    body: 'Des navettes partent de la gare à 6 h 30 et 7 h 15. Réserve ta place depuis ton dossier.',
    target: { distance: '1300 km', format: 'Tous', status: 'Tous' }, targetLabel: '1300 km (74)', sentAt: 'Il y a 4 jours',
    sms: false, smsDelayMin: 30, recipients: participants.filter((p) => p.distance === '1300 km').map((p) => p.id),
    readInApp: pick(participants.filter((p) => p.distance === '1300 km').map((p) => p.id), 0.88, 5), readAfterSms: [], smsSent: [],
  },
  {
    id: 'm1', title: 'Liste du matériel obligatoire', kind: 'info', requireConfirm: true,
    body: 'Voici la liste du matériel obligatoire. Elle sera contrôlée au départ : merci de confirmer que tu l’as lue.',
    target: { distance: 'Toutes', format: 'Tous', status: 'Tous' }, targetLabel: 'Tous (212)', sentAt: 'Il y a 6 jours',
    sms: false, smsDelayMin: 30, recipients: all, readInApp: [...pick(all, 0.95, 3), 'p1207'], readAfterSms: [], smsSent: [],
  },
]

export const postMessages: PostMessage[] = [
  { id: 'pm1', postId: 'cp2', body: 'Premiers coureurs attendus vers 16 h. Prévoir 40 L d’eau prêts à l’arrivée.', at: '13 h 05' },
  { id: 'pm2', postId: 'tous', body: 'Merci à tous ! Pensez à pointer en arrivant sur votre poste.', at: '7 h 30' },
]

export const reports: Report[] = [
  { id: 'r1', from: 'Ravitaillement CP2', role: 'benevole', type: 'Besoin de ravitaillement', text: 'Besoin de 2 packs d’eau supplémentaires.', at: '15 h 42', where: 'CP2', handled: false },
  { id: 'r2', from: 'Signaleurs km 34', role: 'benevole', type: 'Coureur en difficulté', text: 'Coureur en difficulté, dossard 1238, il repart doucement.', at: '15 h 10', where: 'Km 34', handled: false },
]

export const teamMessages: TeamMessage[] = [
  { id: 't1', postId: 'cp2', from: 'Responsable', text: 'Je suis au refuge, les tables sont montées. Qui ramène les jerricans ?', at: '13 h 20' },
  { id: 't2', postId: 'cp2', from: 'Bénévole CP2-2', text: 'Moi, j’arrive vers 14 h avec 4 jerricans.', at: '13 h 24' },
  { id: 't3', postId: 'cp2', from: 'Responsable', text: 'Parfait, merci ! On fait le point à 15 h 30.', at: '13 h 33' },
]
