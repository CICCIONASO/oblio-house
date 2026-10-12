/* The Oblio House: funziona senza rete dopo la prima apertura. */
const VERSIONE = '0.3.0-mv5d7dis';
const CACHE = 'oblio-' + VERSIONE;
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+Condensed:wght@600;700&family=Shrikhand&display=swap';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'].concat(["./img/c1-viso.jpg","./img/c1.jpg","./img/c2-viso.jpg","./img/c2.jpg","./img/c3-viso.jpg","./img/c3.jpg","./img/c4-viso.jpg","./img/c4.jpg","./img/c5-viso.jpg","./img/c5.jpg","./img/c6-viso.jpg","./img/c6.jpg"]);

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

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES).then(() => caricaFont(c))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('oblio-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !font) return;
  e.respondWith(caches.open(CACHE).then((c) => c.match(req, { ignoreSearch: !font, ignoreVary: true }).then((hit) => {
    const net = fetch(req).then((r) => {
      if (r && r.ok) c.put(req, r.clone());
      return r;
    }).catch(() => hit || (req.mode === 'navigate' ? c.match('./index.html') : Response.error()));
    return hit || net;
  })));
});
