const test = require('node:test');
const assert = require('node:assert');
const C = require('../core.js');
const S = require('../starter.js');

function st(overhead = 0) {
  const s = C.defaultState();
  Object.assign(s, S.build());
  s.settings.overhead = overhead;
  return s;
}
const item = (s, id) => s.items.find((i) => i.id === id);

test('coût unitaire avec pertes : fût 30 L à 80 € HT, 6 % de perte', () => {
  const uc = C.unitCost({ packPrice: 80, packSize: 3000, lossPct: 6 });
  assert.ok(Math.abs(uc - 80 / 2820) < 1e-9);
});

test('règle des ×3 : une pinte à 1,50 € de coût complet → 4,50 € minimum', () => {
  const s = C.defaultState();
  s.products = [{ id: 'f', packPrice: 30, packSize: 3000, lossPct: 0 }]; // 0,01 €/cl → 0,50 € de matière
  s.settings.overhead = 1; // + 1 € de charge = 1,50 €
  const a = C.analyzeItem(s, { name: 'Pinte', category: 'pression', price: 4, recipe: [{ productId: 'f', qty: 50 }] });
  assert.strictEqual(C.round2(a.cost), 1.5);
  assert.strictEqual(a.minPrice, 4.5);
  assert.strictEqual(a.status, 'low');
  const ok = C.analyzeItem(s, { name: 'Pinte', category: 'pression', price: 4.5, recipe: [{ productId: 'f', qty: 50 }] });
  assert.strictEqual(ok.status, 'ok');
});

test('charge propre à un article prioritaire sur la charge globale', () => {
  const s = st(0.2);
  assert.strictEqual(C.overheadOf(s, item(s, 'm-pinte')), 0.2);
  assert.strictEqual(C.overheadOf(s, Object.assign({}, item(s, 'm-pinte'), { overhead: 0.5 })), 0.5);
});

test('coef cible de catégorie au-dessus du minimum', () => {
  const s = st();
  s.settings.coefs.spiritueux = 5;
  assert.strictEqual(C.targetCoef(s, item(s, 'm-vodka')), 5);
  s.settings.coefs.spiritueux = 2; // jamais sous le plancher
  assert.strictEqual(C.targetCoef(s, item(s, 'm-vodka')), 3);
});

test('arrondi des prix au pas supérieur', () => {
  assert.strictEqual(C.roundPrice(4.01, 0.1), 4.1);
  assert.strictEqual(C.roundPrice(4.0000001, 0.1), 4);
  assert.strictEqual(C.roundPrice(4.2, 0.5), 4.5);
});

test('vente : décrémente le stock, suppression : le remet', () => {
  const s = st();
  s.products.find((p) => p.id === 'p-biere-fut').stock = 3000;
  const sale = C.recordSale(s, 'm-pinte', { qty: 2 });
  assert.strictEqual(s.products.find((p) => p.id === 'p-biere-fut').stock, 2900);
  C.deleteSale(s, sale.id);
  assert.strictEqual(s.products.find((p) => p.id === 'p-biere-fut').stock, 3000);
});

test('offert : coût compté, pas de chiffre d\'affaires', () => {
  const s = st();
  C.recordSale(s, 'm-pinte', { type: 'offert' });
  C.recordSale(s, 'm-pinte', { pay: 'cash' });
  const sm = C.summarize(s.sales);
  assert.strictEqual(sm.count, 1);
  assert.strictEqual(sm.ttc, 6.5);
  assert.ok(sm.offered > 0);
  assert.strictEqual(sm.cash, 6.5);
});

test('journée d\'exploitation : 1 h du matin = veille', () => {
  assert.strictEqual(C.businessDate(new Date(2026, 10, 18, 1, 30).getTime(), 6), '2026-11-17');
  assert.strictEqual(C.businessDate(new Date(2026, 10, 18, 7, 0).getTime(), 6), '2026-11-18');
});

test('achat : ajoute au stock, met à jour le prix et l\'historique ; annulation à la modification', () => {
  const s = st();
  const pur = C.savePurchase(s, { date: '2026-11-10', supplier: 'X', lines: [{ productId: 'p-vodka', packs: 3, packPrice: 15 }] });
  const p = s.products.find((x) => x.id === 'p-vodka');
  assert.strictEqual(p.stock, 210);
  assert.strictEqual(p.packPrice, 15);
  assert.strictEqual(p.priceHistory.length, 1);
  C.savePurchase(s, Object.assign({}, pur, { lines: [{ productId: 'p-vodka', packs: 1, packPrice: 15 }] }));
  assert.strictEqual(p.stock, 70);
  assert.strictEqual(s.purchases.length, 1);
});

test('inventaire : écart valorisé et stock recalé', () => {
  const s = st();
  const p = s.products.find((x) => x.id === 'p-vodka');
  p.stock = 140;
  const inv = C.saveInventory(s, '2026-11-17', { 'p-vodka': 105 });
  assert.strictEqual(inv.lines[0].diff, -35);
  assert.strictEqual(inv.lines[0].value, -7);
  assert.strictEqual(p.stock, 105);
});

test('bon de commande : remonte au stock cible en conditionnements entiers', () => {
  const s = st();
  const p = s.products.find((x) => x.id === 'p-vodka');
  p.stock = 30; p.minStock = 70; p.parStock = 210;
  const o = C.orderList(s).find((x) => x.product.id === 'p-vodka');
  assert.strictEqual(o.packs, 3);
});

test('tâches : quotidienne faite hier → due aujourd\'hui', () => {
  const ref = C.parseDate('2026-11-17');
  const t = { freq: 'daily', lastDone: '2026-11-16' };
  assert.strictEqual(C.taskStatus(t, ref).status, 'today');
  assert.strictEqual(C.taskStatus({ freq: 'daily', lastDone: '2026-11-17' }, ref).status, 'done');
  assert.strictEqual(C.taskStatus({ freq: 'once', due: '2026-11-15' }, ref).status, 'overdue');
});

test('clôture : écart espèces', () => {
  const s = st();
  C.recordSale(s, 'm-pinte', { pay: 'cash', ts: new Date(2026, 10, 17, 20).getTime() });
  const c = C.closingFor(s, '2026-11-17', 155, 150);
  assert.strictEqual(c.expected, 156.5);
  assert.strictEqual(c.diff, -1.5);
});

test('conseil : article sous ×3 signalé', () => {
  const s = st(0.1);
  item(s, 'm-pinte').price = 2;
  const adv = C.advice(s);
  assert.ok(adv.some((a) => a.level === 'bad' && /×3/.test(a.title)));
});

test('carte de départ : tous les coûts calculables', () => {
  const s = st(0.1);
  const m = C.analyzeMenu(s);
  assert.ok(m.every((a) => a.status !== 'unknown'), m.filter((a) => a.status === 'unknown').map((a) => a.item.name).join());
});

test('charges : mensuelle, trimestrielle, annuelle, ponctuelle, avec fin', () => {
  const m = { date: '2026-01-05', amount: 1200, freq: 'monthly' };
  assert.strictEqual(C.chargeInMonth(m, '2025-12'), 0);
  assert.strictEqual(C.chargeInMonth(m, '2026-11'), 1200);
  const q = { date: '2026-01-10', amount: 300, freq: 'quarterly' };
  assert.strictEqual(C.chargeInMonth(q, '2026-04'), 300);
  assert.strictEqual(C.chargeInMonth(q, '2026-05'), 0);
  const y = { date: '2025-03-01', amount: 1200, freq: 'yearly' };
  assert.strictEqual(C.chargeInMonth(y, '2026-03'), 1200);
  assert.strictEqual(C.chargeMonthlyAvg(y), 100);
  assert.strictEqual(C.chargeInMonth({ date: '2026-11-02', amount: 80 }, '2026-11'), 80);
  assert.strictEqual(C.chargeInMonth({ date: '2026-01-01', amount: 50, freq: 'monthly', end: '2026-06-30' }, '2026-07'), 0);
});

test('bilan du mois : recettes − achats − charges', () => {
  const s = st();
  s.settings.overhead = 0;
  C.recordSale(s, 'm-pinte', { qty: 10, ts: new Date(2026, 10, 10, 20).getTime() }); // 65 € TTC → 54,17 HT
  s.incomes.push({ date: '2026-11-12', amount: 200, label: 'Privatisation' });
  C.savePurchase(s, { date: '2026-11-03', supplier: 'B', lines: [{ productId: 'p-biere-fut', packs: 1, packPrice: 80 }] });
  s.charges.push({ date: '2026-01-01', amount: 100, freq: 'monthly', cat: 'loyer' });
  const r = C.monthReport(s, '2026-11');
  assert.strictEqual(C.round2(r.salesHT), 54.17);
  assert.strictEqual(r.revenue.toFixed(2), '254.17');
  assert.strictEqual(r.expenses, 180);
  assert.strictEqual(C.round2(r.result), 74.17);
  assert.strictEqual(r.byCat.loyer, 100);
});

test('stock des photos : fusion, quantités, et carte au-dessus de ×3', () => {
  const PS = require('../stock-photos.js');
  const s = st(0.1);
  s.products.find((p) => p.id === 'p-gin').priceHistory = [{ date: '2026-11-01', from: 17, to: 15.5 }];
  s.products.find((p) => p.id === 'p-gin').packPrice = 15.5;
  const n = s.products.length;
  const inv = C.mergeStockPreset(s, PS.build());
  const gin = s.products.find((p) => p.id === 'p-gin');
  assert.strictEqual(gin.name, 'Gin Gordon\'s 70 cl');
  assert.strictEqual(gin.packPrice, 15.5); // prix corrigé conservé
  assert.strictEqual(gin.stock, 196);
  assert.strictEqual(s.products.find((p) => p.id === 'p-biere-btl').stock, 8);
  assert.ok(inv.lines.length > 30);
  // deuxième chargement : pas de doublon
  C.mergeStockPreset(s, PS.build());
  assert.strictEqual(s.products.length, n + PS.build().products.filter((p) => !require('../starter.js').build().products.some((q) => q.id === p.id)).length);
  const bad = C.analyzeMenu(s).filter((a) => a.status === 'low' || a.status === 'unknown');
  assert.deepStrictEqual(bad.map((a) => a.item.name), []);
});
