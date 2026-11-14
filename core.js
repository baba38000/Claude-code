/* Carnet Auto — logique métier (sans DOM), testable sous Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Core = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DAY = 86400000;
  const DEFAULT_KM_PER_MONTH = 1000;

  // ---------- Dates ----------
  function parseDate(s) {
    if (!s) return null;
    const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }
  function toISO(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function today() {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }
  function addMonths(d, months) {
    const r = new Date(d.getFullYear(), d.getMonth() + months, 1);
    const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
    r.setDate(Math.min(d.getDate(), last));
    return r;
  }
  function addDays(d, n) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + Math.round(n));
  }
  function diffDays(a, b) {
    return Math.round((a - b) / DAY);
  }

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }

  // ---------- Plan d'entretien par défaut ----------
  // Intervalles génériques : à ajuster selon le carnet constructeur !
  function defaultPlan(v) {
    const fuel = (v && v.fuel) || 'essence';
    const thermal = fuel !== 'electrique';
    const items = [];
    const add = (o) => items.push(Object.assign({ id: o.key, enabled: true, intervalKm: null, intervalMonths: null }, o));

    // --- Contrôles réguliers ---
    add({ key: 'ct', name: 'Contrôle technique', category: 'Administratif', intervalMonths: 24, difficulty: 'pro', special: 'ct',
      parts: '—',
      tips: '1er CT avant les 4 ans de la voiture, puis tous les 2 ans. Prendre RDV ~1 mois avant l\'échéance. Avant le passage : vérifier éclairage, essuie-glaces, lave-glace, klaxon, pneus, plaquettes, voyants éteints.' });
    add({ key: 'pneus-check', name: 'Contrôle pneus (usure + pression)', category: 'Pneus', intervalKm: 5000, intervalMonths: 1, difficulty: 'facile',
      parts: 'Manomètre, jauge de profondeur (~5 €)',
      tips: 'Pression à froid (valeurs sur l\'étiquette de la portière conducteur ou trappe à carburant). Profondeur légale mini 1,6 mm (témoins d\'usure), changer idéalement vers 3 mm. Chercher hernies, coupures, usure irrégulière (= géométrie).' });
    add({ key: 'pneus-permut', name: 'Permutation des pneus avant/arrière', category: 'Pneus', intervalKm: 10000, intervalMonths: 12, difficulty: 'moyen',
      parts: 'Cric, chandelles, clé dynamométrique',
      tips: 'Uniquement si les 4 pneus sont identiques et non directionnels (sinon même côté). Serrer les roues au couple constructeur (souvent 90–120 N·m) en étoile, re-vérifier après 50 km.' });
    add({ key: 'freins-check', name: 'Contrôle freins (plaquettes, disques)', category: 'Freinage', intervalKm: 15000, intervalMonths: 12, difficulty: 'facile',
      parts: 'Lampe torche',
      tips: 'Regarder l\'épaisseur des plaquettes à travers la jante (changer sous ~3 mm). Disque : épaisseur mini gravée sur le disque, rebord marqué = usé. Bruit métallique, vibrations au freinage = à contrôler vite.' });
    add({ key: 'plaquettes-av', name: 'Plaquettes de frein avant', category: 'Freinage', intervalKm: 40000, difficulty: 'moyen',
      parts: 'Jeu de plaquettes AV (réf. selon VIN), graisse cuivre/céramique, nettoyant frein',
      tips: 'Changer toujours par essieu (les 2 côtés). Repousser le piston, ne pas laisser déborder le bocal de liquide de frein. Rodage : freinages doux les 200 premiers km. Remplacer les disques tous les 2 jeux de plaquettes environ.' });
    add({ key: 'balais', name: 'Balais d\'essuie-glace', category: 'Visibilité', intervalMonths: 12, difficulty: 'facile',
      parts: 'Balais AV (longueurs selon modèle) + AR',
      tips: 'À changer dès qu\'ils laissent des traces ou broutent. Idéalement à l\'automne avant l\'hiver.' });
    add({ key: 'eclairage', name: 'Contrôle éclairage', category: 'Visibilité', intervalMonths: 3, difficulty: 'facile',
      parts: 'Ampoules de rechange (H7/H4/W5W… selon modèle)',
      tips: 'Feux de croisement, route, stop (se faire aider ou reflet sur une vitrine), clignotants, recul, plaque. Garder un kit d\'ampoules dans la boîte à gants.' });
    add({ key: 'batterie', name: 'Contrôle batterie 12 V', category: 'Électricité', intervalMonths: 12, difficulty: 'facile',
      parts: 'Multimètre (~15 €)',
      tips: 'Moteur coupé depuis quelques heures : ≥ 12,6 V = chargée, < 12,4 V = à recharger, < 12,0 V = fatiguée. Moteur tournant : 13,8–14,7 V (alternateur OK). Nettoyer les cosses (bicarbonate). Durée de vie moyenne 4–6 ans.' });
    add({ key: 'filtre-habitacle', name: 'Filtre d\'habitacle (pollen)', category: 'Filtres', intervalKm: 15000, intervalMonths: 12, difficulty: 'facile',
      parts: 'Filtre habitacle (charbon actif recommandé)',
      tips: 'Souvent derrière la boîte à gants ou sous l\'auvent de pare-brise. Respecter le sens de la flèche (flux d\'air). 10 min, 15–25 €.' });
    add({ key: 'liquide-frein', name: 'Purge liquide de frein', category: 'Freinage', intervalMonths: 24, difficulty: 'moyen',
      parts: 'Liquide DOT 4 (1 L), tuyau transparent + bocal, clé à pipe',
      tips: 'Le liquide absorbe l\'humidité → perte d\'efficacité. Purger dans l\'ordre : roue la plus éloignée du maître-cylindre d\'abord (souvent AR D, AR G, AV D, AV G). Se faire aider (pompe à la pédale) ou purgeur à dépression. Ne jamais laisser le bocal se vider.' });
    add({ key: 'clim', name: 'Climatisation (entretien / recharge)', category: 'Confort', intervalMonths: 24, difficulty: 'pro',
      parts: '—',
      tips: 'Faire tourner la clim 10 min/semaine même l\'hiver (lubrifie le circuit). Recharge en garage (gaz réglementé). Mauvaise odeur → filtre habitacle + nettoyant évaporateur.' });
    add({ key: 'geometrie', name: 'Contrôle géométrie / parallélisme', category: 'Pneus', intervalKm: 30000, intervalMonths: 24, difficulty: 'pro',
      parts: '—',
      tips: 'À faire aussi après un choc trottoir, ou si la voiture tire d\'un côté / usure irrégulière des pneus. ~60–90 € en centre auto.' });

    if (thermal) {
      add({ key: 'vidange', name: 'Vidange huile moteur + filtre à huile', category: 'Moteur', intervalKm: fuel === 'diesel' ? 20000 : 15000, intervalMonths: 12, difficulty: 'moyen',
        parts: 'Huile (norme constructeur, ex. 5W30 ACEA C3 / VW 504.00 / PSA B71 2290…), filtre à huile, joint de bouchon de vidange neuf',
        tips: 'Moteur tiède. Bac 6 L, clé de filtre, clé dynamométrique pour le bouchon (souvent 25–35 N·m). Remplir à ~90 % de la capacité, faire tourner 1 min, attendre 5 min, compléter jusqu\'au max de la jauge. Déposer l\'huile usagée en déchetterie. Utiliser la norme exacte indiquée dans le carnet !' });
      add({ key: 'niveaux', name: 'Contrôle des niveaux', category: 'Moteur', intervalKm: 1500, intervalMonths: 1, difficulty: 'facile',
        parts: 'Chiffon, bidon d\'huile d\'appoint, lave-glace',
        tips: 'Voiture à plat, moteur froid : huile (entre min et max à la jauge), liquide de refroidissement (bocal entre min/max, NE PAS ouvrir à chaud), liquide de frein (une baisse lente = usure plaquettes, rapide = fuite), lave-glace.' });
      add({ key: 'filtre-air', name: 'Filtre à air moteur', category: 'Filtres', intervalKm: 30000, intervalMonths: 24, difficulty: 'facile',
        parts: 'Filtre à air (réf. selon moteur)',
        tips: 'Boîte à air avec clips ou vis. Contrôler visuellement à chaque vidange, souffler si poussiéreux. 10 min, 10–25 €.' });
      add({ key: 'refroidissement', name: 'Liquide de refroidissement (remplacement)', category: 'Moteur', intervalKm: 120000, intervalMonths: 60, difficulty: 'moyen',
        parts: 'Liquide de refroidissement du bon type (G12/G13, type D, OAT… — ne pas mélanger les types)',
        tips: 'Toujours moteur FROID. Vidanger par la durite inférieure ou le robinet, rincer, remplir, purger l\'air (vis de purge, chauffage à fond). Vérifier le niveau sur plusieurs jours.' });
      add({ key: 'courroie-acc', name: 'Courroie d\'accessoires + galets', category: 'Moteur', intervalKm: 120000, intervalMonths: 72, difficulty: 'moyen',
        parts: 'Kit courroie accessoires (courroie + galet tendeur)',
        tips: 'Contrôler craquelures et sifflements. Faire un schéma/photo du passage de la courroie avant démontage. Souvent changée en même temps que la distribution.' });
    }
    if (fuel === 'essence' || fuel === 'hybride') {
      add({ key: 'bougies', name: 'Bougies d\'allumage', category: 'Moteur', intervalKm: 60000, intervalMonths: 48, difficulty: 'moyen',
        parts: 'Jeu de bougies (réf. constructeur), clé à bougie, graisse diélectrique',
        tips: 'Moteur froid. Souffler autour des puits avant de dévisser. Serrer au couple (souvent 20–28 N·m). Ratés / perte de puissance / conso en hausse = bougies ou bobines.' });
    }
    if (fuel === 'diesel') {
      add({ key: 'filtre-gasoil', name: 'Filtre à gazole', category: 'Filtres', intervalKm: 40000, intervalMonths: 24, difficulty: 'moyen',
        parts: 'Filtre à gazole, chiffons, poire d\'amorçage si besoin',
        tips: 'Réamorcer le circuit après remplacement (poire ou plusieurs mises du contact sans démarrer). Purger l\'eau du filtre si équipé d\'une vis de purge. Ne pas laisser couler de gazole sur les durites.' });
      add({ key: 'fap', name: 'Décrassage FAP / EGR (trajets autoroute)', category: 'Moteur', intervalMonths: 1, difficulty: 'facile',
        parts: '—',
        tips: 'Faire au moins 20–30 min d\'autoroute/voie rapide (> 2500 tr/min) par mois pour régénérer le filtre à particules, surtout si usage urbain.' });
    }
    if (thermal && v && v.timing === 'courroie') {
      add({ key: 'distribution', name: 'Kit distribution + pompe à eau', category: 'Moteur', intervalKm: 120000, intervalMonths: 72, difficulty: 'pro',
        parts: 'Kit distribution complet avec pompe à eau',
        tips: 'CRITIQUE : une courroie qui casse = moteur détruit. Respecter scrupuleusement l\'échéance du constructeur (km OU années, le premier atteint). Sur un véhicule d\'occasion sans facture → à faire immédiatement. Travail réservé aux bricoleurs très expérimentés (calage moteur).' });
    }
    if (thermal && v && v.timing === 'chaine') {
      add({ key: 'chaine-check', name: 'Surveillance chaîne de distribution', category: 'Moteur', intervalKm: 30000, intervalMonths: 24, difficulty: 'pro',
        parts: '—',
        tips: 'La chaîne est prévue pour durer, mais écouter un cliquetis au démarrage à froid (signe d\'allongement). Respecter les vidanges : une huile usée use la chaîne.' });
    }
    if (v && v.gearbox === 'auto') {
      add({ key: 'huile-bva', name: 'Vidange boîte automatique', category: 'Transmission', intervalKm: 60000, intervalMonths: 60, difficulty: 'pro',
        parts: 'Huile ATF/DSG spécifique + filtre',
        tips: 'Souvent annoncée « à vie » mais une vidange vers 60 000 km prolonge fortement la boîte (DSG : 60 000 km). Garage recommandé (niveau à chaud, outil diag).' });
    }
    if (fuel === 'electrique' || fuel === 'hybride') {
      add({ key: 'batterie-hv', name: 'Bilan batterie de traction', category: 'Électricité', intervalMonths: 12, difficulty: 'pro',
        parts: '—',
        tips: 'Contrôle de l\'état de santé (SoH) lors de la révision. Éviter de stocker la voiture longtemps à 100 % ou sous 10 %.' });
    }
    if (fuel === 'electrique') {
      add({ key: 'niveaux', name: 'Contrôle des niveaux', category: 'Moteur', intervalMonths: 1, difficulty: 'facile',
        parts: 'Lave-glace',
        tips: 'Liquide de frein, liquide de refroidissement batterie/électronique (moteur froid), lave-glace.' });
    }
    const CHECKS = ['ct', 'pneus-check', 'freins-check', 'eclairage', 'batterie', 'niveaux', 'geometrie', 'chaine-check', 'fap', 'batterie-hv', 'clim'];
    for (const it of items) it.kind = CHECKS.includes(it.id) ? 'check' : 'replace';
    return items;
  }

  // ---------- Calculs ----------
  function sortedReadings(state) {
    const pts = [];
    const v = state.vehicle || {};
    if (v.purchaseDate && v.purchaseKm != null && v.purchaseKm !== '') pts.push({ date: v.purchaseDate, km: Number(v.purchaseKm) });
    for (const r of state.readings || []) if (r.date && r.km != null) pts.push({ date: r.date, km: Number(r.km) });
    for (const l of state.logs || []) if (l.date && l.km != null && l.km !== '') pts.push({ date: l.date, km: Number(l.km) });
    for (const f of state.fuels || []) if (f.date && f.km != null && f.km !== '') pts.push({ date: f.date, km: Number(f.km) });
    pts.sort((a, b) => a.date.localeCompare(b.date) || a.km - b.km);
    return pts;
  }

  /** Moyenne km/jour, à partir des relevés (min 20 jours d'historique). */
  function kmPerDay(state) {
    const s = state.settings || {};
    if (s.kmPerMonthOverride) return Number(s.kmPerMonthOverride) / 30.44;
    const pts = sortedReadings(state);
    if (pts.length >= 2) {
      const first = pts[0];
      const last = pts[pts.length - 1];
      const days = diffDays(parseDate(last.date), parseDate(first.date));
      if (days >= 20 && last.km > first.km) return (last.km - first.km) / days;
    }
    return DEFAULT_KM_PER_MONTH / 30.44;
  }

  function lastKnownKm(state) {
    const pts = sortedReadings(state);
    if (!pts.length) return null;
    // km max (au cas où un relevé daté plus tôt aurait plus de km)
    let best = pts[0];
    for (const p of pts) if (p.km >= best.km) best = p;
    return best;
  }

  function estimatedKm(state, at) {
    const last = lastKnownKm(state);
    if (!last) return null;
    const d = at || today();
    const days = Math.max(0, diffDays(d, parseDate(last.date)));
    return Math.round(last.km + days * kmPerDay(state));
  }

  /** Dernière réalisation d'un élément du plan (depuis le journal). */
  function lastDone(state, itemId) {
    let best = null;
    for (const l of state.logs || []) {
      if (!(l.itemIds || []).includes(itemId)) continue;
      if (!best || l.date > best.date || (l.date === best.date && Number(l.km) > Number(best.km))) best = l;
    }
    return best;
  }

  /**
   * Statut d'un élément : 'overdue' | 'soon' | 'ok' | 'unknown'
   */
  function itemStatus(state, item, now) {
    now = now || today();
    const v = state.vehicle || {};
    const curKm = estimatedKm(state, now);
    const kpd = kmPerDay(state);
    const done = lastDone(state, item.id);
    let baseDate = null;
    let baseKm = null;
    let assumed = false;

    if (done) {
      baseDate = parseDate(done.date);
      baseKm = done.km !== '' && done.km != null ? Number(done.km) : null;
    } else if (item.special === 'ct' && v.firstReg) {
      // Avant le 1er CT : échéance 4 ans après la 1re immatriculation
      const first = addMonths(parseDate(v.firstReg), 48);
      if (first > now) {
        return finalize({ dueDate: first, dueKm: null, done: null, assumed: true });
      }
    } else if (item.intervalMonths && item.intervalMonths <= 3 && v.purchaseDate) {
      // Contrôles fréquents : on part de la date d'achat
      baseDate = parseDate(v.purchaseDate);
      baseKm = v.purchaseKm !== '' && v.purchaseKm != null ? Number(v.purchaseKm) : null;
      assumed = true;
    }

    if (!baseDate) {
      return { item, status: 'unknown', done: null, dueDate: null, dueKm: null, kmLeft: null, daysLeft: null, estDate: null, curKm };
    }

    const dueDate = item.intervalMonths ? addMonths(baseDate, Number(item.intervalMonths)) : null;
    const dueKm = item.intervalKm && baseKm != null ? baseKm + Number(item.intervalKm) : null;
    return finalize({ dueDate, dueKm, done, assumed });

    function finalize({ dueDate, dueKm, done, assumed }) {
      const daysLeft = dueDate ? diffDays(dueDate, now) : null;
      const kmLeft = dueKm != null && curKm != null ? dueKm - curKm : null;
      // Date estimée = première échéance atteinte (date ou km)
      let estDate = dueDate;
      if (kmLeft != null) {
        const kmDate = addDays(now, kpd > 0 ? kmLeft / kpd : 99999);
        if (!estDate || kmDate < estDate) estDate = kmDate;
      }
      let status = 'ok';
      const soonKm = item.intervalKm ? Math.min(1500, Math.max(300, item.intervalKm * 0.1)) : 0;
      const soonDays = item.intervalMonths && item.intervalMonths <= 1 ? 5 : 30;
      if ((daysLeft != null && daysLeft < 0) || (kmLeft != null && kmLeft < 0)) status = 'overdue';
      else if ((daysLeft != null && daysLeft <= soonDays) || (kmLeft != null && kmLeft <= soonKm)) status = 'soon';
      if (!dueDate && dueKm == null) status = 'unknown';
      return { item, status, done, assumed, dueDate, dueKm, kmLeft, daysLeft, estDate, curKm };
    }
  }

  const STATUS_ORDER = { overdue: 0, unknown: 1, soon: 2, ok: 3 };
  function allStatuses(state, now) {
    return (state.plan || [])
      .filter((i) => i.enabled !== false)
      .map((i) => itemStatus(state, i, now))
      .sort((a, b) => {
        const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        if (s) return s;
        const ad = a.estDate ? a.estDate.getTime() : Infinity;
        const bd = b.estDate ? b.estDate.getTime() : Infinity;
        return ad - bd;
      });
  }

  function lastReading(state) {
    const rs = (state.readings || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    return rs[rs.length - 1] || null;
  }

  /** Période du relevé km (jours) selon le réglage hebdo/mensuel. */
  function readingPeriod(state) {
    return ((state.settings || {}).readingFreq === 'weekly') ? 7 : 30;
  }

  /** Le relevé km est-il dû ? (hebdo : ≥ 7 j, mensuel : ≥ 28 j) */
  function monthlyCheckDue(state, now) {
    now = now || today();
    const r = lastReading(state);
    const period = readingPeriod(state);
    // Un plein avec le km compte comme relevé
    const dates = [r && r.date].concat((state.fuels || []).filter((f) => f.km != null && f.km !== '').map((f) => f.date)).filter(Boolean).sort();
    const lastDate = dates[dates.length - 1];
    if (!lastDate) return { due: true, daysSince: null, period };
    const daysSince = diffDays(now, parseDate(lastDate));
    return { due: daysSince >= (period === 7 ? 7 : 28), daysSince, period };
  }

  /** Dernier contrôle complet (checklist) — conseillé chaque mois même en suivi hebdo. */
  function fullCheckDue(state, now) {
    now = now || today();
    const full = (state.readings || []).filter((r) => r.checks && Object.keys(r.checks).length).sort((a, b) => a.date.localeCompare(b.date));
    const r = full[full.length - 1];
    if (!r) return { due: true, daysSince: null };
    const daysSince = diffDays(now, parseDate(r.date));
    return { due: daysSince >= 28, daysSince };
  }

  // ---------- Export calendrier (.ics) ----------
  function icsEscape(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  }
  function icsDate(d) {
    return toISO(d).replace(/-/g, '');
  }
  function fold(line) {
    // RFC 5545 : lignes ≤ 75 octets (approximation en caractères)
    const out = [];
    while (line.length > 73) {
      out.push(line.slice(0, 73));
      line = ' ' + line.slice(73);
    }
    out.push(line);
    return out.join('\r\n');
  }

  function buildICS(state, now) {
    now = now || today();
    const v = state.vehicle || {};
    const carName = v.name || [v.brand, v.model].filter(Boolean).join(' ') || 'Ma voiture';
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Carnet Auto//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'X-WR-CALNAME:' + icsEscape('Entretien ' + carName)];

    const day = Math.min(28, Math.max(1, Number((state.settings || {}).reminderDay) || 1));
    let start = new Date(now.getFullYear(), now.getMonth(), day);
    if (start < now) start = new Date(now.getFullYear(), now.getMonth() + 1, day);

    const event = (uidv, date, summary, desc, extra) => {
      lines.push('BEGIN:VEVENT', 'UID:' + uidv + '@carnet-auto', 'DTSTAMP:' + stamp,
        'DTSTART;VALUE=DATE:' + icsDate(date), 'DTEND;VALUE=DATE:' + icsDate(addDays(date, 1)),
        fold('SUMMARY:' + icsEscape(summary)), fold('DESCRIPTION:' + icsEscape(desc)));
      if (extra) lines.push(...extra);
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEscape(summary), 'TRIGGER:PT9H', 'END:VALARM', 'END:VEVENT');
    };

    const weekly = readingPeriod(state) === 7;
    if (weekly) {
      // Relevé km chaque semaine (même jour de la semaine que la 1re date)
      let w = addDays(now, (7 + Number((state.settings || {}).reminderWeekday ?? 0) - now.getDay()) % 7 || 7);
      event('releve-hebdo', w, `🚗 Relevé km de la semaine — ${carName}`,
        'Ouvrir Carnet Auto → « Relevé km » et noter le compteur (30 secondes).', ['RRULE:FREQ=WEEKLY']);
    }
    event('releve-mensuel', start, `🚗 Check mensuel voiture — ${carName}`,
      'Ouvrir Carnet Auto → « Relevé + check-up » :\n- noter le kilométrage\n- pression & usure pneus\n- niveaux (huile, refroidissement, frein, lave-glace)\n- éclairage, voyants, bruits\nPuis consulter les pièces à vérifier / à changer.',
      ['RRULE:FREQ=MONTHLY']);

    for (const s of allStatuses(state, now)) {
      if (s.status === 'unknown' || !s.estDate) continue;
      if (s.item.intervalMonths && s.item.intervalMonths <= 3) continue; // couverts par le relevé mensuel
      let d = s.estDate < now ? now : s.estDate;
      const kmTxt = s.dueKm != null ? ` ou ${s.dueKm.toLocaleString('fr-FR')} km` : '';
      const desc = `Échéance estimée${kmTxt}.\nPièces : ${s.item.parts || '—'}\n\nConseils : ${s.item.tips || '—'}`;
      event('item-' + s.item.id, d, `🔧 ${s.item.name} — ${carName}`, desc,
        ['BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEscape('Dans 2 semaines : ' + s.item.name), 'TRIGGER:-P14D', 'END:VALARM']);
    }
    lines.push('END:VCALENDAR');
    return lines.join('\r\n') + '\r\n';
  }

  // ---------- Relevé mensuel : checklist ----------
  const MONTHLY_CHECKS = [
    { key: 'pression', label: 'Pression des pneus' },
    { key: 'usure', label: 'Usure / état des pneus' },
    { key: 'huile', label: 'Niveau d\'huile moteur', thermalOnly: true },
    { key: 'refroid', label: 'Liquide de refroidissement' },
    { key: 'frein', label: 'Liquide de frein' },
    { key: 'laveglace', label: 'Lave-glace' },
    { key: 'eclairage', label: 'Éclairage & clignotants' },
    { key: 'balais', label: 'Essuie-glaces' },
    { key: 'voyants', label: 'Voyants au tableau de bord' },
    { key: 'bruits', label: 'Bruits / vibrations / freinage' },
    { key: 'fuites', label: 'Fuites sous la voiture' },
    { key: 'carrosserie', label: 'Carrosserie / pare-brise (impacts)' },
  ];

  /** Applique une fiche constructeur : doc technique + ajustements du plan + éléments supplémentaires. */
  function applyPreset(state, p) {
    const mine = (state.tech || []).filter((r) => r.custom);
    state.tech = p.rows.map((r, i) => Object.assign({ id: 'p-' + i }, r)).concat(mine);
    state.plan = state.plan || [];
    for (const [pid, patch] of Object.entries(p.plan || {})) {
      const it = state.plan.find((x) => x.id === pid);
      if (it) Object.assign(it, patch);
    }
    for (const add of p.addItems || []) {
      const ex = state.plan.find((x) => x.id === add.id);
      if (ex) Object.assign(ex, add);
      else state.plan.push(Object.assign({ enabled: true, custom: true }, add));
    }
    if (p.conso) {
      state.settings = state.settings || {};
      state.settings.consoUrban = p.conso.urban;
      state.settings.consoRoad = p.conso.road;
    }
    state.presetLabel = p.label;
    return state;
  }

  // ---------- Carburant ----------
  /** Complète litres / total / prix au litre à partir de 2 des 3 valeurs. */
  function completeFuel(f) {
    const n = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));
    let L = n(f.liters), T = n(f.total), P = n(f.price);
    if (L == null && T != null && P) L = T / P;
    if (T == null && L != null && P != null) T = L * P;
    if (P == null && L && T != null) P = T / L;
    return Object.assign({}, f, {
      liters: L == null ? null : Math.round(L * 100) / 100,
      total: T == null ? null : Math.round(T * 100) / 100,
      price: P == null ? null : Math.round(P * 1000) / 1000,
    });
  }

  /**
   * Statistiques carburant. Consommation calculée « plein à plein » :
   * litres versés entre deux pleins complets / km parcourus entre les deux.
   */
  function fuelStats(state) {
    const fs = (state.fuels || []).filter((f) => f.date).slice()
      .sort((a, b) => a.date.localeCompare(b.date) || (Number(a.km) || 0) - (Number(b.km) || 0));
    const withL = fs.filter((f) => f.liters > 0 && f.total > 0);
    const liters = withL.reduce((a, f) => a + Number(f.liters), 0);
    const totalAll = fs.reduce((a, f) => a + (Number(f.total) || 0), 0);
    const totalWithL = withL.reduce((a, f) => a + Number(f.total), 0);
    const prices = withL.map((f) => Number(f.price || f.total / f.liters));

    let segL = 0, segKm = 0, prevFull = null, acc = 0;
    const consoPoints = [];
    for (const f of fs) {
      if (f.km == null || f.km === '') { prevFull = null; acc = 0; continue; } // km manquant : on casse la chaîne
      if (prevFull) acc += Number(f.liters) || 0;
      if (f.full !== false) {
        if (prevFull && Number(f.km) > Number(prevFull.km) && acc > 0) {
          const d = Number(f.km) - Number(prevFull.km);
          segL += acc; segKm += d;
          consoPoints.push({ date: f.date, conso: (acc / d) * 100 });
        }
        prevFull = f; acc = 0;
      }
    }
    const conso = segKm > 0 ? (segL / segKm) * 100 : null;
    const avgPrice = liters > 0 ? totalWithL / liters : null;

    const now = today();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = toISO(d).slice(0, 7);
      const m = fs.filter((f) => f.date.slice(0, 7) === key);
      months.push({ key, date: d, total: m.reduce((a, f) => a + (Number(f.total) || 0), 0), liters: m.reduce((a, f) => a + (Number(f.liters) || 0), 0) });
    }
    const last12 = fs.filter((f) => diffDays(now, parseDate(f.date)) <= 365).reduce((a, f) => a + (Number(f.total) || 0), 0);

    return {
      count: fs.length, liters, total: totalAll, avgPrice,
      minPrice: prices.length ? Math.min(...prices) : null,
      maxPrice: prices.length ? Math.max(...prices) : null,
      lastPrice: prices.length ? prices[prices.length - 1] : null,
      conso, costPer100: conso != null && avgPrice != null ? conso * avgPrice : null,
      consoPoints, months, last12,
      pricePoints: withL.map((f) => ({ date: f.date, price: Number(f.price || f.total / f.liters) })),
    };
  }

  function defaultState() {
    return {
      version: 1,
      vehicle: null,
      plan: [],
      logs: [],
      readings: [],
      docs: [],
      fuels: [],
      tech: [],
      settings: { reminderDay: 1, reminderWeekday: 0, readingFreq: 'monthly', kmPerMonthOverride: null, lastNotified: null },
    };
  }

  return {
    parseDate, toISO, today, addMonths, addDays, diffDays, uid,
    defaultPlan, defaultState, applyPreset, completeFuel, fuelStats, kmPerDay, estimatedKm, lastKnownKm, lastDone,
    itemStatus, allStatuses, lastReading, monthlyCheckDue, fullCheckDue, readingPeriod, buildICS, MONTHLY_CHECKS,
  };
});
