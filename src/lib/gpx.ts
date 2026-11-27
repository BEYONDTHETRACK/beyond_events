import { saveFile } from './native'
// Lecture d'un fichier GPX dans le navigateur : points, distance, dénivelé positif, tracé simplifié.
export type Pt = [number, number, number | null, number] // lat, lng, altitude, km cumulés

const R = 6371.0088
export function distKm(a: [number, number], b: [number, number]) {
  const toR = Math.PI / 180
  const dLat = (b[0] - a[0]) * toR
  const dLng = (b[1] - a[1]) * toR
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toR) * Math.cos(b[0] * toR) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export interface ParsedGpx { name: string; points: Pt[]; lengthKm: number; gainM: number }

export function parseGpx(text: string): ParsedGpx {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Fichier GPX illisible')
  let nodes = Array.from(doc.getElementsByTagName('trkpt'))
  if (!nodes.length) nodes = Array.from(doc.getElementsByTagName('rtept'))
  if (nodes.length < 2) throw new Error('Aucun tracé trouvé dans ce fichier')
  const name = doc.querySelector('trk > name, rte > name, metadata > name')?.textContent?.trim() ?? ''
  const raw: Pt[] = []
  let km = 0
  for (const n of nodes) {
    const lat = parseFloat(n.getAttribute('lat') ?? '')
    const lng = parseFloat(n.getAttribute('lon') ?? '')
    if (!isFinite(lat) || !isFinite(lng)) continue
    const eleTxt = n.getElementsByTagName('ele')[0]?.textContent
    const ele = eleTxt != null && eleTxt !== '' ? parseFloat(eleTxt) : null
    if (raw.length) km += distKm([raw[raw.length - 1][0], raw[raw.length - 1][1]], [lat, lng])
    raw.push([lat, lng, ele !== null && isFinite(ele) ? ele : null, km])
  }
  // Dénivelé positif avec un seuil de 5 m pour lisser le bruit des altitudes.
  let gain = 0
  let ref: number | null = null
  for (const p of raw) {
    if (p[2] === null) continue
    if (ref === null) { ref = p[2]; continue }
    if (p[2] - ref >= 5) { gain += p[2] - ref; ref = p[2] } else if (ref - p[2] >= 5) ref = p[2]
  }
  return { name, points: simplify(raw), lengthKm: Math.round(km * 100) / 100, gainM: Math.round(gain) }
}

// Garde au plus ~4000 points, régulièrement espacés en distance, pour un affichage léger.
function simplify(pts: Pt[]): Pt[] {
  const total = pts[pts.length - 1][3]
  const step = Math.max(total / 4000, 0.02)
  const out: Pt[] = [pts[0]]
  let last = 0
  for (const p of pts) if (p[3] - last >= step) { out.push(round(p)); last = p[3] }
  const end = pts[pts.length - 1]
  if (out[out.length - 1] !== end) out.push(round(end))
  return out.map(round)
}
const round = (p: Pt): Pt => [+p[0].toFixed(5), +p[1].toFixed(5), p[2] === null ? null : Math.round(p[2]), +p[3].toFixed(2)]

// Point du tracé le plus proche d'une position (pour placer un CP et calculer son kilométrage).
export function snap(points: Pt[], lat: number, lng: number) {
  let best = points[0]
  let bestD = Infinity
  for (const p of points) {
    const d = (p[0] - lat) ** 2 + ((p[1] - lng) * Math.cos(lat * Math.PI / 180)) ** 2
    if (d < bestD) { bestD = d; best = p }
  }
  return { point: best, offKm: distKm([lat, lng], [best[0], best[1]]) }
}

export function downloadText(name: string, text: string, type = 'application/gpx+xml') {
  saveFile(name, text, type).catch(() => {})
}
