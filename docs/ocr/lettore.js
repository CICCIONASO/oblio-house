/* The Oblio House · lettore di scontrini. Gira in un worker e legge la foto sul telefono, senza servizi esterni.
   Motore: Tesseract compilato in WebAssembly (tesseract.js-core 6.1.2, licenza Apache-2.0) e modello italiano
   «4.0.0_best_int» (tessdata, licenza Apache-2.0): le licenze sono in questa cartella.
   I file si scaricano dal sito la prima volta e restano nella cache «lettore-ocr-1»: dopo funziona anche senza rete. */
'use strict';
var CACHE = 'lettore-ocr-1';
var api = null, M = null, avvio = null;

function simd() {   // stessa prova di wasm-feature-detect: i telefoni con SIMD leggono circa il doppio più in fretta
  try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); } catch (e) { return false; }
}
function prendi(nome) {   // prima la cache, poi la rete (e la copia resta per le volte dopo)
  var url = new URL(nome, self.location.href).href, cache = null;
  var apri = self.caches ? caches.open(CACHE).then(function (c) { cache = c; return c.match(url); }).catch(function () { return null; }) : Promise.resolve(null);
  return apri.then(function (r) {
    if (r) return r.arrayBuffer();
    return fetch(url).then(function (r2) {
      if (!r2.ok) throw new Error('scaricando ' + nome + ' (' + r2.status + ')');
      if (cache) cache.put(url, r2.clone()).catch(function () {});
      return r2.arrayBuffer();
    });
  });
}
function gunzip(buf) {
  if (typeof DecompressionStream === 'undefined') throw new Error('questo telefono è troppo vecchio per il lettore');
  return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}
function avvia() {
  if (avvio) return avvio;
  var base = simd() ? 'tesseract-core-simd-lstm' : 'tesseract-core-lstm', fatti = 0;
  function passo(b) { fatti++; postMessage({ t: 'carico', p: fatti / 3 }); return b; }
  avvio = Promise.all([prendi(base + '.js').then(passo), prendi(base + '.wasm').then(passo), prendi('ita.traineddata.gz').then(gunzip).then(passo)])
    .then(function (x) {
      var url = URL.createObjectURL(new Blob([x[0]], { type: 'text/javascript' }));
      try { importScripts(url); } finally { URL.revokeObjectURL(url); }
      return self.TesseractCore({
        wasmBinary: x[1],
        TesseractProgress: function (p) { postMessage({ t: 'leggo', p: Math.max(0, Math.min(1, (p - 30) / 70)) }); }
      }).then(function (mod) {
        M = mod;
        M.FS.writeFile('ita.traineddata', new Uint8Array(x[2]));
        M.FS.writeFile('ita.special-words', '');   // file facoltativo che Tesseract cerca comunque: vuoto, niente errori in console
        api = new M.TessBaseAPI();
        if (api.Init(null, 'ita', 1) === -1) throw new Error('il modello italiano non si apre');   // 1 = solo LSTM
        api.SetVariable('tessedit_pageseg_mode', '6');   // un blocco unico: descrizione e prezzo restano sulla stessa riga
        api.SetVariable('preserve_interword_spaces', '1');
        api.SetVariable('user_defined_dpi', '300');
      });
    });
  avvio.catch(function () { avvio = null; });   // se manca la rete, si riprova la volta dopo
  return avvio;
}
function leggi(png, opz) {
  if (opz && opz.soglia != null) api.SetVariable('thresholding_method', String(opz.soglia));
  M.FS.writeFile('/input', new Uint8Array(png));
  if (api.SetImageFile(1, 0) === 1) throw new Error('la foto non si apre');
  api.Recognize(null);
  return { testo: api.GetUTF8Text(), conf: api.MeanTextConf() };
}
// le versioni vecchie del lettore lasciano la loro cache: la tolgo
if (self.caches) caches.keys().then(function (ks) { ks.forEach(function (k) { if (k.indexOf('lettore-ocr-') === 0 && k !== CACHE) caches.delete(k); }); }).catch(function () {});
self.onmessage = function (e) {
  var m = e.data || {};
  if (m.t !== 'leggi') return;
  avvia().then(function () {
    var r = leggi(m.png, m.opz);
    postMessage({ t: 'fatto', id: m.id, testo: r.testo, conf: r.conf });
  }).catch(function (err) {
    postMessage({ t: 'errore', id: m.id, msg: String(err && err.message || err) });
  });
};
