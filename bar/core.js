/* Carnet de Bar — logique métier (sans DOM), testable sous Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BarCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DAY = 86400000;

  // ---------- Dates ----------
  function parseDate(s) {
    if (!s) return null;
    const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }
  const pad = (n) => String(n).padStart(2, '0');
  function toISO(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function today() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + Math.round(n)); }
  function diffDays(a, b) { return Math.round((a - b) / DAY); }
  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  const round2 = (n) => Math.round(n * 100) / 100;

  // Journée d'exploitation : une vente à 1h du matin compte pour la veille (fermeture après minuit).
  function businessDate(ts, dayStartHour = 6) {
    const d = new Date(ts);
    if (d.getHours() < dayStartHour) d.setDate(d.getDate() - 1);
    return toISO(d);
  }

  // ---------- Référentiels ----------
  const CATEGORIES = {
    pression: { label: 'Bière pression', icon: '🍺', vat: 20, coef: 3 },
    bouteille: { label: 'Bière bouteille', icon: '🍾', vat: 20, coef: 3 },
    vin: { label: 'Vins & bulles', icon: '🍷', vat: 20, coef: 3 },
    spiritueux: { label: 'Spiritueux', icon: '🥃', vat: 20, coef: 3 },
    cocktail: { label: 'Cocktails', icon: '🍸', vat: 20, coef: 3 },
    soft: { label: 'Softs & jus', icon: '🥤', vat: 10, coef: 3 },
    chaud: { label: 'Boissons chaudes', icon: '☕', vat: 10, coef: 3 },
    snack: { label: 'Snacks & planches', icon: '🧀', vat: 10, coef: 3 },
    autre: { label: 'Autre', icon: '📦', vat: 20, coef: 3 },
  };
  const UNITS = { cl: 'cl', piece: 'pièce', g: 'g' };

  function defaultSettings() {
    return {
      barName: '',
      dayStartHour: 6,          // une vente avant 6h compte pour la veille
      rounding: 0.1,            // arrondi des prix conseillés (0,10 €)
      minCoef: 3,               // règle d'or : prix de vente TTC ≥ 3 × coût complet
      overhead: 0,              // charge du bar par verre servi (€) : gobelets, glace, énergie, lavage, casse…
      coefs: Object.fromEntries(Object.keys(CATEGORIES).map((k) => [k, 3])),
      deadStockDays: 30,
      lastBackup: null,
    };
  }
  function defaultState() {
    return {
      version: 1,
      settings: defaultSettings(),
      products: [],   // stock : ce que tu achètes
      items: [],      // carte : ce que tu vends (recette = produits consommés)
      sales: [],      // ventes, offerts, pertes
      purchases: [],  // livraisons / factures fournisseurs
      inventories: [],// comptages physiques
      closings: [],   // clôtures de caisse
      tasks: defaultTasks(),
      charges: [],    // loyer, électricité, eau, salaires… (récurrentes ou ponctuelles)
      incomes: [],    // recettes hors caisse (privatisation, événement, subvention…)
      priceLog: [],   // historique des changements de prix de vente
    };
  }

  function defaultTasks() {
    const t = (title, freq, cat, extra = {}) => Object.assign({ id: 't-' + uid(), title, freq, cat, lastDone: null, enabled: true, note: '' }, extra);
    return [
      t('Clôture de caisse (compter les espèces)', 'daily', 'caisse'),
      t('Relever les températures frigos / chambre froide', 'daily', 'hygiene', { note: 'Frigos ≤ 4 °C. Noter dans le registre HACCP.' }),
      t('Nettoyage bar, tireuse (becs), lave-verres', 'daily', 'hygiene'),
      t('Vérifier DLC / dates d\'ouverture (jus, sirops, crème, fruits)', 'daily', 'hygiene'),
      t('Inventaire du stock', 'weekly', 'stock', { weekday: 1, note: 'Compter en fin de service, avant les livraisons.' }),
      t('Passer les commandes fournisseurs', 'weekly', 'stock', { weekday: 2 }),
      t('Nettoyage des lignes de bière (produit + rinçage)', 'weekly', 'hygiene', { every: 2, note: 'Toutes les 1 à 2 semaines : mousse, goût et pertes en dépendent.' }),
      t('Détartrage machine à café / lave-verres', 'monthly', 'hygiene'),
      t('Revoir les prix (marges, hausses fournisseurs)', 'monthly', 'gestion'),
      t('Déclaration / paiement TVA', 'monthly', 'gestion', { day: 15, note: 'Selon ton régime (mensuel, trimestriel…). Ajuste la date.' }),
    ];
  }

  // ---------- Coûts & prix ----------
  // Coût HT d'une unité de base (1 cl, 1 pièce, 1 g), pertes comprises (mousse, fond de fût, casse…)
  function unitCost(p) {
    if (!p) return null;
    const pack = Number(p.packPrice), size = Number(p.packSize);
    if (!(pack >= 0) || !(size > 0)) return null;
    const loss = Math.min(0.9, Math.max(0, Number(p.lossPct) || 0) / 100);
    return pack / (size * (1 - loss));
  }
  function productMap(state) { return new Map((state.products || []).map((p) => [p.id, p])); }

  // Charge du bar imputée à chaque verre (réglage global, ou propre à l'article)
  function overheadOf(state, item) {
    if (item.overhead != null && item.overhead !== '') return Number(item.overhead) || 0;
    return Number(state.settings && state.settings.overhead) || 0;
  }
  // Coût complet = matière première (doses × coût unitaire, pertes comprises) + garniture + charge du bar
  function itemCost(state, item, pm = productMap(state)) {
    let material = Number(item.extraCost) || 0; let missing = false;
    for (const r of item.recipe || []) {
      const uc = unitCost(pm.get(r.productId));
      if (uc == null) { missing = true; continue; }
      material += uc * (Number(r.qty) || 0);
    }
    if (!(item.recipe || []).length && !material) missing = true;
    const overhead = overheadOf(state, item);
    return { cost: material + overhead, material, overhead, missing };
  }

  function catOf(item) { return CATEGORIES[item.category] || CATEGORIES.autre; }
  function vatOf(item) { return item.vat != null && item.vat !== '' ? Number(item.vat) : catOf(item).vat; }
  function minCoef(state) { return Number(state.settings && state.settings.minCoef) || 3; }
  // Coef visé : celui de l'article, sinon de sa catégorie, jamais sous le minimum (×3)
  function targetCoef(state, item) {
    const c = (state.settings && state.settings.coefs) || {};
    const t = Number(item.targetCoef) || Number(c[item.category]) || catOf(item).coef;
    return Math.max(minCoef(state), t);
  }
  function roundPrice(v, step = 0.1) {
    if (!(v > 0)) return 0;
    const s = Number(step) || 0.1;
    // arrondi au pas supérieur, avec tolérance pour éviter 4,0000001 → 4,10
    return round2(Math.ceil(v / s - 1e-6) * s);
  }

  // Analyse complète d'un article de la carte.
  // coef = prix TTC / coût HT (convention CHR) ; ratio = coût HT / prix HT (« pour cost »).
  function analyzeItem(state, item, pm) {
    const { cost, material, overhead, missing } = itemCost(state, item, pm);
    const vat = vatOf(item);
    const priceTTC = Number(item.price) || 0;
    const priceHT = priceTTC / (1 + vat / 100);
    const margin = priceHT - cost;
    const coef = cost > 0 ? priceTTC / cost : null;
    const ratio = priceHT > 0 ? cost / priceHT : null;
    const target = targetCoef(state, item);
    const step = state.settings && state.settings.rounding;
    const min = minCoef(state);
    const minPrice = cost > 0 ? roundPrice(cost * min, step) : null;       // plancher absolu (×3)
    const suggested = cost > 0 ? roundPrice(cost * target, step) : null;   // prix visé
    let status = 'ok';
    if (missing || !cost) status = 'unknown';
    else if (priceTTC <= 0) status = 'noprice';
    else if (coef < min - 1e-9) status = 'low';            // sous ×3 : à corriger
    else if (coef < target - 1e-9) status = 'watch';       // au-dessus du plancher mais sous l'objectif de la catégorie
    return { item, cost, material, overhead, missing, vat, priceTTC, priceHT, margin, coef, ratio, target, min, minPrice, suggested, status };
  }
  function analyzeMenu(state) {
    const pm = productMap(state);
    return (state.items || []).filter((i) => i.active !== false).map((i) => analyzeItem(state, i, pm));
  }

  // Prix minimum pour obtenir une marge HT donnée (ex. « je veux 5 € de marge sur la pinte »)
  function priceForMargin(cost, marginHT, vat, step) {
    return roundPrice((cost + marginHT) * (1 + vat / 100), step);
  }

  // ---------- Stock ----------
  function stockValue(state) {
    return (state.products || []).reduce((s, p) => {
      const uc = unitCost(Object.assign({}, p, { lossPct: 0 }));
      return s + (uc && p.stock > 0 ? uc * p.stock : 0);
    }, 0);
  }
  function stockStatus(p) {
    const st = Number(p.stock) || 0, min = Number(p.minStock) || 0;
    if (st <= 0) return 'out';
    if (min > 0 && st <= min) return 'low';
    return 'ok';
  }
  function lowStock(state) { return (state.products || []).filter((p) => p.active !== false && stockStatus(p) !== 'ok' && (Number(p.minStock) > 0 || Number(p.stock) <= 0)); }

  // Bon de commande : quantité à commander (en conditionnements) pour remonter au stock cible.
  function orderList(state) {
    const out = [];
    for (const p of state.products || []) {
      if (p.active === false) continue;
      const st = Number(p.stock) || 0, min = Number(p.minStock) || 0;
      const par = Number(p.parStock) || min * 2;
      if (!(min > 0) || st > min) continue;
      const need = Math.max(0, par - st);
      const packs = Math.max(1, Math.ceil(need / Number(p.packSize || 1) - 1e-9));
      out.push({ product: p, packs, cost: packs * (Number(p.packPrice) || 0), supplier: p.supplier || 'Sans fournisseur' });
    }
    return out;
  }

  // Applique (sign=+1) ou annule (sign=-1) l'effet d'une vente sur le stock
  function applySaleStock(state, sale, sign) {
    const pm = productMap(state);
    for (const r of sale.recipe || []) {
      const p = pm.get(r.productId);
      if (p) p.stock = round2((Number(p.stock) || 0) - sign * (Number(r.qty) || 0) * (Number(sale.qty) || 1));
    }
  }

  // Enregistre une vente (type : vente | offert | perte). Fige prix, coût et recette au moment de la vente.
  function recordSale(state, itemId, opts = {}) {
    const item = (state.items || []).find((i) => i.id === itemId);
    if (!item) throw new Error('article inconnu');
    const a = analyzeItem(state, item);
    const type = opts.type || 'vente';
    const ts = opts.ts || Date.now();
    const sale = {
      id: 's-' + uid(), ts, day: businessDate(ts, state.settings.dayStartHour),
      itemId, name: item.name, category: item.category, qty: Number(opts.qty) || 1,
      price: type === 'vente' ? (opts.price != null ? Number(opts.price) : a.priceTTC) : 0,
      vat: a.vat, cost: round2(a.cost * 10000) / 10000, pay: opts.pay || 'cb', type,
      recipe: (item.recipe || []).map((r) => ({ productId: r.productId, qty: Number(r.qty) || 0 })),
    };
    state.sales.push(sale);
    applySaleStock(state, sale, +1);
    return sale;
  }
  function deleteSale(state, id) {
    const i = state.sales.findIndex((s) => s.id === id);
    if (i < 0) return;
    applySaleStock(state, state.sales[i], -1);
    state.sales.splice(i, 1);
  }

  // Achats : ajoute au stock et met à jour le prix d'achat (dernier prix connu)
  function applyPurchase(state, pur, sign) {
    const pm = productMap(state);
    for (const l of pur.lines || []) {
      const p = pm.get(l.productId);
      if (!p) continue;
      p.stock = round2((Number(p.stock) || 0) + sign * (Number(l.packs) || 0) * (Number(p.packSize) || 1));
    }
  }
  function savePurchase(state, pur) {
    const old = state.purchases.find((x) => x.id === pur.id);
    if (old) { applyPurchase(state, old, -1); state.purchases = state.purchases.filter((x) => x.id !== pur.id); }
    pur.id = pur.id || 'a-' + uid();
    pur.total = round2((pur.lines || []).reduce((s, l) => s + (Number(l.packs) || 0) * (Number(l.packPrice) || 0), 0));
    state.purchases.push(pur);
    applyPurchase(state, pur, +1);
    // dernier prix d'achat = celui de l'achat le plus récent contenant le produit
    const pm = productMap(state);
    for (const l of pur.lines || []) {
      const p = pm.get(l.productId);
      if (!p || !(Number(l.packPrice) > 0)) continue;
      const latest = state.purchases.filter((x) => (x.lines || []).some((y) => y.productId === p.id && Number(y.packPrice) > 0))
        .sort((a, b) => a.date.localeCompare(b.date)).pop();
      if (latest === pur) {
        if (Number(p.packPrice) !== Number(l.packPrice)) {
          p.priceHistory = p.priceHistory || [];
          p.priceHistory.push({ date: pur.date, from: Number(p.packPrice) || null, to: Number(l.packPrice) });
        }
        p.packPrice = Number(l.packPrice);
      }
    }
    return pur;
  }
  function deletePurchase(state, id) {
    const old = state.purchases.find((x) => x.id === id);
    if (!old) return;
    applyPurchase(state, old, -1);
    state.purchases = state.purchases.filter((x) => x.id !== id);
  }

  // Inventaire : counts = { productId: quantité réelle en unités de base }
  function saveInventory(state, date, counts) {
    const pm = productMap(state);
    const lines = [];
    for (const [pid, counted] of Object.entries(counts)) {
      const p = pm.get(pid);
      if (!p || counted === '' || counted == null || isNaN(counted)) continue;
      const theo = Number(p.stock) || 0;
      const diff = round2(Number(counted) - theo);
      const uc = unitCost(Object.assign({}, p, { lossPct: 0 })) || 0;
      lines.push({ productId: pid, name: p.name, theoretical: theo, counted: Number(counted), diff, value: round2(diff * uc) });
      p.stock = Number(counted);
    }
    const inv = { id: 'i-' + uid(), date, lines, total: round2(lines.reduce((s, l) => s + l.value, 0)) };
    state.inventories.push(inv);
    return inv;
  }

  // ---------- Chiffres ----------
  function summarize(sales) {
    const r = { ttc: 0, ht: 0, cost: 0, margin: 0, count: 0, cb: 0, cash: 0, other: 0, offered: 0, lost: 0, tva: 0 };
    for (const s of sales) {
      const q = Number(s.qty) || 1;
      const c = (Number(s.cost) || 0) * q;
      r.cost += c;
      if (s.type === 'offert') { r.offered += c; continue; }
      if (s.type === 'perte') { r.lost += c; continue; }
      const ttc = (Number(s.price) || 0) * q;
      const ht = ttc / (1 + (Number(s.vat) || 0) / 100);
      r.ttc += ttc; r.ht += ht; r.count += q;
      if (s.pay === 'cash') r.cash += ttc; else if (s.pay === 'cb') r.cb += ttc; else r.other += ttc;
    }
    r.tva = r.ttc - r.ht;
    r.margin = r.ht - r.cost;
    r.ratio = r.ht > 0 ? r.cost / r.ht : null;
    r.avg = r.count ? r.ttc / r.count : null;
    return r;
  }
  function salesOfDay(state, day) { return (state.sales || []).filter((s) => s.day === day); }
  function salesBetween(state, fromISO, toISOd) { return (state.sales || []).filter((s) => s.day >= fromISO && s.day <= toISOd); }
  function currentDay(state, now = Date.now()) { return businessDate(now, state.settings.dayStartHour); }

  function topItems(sales, n = 5) {
    const m = new Map();
    for (const s of sales) {
      if (s.type !== 'vente') continue;
      const q = Number(s.qty) || 1;
      const o = m.get(s.itemId) || { itemId: s.itemId, name: s.name, qty: 0, ttc: 0, margin: 0 };
      o.qty += q; o.ttc += s.price * q; o.margin += (s.price / (1 + s.vat / 100) - s.cost) * q;
      m.set(s.itemId, o);
    }
    return [...m.values()].sort((a, b) => b.margin - a.margin).slice(0, n);
  }
  function byCategory(sales) {
    const m = {};
    for (const s of sales) {
      if (s.type !== 'vente') continue;
      const q = Number(s.qty) || 1;
      const o = m[s.category] || (m[s.category] = { ttc: 0, ht: 0, cost: 0 });
      o.ttc += s.price * q; o.ht += s.price / (1 + s.vat / 100) * q; o.cost += s.cost * q;
    }
    return m;
  }
  function byHour(sales) {
    const h = new Array(24).fill(0);
    for (const s of sales) if (s.type === 'vente') h[new Date(s.ts).getHours()] += s.price * (Number(s.qty) || 1);
    return h;
  }
  function dailySeries(state, days, end = today()) {
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = toISO(addDays(end, -i));
      out.push({ day: d, ...summarize(salesOfDay(state, d)) });
    }
    return out;
  }

  // Clôture : espèces attendues = fond + ventes espèces
  function closingFor(state, day, cashCounted, float) {
    const sm = summarize(salesOfDay(state, day));
    const expected = round2((Number(float) || 0) + sm.cash);
    return { day, float: Number(float) || 0, expected, counted: Number(cashCounted), diff: round2(Number(cashCounted) - expected), ttc: round2(sm.ttc), cb: round2(sm.cb), cash: round2(sm.cash), other: round2(sm.other) };
  }

  // ---------- Tâches ----------
  // Renvoie la prochaine échéance d'une tâche récurrente.
  function taskDue(task, ref = today()) {
    if (task.enabled === false) return null;
    const last = parseDate(task.lastDone);
    if (task.freq === 'once') return { due: parseDate(task.due) || ref, done: !!task.lastDone };
    if (task.freq === 'daily') {
      const due = last ? addDays(last, 1) : ref;
      return { due, done: !!last && diffDays(ref, last) < 1 };
    }
    if (task.freq === 'weekly') {
      const every = Math.max(1, Number(task.every) || 1);
      let due;
      if (last) due = addDays(last, 7 * every);
      else due = ref;
      if (task.weekday != null && task.weekday !== '' && last) {
        // caler sur le jour de la semaine choisi
        const wd = Number(task.weekday);
        while (due.getDay() !== wd) due = addDays(due, -1);
        if (due <= last) due = addDays(due, 7);
      }
      return { due, done: !!last && due > ref };
    }
    if (task.freq === 'monthly') {
      let due;
      if (last) { due = new Date(last.getFullYear(), last.getMonth() + 1, Math.min(28, Number(task.day) || last.getDate())); }
      else due = ref;
      return { due, done: !!last && due > ref };
    }
    return null;
  }
  function taskStatus(task, ref = today()) {
    const d = taskDue(task, ref);
    if (!d) return null;
    if (task.freq === 'once' && d.done) return { ...d, status: 'closed', days: 0 };
    const days = diffDays(d.due, ref);
    let status = 'later';
    if (d.done) status = days <= 2 ? 'done' : 'later';   // déjà fait pour la période en cours
    else if (days < 0) status = 'overdue';
    else if (days === 0) status = 'today';
    else if (days <= 2) status = 'soon';
    return { ...d, status, days };
  }
  function todoList(state, ref = today()) {
    return (state.tasks || []).map((t) => ({ task: t, ...taskStatus(t, ref) }))
      .filter((x) => x.status && x.status !== 'closed')
      .sort((a, b) => a.due - b.due);
  }

  // ---------- Import d'un relevé de stock (photos) ----------
  // Fusionne produits et articles par identifiant, puis enregistre un inventaire avec les quantités relevées.
  // Un prix d'achat déjà corrigé par l'utilisateur (historique) ou un prix de vente déjà modifié est conservé.
  function mergeStockPreset(state, preset) {
    const pm = productMap(state);
    const counts = {};
    for (const src of preset.products) {
      const { _qty, _check, ...data } = src;
      const ex = pm.get(src.id);
      if (ex) {
        const keepPrice = (ex.priceHistory || []).length > 0;
        const keep = { stock: ex.stock, priceHistory: ex.priceHistory || [], minStock: ex.minStock, parStock: ex.parStock };
        Object.assign(ex, data, keep, keepPrice ? { packPrice: ex.packPrice } : {});
        ex.toCheck = !!_check;
      } else {
        state.products.push(Object.assign({ stock: 0, priceHistory: [], toCheck: !!_check }, data));
      }
      if (_qty != null) counts[src.id] = _qty;
    }
    const edited = new Set((state.priceLog || []).map((x) => x.itemId));
    for (const it of preset.items) {
      const ex = state.items.find((i) => i.id === it.id);
      if (ex) { ex.name = it.name; ex.recipe = it.recipe; if (!edited.has(ex.id)) ex.price = it.price; }
      else state.items.push(JSON.parse(JSON.stringify(it)));
    }
    const inv = saveInventory(state, preset.date, counts);
    inv.initial = true; // stock de départ : pas un écart à analyser
    return inv;
  }

  // ---------- Compta : charges, revenus, résultat du mois ----------
  const CHARGE_CATS = {
    loyer: '🏠 Loyer', electricite: '⚡ Électricité', eau: '💧 Eau', gaz: '🔥 Gaz', salaires: '👥 Salaires & charges sociales',
    assurance: '🛡️ Assurance', telecom: '📶 Internet / téléphone', banque: '🏦 Banque / TPE', comptable: '📒 Comptable',
    licence: '📜 Licence, SACEM, taxes', entretien: '🔧 Entretien / réparations', materiel: '🧊 Matériel / consommables', pret: '💳 Remboursement de prêt',
    marketing: '📣 Communication', autre: '📦 Autre',
  };
  const FREQ_MONTHS = { monthly: 1, quarterly: 3, yearly: 12 };
  const monthKey = (iso) => String(iso).slice(0, 7);
  function monthsBetween(a, b) { // a, b : 'YYYY-MM'
    const [ya, ma] = a.split('-').map(Number), [yb, mb] = b.split('-').map(Number);
    return (yb - ya) * 12 + (mb - ma);
  }
  // Montant d'une charge payé dans le mois donné (vue trésorerie)
  function chargeInMonth(ch, month) {
    if (!ch.date) return 0;
    const start = monthKey(ch.date);
    if (month < start) return 0;
    if (ch.end && month > monthKey(ch.end)) return 0;
    const amt = Number(ch.amount) || 0;
    if (!ch.freq || ch.freq === 'once') return month === start ? amt : 0;
    const every = FREQ_MONTHS[ch.freq] || 1;
    return monthsBetween(start, month) % every === 0 ? amt : 0;
  }
  // Coût mensuel moyen d'une charge récurrente (annuelle ÷ 12, trimestrielle ÷ 3)
  function chargeMonthlyAvg(ch, month) {
    if (!ch.freq || ch.freq === 'once') return 0;
    if (month && (month < monthKey(ch.date) || (ch.end && month > monthKey(ch.end)))) return 0;
    return (Number(ch.amount) || 0) / (FREQ_MONTHS[ch.freq] || 1);
  }
  function fixedChargesPerMonth(state, month) {
    return (state.charges || []).reduce((s, c) => s + chargeMonthlyAvg(c, month), 0);
  }
  function monthReport(state, month) {
    const sales = (state.sales || []).filter((x) => monthKey(x.day) === month);
    const sm = summarize(sales);
    const incomes = (state.incomes || []).filter((x) => monthKey(x.date) === month);
    const other = incomes.reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const purchases = (state.purchases || []).filter((x) => monthKey(x.date) === month);
    const buy = purchases.reduce((s, x) => s + (Number(x.total) || 0), 0);
    const charges = (state.charges || []).map((c) => ({ charge: c, amount: chargeInMonth(c, month) })).filter((x) => x.amount);
    const byCat = {};
    for (const x of charges) byCat[x.charge.cat || 'autre'] = (byCat[x.charge.cat || 'autre'] || 0) + x.amount;
    const chargesTotal = charges.reduce((s, x) => s + x.amount, 0);
    const revenue = sm.ht + other;
    const expenses = buy + chargesTotal;
    const smoothed = fixedChargesPerMonth(state, month) + (state.charges || []).filter((c) => (!c.freq || c.freq === 'once') && monthKey(c.date) === month).reduce((s, c) => s + (Number(c.amount) || 0), 0);
    return {
      month, sales: sm, salesHT: sm.ht, salesTTC: sm.ttc, tva: sm.tva, other, incomes, revenue,
      purchases, buy, charges, byCat, chargesTotal, expenses,
      result: revenue - expenses,                       // trésorerie : ce qui est entré − ce qui est sorti
      resultSmoothed: revenue - buy - smoothed,        // charges annuelles/trimestrielles lissées sur 12/3 mois
      materialUsed: sm.cost,                           // coût des verres réellement servis (vendus + offerts + pertes)
    };
  }
  // Seuil de rentabilité : CA HT nécessaire pour couvrir les charges fixes avec ta marge actuelle
  function breakEven(state, month) {
    const r = monthReport(state, month);
    const fixed = fixedChargesPerMonth(state, month);
    const mat = r.salesHT > 0 ? r.buy / r.salesHT : null;
    const rate = mat != null && mat < 1 ? 1 - mat : null;
    return { fixed, rate, caHT: rate ? fixed / rate : null };
  }

  // ---------- Conseils (seulement quand un chiffre sort de la normale) ----------
  function advice(state, ref = today()) {
    const out = [];
    const eur = (n) => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',') + ' €';
    const menu = analyzeMenu(state);
    const low = menu.filter((a) => a.status === 'low');
    if (low.length) out.push({ level: 'bad', tab: 'menu', title: `${low.length} article${low.length > 1 ? 's' : ''} sous la règle des ×${minCoef(state)}`,
      text: low.slice(0, 4).map((a) => `${a.item.name} : vendu ${eur(a.priceTTC)} pour ${eur(a.cost)} de coût (×${a.coef.toFixed(2).replace('.', ',')}) → minimum ${eur(a.minPrice)}`).join(' · '),
      tips: ['Vérifie d\'abord la recette (dose, perte) : une dose trop généreuse fausse tout.', 'Si le prix conseillé est trop haut pour ton quartier, réduis la dose ou change de référence plutôt que de vendre à perte de marge.'] });
    const unk = menu.filter((a) => a.status === 'unknown');
    if (unk.length) out.push({ level: 'data', tab: 'menu', title: `Coût inconnu pour ${unk.length} article${unk.length > 1 ? 's' : ''}`,
      text: unk.slice(0, 5).map((a) => a.item.name).join(', ') + ' : ajoute la recette ou le prix d\'achat des produits.' });

    // Hausses de prix fournisseurs récentes (60 j) qui ont fait baisser la marge
    const since = toISO(addDays(ref, -60));
    for (const p of state.products || []) {
      const h = (p.priceHistory || []).filter((x) => x.date >= since && x.from > 0 && x.to > x.from * 1.03).pop();
      if (!h) continue;
      const used = menu.filter((a) => (a.item.recipe || []).some((r) => r.productId === p.id));
      if (!used.length) continue;
      const pct = Math.round((h.to / h.from - 1) * 100);
      out.push({ level: 'warn', tab: 'menu', title: `${p.name} : prix d'achat +${pct} %`,
        text: `Passé de ${eur(h.from)} à ${eur(h.to)} le ${h.date}. Articles touchés : ${used.map((a) => `${a.item.name} (conseillé ${eur(a.suggested)}, actuel ${eur(a.priceTTC)})`).join(', ')}.` });
    }

    // Écart d'inventaire
    const inv = (state.inventories || []).filter((x) => !x.initial).sort((a, b) => a.date.localeCompare(b.date)).pop();
    if (inv && inv.date >= toISO(addDays(ref, -14))) {
      const neg = inv.lines.filter((l) => l.value < -5).sort((a, b) => a.value - b.value);
      const tot = neg.reduce((s, l) => s + l.value, 0);
      if (tot < -20) out.push({ level: 'bad', tab: 'stock', title: `Inventaire du ${inv.date} : ${eur(-tot)} de stock manquant`,
        text: neg.slice(0, 5).map((l) => `${l.name} (${eur(l.value)})`).join(', '),
        tips: ['Causes fréquentes : doses non mesurées (utilise des doseurs / jiggers), offerts et pertes non saisis, casse, ventes oubliées, pertes au fût plus fortes que prévu.', 'Saisis chaque offert et chaque perte dans la caisse, même à 0 €, pour que le stock théorique colle.', 'Pour un fût, ajuste le % de perte du produit si l\'écart revient à chaque inventaire.'] });
    }

    // Écarts de caisse
    const lastCl = (state.closings || []).slice(-7);
    const bad = lastCl.filter((c) => Math.abs(c.diff) >= 5);
    if (bad.length >= 2) out.push({ level: 'warn', tab: 'caisse', title: `Écarts de caisse sur ${bad.length} des ${lastCl.length} dernières clôtures`,
      text: bad.map((c) => `${c.day} : ${c.diff > 0 ? '+' : ''}${eur(c.diff)}`).join(' · '), tips: ['Encaisse chaque vente au moment où elle est servie.', 'Compte le fond de caisse à l\'ouverture.'] });

    // Stock dormant
    const dd = Number(state.settings.deadStockDays) || 30;
    const from = toISO(addDays(ref, -dd));
    const usedRecently = new Set();
    for (const s of state.sales || []) if (s.day >= from) for (const r of s.recipe || []) usedRecently.add(r.productId);
    const oldEnough = (state.sales || []).some((s) => s.day <= from);
    if (oldEnough) {
      const dead = (state.products || []).filter((p) => p.active !== false && Number(p.stock) > 0 && !usedRecently.has(p.id))
        .map((p) => ({ p, v: (unitCost(Object.assign({}, p, { lossPct: 0 })) || 0) * p.stock })).filter((x) => x.v >= 15).sort((a, b) => b.v - a.v);
      if (dead.length) out.push({ level: 'info', tab: 'stock', title: `Stock qui dort depuis ${dd} jours : ${eur(dead.reduce((s, x) => s + x.v, 0))}`,
        text: dead.slice(0, 5).map((x) => `${x.p.name} (${eur(x.v)})`).join(', '), tips: ['Mets-le en avant (cocktail du moment, ardoise), ou arrête de le recommander.'] });
    }
    return out;
  }

  return {
    DAY, CATEGORIES, UNITS, parseDate, toISO, today, addDays, diffDays, uid, round2, businessDate,
    defaultState, defaultSettings, defaultTasks, unitCost, itemCost, overheadOf, minCoef, vatOf, targetCoef, roundPrice, analyzeItem, analyzeMenu, priceForMargin,
    stockValue, stockStatus, lowStock, orderList, recordSale, deleteSale, savePurchase, deletePurchase, saveInventory,
    summarize, salesOfDay, salesBetween, currentDay, topItems, byCategory, byHour, dailySeries, closingFor,
    taskDue, taskStatus, todoList, advice, productMap,
    mergeStockPreset, CHARGE_CATS, chargeInMonth, chargeMonthlyAvg, fixedChargesPerMonth, monthReport, breakEven, monthKey,
  };
});
