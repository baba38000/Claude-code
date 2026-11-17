/* Carnet de Bar — carte de départ : doses bar standard + prix d'achat INDICATIFS (à remplacer par tes factures). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BarStarter = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // [id, nom, catégorie, unité, conditionnement, contenance (unités de base), prix HT du conditionnement, % perte, fournisseur]
  const P = [
    ['biere-fut', 'Bière blonde pression', 'pression', 'cl', 'fût 30 L', 3000, 80, 6, 'Brasseur'],
    ['biere-btl', 'Bière bouteille 33 cl', 'bouteille', 'piece', 'pack 24', 24, 26, 0, 'Grossiste boissons'],
    ['vin-rouge', 'Vin rouge (verre / bouteille)', 'vin', 'cl', 'bouteille 75 cl', 75, 6.5, 3, 'Caviste'],
    ['vin-blanc', 'Vin blanc', 'vin', 'cl', 'bouteille 75 cl', 75, 6, 3, 'Caviste'],
    ['vin-rose', 'Vin rosé', 'vin', 'cl', 'bouteille 75 cl', 75, 5.5, 3, 'Caviste'],
    ['pastis', 'Pastis (Ricard)', 'spiritueux', 'cl', 'bouteille 1 L', 100, 19, 1, 'Grossiste boissons'],
    ['martini', 'Martini Bianco / Rosso', 'spiritueux', 'cl', 'bouteille 1 L', 100, 9, 1, 'Grossiste boissons'],
    ['cassis', 'Crème de cassis', 'spiritueux', 'cl', 'bouteille 70 cl', 70, 8, 1, 'Grossiste boissons'],
    ['vodka', 'Vodka', 'spiritueux', 'cl', 'bouteille 70 cl', 70, 14, 2, 'Grossiste boissons'],
    ['rhum', 'Rhum blanc', 'spiritueux', 'cl', 'bouteille 70 cl', 70, 13, 2, 'Grossiste boissons'],
    ['gin', 'Gin', 'spiritueux', 'cl', 'bouteille 70 cl', 70, 17, 2, 'Grossiste boissons'],
    ['whisky', 'Whisky', 'spiritueux', 'cl', 'bouteille 70 cl', 70, 18, 2, 'Grossiste boissons'],
    ['aperol', 'Apérol', 'spiritueux', 'cl', 'bouteille 70 cl', 70, 12, 1, 'Grossiste boissons'],
    ['prosecco', 'Prosecco', 'vin', 'cl', 'bouteille 75 cl', 75, 6, 5, 'Caviste'],
    ['coca', 'Coca-Cola 33 cl (verre)', 'soft', 'piece', 'pack 24', 24, 17, 0, 'Grossiste boissons'],
    ['tonic', 'Tonic 20 cl', 'soft', 'piece', 'pack 24', 24, 12, 0, 'Grossiste boissons'],
    ['jus-orange', 'Jus d\'orange', 'soft', 'cl', 'carton 6 × 1 L', 600, 9, 3, 'Grossiste boissons'],
    ['limonade', 'Limonade', 'soft', 'cl', 'bouteille 1,5 L', 150, 1.2, 5, 'Grossiste boissons'],
    ['sirop', 'Sirops (grenadine, menthe…)', 'soft', 'cl', 'bouteille 70 cl', 70, 5, 2, 'Grossiste boissons'],
    ['eau-gaz', 'Eau gazeuse', 'soft', 'cl', 'bouteille 1 L', 100, 0.6, 5, 'Grossiste boissons'],
    ['sucre-canne', 'Sirop de sucre de canne', 'soft', 'cl', 'bouteille 70 cl', 70, 4, 2, 'Grossiste boissons'],
    ['citron-vert', 'Citron vert', 'autre', 'piece', 'filet de 12', 12, 3, 10, 'Primeur'],
    ['menthe', 'Menthe fraîche (botte)', 'autre', 'piece', 'botte', 1, 1.2, 20, 'Primeur'],
    ['cafe', 'Café en grains', 'chaud', 'g', 'paquet 1 kg', 1000, 18, 3, 'Torréfacteur'],
  ];
  // [id, nom, catégorie, prix TTC, [[produit, dose], …]]
  const I = [
    ['demi', 'Demi pression 25 cl', 'pression', 3.5, [['biere-fut', 25]]],
    ['pinte', 'Pinte pression 50 cl', 'pression', 6.5, [['biere-fut', 50]]],
    ['btl', 'Bière bouteille 33 cl', 'bouteille', 5, [['biere-btl', 1]]],
    ['verre-rouge', 'Verre de rouge 12 cl', 'vin', 4.5, [['vin-rouge', 12]]],
    ['verre-blanc', 'Verre de blanc 12 cl', 'vin', 4.5, [['vin-blanc', 12]]],
    ['verre-rose', 'Verre de rosé 12 cl', 'vin', 4.5, [['vin-rose', 12]]],
    ['btl-rouge', 'Bouteille de rouge 75 cl', 'vin', 22, [['vin-rouge', 75]]],
    ['kir', 'Kir 12 cl (10 cl blanc + 2 cl cassis)', 'vin', 4, [['vin-blanc', 10], ['cassis', 2]]],
    ['ricard', 'Pastis / Ricard 2 cl', 'spiritueux', 3, [['pastis', 2]]],
    ['martini', 'Martini 6 cl', 'spiritueux', 4.5, [['martini', 6]]],
    ['vodka', 'Vodka 4 cl', 'spiritueux', 6, [['vodka', 4]]],
    ['rhum', 'Rhum 4 cl', 'spiritueux', 6, [['rhum', 4]]],
    ['gin', 'Gin 4 cl', 'spiritueux', 7, [['gin', 4]]],
    ['whisky', 'Whisky 4 cl', 'spiritueux', 8, [['whisky', 4]]],
    ['coca', 'Coca-Cola 33 cl', 'soft', 4, [['coca', 1]]],
    ['jus', 'Jus d\'orange 25 cl', 'soft', 4, [['jus-orange', 25]]],
    ['limo', 'Limonade 25 cl', 'soft', 3, [['limonade', 25]]],
    ['sirop-eau', 'Sirop à l\'eau (3 cl)', 'soft', 2, [['sirop', 3]]],
    ['diabolo', 'Diabolo (3 cl sirop + 22 cl limonade)', 'soft', 3.5, [['sirop', 3], ['limonade', 22]]],
    ['cafe', 'Café (7 g)', 'chaud', 1.8, [['cafe', 7]]],
  ];
  function build() {
    const products = P.map(([id, name, category, unit, packLabel, packSize, packPrice, lossPct, supplier]) => ({
      id: 'p-' + id, name, category, unit, packLabel, packSize, packPrice, lossPct, supplier,
      stock: 0, minStock: unit === 'cl' ? packSize : Math.ceil(packSize / 2), parStock: packSize * 2, active: true, priceHistory: [],
    }));
    const items = I.map(([id, name, category, price, recipe], pos) => ({
      id: 'm-' + id, name, category, price, pos, active: true,
      recipe: recipe.map(([pid, qty]) => ({ productId: 'p-' + pid, qty })),
    }));
    return { products, items };
  }
  return { build };
});
