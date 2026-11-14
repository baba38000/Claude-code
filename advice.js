/*
 * Carnet Auto — moteur de conseils.
 * Principe : un conseil n'apparaît QUE si les chiffres saisis sortent de la normale
 * (consommation, prix payé, usure, check-ups, kilométrage…). Rien à signaler = rien d'affiché.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.Advice = factory(root.Core);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  // Consommations de référence génériques (L/100 km) si la fiche véhicule n'en fournit pas
  const REF = {
    diesel: { urban: 8.0, road: 5.2 },
    essence: { urban: 9.5, road: 6.0 },
    hybride: { urban: 5.0, road: 5.5 },
  };

  const f1 = (n) => n.toFixed(1).replace('.', ',');
  const f3 = (n) => n.toFixed(3).replace('.', ',');
  const nf = (n) => Math.round(n).toLocaleString('fr-FR');

  function usage(state) {
    const s = state.settings || {};
    const u = s.urbanShare == null || s.urbanShare === '' ? 50 : Number(s.urbanShare);
    return Math.min(100, Math.max(0, u)) / 100;
  }

  /** Consommation attendue selon la part de ville. */
  function expectedConso(state) {
    const s = state.settings || {};
    const v = state.vehicle || {};
    if (s.consoRef) return { value: Number(s.consoRef), source: 'ta valeur de référence (Réglages)' };
    const ref = s.consoUrban && s.consoRoad ? { urban: Number(s.consoUrban), road: Number(s.consoRoad) } : REF[v.fuel];
    if (!ref) return null;
    const u = usage(state);
    return {
      value: u * ref.urban + (1 - u) * ref.road,
      source: `${Math.round(u * 100)} % ville × ${f1(ref.urban)} + ${Math.round((1 - u) * 100)} % route × ${f1(ref.road)} L/100 km`,
    };
  }

  /** km/mois réellement mesurés (sans le réglage manuel), null si pas assez de recul. */
  function measuredKmPerMonth(state) {
    const pts = [];
    const v = state.vehicle || {};
    if (v.purchaseDate && v.purchaseKm) pts.push({ d: v.purchaseDate, km: Number(v.purchaseKm) });
    for (const r of state.readings || []) pts.push({ d: r.date, km: Number(r.km) });
    for (const f of state.fuels || []) if (f.km != null && f.km !== '') pts.push({ d: f.date, km: Number(f.km) });
    const after = pts.filter((p) => !v.purchaseDate || p.d >= v.purchaseDate).sort((a, b) => a.d.localeCompare(b.d));
    if (after.length < 2) return null;
    const days = C.diffDays(C.parseDate(after[after.length - 1].d), C.parseDate(after[0].d));
    if (days < 30) return null;
    return ((after[after.length - 1].km - after[0].km) / days) * 30.44;
  }

  const CHECK_TIPS = {
    pression: 'Pression basse à répétition = crevaison lente, valve ou jante qui fuit. Passe de l\'eau savonneuse sur le pneu et la valve, ou fais-le contrôler (souvent gratuit en centre pneus). Un pneu sous-gonflé de 0,5 bar = +2 à 4 % de consommation et usure des épaules.',
    usure: 'Usure qui revient sur le relevé : regarde si elle est irrégulière (bords intérieurs = parallélisme/carrossage, centre = surgonflage, bords = sous-gonflage). Un contrôle géométrie coûte moins cher qu\'un train de pneus.',
    huile: 'Sur un diesel à FAP qui roule en ville, deux cas : le niveau BAISSE (consommation d\'huile : turbo, segmentation → surveiller la fumée bleue) ou il MONTE (gazole dans l\'huile à cause des régénérations interrompues → vidange anticipée + trajets autoroute réguliers). Note le niveau à chaque fois pour savoir dans quel cas tu es.',
    refroid: 'Liquide de refroidissement qui baisse = fuite (durites, radiateur, pompe à eau, bouchon de vase) ou, plus grave, joint de culasse (bulles dans le vase, fumée blanche, mayonnaise sous le bouchon d\'huile). À traiter vite.',
    frein: 'Le liquide de frein ne se « consomme » pas : une baisse lente suit l\'usure des plaquettes, une baisse rapide = fuite → ne pas rouler avant contrôle.',
    eclairage: 'Ampoule qui grille souvent du même côté : mauvais contact / connecteur oxydé, ou tension de charge trop élevée (vérifier 13,8–14,7 V moteur tournant).',
    balais: 'Les balais qui se dégradent vite : nettoie le pare-brise et les lames à l\'alcool, et évite de les utiliser à sec ou sur du givre.',
    voyants: 'Un voyant qui revient : fais lire les codes défaut (valise OBD, ~20 € en interface + appli). Sur Vel Satis, beaucoup de défauts viennent de connecteurs ou de la batterie faible.',
    bruits: 'Un bruit qui persiste s\'aggrave rarement tout seul dans le bon sens : note quand il apparaît (à froid, en virage, au freinage, sur bosses) et fais-le diagnostiquer avant la casse.',
    fuites: 'Fuite récurrente : identifie le liquide (huile = brun/noir, refroidissement = rose/vert/sucré, frein = jaune clair huileux, gazole = odeur) et l\'endroit (avant/arrière, côté). Glisse un carton sous la voiture une nuit.',
    carrosserie: 'Un impact de pare-brise se répare gratuitement ou presque via l\'assurance bris de glace tant qu\'il est plus petit qu\'une pièce de 2 € et hors champ de vision.',
  };

  function compute(state, now) {
    now = now || C.today();
    const out = [];
    const v = state.vehicle || {};
    if (!v.brand && !v.model) return out;
    const u = usage(state);
    const add = (o) => out.push(o);
    const isDieselFap = v.fuel === 'diesel';

    // ---------- 1. Consommation ----------
    const fs = C.fuelStats(state);
    const exp = expectedConso(state);
    const segKm = fs.consoPoints.length;
    if (fs.conso != null && segKm >= 1) {
      if (fs.conso > 30 || fs.conso < 2.5) {
        add({ id: 'conso-data', level: 'data', title: 'Consommation calculée improbable',
          text: `Le calcul donne ${f1(fs.conso)} L/100 km, ce qui n'est pas réaliste. Le plus souvent : un plein partiel saisi comme « plein complet », un plein oublié, ou une faute de frappe dans le kilométrage.`,
          facts: [`${fs.count} plein(s) enregistré(s)`], tab: 'fuel' });
      } else if (exp && fs.conso > exp.value * 1.25) {
        const ratio = fs.conso / exp.value;
        const lastCheck = (state.readings || []).filter((r) => r.checks).sort((a, b) => a.date.localeCompare(b.date)).pop();
        const tips = [];
        if (lastCheck && lastCheck.checks.pression && lastCheck.checks.pression !== 'ok') tips.push('Ton dernier check-up signale la pression des pneus : regonfle à la valeur de la portière (+0,2 bar max si beaucoup de charge).');
        else tips.push('Vérifie la pression des pneus à froid (c\'est la cause n°1 et la plus simple).');
        if (u >= 0.6) {
          tips.push('En ville : anticipe (lâche l\'accélérateur tôt et laisse le frein moteur agir, l\'injection est coupée), passe les rapports tôt (≈ 2 000 tr/min en diesel), évite de faire chauffer le moteur à l\'arrêt.');
          if (isDieselFap) tips.push('Trajets courts + FAP = régénérations interrompues qui font surconsommer. Fais 20–30 min de voie rapide tous les 10–15 jours.');
        }
        tips.push('Clim en permanence, coffre de toit, porte-vélos, poids inutile dans le coffre : chacun coûte 0,3 à 1 L/100 km.');
        if (ratio >= 1.5) tips.push('Écart très important : au-delà de la conduite, fais vérifier un frein qui frotte (jante plus chaude que les autres après un trajet), le filtre à air, un injecteur ou un FAP colmaté (valise).');
        add({ id: 'conso-high', level: ratio >= 1.5 ? 'bad' : 'warn',
          title: `Consommation élevée : ${f1(fs.conso)} L/100 km`,
          text: `C'est ${Math.round((ratio - 1) * 100)} % de plus que ce qu'on peut attendre pour ton usage (≈ ${f1(exp.value)} L/100 km).`,
          facts: ['Attendu : ' + exp.source], tips, tab: 'fuel' });
      }
      // Hausse récente
      if (fs.consoPoints.length >= 3) {
        const last2 = fs.consoPoints.slice(-2).reduce((a, p) => a + p.conso, 0) / 2;
        const before = fs.consoPoints.slice(0, -2).reduce((a, p) => a + p.conso, 0) / (fs.consoPoints.length - 2);
        if (last2 > before * 1.15 && last2 < 30) {
          add({ id: 'conso-trend', level: 'warn', title: 'Consommation en hausse sur les derniers pleins',
            text: `${f1(last2)} L/100 km sur les 2 derniers pleins contre ${f1(before)} avant (+${Math.round((last2 / before - 1) * 100)} %). Si ta façon de rouler n'a pas changé (plus de ville, froid, clim…), ça peut annoncer un souci.`,
            tips: ['Pression des pneus et frein qui frotte en premier.', 'Filtre à air encrassé, thermostat bloqué ouvert (le moteur met longtemps à chauffer).', isDieselFap ? 'FAP qui se colmate : régénérations plus fréquentes (ventilateur qui tourne à l\'arrêt, ralenti plus haut). Fais un trajet autoroute puis surveille.' : 'Sonde lambda / bougies si le moteur manque de souplesse.'],
            tab: 'fuel' });
        }
      }
    }

    // ---------- 2. Prix du carburant ----------
    const priced = (state.fuels || []).filter((f) => f.price > 0).sort((a, b) => a.date.localeCompare(b.date));
    if (priced.length >= 4 && fs.avgPrice) {
      const last = priced[priced.length - 1];
      if (last.price > fs.avgPrice * 1.06) {
        add({ id: 'price-last', level: 'info', title: 'Dernier plein payé cher',
          text: `${f3(last.price)} €/L contre ${f3(fs.avgPrice)} €/L en moyenne (+${Math.round((last.price / fs.avgPrice - 1) * 100)} %). Compare les stations autour de toi sur prix-carburants.gouv.fr avant le prochain plein ; les stations de supermarché sont souvent 5 à 15 cts moins chères qu'en autoroute.`,
          tab: 'fuel' });
      }
      const byStation = {};
      for (const f of priced) if (f.station) (byStation[f.station.trim().toLowerCase()] = byStation[f.station.trim().toLowerCase()] || { name: f.station.trim(), L: 0, T: 0, n: 0 });
      for (const f of priced) if (f.station) { const b = byStation[f.station.trim().toLowerCase()]; b.L += Number(f.liters) || 0; b.T += Number(f.total) || 0; b.n++; }
      const st = Object.values(byStation).filter((b) => b.n >= 2 && b.L > 0).map((b) => Object.assign(b, { p: b.T / b.L }));
      if (st.length >= 2) {
        st.sort((a, b) => a.p - b.p);
        const cheap = st[0];
        const most = st.slice().sort((a, b) => b.n - a.n)[0];
        const diff = most.p - cheap.p;
        const L12 = fs.months.reduce((a, m) => a + m.liters, 0);
        if (most !== cheap && diff >= 0.04) {
          add({ id: 'price-station', level: 'info', title: `Moins cher chez ${cheap.name}`,
            text: `Tu vas surtout chez ${most.name} (${f3(most.p)} €/L en moyenne), alors que ${cheap.name} te revient à ${f3(cheap.p)} €/L. Sur tes ${nf(L12)} L des 12 derniers mois, ça ferait ≈ ${nf(L12 * diff)} € d'économie.`,
            tab: 'fuel' });
        }
      }
    }

    // ---------- 3. Kilométrage et type de trajets ----------
    const kpm = measuredKmPerMonth(state);
    if (kpm != null) {
      if (isDieselFap && u >= 0.6 && kpm < 900) {
        add({ id: 'fap-city', level: 'warn', title: 'Usage très urbain pour un diesel à FAP',
          text: `${nf(kpm)} km/mois mesurés avec ${Math.round(u * 100)} % de ville : le filtre à particules a peu d'occasions de se régénérer complètement. C'est la première cause de panne coûteuse (FAP colmaté, EGR encrassée, huile diluée) sur ce type de moteur.`,
          tips: ['Un trajet de 20–30 min sur voie rapide, moteur chaud, tous les 10–15 jours (≥ 2 500 tr/min par moments, en 4e/5e).', 'Ne coupe pas le moteur si le ventilateur tourne fort juste après un trajet : c\'est souvent une régénération en cours.', 'Contrôle la jauge d\'huile toutes les 2 semaines : si elle MONTE, fais la vidange en avance.', 'Garde la vidange à 10 000 km / 1 an maximum.'] });
      }
      if (kpm < 400) {
        add({ id: 'battery-low-use', level: 'info', title: 'Très peu de kilomètres : attention à la batterie',
          text: `${nf(kpm)} km/mois en moyenne. Des trajets courts ne rechargent pas la batterie (la carte mains-libres, l'alarme et les calculateurs consomment à l'arrêt). Mesure-la au multimètre : sous 12,4 V moteur arrêté, branche un chargeur/mainteneur une nuit de temps en temps.` });
      }
      if (kpm > 2500) {
        add({ id: 'high-use', level: 'info', title: 'Gros rouleur : les échéances vont vite',
          text: `${nf(kpm)} km/mois : une vidange à 10 000 km arrive tous les ${Math.max(1, Math.round(10000 / kpm))} mois. Passe tes relevés en hebdomadaire et contrôle huile et pneus toutes les 2 semaines.` });
      }
    }

    // ---------- 4. Plan inadapté à l'usage ----------
    const vid = (state.plan || []).find((p) => p.id === 'vidange' && p.enabled !== false);
    if (vid && u >= 0.6 && Number(vid.intervalKm) > 15000) {
      add({ id: 'plan-severe', level: 'warn', title: 'Intervalle de vidange trop long pour ton usage',
        text: `Ton plan prévoit une vidange tous les ${nf(vid.intervalKm)} km, mais ${Math.round(u * 100)} % de ville = « conditions sévères » pour les constructeurs (trajets courts, moteur souvent froid). Passe à 10 000 km ou 1 an.`, item: 'vidange' });
    }

    // ---------- 5. Pièces qui s'usent plus vite que prévu ----------
    for (const item of (state.plan || []).filter((p) => p.kind !== 'check' && p.intervalKm && p.enabled !== false)) {
      const logs = (state.logs || []).filter((l) => (l.itemIds || []).includes(item.id) && l.km != null && l.km !== '')
        .sort((a, b) => Number(a.km) - Number(b.km));
      if (logs.length < 2) continue;
      const gaps = [];
      for (let i = 1; i < logs.length; i++) gaps.push(Number(logs[i].km) - Number(logs[i - 1].km));
      const lastGap = gaps[gaps.length - 1];
      if (lastGap > 500 && lastGap < item.intervalKm * 0.7) {
        const tips = [];
        if (/plaquette|disque|frein/i.test(item.name)) tips.push('En ville, l\'usure des freins dépend surtout de l\'anticipation : lève le pied tôt, utilise le frein moteur, garde plus de distance. Vérifie aussi qu\'un étrier ne reste pas collé (une roue plus chaude que les autres, odeur de chaud).');
        if (/pneu/i.test(item.name)) tips.push('Usure rapide des pneus : pression, géométrie, et style de conduite (démarrages et virages appuyés).');
        if (/vidange|huile/i.test(item.name)) tips.push('Vidanges rapprochées : c\'est bien si c\'était volontaire (dilution, usage urbain).');
        tips.push(`Ajuste l'intervalle du plan à ≈ ${nf(Math.round(lastGap / 1000) * 1000)} km pour être prévenu à temps.`);
        add({ id: 'wear-' + item.id, level: 'warn', title: `${item.name} : usure plus rapide que prévu`,
          text: `Dernier remplacement au bout de ${nf(lastGap)} km, alors que le plan prévoit ${nf(item.intervalKm)} km (${Math.round((lastGap / item.intervalKm) * 100)} %).`,
          tips, item: item.id });
      }
    }

    // ---------- 6. Retards importants ----------
    for (const s of C.allStatuses(state, now)) {
      if (s.status !== 'overdue') continue;
      const it = s.item;
      if (it.kind === 'check' && (it.intervalMonths || 99) < 12) continue; // contrôles fréquents : déjà dans « À vérifier »
      const kmLate = s.kmLeft != null && it.intervalKm && -s.kmLeft > it.intervalKm * 0.2;
      const dayLate = s.daysLeft != null && -s.daysLeft > 60;
      if (!kmLate && !dayLate) continue;
      const parts = [];
      if (s.kmLeft != null && s.kmLeft < 0) parts.push(`${nf(-s.kmLeft)} km de retard`);
      if (s.daysLeft != null && s.daysLeft < 0) parts.push(`${nf(-s.daysLeft)} jours de retard`);
      add({ id: 'late-' + it.id, level: /frein|distribution|vidange|courroie/i.test(it.name) ? 'bad' : 'warn',
        title: `${it.name} : nettement en retard`, text: `${parts.join(' et ')}. Plus on attend, plus la pièce (et ce qui l'entoure) s'use.`, item: it.id });
    }

    // ---------- 7. Problèmes récurrents aux check-ups ----------
    const full = (state.readings || []).filter((r) => r.checks && Object.keys(r.checks).length).sort((a, b) => a.date.localeCompare(b.date));
    if (full.length >= 2) {
      const [a, b] = full.slice(-2);
      for (const c of C.MONTHLY_CHECKS) {
        const va = a.checks[c.key], vb = b.checks[c.key];
        if (va && vb && va !== 'ok' && vb !== 'ok') {
          add({ id: 'recurring-' + c.key, level: vb === 'bad' ? 'bad' : 'warn', title: `${c.label} : signalé à 2 check-ups de suite`,
            text: CHECK_TIPS[c.key] || 'Le point revient : fais-le contrôler plutôt que de le surveiller indéfiniment.',
            facts: [`${a.date} : ${va === 'bad' ? 'problème' : 'à surveiller'}`, `${b.date} : ${vb === 'bad' ? 'problème' : 'à surveiller'}`] });
        }
      }
    }

    // ---------- 8. Incohérences de saisie ----------
    const kms = []
      .concat((state.readings || []).map((r) => ({ d: r.date, km: Number(r.km), src: 'relevé' })))
      .concat((state.fuels || []).filter((f) => f.km != null && f.km !== '').map((f) => ({ d: f.date, km: Number(f.km), src: 'plein' })))
      .sort((x, y) => x.d.localeCompare(y.d) || x.km - y.km);
    for (let i = 1; i < kms.length; i++) {
      if (kms[i].km < kms[i - 1].km - 50) {
        add({ id: 'km-data', level: 'data', title: 'Kilométrage incohérent',
          text: `Le ${kms[i].src} du ${kms[i].d} (${nf(kms[i].km)} km) est inférieur à celui du ${kms[i - 1].d} (${nf(kms[i - 1].km)} km). Corrige la saisie pour garder des échéances justes.` });
        break;
      }
    }

    const order = { bad: 0, warn: 1, data: 2, info: 3 };
    return out.sort((x, y) => order[x.level] - order[y.level]);
  }

  return { compute, expectedConso, measuredKmPerMonth };
});
