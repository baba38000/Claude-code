# 🚗 Carnet Auto

Appli web (PWA, installable sur téléphone) pour suivre l'entretien de ta voiture et en faire le maximum toi-même.

## Fonctionnalités

- **Fiche véhicule** : marque, modèle, moteur, carburant, boîte, distribution, VIN, huile, pneus, batterie et notes libres (infos du vendeur, défauts connus…).
- **Plan d'entretien généré automatiquement** selon la motorisation (essence, diesel, hybride, électrique), la boîte et le type de distribution (courroie ou chaîne). Chaque élément est classé :
  - 🔧 **pièce à changer** ou 🔍 **point à vérifier** ;
  - difficulté en DIY (🟢 facile, 🟠 moyen, 🔴 garage conseillé) ;
  - pièces et matériel à prévoir, conseils pratiques ;
  - intervalle en km **et/ou** en mois (le premier atteint), modifiable.
- **Journal** : entretiens d'avant l'achat (📜), faits toi-même (🧰) ou au garage (🏪), avec le coût, les pièces et les factures jointes. Chaque intervention remet l'échéance à zéro.
- **Suivi kilométrique** hebdo ou mensuel, avec graphique et moyenne km/mois. Le kilométrage du jour est estimé entre deux relevés.
- **Check-up mensuel** : une checklist (pneus, niveaux, éclairage, voyants, bruits, fuites…). Les points à surveiller remontent sur l'accueil.
- **Factures & documents** : photos et PDF classés par catégorie (pièces, garage, CT, achat, assurance…), avec montant et lien vers l'intervention.
- **📘 Doc technique** : liquides et capacités, références de pièces d'origine et leurs équivalences, couples de serrage, pneus, ampoules et batterie. Recherche intégrée, fiches constructeur dans `tech-presets.js`.
- **Rappels** :
  - 📆 **Fichier agenda (.ics)** : rappel récurrent du relevé km (hebdo ou mensuel) et du check-up mensuel, plus un événement par entretien à venir, avec une alerte 2 semaines avant. C'est la solution la plus fiable, sur iPhone comme sur Android.
  - 🔔 Notifications du navigateur à l'ouverture de l'appli, et en arrière-plan sur Android/Chrome quand l'appli est installée.
- **Sauvegarde / restauration** en un fichier JSON, factures comprises.

Les données restent **sur ton appareil** (localStorage et IndexedDB). Rien n'est envoyé sur internet.

## Utilisation

### En ligne (recommandé) : GitHub Pages
1. Dans le dépôt GitHub : **Settings → Pages → Build and deployment → Deploy from a branch**.
2. Choisis la branche `claude/car-maintenance-tracker-c3uq17` (ou `main` après fusion) et le dossier `/ (root)`.
3. Ouvre l'URL donnée (`https://<utilisateur>.github.io/<dépôt>/`) sur ton téléphone puis **Ajouter à l'écran d'accueil**.

### En local
```bash
python3 -m http.server 8000
# puis http://localhost:8000
```

## Tests
```bash
node --test tests/core.test.js
```

## Ajouter une fiche constructeur
Dans `tech-presets.js`, ajoute une entrée **avant** la fiche générique :
```js
{ label: 'Peugeot 308 II 1.5 BlueHDi 130', match: ['peugeot', '308', '1.5'],
  rows: [{ section: 'fluids', label: 'Huile moteur', value: '…', ref: '…', alt: '…' }],
  plan: { vidange: { intervalKm: 25000, intervalMonths: 12 } } }
```
Le bouton « Charger la fiche » apparaît dans 📘 Doc technique quand la marque, le modèle et le moteur correspondent.

> ⚠️ Les intervalles par défaut sont génériques. La référence reste le carnet d'entretien du constructeur. Vérifie les références de pièces avec ton immatriculation ou ton VIN avant de commander.
