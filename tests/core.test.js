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
