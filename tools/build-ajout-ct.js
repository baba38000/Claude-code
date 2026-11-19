// Génère ajouts/ct-2026-11-19.json (CT du 19/11/2026 + historique km des CT) et ajouts/index.json
// Usage : node tools/build-ajout-ct.js [photo_du_PV.jpg]
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'ajouts');
fs.mkdirSync(outDir, { recursive: true });

const DATE = '2026-11-19';
const PV = '26007206';
const SRC = `CT Autosur du 19/11/2026 (PV n° ${PV})`;

const files = [];
const photo = process.argv[2];
if (photo && fs.existsSync(photo)) {
  const buf = fs.readFileSync(photo);
  files.push({ id: 'f-pv-ct-2026-11-19', name: 'PV-CT-2026-11-19-Autosur.jpg', type: 'image/jpeg', size: buf.length, data: buf.toString('base64') });
}

const ctLogId = 'l-ct-2026-11-19';
const add = {
  logs: [
    { id: ctLogId, origin: 'garage', date: DATE, km: null, title: 'Contrôle technique — favorable, 6 défaillances mineures',
      itemIds: ['ct'], cost: null, vendor: 'Autosur', parts: '',
      notes: `PV n° ${PV}. Défaillances mineures (pas de contre-visite) : disques AV légèrement usés, jeu anormal dans la direction, antibrouillard AVD mal orienté, protection amortisseur ARD défectueuse, silentblocs de liaison châssis/essieu ARG + ARD détériorés, panneau de carrosserie ARG endommagé. Prochain CT avant le 19/11/2028. Kilométrage relevé au CT : à compléter (case du PV).` },
    // Historique des kilométrages relevés lors des CT précédents (figurant sur le PV)
    ...[['2018-12-19', 141571], ['2020-12-02', 155831], ['2022-11-30', 167533], ['2024-07-15', 170368], ['2025-04-18', 175546]].map(([d, km]) => ({
      id: 'l-ct-' + d, origin: 'avant', date: d, km, title: 'Contrôle technique (historique PV)', itemIds: ['ct'], cost: null, vendor: '', parts: '',
      notes: 'Kilométrage relevé lors d\'un CT précédent, repris du PV du 19/11/2026.',
    })),
  ],
  docs: [
    { id: 'd-pv-ct-2026-11-19', date: DATE, title: `PV contrôle technique — Autosur n° ${PV}`, category: 'ct', amount: null, vendor: 'Autosur',
      logId: ctLogId, files: files.map(({ id, name, type, size }) => ({ id, name, type, size })),
      notes: 'Favorable avec défaillances mineures. Prochain CT avant le 19/11/2028.' },
  ],
  planItems: [
    { id: 'disques-av', name: 'Disques de frein avant', category: 'Freinage', kind: 'replace', intervalKm: 80000, intervalMonths: null, difficulty: 'moyen',
      parts: 'Paire de disques AV ventilés Ø 324 × 28 mm (ex. Brembo 09.9818.10) + plaquettes AV neuves (Bosch 0 986 424 616 / Ferodo FDB1541) — à valider avec le VIN',
      tips: 'Toujours par paire et avec des plaquettes neuves. Nettoyer le moyeu (rouille) avant de poser le disque neuf, sinon voile. Couple des vis d\'étrier et de chape selon la revue technique ; roues à 105 N·m.' },
  ],
  issues: [
    { id: 'iss-ct-direction', date: DATE, source: SRC, priority: 'high', status: 'open', difficulty: 'pro', itemId: 'geometrie',
      title: 'Jeu anormal dans la direction', detail: '2.3.1.a.1',
      why: 'Il y a du jeu entre le volant et les roues. Causes les plus fréquentes : rotule de biellette de direction (extrémité), biellette axiale (côté crémaillère), rotule de triangle, roulement de roue, plus rarement la crémaillère. Mineur au CT, mais ça touche la sécurité et ça s\'aggrave.',
      todo: 'À diagnostiquer rapidement. Test simple : roues avant en l\'air (cric + chandelles), prendre la roue à 9 h / 3 h et la secouer → jeu = direction (rotules/biellettes) ; à 12 h / 6 h → roulement ou rotule de triangle. Un aide qui tourne le volant pendant que tu regardes les rotules aide à localiser. Après remplacement d\'une pièce de direction : parallélisme obligatoire.',
      parts: 'Selon diagnostic : rotule de direction et/ou biellette axiale (souvent par paire), soufflet de crémaillère.', cost: '≈ 30–80 € de pièces par côté + géométrie ≈ 70 €' },
    { id: 'iss-ct-silentblocs', date: DATE, source: SRC, priority: 'medium', status: 'open', difficulty: 'pro', itemId: 'geometrie',
      title: 'Silentblocs de suspension arrière détériorés (ARG + ARD)', detail: '5.3.3.a.1',
      why: 'Les silentblocs (caoutchoucs) qui relient l\'essieu / les bras arrière à la caisse sont fissurés ou affaissés. Conséquences : bruits sur bosses, tenue de route moins précise, usure irrégulière des pneus arrière.',
      todo: 'Les faire contrôler et remplacer des deux côtés. Souvent besoin d\'une presse ou d\'un extracteur → garage conseillé, sauf si tu as l\'outillage. Faire la géométrie après. Profites-en pour vérifier les autres caoutchoucs du train arrière.',
      parts: 'Silentblocs de liaison essieu/bras arrière (référence selon le bras exact : à identifier au démontage ou avec le VIN).', cost: 'Variable : ≈ 150–400 € en garage selon le nombre de silentblocs' },
    { id: 'iss-ct-disques', date: DATE, source: SRC, priority: 'medium', status: 'open', difficulty: 'moyen', itemId: 'disques-av',
      title: 'Disques de frein avant légèrement usés (AVD + AVG)', detail: '1.1.14.a.1',
      why: 'Les disques approchent de leur épaisseur minimale (gravée sur le disque) ou ont un rebord marqué. Pas dangereux immédiatement.',
      todo: 'Mesure l\'épaisseur au pied à coulisse et compare au minimum gravé. Prévois disques + plaquettes AV ensemble (faisable soi-même avec cric, chandelles, clé dynamométrique). En ville les freins s\'usent vite : anticipe et utilise le frein moteur.',
      parts: 'Disques AV Ø 324 × 28 mm (Brembo 09.9818.10) + plaquettes AV (Bosch 0 986 424 616 / Ferodo FDB1541).', cost: '≈ 120–200 € de pièces' },
    { id: 'iss-ct-amorti', date: DATE, source: SRC, priority: 'low', status: 'open', difficulty: 'moyen',
      title: 'Protection d\'amortisseur arrière droit défectueuse', detail: '5.3.2.c.1',
      why: 'Le soufflet / cache-poussière de l\'amortisseur ARD est abîmé : la tige n\'est plus protégée (poussière, sel) et le joint de l\'amortisseur s\'use plus vite.',
      todo: 'Vérifie qu\'il n\'y a pas de fuite d\'huile sur le corps de l\'amortisseur. Pas de fuite → remplace juste le kit de protection (soufflet + butée). Fuite → amortisseurs AR à changer par paire.',
      parts: 'Kit de protection amortisseur arrière (soufflet + butée), ou paire d\'amortisseurs AR si fuite.', cost: '≈ 20–40 € le kit' },
    { id: 'iss-ct-antibrouillard', date: DATE, source: SRC, priority: 'low', status: 'open', difficulty: 'facile',
      title: 'Antibrouillard avant droit mal orienté (horizontal)', detail: '4.5.2.a.1',
      why: 'Le faisceau du feu antibrouillard AVD part trop à gauche ou à droite.',
      todo: 'Le réglage se fait par une vis sur le bloc antibrouillard (accessible par le pare-chocs ou le passage de roue). Voiture à plat face à un mur à ~5 m, compare avec le côté gauche et aligne. Vérifie aussi que le bloc n\'est pas cassé ou mal fixé (choc).',
      cost: '0 €' },
    { id: 'iss-ct-carrosserie', date: DATE, source: SRC, priority: 'low', status: 'open', difficulty: 'moyen',
      title: 'Panneau de carrosserie arrière gauche endommagé', detail: '6.2.1.a.1',
      why: 'Élément de carrosserie ARG abîmé (enfoncement, déchirure ou pièce mal fixée).',
      todo: 'Vérifie qu\'il n\'y a ni arête coupante ni pièce qui risque de se détacher, et traite la rouille éventuelle (ponçage + antirouille + peinture) pour éviter qu\'elle progresse. Sinon, c\'est esthétique.' },
    { id: 'iss-annonce-ciel', date: '2026-11-14', source: 'Annonce du vendeur', priority: 'low', status: 'open', difficulty: 'moyen',
      title: 'Ciel de toit qui commence à se décoller',
      why: 'La mousse sous le tissu se dégrade avec l\'âge et la chaleur, la colle lâche.',
      todo: 'Petit décollement : colle néoprène en bombe haute température (spéciale garnissage) ou épingles de tapissier. Décollement important : dépose du ciel, retrait de l\'ancienne mousse et re-collage d\'un tissu neuf (faisable soi-même en une journée).',
      cost: '≈ 15–25 € de colle ; 60–100 € avec tissu neuf' },
  ],
};

const patch = { app: 'carnet-auto', kind: 'ajout', id: 'ct-2026-11-19', add, files };
fs.writeFileSync(path.join(outDir, 'ct-2026-11-19.json'), JSON.stringify(patch));
// Ajoute / met à jour l'entrée dans ajouts/index.json sans toucher aux autres
const idxPath = path.join(outDir, 'index.json');
const idx = fs.existsSync(idxPath) ? JSON.parse(fs.readFileSync(idxPath, 'utf8')) : { patches: [] };
idx.patches = idx.patches.filter((x) => x.id !== 'ct-2026-11-19');
idx.patches.unshift({ id: 'ct-2026-11-19', match: ['renault', 'vel'], file: 'ajouts/ct-2026-11-19.json',
    title: 'Contrôle technique du 19/11/2026 (Autosur)',
    description: 'Le CT (favorable, 6 défaillances mineures), la photo du PV dans Factures, les défauts à traiter avec explications, l\'historique des km relevés aux CT depuis 2018 et la fiche « Disques de frein avant ».' });
fs.writeFileSync(idxPath, JSON.stringify(idx, null, 1));
console.log('OK', files.length ? 'avec photo' : 'sans photo', add.issues.length, 'défauts');
