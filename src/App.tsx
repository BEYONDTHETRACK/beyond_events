import type { ReactNode } from 'react'
import { HashRouter, MemoryRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { StoreProvider, useStore } from './store'
import { DEMO_PARTICIPANT_CODE, DEMO_VOLUNTEER_CODE } from './data/demo'
import * as A from './pages/app'
import * as C from './pages/console'

// Routage par hash en ligne ; en mémoire quand l'app est intégrée dans une page hôte (VITE_ROUTER=memory).
const Router = import.meta.env.VITE_ROUTER === 'memory' ? MemoryRouter : HashRouter

function DemoBar() {
  const { join, setSession } = useStore()
  const nav = useNavigate()
  const { pathname } = useLocation()
  const views: [string, string, () => void][] = [
    ['visiteur', 'Visiteur', () => { setSession(null); nav('/app') }],
    ['coureur', 'Coureur', () => { join(DEMO_PARTICIPANT_CODE); nav('/app/course') }],
    ['benevole', 'Bénévole', () => { join(DEMO_VOLUNTEER_CODE); nav('/app/benevole') }],
    ['orga', 'Organisateur', () => nav('/console')],
    ['admin', 'Admin', () => nav('/admin')],
  ]
  const current = pathname.startsWith('/console') ? 'orga' : pathname.startsWith('/admin') ? 'admin'
    : pathname.startsWith('/app/course') ? 'coureur' : pathname.startsWith('/app/benevole') ? 'benevole' : 'visiteur'
  return (
    <div className="demobar">
      <strong>Prototype</strong>
      <span className="hint">Vue :</span>
      {views.map(([k, l, go]) => <button key={k} type="button" aria-pressed={current === k} onClick={go}>{l}</button>)}
      <span className="spacer" />
      <span className="hint">Données d'exemple, rien n'est enregistré</span>
    </div>
  )
}

function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="phone-stage">
      <div className="phone">{children}</div>
      <aside className="phone-side">
        <h2>Comment tester</h2>
        <p>Utilise la barre violette pour changer de vue. Pour entrer dans une course, saisis un code personnel :</p>
        <p style={{ marginTop: 8 }}>Participant : <code>{DEMO_PARTICIPANT_CODE}</code><br />Bénévole : <code>{DEMO_VOLUNTEER_CODE}</code></p>
        <p style={{ marginTop: 12 }}>Envoie un message depuis la vue Organisateur, puis reviens en vue Coureur : il apparaît dans le fil. Un abandon signalé arrive dans la boîte de réception de la console.</p>
      </aside>
    </div>
  )
}

function Toast() {
  const { toast } = useStore()
  return toast ? <div className="toast" role="status">{toast}</div> : null
}

export default function App() {
  return (
    <StoreProvider>
      <Router>
        <DemoBar />
        <Routes>
          <Route path="/" element={<Navigate to="/app" />} />
          <Route path="/app" element={<Phone><A.Bienvenue /></Phone>} />
          <Route path="/app/evenements" element={<Phone><A.Accueil /></Phone>} />
          <Route path="/app/evenement/:id" element={<Phone><A.Fiche /></Phone>} />
          <Route path="/app/rejoindre" element={<Phone><A.Rejoindre /></Phone>} />
          <Route path="/app/live/:id" element={<Phone><A.Tracking /></Phone>} />
          <Route path="/app/course" element={<Phone><A.Fil /></Phone>} />
          <Route path="/app/course/documents" element={<Phone><A.Documents /></Phone>} />
          <Route path="/app/course/messages" element={<Phone><A.MessagesPrives /></Phone>} />
          <Route path="/app/course/incident" element={<Phone><A.Incident /></Phone>} />
          <Route path="/app/compte" element={<Phone><A.Compte /></Phone>} />
          <Route path="/app/benevole" element={<Phone><A.BenevolePoste /></Phone>} />
          <Route path="/app/benevole/equipe" element={<Phone><A.BenevoleEquipe /></Phone>} />
          <Route path="/app/benevole/carte" element={<Phone><A.BenevoleCarte /></Phone>} />
          <Route path="/console" element={<C.Dashboard />} />
          <Route path="/console/messages" element={<C.MessagesList />} />
          <Route path="/console/messages/nouveau" element={<C.Compose />} />
          <Route path="/console/messages/:id" element={<C.MessageDetail />} />
          <Route path="/console/participants" element={<C.Participants />} />
          <Route path="/console/benevoles" element={<C.Benevoles />} />
          <Route path="/console/carte" element={<C.Carte />} />
          <Route path="/console/fiche" element={<C.FicheEditeur />} />
          <Route path="/console/inbox" element={<C.Inbox />} />
          <Route path="/admin" element={<C.Admin />} />
          <Route path="*" element={<Navigate to="/app" />} />
        </Routes>
        <Toast />
      </Router>
    </StoreProvider>
  )
}
