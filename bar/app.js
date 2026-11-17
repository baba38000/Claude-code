/* Carnet de Bar — interface */
(function () {
  'use strict';
  const C = window.BarCore;
  const LS_KEY = 'carnet-bar-v1';
  const APP_VERSION = '1.0';
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  // ================= Stockage =================
  let state = load();
  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const s = Object.assign(C.defaultState(), JSON.parse(raw));
        s.settings = Object.assign(C.defaultSettings(), s.settings);
        return s;
      }
    } catch (e) { console.warn(e); }
    return C.defaultState();
  }
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
    catch (e) { toast('⚠️ Impossible d\'enregistrer : ' + e.message); }
  }

  // ================= Utilitaires =================
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
  const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
  const eurF = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
  const eur = (n) => (n == null || n === '' || isNaN(n) ? '—' : eurF.format(n));
  const eur3 = (n) => (n == null || isNaN(n) ? '—' : n.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' €');
  const coefF = (n) => (n == null || !isFinite(n) ? '—' : '×' + n.toFixed(2).replace('.', ','));
  const pct = (n) => (n == null || !isFinite(n) ? '—' : Math.round(n * 100) + ' %');
  const num = (v) => (v === '' || v == null ? null : Number(String(v).replace(/\s/g, '').replace(',', '.')));
  const fdate = (s) => { const d = typeof s === 'string' ? C.parseDate(s) : s; return d ? d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'; };
  const ftime = (ts) => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const todayISO = () => C.toISO(C.today());
  const day = () => C.currentDay(state);
  const barName = () => state.settings.barName || 'Mon bar';
  const CAT = C.CATEGORIES;
  const catLabel = (k) => (CAT[k] ? CAT[k].icon + ' ' + CAT[k].label : k || '—');
  const unitLabel = (u) => (u === 'piece' ? 'pièce' : u || 'cl');
  const pmap = () => C.productMap(state);

  // Quantité en stock lisible : « 1,4 × fût 30 L (4 200 cl) »
  function fmtStock(p, qty = p.stock) {
    const q = Number(qty) || 0;
    const size = Number(p.packSize) || 1;
    if (size === 1) return `${nf.format(q)} ${p.packLabel || unitLabel(p.unit)}`;
    return `${nf1.format(q / size)} × ${p.packLabel || 'cond.'} <span class="muted">(${nf.format(q)} ${unitLabel(p.unit)})</span>`;
  }

  function toast(msg, undo) {
    const t = $('#toast');
    t.innerHTML = esc(msg) + (undo ? ' <button class="toast-btn" type="button">Annuler</button>' : '');
    t.classList.add('show');
    if (undo) $('.toast-btn', t).onclick = () => { undo(); t.classList.remove('show'); };
    t.style.pointerEvents = undo ? 'auto' : 'none';
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), undo ? 4500 : 2600);
  }

  const STATUS = {
    low: ['b-bad', 'Sous ×3'], watch: ['b-soon', 'Sous objectif'], ok: ['b-ok', 'OK'],
    unknown: ['b-unk', 'Coût ?'], noprice: ['b-unk', 'Sans prix'],
  };
  const TASK_FREQ = { daily: 'Chaque jour', weekly: 'Chaque semaine', monthly: 'Chaque mois', once: 'Une fois' };
  const TASK_CAT = { caisse: '💶 Caisse', hygiene: '🧽 Hygiène', stock: '📦 Stock', gestion: '📊 Gestion', autre: '📌 Autre' };
  const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const PAY = { cb: '💳 CB', cash: '💶 Espèces', other: '🔁 Autre' };
  const ADV_ICON = { bad: '🔴', warn: '🟠', data: '🟣', info: '💡' };

  // ================= Navigation =================
  let tab = 'dashboard';
  let menuFilter = 'all';
  let posCat = 'all';
  let comptaMonth = null;
  const views = { dashboard: viewDashboard, pos: viewPOS, menu: viewMenu, stock: viewStock, compta: viewCompta, tasks: viewTasks, settings: viewSettings };

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { tab = t.dataset.tab; render(); window.scrollTo(0, 0); return; }
    const a = e.target.closest('[data-action]');
    if (a && actions[a.dataset.action]) { e.preventDefault(); e.stopPropagation(); actions[a.dataset.action](a); }
  });

  function render() {
    $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    $('#bar-name').textContent = barName() + ' · ' + fdate(day());
    const sm = C.summarize(C.salesOfDay(state, day()));
    $('#ca-pill').textContent = eur(sm.ttc);
    $('#view').innerHTML = views[tab]();
    if (tab === 'settings') bindSettings();
  }

  const actions = {
    loadStarter: () => {
      if ((state.items.length || state.products.length) && !confirm('Ajouter la carte de départ ? Les articles et produits déjà présents avec le même identifiant seront remplacés.')) return;
      const b = window.BarStarter.build();
      const ids = new Set(b.products.map((p) => p.id).concat(b.items.map((i) => i.id)));
      state.products = state.products.filter((p) => !ids.has(p.id)).concat(b.products);
      state.items = state.items.filter((i) => !ids.has(i.id)).concat(b.items);
      if (!state.settings.overhead) state.settings.overhead = 0.1;
      save(); render(); toast('Carte de départ chargée : remplace les prix d\'achat par ceux de tes factures');
    },
    goto: (el) => { tab = el.dataset.v; render(); window.scrollTo(0, 0); },
    // --- Caisse ---
    posCat: (el) => { posCat = el.dataset.v; render(); },
    add: (el) => { ticketAdd(el.dataset.id, 1); },
    ticketMinus: (el) => { ticketAdd(el.dataset.id, -1); },
    ticketClear: () => { state.ticket = []; save(); render(); },
    pay: (el) => checkout(el.dataset.v),
    delSale: (el) => {
      const s = state.sales.find((x) => x.id === el.dataset.id);
      if (!s || !confirm(`Annuler « ${s.name} » (${ftime(s.ts)}) ? Le stock sera remis.`)) return;
      C.deleteSale(state, s.id); save(); render();
    },
    closeDay: () => openClosingForm(),
    // --- Carte ---
    menuFilter: (el) => { menuFilter = el.dataset.v; render(); },
    addItem: () => openItemForm(),
    editItem: (el) => openItemForm(el.dataset.id),
    fixAll: () => fixAllPrices(),
    exportMenu: () => exportMenuCSV(),
    exportCompta: () => exportComptaCSV(),
    // --- Stock ---
    addProduct: () => openProductForm(),
    editProduct: (el) => openProductForm(el.dataset.id),
    inventory: () => openInventoryForm(),
    order: () => openOrderList(),
    // --- Achats ---
    addPurchase: () => openPurchaseForm(),
    editPurchase: (el) => openPurchaseForm(el.dataset.id),
    // --- Compta ---
    monthShift: (el) => { const [y, m] = curMonth().split('-').map(Number); const d = new Date(y, m - 1 + Number(el.dataset.v), 1); comptaMonth = C.toISO(d).slice(0, 7); render(); },
    addCharge: () => openChargeForm(),
    editCharge: (el) => openChargeForm(el.dataset.id),
    addIncome: () => openIncomeForm(),
    editIncome: (el) => openIncomeForm(el.dataset.id),
    // --- Tâches ---
    addTask: () => openTaskForm(),
    editTask: (el) => openTaskForm(el.dataset.id),
    doneTask: (el) => {
      const t = state.tasks.find((x) => x.id === el.dataset.id);
      if (!t) return;
      const prev = t.lastDone;
      t.lastDone = todayISO(); save(); render();
      toast('✔ ' + t.title, () => { t.lastDone = prev; save(); render(); });
    },
    // --- Réglages ---
    exportJSON: () => exportJSON(),
    importJSON: () => $('#import-file').click(),
    wipe: () => {
      if (!confirm('Supprimer TOUTES les données (carte, stock, ventes, achats) ? Exporte une sauvegarde avant.')) return;
      state = C.defaultState(); save(); tab = 'dashboard'; render();
    },
    forceUpdate: () => forceUpdate(),
  };

  // ================= Accueil =================
  function viewDashboard() {
    if (!state.items.length && !state.products.length) {
      return `<div class="card">
        <h2>Bienvenue dans ton Carnet de Bar 🍻</h2>
        <p>Tout ton bar au même endroit : la <b>caisse</b> (chaque verre servi décompte le stock), la <b>carte</b> avec le coût réel de chaque boisson et le prix minimum pour le vendre <b>au moins 3 fois son coût</b>, le <b>stock</b>, les <b>achats</b> fournisseurs et la liste des <b>choses à faire</b>.</p>
        <p class="small muted">Coût d'un verre = doses de matière première (pertes comprises) + charge du bar par verre. Prix de vente minimum = 3 × ce coût. Exemple : pinte à 1,50 € de coût → 4,50 € minimum.</p>
        <div class="btns"><button class="btn primary" data-action="loadStarter">🍺 Charger la carte de départ</button>
        <button class="btn" data-action="addProduct">Partir de zéro</button>
        <button class="btn" data-action="importJSON">📥 Restaurer une sauvegarde</button></div>
        <p class="small muted">La carte de départ contient les doses bar classiques (pastis 2 cl, Martini 6 cl, alcools forts 4 cl, demi 25 cl, pinte 50 cl, verre de vin 12 cl, softs…) et des prix d'achat <b>indicatifs</b> à remplacer par ceux de tes factures. Les cocktails sont à ajouter avec tes recettes.</p>
      </div>${importInput()}`;
    }
    const d = day();
    const sm = C.summarize(C.salesOfDay(state, d));
    const todo = C.todoList(state).filter((x) => ['overdue', 'today'].includes(x.status));
    const low = C.lowStock(state);
    const menu = C.analyzeMenu(state);
    const under = menu.filter((a) => a.status === 'low');
    const serie = C.dailySeries(state, 14, C.parseDate(d));
    const maxD = Math.max(1, ...serie.map((x) => x.ttc));
    const m30 = C.summarize(C.salesBetween(state, C.toISO(C.addDays(C.parseDate(d), -29)), d));
    const top = C.topItems(C.salesBetween(state, C.toISO(C.addDays(C.parseDate(d), -29)), d), 5);
    const closed = state.closings.find((c) => c.day === d);

    return `<h2>Aujourd'hui <span class="small muted">${esc(fdate(d))}</span></h2>
      <div class="stats">
        <div class="stat"><b>${eur(sm.ttc)}</b><span>CA TTC</span></div>
        <div class="stat"><b>${eur(sm.margin)}</b><span>marge nette HT*</span></div>
        <div class="stat"><b>${nf.format(sm.count)}</b><span>verres vendus</span></div>
        <div class="stat"><b>${eur(sm.ht)}</b><span>CA HT</span></div>
        <div class="stat"><b>${sm.cost ? coefF(sm.ttc / sm.cost) : '—'}</b><span>coef réel</span></div>
        <div class="stat"><b>${eur(sm.offered + sm.lost)}</b><span>offerts + pertes</span></div>
      </div>
      <p class="small muted">* CA HT − coût complet (matière + charge du bar) des verres vendus, offerts et pertes.</p>
      <div class="btns"><button class="btn primary" data-tab="pos">🧾 Ouvrir la caisse</button>
        ${closed ? `<span class="badge b-ok">Caisse clôturée (écart ${eur(closed.diff)})</span>` : sm.count ? '<button class="btn" data-action="closeDay">🔒 Clôturer la journée</button>' : ''}</div>

      <h2>À faire maintenant</h2>
      <div class="card">
        ${todo.map(taskRow).join('')}
        ${low.length ? `<div class="item" data-action="order"><div class="item-main"><div class="item-title">🛒 ${low.length} produit${low.length > 1 ? 's' : ''} à commander</div>
          <div class="item-meta">${esc(low.slice(0, 6).map((p) => p.name).join(', '))}${low.length > 6 ? '…' : ''}</div></div><span class="badge b-soon">Stock bas</span></div>` : ''}
        ${under.length ? `<div class="item" data-action="goto" data-v="menu"><div class="item-main"><div class="item-title">💶 ${under.length} prix sous la règle des ×${C.minCoef(state)}</div>
          <div class="item-meta">${esc(under.slice(0, 5).map((a) => `${a.item.name} → ${eur(a.minPrice)}`).join(' · '))}</div></div><span class="badge b-bad">À corriger</span></div>` : ''}
        ${!todo.length && !low.length && !under.length ? '<p class="empty">Rien d\'urgent 👌</p>' : ''}
      </div>
      ${adviceSection((a) => !a.title.includes('sous la règle'))}

      <h2>14 derniers jours</h2>
      <div class="card"><div class="bars">${serie.map((x) => `<div class="bar" title="${esc(fdate(x.day))} : ${eur(x.ttc)} TTC, marge ${eur(x.margin)}"><i style="height:${Math.round((x.ttc / maxD) * 100)}%"></i><span>${C.parseDate(x.day).toLocaleDateString('fr-FR', { weekday: 'narrow' })}</span></div>`).join('')}</div></div>
      <div class="stats">
        <div class="stat"><b>${eur(m30.ttc)}</b><span>CA TTC 30 j</span></div>
        <div class="stat"><b>${eur(m30.margin)}</b><span>marge HT 30 j</span></div>
        <div class="stat"><b>${pct(m30.ratio)}</b><span>coût / CA HT</span></div>
      </div>
      ${top.length ? `<div class="card"><h3>Ce qui te rapporte le plus (30 j)</h3>${top.map((t) => `<div class="row line"><span>${esc(t.name)} <span class="muted small">× ${nf.format(t.qty)}</span></span><b>${eur(t.margin)}</b></div>`).join('')}</div>` : ''}
      ${(() => { const r = C.monthReport(state, d.slice(0, 7)); return `<div class="card" data-tab="compta"><div class="row line"><span>Ce mois : recettes HT</span><b>${eur(r.revenue)}</b></div><div class="row line"><span>Dépenses (achats + charges)</span><b>${eur(r.expenses)}</b></div><div class="row line total"><span>Ce que tu gagnes</span><b class="${r.result < 0 ? 'bad' : 'good'}">${eur(r.result)}</b></div></div>`; })()}
      <div class="card"><div class="row"><span>Valeur du stock (prix d'achat HT)</span><b>${eur(C.stockValue(state))}</b></div></div>`;
  }

  function adviceSection(filter) {
    let list = [];
    try { list = C.advice(state); } catch (e) { console.error(e); }
    if (filter) list = list.filter(filter);
    if (!list.length) return '';
    return `<h2>💡 Conseils</h2>${list.map((a) => `<div class="advice adv-${a.level}">
      <div class="adv-title">${ADV_ICON[a.level]} ${esc(a.title)}</div><p>${esc(a.text)}</p>
      ${a.tips ? `<details><summary>Que faire ?</summary>${a.tips.map((t) => `<p>• ${esc(t)}</p>`).join('')}</details>` : ''}</div>`).join('')}`;
  }

  // ================= Caisse =================
  function ticket() { return (state.ticket || (state.ticket = [])); }
  function ticketAdd(id, n) {
    const t = ticket();
    const l = t.find((x) => x.id === id);
    if (l) l.qty += n; else if (n > 0) t.push({ id, qty: n });
    state.ticket = t.filter((x) => x.qty > 0);
    save(); render();
  }
  function checkout(mode) {
    const t = ticket();
    if (!t.length) return;
    const type = mode === 'offert' ? 'offert' : mode === 'perte' ? 'perte' : 'vente';
    const pay = ['cb', 'cash', 'other'].includes(mode) ? mode : null;
    const created = [];
    const ts = Date.now();
    for (const l of t) {
      if (!state.items.find((i) => i.id === l.id)) continue;
      created.push(C.recordSale(state, l.id, { qty: l.qty, type, pay, ts }));
    }
    const total = created.reduce((s, x) => s + x.price * x.qty, 0);
    const saved = t.slice();
    state.ticket = [];
    save(); render();
    const label = type === 'vente' ? `Encaissé ${eur(total)} (${PAY[mode]})` : type === 'offert' ? 'Enregistré comme offert' : 'Enregistré comme perte';
    toast(label, () => { for (const s of created) C.deleteSale(state, s.id); state.ticket = saved; save(); render(); });
  }

  function viewPOS() {
    const items = state.items.filter((i) => i.active !== false).sort((a, b) => (a.pos ?? 999) - (b.pos ?? 999) || a.name.localeCompare(b.name));
    if (!items.length) return '<div class="card empty"><p>Ta carte est vide.</p><button class="btn primary" data-action="addItem">＋ Ajouter un article</button> <button class="btn" data-action="loadStarter">Carte de départ</button></div>';
    const cats = [...new Set(items.map((i) => i.category))];
    const shown = posCat === 'all' ? items : items.filter((i) => i.category === posCat);
    const t = ticket();
    const byId = new Map(state.items.map((i) => [i.id, i]));
    const total = t.reduce((s, l) => s + (Number(byId.get(l.id)?.price) || 0) * l.qty, 0);
    const n = t.reduce((s, l) => s + l.qty, 0);
    const d = day();
    const sales = C.salesOfDay(state, d).slice().sort((a, b) => b.ts - a.ts);
    const sm = C.summarize(sales);
    return `<div class="filters"><button class="btn sm ${posCat === 'all' ? 'on' : ''}" data-action="posCat" data-v="all">Tout</button>
        ${cats.map((c) => `<button class="btn sm ${posCat === c ? 'on' : ''}" data-action="posCat" data-v="${esc(c)}">${esc(catLabel(c))}</button>`).join('')}</div>
      <div class="pos-grid">${shown.map((i) => {
        const q = t.find((l) => l.id === i.id);
        return `<button class="pos-btn" data-action="add" data-id="${esc(i.id)}"><span class="pos-name">${esc(i.name)}</span><b>${eur(i.price)}</b>${q ? `<i class="pos-q">${q.qty}</i>` : ''}</button>`;
      }).join('')}</div>
      <div class="ticket ${t.length ? '' : 'empty-ticket'}">
        ${t.length ? `<div class="ticket-lines">${t.map((l) => { const i = byId.get(l.id); return i ? `<div class="row line"><span><button class="btn sm" data-action="ticketMinus" data-id="${esc(l.id)}">−</button> ${l.qty} × ${esc(i.name)}</span><b>${eur(i.price * l.qty)}</b></div>` : ''; }).join('')}</div>
        <div class="row ticket-total"><span>${n} article${n > 1 ? 's' : ''}</span><b>${eur(total)}</b></div>
        <div class="pay-btns"><button class="btn primary" data-action="pay" data-v="cb">💳 CB</button><button class="btn primary" data-action="pay" data-v="cash">💶 Espèces</button><button class="btn" data-action="pay" data-v="other">🔁 Autre</button></div>
        <div class="pay-btns"><button class="btn sm" data-action="pay" data-v="offert">🎁 Offert</button><button class="btn sm" data-action="pay" data-v="perte">💥 Perte / casse</button><button class="btn sm danger" data-action="ticketClear">Vider</button></div>`
        : '<p class="muted small" style="margin:0">Touche les boissons servies pour composer le ticket, puis encaisse.</p>'}
      </div>
      <h2>Journée du ${esc(fdate(d))}</h2>
      <div class="stats">
        <div class="stat"><b>${eur(sm.ttc)}</b><span>CA TTC</span></div>
        <div class="stat"><b>${eur(sm.cb)}</b><span>CB</span></div>
        <div class="stat"><b>${eur(sm.cash)}</b><span>espèces</span></div>
      </div>
      <div class="btns"><button class="btn" data-action="closeDay">🔒 Clôturer la caisse</button></div>
      <div class="card">${sales.slice(0, 60).map((s) => `<div class="item"><div class="item-main"><div class="item-title">${s.qty} × ${esc(s.name)}${s.type !== 'vente' ? ` <span class="tag">${s.type}</span>` : ''}</div>
        <div class="item-meta">${ftime(s.ts)}${s.type === 'vente' ? ' · ' + PAY[s.pay] : ''} · coût ${eur(s.cost * s.qty)}</div></div>
        <b>${eur(s.price * s.qty)}</b><button class="icon-btn sm" data-action="delSale" data-id="${esc(s.id)}" title="Annuler">✕</button></div>`).join('') || '<p class="empty">Aucune vente aujourd\'hui.</p>'}</div>`;
  }

  function openClosingForm() {
    const d = day();
    const prev = state.closings.find((c) => c.day === d);
    const lastFloat = (state.closings[state.closings.length - 1] || {}).float || '';
    const sm = C.summarize(C.salesOfDay(state, d));
    modal(`<h2>🔒 Clôture du ${esc(fdate(d))}</h2>
      <div class="stats"><div class="stat"><b>${eur(sm.ttc)}</b><span>CA TTC</span></div><div class="stat"><b>${eur(sm.cb)}</b><span>CB</span></div><div class="stat"><b>${eur(sm.cash)}</b><span>espèces</span></div></div>
      <p class="small muted">TVA collectée : ${eur(sm.tva)} · CA HT ${eur(sm.ht)} · offerts ${eur(sm.offered)} (coût) · pertes ${eur(sm.lost)} (coût)</p>
      <div class="grid2"><div><label>Fond de caisse au départ (€)</label><input name="float" inputmode="decimal" value="${esc(prev ? prev.float : lastFloat)}"></div>
      <div><label>Espèces comptées (€)</label><input name="counted" inputmode="decimal" required value="${esc(prev ? prev.counted : '')}"></div></div>
      <div><label>Total TPE (CB) relevé (€, facultatif)</label><input name="tpe" inputmode="decimal" value="${esc(prev && prev.tpe != null ? prev.tpe : '')}"></div>
      <div id="closing-res" class="card"></div>`, (fd) => {
      const c = C.closingFor(state, d, num(fd.get('counted')) || 0, num(fd.get('float')) || 0);
      c.tpe = num(fd.get('tpe'));
      state.closings = state.closings.filter((x) => x.day !== d).concat(c);
      const t = state.tasks.find((x) => x.cat === 'caisse' && x.freq === 'daily');
      if (t) t.lastDone = todayISO();
      save(); toast(`Caisse clôturée — écart ${eur(c.diff)}`);
    }, { onOpen: (form) => {
      const upd = () => {
        const fl = num(form.float.value) || 0, co = num(form.counted.value);
        const c = C.closingFor(state, d, co || 0, fl);
        const tpe = num(form.tpe.value);
        $('#closing-res', form).innerHTML = `<div class="row line"><span>Espèces attendues (fond + ventes)</span><b>${eur(c.expected)}</b></div>
          ${co != null ? `<div class="row line"><span>Écart espèces</span><b class="${Math.abs(c.diff) >= 5 ? 'bad' : 'good'}">${c.diff > 0 ? '+' : ''}${eur(c.diff)}</b></div>` : ''}
          ${tpe != null ? `<div class="row line"><span>Écart CB</span><b class="${Math.abs(tpe - c.cb) >= 1 ? 'bad' : 'good'}">${eur(tpe - c.cb)}</b></div>` : ''}`;
      };
      form.addEventListener('input', upd); upd();
    } });
  }

  // ================= Carte & prix =================
  function viewMenu() {
    const all = C.analyzeMenu(state).concat(state.items.filter((i) => i.active === false).map((i) => Object.assign(C.analyzeItem(state, i), { inactive: true })));
    const cats = [...new Set(all.map((a) => a.item.category))];
    let list = all;
    if (menuFilter === 'low') list = all.filter((a) => a.status === 'low' || a.status === 'watch' || a.status === 'unknown' || a.status === 'noprice');
    else if (menuFilter !== 'all') list = all.filter((a) => a.item.category === menuFilter);
    list.sort((a, b) => (a.item.pos ?? 999) - (b.item.pos ?? 999) || a.item.name.localeCompare(b.item.name));
    const nLow = all.filter((a) => a.status === 'low').length;
    const minC = C.minCoef(state);
    return `<div class="section-title"><h2>🍸 Carte & prix</h2><button class="btn sm primary" data-action="addItem">＋ Article</button></div>
      <div class="card rule"><b>Règle : prix de vente ≥ ${minC} × coût complet</b>
        <p class="small muted">Coût complet = doses de matière (pertes comprises) + charge du bar de ${eur(state.settings.overhead)} par verre. Le « coef » est prix TTC ÷ coût. Réglages dans ⚙️.</p>
        ${nLow ? `<div class="btns"><button class="btn primary" data-action="fixAll">⚡ Remonter les ${nLow} prix sous ×${minC}</button></div>` : '<p class="good small">✔ Tous les prix respectent la règle.</p>'}
      </div>
      <div class="filters"><button class="btn sm ${menuFilter === 'all' ? 'on' : ''}" data-action="menuFilter" data-v="all">Tout</button>
        <button class="btn sm ${menuFilter === 'low' ? 'on' : ''}" data-action="menuFilter" data-v="low">⚠️ À revoir</button>
        ${cats.map((c) => `<button class="btn sm ${menuFilter === c ? 'on' : ''}" data-action="menuFilter" data-v="${esc(c)}">${esc(catLabel(c))}</button>`).join('')}</div>
      <div class="card">${list.map(menuRow).join('') || '<p class="empty">Aucun article.</p>'}</div>
      ${adviceSection((a) => a.tab === 'menu' && !a.title.includes('sous la règle'))}
      <div class="btns"><button class="btn" data-action="exportMenu">📄 Exporter la carte (tableur)</button></div>`;
  }
  function menuRow(a) {
    const [cls, lab] = STATUS[a.status] || STATUS.ok;
    return `<div class="item" data-action="editItem" data-id="${esc(a.item.id)}"><div class="item-main">
        <div class="item-title">${esc(a.item.name)}${a.inactive ? ' <span class="tag">masqué</span>' : ''}</div>
        <div class="item-meta">coût ${eur(a.cost)} · coef <b>${coefF(a.coef)}</b> · marge ${eur(a.margin)} HT${a.status === 'low' || a.status === 'watch' ? ` · <b>mini ${eur(a.minPrice)}</b>${a.suggested > a.minPrice ? `, visé ${eur(a.suggested)}` : ''}` : ''}</div>
      </div><div class="right"><b>${eur(a.priceTTC)}</b><span class="badge ${cls}">${lab}</span></div></div>`;
  }

  function fixAllPrices() {
    const low = C.analyzeMenu(state).filter((a) => a.status === 'low');
    if (!low.length) return;
    modal(`<h2>⚡ Remonter les prix à ×${C.minCoef(state)}</h2>
      <p class="small muted">Choisis pour chaque article : prix minimum (×${C.minCoef(state)}) ou prix visé (coef de la catégorie).</p>
      ${low.map((a) => `<div class="check-row"><div><b>${esc(a.item.name)}</b><div class="small muted">actuel ${eur(a.priceTTC)} · coût ${eur(a.cost)}</div></div>
        <select name="${esc(a.item.id)}"><option value="min">${eur(a.minPrice)} (mini)</option>${a.suggested > a.minPrice ? `<option value="target">${eur(a.suggested)} (visé)</option>` : ''}<option value="skip">Ne pas changer</option></select></div>`).join('')}`,
    (fd) => {
      let n = 0;
      for (const a of low) {
        const v = fd.get(a.item.id);
        if (v === 'skip') continue;
        setPrice(a.item, v === 'target' ? a.suggested : a.minPrice); n++;
      }
      save(); toast(`${n} prix mis à jour`);
    }, { saveLabel: 'Appliquer' });
  }
  function setPrice(item, price) {
    if (Number(item.price) === Number(price)) return;
    state.priceLog.push({ date: todayISO(), itemId: item.id, name: item.name, from: Number(item.price) || 0, to: Number(price) });
    item.price = Number(price);
  }

  const DOSES = [2, 3, 4, 6, 8, 10, 12, 20, 25, 33, 50];
  function openItemForm(id) {
    const it = id ? state.items.find((x) => x.id === id) : { name: '', category: 'cocktail', price: '', recipe: [], active: true };
    if (!it) return;
    const products = state.products.slice().sort((a, b) => a.name.localeCompare(b.name));
    const prodOptions = (sel) => '<option value="">— produit —</option>' + products.map((p) => `<option value="${esc(p.id)}" ${p.id === sel ? 'selected' : ''}>${esc(p.name)} (${unitLabel(p.unit)})</option>`).join('');
    const recipeRow = (r = {}) => `<div class="recipe-row"><select name="rp">${prodOptions(r.productId)}</select><input name="rq" inputmode="decimal" placeholder="dose" value="${esc(r.qty ?? '')}"><span class="ru small muted"></span><button type="button" class="icon-btn sm rdel">✕</button></div>`;
    const cats = Object.entries(CAT).map(([k, c]) => `<option value="${k}" ${it.category === k ? 'selected' : ''}>${c.icon} ${c.label}</option>`).join('');
    modal(`<h2>${id ? '✏️ Modifier' : '＋ Nouvel article'}</h2>
      <label>Nom (tel qu'affiché sur la carte)</label><input name="name" required value="${esc(it.name)}" placeholder="ex : Mojito, Pinte IPA, Ricard…">
      <div class="grid2"><div><label>Catégorie</label><select name="category">${cats}</select></div>
        <div><label>TVA</label><select name="vat"><option value="">Auto (catégorie)</option>${[20, 10, 5.5].map((v) => `<option value="${v}" ${Number(it.vat) === v && it.vat !== '' && it.vat != null ? 'selected' : ''}>${String(v).replace('.', ',')} %</option>`).join('')}</select></div></div>
      <label>Recette / doses bar</label>
      <div id="recipe">${(it.recipe.length ? it.recipe : [{}]).map(recipeRow).join('')}</div>
      <div class="dose-chips small">Dose rapide (cl) : ${DOSES.map((d) => `<button type="button" class="chip" data-dose="${d}">${d}</button>`).join('')}</div>
      <div class="btns"><button type="button" class="btn sm" id="add-ing">＋ Ingrédient</button>${products.length ? '' : ' <span class="small muted">Ajoute d\'abord tes produits dans 📦 Stock.</span>'}</div>
      <div class="grid2"><div><label>Garniture / extra (€ HT)</label><input name="extraCost" inputmode="decimal" placeholder="0" value="${esc(it.extraCost ?? '')}"></div>
        <div><label>Charge du bar pour ce verre (€)</label><input name="overhead" inputmode="decimal" placeholder="défaut ${esc(nf.format(state.settings.overhead || 0))}" value="${esc(it.overhead ?? '')}"></div></div>
      <div class="grid2"><div><label>Prix de vente TTC (€)</label><input name="price" inputmode="decimal" value="${esc(it.price)}"></div>
        <div><label>Coef visé (vide = catégorie)</label><input name="targetCoef" inputmode="decimal" placeholder="mini ${C.minCoef(state)}" value="${esc(it.targetCoef ?? '')}"></div></div>
      <div id="calc" class="calc"></div>
      <label class="inline"><input type="checkbox" name="active" ${it.active !== false ? 'checked' : ''}> Visible en caisse</label>
      <label>Ordre d'affichage en caisse</label><input name="pos" type="number" value="${esc(it.pos ?? '')}">`,
    (fd, form) => {
      const recipe = readRecipe(form);
      const data = {
        name: fd.get('name').trim(), category: fd.get('category'), vat: fd.get('vat') === '' ? null : Number(fd.get('vat')),
        recipe, extraCost: num(fd.get('extraCost')), overhead: num(fd.get('overhead')), targetCoef: num(fd.get('targetCoef')),
        active: !!fd.get('active'), pos: num(fd.get('pos')),
      };
      const price = num(fd.get('price')) || 0;
      if (id) { Object.assign(it, data); setPrice(it, price); }
      else state.items.push(Object.assign({ id: 'm-' + C.uid() }, data, { price }));
      save();
    }, {
      onDelete: id ? () => { state.items = state.items.filter((x) => x.id !== id); save(); } : null,
      onOpen: (form) => {
        let focused = null;
        const box = $('#recipe', form);
        const upd = () => {
          for (const row of $$('.recipe-row', box)) {
            const p = state.products.find((x) => x.id === $('[name=rp]', row).value);
            const q = num($('[name=rq]', row).value);
            const uc = C.unitCost(p);
            $('.ru', row).textContent = p ? `${unitLabel(p.unit)}${uc != null && q ? ' = ' + eur(uc * q) : ''}` : '';
          }
          const tmp = { category: form.category.value, vat: form.vat.value === '' ? null : Number(form.vat.value), recipe: readRecipe(form),
            extraCost: num(form.extraCost.value), overhead: num(form.overhead.value), targetCoef: num(form.targetCoef.value), price: num(form.price.value) || 0 };
          const a = C.analyzeItem(state, tmp);
          const [cls, lab] = STATUS[a.status] || STATUS.ok;
          $('#calc', form).innerHTML = a.cost > 0 ? `
            <div class="row line"><span>Matière (doses + pertes + garniture)</span><b>${eur(a.material)}</b></div>
            <div class="row line"><span>Charge du bar</span><b>${eur(a.overhead)}</b></div>
            <div class="row line"><span><b>Coût complet</b></span><b>${eur(a.cost)}</b></div>
            <div class="row line"><span>Prix minimum (×${a.min})</span><b>${eur(a.minPrice)}</b></div>
            ${a.suggested > a.minPrice ? `<div class="row line"><span>Prix visé (×${nf.format(a.target)})</span><b>${eur(a.suggested)}</b></div>` : ''}
            ${a.priceTTC > 0 ? `<div class="row line"><span>Ton prix : coef</span><b>${coefF(a.coef)} <span class="badge ${cls}">${lab}</span></b></div>
            <div class="row line"><span>Marge HT par verre (TVA ${nf.format(a.vat)} %)</span><b>${eur(a.margin)}</b></div>` : ''}
            <div class="btns"><button type="button" class="btn sm" data-set="${a.minPrice}">Prendre le mini ${eur(a.minPrice)}</button>${a.suggested > a.minPrice ? `<button type="button" class="btn sm" data-set="${a.suggested}">Prendre ${eur(a.suggested)}</button>` : ''}</div>`
            : '<p class="small muted">Renseigne la recette pour calculer le coût et le prix minimum.</p>';
        };
        box.addEventListener('focusin', (e) => { const r = e.target.closest('.recipe-row'); if (r) focused = r; });
        form.addEventListener('input', upd);
        form.addEventListener('change', upd);
        form.addEventListener('click', (e) => {
          if (e.target.id === 'add-ing') { box.insertAdjacentHTML('beforeend', recipeRow()); focused = box.lastElementChild; $('select', focused).focus(); upd(); }
          else if (e.target.classList.contains('rdel')) { e.target.closest('.recipe-row').remove(); upd(); }
          else if (e.target.dataset.dose) {
            const row = focused || $$('.recipe-row', box).find((r) => !$('[name=rq]', r).value) || box.lastElementChild;
            if (row) { $('[name=rq]', row).value = e.target.dataset.dose; upd(); }
          } else if (e.target.dataset.set) { form.price.value = String(e.target.dataset.set).replace('.', ','); upd(); }
        });
        upd();
      },
    });
  }
  function readRecipe(form) {
    return $$('.recipe-row', form).map((r) => ({ productId: $('[name=rp]', r).value, qty: num($('[name=rq]', r).value) }))
      .filter((r) => r.productId && r.qty > 0);
  }

  function exportMenuCSV() {
    const pm = pmap();
    const rows = [['Article', 'Catégorie', 'Recette', 'Coût matière HT', 'Charge bar', 'Coût complet', 'Prix TTC', 'TVA %', 'Prix HT', 'Marge HT', 'Coef', 'Prix mini', 'Statut']];
    for (const a of C.analyzeMenu(state)) {
      rows.push([a.item.name, CAT[a.item.category]?.label || '', (a.item.recipe || []).map((r) => `${r.qty} ${unitLabel(pm.get(r.productId)?.unit)} ${pm.get(r.productId)?.name || '?'}`).join(' + '),
        a.material, a.overhead, a.cost, a.priceTTC, a.vat, a.priceHT, a.margin, a.coef, a.minPrice, (STATUS[a.status] || [])[1]]);
    }
    const f = (v) => (typeof v === 'number' ? (Math.round(v * 100) / 100).toString().replace('.', ',') : '"' + String(v ?? '').replace(/"/g, '""') + '"');
    download(`carte-${todayISO()}.csv`, '﻿' + rows.map((r) => r.map(f).join(';')).join('\n'), 'text/csv');
  }

  // ================= Stock =================
  function viewStock() {
    const prods = state.products.slice().sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    const low = C.lowStock(state);
    const groups = {};
    for (const p of prods) (groups[p.category] || (groups[p.category] = [])).push(p);
    const lastInv = state.inventories.slice().sort((a, b) => a.date.localeCompare(b.date)).pop();
    return `<div class="section-title"><h2>📦 Stock</h2><button class="btn sm primary" data-action="addProduct">＋ Produit</button></div>
      <div class="stats">
        <div class="stat"><b>${eur(C.stockValue(state))}</b><span>valeur HT</span></div>
        <div class="stat"><b>${low.length}</b><span>à commander</span></div>
        <div class="stat"><b>${lastInv ? esc(fdate(lastInv.date)) : '—'}</b><span>dernier inventaire</span></div>
      </div>
      <div class="btns"><button class="btn" data-action="inventory">📋 Faire l'inventaire</button><button class="btn" data-action="order">🛒 Bon de commande</button><button class="btn" data-action="addPurchase">🚚 Saisir une livraison</button></div>
      <p class="small muted">Stock théorique : il baisse à chaque verre encaissé, monte à chaque livraison, et se recale à chaque inventaire.</p>
      ${adviceSection((a) => a.tab === 'stock')}
      ${lastInv && lastInv.lines.some((l) => l.diff) ? `<details class="card"><summary>Écarts du dernier inventaire : ${eur(lastInv.total)}</summary>${lastInv.lines.filter((l) => l.diff).map((l) => `<div class="row line small"><span>${esc(l.name)}</span><span class="${l.value < 0 ? 'bad' : ''}">${l.diff > 0 ? '+' : ''}${nf.format(l.diff)} → ${eur(l.value)}</span></div>`).join('')}</details>` : ''}
      ${Object.entries(groups).map(([c, ps]) => `<h3 class="group">${esc(catLabel(c))}</h3><div class="card">${ps.map((p) => {
        const st = C.stockStatus(p); const uc = C.unitCost(p);
        return `<div class="item" data-action="editProduct" data-id="${esc(p.id)}"><div class="item-main">
          <div class="item-title">${esc(p.name)}${p.active === false ? ' <span class="tag">inactif</span>' : ''}</div>
          <div class="item-meta">${fmtStock(p)}</div>
          <div class="item-meta">${eur(p.packPrice)} HT / ${esc(p.packLabel || 'cond.')} · ${uc != null ? eur3(uc) + ' / ' + unitLabel(p.unit) : '—'}${p.lossPct ? ` (perte ${nf.format(p.lossPct)} %)` : ''}${p.supplier ? ' · ' + esc(p.supplier) : ''}</div>
        </div>${st !== 'ok' ? `<span class="badge ${st === 'out' ? 'b-bad' : 'b-soon'}">${st === 'out' ? 'Rupture' : 'Bas'}</span>` : ''}</div>`;
      }).join('')}</div>`).join('') || '<div class="card empty"><p>Aucun produit.</p><button class="btn primary" data-action="loadStarter">Charger la carte de départ</button></div>'}`;
  }

  function openProductForm(id) {
    const p = id ? state.products.find((x) => x.id === id) : { name: '', category: 'spiritueux', unit: 'cl', packLabel: 'bouteille 70 cl', packSize: 70, packPrice: '', lossPct: 2, stock: 0, minStock: 70, parStock: 140, supplier: '', active: true };
    if (!p) return;
    const size = Number(p.packSize) || 1;
    const inPacks = (v) => (v === '' || v == null ? '' : String(Math.round((Number(v) / size) * 100) / 100).replace('.', ','));
    const suppliers = [...new Set(state.products.map((x) => x.supplier).filter(Boolean))];
    const usedIn = id ? state.items.filter((i) => (i.recipe || []).some((r) => r.productId === id)) : [];
    modal(`<h2>${id ? '✏️ ' + esc(p.name) : '＋ Nouveau produit'}</h2>
      <label>Nom</label><input name="name" required value="${esc(p.name)}" placeholder="ex : Ricard 1 L, Fût IPA 20 L…">
      <div class="grid2"><div><label>Catégorie</label><select name="category">${Object.entries(CAT).map(([k, c]) => `<option value="${k}" ${p.category === k ? 'selected' : ''}>${c.icon} ${c.label}</option>`).join('')}</select></div>
        <div><label>Unité de dose</label><select name="unit">${Object.entries(C.UNITS).map(([k, l]) => `<option value="${k}" ${p.unit === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
      <div class="grid2"><div><label>Conditionnement acheté</label><input name="packLabel" value="${esc(p.packLabel)}" placeholder="bouteille 70 cl, fût 30 L, pack 24…"></div>
        <div><label>Contenance (en unités de dose)</label><input name="packSize" inputmode="decimal" required value="${esc(p.packSize)}" placeholder="70 pour 70 cl, 3000 pour 30 L"></div></div>
      <div class="grid2"><div><label>Prix d'achat HT du conditionnement (€)</label><input name="packPrice" inputmode="decimal" value="${esc(p.packPrice)}"></div>
        <div><label>Pertes (%)</label><input name="lossPct" inputmode="decimal" value="${esc(p.lossPct ?? 0)}" placeholder="fût 5–10 %, bouteille 1–2 %"></div></div>
      <div id="pcalc" class="calc"></div>
      <div class="grid2"><div><label>Stock actuel (en conditionnements, ex 2,5)</label><input name="stock" inputmode="decimal" value="${esc(inPacks(p.stock))}"></div>
        <div><label>Fournisseur</label><input name="supplier" list="suppliers" value="${esc(p.supplier || '')}"><datalist id="suppliers">${suppliers.map((s) => `<option value="${esc(s)}">`).join('')}</datalist></div></div>
      <div class="grid2"><div><label>Seuil d'alerte (cond.)</label><input name="minStock" inputmode="decimal" value="${esc(inPacks(p.minStock))}"></div>
        <div><label>Stock cible après commande (cond.)</label><input name="parStock" inputmode="decimal" value="${esc(inPacks(p.parStock))}"></div></div>
      <label class="inline"><input type="checkbox" name="active" ${p.active !== false ? 'checked' : ''}> Produit actif</label>
      ${usedIn.length ? `<p class="small muted">Utilisé dans : ${esc(usedIn.map((i) => i.name).join(', '))}</p>` : ''}
      ${(p.priceHistory || []).length ? `<details><summary>Historique du prix d'achat</summary>${p.priceHistory.slice().reverse().map((h) => `<p class="small">${esc(fdate(h.date))} : ${eur(h.from)} → <b>${eur(h.to)}</b></p>`).join('')}</details>` : ''}`,
    (fd) => {
      const ps = num(fd.get('packSize')) || 1;
      const toBase = (v) => { const n = num(v); return n == null ? 0 : Math.round(n * ps * 100) / 100; };
      const newPrice = num(fd.get('packPrice'));
      const data = { name: fd.get('name').trim(), category: fd.get('category'), unit: fd.get('unit'), packLabel: fd.get('packLabel').trim(), packSize: ps,
        lossPct: num(fd.get('lossPct')) || 0, stock: toBase(fd.get('stock')), minStock: toBase(fd.get('minStock')), parStock: toBase(fd.get('parStock')),
        supplier: fd.get('supplier').trim(), active: !!fd.get('active') };
      if (id) {
        if (newPrice != null && Number(p.packPrice) !== newPrice) (p.priceHistory = p.priceHistory || []).push({ date: todayISO(), from: Number(p.packPrice) || null, to: newPrice });
        Object.assign(p, data, { packPrice: newPrice });
      } else state.products.push(Object.assign({ id: 'p-' + C.uid(), priceHistory: [] }, data, { packPrice: newPrice }));
      save();
    }, {
      onDelete: id ? () => {
        if (usedIn.length && !confirm(`Ce produit est utilisé dans ${usedIn.length} article(s) : leur coût deviendra inconnu. Continuer ?`)) return;
        state.products = state.products.filter((x) => x.id !== id); save();
      } : null,
      onOpen: (form) => {
        const upd = () => {
          const tmp = { packPrice: num(form.packPrice.value), packSize: num(form.packSize.value), lossPct: num(form.lossPct.value) };
          const uc = C.unitCost(tmp); const u = unitLabel(form.unit.value);
          const doses = form.unit.value === 'cl' ? [2, 4, 6, 12, 25, 50] : form.unit.value === 'g' ? [7, 14] : [1];
          $('#pcalc', form).innerHTML = uc != null ? `<div class="small">Coût réel : <b>${eur3(uc)} / ${u}</b> → ${doses.map((d) => `${d} ${u} = <b>${eur(uc * d)}</b>`).join(' · ')}</div>` : '';
        };
        form.addEventListener('input', upd); form.addEventListener('change', upd); upd();
      },
    });
  }

  function openInventoryForm() {
    const prods = state.products.filter((p) => p.active !== false).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    if (!prods.length) return toast('Ajoute d\'abord des produits');
    modal(`<h2>📋 Inventaire</h2>
      <p class="small muted">Compte en conditionnements, décimales acceptées (ex : 2,3 bouteilles ; fût entamé : pèse-le ou estime). Laisse vide ce que tu ne comptes pas.</p>
      <label>Date</label><input name="date" type="date" value="${todayISO()}">
      ${prods.map((p) => `<div class="check-row"><div><b>${esc(p.name)}</b><div class="small muted">théorique : ${fmtStock(p)}</div></div>
        <input class="inv-input" name="c_${esc(p.id)}" inputmode="decimal" placeholder="${esc(nf1.format((Number(p.stock) || 0) / (Number(p.packSize) || 1)))}"></div>`).join('')}`,
    (fd) => {
      const counts = {};
      for (const p of prods) {
        const v = num(fd.get('c_' + p.id));
        if (v != null && !isNaN(v)) counts[p.id] = Math.round(v * (Number(p.packSize) || 1) * 100) / 100;
      }
      if (!Object.keys(counts).length) { toast('Rien de compté'); return false; }
      const inv = C.saveInventory(state, fd.get('date') || todayISO(), counts);
      const t = state.tasks.find((x) => x.cat === 'stock' && /inventaire/i.test(x.title));
      if (t) t.lastDone = todayISO();
      save();
      setTimeout(() => modal(`<h2>Résultat de l'inventaire</h2>
        <div class="card"><div class="row"><span>Écart total valorisé</span><b class="${inv.total < 0 ? 'bad' : 'good'}">${eur(inv.total)}</b></div></div>
        ${inv.lines.filter((l) => l.diff).sort((a, b) => a.value - b.value).map((l) => `<div class="row line small"><span>${esc(l.name)}</span><span class="${l.value < 0 ? 'bad' : ''}">${l.diff > 0 ? '+' : ''}${nf.format(l.diff)} → ${eur(l.value)}</span></div>`).join('') || '<p class="good">Aucun écart 👌</p>'}
        <p class="small muted">Un écart négatif = du stock parti sans être encaissé (dose trop généreuse, offert ou casse non saisi, oubli de caisse, perte au fût…).</p>`, null), 50);
    }, { saveLabel: 'Valider l\'inventaire' });
  }

  function openOrderList() {
    const list = C.orderList(state);
    if (!list.length) return toast('Aucun produit sous son seuil d\'alerte 👌');
    const by = {};
    for (const o of list) (by[o.supplier] || (by[o.supplier] = [])).push(o);
    const text = Object.entries(by).map(([s, os]) => `${s}\n` + os.map((o) => `- ${o.packs} × ${o.product.packLabel || 'cond.'} ${o.product.name}`).join('\n')).join('\n\n');
    modal(`<h2>🛒 Bon de commande</h2>
      <p class="small muted">Produits sous le seuil d'alerte, quantité pour remonter au stock cible.</p>
      ${Object.entries(by).map(([s, os]) => `<div class="card"><h3>${esc(s)}</h3>${os.map((o) => `<div class="row line"><span>${o.packs} × ${esc(o.product.packLabel || 'cond.')} — ${esc(o.product.name)}</span><span>${eur(o.cost)}</span></div>`).join('')}
        <div class="row line"><b>Total HT estimé</b><b>${eur(os.reduce((t, o) => t + o.cost, 0))}</b></div>
        <div class="btns"><button type="button" class="btn sm" data-receive="${esc(s)}">🚚 Reçu → saisir la livraison</button></div></div>`).join('')}
      <div class="btns"><button type="button" class="btn" id="copy-order">📋 Copier la liste</button></div>`, null, {
      onOpen: (form) => {
        $('#copy-order', form).onclick = () => { navigator.clipboard?.writeText(text).then(() => toast('Liste copiée'), () => toast('Copie impossible')); };
        $$('[data-receive]', form).forEach((b) => b.onclick = () => {
          const os = by[b.dataset.receive];
          $('#modal').close();
          openPurchaseForm(null, { supplier: b.dataset.receive === 'Sans fournisseur' ? '' : b.dataset.receive, lines: os.map((o) => ({ productId: o.product.id, packs: o.packs, packPrice: o.product.packPrice })) });
        });
      },
    });
  }

  // ================= Achats =================
  const curMonth = () => comptaMonth || day().slice(0, 7);
  const fmonth = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); };
  const FREQ_LABEL = { once: 'Ponctuelle', monthly: 'Chaque mois', quarterly: 'Chaque trimestre', yearly: 'Chaque année' };

  function viewCompta() {
    const m = curMonth();
    const r = C.monthReport(state, m);
    const pm = pmap();
    const be = C.breakEven(state, m);
    // 6 derniers mois
    const months = [];
    for (let i = 5; i >= 0; i--) { const [y, mo] = m.split('-').map(Number); months.push(C.toISO(new Date(y, mo - 1 - i, 1)).slice(0, 7)); }
    const hist = months.map((x) => C.monthReport(state, x));
    const maxH = Math.max(1, ...hist.map((h) => Math.max(h.revenue, h.expenses)));
    const res = (v) => `<b class="${v < 0 ? 'bad' : 'good'}">${v > 0 ? '+' : ''}${eur(v)}</b>`;
    const recurring = state.charges.filter((c) => c.freq && c.freq !== 'once').sort((a, b) => (a.cat || '').localeCompare(b.cat || ''));
    return `<div class="month-nav"><button class="btn sm" data-action="monthShift" data-v="-1">‹</button><h2>💰 ${esc(fmonth(m))}</h2><button class="btn sm" data-action="monthShift" data-v="1">›</button></div>
      <div class="card result-card">
        <div class="row line"><span>➕ Recettes HT</span><b>${eur(r.revenue)}</b></div>
        <div class="row line sub"><span>Ventes caisse HT <span class="muted small">(${eur(r.salesTTC)} TTC)</span></span><span>${eur(r.salesHT)}</span></div>
        ${r.other ? `<div class="row line sub"><span>Autres recettes</span><span>${eur(r.other)}</span></div>` : ''}
        <div class="row line"><span>➖ Dépenses</span><b>${eur(r.expenses)}</b></div>
        <div class="row line sub"><span>Matière première achetée</span><span>${eur(r.buy)}</span></div>
        <div class="row line sub"><span>Charges</span><span>${eur(r.chargesTotal)}</span></div>
        <div class="row line total"><span>= Ce que tu gagnes ce mois</span>${res(r.result)}</div>
        ${Math.abs(r.resultSmoothed - r.result) > 1 ? `<p class="small muted">Charges annuelles / trimestrielles lissées sur le mois : ${res(r.resultSmoothed)}</p>` : ''}
        <p class="small muted">TVA collectée sur les ventes : ${eur(r.tva)} (à reverser, déjà exclue des recettes HT).</p>
      </div>
      ${be.fixed ? `<div class="card"><div class="row line"><span>Charges fixes moyennes / mois</span><b>${eur(be.fixed)}</b></div>
        ${be.caHT ? `<div class="row line"><span>CA HT nécessaire pour les couvrir</span><b>${eur(be.caHT)}</b></div>
        <p class="small muted">Seuil de rentabilité avec ton ratio d'achats ce mois (${pct(1 - be.rate)} du CA). ${r.salesHT >= be.caHT ? '✔ Atteint ce mois-ci.' : `Il manque ${eur(be.caHT - r.salesHT)} de CA HT.`}</p>` : ''}</div>` : ''}

      <div class="card"><h3>Recettes vs dépenses (6 mois)</h3><div class="bars duo">${hist.map((h) => `<div class="bar" title="${esc(fmonth(h.month))} : recettes ${eur(h.revenue)}, dépenses ${eur(h.expenses)}, résultat ${eur(h.result)}">
          <div class="pair"><i style="height:${Math.round((h.revenue / maxH) * 100)}%"></i><i class="exp" style="height:${Math.round((h.expenses / maxH) * 100)}%"></i></div>
          <span>${new Date(h.month + '-01T12:00').toLocaleDateString('fr-FR', { month: 'short' })}</span></div>`).join('')}</div>
        <p class="small muted"><span class="dot-in"></span> recettes HT · <span class="dot-out"></span> dépenses</p>
        ${hist.map((h) => `<div class="row line small"><span>${esc(fmonth(h.month))}</span>${res(h.result)}</div>`).join('')}</div>

      <div class="section-title"><h2>Charges du mois</h2><button class="btn sm primary" data-action="addCharge">＋ Charge</button></div>
      <div class="card">${r.charges.sort((a, b) => b.amount - a.amount).map((x) => `<div class="item" data-action="editCharge" data-id="${esc(x.charge.id)}"><div class="item-main">
          <div class="item-title">${esc(C.CHARGE_CATS[x.charge.cat] || 'Charge')}</div>
          <div class="item-meta">${x.charge.label ? esc(x.charge.label) + ' · ' : ''}${esc(FREQ_LABEL[x.charge.freq || 'once'])}</div></div><b>${eur(x.amount)}</b></div>`).join('') || '<p class="empty">Aucune charge ce mois-ci. Ajoute ton loyer, ton électricité, ton eau…</p>'}</div>
      ${recurring.length ? `<details class="card"><summary>Charges récurrentes enregistrées (${recurring.length}) · ${eur(C.fixedChargesPerMonth(state))}/mois en moyenne</summary>
        ${recurring.map((c) => `<div class="item" data-action="editCharge" data-id="${esc(c.id)}"><div class="item-main"><div class="item-title">${esc(C.CHARGE_CATS[c.cat] || '')}${c.label ? ' · ' + esc(c.label) : ''}</div>
          <div class="item-meta">${esc(FREQ_LABEL[c.freq])} depuis ${esc(fdate(c.date))}${c.end ? ' jusqu\'au ' + esc(fdate(c.end)) : ''}</div></div><b>${eur(c.amount)}</b></div>`).join('')}</details>` : ''}

      <div class="section-title"><h2>Autres recettes</h2><button class="btn sm" data-action="addIncome">＋ Recette</button></div>
      ${r.incomes.length ? `<div class="card">${r.incomes.map((x) => `<div class="item" data-action="editIncome" data-id="${esc(x.id)}"><div class="item-main"><div class="item-title">${esc(x.label || 'Recette')}</div><div class="item-meta">${esc(fdate(x.date))}</div></div><b>${eur(x.amount)}</b></div>`).join('')}</div>` : '<p class="small muted">Privatisation, événement, location de salle… (hors caisse).</p>'}

      <div class="section-title"><h2>Achats matière (livraisons)</h2><button class="btn sm" data-action="addPurchase">＋ Livraison</button></div>
      <p class="small muted">Chaque livraison ajoute au stock et met à jour le prix d'achat. Si un prix monte, les articles concernés sont signalés dans la carte.${r.salesHT ? ` Achats = ${pct(r.buy / r.salesHT)} du CA HT ce mois (coût des verres réellement servis : ${eur(r.materialUsed)}).` : ''}</p>
      <div class="card">${r.purchases.slice().sort((a, b) => b.date.localeCompare(a.date)).map((p) => `<div class="item" data-action="editPurchase" data-id="${esc(p.id)}"><div class="item-main">
        <div class="item-title">${esc(p.supplier || 'Fournisseur ?')}</div>
        <div class="item-meta">${esc(fdate(p.date))} · ${esc((p.lines || []).map((l) => `${nf.format(l.packs)} × ${pm.get(l.productId)?.name || '?'}`).join(', '))}</div>
      </div><b>${eur(p.total)}</b></div>`).join('') || '<p class="empty">Aucune livraison ce mois-ci.</p>'}</div>
      <div class="btns"><button class="btn" data-action="exportCompta">📄 Exporter le mois (tableur)</button></div>`;
  }

  function openChargeForm(id) {
    const c = id ? state.charges.find((x) => x.id === id) : { label: '', cat: 'loyer', amount: '', freq: 'monthly', date: curMonth() + '-01', end: '' };
    if (!c) return;
    modal(`<h2>${id ? '✏️ Charge' : '＋ Nouvelle charge'}</h2>
      <div class="grid2"><div><label>Type</label><select name="cat">${Object.entries(C.CHARGE_CATS).map(([k, l]) => `<option value="${k}" ${c.cat === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div><label>Libellé (facultatif)</label><input name="label" value="${esc(c.label)}" placeholder="ex : EDF, bail commercial…"></div></div>
      <div class="grid2"><div><label>Montant (€ HT si tu récupères la TVA)</label><input name="amount" inputmode="decimal" required value="${esc(c.amount)}"></div>
        <div><label>Fréquence</label><select name="freq">${Object.entries(FREQ_LABEL).map(([k, l]) => `<option value="${k}" ${(c.freq || 'once') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
      <div class="grid2"><div><label id="date-lbl">Date (1er paiement)</label><input name="date" type="date" required value="${esc(c.date)}"></div>
        <div class="f-rec"><label>Jusqu'au (vide = toujours)</label><input name="end" type="date" value="${esc(c.end || '')}"></div></div>
      <p class="small muted">Une charge récurrente se compte automatiquement chaque mois (ou trimestre, ou année) à partir de sa date. Si son montant change (nouveau contrat), mets une date de fin et crée-en une nouvelle.</p>`,
    (fd) => {
      const data = { cat: fd.get('cat'), label: fd.get('label').trim(), amount: num(fd.get('amount')) || 0, freq: fd.get('freq'), date: fd.get('date'), end: fd.get('freq') === 'once' ? '' : fd.get('end') };
      if (id) Object.assign(c, data); else state.charges.push(Object.assign({ id: 'c-' + C.uid() }, data));
      save();
    }, {
      onDelete: id ? () => { state.charges = state.charges.filter((x) => x.id !== id); save(); } : null,
      onOpen: (form) => { const upd = () => { $$('.f-rec', form).forEach((e) => e.hidden = form.freq.value === 'once'); $('#date-lbl', form).textContent = form.freq.value === 'once' ? 'Date' : 'Date (1er paiement)'; }; form.freq.addEventListener('change', upd); upd(); },
    });
  }
  function openIncomeForm(id) {
    const x = id ? state.incomes.find((i) => i.id === id) : { label: '', amount: '', date: todayISO() };
    if (!x) return;
    modal(`<h2>${id ? '✏️ Recette' : '＋ Autre recette'}</h2>
      <label>Libellé</label><input name="label" required value="${esc(x.label)}" placeholder="Privatisation, soirée, location…">
      <div class="grid2"><div><label>Montant HT (€)</label><input name="amount" inputmode="decimal" required value="${esc(x.amount)}"></div>
        <div><label>Date</label><input name="date" type="date" required value="${esc(x.date)}"></div></div>`,
    (fd) => {
      const data = { label: fd.get('label').trim(), amount: num(fd.get('amount')) || 0, date: fd.get('date') };
      if (id) Object.assign(x, data); else state.incomes.push(Object.assign({ id: 'r-' + C.uid() }, data));
      save();
    }, { onDelete: id ? () => { state.incomes = state.incomes.filter((i) => i.id !== id); save(); } : null });
  }
  function exportComptaCSV() {
    const m = curMonth(); const r = C.monthReport(state, m);
    const rows = [['Type', 'Date', 'Libellé', 'Catégorie', 'Montant']];
    rows.push(['Recette', m, 'Ventes caisse HT', '', r.salesHT]);
    for (const x of r.incomes) rows.push(['Recette', x.date, x.label, '', x.amount]);
    for (const p of r.purchases) rows.push(['Achat matière', p.date, p.supplier || '', p.note || '', -p.total]);
    for (const x of r.charges) rows.push(['Charge', m, x.charge.label || '', C.CHARGE_CATS[x.charge.cat] || '', -x.amount]);
    rows.push(['Résultat', m, '', '', r.result]);
    const f = (v) => (typeof v === 'number' ? (Math.round(v * 100) / 100).toString().replace('.', ',') : '"' + String(v ?? '').replace(/"/g, '""') + '"');
    download(`compta-${m}.csv`, '﻿' + rows.map((x) => x.map(f).join(';')).join('\n'), 'text/csv');
  }

  function openPurchaseForm(id, preset) {
    const pur = id ? state.purchases.find((x) => x.id === id) : Object.assign({ date: todayISO(), supplier: '', lines: [], note: '' }, preset);
    if (!pur) return;
    const products = state.products.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (!products.length) return toast('Ajoute d\'abord des produits dans 📦 Stock');
    const opts = (sel) => '<option value="">— produit —</option>' + products.map((p) => `<option value="${esc(p.id)}" ${p.id === sel ? 'selected' : ''}>${esc(p.name)} (${esc(p.packLabel || '')})</option>`).join('');
    const row = (l = {}) => `<div class="recipe-row pur"><select name="lp">${opts(l.productId)}</select><input name="ln" inputmode="decimal" placeholder="nb" value="${esc(l.packs ?? '')}"><input name="lprice" inputmode="decimal" placeholder="€ HT/u" value="${esc(l.packPrice ?? '')}"><button type="button" class="icon-btn sm rdel">✕</button></div>`;
    const suppliers = [...new Set(state.products.map((x) => x.supplier).concat(state.purchases.map((x) => x.supplier)).filter(Boolean))];
    modal(`<h2>🚚 ${id ? 'Modifier la livraison' : 'Nouvelle livraison'}</h2>
      <div class="grid2"><div><label>Date</label><input name="date" type="date" required value="${esc(pur.date)}"></div>
        <div><label>Fournisseur</label><input name="supplier" list="sup2" value="${esc(pur.supplier)}"><datalist id="sup2">${suppliers.map((s) => `<option value="${esc(s)}">`).join('')}</datalist></div></div>
      <label>Lignes (produit · nombre de conditionnements · prix HT unitaire)</label>
      <div id="lines">${(pur.lines.length ? pur.lines : [{}]).map(row).join('')}</div>
      <div class="btns"><button type="button" class="btn sm" id="add-line">＋ Ligne</button></div>
      <div class="calc" id="pur-total"></div>
      <label>Note (n° de facture…)</label><input name="note" value="${esc(pur.note || '')}">`,
    (fd, form) => {
      const lines = $$('.recipe-row', form).map((r) => ({ productId: $('[name=lp]', r).value, packs: num($('[name=ln]', r).value), packPrice: num($('[name=lprice]', r).value) }))
        .filter((l) => l.productId && l.packs);
      if (!lines.length) { toast('Ajoute au moins une ligne'); return false; }
      C.savePurchase(state, Object.assign(id ? pur : {}, { id: pur.id, date: fd.get('date'), supplier: fd.get('supplier').trim(), note: fd.get('note'), lines }));
      save(); toast('Livraison enregistrée, stock mis à jour');
    }, {
      onDelete: id ? () => { C.deletePurchase(state, id); save(); } : null,
      onOpen: (form) => {
        const box = $('#lines', form);
        const upd = () => {
          let t = 0;
          for (const r of $$('.recipe-row', box)) {
            const p = state.products.find((x) => x.id === $('[name=lp]', r).value);
            const pr = $('[name=lprice]', r);
            if (p && !pr.value && p.packPrice) pr.value = String(p.packPrice).replace('.', ',');
            t += (num($('[name=ln]', r).value) || 0) * (num(pr.value) || 0);
          }
          $('#pur-total', form).innerHTML = `<div class="row"><b>Total HT</b><b>${eur(t)}</b></div>`;
        };
        form.addEventListener('input', upd); form.addEventListener('change', upd);
        form.addEventListener('click', (e) => {
          if (e.target.id === 'add-line') { box.insertAdjacentHTML('beforeend', row()); upd(); }
          else if (e.target.classList.contains('rdel')) { e.target.closest('.recipe-row').remove(); upd(); }
        });
        upd();
      },
    });
  }

  // ================= Tâches =================
  function taskRow(x) {
    const t = x.task;
    const st = { overdue: ['b-bad', x.days === -1 ? 'Hier' : `Retard ${-x.days} j`], today: ['b-soon', 'Aujourd\'hui'], soon: ['b-unk', x.days === 1 ? 'Demain' : `Dans ${x.days} j`], done: ['b-ok', 'Fait ✔'], later: ['b-muted', fdate(C.toISO(x.due))] }[x.status] || ['', ''];
    return `<div class="item task ${x.status}"><button class="check-btn" data-action="doneTask" data-id="${esc(t.id)}" title="Marquer comme fait">${x.status === 'done' ? '✔' : ''}</button>
      <div class="item-main" data-action="editTask" data-id="${esc(t.id)}"><div class="item-title">${esc(t.title)}</div>
      <div class="item-meta">${esc(TASK_CAT[t.cat] || '')} · ${esc(TASK_FREQ[t.freq] || '')}${t.freq === 'weekly' && t.every > 1 ? ` (toutes les ${t.every} sem.)` : ''}${t.lastDone ? ' · fait le ' + esc(fdate(t.lastDone)) : ''}</div></div>
      <span class="badge ${st[0]}">${esc(st[1])}</span></div>`;
  }
  function viewTasks() {
    const all = C.todoList(state);
    const now = all.filter((x) => ['overdue', 'today'].includes(x.status));
    const soon = all.filter((x) => x.status === 'soon');
    const done = all.filter((x) => x.status === 'done');
    const later = all.filter((x) => x.status === 'later');
    const low = C.lowStock(state);
    const under = C.analyzeMenu(state).filter((a) => a.status === 'low');
    const sec = (title, l) => (l.length ? `<h3 class="group">${title}</h3><div class="card">${l.map(taskRow).join('')}</div>` : '');
    return `<div class="section-title"><h2>✅ À faire</h2><button class="btn sm primary" data-action="addTask">＋ Tâche</button></div>
      ${low.length || under.length ? `<div class="card">
        ${low.length ? `<div class="item" data-action="order"><div class="item-main"><div class="item-title">🛒 Commander : ${low.length} produit${low.length > 1 ? 's' : ''}</div><div class="item-meta">${esc(low.map((p) => p.name).join(', '))}</div></div></div>` : ''}
        ${under.length ? `<div class="item" data-action="goto" data-v="menu"><div class="item-main"><div class="item-title">💶 Corriger ${under.length} prix sous ×${C.minCoef(state)}</div></div></div>` : ''}</div>` : ''}
      ${sec('Maintenant', now)}${sec('Bientôt', soon)}${sec('Fait', done)}${sec('Plus tard', later)}
      ${!all.length ? '<p class="empty">Aucune tâche.</p>' : ''}`;
  }
  function openTaskForm(id) {
    const t = id ? state.tasks.find((x) => x.id === id) : { title: '', freq: 'weekly', cat: 'autre', note: '', enabled: true };
    if (!t) return;
    modal(`<h2>${id ? '✏️ Tâche' : '＋ Nouvelle tâche'}</h2>
      <label>Intitulé</label><input name="title" required value="${esc(t.title)}">
      <div class="grid2"><div><label>Fréquence</label><select name="freq">${Object.entries(TASK_FREQ).map(([k, l]) => `<option value="${k}" ${t.freq === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div><label>Catégorie</label><select name="cat">${Object.entries(TASK_CAT).map(([k, l]) => `<option value="${k}" ${t.cat === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
      <div class="grid2">
        <div class="f-weekly"><label>Jour de la semaine</label><select name="weekday"><option value="">Peu importe</option>${DAYS.map((d, i) => `<option value="${i}" ${String(t.weekday) === String(i) ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
        <div class="f-weekly"><label>Toutes les … semaines</label><input name="every" type="number" min="1" value="${esc(t.every || 1)}"></div>
        <div class="f-monthly"><label>Jour du mois</label><input name="day" type="number" min="1" max="28" value="${esc(t.day || '')}"></div>
        <div class="f-once"><label>Pour le</label><input name="due" type="date" value="${esc(t.due || todayISO())}"></div>
      </div>
      <label>Dernière fois faite</label><input name="lastDone" type="date" value="${esc(t.lastDone || '')}">
      <label>Note</label><textarea name="note">${esc(t.note || '')}</textarea>
      <label class="inline"><input type="checkbox" name="enabled" ${t.enabled !== false ? 'checked' : ''}> Active</label>`,
    (fd) => {
      const data = { title: fd.get('title').trim(), freq: fd.get('freq'), cat: fd.get('cat'), weekday: fd.get('weekday') === '' ? null : Number(fd.get('weekday')),
        every: Number(fd.get('every')) || 1, day: num(fd.get('day')), due: fd.get('due'), lastDone: fd.get('lastDone') || null, note: fd.get('note'), enabled: !!fd.get('enabled') };
      if (id) Object.assign(t, data); else state.tasks.push(Object.assign({ id: 't-' + C.uid() }, data));
      save();
    }, {
      onDelete: id ? () => { state.tasks = state.tasks.filter((x) => x.id !== id); save(); } : null,
      onOpen: (form) => {
        const upd = () => { const f = form.freq.value; $$('.f-weekly', form).forEach((e) => e.hidden = f !== 'weekly'); $$('.f-monthly', form).forEach((e) => e.hidden = f !== 'monthly'); $$('.f-once', form).forEach((e) => e.hidden = f !== 'once'); };
        form.freq.addEventListener('change', upd); upd();
      },
    });
  }

  // ================= Réglages =================
  function viewSettings() {
    const s = state.settings;
    return `<h2>⚙️ Réglages</h2>
      <form id="settings-form" class="card">
        <label>Nom du bar</label><input name="barName" value="${esc(s.barName)}">
        <h3 style="margin-top:14px">💶 Règle de prix</h3>
        <div class="grid2"><div><label>Coef minimum (prix TTC ÷ coût)</label><input name="minCoef" inputmode="decimal" value="${esc(String(s.minCoef).replace('.', ','))}"></div>
          <div><label>Arrondi des prix</label><select name="rounding">${[[0.05, '0,05 €'], [0.1, '0,10 €'], [0.5, '0,50 €'], [1, '1 €']].map(([v, l]) => `<option value="${v}" ${Number(s.rounding) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
        <label>Charge du bar par verre servi (€)</label><input name="overhead" inputmode="decimal" value="${esc(String(s.overhead ?? 0).replace('.', ','))}">
        <details class="small"><summary>Calculer ma charge par verre</summary>
          <p class="muted">Les charges fixes saisies dans 💰 Compta sont proposées par défaut. Additionne ce que tu veux répartir sur chaque verre (gobelets/pailles, glace, CO₂, produits de lavage, énergie du froid, casse de verres… et, si tu le souhaites, une part du loyer et des salaires), puis divise par le nombre de verres servis par mois.</p>
          <div class="grid2"><div><label>Charges mensuelles (€)</label><input id="oh-charges" inputmode="decimal" placeholder="${esc(Math.round(C.fixedChargesPerMonth(state)) || '')}"></div><div><label>Verres servis / mois</label><input id="oh-glasses" inputmode="numeric" placeholder="${esc(estGlassesPerMonth() || '')}"></div></div>
          <p id="oh-res"></p></details>
        <h3 style="margin-top:14px">Coef visé par catégorie <span class="small muted">(jamais sous le minimum)</span></h3>
        <div class="grid3">${Object.entries(CAT).map(([k, c]) => `<div><label>${c.icon} ${c.label}</label><input name="coef_${k}" inputmode="decimal" value="${esc(String(s.coefs[k] ?? s.minCoef).replace('.', ','))}"></div>`).join('')}</div>
        <h3 style="margin-top:14px">Journée & stock</h3>
        <div class="grid2"><div><label>Heure de bascule de journée</label><select name="dayStartHour">${[0, 2, 3, 4, 5, 6, 7, 8].map((h) => `<option value="${h}" ${Number(s.dayStartHour) === h ? 'selected' : ''}>${h} h</option>`).join('')}</select></div>
          <div><label>Stock « dormant » après (jours)</label><input name="deadStockDays" type="number" value="${esc(s.deadStockDays)}"></div></div>
        <p class="small muted">Une vente avant l'heure de bascule compte pour la veille (service qui finit après minuit).</p>
        <div class="btns"><button class="btn primary" type="submit">Enregistrer</button></div>
      </form>
      <h2>Carte de départ</h2><div class="card"><p class="small muted">Doses bar standard (pastis 2 cl, Martini 6 cl, alcools 4 cl, demi/pinte, verre de vin 12 cl, softs) avec des prix d'achat indicatifs.</p>
        <div class="btns"><button class="btn" data-action="loadStarter">🍺 (Re)charger la carte de départ</button></div></div>
      <h2>Sauvegarde</h2><div class="card">
        <p class="small muted">Tes données restent sur cet appareil. Exporte une sauvegarde régulièrement (mail, cloud) pour ne rien perdre ou changer de téléphone.</p>
        <div class="btns"><button class="btn primary" data-action="exportJSON">💾 Exporter</button><button class="btn" data-action="importJSON">📥 Importer</button></div>
        ${importInput()}
        ${s.lastBackup ? `<p class="small muted">Dernière sauvegarde : ${esc(fdate(s.lastBackup))}</p>` : ''}</div>
      <div class="btns"><button class="btn danger" data-action="wipe">🗑️ Tout effacer</button></div>
      <h2>Version</h2><div class="card"><p class="small">Carnet de Bar <b>v${APP_VERSION}</b></p>
        <div class="btns"><button class="btn" data-action="forceUpdate">🔄 Forcer la mise à jour</button> <a class="btn" href="../">🚗 Carnet Auto</a></div></div>`;
  }
  function estGlassesPerMonth() {
    const from = C.toISO(C.addDays(C.parseDate(day()), -29));
    const n = C.summarize(C.salesBetween(state, from, day())).count;
    return n ? Math.round(n) : '';
  }
  function bindSettings() {
    const ohC = $('#oh-charges'), ohG = $('#oh-glasses');
    const upd = () => {
      const c = num(ohC.value) || num(ohC.placeholder), g = num(ohG.value) || num(ohG.placeholder);
      $('#oh-res').innerHTML = c && g ? `= <b>${eur(c / g)}</b> par verre <button type="button" class="btn sm" id="oh-apply">Utiliser</button>` : '';
      const b = $('#oh-apply'); if (b) b.onclick = () => { $('#settings-form').overhead.value = String(Math.round((c / g) * 100) / 100).replace('.', ','); };
    };
    ohC.addEventListener('input', upd); ohG.addEventListener('input', upd); upd();
  }
  document.addEventListener('submit', (e) => {
    if (e.target.id !== 'settings-form') return;
    e.preventDefault();
    const fd = new FormData(e.target);
    const s = state.settings;
    s.barName = fd.get('barName').trim();
    s.minCoef = Math.max(1, num(fd.get('minCoef')) || 3);
    s.rounding = Number(fd.get('rounding')) || 0.1;
    s.overhead = Math.max(0, num(fd.get('overhead')) || 0);
    for (const k of Object.keys(CAT)) s.coefs[k] = num(fd.get('coef_' + k)) || s.minCoef;
    s.dayStartHour = Number(fd.get('dayStartHour'));
    s.deadStockDays = Number(fd.get('deadStockDays')) || 30;
    save(); render(); toast('Réglages enregistrés');
  });
  document.addEventListener('change', (e) => { if (e.target.id === 'import-file') importJSON(e.target.files[0]); });
  const importInput = () => '<input type="file" id="import-file" accept="application/json,.json" hidden>';

  // ================= Modale =================
  function modal(html, onSave, opts = {}) {
    const dlg = $('#modal');
    // formulaire neuf à chaque ouverture : aucun écouteur de la fenêtre précédente ne traîne
    const old = $('#modal-form'); const form = old.cloneNode(false); old.replaceWith(form);
    form.innerHTML = html + `<div class="modal-actions">
      ${opts.onDelete ? '<button class="btn danger" value="delete" style="margin-right:auto">Supprimer</button>' : ''}
      <button class="btn" value="cancel" formnovalidate>${onSave ? 'Annuler' : 'Fermer'}</button>
      ${onSave ? `<button class="btn primary" value="save">${opts.saveLabel || 'Enregistrer'}</button>` : ''}</div>`;
    form.onsubmit = async (e) => {
      const v = e.submitter && e.submitter.value;
      if (v === 'delete') { e.preventDefault(); if (confirm('Supprimer définitivement ?')) { await opts.onDelete(); dlg.close(); render(); } return; }
      if (v !== 'save' || !onSave) return;
      e.preventDefault();
      try { const r = await onSave(new FormData(form), form); if (r !== false) { dlg.close(); render(); } }
      catch (err) { console.error(err); toast('Erreur : ' + err.message); }
    };
    if (opts.onOpen) opts.onOpen(form);
    if (!dlg.open) dlg.showModal();
    form.scrollTop = 0;
  }

  // ================= Export / import =================
  function download(name, content, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }
  function exportJSON() {
    state.settings.lastBackup = todayISO(); save();
    download(`carnet-bar-${todayISO()}.json`, JSON.stringify({ app: 'carnet-bar', exportedAt: new Date().toISOString(), state }), 'application/json');
    toast('Sauvegarde exportée ✔');
  }
  async function importJSON(file) {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== 'carnet-bar' || !data.state) throw new Error('fichier non reconnu');
      if (!confirm('Remplacer les données actuelles par cette sauvegarde ?')) return;
      state = Object.assign(C.defaultState(), data.state);
      state.settings = Object.assign(C.defaultSettings(), state.settings);
      save(); tab = 'dashboard'; render(); toast('Données chargées ✔');
    } catch (e) { toast('Import impossible : ' + e.message); }
  }

  // ================= Service worker =================
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .then((reg) => { reg.update().catch(() => {}); document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); }); })
      .catch(() => {});
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
  }
  async function forceUpdate() {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) await reg.unregister();
      for (const k of await caches.keys()) if (k.startsWith('carnet-bar')) await caches.delete(k);
    } catch (e) { /* ignore */ }
    location.reload();
  }

  render();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('#modal').open) render(); });
  // Rafraîchit l'accueil chaque minute (changement de journée, tâches)
  setInterval(() => { if (!$('#modal').open && tab === 'dashboard') render(); }, 60000);
})();
