const test = require('node:test');
const assert = require('node:assert');
const C = require('../core.js');

function baseState(extra = {}) {
  const s = C.defaultState();
  s.vehicle = { brand: 'Test', model: 'Car', fuel: 'diesel', gearbox: 'manuelle', timing: 'courroie', firstReg: '2018-03-01', purchaseDate: '2026-01-01', purchaseKm: 100000 };
  s.plan = C.defaultPlan(s.vehicle);
  return Object.assign(s, extra);
}
const at = (iso) => C.parseDate(iso);

test('plan diesel courroie : filtre gazole + distribution, pas de bougies', () => {
  const ids = C.defaultPlan({ fuel: 'diesel', timing: 'courroie' }).map((i) => i.id);
  assert.ok(ids.includes('filtre-gasoil'));
  assert.ok(ids.includes('distribution'));
  assert.ok(!ids.includes('bougies'));
});

test('plan électrique : pas de vidange', () => {
  const ids = C.defaultPlan({ fuel: 'electrique' }).map((i) => i.id);
  assert.ok(!ids.includes('vidange'));
  assert.ok(ids.includes('liquide-frein'));
});

test('addMonths gère les fins de mois', () => {
  assert.strictEqual(C.toISO(C.addMonths(at('2026-01-31'), 1)), '2026-02-28');
});

test('moyenne km et estimation', () => {
  const s = baseState({ readings: [{ id: 'r', date: '2026-03-02', km: 102000 }] });
  // 2000 km en 60 jours
  assert.ok(Math.abs(C.kmPerDay(s) - 2000 / 60) < 0.01);
  assert.strictEqual(C.estimatedKm(s, at('2026-03-02')), 102000);
  assert.strictEqual(C.estimatedKm(s, at('2026-04-01')), 103000);
});

test('statut : inconnu sans historique, puis ok / bientôt / en retard', () => {
  const s = baseState({ readings: [{ id: 'r', date: '2026-03-02', km: 102000 }] });
  const vid = s.plan.find((p) => p.id === 'vidange');
  assert.strictEqual(C.itemStatus(s, vid, at('2026-03-02')).status, 'unknown');
  s.logs.push({ id: 'l', date: '2026-01-05', km: 100100, itemIds: ['vidange'] });
  assert.strictEqual(C.itemStatus(s, vid, at('2026-03-02')).status, 'ok');
  // 20 000 km d'intervalle diesel → dû à 120 100 km ; à 1000 km/mois ~ 33/jour
  // 12 mois après le 05/01/2026 → bientôt mi-décembre, en retard après le 05/01/2027
  assert.strictEqual(C.itemStatus(s, vid, at('2026-12-20')).status, 'soon');
  assert.strictEqual(C.itemStatus(s, vid, at('2027-01-10')).status, 'overdue');
  // Échéance km : 100 100 + 20 000
  s.readings.push({ id: 'r2', date: '2026-06-01', km: 121000 });
  const k = C.itemStatus(s, vid, at('2026-06-01'));
  assert.strictEqual(k.status, 'overdue');
  assert.strictEqual(k.kmLeft, -900);
});

test('CT : 4 ans après 1re immat si pas de log', () => {
  const s = baseState();
  s.vehicle.firstReg = '2024-06-10';
  const ct = s.plan.find((p) => p.id === 'ct');
  const st = C.itemStatus(s, ct, at('2026-11-14'));
  assert.strictEqual(C.toISO(st.dueDate), '2028-06-10');
  assert.strictEqual(st.status, 'ok');
});

test('relevé hebdo vs mensuel', () => {
  const s = baseState({ readings: [{ id: 'r', date: '2026-11-04', km: 110000 }] });
  assert.strictEqual(C.monthlyCheckDue(s, at('2026-11-14')).due, false);
  s.settings.readingFreq = 'weekly';
  assert.strictEqual(C.monthlyCheckDue(s, at('2026-11-14')).due, true);
});

test('ICS valide', () => {
  const s = baseState({ readings: [{ id: 'r', date: '2026-11-01', km: 110000 }] });
  s.logs.push({ id: 'l', date: '2026-01-05', km: 100100, itemIds: ['vidange'] });
  s.settings.readingFreq = 'weekly';
  const ics = C.buildICS(s, at('2026-11-14'));
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /RRULE:FREQ=WEEKLY/);
  assert.match(ics, /RRULE:FREQ=MONTHLY/);
  assert.match(ics, /UID:item-vidange@carnet-auto/);
  assert.strictEqual((ics.match(/BEGIN:VEVENT/g) || []).length, (ics.match(/END:VEVENT/g) || []).length);
  for (const line of ics.split('\r\n')) assert.ok(line.length <= 75, line);
});

test('fiche Vel Satis : plan ajusté + éléments ajoutés + données de départ', () => {
  global.window = {};
  require('../tech-presets.js');
  const p = window.TECH_PRESETS.find((x) => x.label.startsWith('Renault Vel Satis'));
  const s = baseState();
  s.vehicle.timing = 'chaine';
  s.plan = C.defaultPlan(s.vehicle);
  C.applyPreset(s, p);
  assert.strictEqual(s.plan.find((i) => i.id === 'vidange').intervalKm, 15000);
  assert.ok(s.plan.some((i) => i.id === 'diag-fap'));
  assert.ok(s.tech.length > 30);
  const start = require('../demarrage-vel-satis.json');
  assert.strictEqual(start.app, 'carnet-auto');
  assert.strictEqual(start.state.vehicle.timing, 'chaine');
});

test('pleins : complétion des valeurs, prix moyen pondéré, conso plein à plein', () => {
  const f = C.completeFuel({ liters: 50, total: 90 });
  assert.strictEqual(f.price, 1.8);
  assert.strictEqual(C.completeFuel({ total: 100, price: 2 }).liters, 50);
  const s = baseState({ fuels: [
    { id: 'a', date: '2026-01-02', km: 100000, liters: 60, total: 108, price: 1.8, full: true },
    { id: 'b', date: '2026-01-10', km: 100500, liters: 20, total: 40, price: 2, full: false },
    { id: 'c', date: '2026-01-20', km: 101000, liters: 45, total: 81, price: 1.8, full: true },
  ] });
  const st = C.fuelStats(s);
  assert.strictEqual(st.count, 3);
  assert.ok(Math.abs(st.avgPrice - 229 / 125) < 1e-9);
  // (20 + 45) L sur 1000 km = 6,5 L/100
  assert.ok(Math.abs(st.conso - 6.5) < 1e-9);
  // un plein avec km compte comme relevé
  assert.strictEqual(C.monthlyCheckDue(s, C.parseDate('2026-01-25')).due, false);
});

test('ajout CT : fusion sans doublon, CT suivant en 2028, moyenne km basée sur l\'achat', () => {
  const s = JSON.parse(JSON.stringify(require('../demarrage-vel-satis.json').state));
  s.vehicle.purchaseDate = '2026-11-15';
  s.vehicle.purchaseKm = 195200;
  const p = require('../ajouts/ct-2026-11-19.json');
  const n = C.mergeData(s, p.add);
  assert.ok(n >= 14);
  assert.strictEqual(C.mergeData(s, p.add), 0); // 2e application : rien
  const ct = s.plan.find((i) => i.id === 'ct');
  const st = C.itemStatus(s, ct, C.parseDate('2026-11-19'));
  assert.strictEqual(C.toISO(st.dueDate), '2028-11-19');
  // l'historique de l'ancien propriétaire (2018…) ne fausse pas la moyenne
  assert.ok(Math.abs(C.kmPerDay(s) * 30.44 - 1000) > 1); // historique récent utilisé
  assert.ok(s.issues.some((i) => i.id === 'iss-ct-direction' && i.priority === 'high'));
});

test('ajout vidange 15 000 km : met à jour un plan existant', () => {
  const s = JSON.parse(JSON.stringify(require('../demarrage-vel-satis.json').state));
  s.plan.find((i) => i.id === 'vidange').intervalKm = 10000;
  C.mergeData(s, require('../ajouts/vidange-15000.json').add);
  const vid = s.plan.find((i) => i.id === 'vidange');
  assert.strictEqual(vid.intervalKm, 15000);
  assert.strictEqual(vid.intervalMonths, 12);
  // dernière vidange 189 200 km → prochaine à 204 200 km
  assert.strictEqual(C.itemStatus(s, vid, C.parseDate('2026-11-19')).dueKm, 204200);
});

test('ajout FAP : journal + défaut + doc', () => {
  const s = JSON.parse(JSON.stringify(require('../demarrage-vel-satis.json').state));
  const n = C.mergeData(s, require('../ajouts/fap-2026-09.json').add);
  assert.strictEqual(n, 3);
  const st = C.itemStatus(s, s.plan.find((i) => i.id === 'diag-fap'), C.parseDate('2026-11-19'));
  assert.strictEqual(C.toISO(st.dueDate), '2027-09-15');
});
