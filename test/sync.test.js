// Prova della sincronizzazione: due (poi tre) telefoni simulati con un finto server.
process.env.TZ = 'Europe/Rome';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const js = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
const m = /\/\* =+ PURE =+ \*\/([\s\S]*?)\/\* =+ END PURE =+ \*\//.exec(js);
const A_ = new Function(m[1] + '\nreturn {seedState,normState,derive,canon,hashStr,entita,syncDiff,syncApply,splitShares,normEnt};')();
const { seedState, derive, canon, hashStr, entita, syncDiff, syncApply, normEnt } = A_;

// impronta canonica: l'ordine delle chiavi non conta
assert.strictEqual(canon({ b: 1, a: [1, { d: 2, c: 3 }] }), canon({ a: [1, { c: 3, d: 2 }], b: 1 }));
assert.notStrictEqual(hashStr(canon({ a: 1 })), hashStr(canon({ a: 2 })));

// finto server: ultimo che scrive vince (come Firestore), con un contatore come ora del server
function Server() {
  this.docs = {};
  this.clock = 0;
}
Server.prototype.write = function (key, d) {
  this.docs[key] = Object.assign({ key }, d, { s: ++this.clock });
};
Server.prototype.since = function (c) {
  return Object.values(this.docs)
    .filter((d) => d.s > c)
    .sort((a, b) => a.s - b.s);
};

let clock = Date.parse('2026-11-01T00:00:00Z'); // dopo l'azzeramento dei voti della 0.6.0
const tick = (n) => (clock += n || 1000);
function Phone(dev, S) {
  this.dev = dev;
  this.S = S;
  this.SY = { cursor: 0, init: false, ent: {} };
  this.online = true;
  this.coda = [];
}
Phone.prototype.push = function (srv) {
  if (!this.SY.init) return 0;
  const w = syncDiff(this.S, this.SY);
  w.forEach((x) => {
    const prev = this.SY.ent[x.key];
    const u = Math.max(clock, prev ? prev[0] + 1 : 0);
    this.SY.ent[x.key] = [u, x.h, 0];
    if (this.online) {
      srv.write(x.key, { c: x.c, i: x.i, j: x.j, u, by: this.dev });
      this.SY.ent[x.key][2] = 1;
    }
  });
  return w.length;
};
Phone.prototype.pull = function (srv) {
  if (!this.online) return false;
  const ch = srv.since(this.SY.cursor);
  const init = !this.SY.init;
  const changed = syncApply(this.S, ch, this.SY, init);
  ch.forEach((c) => {
    if (c.s > this.SY.cursor) this.SY.cursor = c.s;
  });
  this.SY.init = true;
  return changed;
};
Phone.prototype.giro = function (srv) {
  this.pull(srv);
  this.push(srv);
  this.pull(srv);
};
const uguali = (a, b) => {
  // stessa sostanza: confronto le entità normalizzate (un campo vuoto mancante non è una differenza)
  const fa = entita(a.S)
    .map((x) => x.k + '=' + canon(normEnt(x.c, JSON.parse(JSON.stringify(x.e)))))
    .sort();
  const fb = entita(b.S)
    .map((x) => x.k + '=' + canon(normEnt(x.c, JSON.parse(JSON.stringify(x.e)))))
    .sort();
  assert.deepStrictEqual(fa, fb);
  assert.deepStrictEqual(derive(a.S), derive(b.S));
};

const srv = new Server();
// il telefono del locale ha già dei dati prima di collegarsi
const A = new Phone('A', seedState(1));
const birra = A.S.products.find((p) => p.name === 'Birra');
birra.price = 150;
A.S.moves.push({ id: 'm1', t: tick(), k: 'tab', p: 'pesce', a: 300, items: [{ id: birra.id, n: 'Birra', q: 2, pr: 150 }] });
A.S.cfg.voteCut = 5;
A.giro(srv);
assert.ok(Object.keys(srv.docs).length >= 30, 'il primo telefono carica tutto');

// un telefono nuovo con i dati di partenza NON deve sovrascrivere quelli del locale
const B = new Phone('B', seedState(2));
B.S.cfg.voteCut = 6;
tick();
B.giro(srv);
assert.strictEqual(B.S.products.find((p) => p.name === 'Birra').price, 150, 'vince il prezzo del locale, non quello di partenza');
assert.strictEqual(B.S.cfg.voteCut, 5, 'vincono le regole del locale');
assert.strictEqual(derive(B.S).debt.pesce, 300);
A.giro(srv);
uguali(A, B);
assert.strictEqual(B.push(srv), 0, 'dopo l’unione non c’è niente da rimandare');
assert.strictEqual(A.push(srv), 0);

// B segna un pagamento, A lo riceve
tick();
B.S.moves.push({ id: 'm2', t: clock, k: 'pay', p: 'pesce', a: 100, note: '' });
B.giro(srv);
A.giro(srv);
assert.strictEqual(derive(A.S).debt.pesce, 200);
assert.strictEqual(derive(A.S).cash, 100);
uguali(A, B);

// A annulla il pagamento (x), B lo vede annullato
tick();
A.S.moves.find((mv) => mv.id === 'm2').x = { t: clock };
A.giro(srv);
B.giro(srv);
assert.strictEqual(derive(B.S).debt.pesce, 300);
uguali(A, B);

// modifica contemporanea dello stesso prodotto: vince la più recente, su tutti e due
tick();
A.S.products.find((p) => p.id === birra.id).price = 160;
A.push(srv);
tick();
B.S.products.find((p) => p.id === birra.id).price = 170;
B.push(srv);
A.giro(srv);
B.giro(srv);
A.giro(srv);
assert.strictEqual(A.S.products.find((p) => p.id === birra.id).price, 170);
uguali(A, B);

// voto con id fisso: stesso votante, stessa serata → un solo voto, l'ultimo
tick();
A.S.votes.push({ id: 'v2026-10-12_pj', s: '2026-10-12', v: 'pj', c: 'pesce', t: clock });
A.push(srv);
tick();
B.S.votes.push({ id: 'v2026-10-12_pj', s: '2026-10-12', v: 'pj', c: 'conti', t: clock });
B.push(srv);
A.giro(srv);
B.giro(srv);
A.giro(srv);
assert.strictEqual(A.S.votes.length, 1);
assert.strictEqual(A.S.votes[0].c, 'conti');
uguali(A, B);

// cancellazione (annulla del toast): lapide, sparisce anche dall'altro
tick();
A.S.votes.splice(0, 1);
A.giro(srv);
B.giro(srv);
assert.strictEqual(B.S.votes.length, 0);
uguali(A, B);
// e si può rivotare: la nuova versione batte la lapide
tick();
B.S.votes.push({ id: 'v2026-10-12_pj', s: '2026-10-12', v: 'pj', c: 'chicco', t: clock });
B.giro(srv);
A.giro(srv);
assert.strictEqual(A.S.votes.length, 1);
assert.strictEqual(A.S.votes[0].c, 'chicco');

// senza rete: B segna offline, poi torna online e manda tutto
B.online = false;
tick();
B.S.moves.push({ id: 'm3', t: clock, k: 'tab', p: 'pj', a: 100, items: [{ n: 'Mars', q: 1, pr: 100 }] });
B.push(srv);
B.pull(srv);
assert.ok(
  Object.values(B.SY.ent).some((e) => !e[2]),
  'resta in coda finché non torna la rete'
);
A.giro(srv);
assert.ok(!A.S.moves.some((mv) => mv.id === 'm3'));
B.online = true;
B.giro(srv);
A.giro(srv);
assert.ok(A.S.moves.some((mv) => mv.id === 'm3'));
uguali(A, B);

// partita a freccette seguita da due telefoni
tick();
const g = { id: 'g1', t: clock, mode: '301', players: ['pj', 'pesce'], d: ['T20'], end: 0 };
A.S.games.push(g);
A.giro(srv);
B.giro(srv);
B.S.games[0].d.push('T20');
tick();
B.giro(srv);
A.giro(srv);
assert.deepStrictEqual(A.S.games[0].d, ['T20', 'T20']);
uguali(A, B);

// un terzo telefono che arriva dopo trova tutto uguale
const C = new Phone('C', seedState(3));
tick();
C.giro(srv);
uguali(A, C);
assert.strictEqual(C.push(srv), 0);

// dati sporchi dal server non rompono nulla
syncApply(
  C.S,
  [
    { key: 'moves~x', c: 'moves', i: 'x', j: '{rotto', u: clock + 5, s: 999 },
    { key: 'boh~1', c: 'boh', i: '1', j: '{}', u: 1, s: 1000 },
    null,
  ],
  C.SY,
  false
);
assert.ok(!C.S.moves.some((mv) => mv.id === 'x'));
// un movimento normalizzato diversamente (note vuota) non fa rimbalzare le scritture
tick();
A.S.moves.push({ id: 'm4', t: clock, k: 'dplus', p: 'conti', a: 200, note: '' });
A.giro(srv);
B.giro(srv);
C.giro(srv);
assert.strictEqual(B.push(srv) + C.push(srv) + A.push(srv), 0, 'niente ping-pong per differenze di forma');
assert.deepStrictEqual(derive(A.S), derive(B.S));

console.log('sincronizzazione: tutto torna (' + Object.keys(srv.docs).length + ' documenti sul finto server, 3 telefoni allineati)');
