# Publier Beyond Events sur l'App Store et Google Play

Le projet mobile est fait avec Capacitor : c'est la web app, livrée dans une app Android et une app iOS.

## Une fois sur le Mac

Dans le Terminal, dans le dossier du projet :

```bash
npm install          # installe les dépendances (obligatoire avant d'ouvrir Xcode ou Android Studio)
npm run build        # compile la web app
npx cap sync         # copie la web app dans les projets Android et iOS
```

À refaire après chaque modification de la web app, avant de recompiler les apps.

## iOS (Xcode)

1. `npx cap open ios` ouvre le projet dans Xcode.
2. Cible **App** › onglet **Signing & Capabilities** : choisis l'équipe **Beyond The Track**, laisse « Automatically manage signing ». Identifiant : `fr.beyondthetrack.events`.
3. Onglet **General** › Supported Destinations : garde seulement iPhone si tu ne veux pas fournir de captures iPad.
4. Teste sur un iPhone branché ou sur un simulateur (bouton ▶).
5. Dans App Store Connect, crée l'app : nom Beyond Events, langue principale français, identifiant `fr.beyondthetrack.events`, SKU `beyond-events`.
6. Dans Xcode : menu **Product › Archive**, puis **Distribute App › App Store Connect › Upload**.
7. Dans App Store Connect : remplis la fiche (voir `FICHE_STORES.md`), ajoute les captures, choisis le build, puis **Soumettre pour vérification**.

## Android (Android Studio)

1. `npx cap open android` ouvre le projet dans Android Studio. Attends la fin de la synchronisation Gradle.
2. Teste sur un téléphone branché ou un émulateur (bouton ▶).
3. Menu **Build › Generate Signed App Bundle or APK › Android App Bundle**.
4. **Create new…** pour créer la clé d'envoi (upload key). Range le fichier `.jks` et ses mots de passe dans un endroit sûr, **hors du dépôt Git** : sans cette clé, plus de mise à jour possible.
5. Variante **release**, puis **Create**. Le fichier `app-release.aab` se trouve dans `android/app/release/`.
6. Dans la Google Play Console : **Créer une application** (Beyond Events, gratuite), active la signature d'application par Google Play, remplis la fiche, la sécurité des données et la classification (voir `FICHE_STORES.md`), puis envoie le `.aab` en **test interne** avant la production.

## Nouvelle version

- Android : augmenter `versionCode` (+1) et `versionName` dans `android/app/build.gradle`.
- iOS : augmenter Version et Build dans Xcode (onglet General).
- Puis `npm run build && npx cap sync`, et recompiler.

## Points à surveiller

- **Apple et les apps « site web »** (règle 4.2) : Apple refuse parfois les apps qui se contentent d'afficher un site. Si c'est le cas, l'argument principal sera d'ajouter les notifications push (prévues plus tard).
- **Compte admin** : avant toute diffusion publique, remplace le mot de passe `admin` par un vrai mot de passe.
- **Fonds de carte** : les tuiles OpenStreetMap sont gratuites pour un usage raisonnable. Si l'app se diffuse largement, il faudra passer à un fournisseur de tuiles dédié.
