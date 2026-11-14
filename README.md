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
- **⛽ Pleins** : date, km, litres, montant, prix au litre (2 valeurs suffisent, la 3e se calcule), plein complet ou partiel, station. Stats : prix moyen au litre pondéré, min/max, consommation en L/100 km calculée plein à plein, coût aux 100 km, dépenses par mois et sur 12 mois, graphiques. Un plein avec le km compte aussi comme relevé kilométrique.
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

## 🚘 Renault Vel Satis 2.0 dCi 175 (fiche intégrée)
Sur l'écran d'accueil, le bouton **« Charger la Vel Satis »** préremplit :
- la fiche véhicule : M9R, chaîne, FAP, BVM6, équipements et défauts signalés dans l'annonce ;
- le plan d'entretien « recommandé », plus strict que celui du constructeur : vidange tous les 10 000 km ou 1 an en huile RN0720, filtres, liquides, courroie d'accessoires, diagnostic FAP/EGR, boîte PK6, lève-vitres arrière ;
- la doc technique : huile et capacités, références de filtres, plaquettes et disques, kit courroie, couples de serrage, pneus, batterie, xénon ;
- l'historique connu : vidange et filtres en mai 2026 vers 189 200 km, pneus été en 2025.

Les valeurs marquées « à vérifier » n'ont pas pu être confirmées par au moins une source fiable : contrôle-les avec le VIN ou sur la pièce en place.
Pour régénérer ce fichier : `node tools/build-starter.js`.

## Ajouter une fiche constructeur
Dans `tech-presets.js`, ajoute une entrée **avant** la fiche générique :
```js
{ label: 'Peugeot 308 II 1.5 BlueHDi 130', match: ['peugeot', '308', '1.5'],
  rows: [{ section: 'fluids', label: 'Huile moteur', value: '…', ref: '…', alt: '…' }],
  plan: { vidange: { intervalKm: 25000, intervalMonths: 12 } } }
```
Le bouton « Charger la fiche » apparaît dans 📘 Doc technique quand la marque, le modèle et le moteur correspondent.

> ⚠️ Les intervalles par défaut sont génériques. La référence reste le carnet d'entretien du constructeur. Vérifie les références de pièces avec ton immatriculation ou ton VIN avant de commander.
