// Carica il blocco PURE di src/app.js come faceva new Function(blocco + 'return {...}'), ma da un file vero,
// .copertura/app.js, con il blocco sulle stesse righe dell'originale: così `npm run coverage` misura le righe
// di src/app.js che le prove fanno girare. Ogni chiamata rifà il blocco da capo, con il suo stato.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src', 'app.js');
const OUT = path.join(__dirname, '..', '.copertura', 'app.js');
let fabbrica = null;

function prepara() {
  const js = fs.readFileSync(SRC, 'utf8');
  const m = /\/\* =+ PURE =+ \*\/([\s\S]*?)\/\* =+ END PURE =+ \*\//.exec(js);
  if (!m) throw new Error('blocco PURE non trovato');
  const riga = js.slice(0, m.index).split('\n').length; // riga di src/app.js dove inizia il blocco
  const testo = 'module.exports = function (__ritorno) {' + '\n'.repeat(riga - 1) + m[1] + '\nreturn eval(__ritorno);\n};\n';
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  if (!fs.existsSync(OUT) || fs.readFileSync(OUT, 'utf8') !== testo) fs.writeFileSync(OUT, testo);
  return require(OUT);
}

// ritorno: l'espressione da restituire, per esempio '{parseEur,derive}' oppure 'VOTI_DAL'
module.exports = function pure(ritorno) {
  if (!fabbrica) fabbrica = prepara();
  return fabbrica('(' + ritorno + '\n)');
};
