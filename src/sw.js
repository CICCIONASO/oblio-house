/* The Oblio House: funziona senza rete dopo la prima apertura. */
const VERSIONE = '__VERSIONE__';
const CACHE = 'oblio-' + VERSIONE;
const FONT_CSS = '__FONT_CSS__';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'].concat(__IMMAGINI__);
const ESTERNI = __ESTERNI__; // libreria di sincronizzazione, se attiva
const PROPRI = new Set(FILES.map((f) => new URL(f, self.registration.scope).pathname));

async function caricaFont(cache) {
  try {
    const r = await fetch(FONT_CSS);
    if (!r.ok) return;
    await cache.put(FONT_CSS, r.clone());
    const css = await r.text();
    const urls = Array.from(css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)).map((m) => m[1]);
    await Promise.all(urls.map((u) => fetch(u, { mode: 'cors' }).then((x) => (x.ok ? cache.put(u, x) : null)).catch(() => null)));
  } catch (e) { /* senza rete: i caratteri arriveranno alla prossima apertura online */ }
}
async function caricaEsterni(cache) {
  await Promise.all(ESTERNI.map((u) => fetch(u, { mode: 'cors' }).then((x) => (x.ok ? cache.put(u, x) : null)).catch(() => null)));
}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES).then(() => Promise.all([caricaFont(c), caricaEsterni(c)]))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('oblio-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  const sdk = url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/');
  const proprio = url.origin === self.location.origin && (req.mode === 'navigate' || PROPRI.has(url.pathname));
  // tutto il resto (database, prove) passa diretto in rete
  if (!font && !sdk && !proprio) return;
  e.respondWith(caches.open(CACHE).then((c) => c.match(req, { ignoreSearch: proprio, ignoreVary: true }).then((hit) => {
    const net = fetch(req).then((r) => {
      if (r && r.ok) c.put(req, r.clone());
      return r;
    }).catch(() => hit || (req.mode === 'navigate' ? c.match('./index.html') : Response.error()));
    return hit || net;
  })));
});
