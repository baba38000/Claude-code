/*
 * Fiches techniques constructeur.
 * Chaque fiche : { label, match: [mots devant tous apparaître dans marque/modèle/moteur], rows: [...], plan: {idElement: {intervalKm, intervalMonths, parts}} }
 * Rubriques (section) : id, fluids, parts, torques, tires, elec, misc
 * Les fiches spécifiques doivent être placées AVANT la fiche générique (match: []).
 */
window.TECH_PRESETS = [
  // --- Fiches spécifiques véhicule : à ajouter ici ---
  {
    label: 'Renault Vel Satis 2.0 dCi 175 FAP (M9R) — BVM6',
    match: ['vel', '2.0'],
    // Consommations de référence approximatives (homologation ≈ 9 L ville / 5,8 L route) : sert aux conseils
    conso: { urban: 9.0, road: 5.8 },
    // Plan « Recommandé » (plus strict que le constructeur : âge, km, FAP)
    plan: {
      'vidange': { intervalKm: 15000, intervalMonths: 12, parts: 'Huile 5W30 ACEA C4, norme Renault RN0720 (compatible FAP) — ex. Elf Evolution 900 DID 5W30, Total Quartz Ineo MC3/RCP 5W30 (vérifier « RN0720 » sur le bidon). Prévoir 7 L (capacité à confirmer, voir Doc technique). Filtre à huile MANN HU 618 x (équiv. Purflux L470). Joint de bouchon de vidange.' },
      'filtre-air': { intervalKm: 40000, intervalMonths: 24, parts: 'Filtre à air — MANN C 24 123/2 (à vérifier sur l\'ancien filtre). Réf. Renault vue sur 2.0 dCi 150 : 82 00 799 782.' },
      'filtre-gasoil': { intervalKm: 60000, intervalMonths: 36, parts: 'Filtre à gazole — réf. Renault 82 00 780 962 ou 82 00 780 950 selon montage (avec ou sans connecteur de capteur d\'eau : regarder le filtre en place avant de commander).' },
      'filtre-habitacle': { intervalKm: 20000, intervalMonths: 12, parts: 'Filtre d\'habitacle MANN CU 2149 (charbon actif : CUK 2149), 210 × 208 × 30 mm.' },
      'liquide-frein': { intervalKm: null, intervalMonths: 24, parts: 'Liquide DOT 4 (~1 L). Purge à 2 personnes ou purgeur.' },
      'refroidissement': { intervalKm: 120000, intervalMonths: 48, parts: 'Liquide Renault Glacéo Type D (ou équivalent « Renault Type D »), à ne pas mélanger avec un autre type. Capacité à confirmer.' },
      'courroie-acc': { intervalKm: 160000, intervalMonths: 72, parts: 'Kit courroie d\'accessoires + galets. Réf. vue sur 2.0 dCi 150 : Renault 77 01 476 645 / SKF VKMA 36086 (à confirmer pour le 175 : regarder la longueur 6PK… gravée sur la courroie).', tips: 'Sans facture de remplacement : à changer par précaution (préconisation 160 000 km ou 6 ans). Faire une photo du passage de la courroie avant démontage. Écouter les sifflements à froid.' },
      'chaine-check': { tips: 'Moteur M9R à chaîne : pas de remplacement périodique. Écouter un cliquetis au démarrage à froid (chaîne allongée) → faire contrôler. Une huile non conforme ou vidangée trop tard use la chaîne : respecter la RN0720 et l\'intervalle de vidange (15 000 km / 1 an).' },
      'fap': { name: 'Régénération FAP (autoroute 20–30 min)', tips: 'Rouler au moins 20 à 30 minutes sur voie rapide/autoroute tous les 10 à 15 jours, moteur chaud. Ne pas couper le moteur pendant une régénération (ventilateur qui tourne après l\'arrêt, ralenti plus haut). Nettoyant FAP en prévention possible tous les 3 000–5 000 km juste avant un trajet autoroute (il ne débouche pas un FAP déjà colmaté). Pas d\'additif FAP à remplir sur ce moteur.' },
      'niveaux': { tips: 'Jauge d\'huile à chaque plein ou toutes les 2 semaines : sur ce moteur à FAP, un niveau qui MONTE = gazole dans l\'huile (régénérations incomplètes) → vidange anticipée + rouler sur autoroute. Liquide de refroidissement (moteur froid), liquide de frein, lave-glace.' },
    },
    addItems: [
      { id: 'diag-fap', name: 'Diagnostic FAP / EGR (valise)', category: 'Moteur', kind: 'check', intervalKm: 15000, intervalMonths: 12, difficulty: 'pro',
        parts: '—', tips: 'À chaque révision : lecture des défauts, taux de colmatage / masse de suies du FAP, état de la vanne EGR. Possible soi-même avec une interface OBD + logiciel compatible Renault (ex. DDT4ALL / Can Clip clone), sinon garage.' },
      { id: 'plaquettes-ar', name: 'Plaquettes de frein arrière', category: 'Freinage', kind: 'replace', intervalKm: 60000, intervalMonths: null, difficulty: 'moyen',
        parts: 'Jeu de plaquettes AR (réf. selon VIN)', tips: 'Contrôler à chaque contrôle freins. Frein de parking électrique possible selon version : vérifier la procédure (mode maintenance) avant de repousser les pistons.' },
      { id: 'huile-bvm', name: 'Vidange boîte manuelle PK6', category: 'Transmission', kind: 'replace', intervalKm: 120000, intervalMonths: 96, difficulty: 'moyen',
        parts: 'Huile Elf Tranself NFP 75W80 (ou TRX 75W80 d\'origine) — ~2,4 à 2,6 L (à confirmer)', tips: 'Renault ne prévoit pas de vidange périodique, mais à ~200 000 km une vidange préventive soulage les synchros de la PK6 (réputés fragiles et sensibles à l\'huile). Utiliser STRICTEMENT la norme préconisée. Remplir par l\'orifice de remplissage jusqu\'à débordement.' },
      { id: 'leve-vitres', name: 'Lève-vitres arrière (défaut connu)', category: 'Carrosserie', kind: 'check', intervalKm: null, intervalMonths: 6, difficulty: 'moyen',
        parts: 'Mécanisme / moteur de lève-vitre AR (souvent le câble ou le moteur)', tips: 'Signalé non fonctionnel à l\'achat (les 2 arrière). Vérifier d\'abord le fusible et l\'interrupteur de sécurité enfants, puis la tension au connecteur du moteur. Défaut fréquent sur Vel Satis.' },
    ],
    rows: [
      // Identification
      { section: 'id', label: 'Modèle', value: 'Renault Vel Satis phase 2 (2005–2009), type BJ0B' },
      { section: 'id', label: 'Moteur', value: '2.0 dCi 175 ch (127 kW) FAP — code M9R (variante 762/763 à lire sur la plaque moteur), common rail, turbo, 360 N·m' },
      { section: 'id', label: 'Boîte', value: 'Manuelle 6 rapports PK6' },
      { section: 'id', label: 'Distribution', value: 'Chaîne — sans remplacement périodique' },
      { section: 'id', label: 'Puissance fiscale / Crit\'Air', value: '11 CV · Crit\'Air 3' },
      { section: 'id', label: 'Finition', value: 'Initiale probable (cuir beige, bois, Carminat)', notes: 'À confirmer : champ D.2 de la carte grise', verify: true },
      { section: 'id', label: 'N° VIN', value: 'Case E de la carte grise — à utiliser pour valider chaque référence de pièce', verify: true },

      // Liquides
      { section: 'fluids', label: 'Huile moteur', value: '5W30 ACEA C4 — norme Renault RN0720 (obligatoire avec FAP)', alt: 'Elf Evolution 900 DID 5W30 · Total Quartz Ineo MC3 / RCP 5W30 (vérifier la mention RN0720 sur le bidon)' },
      { section: 'fluids', label: 'Capacité huile moteur', value: 'Sources divergentes : ~5,9 L filtre compris (M9R 175 sur Laguna) à 7,4 L (catalogues). Acheter 7 L, remplir ~5,5 L puis compléter à la jauge sans dépasser MAX.', verify: true },
      { section: 'fluids', label: 'Huile de boîte PK6', value: 'Elf Tranself NFP 75W80 (remplace TRX 75W80) — ~2,4 à 2,6 L', ref: '77 11 143 534 (TRX 75W80)', notes: 'Synchros sensibles à l\'huile : ne pas mettre une GL-5 générique.', verify: true },
      { section: 'fluids', label: 'Liquide de refroidissement', value: 'Renault Glacéo Type D (ou équivalent homologué Type D) — capacité à confirmer', verify: true },
      { section: 'fluids', label: 'Liquide de frein', value: 'DOT 4 — ~1 L pour une purge complète' },
      { section: 'fluids', label: 'Gaz de climatisation', value: 'R134a — quantité sur l\'étiquette sous le capot', verify: true },
      { section: 'fluids', label: 'Additif FAP', value: 'Aucun (FAP sans additif, contrairement aux PSA Eolys)' },

      // Pièces
      { section: 'parts', label: 'Filtre à huile', ref: '', alt: 'MANN HU 618 x · Purflux L470', notes: 'MANN liste HU 618 x pour Vel Satis 2.0 dCi M9R à partir de 05/2006.' },
      { section: 'parts', label: 'Filtre à air', ref: '82 00 799 782 (vu sur 2.0 dCi 150)', alt: 'MANN C 24 123/2', verify: true },
      { section: 'parts', label: 'Filtre à gazole', ref: '82 00 780 962 ou 82 00 780 950', notes: 'Deux montages existent (avec ou sans connecteur de détecteur d\'eau) : regarder le filtre en place.', verify: true },
      { section: 'parts', label: 'Filtre d\'habitacle', alt: 'MANN CU 2149 (CUK 2149 charbon actif)', value: '210 × 208 × 30 mm' },
      { section: 'parts', label: 'Plaquettes avant', alt: 'Bosch 0 986 424 616 (BP345) · Ferodo FDB1541 · TRW GDB1468', notes: 'Références vues pour 2.0 dCi phase 2 : vérifier avec le VIN (deux montages d\'étriers selon versions).', verify: true },
      { section: 'parts', label: 'Disques avant', value: 'Ventilés Ø 324 × 28 mm, 5 trous, entraxe 108 mm', alt: 'Brembo 09.9818.10 / 09.9818.11 · Bosch 0 986 479 565', notes: 'Épaisseur mini gravée sur le disque.', verify: true },
      { section: 'parts', label: 'Kit courroie d\'accessoires', ref: '77 01 476 645 (vu sur 2.0 dCi 150)', alt: 'SKF VKMA 36086', notes: 'Lire la longueur 6PK… sur la courroie en place.', verify: true },
      { section: 'parts', label: 'Balais d\'essuie-glace', value: 'Longueurs à mesurer sur la voiture', verify: true },

      // Couples
      { section: 'torques', label: 'Écrous / vis de roue', value: '105 N·m (10,5 daN·m) — serrage en étoile, re-contrôle après 50 km' },
      { section: 'torques', label: 'Bouchon de vidange moteur', value: '~30 N·m avec joint neuf (valeur usuelle, à confirmer)', verify: true },
      { section: 'torques', label: 'Filtre à huile', value: 'Serrage à la main + 3/4 de tour après contact du joint (joint huilé)' },

      // Pneus
      { section: 'tires', label: 'Dimension d\'origine', value: '225/55 R17 (jantes alliage 17″, entraxe 5 × 108)' },
      { section: 'tires', label: 'Pressions (à froid)', value: '≈ 2,2 bar AV / 2,0 bar AR (en charge : AV +0,1 à 0,2)', notes: 'La valeur de l\'étiquette de portière conducteur fait foi.', verify: true },
      { section: 'tires', label: 'Pneus actuels', value: '4 pneus été changés en 2025 (annonce) + 2 pneus 4 saisons fournis', notes: 'Noter marque / DOT (date de fabrication) de chaque pneu.' },

      // Électricité
      { section: 'elec', label: 'Batterie 12 V', value: '80–85 Ah, 740–800 A, ~315 × 175 × 190 mm', alt: 'Bosch S4 0 092 S40 110 (80 Ah / 740 A) · Bosch S5 0 092 S50 110 (85 Ah / 800 A)', verify: true },
      { section: 'elec', label: 'Feux de croisement xénon', value: 'D2S 35 W (culot Pk32d-2) — plusieurs sources citent D1S', notes: 'Vérifier l\'inscription sur l\'ampoule en place. Haute tension : débrancher la batterie avant intervention.', verify: true },
      { section: 'elec', label: 'Cartes mains-libres', value: '2 cartes fournies — pile de la carte : modèle à lire à l\'intérieur de la carte', verify: true },

      // Divers
      { section: 'misc', label: 'Défauts connus à l\'achat', value: 'Lève-vitres arrière non fonctionnels (×2) · ciel de toit qui commence à se décoller · quelques rayures' },
      { section: 'misc', label: 'Accessoire fourni', value: 'Attelage d\'occasion, jamais installé' },
      { section: 'misc', label: 'Points de vigilance Vel Satis', value: 'Électronique (carte, lève-vitres, capteurs), dilution de l\'huile et colmatage FAP en usage urbain, synchros de boîte PK6, silentblocs de train avant sur les gros kilométrages.' },
      { section: 'misc', label: 'Sources', value: 'Fiche Vel Satis 2.0 dCi (Planète Renault, vehicule.3online.fr, L\'argus) ; catalogues MANN, Oscaro, Mister Auto, Autodoc ; rensatis.com ; forumvelsatis.fr. Le carnet d\'entretien et le catalogue Renault (VIN) font foi.' },
    ],
  },

  // --- Fiche générique (squelette à compléter) ---
  {
    label: 'Modèle vierge à compléter',
    match: [],
    rows: [
      { section: 'id', label: 'N° VIN', value: 'Case E de la carte grise', verify: true },
      { section: 'id', label: 'Code moteur', value: 'Sur le bloc moteur / étiquette, ou via le VIN', verify: true },
      { section: 'id', label: 'Type mine / CNIT', value: 'Case D.2 / D.2.1 de la carte grise', verify: true },
      { section: 'fluids', label: 'Huile moteur', value: 'Norme constructeur + viscosité — capacité avec filtre', verify: true },
      { section: 'fluids', label: 'Liquide de refroidissement', value: 'Type (G12/G13, OAT…) — capacité', verify: true },
      { section: 'fluids', label: 'Liquide de frein', value: 'DOT 4 (le plus souvent) — ~1 L pour une purge', verify: true },
      { section: 'fluids', label: 'Huile de boîte', value: 'Norme — capacité', verify: true },
      { section: 'fluids', label: 'Gaz de climatisation', value: 'R134a ou R1234yf — quantité (étiquette sous le capot)', verify: true },
      { section: 'parts', label: 'Filtre à huile', ref: '', verify: true },
      { section: 'parts', label: 'Filtre à air', ref: '', verify: true },
      { section: 'parts', label: 'Filtre d\'habitacle', ref: '', verify: true },
      { section: 'parts', label: 'Filtre à carburant', ref: '', verify: true },
      { section: 'parts', label: 'Bougies (essence)', ref: '', verify: true },
      { section: 'parts', label: 'Plaquettes avant', ref: '', verify: true },
      { section: 'parts', label: 'Disques avant (Ø × épaisseur, épaisseur mini)', ref: '', verify: true },
      { section: 'parts', label: 'Plaquettes / mâchoires arrière', ref: '', verify: true },
      { section: 'parts', label: 'Kit distribution', ref: '', verify: true },
      { section: 'parts', label: 'Courroie d\'accessoires', ref: '', verify: true },
      { section: 'parts', label: 'Balais d\'essuie-glace (longueurs)', ref: '', verify: true },
      { section: 'torques', label: 'Écrous / vis de roue', value: 'souvent 90–120 N·m', verify: true },
      { section: 'torques', label: 'Bouchon de vidange', value: 'souvent 25–35 N·m', verify: true },
      { section: 'torques', label: 'Bougies', value: 'souvent 20–28 N·m', verify: true },
      { section: 'torques', label: 'Vis d\'étrier / chape de frein', value: '', verify: true },
      { section: 'tires', label: 'Dimension pneus', value: 'Sur le flanc du pneu', verify: true },
      { section: 'tires', label: 'Pressions', value: 'Étiquette portière conducteur / trappe carburant', verify: true },
      { section: 'elec', label: 'Batterie 12 V', value: 'Capacité (Ah), courant de démarrage (A), dimensions, Start&Stop (EFB/AGM) ?', verify: true },
      { section: 'elec', label: 'Ampoules', value: 'Croisement / route / antibrouillard / clignotants / stop / veilleuses', verify: true },
    ],
  },
];
