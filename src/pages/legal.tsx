import { Link } from 'react-router-dom'
import { Brand } from '../components/Logo'

// Politique de confidentialité (lien demandé par l'App Store et Google Play). Page publique, sans code d'accès.
export function Confidentialite() {
  return (
    <div className="legal">
      <header className="legal-top"><Link to="/" aria-label="Beyond Events, accueil" style={{ textDecoration: 'none' }}><Brand size={22} /></Link></header>
      <main className="legal-body">
        <h1>Politique de confidentialité</h1>
        <p className="small muted">Dernière mise à jour : 27 novembre 2026</p>

        <h2>Qui sommes-nous</h2>
        <p>Beyond Events est une application éditée par l'association Beyond The Track (loi 1901, France). Elle permet aux organisateurs d'événements sportifs d'endurance de communiquer avec leurs participants et leurs bénévoles.</p>
        <p>Contact : <a href="mailto:contact@beyondthetrack.fr">contact@beyondthetrack.fr</a></p>

        <h2>Qui est responsable de vos données</h2>
        <p>L'organisateur de l'événement auquel vous participez décide des informations qu'il enregistre sur vous et de leur usage : il est responsable de ces données. Beyond The Track les héberge et les traite pour son compte, uniquement pour faire fonctionner l'application.</p>

        <h2>Données traitées</h2>
        <ul>
          <li><strong>Participants et bénévoles</strong> : nom, e-mail, téléphone, dossard, distance, format, langue, poste, code personnel d'accès, statut de course (inscrit, en course, abandon, finisher), tailles de textile choisies et matériel remis.</li>
          <li><strong>Utilisation de l'application</strong> : date d'activation du code, lecture et confirmation des messages, pointage sur le poste, messages échangés avec l'organisation et l'équipe.</li>
          <li><strong>Position</strong> : uniquement quand vous signalez un incident ou un abandon et que vous l'acceptez, pour que l'organisation puisse vous retrouver. L'application ne suit pas votre position en continu.</li>
          <li><strong>Organisateurs</strong> : adresse e-mail et mot de passe (chiffré) du compte.</li>
        </ul>
        <p>Pas de publicité, pas de revente de données, pas de suivi publicitaire ni de mesure d'audience.</p>

        <h2>Pourquoi</h2>
        <p>Pour vous transmettre les informations de l'événement, vérifier que les messages importants ont été lus, organiser les bénévoles et leur dotation, et assurer votre sécurité pendant la course.</p>

        <h2>Où sont les données</h2>
        <ul>
          <li>Base de données hébergée par Supabase dans l'Union européenne (Francfort, Allemagne).</li>
          <li>La carte utilise les fonds OpenStreetMap et la recherche de villes le service Photon (komoot) : votre appareil leur transmet son adresse IP pour afficher la carte et les suggestions.</li>
        </ul>

        <h2>Durée de conservation</h2>
        <p>Les données d'un événement sont conservées le temps de son organisation, puis supprimées par l'organisateur ou à sa demande, dans le respect du droit applicable dans son pays.</p>

        <h2>Vos droits</h2>
        <p>Vous pouvez demander l'accès, la rectification ou la suppression de vos données, ou vous opposer à leur traitement : adressez-vous à l'organisateur de votre événement, ou à <a href="mailto:contact@beyondthetrack.fr">contact@beyondthetrack.fr</a>. Vous pouvez aussi saisir la CNIL (<a href="https://www.cnil.fr" target="_blank" rel="noreferrer">cnil.fr</a>).</p>

        <h2>Supprimer votre accès</h2>
        <p>Dans l'application, « Compte » puis « Se déconnecter » efface votre code de l'appareil. Pour supprimer vos données, écrivez à l'organisateur ou à <a href="mailto:contact@beyondthetrack.fr">contact@beyondthetrack.fr</a>.</p>
      </main>
    </div>
  )
}
