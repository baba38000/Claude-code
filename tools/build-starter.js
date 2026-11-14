// Génère demarrage-vel-satis.json (données de départ importables dans l'appli).
// Usage : node tools/build-starter.js
const fs = require('fs');
const path = require('path');
const C = require('../core.js');
global.window = {};
require('../tech-presets.js');

const preset = window.TECH_PRESETS.find((p) => p.label.startsWith('Renault Vel Satis'));
const s = C.defaultState();
s.vehicle = {
  brand: 'Renault', model: 'Vel Satis', name: 'Renault Vel Satis', engine: '2.0 dCi 175 FAP', engineCode: 'M9R',
  year: '2006', fuel: 'diesel', gearbox: 'manuelle', timing: 'chaine', plate: '', firstReg: '',
  purchaseDate: '', purchaseKm: '195200', purchasePrice: '', owners: '', vin: '',
  oilSpec: '5W30 ACEA C4 RN0720 — ~6 à 7 L (à confirmer à la jauge)',
  tireSize: '225/55 R17', tirePressure: '≈ 2,2 / 2,0 bar (voir étiquette portière)', battery: '80–85 Ah, 740–800 A',
  notes: [
    'Annonce : 2.0 dCi 173 ch (175 ch constructeur), 2006, ~195 200 km, bon état général, chaîne de distribution.',
    'Équipements : xénon, sièges chauffants, 2 cartes mains-libres, feux & essuie-glaces auto, clim auto (fonctionnelle), régulateur/limiteur, radars AV/AR, Carminat, cuir beige, bois.',
    'Factures d\'entretien disponibles → les récupérer et les saisir en « Avant achat » + photos dans Factures.',
    '4 pneus été changés en 2025 ; 2 pneus 4 saisons fournis.',
    'Vidange avec tous les filtres en mai 2026, ~6 000 km avant la vente.',
    'CT fait avant la vente (à saisir dans le journal avec la date du PV).',
    'Attelage d\'occasion fourni, jamais installé.',
    'Défauts signalés : 2 lève-vitres arrière HS, ciel de toit qui commence à se décoller, quelques rayures.',
  ].join('\n'),
};
s.plan = C.defaultPlan(s.vehicle);
C.applyPreset(s, preset);
s.logs = [
  { id: 'l-hist-vidange', origin: 'avant', date: '2026-05-15', km: 189200, title: 'Vidange + tous les filtres (selon annonce)',
    itemIds: ['vidange', 'filtre-air', 'filtre-gasoil', 'filtre-habitacle'], cost: null, vendor: '', parts: '',
    notes: 'D\'après l\'annonce : « vidange avec tous les filtres en mai, environ 6 000 km ». Date et kilométrage exacts à corriger avec la facture.' },
  { id: 'l-hist-pneus', origin: 'avant', date: '2025-06-01', km: null, title: '4 pneus été neufs (selon annonce)',
    itemIds: [], cost: null, vendor: '', parts: '', notes: 'Date approximative (« l\'année dernière »). Noter marque et DOT des pneus.' },
];
s.settings.readingFreq = 'weekly';
s.settings.urbanShare = 80;

const out = { app: 'carnet-auto', exportedAt: new Date().toISOString(), state: s, files: [] };
fs.writeFileSync(path.join(__dirname, '..', 'demarrage-vel-satis.json'), JSON.stringify(out, null, 1));
console.log('OK', s.plan.length, 'éléments de plan,', s.tech.length, 'lignes de doc technique');
