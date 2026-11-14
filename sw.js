/* Service worker : hors-ligne + notifications en arrière-plan (Android, appli installée) */
const CACHE = 'carnet-auto-v5';
const ASSETS = ['./', 'index.html', 'styles.css', 'core.js', 'app.js', 'tech-presets.js', 'advice.js', 'demarrage-vel-satis.json', 'manifest.webmanifest', 'icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== 'carnet-auto-state').map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Réseau d'abord (pour récupérer les mises à jour), cache en secours
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    // no-store : contourne le cache HTTP de GitHub Pages (10 min) pour toujours avoir la dernière version
    fetch(e.request, { cache: 'no-store' }).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});

async function backgroundCheck() {
  const c = await caches.open('carnet-auto-state');
  const res = await c.match('./__summary');
  if (!res) return;
  const s = await res.json();
  const today = new Date().toISOString().slice(0, 10);
  const last = await c.match('./__lastnotif');
  if (last && (await last.text()) === today) return;
  if (!s.msgs || !s.msgs.length) return;
  await c.put('./__lastnotif', new Response(today));
  await self.registration.showNotification('🚗 ' + (s.car || 'Ma voiture'), { body: s.msgs.join('\n'), icon: 'icon.svg', tag: 'carnet-auto' });
}
self.addEventListener('periodicsync', (e) => { if (e.tag === 'carnet-check') e.waitUntil(backgroundCheck()); });

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cl) => (cl[0] ? cl[0].focus() : self.clients.openWindow('./'))));
});
