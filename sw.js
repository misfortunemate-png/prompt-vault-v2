const CACHE = 'pv-v2.2';
const ASSETS = ['./', './index.html', './manifest.json', './icon.svg',
  './js/app.js', './js/db.js', './js/utils.js', './js/state.js',
  './js/prompts.js', './js/viewer.js', './js/catalog.js', './js/settings.js', './js/dict.js'];
const FONT_ORIGINS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (FONT_ORIGINS.some(o => u.origin === o)) {
    e.respondWith(caches.match(e.request).then(c => c || fetch(e.request).then(r => { caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r; })));
    return;
  }
  if (u.origin === location.origin) {
    e.respondWith(caches.match(e.request).then(c => c || fetch(e.request)));
  }
});
