// Prova di compatibilità tra versioni: sullo stesso locale ci sono telefoni aggiornati e telefoni rimasti indietro.
// Un telefono vecchio non deve rovinare i dati degli altri e, quando si aggiorna, non deve rimandare le sue copie
// impoverite: rilegge il locale e si rimette in pari. Le versioni vecchie sono in test/fixtures (blocco PURE).
process.env.TZ = 'Europe/Rome';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RITORNO = `{seedState,normState,derive,canon,hashStr,entita,syncDiff,syncApply,normEnt,APP_V,
  syncNuovaVersione: typeof syncNuovaVersione === 'function' ? syncNuovaVersione : null,
  metiSintomi: typeof metiSintomi === 'function' ? metiSintomi : null,
  sintomiVoto: typeof sintomiVoto === 'function' ? sintomiVoto : null}`;
const carica = (src) => new Function(src + '\nreturn ' + RITORNO + ';')();
const pure = require('./pure.js'); // src/app.js; le versioni vecchie restano con carica()
const NUOVA = pure(RITORNO);
const V044 = carica(fs.readFileSync(path.join(__dirname, 'fixtures', 'pure-0.4.4.js'), 'utf8'));
const V050 = carica(fs.readFileSync(path.join(__dirname, 'fixtures', 'pure-0.5.0.js'), 'utf8'));
const V051 = carica(fs.readFileSync(path.join(__dirname, 'fixtures', 'pure-0.5.1.js'), 'utf8'));
const V060 = carica(fs.readFileSync(path.join(__dirname, 'fixtures', 'pure-0.6.0.js'), 'utf8'));
const V070 = carica(fs.readFileSync(path.join(__dirname, 'fixtures', 'pure-0.7.0.js'), 'utf8'));
assert.strictEqual(V044.APP_V, '0.4.4');
assert.strictEqual(V050.APP_V, '0.5.0');
assert.strictEqual(V051.APP_V, '0.5.1');
assert.strictEqual(V060.APP_V, '0.6.0');
assert.strictEqual(V070.APP_V, '0.7.0');
const N7 = pure('{metiVoto,candidatiVoto,sintomiPer,cambiaPrezzo,impronta}');
const VOTI_DAL = pure('VOTI_DAL');
const sintomi = (v) => NUOVA.sintomiVoto(v);

// finto server: ultimo che scrive vince, con un contatore come ora del server
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

let clock = VOTI_DAL + 864e5; // dopo l'azzeramento dei voti della 0.6.0
const tick = (n) => (clock += n || 1000);
function Phone(dev, api, S, SY) {
  this.dev = dev;
  this.api = api;
  this.S = S;
  this.SY = SY || { cursor: 0, init: false, ent: {}, ver: api.APP_V };
}
Phone.prototype.push = function (srv, senzaRete) {
  if (!this.SY.init) return 0;
  const w = this.api.syncDiff(this.S, this.SY);
  w.forEach((x) => {
    const prev = this.SY.ent[x.key];
    const u = Math.max(clock, prev ? prev[0] + 1 : 0);
    this.SY.ent[x.key] = [u, x.h, senzaRete ? 0 : 1];
    if (!senzaRete) srv.write(x.key, { c: x.c, i: x.i, j: x.j, u, by: this.dev });
  });
  return w.length;
};
Phone.prototype.pull = function (srv) {
  const ch = srv.since(this.SY.cursor);
  this.api.syncApply(this.S, ch, this.SY, !this.SY.init);
  ch.forEach((c) => {
    if (c.s > this.SY.cursor) this.SY.cursor = c.s;
  });
  this.SY.init = true;
};
Phone.prototype.giro = function (srv) {
  this.pull(srv);
  this.push(srv);
  this.pull(srv);
};
// l'app si aggiorna: stessi dati salvati sul telefono, letti dal codice nuovo come all'avvio
Phone.prototype.aggiorna = function (api) {
  const S = api.normState(JSON.parse(JSON.stringify(this.S)));
  const SY = JSON.parse(JSON.stringify(this.SY));
  api.syncNuovaVersione(S, SY, api.APP_V);
  return new Phone(this.dev, api, S, SY);
};
const forma = (ph) =>
  NUOVA.entita(ph.S)
    .map((x) => x.k + '=' + NUOVA.canon(NUOVA.normEnt(x.c, JSON.parse(JSON.stringify(x.e)))))
    .sort();
const uguali = (a, b, msg) => {
  assert.deepStrictEqual(forma(a), forma(b), msg);
  assert.deepStrictEqual(NUOVA.derive(a.S), NUOVA.derive(b.S), msg);
};
const voto = (ph, id) => ph.S.votes.find((v) => v.id === id);
const quiete = (...ph) => ph.reduce((n, p) => n + p.push(srv), 0);

const srv = new Server();
const A = new Phone('A', NUOVA, NUOVA.seedState(1)); // aggiornato
A.giro(srv);
const O = new Phone('O', V044, V044.seedState(2)); // fermo alla 0.4.4
tick();
O.giro(srv);
const P = new Phone('P', V050, V050.seedState(3)); // fermo alla 0.5.0 (sintomi salvati come lista in «y»)
tick();
P.giro(srv);
A.giro(srv);
O.giro(srv);
P.giro(srv);
assert.strictEqual(quiete(A, O, P), 0, 'tre versioni insieme: nessun rimbalzo di scritture');

// 1. voto con un sintomo da un telefono vecchio: lo leggono tutti, nessuno lo riscrive
tick();
O.S.votes.push({ id: 'v2026-10-12_pj', s: '2026-10-12', v: 'pj', c: 'pesce', y: 'Urla strazianti', t: clock });
O.giro(srv);
A.giro(srv);
P.giro(srv);
assert.deepStrictEqual(sintomi(voto(A, 'v2026-10-12_pj')), ['Urla strazianti']);
assert.strictEqual(voto(A, 'v2026-10-12_pj').y, 'Urla strazianti', 'un sintomo solo: stesso formato di prima');
assert.strictEqual(quiete(A, O, P), 0);

// 2. voto con due sintomi dal telefono aggiornato: il vecchio vede il primo e NON lo riscrive
tick();
const vA = { id: 'v2026-10-12_conti', s: '2026-10-12', v: 'conti', c: 'pesce', t: clock };
NUOVA.metiSintomi(vA, ['Silenzio assordante', 'Urla strazianti']);
A.S.votes.push(vA);
A.giro(srv);
O.giro(srv);
P.giro(srv);
A.giro(srv);
assert.strictEqual(voto(O, 'v2026-10-12_conti').y, 'Silenzio assordante', 'la 0.4.4 legge il primo sintomo come testo');
assert.strictEqual(quiete(A, O, P), 0, 'i telefoni vecchi non rimandano le copie ridotte');
assert.deepStrictEqual(
  sintomi(JSON.parse(srv.docs['votes~v2026-10-12_conti'].j)),
  ['Silenzio assordante', 'Urla strazianti'],
  'sul server restano tutti e due'
);

// 3. voto con due sintomi dalla 0.5.0 (lista in «y»): l'aggiornato lo legge bene, la 0.4.4 lo storpia ma non lo rimanda
tick();
P.S.votes.push({
  id: 'v2026-10-12_chicco',
  s: '2026-10-12',
  v: 'chicco',
  c: 'ciccio',
  y: ['Dormire al locale', 'Giocare alle slot'],
  t: clock,
});
P.giro(srv);
A.giro(srv);
O.giro(srv);
assert.deepStrictEqual(sintomi(voto(A, 'v2026-10-12_chicco')), ['Dormire al locale', 'Giocare alle slot']);
assert.strictEqual(voto(O, 'v2026-10-12_chicco').y, 'Dormire al locale,Giocare alle slot', 'copia storpiata della 0.4.4 (resta solo lì)');
assert.strictEqual(quiete(A, O, P), 0);

// 4. il telefono vecchio segna qualcosa senza rete, poi si aggiorna: quello va mandato, il resto no
tick();
O.S.moves.push({ id: 'm9', t: clock, k: 'dplus', p: 'conti', a: 300, note: 'scommessa' });
O.push(srv, true);
const O2 = O.aggiorna(NUOVA),
  P2 = P.aggiorna(NUOVA);
assert.strictEqual(O2.push(srv), 1, 'aggiornato manda solo la modifica in coda, non le copie che cambiano forma');
assert.strictEqual(P2.push(srv), 0, 'la 0.5.0 aggiornata non riscrive i voti in forma nuova');
O2.pull(srv);
P2.pull(srv);
A.giro(srv);
for (const ph of [O2, P2]) {
  assert.deepStrictEqual(
    sintomi(voto(ph, 'v2026-10-12_conti')),
    ['Silenzio assordante', 'Urla strazianti'],
    ph.dev + ': rilettura dopo l’aggiornamento'
  );
  assert.deepStrictEqual(
    sintomi(voto(ph, 'v2026-10-12_chicco')),
    ['Dormire al locale', 'Giocare alle slot'],
    ph.dev + ': copia storpiata riparata'
  );
  assert.ok(
    Object.values(ph.SY.ent).every((e) => e.length === 3 && e[2] === 1),
    ph.dev + ': niente resta da rileggere o in coda'
  );
}
assert.ok(
  A.S.moves.some((m) => m.id === 'm9'),
  'la modifica fatta senza rete arriva agli altri'
);
uguali(A, O2, 'O aggiornato uguale ad A');
uguali(A, P2, 'P aggiornato uguale ad A');
assert.strictEqual(quiete(A, O2, P2), 0, 'dopo la rilettura nessuno ha niente da rimandare');
assert.deepStrictEqual(sintomi(JSON.parse(srv.docs['votes~v2026-10-12_conti'].j)), ['Silenzio assordante', 'Urla strazianti']);

// 5. dopo l'aggiornamento tutto torna normale: modifica da O2, la vedono gli altri; secondo avvio senza rilettura
tick();
voto(O2, 'v2026-10-12_pj').c = 'chicco';
O2.giro(srv);
A.giro(srv);
P2.giro(srv);
assert.strictEqual(voto(A, 'v2026-10-12_pj').c, 'chicco');
const O3 = O2.aggiorna(NUOVA);
assert.ok(O3.SY.cursor > 0, 'stessa versione: niente rilettura completa');
assert.strictEqual(O3.push(srv), 0);
uguali(A, P2);

// 6. dalla 0.5.1 alla 0.6.0 con i dati veri di un locale già avviato: si perdono solo i voti di prima dell'azzeramento
{
  const srv2 = new Server();
  const U = new Phone('U', V051, V051.seedState(4)); // il telefono principale, ancora alla 0.5.1
  const T = new Phone('T', V051, V051.seedState(5)); // un altro telefono alla 0.5.1
  const birra = U.S.products.find((p) => p.name === 'Birra');
  birra.price = 150;
  U.S.products.push({ id: 'pgin', name: 'Gin tonic', cat: 'Bevande', price: 500, min: 2, on: true });
  const prima = VOTI_DAL - 3 * 3600e3;
  U.S.moves.push({
    id: 'u1',
    t: prima,
    k: 'inv',
    a: 0,
    items: [
      { id: birra.id, n: 'Birra', q: 24, pr: 150 },
      { id: 'pgin', n: 'Gin tonic', q: 3, pr: 500 },
    ],
  });
  U.S.moves.push({ id: 'u2', t: prima + 1, k: 'tab', p: 'pesce', a: 450, items: [{ id: birra.id, n: 'Birra', q: 3, pr: 150 }] });
  U.S.moves.push({ id: 'u3', t: prima + 2, k: 'in', a: 5000, note: 'fondo' });
  U.S.moves.push({ id: 'u4', t: prima + 3, k: 'exp', a: 900, paidBy: 'chicco', settle: 'dividi', shares: { pj: 450, chicco: 450 } });
  U.S.votes.push({ id: 'v2026-10-12_pj', s: '2026-10-12', v: 'pj', c: 'pesce', y: 'Urla strazianti', t: prima + 4 });
  U.S.votes.push({ id: 'v2026-10-11_conti', s: '2026-10-11', v: 'conti', c: 'pj', t: prima - 864e5 });
  U.S.trash.push({ id: 'r2026-10-11', s: '2026-10-11', p: ['pj'], f: ['vetro'], t: prima });
  U.S.cleanings.push({ id: 'c1', t: prima, p: ['pesce'] });
  U.S.cfg.voteCut = 5;
  clock = prima + 10;
  U.giro(srv2);
  T.giro(srv2);
  U.giro(srv2);
  assert.strictEqual(T.S.votes.length, 2, 'prima dell’aggiornamento i voti ci sono');
  const conti = (ph) => {
    const D = NUOVA.derive(ph.S);
    return [D.cash, D.debt.pesce, D.debt.chicco, D.debt.pj, D.stock[birra.id], D.stock.pgin];
  };
  const atteso = conti(T);
  // U si aggiorna alla 0.6.0
  clock = VOTI_DAL + 3600e3;
  const U2 = U.aggiorna(NUOVA);
  assert.strictEqual(U2.S.votes.length, 0, 'i voti di prima dell’azzeramento spariscono');
  assert.deepStrictEqual(conti(U2), atteso, 'cassa, graffi, crediti e scorte identici');
  assert.strictEqual(U2.S.products.find((p) => p.id === birra.id).price, 150);
  assert.strictEqual(U2.S.products.length, U.S.products.length);
  assert.strictEqual(U2.S.trash.length, 1);
  assert.strictEqual(U2.S.cleanings.length, 1);
  assert.strictEqual(U2.S.cfg.voteCut, 5);
  assert.deepStrictEqual(U2.S.cfg.buttiamo, ['secco', 'vetro', 'plastica']);
  const scritte = U2.push(srv2);
  assert.strictEqual(scritte, 2, 'manda solo le due cancellazioni dei voti');
  U2.pull(srv2);
  T.giro(srv2);
  assert.strictEqual(T.S.votes.length, 0, 'anche il telefono non aggiornato perde i voti vecchi');
  assert.deepStrictEqual(conti(T), atteso, 'e il resto non cambia');
  // dopo: voti nuovi (anche dalla 0.5.1) restano ovunque; T aggiornato più tardi non cancella niente di nuovo
  clock += 1000;
  U2.S.votes.push({ id: 'v2026-10-12_pesce', s: '2026-10-12', v: 'pesce', c: 'conti', y: 'Dormire al locale', t: clock });
  U2.giro(srv2);
  T.giro(srv2);
  clock += 1000;
  T.S.votes.push({ id: 'v2026-10-12_ciccio', s: '2026-10-12', v: 'ciccio', c: 'conti', t: clock });
  T.giro(srv2);
  U2.giro(srv2);
  const T2 = T.aggiorna(NUOVA);
  assert.strictEqual(T2.push(srv2), 0, 'T aggiornato dopo: niente da cancellare né da rimandare');
  T2.pull(srv2);
  U2.giro(srv2);
  assert.deepStrictEqual(T2.S.votes.map((v) => v.id).sort(), ['v2026-10-12_ciccio', 'v2026-10-12_pesce']);
  assert.deepStrictEqual(U2.S.votes.map((v) => v.id).sort(), ['v2026-10-12_ciccio', 'v2026-10-12_pesce']);
  uguali(U2, T2, 'dopo l’aggiornamento i due telefoni sono identici');
  assert.deepStrictEqual(conti(T2), atteso);
  // un telefono nuovo installato adesso trova tutto (senza i voti vecchi)
  const N = new Phone('N', NUOVA, NUOVA.seedState(9));
  N.giro(srv2);
  uguali(U2, N, 'il telefono nuovo trova il locale com’è');
  assert.strictEqual(N.push(srv2), 0);
}

// 7. 0.6.0 e 0.7.0 insieme: voto a più persone, quota, muro, storico prezzi, codici. Il telefono vecchio non rovina niente.
{
  const srv3 = new Server();
  clock = Date.parse('2026-11-02T21:00:00+01:00');
  const Y = new Phone('Y', NUOVA, NUOVA.seedState(11)); // aggiornato
  const X = new Phone('X', V060, V060.seedState(12)); // fermo alla 0.6.0
  Y.giro(srv3);
  tick();
  X.giro(srv3);
  Y.giro(srv3);
  assert.strictEqual(quiete(X, Y), 0);
  const k = '2026-11-02';
  // Y: voto a tre persone con sintomi, quota, versamento, muro, verifica, prezzo cambiato, compleanno, codici
  tick();
  const v = { id: 'v' + k + '_pj', s: k, v: 'pj', t: clock };
  N7.metiVoto(v, ['pesce', 'conti', 'chicco'], { pesce: ['Urla strazianti'], chicco: ['Dormire al locale'] });
  Y.S.votes.push(v);
  Y.S.quote.push({ id: 'q2026-12', mese: '2026-12', a: 5000, chi: ['pj', 'pesce'], t: clock, note: 'affitto' });
  Y.S.moves.push({ id: 'qv1', t: clock, k: 'qin', p: 'pj', a: 5000, mese: '2026-12' });
  Y.S.moves.push({ id: 'mx1', t: clock + 1, k: 'tab', p: 'conti', a: 300, items: [], g: 'gg1' });
  Y.S.moves.push({ id: 'mx2', t: clock + 2, k: 'pay', p: 'conti', a: 100, g: 'gg1', note: 'pagamento misto' });
  Y.S.muro.push({ id: 'w1', t: clock, p: 'pesce', testo: 'Chi ha finito il ghiaccio?', col: 2, dv: 'Y' });
  Y.S.verifiche.push({ id: 'k1', t: clock, cassa: 1, scorte: 2, incassare: 3, restituire: 0, previsionale: 6, fondo: 5000 });
  const birraY = Y.S.products.find((p) => p.name === 'Birra');
  N7.cambiaPrezzo(birraY, 130, clock);
  Y.S.people.find((p) => p.id === 'pesce').nato = '11-02';
  Y.S.cfg.votiMax = 2;
  Y.S.cfg.pinH = N7.impronta('2468');
  Y.giro(srv3);
  X.giro(srv3);
  Y.giro(srv3);
  assert.strictEqual(quiete(X, Y), 0, 'il telefono vecchio non rimanda niente');
  const vx = voto(X, 'v' + k + '_pj');
  assert.strictEqual(vx.c, 'pesce', 'la 0.6.0 vede il primo votato');
  assert.deepStrictEqual(V060.sintomiVoto(vx), ['Urla strazianti']);
  assert.deepStrictEqual(vx.cs, ['pesce', 'conti', 'chicco'], 'e conserva gli altri senza toccarli');
  assert.strictEqual(X.S.products.find((p) => p.name === 'Birra').price, 130);
  assert.ok(Array.isArray(X.S.products.find((p) => p.name === 'Birra').ph), 'lo storico dei prezzi resta');
  assert.strictEqual(X.S.cfg.votiMax, 2);
  assert.strictEqual(X.S.cfg.pinH, N7.impronta('2468'));
  assert.strictEqual(X.S.people.find((p) => p.id === 'pesce').nato, '11-02');
  const dX = V060.derive(X.S),
    dY = NUOVA.derive(Y.S);
  assert.strictEqual(dX.cash, dY.cash, 'stessa cassa: la quota non entra in cassa nemmeno per la 0.6.0');
  assert.deepStrictEqual(dX.debt, dY.debt);
  assert.strictEqual(dY.fondo, 5000);
  ['qv1', 'mx1', 'mx2'].forEach((id) =>
    assert.ok(
      X.S.moves.some((m) => m.id === id),
      id + ' arriva anche alla 0.6.0'
    )
  );
  // X (0.6.0) cambia il voto di PJ come faceva prima: tocca solo «c» e i sintomi
  tick();
  vx.c = 'ciccio';
  vx.t = clock;
  V060.metiSintomi(vx, ['Grida silenziose']);
  X.giro(srv3);
  Y.giro(srv3);
  X.giro(srv3);
  const vy = voto(Y, 'v' + k + '_pj');
  assert.deepStrictEqual(N7.candidatiVoto(vy), ['ciccio', 'conti', 'chicco'], 'il voto cambiato dal vecchio va primo, gli altri restano');
  assert.deepStrictEqual(N7.sintomiPer(vy, 'ciccio'), ['Grida silenziose']);
  assert.deepStrictEqual(N7.sintomiPer(vy, 'chicco'), ['Dormire al locale']);
  assert.strictEqual(quiete(X, Y), 0);
  // X cambia un prezzo (senza storico): Y lo riceve e lo storico di prima resta
  tick();
  const bx = X.S.products.find((p) => p.name === 'Birra');
  bx.price = 140;
  X.giro(srv3);
  Y.giro(srv3);
  const by = Y.S.products.find((p) => p.name === 'Birra');
  assert.strictEqual(by.price, 140);
  assert.strictEqual(by.ph.length, 1);
  // X annulla il pagamento misto da sé (la 0.6.0 non sa dei gruppi): resta annullato solo quello
  tick();
  X.S.moves.find((m) => m.id === 'mx2').x = { t: clock };
  X.giro(srv3);
  Y.giro(srv3);
  assert.ok(Y.S.moves.find((m) => m.id === 'mx2').x && !Y.S.moves.find((m) => m.id === 'mx1').x);
  // X si aggiorna: niente da rimandare, poi uguale a Y, con muro, quota e verifiche
  const X2 = X.aggiorna(NUOVA);
  assert.strictEqual(X2.push(srv3), 0, 'aggiornato non rimanda le copie vecchie');
  X2.pull(srv3);
  Y.giro(srv3);
  assert.strictEqual(X2.S.muro.length, 1);
  assert.strictEqual(X2.S.quote.length, 1);
  assert.strictEqual(X2.S.verifiche.length, 1);
  uguali(X2, Y, 'dalla 0.6.0 alla 0.7.0: identici');
  assert.strictEqual(quiete(X2, Y), 0);
  // un telefono nuovo trova tutto
  const Z = new Phone('Z', NUOVA, NUOVA.seedState(13));
  Z.giro(srv3);
  uguali(Y, Z);
  assert.strictEqual(Z.push(srv3), 0);
  // cancellare un post-it dal telefono aggiornato: sparisce ovunque, e la 0.6.0 non lo rimette
  tick();
  Y.S.muro = [];
  Y.giro(srv3);
  Z.giro(srv3);
  X.giro(srv3);
  assert.strictEqual(Z.S.muro.length, 0);
  assert.strictEqual(quiete(X, Y, Z), 0);
}

// 8. 0.7.0 e la versione nuova: stessi dati, nessun rimbalzo; aggiornandosi la 0.7.0 non rimanda niente
{
  const srv4 = new Server();
  clock = Date.parse('2026-11-03T21:00:00+01:00');
  const Y = new Phone('Y', NUOVA, NUOVA.seedState(21)),
    X = new Phone('X', V070, V070.seedState(22));
  Y.giro(srv4);
  tick();
  X.giro(srv4);
  Y.giro(srv4);
  tick();
  const v = { id: 'v2026-11-03_pj', s: '2026-11-03', v: 'pj', t: clock };
  N7.metiVoto(v, ['pesce', 'conti'], { conti: ['Stato depressivo'] });
  X.S.votes.push(v);
  X.S.quote.push({ id: 'q2026-12', mese: '2026-12', a: 5000, chi: ['pj', 'pesce'], t: clock });
  X.S.moves.push({ id: 'z1', t: clock, k: 'qin', p: 'pesce', a: 5000, mese: '2026-12' });
  X.S.muro.push({ id: 'w9', t: clock, p: 'conti', testo: 'Tutto bene', col: 1, dv: 'X' });
  X.giro(srv4);
  Y.giro(srv4);
  X.giro(srv4);
  assert.strictEqual(quiete(X, Y), 0, '0.7.0 e versione nuova insieme: nessun rimbalzo');
  uguali(X, Y, '0.7.0 e versione nuova: stessi dati');
  const X2 = X.aggiorna(NUOVA);
  assert.strictEqual(X2.push(srv4), 0, 'aggiornandosi la 0.7.0 non rimanda niente');
  X2.pull(srv4);
  uguali(X2, Y);
}

console.log(
  'compatibilità: tutto torna (0.4.4, 0.5.0, 0.5.1, 0.6.0, 0.7.0 e ' +
    NUOVA.APP_V +
    ' sullo stesso locale, nessun dato perso; voti vecchi azzerati)'
);

// dalla 0.19.0: rilettura completa solo per chi arriva da prima di RILEGGI_DAL (costa letture sulla quota gratuita)
{
  const S = NUOVA.normState(JSON.parse(JSON.stringify(A.S)));
  const ent = () => JSON.parse(JSON.stringify(A.SY.ent));
  const recente = { cursor: 50, init: true, ent: ent(), ver: '0.19.0' };
  assert.ok(NUOVA.syncNuovaVersione(S, recente, '0.20.0'));
  assert.strictEqual(recente.cursor, 50, 'da 0.19.0 in poi niente rilettura completa');
  assert.ok(Object.values(recente.ent).every((e) => e[3] !== 'r'));
  assert.strictEqual(recente.ver, '0.20.0');
  const vecchio = { cursor: 50, init: true, ent: ent(), ver: '0.17.0' };
  assert.ok(NUOVA.syncNuovaVersione(S, vecchio, '0.20.0'));
  assert.strictEqual(vecchio.cursor, 0, 'da prima della 0.19.0 si rilegge tutto');
  const senza = { cursor: 50, init: true, ent: ent() };
  NUOVA.syncNuovaVersione(S, senza, '0.20.0');
  assert.strictEqual(senza.cursor, 0, 'registro senza versione: si rilegge');
}
