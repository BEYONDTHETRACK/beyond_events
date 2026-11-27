# Beyond Events – V1

Web app (PC et mobile, installable) pour la communication des organisateurs d'événements d'endurance
avec leurs participants et leurs bénévoles. Un événement = une « room » : chacun y entre avec son code personnel.

En ligne :

- site vitrine : https://beyondthetrack.github.io/beyond_events/
- web app : https://beyondthetrack.github.io/beyond_events/app/

## Ce que fait la V1

- **Visiteur** : liste des événements publics (filtre par pratique), fiche publique, bouton « Rejoindre un événement ».
- **Participant** (code personnel) : fil des messages ciblés, confirmation de lecture, infos de la course,
  messages privés avec l'organisation, signalement d'abandon ou d'incident (avec position GPS), choix de la langue.
- **Bénévole** (code personnel) : son poste, confirmation de présence, consignes, pointage arrivée/départ,
  messages du PC course, groupe de son équipe, liste des postes, signalement au PC course.
- **Organisateur** (e-mail + mot de passe) : organisation, événements, événement de démo,
  messages ciblés (distance, format, statut, langue) avec suivi lu / confirmé par personne,
  participants (import CSV, codes, export CSV des codes pour publipostage), bénévoles et postes,
  boîte de réception (signalements, questions), fiche publique et réglages.
- **Admin plateforme** : validation des fiches publiques. Le premier compte qui le demande devient admin.

Mise à jour quasi en direct (rafraîchissement toutes les 5 secondes environ).

Pas encore branché : envoi réel des e-mails, SMS et notifications push, traduction automatique,
carte et traces GPX, suivi GPS, mode hors ligne complet.

## Technique

- Vite + React + TypeScript, routage par hash (GitHub Pages).
- Supabase (projet `beyond_events`, organisation Labo) : tables protégées par RLS ;
  participants et bénévoles passent par des fonctions RPC qui vérifient leur code.
- URL et clé publique Supabase dans `src/lib/supabase.ts` (surchargeables par `VITE_SUPABASE_URL` et `VITE_SUPABASE_KEY`).

```bash
npm install
npm run dev      # développement
npm run build    # version à déployer (dossier dist/)
```

## Réglage Supabase à faire une fois

Authentication › URL Configuration : Site URL et Redirect URLs = `https://beyondthetrack.github.io/beyond_events/app/`
(pour les liens de confirmation de compte et de mot de passe oublié).

## Mise en ligne (GitHub Pages, branche `gh-pages`)

La branche `gh-pages` contient deux choses :

- à la racine : le site vitrine, copie du dossier `vitrine/` (`index.html`, `site/`, `sw.js`) ;
- dans `app/` : la web app, copie du dossier `dist/` après `npm run build`.

Pour publier une nouvelle version de la web app, remplacer **uniquement** le contenu de `app/` sur `gh-pages`.
Ne pas recopier `dist/` à la racine : cela écraserait le site vitrine.

Le site vitrine renvoie vers `app/` les anciens liens de la web app (`#/...`) et les retours de connexion Supabase.
Le `sw.js` de la racine désinscrit l'ancien service worker de la web app.
