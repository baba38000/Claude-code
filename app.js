/* Carnet Auto — interface */
(function () {
  'use strict';
  const C = window.Core;
  const LS_KEY = 'carnet-auto-v1';
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  // ================= Stockage =================
  let state = load();
  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return Object.assign(C.defaultState(), JSON.parse(raw));
    } catch (e) { console.warn(e); }
    return C.defaultState();
  }
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
    catch (e) { toast('⚠️ Impossible d\'enregistrer : ' + e.message); }
    publishSummaryForSW();
  }

  // Fichiers (factures, photos) → IndexedDB (trop gros pour localStorage)
  const idb = (() => {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      const r = indexedDB.open('carnet-auto', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('files', { keyPath: 'id' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
    const tx = async (mode, fn) => {
      const db = await open();
      return new Promise((res, rej) => {
        const t = db.transaction('files', mode);
        const req = fn(t.objectStore('files'));
        t.oncomplete = () => res(req && req.result);
        t.onerror = () => rej(t.error);
      });
    };
    return {
      put: (f) => tx('readwrite', (s) => s.put(f)),
      get: (id) => tx('readonly', (s) => s.get(id)),
      del: (id) => tx('readwrite', (s) => s.delete(id)),
      all: () => tx('readonly', (s) => s.getAll()),
      clear: () => tx('readwrite', (s) => s.clear()),
    };
  })();

  async function storeFiles(fileList) {
    const meta = [];
    for (const f of Array.from(fileList || [])) {
      if (!f || !f.size) continue;
      const id = 'f-' + C.uid();
      await idb.put({ id, name: f.name, type: f.type, size: f.size, blob: f });
      meta.push({ id, name: f.name, type: f.type, size: f.size });
    }
    return meta;
  }

  // ================= Utilitaires =================
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = new Intl.NumberFormat('fr-FR');
  const km = (n) => (n == null || isNaN(n) ? '—' : nf.format(Math.round(n)) + ' km');
  const eur = (n) => (n == null || n === '' || isNaN(n) ? '—' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n));
  const fdate = (s) => { const d = typeof s === 'string' ? C.parseDate(s) : s; return d ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; };
  const fmonth = (d) => d ? d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '—';
  const todayISO = () => C.toISO(C.today());
  const num = (v) => (v === '' || v == null ? null : Number(String(v).replace(/\s/g, '').replace(',', '.')));
  const carName = () => { const v = state.vehicle || {}; return v.name || [v.brand, v.model].filter(Boolean).join(' ') || 'Ma voiture'; };

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
  }

  const STATUS_LABEL = { overdue: 'En retard', soon: 'Bientôt', ok: 'OK', unknown: 'À renseigner' };
  const DIFF_LABEL = { facile: '🟢 Facile', moyen: '🟠 Moyen', pro: '🔴 Garage conseillé' };
  const ORIGIN_LABEL = { avant: '📜 Avant achat', moi: '🧰 Fait moi-même', garage: '🏪 Garage' };
  const DOC_CATS = { piece: '🔩 Pièces', garage: '🏪 Garage / réparation', ct: '✅ Contrôle technique', achat: '🚗 Achat / carte grise', assurance: '🛡️ Assurance', autre: '📎 Autre' };
  const CHECK_LABEL = { ok: 'OK', watch: 'À surveiller', bad: 'Problème' };

  function statusLine(s) {
    const parts = [];
    if (s.status === 'unknown') return 'Dernière réalisation inconnue — à faire ou à renseigner dans le journal';
    if (s.dueKm != null) parts.push(s.kmLeft < 0 ? `dépassé de ${km(-s.kmLeft)}` : `dans ${km(s.kmLeft)} (à ${km(s.dueKm)})`);
    if (s.dueDate) parts.push(s.daysLeft < 0 ? `échu depuis le ${fdate(s.dueDate)}` : `avant le ${fdate(s.dueDate)}`);
    return parts.join(' · ');
  }
  function progress(s) {
    const it = s.item; let ratio = null;
    if (s.status === 'unknown') return '';
    if (s.dueKm != null && it.intervalKm) ratio = 1 - s.kmLeft / it.intervalKm;
    if (s.dueDate && it.intervalMonths) {
      const r = 1 - s.daysLeft / (it.intervalMonths * 30.44);
      ratio = ratio == null ? r : Math.max(ratio, r);
    }
    if (ratio == null) return '';
    const pct = Math.max(2, Math.min(100, ratio * 100));
    return `<div class="progress ${s.status}"><i style="width:${pct}%"></i></div>`;
  }
  function itemRow(s) {
    const it = s.item;
    return `<div class="item" data-item="${esc(it.id)}">
      <div class="item-main">
        <div class="item-title">${it.kind === 'check' ? '🔍' : '🔧'} ${esc(it.name)}</div>
        <div class="item-meta">${esc(statusLine(s))}</div>
        ${progress(s)}
      </div>
      <span class="badge b-${s.status}">${STATUS_LABEL[s.status]}</span>
    </div>`;
  }

  // ================= Navigation =================
  let tab = 'dashboard';
  const views = { tech: viewTech, dashboard: viewDashboard, plan: viewPlan, logs: viewLogs, readings: viewReadings, docs: viewDocs, settings: viewSettings };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (b) { tab = b.dataset.tab; render(); window.scrollTo(0, 0); }
  });

  function render() {
    $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab || (tab === 'tech' && b.dataset.tab === 'plan')));
    $('#car-name').textContent = state.vehicle ? carName() + (state.vehicle.plate ? ' · ' + state.vehicle.plate : '') : 'Aucun véhicule';
    $('#km-pill').textContent = '≈ ' + km(C.estimatedKm(state));
    const view = $('#view');
    view.innerHTML = views[tab]();
    bindCommon(view);
  }

  function bindCommon(root) {
    $$('[data-item]', root).forEach((el) => el.addEventListener('click', () => openItem(el.dataset.item)));
    $$('[data-log]', root).forEach((el) => el.addEventListener('click', () => openLogForm(el.dataset.log)));
    $$('[data-reading]', root).forEach((el) => el.addEventListener('click', () => openReadingForm(el.dataset.reading)));
    $$('[data-doc]', root).forEach((el) => el.addEventListener('click', () => openDocForm(el.dataset.doc)));
    $$('[data-action]', root).forEach((el) => el.addEventListener('click', (e) => { e.stopPropagation(); actions[el.dataset.action](el); }));
    $$('img[data-thumb]', root).forEach(async (img) => {
      const f = await idb.get(img.dataset.thumb).catch(() => null);
      if (f && f.blob) img.src = URL.createObjectURL(f.blob);
    });
  }

  const actions = {
    setup: () => openVehicleForm(),
    quickKm: () => openReadingForm(null, false),
    fullCheck: () => openReadingForm(null, true),
    addLog: () => openLogForm(),
    addPastLog: () => openLogForm(null, { origin: 'avant' }),
    addDoc: () => openDocForm(),
    addItem: () => openItemForm(),
    exportICS: exportICS,
    exportJSON: exportJSON,
    importJSON: () => $('#import-file').click(),
    loadStarter: async () => {
      try {
        const res = await fetch('demarrage-vel-satis.json', { cache: 'no-store' });
        await importData(await res.json(), false);
        openVehicleForm();
      } catch (e) { toast('Chargement impossible : ' + e.message); }
    },
    notif: enableNotifications,
    resetPlan: () => {
      if (!confirm('Régénérer le plan par défaut ? Tes éléments personnalisés sont conservés, les intervalles modifiés des éléments standards sont réinitialisés.')) return;
      state.plan = mergePlan(C.defaultPlan(state.vehicle), state.plan, false); save(); render(); toast('Plan régénéré');
    },
    wipe: async () => {
      if (!confirm('Supprimer TOUTES les données (véhicule, journal, relevés, factures) ? Pense à exporter une sauvegarde avant.')) return;
      state = C.defaultState(); await idb.clear().catch(() => {}); save(); tab = 'dashboard'; render();
    },
    planFilter: (el) => { planFilter = el.dataset.v; render(); },
    logFilter: (el) => { logFilter = el.dataset.v; render(); },
    docFilter: (el) => { docFilter = el.dataset.v; render(); },
    openFile: (el) => openFile(el.dataset.id),
    addTech: (el) => openTechForm(null, el.dataset.sec),
    editTech: (el) => openTechForm(el.dataset.id),
    loadPreset: () => {
      const p = matchingPreset();
      if (!p) return;
      if (state.tech && state.tech.length && !confirm('Remplacer la doc technique actuelle par la fiche « ' + p.label + ' » ? (tes lignes ajoutées à la main sont conservées)')) return;
      C.applyPreset(state, p);
      save(); render(); toast('Fiche constructeur chargée ✔ (doc + plan ajusté)');
    },
  };

  // ================= Vues =================
  function viewDashboard() {
    if (!state.vehicle) {
      return `<div class="card">
        <h2>Bienvenue 👋</h2>
        <p>Renseigne ta voiture : l'appli génère un plan d'entretien adapté (moteur, boîte, distribution) avec, pour chaque opération, les pièces à prévoir, la difficulté en DIY et des conseils.</p>
        <p class="muted small">Ensuite : saisis l'historique d'entretien d'avant ton achat (factures, carnet), fais un relevé de km chaque semaine ou chaque mois, et l'appli te dit quoi vérifier et quoi changer, et quand.</p>
        <div class="btns"><button class="btn primary" data-action="setup">🚗 Configurer ma voiture</button>
        <button class="btn" data-action="importJSON">📥 Restaurer une sauvegarde</button></div>
        <div class="card" style="margin-top:14px"><h3>🚘 Renault Vel Satis 2.0 dCi 175</h3>
          <p class="small muted">Démarrage préparé : fiche véhicule, plan d'entretien « recommandé » ajusté au M9R à FAP, doc technique (huile, filtres, freins, couples, pneus, batterie…), dernière vidange connue et défauts signalés à l'achat. Il te restera à vérifier la date d'achat, le km et la date de 1re immatriculation.</p>
          <div class="btns"><button class="btn primary" data-action="loadStarter">Charger la Vel Satis</button></div></div>
        ${importInput()}
      </div>`;
    }
    const sts = C.allStatuses(state);
    const rd = C.monthlyCheckDue(state);
    const fc = C.fullCheckDue(state);
    const kpm = C.kmPerDay(state) * 30.44;
    const pDate = state.vehicle.purchaseDate || '0000';
    const spent = state.logs.filter((l) => l.origin !== 'avant' && l.date >= pDate).reduce((a, l) => a + (Number(l.cost) || 0), 0);
    const replace = sts.filter((s) => s.item.kind !== 'check' && (s.status === 'overdue' || s.status === 'soon'));
    const check = sts.filter((s) => s.item.kind === 'check' && (s.status === 'overdue' || s.status === 'soon'));
    const unknown = sts.filter((s) => s.status === 'unknown');
    const upcoming = sts.filter((s) => s.status === 'ok').slice(0, 6);
    const last = C.lastReading(state);
    const problems = last && last.checks ? Object.entries(last.checks).filter(([, v]) => v !== 'ok') : [];
    const label = (k) => (C.MONTHLY_CHECKS.find((c) => c.key === k) || {}).label || k;
    const weekly = rd.period === 7;

    let html = '';
    if (rd.due) {
      html += `<div class="card alert"><h3>📅 Relevé km ${weekly ? 'de la semaine' : 'du mois'}</h3>
        <p>${rd.daysSince == null ? 'Aucun relevé pour l\'instant.' : `Dernier relevé il y a ${rd.daysSince} jours.`} Note ton kilométrage pour garder les échéances à jour.</p>
        <div class="btns"><button class="btn primary" data-action="quickKm">Noter le km</button>
        ${fc.due ? '<button class="btn" data-action="fullCheck">Relevé + check-up complet</button>' : ''}</div></div>`;
    } else if (fc.due) {
      html += `<div class="card alert"><h3>🔍 Check-up mensuel</h3><p>${fc.daysSince == null ? 'Pas encore de check-up complet.' : `Dernier check-up il y a ${fc.daysSince} jours.`} 10 minutes : pneus, niveaux, éclairage, voyants…</p>
        <div class="btns"><button class="btn primary" data-action="fullCheck">Faire le check-up</button></div></div>`;
    }

    html += `<div class="stats">
      <div class="stat"><b>${km(C.estimatedKm(state))}</b><span>estimés aujourd'hui</span></div>
      <div class="stat"><b>${nf.format(Math.round(kpm))}</b><span>km / mois</span></div>
      <div class="stat"><b>${eur(spent)}</b><span>dépensés depuis l'achat</span></div>
    </div>`;

    html += `<div class="btns"><button class="btn sm" data-action="quickKm">＋ Km</button><button class="btn sm" data-action="fullCheck">＋ Check-up</button>
      <button class="btn sm" data-action="addLog">＋ Intervention</button><button class="btn sm" data-action="addDoc">＋ Facture</button></div>`;

    if (problems.length) {
      html += `<div class="card danger"><h3>⚠️ Points relevés au dernier check-up (${fdate(last.date)})</h3>
        ${problems.map(([k, v]) => `<p>• ${esc(label(k))} : <b>${CHECK_LABEL[v]}</b></p>`).join('')}
        ${last.notes ? `<p class="muted small">${esc(last.notes)}</p>` : ''}</div>`;
    }

    html += `<h2>🔧 Pièces à changer</h2><div class="card">${replace.length ? replace.map(itemRow).join('') : '<p class="muted">Rien à changer dans l\'immédiat 👍</p>'}</div>`;
    html += `<h2>🔍 Points à vérifier</h2><div class="card">${check.length ? check.map(itemRow).join('') : '<p class="muted">Rien à vérifier dans l\'immédiat 👍</p>'}</div>`;
    if (unknown.length) {
      html += `<h2>❓ Historique à renseigner (${unknown.length})</h2><div class="card">
        <p class="small muted">On ne sait pas quand ces opérations ont été faites. Si tu as les factures / le carnet de l'ancien propriétaire, ajoute-les en « Avant achat ». Sinon, considère-les comme à faire (surtout vidange, filtres, liquide de frein, distribution).</p>
        <div class="btns"><button class="btn sm primary" data-action="addPastLog">📜 Saisir un entretien passé</button></div>
        ${unknown.map(itemRow).join('')}</div>`;
    }
    if (upcoming.length) html += `<h2>🗓️ Prochaines échéances</h2><div class="card">${upcoming.map((s) => itemRow(s).replace('</div>\n      <span', `<div class="item-meta">≈ ${esc(fmonth(s.estDate))}</div></div>\n      <span`)).join('')}</div>`;
    return html;
  }

  // ---------- Doc technique ----------
  const TECH_SECTIONS = {
    id: '🪪 Identification', fluids: '🛢️ Liquides & capacités', parts: '🔩 Références pièces',
    torques: '🔧 Couples de serrage', tires: '🛞 Pneus & roues', elec: '💡 Ampoules / fusibles / batterie', misc: '📝 Divers',
  };
  function matchingPreset() {
    const list = window.TECH_PRESETS || [];
    const v = state.vehicle || {};
    const hay = [v.brand, v.model, v.engine, v.engineCode].join(' ').toLowerCase();
    return list.find((p) => (p.match || []).every((m) => hay.includes(m.toLowerCase()))) || null;
  }
  let techQuery = '';
  function viewTech() {
    if (!state.vehicle) return needVehicle();
    const rows = state.tech || [];
    const preset = matchingPreset();
    const q = techQuery.toLowerCase();
    const filtered = q ? rows.filter((r) => [r.label, r.value, r.ref, r.alt, r.notes].join(' ').toLowerCase().includes(q)) : rows;
    let html = `<div class="section-title"><h2>📘 Doc technique</h2><button class="btn sm" data-tab="plan">← Entretien</button></div>
      <p class="small muted">${esc(carName())}${state.vehicle.engine ? ' · ' + esc(state.vehicle.engine) : ''}. Références d'origine (OE) et équivalences : vérifie toujours avec ton immatriculation / VIN au moment de commander.</p>
      ${preset ? `<div class="btns"><button class="btn primary" data-action="loadPreset">📥 Charger la fiche « ${esc(preset.label)} »</button></div>` : ''}
      <input id="tech-q" type="search" placeholder="Rechercher (huile, plaquettes, couple roue…)" value="${esc(techQuery)}" style="margin-top:10px">`;
    for (const [k, label] of Object.entries(TECH_SECTIONS)) {
      const rs = filtered.filter((r) => (r.section || 'misc') === k);
      if (q && !rs.length) continue;
      html += `<div class="section-title"><h2>${label}</h2><button class="btn sm" data-action="addTech" data-sec="${k}">＋</button></div><div class="card">
        ${rs.map((r) => `<div class="item" data-action="editTech" data-id="${esc(r.id)}"><div class="item-main">
          <div class="item-title">${esc(r.label)}</div>
          ${r.value ? `<div>${esc(r.value)}</div>` : ''}
          ${r.ref ? `<div class="item-meta">Réf. OE : <b>${esc(r.ref)}</b></div>` : ''}
          ${r.alt ? `<div class="item-meta">Équivalences : ${esc(r.alt)}</div>` : ''}
          ${r.notes ? `<div class="item-meta">${esc(r.notes)}</div>` : ''}
          ${r.verify ? '<span class="tag">à vérifier</span>' : ''}
        </div></div>`).join('') || '<p class="muted small">Rien pour l’instant.</p>'}</div>`;
    }
    return html;
  }
  document.addEventListener('input', (e) => {
    if (e.target.id !== 'tech-q') return;
    techQuery = e.target.value; const pos = e.target.selectionStart; render();
    const i = $('#tech-q'); i.focus(); i.setSelectionRange(pos, pos);
  });
  function openTechForm(id, section) {
    const r = id ? (state.tech || []).find((x) => x.id === id) : { section: section || 'misc', custom: true };
    modal(`<h2>${id ? 'Modifier' : 'Ajouter'} — doc technique</h2>
      <label>Rubrique</label><select name="section">${Object.entries(TECH_SECTIONS).map(([k, l]) => `<option value="${k}" ${r.section === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <label>Élément</label><input name="label" required value="${esc(r.label || '')}" placeholder="ex : Huile moteur">
      <label>Valeur / spécification</label><input name="value" value="${esc(r.value || '')}" placeholder="ex : 5W30 ACEA C2 — 4,25 L avec filtre">
      <label>Référence d'origine (OE)</label><input name="ref" value="${esc(r.ref || '')}">
      <label>Équivalences (marques / réfs)</label><input name="alt" value="${esc(r.alt || '')}">
      <label>Notes</label><textarea name="notes">${esc(r.notes || '')}</textarea>
      <div class="check-list"><label><input type="checkbox" name="verify" ${r.verify ? 'checked' : ''}> À vérifier</label></div>`,
    (fd) => {
      const o = Object.fromEntries(fd.entries()); o.verify = fd.has('verify');
      state.tech = state.tech || [];
      if (id) Object.assign(r, o); else state.tech.push(Object.assign({ id: 't-' + C.uid(), custom: true }, o));
      save();
    }, id ? { onDelete: () => { state.tech = state.tech.filter((x) => x.id !== id); save(); } } : {});
  }

  let planFilter = 'all';
  function viewPlan() {
    if (!state.vehicle) return needVehicle();
    let sts = (state.plan || []).map((i) => C.itemStatus(state, i));
    const order = { overdue: 0, unknown: 1, soon: 2, ok: 3 };
    sts.sort((a, b) => (a.item.enabled === false) - (b.item.enabled === false) || order[a.status] - order[b.status] || a.item.name.localeCompare(b.item.name));
    if (planFilter === 'replace') sts = sts.filter((s) => s.item.kind !== 'check');
    if (planFilter === 'check') sts = sts.filter((s) => s.item.kind === 'check');
    const f = (v, l) => `<button class="btn sm ${planFilter === v ? 'on' : ''}" data-action="planFilter" data-v="${v}">${l}</button>`;
    return `<div class="section-title"><h2>Plan d'entretien</h2><button class="btn sm primary" data-action="addItem">＋ Ajouter</button></div>
      <p class="small muted">Intervalles génériques à ajuster selon le carnet d'entretien constructeur (touche un élément pour le modifier). « Le premier atteint » : km ou durée.</p>
      <div class="btns"><button class="btn" data-tab="tech">📘 Doc technique (réfs, liquides, couples)</button></div>
      <div class="filters">${f('all', 'Tout')}${f('replace', '🔧 À changer')}${f('check', '🔍 À vérifier')}</div>
      <div class="card">${sts.map((s) => s.item.enabled === false ? itemRow(s).replace('class="item"', 'class="item" style="opacity:.45"').replace(/<span class="badge[^<]*<\/span>/, '<span class="badge">Désactivé</span>') : itemRow(s)).join('') || '<p class="empty">Aucun élément</p>'}</div>`;
  }

  let logFilter = 'all';
  function viewLogs() {
    if (!state.vehicle) return needVehicle();
    let logs = state.logs.slice().sort((a, b) => b.date.localeCompare(a.date) || (Number(b.km) || 0) - (Number(a.km) || 0));
    if (logFilter !== 'all') logs = logs.filter((l) => l.origin === logFilter);
    const total = logs.reduce((a, l) => a + (Number(l.cost) || 0), 0);
    const f = (v, l) => `<button class="btn sm ${logFilter === v ? 'on' : ''}" data-action="logFilter" data-v="${v}">${l}</button>`;
    return `<div class="section-title"><h2>Journal d'entretien</h2><button class="btn sm primary" data-action="addLog">＋ Ajouter</button></div>
      <div class="filters">${f('all', 'Tout')}${f('avant', ORIGIN_LABEL.avant)}${f('moi', ORIGIN_LABEL.moi)}${f('garage', ORIGIN_LABEL.garage)}</div>
      <p class="small muted">${logs.length} intervention(s) · total ${eur(total)}</p>
      <div class="btns"><button class="btn sm" data-action="addPastLog">📜 Saisir un entretien d'avant l'achat</button></div>
      <div class="card">${logs.map(logRow).join('') || '<p class="empty">Aucune intervention. Commence par l\'historique de l\'ancien propriétaire (carnet, factures).</p>'}</div>`;
  }
  function logRow(l) {
    const names = (l.itemIds || []).map((id) => (state.plan.find((p) => p.id === id) || {}).name).filter(Boolean);
    const docs = state.docs.filter((d) => d.logId === l.id).length;
    return `<div class="item" data-log="${esc(l.id)}"><div class="item-main">
      <div class="item-title">${esc(l.title || names.join(', ') || 'Intervention')}</div>
      <div class="item-meta">${fdate(l.date)} · ${km(num(l.km))} · ${ORIGIN_LABEL[l.origin] || ''}${docs ? ` · 🧾 ${docs}` : ''}</div>
      ${names.length && l.title ? `<div class="item-meta">${esc(names.join(', '))}</div>` : ''}
    </div><b>${l.cost ? eur(l.cost) : ''}</b></div>`;
  }

  function viewReadings() {
    if (!state.vehicle) return needVehicle();
    const rs = state.readings.slice().sort((a, b) => b.date.localeCompare(a.date));
    const kpm = C.kmPerDay(state) * 30.44;
    const weekly = C.readingPeriod(state) === 7;
    return `<div class="section-title"><h2>Suivi kilométrique</h2></div>
      <div class="btns"><button class="btn primary" data-action="quickKm">＋ Relevé km</button><button class="btn" data-action="fullCheck">＋ Relevé + check-up</button></div>
      <p class="small muted">Rythme choisi : <b>${weekly ? 'hebdomadaire' : 'mensuel'}</b> (modifiable dans ⚙️ Réglages). Moyenne : <b>${nf.format(Math.round(kpm))} km/mois</b>, soit ${nf.format(Math.round(kpm * 12))} km/an.</p>
      <div class="card">${chart()}</div>
      <div class="card">${rs.map((r) => {
        const bad = r.checks ? Object.values(r.checks).filter((v) => v !== 'ok').length : 0;
        return `<div class="item" data-reading="${esc(r.id)}"><div class="item-main"><div class="item-title">${km(r.km)}</div>
          <div class="item-meta">${fdate(r.date)}${r.checks && Object.keys(r.checks).length ? ' · check-up complet' : ''}${r.notes ? ' · ' + esc(r.notes.slice(0, 60)) : ''}</div></div>
          ${r.checks && Object.keys(r.checks).length ? `<span class="badge ${bad ? 'b-soon' : 'b-ok'}">${bad ? bad + ' point(s)' : 'Tout OK'}</span>` : ''}</div>`;
      }).join('') || '<p class="empty">Aucun relevé.</p>'}</div>`;
  }
  function chart() {
    const pts = state.readings.map((r) => ({ t: C.parseDate(r.date).getTime(), km: Number(r.km) })).sort((a, b) => a.t - b.t);
    const v = state.vehicle;
    if (v.purchaseDate && v.purchaseKm) pts.unshift({ t: C.parseDate(v.purchaseDate).getTime(), km: Number(v.purchaseKm) });
    if (pts.length < 2) return '<p class="muted small">Le graphique apparaîtra après 2 relevés.</p>';
    const W = 600, H = 160, P = 30;
    const t0 = pts[0].t, t1 = pts[pts.length - 1].t || t0 + 1;
    const k0 = Math.min(...pts.map((p) => p.km)), k1 = Math.max(...pts.map((p) => p.km)) || k0 + 1;
    const x = (t) => P + ((t - t0) / Math.max(1, t1 - t0)) * (W - P - 10);
    const y = (k) => H - 20 - ((k - k0) / Math.max(1, k1 - k0)) * (H - 40);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + x(p.t).toFixed(1) + ',' + y(p.km).toFixed(1)).join(' ');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Évolution du kilométrage">
      <line class="axis" x1="${P}" y1="${H - 20}" x2="${W}" y2="${H - 20}"/>
      <path class="line" d="${d}"/>${pts.map((p) => `<circle class="dot" cx="${x(p.t)}" cy="${y(p.km)}" r="3"/>`).join('')}
      <text x="${P}" y="${H - 5}">${fdate(new Date(t0))}</text><text x="${W - 10}" y="${H - 5}" text-anchor="end">${fdate(new Date(t1))}</text>
      <text x="2" y="${y(k1) + 4}">${Math.round(k1 / 1000)}k</text><text x="2" y="${y(k0) + 4}">${Math.round(k0 / 1000)}k</text></svg>`;
  }

  let docFilter = 'all';
  function viewDocs() {
    let docs = state.docs.slice().sort((a, b) => b.date.localeCompare(a.date));
    if (docFilter !== 'all') docs = docs.filter((d) => d.category === docFilter);
    const total = docs.reduce((a, d) => a + (Number(d.amount) || 0), 0);
    const f = (v, l) => `<button class="btn sm ${docFilter === v ? 'on' : ''}" data-action="docFilter" data-v="${v}">${l}</button>`;
    return `<div class="section-title"><h2>Factures & documents</h2><button class="btn sm primary" data-action="addDoc">＋ Ajouter</button></div>
      <p class="small muted">Photos ou PDF de factures de pièces, de garage, CT, carte grise… Stockés sur cet appareil : pense à exporter une sauvegarde régulièrement (⚙️ Réglages).</p>
      <div class="filters">${f('all', 'Tout')}${Object.entries(DOC_CATS).map(([k, l]) => f(k, l)).join('')}</div>
      <p class="small muted">${docs.length} document(s) · total ${eur(total)}</p>
      <div class="card">${docs.map((d) => {
        const log = d.logId && state.logs.find((l) => l.id === d.logId);
        const first = (d.files || [])[0];
        const thumb = first && first.type && first.type.startsWith('image/') ? `<img class="thumb" data-thumb="${esc(first.id)}" alt="">` : `<div class="thumb">${first ? '📄' : '🧾'}</div>`;
        return `<div class="item" data-doc="${esc(d.id)}">${thumb}<div class="item-main">
          <div class="item-title">${esc(d.title || 'Document')}</div>
          <div class="item-meta">${fdate(d.date)} · ${DOC_CATS[d.category] || ''}${d.vendor ? ' · ' + esc(d.vendor) : ''}</div>
          ${log ? `<div class="item-meta">↳ ${esc(log.title || 'Intervention')} (${fdate(log.date)})</div>` : ''}
          <div class="item-meta">${(d.files || []).length} fichier(s)</div>
        </div><b>${d.amount ? eur(d.amount) : ''}</b></div>`;
      }).join('') || '<p class="empty">Aucun document.</p>'}</div>`;
  }

  function viewSettings() {
    const v = state.vehicle;
    const s = state.settings;
    const notif = 'Notification' in window ? Notification.permission : 'unsupported';
    const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    return `<h2>Véhicule</h2><div class="card">
      ${v ? `<p><b>${esc(carName())}</b> ${v.plate ? '· ' + esc(v.plate) : ''}</p>
        <p class="small muted">${esc([v.year, v.engine, v.fuel, v.gearbox === 'auto' ? 'boîte auto' : 'boîte manuelle', v.timing === 'courroie' ? 'distribution par courroie' : v.timing === 'chaine' ? 'distribution par chaîne' : ''].filter(Boolean).join(' · '))}</p>
        <p class="small muted">Achetée le ${fdate(v.purchaseDate)} à ${km(num(v.purchaseKm))}</p>` : '<p>Aucun véhicule.</p>'}
      <div class="btns"><button class="btn primary" data-action="setup">${v ? '✏️ Modifier la fiche véhicule' : '🚗 Configurer'}</button></div></div>

      <h2>Rappels</h2><div class="card">
        <form id="settings-form">
          <label>Fréquence du relevé kilométrique</label>
          <select name="readingFreq"><option value="weekly" ${s.readingFreq === 'weekly' ? 'selected' : ''}>Chaque semaine</option><option value="monthly" ${s.readingFreq !== 'weekly' ? 'selected' : ''}>Chaque mois</option></select>
          <div class="grid2">
            <div><label>Jour du check-up mensuel</label><input name="reminderDay" type="number" min="1" max="28" value="${esc(s.reminderDay || 1)}"></div>
            <div><label>Jour du relevé hebdo</label><select name="reminderWeekday">${days.map((d, i) => `<option value="${i}" ${Number(s.reminderWeekday || 0) === i ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
          </div>
          <label>Kilométrage mensuel (laisser vide = calcul auto)</label>
          <input name="kmPerMonthOverride" type="number" inputmode="numeric" placeholder="ex : 1200" value="${esc(s.kmPerMonthOverride || '')}">
          <div class="btns"><button class="btn" type="submit">Enregistrer</button></div>
        </form>
        <hr style="border:0;border-top:1px solid var(--border);margin:14px 0">
        <h3>📆 Ajouter les rappels à mon agenda (recommandé)</h3>
        <p class="small muted">Télécharge un fichier calendrier (.ics) à ouvrir sur ton téléphone : rappel ${s.readingFreq === 'weekly' ? 'hebdo du relevé km + ' : ''}mensuel du check-up, et un événement par entretien à venir (avec alerte 2 semaines avant). Réimporte-le de temps en temps, les dates s'ajustent selon tes km.</p>
        <div class="btns"><button class="btn primary" data-action="exportICS">📆 Télécharger les rappels (.ics)</button></div>
        <hr style="border:0;border-top:1px solid var(--border);margin:14px 0">
        <h3>🔔 Notifications</h3>
        <p class="small muted">${notif === 'granted' ? 'Activées : une notification s\'affiche quand un relevé ou un entretien est dû (à l\'ouverture de l\'appli, et en arrière-plan sur Android si l\'appli est installée).' : notif === 'denied' ? 'Bloquées dans le navigateur — autorise-les dans les réglages du site.' : notif === 'unsupported' ? 'Non supportées par ce navigateur (sur iPhone : installer l\'appli sur l\'écran d\'accueil d\'abord).' : 'Pas encore activées.'}</p>
        ${notif === 'default' ? '<div class="btns"><button class="btn" data-action="notif">🔔 Activer les notifications</button></div>' : ''}
      </div>

      <h2>Plan d'entretien</h2><div class="card">
        <p class="small muted">Régénère le plan selon la fiche véhicule (motorisation, boîte, distribution).</p>
        <div class="btns"><button class="btn" data-action="resetPlan">♻️ Régénérer le plan par défaut</button></div></div>

      <h2>Sauvegarde</h2><div class="card">
        <p class="small muted">Tes données restent sur cet appareil (rien n'est envoyé sur internet). Exporte régulièrement une sauvegarde (factures incluses) dans ton cloud / tes mails pour ne rien perdre et pouvoir changer de téléphone.</p>
        <div class="btns"><button class="btn primary" data-action="exportJSON">💾 Exporter la sauvegarde</button><button class="btn" data-action="importJSON">📥 Importer</button></div>
        ${importInput()}
        ${s.lastBackup ? `<p class="small muted">Dernière sauvegarde : ${fdate(s.lastBackup)}</p>` : ''}
      </div>
      <div class="btns"><button class="btn danger" data-action="wipe">🗑️ Tout effacer</button></div>
      <p class="small muted" style="margin-top:20px">Les intervalles proposés sont indicatifs. La référence reste le carnet d'entretien du constructeur. Pour les opérations de sécurité (freins, distribution), en cas de doute, passe par un pro.</p>`;
  }
  const importInput = () => '<input type="file" id="import-file" accept="application/json,.json" hidden>';
  const needVehicle = () => '<div class="card empty"><p>Configure d\'abord ta voiture.</p><button class="btn primary" data-action="setup">🚗 Configurer</button></div>';

  // Formulaires de la page réglages / import (délégation)
  document.addEventListener('submit', (e) => {
    if (e.target.id !== 'settings-form') return;
    e.preventDefault();
    const fd = new FormData(e.target);
    state.settings.readingFreq = fd.get('readingFreq');
    state.settings.reminderDay = Math.min(28, Math.max(1, Number(fd.get('reminderDay')) || 1));
    state.settings.reminderWeekday = Number(fd.get('reminderWeekday')) || 0;
    state.settings.kmPerMonthOverride = num(fd.get('kmPerMonthOverride')) || null;
    save(); render(); toast('Réglages enregistrés — pense à retélécharger le fichier agenda');
  });
  document.addEventListener('change', (e) => { if (e.target.id === 'import-file') importJSON(e.target.files[0]); });

  // ================= Modale =================
  function modal(html, onSave, opts = {}) {
    const dlg = $('#modal'); const form = $('#modal-form');
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
    bindCommon(form);
    dlg.showModal();
    form.scrollTop = 0;
  }

  // --- Véhicule ---
  function openVehicleForm() {
    const v = state.vehicle || {};
    const sel = (name, opts, cur) => `<select name="${name}">${Object.entries(opts).map(([k, l]) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    const inp = (name, label, type = 'text', extra = '') => `<div><label>${label}</label><input name="${name}" type="${type}" value="${esc(v[name] ?? '')}" ${extra}></div>`;
    modal(`<h2>🚗 Fiche véhicule</h2>
      <div class="grid2">${inp('brand', 'Marque', 'text', 'required placeholder="ex : Peugeot"')}${inp('model', 'Modèle', 'text', 'required placeholder="ex : 308 SW"')}</div>
      <div class="grid2">${inp('engine', 'Motorisation', 'text', 'placeholder="ex : 1.5 BlueHDi 130"')}${inp('year', 'Année', 'number')}</div>
      <div class="grid2"><div><label>Carburant</label>${sel('fuel', { essence: 'Essence', diesel: 'Diesel', hybride: 'Hybride', electrique: 'Électrique' }, v.fuel || 'essence')}</div>
        <div><label>Boîte</label>${sel('gearbox', { manuelle: 'Manuelle', auto: 'Automatique' }, v.gearbox || 'manuelle')}</div></div>
      <label>Distribution</label>${sel('timing', { courroie: 'Courroie (à remplacer périodiquement)', chaine: 'Chaîne', inconnu: 'Je ne sais pas' }, v.timing || 'inconnu')}
      <p class="small muted">Pas sûr ? Cherche « [ton moteur] courroie ou chaîne de distribution ». En cas de doute, choisis « courroie » par sécurité.</p>
      <div class="grid2">${inp('plate', 'Immatriculation')}${inp('firstReg', 'Date de 1re immatriculation', 'date')}</div>
      <div class="grid2">${inp('purchaseDate', 'Date d\'achat', 'date', 'required')}${inp('purchaseKm', 'Km à l\'achat', 'number', 'required inputmode="numeric"')}</div>
      <div class="grid2">${inp('purchasePrice', 'Prix d\'achat (€)', 'number', 'step="0.01"')}${inp('owners', 'Nb de propriétaires précédents', 'number')}</div>
      <details ${v.vin || v.oilSpec ? 'open' : ''}><summary>Infos techniques (utile pour commander les pièces)</summary>
        <div class="grid2">${inp('vin', 'N° VIN (case E carte grise)')}${inp('engineCode', 'Code moteur')}</div>
        <div class="grid2">${inp('oilSpec', 'Huile moteur (norme, capacité)', 'text', 'placeholder="ex : 5W30 PSA B71 2290 — 4,25 L"')}${inp('tireSize', 'Dimension pneus', 'text', 'placeholder="ex : 205/55 R16 91V"')}</div>
        <div class="grid2">${inp('tirePressure', 'Pression pneus AV/AR', 'text', 'placeholder="ex : 2,3 / 2,1 bar"')}${inp('battery', 'Batterie 12 V', 'text', 'placeholder="ex : 70 Ah 680 A"')}</div>
      </details>
      <label>Notes / infos connues (historique, défauts signalés, garanties, ce que t'a dit le vendeur…)</label>
      <textarea name="notes" rows="5">${esc(v.notes || '')}</textarea>`,
    (fd) => {
      const prev = state.vehicle;
      const nv = Object.fromEntries(fd.entries());
      nv.name = [nv.brand, nv.model].filter(Boolean).join(' ');
      state.vehicle = nv;
      if (!prev) {
        state.plan = C.defaultPlan(nv);
        toast('Plan d\'entretien généré ✔');
      } else if (prev.fuel !== nv.fuel || prev.timing !== nv.timing || prev.gearbox !== nv.gearbox) {
        if (confirm('Motorisation / boîte / distribution modifiée : mettre à jour le plan d\'entretien ? (tes réglages d\'intervalles sont conservés)')) {
          state.plan = mergePlan(C.defaultPlan(nv), state.plan, true);
        }
      }
      save();
    });
  }

  /** Fusionne un plan par défaut avec l'existant : garde les éléments perso, et (option) les intervalles modifiés. */
  function mergePlan(defaults, current, keepEdits) {
    const byId = Object.fromEntries((current || []).map((i) => [i.id, i]));
    const out = defaults.map((d) => (keepEdits && byId[d.id] ? Object.assign({}, d, pick(byId[d.id], ['intervalKm', 'intervalMonths', 'enabled', 'parts', 'tips', 'name'])) : d));
    for (const c of current || []) if (c.custom) out.push(c);
    return out;
  }
  const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));

  // --- Élément du plan ---
  function openItem(id) {
    const it = state.plan.find((p) => p.id === id); if (!it) return;
    const s = C.itemStatus(state, it);
    const hist = state.logs.filter((l) => (l.itemIds || []).includes(id)).sort((a, b) => b.date.localeCompare(a.date));
    modal(`<div class="row"><h2>${it.kind === 'check' ? '🔍' : '🔧'} ${esc(it.name)}</h2><span class="badge b-${s.status}">${STATUS_LABEL[s.status]}</span></div>
      <p class="muted small">${esc(it.category || '')} · ${DIFF_LABEL[it.difficulty] || ''} · ${it.kind === 'check' ? 'Contrôle' : 'Remplacement'}</p>
      <p><b>Intervalle :</b> ${[it.intervalKm ? km(it.intervalKm) : null, it.intervalMonths ? it.intervalMonths + ' mois' : null].filter(Boolean).join(' ou ') || '—'}${it.intervalKm && it.intervalMonths ? ' (le premier atteint)' : ''}</p>
      <p><b>Échéance :</b> ${esc(statusLine(s))}${s.estDate && s.status !== 'unknown' ? ` — estimée ${esc(fmonth(s.estDate))}` : ''}</p>
      ${s.assumed && !s.done ? '<p class="small muted">Calculé depuis la date d\'achat / 1re immatriculation (pas encore d\'intervention enregistrée).</p>' : ''}
      <h3 style="margin-top:14px">🧩 Pièces / matériel</h3><p class="tips">${esc(it.parts || '—')}</p>
      <h3 style="margin-top:14px">💡 Conseils</h3><p class="tips">${esc(it.tips || '—')}</p>
      <h3 style="margin-top:14px">📒 Historique</h3>
      ${hist.length ? hist.map((l) => `<p class="small">• ${fdate(l.date)} — ${km(num(l.km))} — ${ORIGIN_LABEL[l.origin] || ''}${l.cost ? ' — ' + eur(l.cost) : ''}</p>`).join('') : '<p class="small muted">Aucune réalisation enregistrée.</p>'}
      <div class="btns">
        <button type="button" class="btn primary" id="mark-done">✔ ${it.kind === 'check' ? 'Contrôlé' : 'Fait'} — enregistrer</button>
        <button type="button" class="btn" id="mark-past">📜 Fait avant l'achat</button>
        <button type="button" class="btn" id="edit-item">✏️ Modifier</button>
      </div>`, null, {
      onOpen: (form) => {
        $('#mark-done', form).onclick = () => openLogForm(null, { itemIds: [id], title: it.name, origin: it.difficulty === 'pro' ? 'garage' : 'moi' });
        $('#mark-past', form).onclick = () => openLogForm(null, { itemIds: [id], title: it.name, origin: 'avant' });
        $('#edit-item', form).onclick = () => openItemForm(id);
      },
    });
  }

  function openItemForm(id) {
    const it = id ? state.plan.find((p) => p.id === id) : { kind: 'replace', difficulty: 'facile', enabled: true, custom: true };
    modal(`<h2>${id ? 'Modifier' : 'Nouvel élément'}</h2>
      <label>Nom</label><input name="name" required value="${esc(it.name || '')}">
      <div class="grid2"><div><label>Type</label><select name="kind"><option value="replace" ${it.kind !== 'check' ? 'selected' : ''}>🔧 Pièce à changer</option><option value="check" ${it.kind === 'check' ? 'selected' : ''}>🔍 Point à vérifier</option></select></div>
        <div><label>Difficulté</label><select name="difficulty">${Object.entries(DIFF_LABEL).map(([k, l]) => `<option value="${k}" ${it.difficulty === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
      <div class="grid2"><div><label>Tous les … km</label><input name="intervalKm" type="number" inputmode="numeric" value="${esc(it.intervalKm ?? '')}"></div>
        <div><label>Tous les … mois</label><input name="intervalMonths" type="number" inputmode="numeric" value="${esc(it.intervalMonths ?? '')}"></div></div>
      <label>Catégorie</label><input name="category" value="${esc(it.category || '')}" placeholder="Moteur, Freinage…">
      <label>Pièces / références</label><textarea name="parts">${esc(it.parts || '')}</textarea>
      <label>Conseils / notes</label><textarea name="tips" rows="4">${esc(it.tips || '')}</textarea>
      <div class="check-list"><label><input type="checkbox" name="enabled" ${it.enabled !== false ? 'checked' : ''}> Actif (afficher les rappels)</label></div>`,
    (fd) => {
      const o = Object.fromEntries(fd.entries());
      o.intervalKm = num(o.intervalKm); o.intervalMonths = num(o.intervalMonths); o.enabled = fd.has('enabled');
      if (!o.intervalKm && !o.intervalMonths) { toast('Indique au moins un intervalle (km ou mois)'); return false; }
      if (id) Object.assign(it, o);
      else state.plan.push(Object.assign({ id: 'c-' + C.uid(), custom: true }, o));
      save();
    }, id ? { onDelete: () => { state.plan = state.plan.filter((p) => p.id !== id); save(); } } : {});
  }

  // --- Journal ---
  function openLogForm(id, preset = {}) {
    const l = id ? state.logs.find((x) => x.id === id) : Object.assign({ date: todayISO(), km: preset.origin === 'avant' ? '' : (C.estimatedKm(state) ?? ''), origin: 'moi', itemIds: [] }, preset);
    const docs = id ? state.docs.filter((d) => d.logId === id) : [];
    const groups = {};
    for (const p of state.plan) (groups[p.category || 'Autre'] = groups[p.category || 'Autre'] || []).push(p);
    modal(`<h2>${id ? 'Modifier l\'intervention' : 'Nouvelle intervention'}</h2>
      <label>Qui / quand</label><select name="origin">${Object.entries(ORIGIN_LABEL).map(([k, v]) => `<option value="${k}" ${l.origin === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <div class="grid2"><div><label>Date</label><input name="date" type="date" required value="${esc(l.date)}"></div>
        <div><label>Kilométrage</label><input name="km" type="number" inputmode="numeric" value="${esc(l.km ?? '')}" placeholder="si connu"></div></div>
      <label>Titre</label><input name="title" value="${esc(l.title || '')}" placeholder="ex : Révision 60 000 km, vidange…">
      <label>Opérations réalisées (met à jour les échéances)</label>
      <div class="check-list" style="max-height:220px;overflow:auto;border:1px solid var(--border);border-radius:10px;padding:4px 10px">
        ${Object.entries(groups).map(([g, items]) => `<div class="small muted" style="margin-top:6px">${esc(g)}</div>` + items.map((p) => `<label><input type="checkbox" name="itemIds" value="${esc(p.id)}" ${(l.itemIds || []).includes(p.id) ? 'checked' : ''}> ${p.kind === 'check' ? '🔍' : '🔧'} ${esc(p.name)}</label>`).join('')).join('')}
      </div>
      <div class="grid2"><div><label>Coût total (€)</label><input name="cost" type="number" step="0.01" inputmode="decimal" value="${esc(l.cost ?? '')}"></div>
        <div><label>Garage / fournisseur</label><input name="vendor" value="${esc(l.vendor || '')}"></div></div>
      <label>Pièces utilisées (marque, référence…)</label><textarea name="parts">${esc(l.parts || '')}</textarea>
      <label>Notes</label><textarea name="notes">${esc(l.notes || '')}</textarea>
      <label>🧾 Joindre facture / photos</label><input type="file" name="files" multiple accept="image/*,application/pdf">
      ${docs.length ? `<div class="files">${docs.map((d) => `<span class="file-chip" data-doc="${esc(d.id)}">🧾 ${esc(d.title)} (${(d.files || []).length})</span>`).join('')}</div>` : ''}`,
    async (fd) => {
      const o = {
        origin: fd.get('origin'), date: fd.get('date'), km: num(fd.get('km')), title: fd.get('title').trim(), itemIds: fd.getAll('itemIds'),
        cost: num(fd.get('cost')), vendor: fd.get('vendor').trim(), parts: fd.get('parts'), notes: fd.get('notes'),
      };
      let rec;
      if (id) { rec = Object.assign(l, o); } else { rec = Object.assign({ id: 'l-' + C.uid() }, o); state.logs.push(rec); }
      const files = await storeFiles(fd.getAll('files'));
      if (files.length) {
        const names = o.itemIds.map((i) => (state.plan.find((p) => p.id === i) || {}).name).filter(Boolean);
        state.docs.push({ id: 'd-' + C.uid(), date: o.date, title: 'Facture — ' + (o.title || names.join(', ') || 'intervention'),
          category: o.origin === 'moi' ? 'piece' : 'garage', amount: o.cost, vendor: o.vendor, logId: rec.id, files, notes: '' });
      }
      save(); toast('Intervention enregistrée ✔');
    }, id ? { onDelete: () => { state.logs = state.logs.filter((x) => x.id !== id); state.docs.forEach((d) => { if (d.logId === id) d.logId = null; }); save(); } } : {});
  }

  // --- Relevés ---
  function openReadingForm(id, full) {
    const r = id ? state.readings.find((x) => x.id === id) : { date: todayISO(), km: '', checks: {} };
    if (id) full = !!(r.checks && Object.keys(r.checks).length);
    const v = state.vehicle || {};
    const checks = C.MONTHLY_CHECKS.filter((c) => !(c.thermalOnly && v.fuel === 'electrique'));
    const last = C.lastKnownKm(state);
    modal(`<h2>${full ? '🔍 Relevé + check-up' : '📈 Relevé kilométrique'}</h2>
      <div class="grid2"><div><label>Date</label><input name="date" type="date" required value="${esc(r.date)}"></div>
      <div><label>Kilométrage compteur</label><input name="km" type="number" inputmode="numeric" required value="${esc(r.km)}" placeholder="${last ? 'dernier : ' + nf.format(last.km) : ''}" autofocus></div></div>
      ${full ? `<p class="small muted" style="margin-top:12px">Voiture à plat, moteur froid. ${v.tirePressure ? 'Pression conseillée : <b>' + esc(v.tirePressure) + '</b>.' : ''}</p>
        ${checks.map((c) => { const cur = (r.checks || {})[c.key] || 'ok'; return `<div class="check-row"><span>${esc(c.label)}</span><div class="tri">
          ${['ok', 'watch', 'bad'].map((val) => `<input type="radio" id="ck-${c.key}-${val}" name="ck-${c.key}" value="${val}" ${cur === val ? 'checked' : ''}><label for="ck-${c.key}-${val}" class="t-${val}">${val === 'ok' ? 'OK' : val === 'watch' ? '~' : '✕'}</label>`).join('')}
        </div></div>`; }).join('')}
        <label>Pression mesurée / profondeur pneus (optionnel)</label><input name="tires" value="${esc(r.tires || '')}" placeholder="ex : AV 2,3 / AR 2,1 — 5 mm">
        <label>📷 Photos (optionnel)</label><input type="file" name="files" multiple accept="image/*">
        ${(r.files || []).length ? `<div class="files">${r.files.map((f) => `<span class="file-chip"><a href="#" data-action="openFile" data-id="${esc(f.id)}">📷 ${esc(f.name)}</a></span>`).join('')}</div>` : ''}` : ''}
      <label>Notes</label><textarea name="notes" placeholder="${full ? 'Bruit, voyant, appoint d\'huile…' : 'Plein, trajet…'}">${esc(r.notes || '')}</textarea>`,
    async (fd) => {
      const kmv = num(fd.get('km'));
      if (last && !id && kmv < last.km && !confirm(`Ce kilométrage est inférieur au dernier connu (${nf.format(last.km)} km). Enregistrer quand même ?`)) return false;
      const o = { date: fd.get('date'), km: kmv, notes: fd.get('notes') };
      if (full) {
        o.checks = {}; for (const c of checks) o.checks[c.key] = fd.get('ck-' + c.key) || 'ok';
        o.tires = fd.get('tires');
        o.files = (r.files || []).concat(await storeFiles(fd.getAll('files')));
      }
      if (id) Object.assign(r, o); else state.readings.push(Object.assign({ id: 'r-' + C.uid() }, o));
      if (full) {
        // Les contrôles mensuels « OK » mettent à jour les éléments de plan correspondants
        const map = { pression: 'pneus-check', usure: 'pneus-check', huile: 'niveaux', refroid: 'niveaux', frein: 'niveaux', eclairage: 'eclairage' };
        const okItems = [...new Set(Object.entries(map).filter(([k]) => o.checks[k] === 'ok').map(([, v2]) => v2))]
          .filter((pid) => state.plan.some((p) => p.id === pid) && Object.entries(map).filter(([, v2]) => v2 === pid).every(([k]) => !o.checks[k] || o.checks[k] === 'ok'));
        if (!id && okItems.length) state.logs.push({ id: 'l-' + C.uid(), date: o.date, km: kmv, origin: 'moi', title: 'Check-up mensuel', itemIds: okItems, auto: true, notes: o.notes });
      }
      save(); toast('Relevé enregistré ✔');
    }, id ? { onDelete: () => { state.readings = state.readings.filter((x) => x.id !== id); save(); } } : {});
  }

  // --- Factures ---
  function openDocForm(id) {
    const d = id ? state.docs.find((x) => x.id === id) : { date: todayISO(), category: 'piece', files: [] };
    const logs = state.logs.slice().sort((a, b) => b.date.localeCompare(a.date));
    modal(`<h2>${id ? 'Document' : 'Nouvelle facture / document'}</h2>
      <label>Titre</label><input name="title" required value="${esc(d.title || '')}" placeholder="ex : Plaquettes AV Bosch — Oscaro">
      <div class="grid2"><div><label>Catégorie</label><select name="category">${Object.entries(DOC_CATS).map(([k, l]) => `<option value="${k}" ${d.category === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div><label>Date</label><input name="date" type="date" required value="${esc(d.date)}"></div></div>
      <div class="grid2"><div><label>Montant (€)</label><input name="amount" type="number" step="0.01" inputmode="decimal" value="${esc(d.amount ?? '')}"></div>
        <div><label>Fournisseur / garage</label><input name="vendor" value="${esc(d.vendor || '')}"></div></div>
      <label>Lié à l'intervention</label><select name="logId"><option value="">— aucune —</option>${logs.map((l) => `<option value="${esc(l.id)}" ${d.logId === l.id ? 'selected' : ''}>${fdate(l.date)} — ${esc(l.title || 'Intervention')}</option>`).join('')}</select>
      <label>Fichiers (photo ou PDF)</label><input type="file" name="files" multiple accept="image/*,application/pdf">
      <div class="files" id="file-list">${(d.files || []).map((f) => `<span class="file-chip"><a href="#" data-action="openFile" data-id="${esc(f.id)}">${f.type && f.type.startsWith('image/') ? '🖼️' : '📄'} ${esc(f.name)}</a><button type="button" data-rm="${esc(f.id)}" aria-label="Retirer">×</button></span>`).join('')}</div>
      <label>Notes (garantie, référence…)</label><textarea name="notes">${esc(d.notes || '')}</textarea>`,
    async (fd) => {
      const o = { title: fd.get('title').trim(), category: fd.get('category'), date: fd.get('date'), amount: num(fd.get('amount')), vendor: fd.get('vendor').trim(), logId: fd.get('logId') || null, notes: fd.get('notes') };
      const added = await storeFiles(fd.getAll('files'));
      const keep = (d.files || []).filter((f) => !removed.has(f.id));
      for (const fid of removed) await idb.del(fid).catch(() => {});
      o.files = keep.concat(added);
      if (id) Object.assign(d, o); else state.docs.push(Object.assign({ id: 'd-' + C.uid() }, o));
      save(); toast('Document enregistré ✔');
    }, {
      onOpen: (form) => $$('[data-rm]', form).forEach((b) => b.addEventListener('click', () => { removed.add(b.dataset.rm); b.parentElement.remove(); })),
      onDelete: id ? async () => { for (const f of d.files || []) await idb.del(f.id).catch(() => {}); state.docs = state.docs.filter((x) => x.id !== id); save(); } : null,
    });
    var removed = new Set();
  }

  async function openFile(fid) {
    const f = await idb.get(fid).catch(() => null);
    if (!f) return toast('Fichier introuvable sur cet appareil');
    const url = URL.createObjectURL(f.blob);
    const w = window.open(url, '_blank');
    if (!w) { const a = document.createElement('a'); a.href = url; a.download = f.name; a.click(); }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // ================= Export / import =================
  function download(name, content, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }
  function exportICS() {
    if (!state.vehicle) return toast('Configure d\'abord ta voiture');
    download('rappels-entretien.ics', C.buildICS(state), 'text/calendar');
    toast('Ouvre le fichier pour l\'ajouter à ton agenda');
  }
  const blobToB64 = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(b); });
  async function exportJSON() {
    const files = [];
    for (const f of await idb.all().catch(() => [])) files.push({ id: f.id, name: f.name, type: f.type, size: f.size, data: await blobToB64(f.blob) });
    state.settings.lastBackup = todayISO(); save();
    download(`carnet-auto-${todayISO()}.json`, JSON.stringify({ app: 'carnet-auto', exportedAt: new Date().toISOString(), state, files }), 'application/json');
    toast('Sauvegarde exportée ✔');
  }
  async function importJSON(file) {
    if (!file) return;
    try { await importData(JSON.parse(await file.text()), true); }
    catch (e) { toast('Import impossible : ' + e.message); }
  }
  async function importData(data, ask) {
    {
      if (data.app !== 'carnet-auto' || !data.state) throw new Error('fichier non reconnu');
      if (ask && !confirm('Remplacer les données actuelles par cette sauvegarde ?')) return;
      await idb.clear().catch(() => {});
      for (const f of data.files || []) {
        const bin = Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0));
        await idb.put({ id: f.id, name: f.name, type: f.type, size: f.size, blob: new Blob([bin], { type: f.type }) });
      }
      state = Object.assign(C.defaultState(), data.state);
      save(); tab = 'dashboard'; render(); toast('Données chargées ✔');
    }
  }

  // ================= Notifications & service worker =================
  function alertsSummary() {
    if (!state.vehicle) return null;
    const rd = C.monthlyCheckDue(state);
    const sts = C.allStatuses(state).filter((s) => s.status === 'overdue' || s.status === 'soon');
    const msgs = [];
    if (rd.due) msgs.push(rd.period === 7 ? 'Relevé km de la semaine à faire' : 'Relevé km du mois à faire');
    if (C.fullCheckDue(state).due) msgs.push('Check-up mensuel (pneus, niveaux, éclairage)');
    const over = sts.filter((s) => s.status === 'overdue'); const soon = sts.filter((s) => s.status === 'soon');
    if (over.length) msgs.push('En retard : ' + over.map((s) => s.item.name).join(', '));
    if (soon.length) msgs.push('Bientôt : ' + soon.map((s) => s.item.name).join(', '));
    return msgs;
  }
  async function notifyIfNeeded() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const msgs = alertsSummary();
    if (!msgs || !msgs.length || state.settings.lastNotified === todayISO()) return;
    state.settings.lastNotified = todayISO(); save();
    const opts = { body: msgs.join('\n'), icon: 'icon.svg', tag: 'carnet-auto' };
    try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) return reg.showNotification('🚗 ' + carName(), opts); } catch (e) { /* ignore */ }
    try { new Notification('🚗 ' + carName(), opts); } catch (e) { /* ignore */ }
  }
  async function enableNotifications() {
    const p = await Notification.requestPermission();
    if (p === 'granted') {
      toast('Notifications activées ✔');
      try {
        const reg = await navigator.serviceWorker.ready;
        if ('periodicSync' in reg) await reg.periodicSync.register('carnet-check', { minInterval: 24 * 3600 * 1000 });
      } catch (e) { /* periodic sync non dispo */ }
      state.settings.lastNotified = null; notifyIfNeeded();
    }
    render();
  }
  // Résumé lu par le service worker pour les notifications en arrière-plan
  function publishSummaryForSW() {
    if (!('caches' in window)) return;
    const msgs = alertsSummary() || [];
    caches.open('carnet-auto-state').then((c) => c.put('./__summary', new Response(JSON.stringify({ car: carName(), msgs, date: todayISO() }), { headers: { 'Content-Type': 'application/json' } }))).catch(() => {});
  }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  render();
  publishSummaryForSW();
  notifyIfNeeded();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); notifyIfNeeded(); } });
})();
