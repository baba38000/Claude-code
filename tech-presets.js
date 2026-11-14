/*
 * Fiches techniques constructeur.
 * Chaque fiche : { label, match: [mots devant tous apparaître dans marque/modèle/moteur], rows: [...], plan: {idElement: {intervalKm, intervalMonths, parts}} }
 * Rubriques (section) : id, fluids, parts, torques, tires, elec, misc
 * Les fiches spécifiques doivent être placées AVANT la fiche générique (match: []).
 */
window.TECH_PRESETS = [
  // --- Fiches spécifiques véhicule : à ajouter ici ---

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
