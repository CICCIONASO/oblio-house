// Prova della sincronizzazione: due (poi tre) telefoni simulati con un finto server.
process.env.TZ = 'Europe/Rome';
const assert = require('assert');
const pure = require('./pure.js');
const A_ = pure(
  `{seedState,normState,derive,canon,hashStr,entita,syncDiff,syncApply,splitShares,normEnt,syncRipara,syncMancanti,SOGLIA_LAPIDI,syncFrena,syncRilascia}`
);
const {
  seedState,
  derive,
  canon,
  hashStr,
  entita,
  syncDiff,
  syncApply,
  normEnt,
  syncRipara,
  syncMancanti,
  SOGLIA_LAPIDI,
  syncFrena,
  syncRilascia,
} = A_;

// impronta canonica: l'ordine delle chiavi non conta
assert.strictEqual(canon({ b: 1, a: [1, { d: 2, c: 3 }] }), canon({ a: [1, { c: 3, d: 2 }], b: 1 }));
assert.notStrictEqual(hashStr(canon({ a: 1 })), hashStr(canon({ a: 2 })));

// finto server: come Firestore con le regole della 0.25.0 (una modifica passa solo se «u» è più recente di quella salvata),
// con un contatore come ora del server
function Server() {
  this.docs = {};
  this.clock = 0;
}
Server.prototype.write = function (key, d) {
  const prima = this.docs[key];
  if (prima && !(d.u > prima.u)) return false; // permesso negato
  this.docs[key] = Object.assign({ key }, d, { s: ++this.clock });
  return true;
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
    if (this.online && srv.write(x.key, { c: x.c, i: x.i, j: x.j, u, by: this.dev })) this.SY.ent[x.key][2] = 1;
  });
  return w.length;
};
Phone.prototype.pull = function (srv) {
  if (!this.online) return false;
  let ch = srv.since(this.SY.cursor);
  const init = !this.SY.init;
  if (!init) ch = syncFrena(this.S, this.SY, ch, SOGLIA_LAPIDI);
  let changed = syncApply(this.S, ch, this.SY, init);
  if (syncRilascia(this.S, this.SY)) changed = true;
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

// protezione dalle cancellazioni a catena (dalla 0.19.0)
{
  const lapidi = (ph) => syncDiff(ph.S, ph.SY).filter((x) => x.j === null).length;
  // poche cose tolte davvero (Annulla, «Preso»): le lapidi partono come sempre
  const copia = JSON.parse(JSON.stringify(C.S.moves));
  C.S.moves.pop();
  assert.strictEqual(syncRipara(C.S, C.SY, SOGLIA_LAPIDI), 0, 'una cancellazione vera non si tocca');
  assert.strictEqual(lapidi(C), 1);
  C.S.moves = copia;
  // il telefono non è riuscito a salvare: tanti movimenti nel registro ma non nei dati
  for (let i = 0; i < 30; i++) A.S.moves.push({ id: 'pr' + i, t: tick(), k: 'dplus', p: 'conti', a: 100, note: 'prova ' + i });
  A.giro(srv);
  C.giro(srv);
  const salvati = C.S.moves.length;
  C.S.moves = C.S.moves.filter((m) => !/^pr/.test(m.id)); // dati vecchi ricaricati dal telefono
  assert.strictEqual(syncMancanti(C.S, C.SY).length, 30);
  assert.strictEqual(syncRipara(C.S, C.SY, SOGLIA_LAPIDI), 30, 'troppe sparite insieme: rilettura');
  assert.strictEqual(C.SY.cursor, 0);
  assert.strictEqual(lapidi(C), 0, 'nessuna lapide parte');
  C.giro(srv);
  assert.strictEqual(C.S.moves.length, salvati, 'i movimenti tornano dal server');
  assert.strictEqual(Object.values(srv.docs).filter((d) => d.j === null && /^moves~pr/.test(d.key)).length, 0);
  uguali(A, C);
  // un telefono che non ha mai fuso col locale non ripara niente
  const E = new Phone('E', seedState(10));
  assert.strictEqual(syncRipara(E.S, E.SY, 0), 0);
}

// due telefoni cambiano insieme la stessa cosa (dalla 0.25.0): nel database resta la versione che vedono i telefoni
{
  const pj = (ph) => ph.S.people.find((p) => p.id === 'pj');
  const t0 = clock;
  pj(A).name = 'PJ di A';
  A.SY.ent['people~pj'] && (A.SY.ent['people~pj'][0] = Math.max(A.SY.ent['people~pj'][0], t0)); // A scrive con l'ora di adesso
  pj(C).name = 'PJ di C';
  clock += 5000; // C ha l'orologio avanti: la sua modifica è «più recente»
  C.push(srv);
  clock -= 5000;
  A.push(srv); // arriva dopo ma è più vecchia: il database la rifiuta
  assert.strictEqual(JSON.parse(srv.docs['people~pj'].j).name, 'PJ di C', 'nel database resta la più recente');
  A.giro(srv);
  C.giro(srv);
  assert.strictEqual(pj(A).name, 'PJ di C');
  assert.strictEqual(pj(C).name, 'PJ di C');
  assert.strictEqual(A.SY.ent['people~pj'][2], 1, 'niente resta in coda');
  uguali(A, C);
}

// freno sulle cancellazioni in arrivo (dalla 0.25.0)
{
  const ids = [];
  for (let i = 0; i < 25; i++) {
    const id = 'fr' + i;
    ids.push(id);
    A.S.moves.push({ id, t: tick(), k: 'sale', p: 'pj', a: 100 });
  }
  A.giro(srv);
  C.giro(srv);
  const n = C.S.moves.length;
  // qualcuno da fuori scrive 25 lapidi
  ids.forEach((id) => srv.write('moves~' + id, { c: 'moves', i: id, j: null, u: tick(), by: 'intruso' }));
  C.giro(srv);
  assert.strictEqual(C.S.moves.length, n, 'le lapidi in massa non si applicano');
  assert.strictEqual(Object.keys(C.SY.lap).length, 25);
  // l'admin rimette i dati: tornano sul database e sugli altri telefoni
  A.giro(srv);
  assert.strictEqual(Object.keys(A.SY.lap).length, 25);
  Object.keys(A.SY.lap).forEach((k) => (A.SY.ent[k][2] = 0));
  delete A.SY.lap;
  tick();
  A.giro(srv);
  C.giro(srv);
  assert.ok(
    ids.every((id) => srv.docs['moves~' + id].j !== null),
    'i dati tornano nel database'
  );
  assert.ok(!C.SY.lap, 'sull’altro telefono non resta niente in attesa');
  assert.strictEqual(C.S.moves.length, n);
  uguali(A, C);
  // poche cancellazioni vere passano come sempre
  A.S.moves = A.S.moves.filter((m) => m.id !== 'fr0' && m.id !== 'fr1');
  tick();
  A.giro(srv);
  C.giro(srv);
  assert.strictEqual(C.S.moves.length, n - 2);
  // ripristino di un backup (o «Cancella davvero»): l'admin le approva con cfg.lapOk e passano ovunque
  A.S.moves = A.S.moves.filter((m) => !/^fr/.test(m.id));
  A.S.cfg.lapOk = tick() + 60000;
  A.giro(srv);
  C.giro(srv);
  assert.ok(!C.SY.lap);
  assert.strictEqual(C.S.moves.length, n - 25);
  uguali(A, C);
  // bloccate e poi approvate: la lista dell'altro telefono si svuota da sola quando arriva cfg.lapOk
  clock += 120000; // il minuto approvato dal ripristino è passato
  const altri = [];
  for (let i = 0; i < 22; i++) {
    altri.push('ap' + i);
    A.S.moves.push({ id: 'ap' + i, t: tick(), k: 'sale', p: 'conti', a: 50 });
  }
  A.giro(srv);
  C.giro(srv);
  altri.forEach((id) => srv.write('moves~' + id, { c: 'moves', i: id, j: null, u: tick(), by: 'X' }));
  A.giro(srv);
  C.giro(srv);
  assert.strictEqual(Object.keys(C.SY.lap).length, 22);
  let max = 0;
  Object.values(A.SY.lap).forEach((x) => (max = Math.max(max, x.u)));
  A.S.cfg.lapOk = max;
  assert.ok(syncRilascia(A.S, A.SY));
  tick();
  A.giro(srv);
  C.giro(srv);
  assert.ok(!C.SY.lap);
  assert.strictEqual(C.S.moves.filter((m) => /^ap/.test(m.id)).length, 0);
  uguali(A, C);
}

console.log('sincronizzazione: tutto torna (' + Object.keys(srv.docs).length + ' documenti sul finto server, 3 telefoni allineati)');
