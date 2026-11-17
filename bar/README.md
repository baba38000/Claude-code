# 🍻 Carnet de Bar

Appli web (PWA installable sur téléphone, fonctionne hors-ligne) pour gérer ton bar au même endroit : caisse, carte et prix, stock, achats, charges, résultat du mois et tâches.
C'est l'appli sœur de Carnet Auto, avec le même fonctionnement : données sur l'appareil, sauvegarde en un fichier JSON.

## La règle de prix
**Prix de vente TTC ≥ 3 × coût complet.**

- **Coût complet** d'un verre = doses de matière première (pertes comprises) + garniture + **charge du bar par verre**.
- Exemple : une pinte à 1,50 € de coût complet se vend **4,50 € minimum**.
- Le coef (×3) se règle dans ⚙️, et chaque catégorie peut viser plus haut (ex. ×5 sur les spiritueux). Le prix ne descend jamais sous le minimum.
- Les prix conseillés sont arrondis au pas supérieur (0,10 € par défaut).
- La **charge du bar par verre** se règle dans ⚙️. Un calculateur la propose : charges du mois ÷ verres servis.

## Onglets
- **🏠 Accueil** : en temps réel, le CA du jour, la marge, les verres vendus, le coef réel, les offerts et pertes. On y trouve aussi ce qu'il faut faire maintenant, les conseils, les 14 derniers jours, ce qui rapporte le plus et le résultat du mois.
- **🧾 Caisse** : tu touches les boissons servies pour composer le ticket, puis tu encaisses en CB, espèces ou autre, ou tu passes le ticket en **offert** ou en **perte/casse**.
  - Chaque verre décompte le stock selon sa recette, et chaque encaissement peut être annulé.
  - La **clôture** compare les espèces comptées au fond de caisse plus les ventes en espèces, et contrôle le TPE.
  - Une vente faite avant 6 h compte pour la veille (l'heure est réglable).
- **🍸 Carte** : chaque article a sa recette en doses bar, son coût, son coef, sa marge HT, son prix minimum et son prix visé. Les articles sous ×3 sont en rouge.
  - Le bouton « Remonter les prix » corrige toute la carte en une fois.
  - La carte s'exporte vers un tableur (CSV).
- **📦 Stock** : stock théorique en conditionnements (fûts, bouteilles, packs), coût réel au cl, seuils d'alerte et valeur du stock.
  - **Inventaire** : comptage physique, avec les écarts valorisés en €.
  - **Bon de commande** : ce qu'il faut commander, par fournisseur. Quand la commande arrive, la livraison se saisit en un clic.
- **💰 Compta** : la vue du mois, avec ce qui entre et ce qui sort.
  - Recettes HT : ventes de la caisse et recettes annexes (privatisation…).
  - Dépenses : achats de matière (livraisons) et charges. Les charges sont récurrentes ou ponctuelles : loyer, électricité, eau, gaz, salaires, assurance, banque/TPE, comptable, licence, prêt…
  - **= Ce que tu gagnes** sur le mois, la TVA collectée, le seuil de rentabilité, l'historique sur 6 mois et l'export vers un tableur.
- **✅ À faire** : tâches récurrentes (clôture de caisse, températures des frigos, nettoyage des lignes de bière, inventaire, commandes, TVA…), à cocher. S'y ajoutent les tâches automatiques : produits à commander et prix à corriger.

## Conseils automatiques
Ils n'apparaissent que si un chiffre sort de la normale :
- article sous ×3 ;
- hausse du prix d'achat d'un produit, avec les articles touchés ;
- écart d'inventaire anormal ;
- écarts de caisse répétés ;
- stock qui dort.

## Carte de départ
Elle contient les doses bar standard :
- pastis 2 cl, Martini 6 cl, alcools forts 4 cl ;
- demi 25 cl, pinte 50 cl ;
- verre de vin 12 cl, kir 10 + 2 cl ;
- softs 25 cl ou bouteille, café 7 g.

Les **prix d'achat sont indicatifs** : remplace-les par ceux de tes factures. Les cocktails s'ajoutent avec leur recette dans 🍸 Carte → ＋ Article. Les produits de base (rhum, gin, vodka, sucre de canne, citron vert, menthe, eau gazeuse, tonic, prosecco, Apérol) sont déjà dans le stock.

## 📸 Stock relevé sur photos
Le bouton **« 📸 Charger le stock des photos »** (Accueil ou Stock) charge le stock relevé sur les photos du 17/11/2026 : plus de 40 produits avec leurs marques, leurs quantités en bouteilles et les articles de carte correspondants. Le fichier source est `stock-photos.js`.
- Les produits marqués **« à vérifier »** ont été comptés malgré le miroir du fond des étagères ou une bouteille cachée. Recompte-les avec 📋 Inventaire.
- Les prix d'achat sont indicatifs. Un prix corrigé à la main est conservé si tu recharges le relevé.

## Utilisation
L'appli est en ligne avec Carnet Auto, à l'adresse `https://<utilisateur>.github.io/<dépôt>/bar/`. Ouvre-la sur ton téléphone puis choisis **Ajouter à l'écran d'accueil**.

## Tests
```bash
node --test bar/tests/core.test.js
```
