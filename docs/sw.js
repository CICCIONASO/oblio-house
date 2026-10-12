/* The Oblio House: funziona senza rete dopo la prima apertura. */
const VERSIONE = '0.7.0-mv5vf57o';
const CACHE = 'oblio-' + VERSIONE;
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+Condensed:wght@600;700&family=Shrikhand&display=swap';
const FILES = ['./', './index.html', './guida.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './ocr/lettore.js'].concat(["./img/c1-viso.jpg","./img/c1.jpg","./img/c2-viso.jpg","./img/c2.jpg","./img/c3-viso.jpg","./img/c3.jpg","./img/c4-viso.jpg","./img/c4.jpg","./img/c5-viso.jpg","./img/c5.jpg","./img/c6-viso.jpg","./img/c6.jpg"]);
const ESTERNI = ["https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js","https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"]; // libreria di sincronizzazione, se attiva
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
  // { cache: 'reload' }: all'installazione prendo i file veri dalla rete, mai copie vecchie della cache del browser
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))).then(() => Promise.all([caricaFont(c), caricaEsterni(c)]))).then(() => self.skipWaiting()));
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
    const net = (proprio ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req)).then((r) => {
      if (r && r.ok) c.put(proprio ? req.url.split('?')[0].split('#')[0] : req, r.clone());
      return r;
    }).catch(() => hit || (req.mode === 'navigate' ? c.match('./index.html') : Response.error()));
    return hit || net;
  })));
});
