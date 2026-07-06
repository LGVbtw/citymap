# CityMap

Application mobile (React Native / Expo) permettant d'explorer les lieux autour de Serris sur une carte, de les sauvegarder dans des listes personnalisées, de recevoir des suggestions de lieux similaires, et de gérer son profil.

Projet réalisé dans le cadre du B3 DEV Mobile (Ynov).

## Prérequis

- [Node.js](https://nodejs.org/) 20 LTS ou supérieur
- npm (fourni avec Node.js)
- L'application [Expo Go](https://expo.dev/go) sur un téléphone Android/iOS **ou** un émulateur configuré :
  - Android : [Android Studio](https://docs.expo.dev/workflow/android-studio-emulator/) + un émulateur
  - iOS (Mac uniquement) : Xcode + le simulateur iOS
- Une connexion internet (l'app récupère les lieux via l'API [Overpass](https://overpass-api.de/) et les cartes via react-native-maps)

## Installation

1. Cloner le dépôt puis installer les dépendances :

   ```bash
   npm install
   ```

2. Lancer le serveur de développement Expo :

   ```bash
   npm start
   ```

3. Dans le terminal qui s'ouvre, choisir comment lancer l'app :
   - Scanner le QR code avec l'app **Expo Go** (téléphone Android ou iOS)
   - Appuyer sur `a` pour l'émulateur Android
   - Appuyer sur `i` pour le simulateur iOS (Mac uniquement)
   - Appuyer sur `w` pour lancer la version web dans le navigateur

   Ou directement une plateforme précise :

   ```bash
   npm run android
   npm run ios
   npm run web
   ```

## Se connecter

Au premier lancement, un compte de démonstration est créé automatiquement :

- **Utilisateur** : `demo`
- **Mot de passe** : `demo123`

Un raccourci "Utiliser le compte démo" est aussi disponible sur l'écran de connexion. Vous pouvez également créer votre propre compte via l'onglet Inscription.

## Fonctionnement

- **Aucun backend** : toutes les données (comptes, listes, lieux, notifications) sont stockées localement sur l'appareil via `AsyncStorage`. Désinstaller l'app ou vider son cache efface les données.
- **Carte (`Carte`)** : charge les lieux d'intérêt autour de Serris depuis l'API Overpass (mis en cache 24h) et permet de les ajouter à une ou plusieurs listes.
- **Listes (`Listes`)** : création/gestion de listes de lieux, partage (lien copié dans le presse-papiers), suggestions IA basées sur les lieux déjà sauvegardés.
- **Alertes (`Alertes`)** : notifications liées aux actions de l'app (ajouts, partages, suggestions).
- **Profil (`Profil`)** : gestion du compte, thème clair/sombre/système, préférences de notifications.

## Limitation connue

Aucune clé Google Maps n'est configurée dans `app.json`. Sur Android, l'affichage de la carte peut nécessiter l'ajout d'une clé API Google Maps (`app.json` → `android.config.googleMaps.apiKey`) selon l'environnement d'exécution.

## Stack technique

- [Expo](https://expo.dev) 54 + [Expo Router](https://docs.expo.dev/router/introduction/) (navigation par fichiers, dossier `src/app/`)
- React Native + TypeScript
- `react-native-maps` pour l'affichage cartographique
- `@react-native-async-storage/async-storage` pour le stockage local
- API [Overpass](https://overpass-api.de/) (OpenStreetMap) pour les données de lieux
