# Beyond Events – prototype

Prototype web cliquable de l'outil de communication pour les courses d'endurance :
un événement = une « room », on y entre avec un code personnel (participant ou bénévole).

Tout fonctionne avec des **données d'exemple en mémoire** : rien n'est enregistré.

## Lancer

```bash
npm install
npm run dev      # développement
npm run build    # version à déployer (dossier dist/)
```

Déploiement Netlify : commande `npm run build`, dossier publié `dist`.

## Tester

La barre violette en haut change de vue : Visiteur, Coureur, Bénévole, Organisateur, Admin.

- Code participant de démo : `BB27-X4K9`
- Code bénévole de démo : `BB27-V7Q2`

Scénario type : en vue Organisateur, envoyer un message (Nouveau message), suivre les
lectures et la bascule SMS simulées, puis passer en vue Coureur : le message est dans le fil.
Un abandon signalé par le coureur arrive dans la boîte de réception de la console.

## Structure

- `src/data/types.ts` : modèle de données (futures tables Supabase)
- `src/data/demo.ts` : données d'exemple
- `src/store.tsx` : état et actions ; chaque action deviendra un appel Supabase en V1
- `src/pages/app.tsx` : app mobile (visiteur, participant, bénévole)
- `src/pages/console.tsx` : console organisateur et admin plateforme
- `src/components/ui.tsx` : composants communs et carte schématique

## Pas encore branché (V1)

Comptes et codes réels, import CSV, envoi push / e-mail / SMS, traduction automatique,
carte réelle avec traces GPX, tracking GPS, mode hors ligne du contrôle matériel.
