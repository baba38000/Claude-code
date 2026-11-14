const test = require('node:test');
const assert = require('node:assert');
const C = require('../core.js');
const A = require('../advice.js');

const at = (iso) => C.parseDate(iso);
function vel(extra = {}) {
  const s = JSON.parse(JSON.stringify(require('../demarrage-vel-satis.json').state));
  s.vehicle.purchaseDate = '2026-01-01';
  s.vehicle.purchaseKm = 195000;
  s.logs = [{ id: 'v', origin: 'moi', date: '2026-01-05', km: 195100, itemIds: ['vidange'] }];
  return Object.assign(s, extra);
}
const fill = (id, date, km, liters, price, more = {}) => Object.assign({ id, date, km, liters, price, total: +(liters * price).toFixed(2), full: true }, more);
const ids = (s, now = '2026-04-01') => A.compute(s, at(now)).map((a) => a.id);

test('chiffres normaux : aucun conseil', () => {
  // ~1 200 km/mois, ~8 L/100 (attendu ≈ 8,4 pour 80 % ville)
  const s = vel({ fuels: [
    fill('a', '2026-01-10', 195400, 50, 1.80, { station: 'A' }),
    fill('b', '2026-02-05', 196400, 80, 1.79, { station: 'A' }),
    fill('c', '2026-03-01', 197400, 81, 1.81, { station: 'A' }),
    fill('d', '2026-03-28', 198400, 79, 1.80, { station: 'A' }),
  ] });
  assert.deepStrictEqual(ids(s), []);
});

test('consommation trop élevée → conseil', () => {
  const s = vel({ fuels: [
    fill('a', '2026-01-10', 195400, 50, 1.8),
    fill('b', '2026-02-05', 195800, 50, 1.8),
    fill('c', '2026-03-01', 196200, 50, 1.8),
  ] });
  const adv = A.compute(s, at('2026-04-01'));
  const c = adv.find((a) => a.id === 'conso-high');
  assert.ok(c, 'conso-high attendu');
  assert.ok(['warn', 'bad'].includes(c.level)); // 12,5 L/100 vs ≈ 8,4
});

test('20 L/100 → conseil ; 40 L/100 → donnée improbable', () => {
  const s = vel({ fuels: [fill('a', '2026-01-10', 195400, 50, 1.8), fill('b', '2026-02-05', 195650, 50, 1.8)] });
  assert.ok(ids(s).includes('conso-high'));
  s.fuels[1].km = 195525;
  assert.ok(ids(s).includes('conso-data'));
});

test('station moins chère', () => {
  const s = vel({ fuels: [
    fill('a', '2026-01-10', 195400, 40, 1.85, { station: 'Total' }),
    fill('b', '2026-02-05', 196000, 40, 1.86, { station: 'Total' }),
    fill('c', '2026-02-20', 196400, 40, 1.87, { station: 'Total' }),
    fill('d', '2026-03-01', 196800, 40, 1.75, { station: 'Leclerc' }),
    fill('e', '2026-03-20', 197300, 40, 1.76, { station: 'Leclerc' }),
  ] });
  assert.ok(ids(s).includes('price-station'));
});

test('diesel FAP, 80 % ville, peu de km → conseil FAP', () => {
  const s = vel({ readings: [{ id: 'r', date: '2026-03-31', km: 196200 }] });
  assert.ok(ids(s).includes('fap-city'));
});

test('problème récurrent au check-up', () => {
  const s = vel({ readings: [
    { id: 'r1', date: '2026-02-01', km: 196000, checks: { pression: 'watch', huile: 'ok' } },
    { id: 'r2', date: '2026-03-01', km: 197000, checks: { pression: 'bad', huile: 'ok' } },
  ] });
  const l = ids(s);
  assert.ok(l.includes('recurring-pression'));
  assert.ok(!l.includes('recurring-huile'));
});

test('usure plus rapide que prévu', () => {
  const s = vel();
  s.logs.push({ id: 'p1', origin: 'moi', date: '2026-01-10', km: 195200, itemIds: ['plaquettes-av'] });
  s.logs.push({ id: 'p2', origin: 'moi', date: '2026-03-10', km: 215000, itemIds: ['plaquettes-av'] });
  assert.ok(ids(s).includes('wear-plaquettes-av'));
});

test('intervalle de vidange trop long en usage urbain', () => {
  const s = vel();
  s.plan.find((p) => p.id === 'vidange').intervalKm = 20000;
  assert.ok(ids(s).includes('plan-severe'));
  s.settings.urbanShare = 20;
  assert.ok(!ids(s).includes('plan-severe'));
});
