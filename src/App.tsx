import { HashRouter, MemoryRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Phone, ToastProvider } from './components/ui'
import { AuthProvider, PasswordRecovery, RequireOrganizer } from './pages/auth'
import * as P from './pages/public'
import * as R from './pages/runner'
import * as V from './pages/volunteer'
import * as C from './pages/console'
import { Admin } from './pages/admin'
import { Parcours } from './pages/parcours'
import { AccessGate } from './components/Gate'

// Routage par hash (GitHub Pages) ; en mémoire si l'app est intégrée dans une page hôte (VITE_ROUTER=memory).
const Router = import.meta.env.VITE_ROUTER === 'memory' ? MemoryRouter : HashRouter

function MobileLayout() {
  return <Phone><Outlet /></Phone>
}

function Organizer() {
  return <RequireOrganizer><Outlet /></RequireOrganizer>
}

export default function App() {
  return (
    <AccessGate>
    <Router>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route element={<MobileLayout />}>
              <Route index element={<P.Bienvenue />} />
              <Route path="evenements" element={<P.Evenements />} />
              <Route path="evenement/:id" element={<P.Fiche />} />
              <Route path="rejoindre" element={<P.Rejoindre />} />
              <Route path="course" element={<R.RunnerShell />}>
                <Route index element={<R.Fil />} />
                <Route path="infos" element={<R.Infos />} />
                <Route path="messages" element={<R.MessagesPrives />} />
                <Route path="incident" element={<R.Incident />} />
                <Route path="compte" element={<R.Compte />} />
              </Route>
              <Route path="benevole" element={<V.VolunteerShell />}>
                <Route index element={<V.Poste />} />
                <Route path="equipe" element={<V.Equipe />} />
                <Route path="postes" element={<V.Postes />} />
                <Route path="compte" element={<V.CompteBenevole />} />
              </Route>
            </Route>
            <Route element={<Organizer />}>
              <Route path="console" element={<C.ConsoleHome />} />
              <Route path="console/e/:id" element={<C.EventShell />}>
                <Route index element={<C.Dashboard />} />
                <Route path="messages" element={<C.MessagesList />} />
                <Route path="messages/nouveau" element={<C.Compose />} />
                <Route path="messages/:mid" element={<C.MessageDetail />} />
                <Route path="participants" element={<C.Participants />} />
                <Route path="parcours" element={<Parcours />} />
                <Route path="benevoles" element={<C.Benevoles />} />
                <Route path="inbox" element={<C.Inbox />} />
                <Route path="fiche" element={<C.Fiche />} />
              </Route>
              <Route path="admin" element={<Admin />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <PasswordRecovery />
        </ToastProvider>
      </AuthProvider>
    </Router>
    </AccessGate>
  )
}
