/* Carnet de Bar — stock relevé sur les photos du bar (17/11/2026).
   Quantités en BOUTEILLES (décimales = bouteille entamée, niveau estimé à l'œil).
   Prix d'achat HT INDICATIFS : à remplacer par ceux des factures.
   Le fond des étagères est un miroir : quantités marquées « à vérifier » à recompter. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BarPhotoStock = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const DATE = '2026-11-17';
  // [id, nom, catégorie, unité, conditionnement, contenance, prix HT, % perte, fournisseur, quantité (bouteilles), à vérifier ?]
  // Les id « p-… » déjà présents dans la carte de départ sont remplacés par ta marque (les recettes suivent).
  const P = [
    // Spiritueux
    ['rhum', 'Rhum Bacardi Carta Oro 70 cl', 'spiritueux', 'cl', 'bouteille 70 cl', 70, 13, 2, 'Grossiste boissons', 2.8],
    ['vodka', 'Vodka Smirnoff 70 cl', 'spiritueux', 'cl', 'bouteille 70 cl', 70, 12, 2, 'Grossiste boissons', 1.8],
    ['eristoff', 'Vodka Eristoff 70 cl', 'spiritueux', 'cl', 'bouteille 70 cl', 70, 11, 2, 'Grossiste boissons', 1, true],
    ['gin', 'Gin Gordon\'s 70 cl', 'spiritueux', 'cl', 'bouteille 70 cl', 70, 14, 2, 'Grossiste boissons', 2.8, true],
    ['tequila', 'Tequila Tiscaz Blanco 70 cl', 'spiritueux', 'cl', 'bouteille 70 cl', 70, 12, 2, 'Grossiste boissons', 2, true],
    ['whisky', 'Whiskey Jack Daniel\'s 70 cl', 'spiritueux', 'cl', 'bouteille 70 cl', 70, 21, 2, 'Grossiste boissons', 1],
    ['bourbon', 'Bourbon Bulleit 70 cl', 'spiritueux', 'cl', 'bouteille 70 cl', 70, 24, 2, 'Grossiste boissons', 0.4],
    ['kahlua', 'Kahlúa 70 cl', 'spiritueux', 'cl', 'bouteille 70 cl', 70, 14, 1, 'Grossiste boissons', 0.9, true],
    ['baileys', 'Baileys 70 cl', 'spiritueux', 'cl', 'bouteille 70 cl', 70, 14, 1, 'Grossiste boissons', 1],
    ['disaronno', 'Disaronno 70 cl', 'spiritueux', 'cl', 'bouteille 70 cl', 70, 17, 1, 'Grossiste boissons', 2, true],
    ['limoncello', 'Limoncello della Riviera 70 cl', 'spiritueux', 'cl', 'bouteille 70 cl', 70, 9, 1, 'Grossiste boissons', 2],
    ['campari', 'Campari 1 L', 'spiritueux', 'cl', 'bouteille 1 L', 100, 17, 1, 'Grossiste boissons', 4.8, true],
    ['aperol', 'Apérol 1 L', 'spiritueux', 'cl', 'bouteille 1 L', 100, 15, 1, 'Grossiste boissons', 3.3, true],
    ['sarti', 'Sarti Rosa 70 cl', 'spiritueux', 'cl', 'bouteille 70 cl', 70, 15, 1, 'Grossiste boissons', 2, true],
    ['martini', 'Martini Bianco 1 L', 'spiritueux', 'cl', 'bouteille 1 L', 100, 9, 1, 'Grossiste boissons', 1.7, true],
    ['martini-rosso', 'Martini Rosso 1 L', 'spiritueux', 'cl', 'bouteille 1 L', 100, 9, 1, 'Grossiste boissons', 1, true],
    ['pastis', 'Ricard 1 L', 'spiritueux', 'cl', 'bouteille 1 L', 100, 19, 1, 'Grossiste boissons', 2, true],
    ['fernet', 'Fernet-Branca 70 cl', 'spiritueux', 'cl', 'bouteille 70 cl', 70, 16, 1, 'Grossiste boissons', 1],
    ['martini-rosato', 'Martini Rosato 1 L', 'spiritueux', 'cl', 'bouteille 1 L', 100, 9, 1, 'Grossiste boissons', 0.6],
    ['cassis', 'Crème de cassis 70 cl', 'spiritueux', 'cl', 'bouteille 70 cl', 70, 8, 1, 'Grossiste boissons', 0.7],
    // Vins
    ['vin-rouge', 'Valpolicella 75 cl', 'vin', 'cl', 'bouteille 75 cl', 75, 6.5, 3, 'Caviste', 3, true],
    ['montepulciano', 'Montepulciano d\'Abruzzo 75 cl', 'vin', 'cl', 'bouteille 75 cl', 75, 7, 3, 'Caviste', 3, true],
    ['vin-blanc', 'Garganega Gentili 75 cl', 'vin', 'cl', 'bouteille 75 cl', 75, 6, 3, 'Caviste', 1, true],
    ['lambrusco', 'Lambrusco (rosé doux) 75 cl', 'vin', 'cl', 'bouteille 75 cl', 75, 3.5, 3, 'Caviste', 4],
    ['prosecco', 'Prosecco DOC Treviso brut 75 cl', 'vin', 'cl', 'bouteille 75 cl', 75, 6, 5, 'Caviste', 3, true],
    // Bières & softs
    ['biere-btl', 'Birra Moretti 33 cl', 'bouteille', 'piece', 'pack 24', 24, 24, 0, 'Grossiste boissons', 8 / 24, true],
    ['estathe', 'Estathé citron (bouteille verre)', 'soft', 'piece', 'pack 24', 24, 21.6, 0, 'Grossiste boissons', 22 / 24],
    ['sirop', 'Sirops Teisseire 70 cl (menthe, fraise, grenadine, violette ×2, kiwi ×2, cassis, pêche)', 'soft', 'cl', 'bouteille 70 cl', 70, 5, 2, 'Grossiste boissons', 9, true],
    ['rioba', 'Sirops Rioba 1 L (orgeat, fruits rouges)', 'soft', 'cl', 'bouteille 1 L', 100, 4.5, 2, 'Grossiste boissons', 1.6],
    ['jucci', 'Jus de citron Teisseire Jucci', 'soft', 'cl', 'bouteille 70 cl', 70, 6, 2, 'Grossiste boissons', 1.6, true],
    ['sucre-canne', 'Sirop de sucre de canne Teisseire 70 cl', 'soft', 'cl', 'bouteille 70 cl', 70, 4, 2, 'Grossiste boissons', 0.8],
    ['tonic', 'Tonic 1 L (pack de 6)', 'soft', 'cl', 'pack 6 × 1 L', 600, 4.8, 3, 'Grossiste boissons', 1],
    // Snacks
    ['chips', 'Chips Lay\'s à l\'ancienne nature 130 g', 'snack', 'piece', 'carton 10 × 130 g', 10, 14, 0, 'Grossiste', 0.6, true],
  ];
  // Articles de la carte : [id, nom, catégorie, prix TTC, recette]. Ceux qui existent déjà sont seulement renommés.
  const I = [
    ['rhum', 'Rhum Bacardi Carta Oro 4 cl', 'spiritueux', 6, [['rhum', 4]]],
    ['vodka', 'Vodka Smirnoff 4 cl', 'spiritueux', 6, [['vodka', 4]]],
    ['gin', 'Gin Gordon\'s 4 cl', 'spiritueux', 7, [['gin', 4]]],
    ['whisky', 'Whiskey Jack Daniel\'s 4 cl', 'spiritueux', 8, [['whisky', 4]]],
    ['bourbon', 'Bourbon Bulleit 4 cl', 'spiritueux', 8, [['bourbon', 4]]],
    ['tequila', 'Tequila 4 cl', 'spiritueux', 6, [['tequila', 4]]],
    ['kahlua', 'Kahlúa 4 cl', 'spiritueux', 6, [['kahlua', 4]]],
    ['baileys', 'Baileys 4 cl', 'spiritueux', 6, [['baileys', 4]]],
    ['disaronno', 'Disaronno 4 cl', 'spiritueux', 7, [['disaronno', 4]]],
    ['limoncello', 'Limoncello 4 cl', 'spiritueux', 4, [['limoncello', 4]]],
    ['campari', 'Campari 4 cl', 'spiritueux', 5, [['campari', 4]]],
    ['martini', 'Martini Bianco 6 cl', 'spiritueux', 4.5, [['martini', 6]]],
    ['martini-rosso', 'Martini Rosso 6 cl', 'spiritueux', 4.5, [['martini-rosso', 6]]],
    ['martini-rosato', 'Martini Rosato 6 cl', 'spiritueux', 4.5, [['martini-rosato', 6]]],
    ['ricard', 'Ricard 2 cl', 'spiritueux', 3, [['pastis', 2]]],
    ['fernet', 'Fernet-Branca 4 cl', 'spiritueux', 6, [['fernet', 4]]],
    ['chips', 'Chips Lay\'s 130 g', 'snack', 4.5, [['chips', 1]]],
    ['sarti', 'Sarti Rosa 6 cl', 'spiritueux', 5, [['sarti', 6]]],
    ['btl', 'Birra Moretti 33 cl', 'bouteille', 5, [['biere-btl', 1]]],
    ['verre-rouge', 'Verre de Valpolicella 12 cl', 'vin', 4.5, [['vin-rouge', 12]]],
    ['btl-rouge', 'Bouteille de Valpolicella 75 cl', 'vin', 22, [['vin-rouge', 75]]],
    ['verre-montepulciano', 'Verre de Montepulciano 12 cl', 'vin', 5, [['montepulciano', 12]]],
    ['verre-blanc', 'Verre de Garganega 12 cl', 'vin', 4.5, [['vin-blanc', 12]]],
    ['verre-lambrusco', 'Verre de Lambrusco 12 cl', 'vin', 4, [['lambrusco', 12]]],
    ['verre-prosecco', 'Verre de Prosecco 12 cl', 'vin', 5, [['prosecco', 12]]],
    ['estathe', 'Estathé citron', 'soft', 3.5, [['estathe', 1]]],
  ];
  function build() {
    const products = P.map(([id, name, category, unit, packLabel, packSize, packPrice, lossPct, supplier, qty, check]) => ({
      id: 'p-' + id, name, category, unit, packLabel, packSize, packPrice, lossPct, supplier, active: true,
      minStock: unit === 'cl' ? packSize : Math.ceil(packSize / 2), parStock: unit === 'cl' ? packSize * 3 : packSize * 2,
      _qty: Math.round(qty * packSize * 100) / 100, _check: !!check,
    }));
    const items = I.map(([id, name, category, price, recipe], n) => ({
      id: 'm-' + id, name, category, price, pos: 100 + n, active: true,
      recipe: recipe.map(([pid, q]) => ({ productId: 'p-' + pid, qty: q })),
    }));
    return { date: DATE, products, items };
  }
  return { build, DATE };
});
