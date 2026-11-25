import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Pt } from '../lib/gpx'

export interface MapTrack { id: string; name: string; points: Pt[] }
export interface MapCp { id: string; name: string; kind: string; lat: number; lng: number; km: number | null }

export const TRACK_COLORS = ['#FF5F1F', '#0E7490', '#15803D', '#1E3350', '#B93A00']
const KIND_COLORS: Record<string, string> = { 'Départ': '#15803D', 'Arrivée': '#0F1B2D', 'CP': '#FF5F1F', 'Ravitaillement': '#0E7490', 'Base de vie': '#1E3350', 'Point d’eau': '#0891B2', 'Danger': '#C62828' }
export const CP_KINDS = Object.keys(KIND_COLORS)

function cpIcon(cp: MapCp, highlight: boolean) {
  const color = KIND_COLORS[cp.kind] ?? '#FF5F1F'
  const label = cp.name.length > 18 ? `${cp.name.slice(0, 17)}…` : cp.name
  return L.divIcon({
    className: 'cp-icon',
    html: `<span class="cp-dot" style="background:${color};${highlight ? 'outline:3px solid #6EE7F9;' : ''}"></span><span class="cp-label">${escapeHtml(label)}${cp.km != null ? ` · ${Number(cp.km).toFixed(0)} km` : ''}</span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export function TrackMap({ tracks, checkpoints, height = 420, onMapClick, onCpMove, onCpClick, selectedCp, editable = false, hoverPoint }: {
  tracks: MapTrack[]; checkpoints: MapCp[]; height?: number | string
  onMapClick?: (lat: number, lng: number) => void
  onCpMove?: (id: string, lat: number, lng: number) => void
  onCpClick?: (id: string) => void
  selectedCp?: string | null
  editable?: boolean
  hoverPoint?: [number, number] | null
}) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const fitted = useRef('')
  const hoverMk = useRef<L.CircleMarker | null>(null)
  const handlers = useRef({ onMapClick, onCpMove, onCpClick })
  handlers.current = { onMapClick, onCpMove, onCpClick }

  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, { scrollWheelZoom: false }).setView([46.6, 2.5], 5)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">les contributeurs d’OpenStreetMap</a>',
    }).addTo(m)
    m.on('click', (e: L.LeafletMouseEvent) => handlers.current.onMapClick?.(e.latlng.lat, e.latlng.lng))
    layer.current = L.layerGroup().addTo(m)
    map.current = m
    return () => { m.remove(); map.current = null }
  }, [])

  useEffect(() => {
    const m = map.current
    const g = layer.current
    if (!m || !g) return
    g.clearLayers()
    const bounds = L.latLngBounds([])
    tracks.forEach((t, i) => {
      const ll = t.points.map((p) => [p[0], p[1]] as [number, number])
      if (!ll.length) return
      L.polyline(ll, { color: '#fff', weight: 7, opacity: 0.9 }).addTo(g)
      L.polyline(ll, { color: TRACK_COLORS[i % TRACK_COLORS.length], weight: 4 }).bindTooltip(t.name, { sticky: true }).addTo(g)
      ll.forEach((p) => bounds.extend(p))
    })
    for (const cp of checkpoints) {
      const mk = L.marker([cp.lat, cp.lng], { icon: cpIcon(cp, cp.id === selectedCp), draggable: editable, keyboard: true, title: cp.name }).addTo(g)
      mk.on('click', () => handlers.current.onCpClick?.(cp.id))
      mk.on('dragend', () => { const p = mk.getLatLng(); handlers.current.onCpMove?.(cp.id, p.lat, p.lng) })
      bounds.extend([cp.lat, cp.lng])
    }
    const key = tracks.map((t) => t.id).join(',')
    if (bounds.isValid() && fitted.current !== key) { m.fitBounds(bounds, { padding: [24, 24] }); fitted.current = key }
  }, [tracks, checkpoints, selectedCp, editable])

  useEffect(() => {
    const m = map.current
    if (!m) return
    if (!hoverPoint) { hoverMk.current?.remove(); hoverMk.current = null; return }
    if (!hoverMk.current) hoverMk.current = L.circleMarker(hoverPoint, { radius: 7, color: '#fff', weight: 3, fillColor: '#0F1B2D', fillOpacity: 1, interactive: false }).addTo(m)
    else hoverMk.current.setLatLng(hoverPoint)
  }, [hoverPoint])

  useEffect(() => { el.current?.style.setProperty('cursor', onMapClick ? 'crosshair' : '') }, [onMapClick])

  return <div ref={el} className="track-map" style={{ height }} role="region" aria-label="Carte du parcours" />
}
