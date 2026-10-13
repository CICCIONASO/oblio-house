// Prova dei calcoli: importi, divisione spese, debiti, cassa, scorte, voto, freccette, classifiche.
process.env.TZ = 'Europe/Rome';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const pure = require('./pure.js');
const api = pure('{parseEur,splitShares,derive,seedState,normState,unitsOf,ymd,toInt,serata,prevMonth,inPer,voteSummary,serateChiuse,dartVal,playDarts,statRe,statConsumi,statFreccette,statPagatori,applyImg0,normImg,IMG0,rifiutiSerata,calPieno,prossimiRifiuti,statSpazzatura,pulizieStato,normCfg}');
const { parseEur, splitShares, derive, seedState, normState } = api;
const { serata, prevMonth, inPer, voteSummary, serateChiuse, dartVal, playDarts, statRe, statConsumi, statFreccette, statPagatori, applyImg0, normImg, IMG0 } = api;
const { rifiutiSerata, calPieno, prossimiRifiuti, statSpazzatura, pulizieStato, normCfg } = api;
const extra = pure('{applyCal0,CAL0,SINTOMI0,topSintomo,topSintomi,sintomiVoto,metiSintomi,sintomiDi,applySintomi0,previsione,VOTI_DAL,leggiScontrino,propostaScontrino,abbinaRiga,applicaScontrino,confezione,nomeProposto,ricordaAlias,chiaveScontrino,rifiutiSerata,BUTTIAMO0}');
const TV = extra.VOTI_DAL;   // i voti più vecchi di questo istante sono stati azzerati alla 0.6.0

// importi
assert.strictEqual(parseEur('12,50'), 1250);
assert.strictEqual(parseEur('3'), 300);
assert.strictEqual(parseEur('0,5'), 50);
assert.strictEqual(parseEur('1.234,56'), 123456);
assert.strictEqual(parseEur('€ 4,00'), 400);
assert.strictEqual(parseEur('2.67'), 267);
assert.strictEqual(parseEur('2,675'), NaN);
assert.strictEqual(parseEur('0'), 0);
assert.ok(isNaN(parseEur('')));
assert.ok(isNaN(parseEur('abc')));
assert.ok(isNaN(parseEur('-3')));
assert.strictEqual(parseEur('19,99'), 1999);

// divisione
const sh = splitShares(1000, ['a', 'b', 'c']);
assert.deepStrictEqual(sh, { a: 334, b: 333, c: 333 });
assert.strictEqual(Object.values(splitShares(1, ['a', 'b', 'c', 'd', 'e', 'f'])).reduce((s, v) => s + v, 0), 1);
assert.deepStrictEqual(splitShares(900, ['pj', 'pesce', 'ciccio', 'peppecarlo', 'conti', 'chicco']), { pj: 150, pesce: 150, ciccio: 150, peppecarlo: 150, conti: 150, chicco: 150 });

// listino e persone iniziali
const S = seedState(1000);
assert.strictEqual(S.people.length, 6);
assert.strictEqual(S.products.length, 24);
assert.strictEqual(S.products.find((p) => p.name === 'Birra').price, 100);
assert.strictEqual(S.products.find((p) => p.name === 'Kit Kat').price, 150);
const birra = S.products.find((p) => p.name === 'Birra').id;
const bueno = S.products.find((p) => p.name === 'Kinder Bueno').id;

let t = 2000;
const mv = (o) => { const x = Object.assign({ id: 'm' + t, t: t++ }, o); S.moves.push(x); return x; };
mv({ k: 'inv', a: 0, items: [{ id: birra, n: 'Birra', q: 10, pr: 100 }] });
mv({ k: 'tab', p: 'pesce', a: 330, items: [{ id: birra, n: 'Birra', q: 2, pr: 100 }, { id: bueno, n: 'Kinder Bueno', q: 1, pr: 130 }] });
mv({ k: 'sale', p: 'ciccio', a: 100, items: [{ id: birra, n: 'Birra', q: 1, pr: 100 }] });
const pay = mv({ k: 'pay', p: 'pesce', a: 200 });
mv({ k: 'dplus', p: 'conti', a: 500, note: 'vecchio conto' });
mv({ k: 'dminus', p: 'conti', a: 100 });
mv({ k: 'exp', a: 1000, paidBy: 'cassa', cat: 'Rifornimento bar' });
mv({ k: 'in', a: 5000, note: 'fondo iniziale' });
mv({ k: 'exp', a: 600, paidBy: 'pj', settle: 'debito' });
mv({ k: 'exp', a: 900, paidBy: 'chicco', settle: 'dividi', shares: splitShares(900, S.people.map((p) => p.id)) });

let D = derive(S);
assert.strictEqual(D.cash, 100 + 200 - 1000 + 5000, 'cassa');
assert.strictEqual(D.debt.pesce, 330 - 200 + 150, 'pesce');
assert.strictEqual(D.debt.ciccio, 150, 'ciccio');
assert.strictEqual(D.debt.conti, 500 - 100 + 150, 'conti');
assert.strictEqual(D.debt.pj, -600 + 150, 'pj in credito');
assert.strictEqual(D.debt.chicco, -900 + 150, 'chicco in credito');
assert.strictEqual(D.debt.peppecarlo, 150, 'peppecarlo');
assert.strictEqual(D.stock[birra], 7, 'scorta birra');
assert.strictEqual(D.stock[bueno], undefined, 'bueno non contato');
assert.strictEqual(D.units.pesce, 4, 'tacche pesce');
assert.strictEqual(D.units.pj || 0, 0, 'pj senza tacche');
assert.strictEqual(D.spent.pesce, 330);
assert.strictEqual(D.sold[birra], 3);

// la somma dei debiti e dei crediti torna con le spese anticipate
const somma = Object.values(D.debt).reduce((s, v) => s + v, 0);
assert.strictEqual(somma, (330 - 200) + (500 - 100) - 600 + (900 - 900), 'quadratura debiti');

// rimborso dalla cassa di una spesa anticipata
mv({ k: 'exp', a: 250, paidBy: 'conti', settle: 'cassa' });
D = derive(S);
assert.strictEqual(D.cash, 4300 - 250);
assert.strictEqual(D.debt.conti, 550);

// conta cassa: riallineo a 40,00
mv({ k: 'count', a: 4000 - D.cash, counted: 4000, expected: D.cash });
D = derive(S);
assert.strictEqual(D.cash, 4000);

// annullo il pagamento di pesce
pay.x = { t: 1 };
D = derive(S);
assert.strictEqual(D.debt.pesce, 480);
assert.strictEqual(D.cash, 3800);
delete pay.x;

// carico e scorta negativa
mv({ k: 'load', a: 0, items: [{ id: birra, n: 'Birra', q: 24, pr: 100 }, { id: bueno, n: 'Kinder Bueno', q: 5, pr: 130 }] });
mv({ k: 'tab', p: 'pj', a: 780, items: [{ id: bueno, n: 'Kinder Bueno', q: 6, pr: 130 }] });
D = derive(S);
assert.strictEqual(D.stock[birra], 31);
assert.strictEqual(D.stock[bueno], -1);
assert.strictEqual(D.debt.pj, -450 + 780);
assert.strictEqual(D.units.pj, 6, 'tacche pj: il credito copre una parte ma la consumazione resta aperta');

// pagamento totale azzera le tacche
mv({ k: 'pay', p: 'pj', a: 330 });
D = derive(S);
assert.strictEqual(D.debt.pj, 0);
assert.strictEqual(D.units.pj || 0, 0);

// andata e ritorno del backup
const back = normState(JSON.parse(JSON.stringify(S)));
assert.ok(back);
assert.deepStrictEqual(derive(back), D);
assert.strictEqual(normState({ foo: 1 }), null);
assert.strictEqual(normState(null), null);

// dati sporchi non rompono i calcoli
const dirty = normState({ people: [{ id: 'x', name: '' }, null, { name: 'no id' }], products: [{ id: 'p', price: 'abc', min: '' }], moves: [{ k: 'tab', p: 'x', a: 'NaN' }, { k: 'pay', p: 'x', a: -500 }, 'boh', { k: 'count', a: -200 }] });
assert.strictEqual(dirty.people.length, 1);
assert.strictEqual(dirty.people[0].name, 'Senza nome');
assert.strictEqual(dirty.products[0].price, 0);
assert.strictEqual(dirty.products[0].min, null);
const Dd = derive(dirty);
assert.strictEqual(Dd.cash, -200);
assert.strictEqual(Dd.debt.x || 0, 0);

// ---------- serata: vale fino alle 6 del mattino dopo ----------
const L = (y, mo, d, hh, mi) => new Date(y, mo - 1, d, hh, mi || 0).getTime();
assert.strictEqual(serata(L(2026, 10, 12, 23, 0), 6), '2026-10-12');
assert.strictEqual(serata(L(2026, 10, 13, 5, 59), 6), '2026-10-12');
assert.strictEqual(serata(L(2026, 10, 13, 6, 0), 6), '2026-10-13');
assert.strictEqual(serata(L(2026, 11, 1, 2, 0), 6), '2026-10-31', 'a cavallo del mese');
assert.strictEqual(serata(L(2026, 1, 1, 3, 0), 6), '2025-12-31', 'a cavallo dell’anno');
assert.strictEqual(serata(L(2026, 10, 25, 5, 30), 6), '2026-10-24', 'notte del ritorno all’ora solare');
assert.strictEqual(serata(L(2026, 10, 25, 6, 30), 6), '2026-10-25');
assert.strictEqual(serata(L(2026, 3, 29, 5, 30), 6), '2026-03-28', 'notte del passaggio all’ora legale');
assert.strictEqual(serata(L(2026, 10, 12, 0, 30), 0), '2026-10-12', 'chiusura a mezzanotte');
assert.strictEqual(prevMonth('2026-01'), '2025-12');
assert.ok(inPer('2026-10-03', 'mese', '2026-10-12'));
assert.ok(!inPer('2026-09-30', 'mese', '2026-10-12'));
assert.ok(inPer('2026-09-30', 'scorso', '2026-10-12'));
assert.ok(inPer('2020-01-01', 'sempre', '2026-10-12'));

// ---------- voto palese ----------
const vs = voteSummary([{ v: 'pj', c: 'pesce' }, { v: 'ciccio', c: 'pesce' }, { v: 'pesce', c: 'ciccio' }, { v: 'pj', c: 'ciccio' }]);
assert.deepStrictEqual(vs.tally, { pesce: 1, ciccio: 2 }, 'vale l’ultimo voto di pj');
assert.deepStrictEqual(vs.winners, ['ciccio']);
assert.strictEqual(vs.n, 3);
assert.deepStrictEqual(voteSummary([{ v: 'a', c: 'x' }, { v: 'b', c: 'y' }]).winners.sort(), ['x', 'y'], 'pari merito');
assert.deepStrictEqual(voteSummary([]).winners, []);

const SV = seedState(1);
SV.votes = [
  { id: '1', s: '2026-10-10', v: 'pj', c: 'pesce', t: 1 }, { id: '2', s: '2026-10-10', v: 'conti', c: 'pesce', t: 2 }, { id: '3', s: '2026-10-10', v: 'pesce', c: 'ciccio', t: 3 },
  { id: '4', s: '2026-10-11', v: 'pj', c: 'ciccio', t: 4 }, { id: '5', s: '2026-10-11', v: 'ciccio', c: 'pj', t: 5 },
  { id: '6', s: '2026-09-30', v: 'pj', c: 'conti', t: 6 },
  { id: '7', s: '2026-10-12', v: 'pj', c: 'chicco', t: 7 },
];
assert.deepStrictEqual(Object.keys(serateChiuse(SV, '2026-10-12')).sort(), ['2026-09-30', '2026-10-10', '2026-10-11']);
const reO = statRe(SV, 'mese', '2026-10-12');
assert.strictEqual(reO.serate, 2);
assert.deepStrictEqual(reO.by.pesce, { rossi: 1, voti: 2 });
assert.deepStrictEqual(reO.by.ciccio, { rossi: 1, voti: 2 }, 'pari merito l’11: codice rosso a tutti e due');
assert.deepStrictEqual(reO.by.pj, { rossi: 1, voti: 1 });
assert.ok(!reO.by.chicco, 'la serata ancora aperta non conta');
assert.ok(!reO.by.conti, 'settembre è fuori da questo mese');
assert.strictEqual(statRe(SV, 'scorso', '2026-10-12').by.conti.rossi, 1);
assert.strictEqual(statRe(SV, 'sempre', '2026-10-12').serate, 3);

// ---------- freccette: 501/301 a chiusura libera ----------
assert.deepStrictEqual(dartVal('T20'), { n: 20, m: 3, v: 60 });
assert.deepStrictEqual(dartVal('D25'), { n: 25, m: 2, v: 50 });
assert.deepStrictEqual(dartVal('M'), { n: 0, m: 0, v: 0 });
assert.deepStrictEqual(dartVal('T25'), { n: 0, m: 0, v: 0 }, 'il triplo centro non esiste');
const tira = (g, ...c) => { g.d.push(...c); return playDarts(g); };
const g1 = { mode: '301', players: ['pj', 'pesce'], d: [] };
let st = tira(g1, 'T20', 'T20', 'T20');
assert.strictEqual(st.R.pj.left, 121); assert.strictEqual(st.cur, 1); assert.strictEqual(st.turns[0].pts, 180);
st = tira(g1, 'S20', 'S20', 'S20');
assert.strictEqual(st.R.pesce.left, 241); assert.strictEqual(st.cur, 0);
st = tira(g1, 'T20', 'S20', 'S1');
assert.strictEqual(st.R.pj.left, 40);
st = tira(g1, 'M', 'M', 'M');
st = tira(g1, 'T20');
assert.strictEqual(st.R.pj.left, 40, 'sballato: torna al punteggio di inizio turno');
assert.strictEqual(st.cur, 1, 'sballato alla prima freccetta: il turno finisce subito');
assert.ok(st.turns[st.turns.length - 1].bust);
st = tira(g1, 'S1', 'S1', 'S1');
assert.strictEqual(st.R.pesce.left, 238);
st = tira(g1, 'S20', 'S19');
assert.strictEqual(st.R.pj.left, 1); assert.strictEqual(st.turn.length, 2); assert.strictEqual(st.t0, 40);
st = tira(g1, 'S1');
assert.strictEqual(st.win, 'pj', 'chiusura libera: basta un singolo');
assert.strictEqual(st.R.pj.left, 0); assert.strictEqual(st.R.pj.co, 40);
assert.deepStrictEqual(st.ultimi, ['pesce']);
assert.strictEqual(st.R.pj.darts, 10); assert.strictEqual(st.R.pj.pts, 301); assert.strictEqual(st.R.pj.best, 180); assert.strictEqual(st.R.pj.busts, 1);
assert.strictEqual(playDarts(Object.assign({}, g1, { d: g1.d.concat(['T20']) })).used, g1.d.length, 'i tiri dopo la vittoria non contano');
const g2 = { mode: '501', players: ['a'], d: ['T20', 'T20', 'T20', 'T20', 'T20', 'T20', 'T20', 'T20', 'T19', 'T20'] };
assert.strictEqual(playDarts(g2).R.a.left, 81, 'sballato alla terza freccetta');
assert.strictEqual(playDarts({ mode: '301', players: ['a', 'b'], d: ['D25', 'S25', 'M'] }).R.a.left, 226);

// ---------- giro dell'orologio: doppio +2, triplo +3 ----------
const go1 = { mode: 'orologio', players: ['pj', 'ciccio'], d: [] };
let so = tira(go1, 'T1', 'D4', 'S6');
assert.strictEqual(so.R.pj.tgt, 7); assert.strictEqual(so.cur, 1);
so = tira(go1, 'S5', 'M', 'S2');
assert.strictEqual(so.R.ciccio.tgt, 1, 'conta solo il numero di turno');
so = tira(go1, 'T7', 'T10', 'T13', 'M', 'M', 'M', 'T16', 'D19');
assert.strictEqual(so.win, 'pj'); assert.strictEqual(so.R.pj.tgt, 21);
assert.deepStrictEqual(so.ultimi, ['ciccio']);
const go2 = { mode: 'orologio', players: ['a'], d: [] };
for (let n = 1; n <= 20; n++) go2.d.push('S' + n);
assert.strictEqual(playDarts(go2).win, 'a', 'il singolo sul 20 chiude, niente centro');
assert.strictEqual(playDarts(go2).R.a.darts, 20);

// ---------- classifiche ----------
const SG = seedState(1);
SG.games = [
  Object.assign({ id: 'g1', t: L(2026, 10, 12, 22, 0), end: 1 }, g1),
  { id: 'g2', t: L(2026, 10, 12, 23, 0), mode: '301', players: ['pj', 'pesce'], d: ['T20'], end: 0 },
  Object.assign({ id: 'g3', t: L(2026, 10, 12, 23, 30), end: 1, x: { t: 1 } }, go1),
  { id: 'g4', t: L(2026, 10, 12, 23, 40), mode: 'orologio', players: ['ciccio'], d: go2.d.slice(), end: 1 },
];
const fr1 = statFreccette(SG, 'mese', '2026-10-12', 6);
assert.strictEqual(fr1.pj.vinte, 1); assert.strictEqual(fr1.pj.gare, 1); assert.strictEqual(fr1.pesce.ultimo, 1);
assert.strictEqual(fr1.pj.co, 40); assert.strictEqual(fr1.pj.darts, 10);
assert.strictEqual(fr1.ciccio.gare, 0, 'da solo è allenamento, la partita annullata non conta');

const day = 864e5, T0 = L(2026, 10, 5, 22, 0);
const SP = seedState(1);
SP.moves = [
  { id: '1', t: T0, k: 'sale', p: 'pj', a: 200, items: [{ n: 'Birra', q: 2, pr: 100 }] },
  { id: '2', t: T0, k: 'tab', p: 'pesce', a: 300, items: [{ n: 'Birra', q: 3, pr: 100 }] },
  { id: '3', t: T0 + 2 * day, k: 'pay', p: 'pesce', a: 300 },
  { id: '4', t: T0, k: 'tab', p: 'conti', a: 100, items: [{ n: 'Mars', q: 1, pr: 100 }] },
  { id: '5', t: T0, k: 'pay', p: 'chicco', a: 500 },
  { id: '6', t: T0 + day, k: 'tab', p: 'chicco', a: 150, items: [{ n: 'Kit Kat', q: 1, pr: 150 }] },
  { id: '7', t: T0, k: 'tab', p: 'ciccio', a: 100, items: [{ n: 'Mars', q: 1, pr: 100 }], x: { t: 1 } },
  { id: '8', t: T0, k: 'tab', p: 'peppecarlo', a: 200, items: [{ n: 'Birra', q: 2, pr: 100 }] },
  { id: '9', t: T0 + day, k: 'pay', p: 'peppecarlo', a: 100 },
];
const pg = statPagatori(SP, 'mese', '2026-10-12', 6, T0 + 3 * day);
assert.strictEqual(pg.pj.giorni, 0, 'paga subito = zero giorni');
assert.ok(Math.abs(pg.pesce.giorni - 2) < 1e-9);
assert.ok(Math.abs(pg.conti.giorni - 3) < 1e-9, 'quello ancora sul ticket conta fino a oggi'); assert.strictEqual(pg.conti.open, 100);
assert.strictEqual(pg.chicco.giorni, 0, 'credito già versato: zero giorni');
assert.ok(Math.abs(pg.peppecarlo.giorni - 2) < 1e-9, 'metà pagata dopo 1 giorno, metà aperta da 3');
assert.ok(!pg.ciccio, 'movimento annullato');
const cs = statConsumi(SP, 'mese', '2026-10-12', 6);
assert.deepStrictEqual(cs.pesce, { eur: 300, pz: 3 });
assert.deepStrictEqual(cs.pj, { eur: 200, pz: 2 });
assert.ok(!cs.ciccio);
assert.deepStrictEqual(statConsumi(SP, 'scorso', '2026-10-12', 6), {});

// ---------- backup vecchi e dati sporchi ----------
const old = normState({ people: [{ id: 'pj', name: 'PJ' }], products: [], moves: [] });
assert.deepStrictEqual(old.votes, []); assert.deepStrictEqual(old.games, []);
assert.strictEqual(old.cfg.voteCut, 6); assert.strictEqual(old.cfg.selfVote, true); assert.strictEqual(old.cfg.puliziaGiorni, 14);
assert.deepStrictEqual(old.cfg.rifiuti, { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] });
assert.deepStrictEqual(old.trash, []); assert.deepStrictEqual(old.cleanings, []);
assert.strictEqual(old.people[0].img, '');
const nv = normState({ people: [], products: [], moves: [], votes: [{ s: '2026-10-12', v: 'pj', c: 'pesce', t: TV + 1 }, { s: '2026-10-12', v: 'pj', c: 'conti', t: TV + 5 }, { s: 'boh', v: 'pj', c: 'x' }, { s: '2026-10-12', v: '', c: 'x' }, null] });
assert.strictEqual(nv.votes.length, 1); assert.strictEqual(nv.votes[0].c, 'conti');
const ng = normState({ people: [], products: [], moves: [], games: [
  { id: 'a', mode: 'cricket', players: ['pj'], d: [] },
  { id: 'b', mode: '301', players: ['pj', 'pj', 'pesce'], d: ['T20', 'X9', 'T21', 'S25', 'D25'] },
  { id: 'c', mode: 'orologio', players: ['a'], d: go2.d.concat(['S5']) }] });
assert.strictEqual(ng.games.length, 2);
assert.deepStrictEqual(ng.games[0].players, ['pj', 'pesce']);
assert.deepStrictEqual(ng.games[0].d, ['T20', 'S25', 'D25']);
assert.strictEqual(ng.games[0].end, 0);
assert.strictEqual(ng.games[1].d.length, 20); assert.ok(ng.games[1].end > 0);
assert.strictEqual(normState({ people: [], products: [], moves: [], cfg: { voteCut: 30 } }).cfg.voteCut, 6);
assert.strictEqual(normState({ people: [], products: [], moves: [], cfg: { voteCut: 0 } }).cfg.voteCut, 0);
assert.strictEqual(normState({ people: [], products: [], moves: [], cfg: { voteCut: '4', selfVote: false } }).cfg.selfVote, false);
assert.strictEqual(normImg('c3'), 'c3'); assert.strictEqual(normImg('c9'), ''); assert.strictEqual(normImg('javascript:alert(1)'), '');
assert.strictEqual(normImg('data:image/jpeg;base64,AAAA'), 'data:image/jpeg;base64,AAAA');
assert.strictEqual(normImg('data:image/svg+xml;base64,AAAA'), '', 'niente svg: potrebbero contenere script');

// ---------- caricature: assegnate una volta, senza rubare scelte fatte a mano ----------
assert.deepStrictEqual(IMG0, { pesce: 'c1', conti: 'c2', chicco: 'c3', pj: 'c4', peppecarlo: 'c5', ciccio: 'c6' });
const SI = seedState(1);
SI.people.find((p) => p.id === 'conti').img = 'c1';
assert.strictEqual(applyImg0(SI), true);
assert.strictEqual(SI.people.find((p) => p.id === 'pesce').img, '', 'la c1 l’ha già presa conti a mano');
assert.strictEqual(SI.people.find((p) => p.id === 'pj').img, 'c4');
assert.strictEqual(SI.people.find((p) => p.id === 'conti').img, 'c1');
assert.strictEqual(applyImg0(SI), false, 'non si ripete');
SI.people.find((p) => p.id === 'pj').img = '';
assert.strictEqual(applyImg0(SI), false, 'tolta a mano resta tolta');
assert.strictEqual(applyImg0(normState(JSON.parse(JSON.stringify(SI)))), false, 'anche dopo un backup');

// ---------- rifiuti: si espone la sera prima del ritiro ----------
const cfgR = normCfg({ rifiuti: { 1: ['organico', 'boh'], 2: ['plastica', 'vetro'], 4: ['carta'], 6: ['secco'] }, buttiamo: ['organico', 'secco', 'vetro', 'carta', 'plastica', 'pannolini'] });
assert.deepStrictEqual(cfgR.rifiuti[1], ['organico'], 'frazioni sconosciute scartate');
assert.deepStrictEqual(cfgR.rifiuti[2], ['vetro', 'plastica'], 'ordine fisso del calendario');
assert.ok(calPieno(cfgR)); assert.ok(!calPieno(normCfg({})));
// 2026-10-11 è domenica: la sera si espone l'organico del lunedì mattina
assert.deepStrictEqual(rifiutiSerata(cfgR, '2026-10-11'), ['organico']);
assert.deepStrictEqual(rifiutiSerata(cfgR, '2026-10-12'), ['vetro', 'plastica'], 'lunedì sera → ritiro di martedì');
assert.deepStrictEqual(rifiutiSerata(cfgR, '2026-10-13'), [], 'martedì sera: il mercoledì non passa nessuno');
assert.deepStrictEqual(prossimiRifiuti(cfgR, '2026-10-13'), { k: '2026-10-14', f: ['carta'] });
assert.deepStrictEqual(rifiutiSerata(cfgR, '2026-10-24'), [], 'sabato sera: la domenica non si ritira');
assert.deepStrictEqual(rifiutiSerata(cfgR, '2026-10-31'), [], 'fine mese: sabato 31 → domenica, niente');
assert.deepStrictEqual(rifiutiSerata(cfgR, '2026-11-01'), ['organico'], 'domenica 1 novembre → lunedì 2');
assert.strictEqual(prossimiRifiuti(normCfg({}), '2026-10-13'), null);
// il locale butta solo indifferenziata (secco), plastica e metalli, vetro: gli avvisi arrivano solo per queste
{
  const cfgB = normCfg({ rifiuti: { 1: ['organico', 'vetro'], 2: ['secco'], 3: ['organico'], 4: ['plastica'], 5: ['organico'], 6: ['carta'] } });
  assert.deepStrictEqual(cfgB.buttiamo, ['secco', 'vetro', 'plastica'], 'di partenza: le tre del locale');
  assert.deepStrictEqual(cfgB.rifiuti[1], ['organico', 'vetro'], 'il calendario del Comune resta intero');
  assert.deepStrictEqual(rifiutiSerata(cfgB, '2026-10-11'), ['vetro'], 'domenica sera: lunedì passano organico e vetro, fuori solo il vetro');
  assert.deepStrictEqual(rifiutiSerata(cfgB, '2026-10-12'), ['secco']);
  assert.deepStrictEqual(rifiutiSerata(cfgB, '2026-10-13'), [], 'martedì sera: il mercoledì c’è solo organico');
  assert.deepStrictEqual(rifiutiSerata(cfgB, '2026-10-14'), ['plastica']);
  assert.deepStrictEqual(rifiutiSerata(cfgB, '2026-10-16'), [], 'venerdì sera: il sabato c’è la carta, non la buttate');
  assert.deepStrictEqual(prossimiRifiuti(cfgB, '2026-10-14'), { k: '2026-10-18', f: ['vetro'] });
  assert.deepStrictEqual(normCfg({ buttiamo: [] }).buttiamo, [], 'nessuna: nessun avviso');
  assert.deepStrictEqual(normCfg({ buttiamo: ['plastica', 'boh', 'vetro'] }).buttiamo, ['vetro', 'plastica']);
  assert.deepStrictEqual(normCfg(JSON.parse(JSON.stringify(cfgB))), cfgB, 'stabile: niente rimbalzi tra telefoni');
}
assert.strictEqual(normCfg({ puliziaGiorni: 0 }).puliziaGiorni, 14);
assert.strictEqual(normCfg({ puliziaGiorni: '10' }).puliziaGiorni, 10);

const ST = seedState(1);
ST.trash = [
  { id: 't1', s: '2026-10-11', p: ['pj'], f: ['organico'], t: 1 },
  { id: 't2', s: '2026-10-12', p: ['pj', 'pesce'], f: ['vetro'], t: 2 },
  { id: 't3', s: '2026-09-28', p: ['conti'], f: ['carta'], t: 3 },
];
const spz = statSpazzatura(ST, 'mese', '2026-10-12');
assert.deepStrictEqual(spz.pj, { n: 2, ultima: '2026-10-12' });
assert.deepStrictEqual(spz.pesce, { n: 1, ultima: '2026-10-12' });
assert.ok(!spz.conti, 'settembre è fuori');
assert.strictEqual(statSpazzatura(ST, 'sempre', '2026-10-12').conti.n, 1);
const nt = normState({ people: [], products: [], moves: [], trash: [
  { s: '2026-10-12', p: ['pj'], f: ['vetro'], t: 5 }, { s: '2026-10-12', p: ['ciccio'], f: ['vetro'], t: 9 },
  { s: '2026-10-13', p: [], f: [] }, { s: 'ieri', p: ['pj'] }, { s: '2026-10-14', p: ['pj', 'pj'], f: ['plutonio'], t: 3 }] });
assert.strictEqual(nt.trash.length, 2, 'una sola uscita per serata, senza nomi niente');
assert.deepStrictEqual(nt.trash[0].p, ['ciccio'], 'vale l’ultima segnata');
assert.deepStrictEqual(nt.trash[1].p, ['pj']); assert.deepStrictEqual(nt.trash[1].f, []);

// ---------- pulizie: avviso dopo 14 giorni ----------
const SC = seedState(1);
assert.deepStrictEqual(pulizieStato(SC, L(2026, 10, 12, 22), 14).mai, true);
SC.cleanings = [{ id: 'c1', t: L(2026, 9, 20, 18), p: [] }, { id: 'c2', t: L(2026, 9, 28, 18), p: ['pj'] }];
let pu = pulizieStato(SC, L(2026, 10, 11, 17), 14);
assert.strictEqual(pu.giorni, 12); assert.strictEqual(pu.scadute, false); assert.strictEqual(pu.mancano, 2);
pu = pulizieStato(SC, L(2026, 10, 12, 18, 1), 14);
assert.strictEqual(pu.giorni, 14); assert.strictEqual(pu.scadute, true, 'dopo due settimane esce l’avviso');
assert.strictEqual(pulizieStato(SC, L(2026, 10, 12, 18, 1), 20).scadute, false, 'soglia dalle regole');
const nc = normState({ people: [], products: [], moves: [], cleanings: [{ t: 50, p: ['pj', 'pj'] }, { t: 0 }, null, { t: 10 }] });
assert.strictEqual(nc.cleanings.length, 2); assert.strictEqual(nc.cleanings[0].t, 10); assert.deepStrictEqual(nc.cleanings[1].p, ['pj']);

// ---------- calendario del centro precompilato (dalla foto) ----------
const { applyCal0, CAL0, SINTOMI0, topSintomo, sintomiDi } = extra;
const SK = seedState(1);
assert.ok(!calPieno(SK.cfg));
assert.strictEqual(applyCal0(SK), true);
assert.deepStrictEqual(SK.cfg.rifiuti[1], ['organico', 'vetro'], 'lunedì: organico e vetro');
assert.deepStrictEqual(SK.cfg.rifiuti[2], ['secco']);
assert.deepStrictEqual(SK.cfg.rifiuti[4], ['plastica']);
assert.deepStrictEqual(SK.cfg.rifiuti[6], ['carta']);
assert.ok(![1, 2, 3, 4, 5, 6].some((g) => SK.cfg.rifiuti[g].includes('pannolini')), 'pannolini fuori di default');
assert.deepStrictEqual(rifiutiSerata(SK.cfg, '2026-10-12'), ['secco'], 'lunedì sera: secco per il martedì');
assert.deepStrictEqual(rifiutiSerata(SK.cfg, '2026-10-11'), ['vetro'], 'domenica sera: per lunedì solo il vetro (l’organico il locale non lo butta)');
assert.strictEqual(applyCal0(SK), false, 'una volta sola');
const SK2 = seedState(1); SK2.cfg.rifiuti[3] = ['vetro'];
applyCal0(SK2);
assert.deepStrictEqual(SK2.cfg.rifiuti[1], [], 'un calendario già compilato a mano non si tocca');
SK.cfg.rifiuti = normCfg({}).rifiuti;
assert.strictEqual(applyCal0(normState(JSON.parse(JSON.stringify(SK)))), false, 'svuotato a mano resta vuoto, anche dopo un backup');
assert.ok(Object.keys(CAL0).length === 6);

// ---------- sintomi dell'oblio ----------
assert.ok(SINTOMI0.length >= 8);
assert.ok(SINTOMI0.includes('Richieste di essere ucciso'));
assert.ok(!SINTOMI0.some((s) => /uccidersi/i.test(s)));
assert.deepStrictEqual(normCfg({}).sintomi, SINTOMI0);
assert.deepStrictEqual(normCfg({ sintomi: [' Urla ', 'Urla', '', 'x'.repeat(60)] }).sintomi, ['Urla', 'x'.repeat(40)]);
assert.deepStrictEqual(normCfg({ sintomi: [] }).sintomi, [], 'lista svuotata a mano resta vuota');
const sy = voteSummary([{ v: 'pj', c: 'pesce', y: 'Urla strazianti' }, { v: 'conti', c: 'pesce', y: 'Urla strazianti' }, { v: 'ciccio', c: 'pesce', y: 'Grida silenziose' }, { v: 'pesce', c: 'ciccio' }]);
assert.strictEqual(topSintomo(sy.sint.pesce), 'Urla strazianti');
assert.strictEqual(topSintomo(sy.sint.ciccio), null);
const nyv = normState({ people: [], products: [], moves: [], votes: [{ s: '2026-10-12', v: 'pj', c: 'pesce', y: '  Silenzio assordante ', t: TV + 1 }, { s: '2026-10-12', v: 'conti', c: 'pesce', y: '', t: TV + 2 }] });
assert.strictEqual(nyv.votes[0].y, 'Silenzio assordante', 'un sintomo solo: resta testo, come lo leggono i telefoni non aggiornati');
assert.ok(!('ys' in nyv.votes[0]));
assert.ok(!('y' in nyv.votes[1]));
assert.deepStrictEqual(sintomiDi(nyv, 'pesce'), { 'Silenzio assordante': 1 });

// sintomi aggiunti dopo: arrivano a chi aveva la lista di partenza, non a chi l'ha cambiata
{
  const { applySintomi0 } = extra;
  const A = seedState(1); A.cfg.sintomi = SINTOMI0.slice(0, 10);
  assert.strictEqual(applySintomi0(A), true); assert.deepStrictEqual(A.cfg.sintomi, SINTOMI0);
  assert.strictEqual(applySintomi0(A), false);
  const B = seedState(1); B.cfg.sintomi = ['Solo questo'];
  applySintomi0(B); assert.deepStrictEqual(B.cfg.sintomi, ['Solo questo']);
  const C = seedState(1); applySintomi0(C); assert.deepStrictEqual(C.cfg.sintomi, SINTOMI0);
}
// ---------- più sintomi nello stesso voto ----------
{
  const { topSintomi, sintomiVoto, metiSintomi } = extra;
  assert.deepStrictEqual(sintomiVoto({ y: 'Urla' }), ['Urla']);
  assert.deepStrictEqual(sintomiVoto({}), []);
  assert.deepStrictEqual(sintomiVoto({ y: 'A', ys: ['A', 'B'] }), ['A', 'B']);
  assert.deepStrictEqual(sintomiVoto({ y: ['A', 'B'] }), ['A', 'B'], 'formato della 0.5.0');
  const v1 = {}; metiSintomi(v1, ['A', 'B']); assert.deepStrictEqual(v1, { y: 'A', ys: ['A', 'B'] });
  metiSintomi(v1, ['C']); assert.deepStrictEqual(v1, { y: 'C' });
  metiSintomi(v1, []); assert.deepStrictEqual(v1, {});
  const mm = voteSummary([
    { v: 'pj', c: 'pesce', y: 'Urla strazianti', ys: ['Urla strazianti', 'Silenzio assordante'] },
    { v: 'conti', c: 'pesce', y: ['Silenzio assordante'] },            // salvato dalla 0.5.0
    { v: 'chicco', c: 'pesce', y: 'Urla strazianti' },                 // salvato da una versione vecchia
    { v: 'ciccio', c: 'pesce', y: 'Giocare alle slot' },
    { v: 'ciccio', c: 'conti', y: 'Dormire al locale' },               // ciccio cambia voto: contano solo i sintomi dell'ultimo
  ]);
  assert.strictEqual(mm.tally.pesce, 3);
  assert.deepStrictEqual(mm.sint.pesce, { 'Urla strazianti': 2, 'Silenzio assordante': 2 });
  assert.deepStrictEqual(topSintomi(mm.sint.pesce, 3), ['Urla strazianti', 'Silenzio assordante'], 'pari merito: tutti e due');
  assert.deepStrictEqual(topSintomi(mm.sint.conti, 3), ['Dormire al locale']);
  assert.deepStrictEqual(topSintomi({ a: 3, b: 1 }, 3), ['a']);
  assert.deepStrictEqual(topSintomi({}, 3), []);
  assert.deepStrictEqual(topSintomi(undefined, 3), []);
  assert.strictEqual(topSintomi({ a: 1, b: 1, c: 1, d: 1 }, 3).length, 3, 'al massimo tre a pari merito');
  assert.strictEqual(topSintomo(mm.sint.pesce), 'Urla strazianti');
  // salvataggio: primo sintomo in «y» (testo), lista pulita in «ys» se sono più di uno; al massimo 12 da 40 caratteri
  const ny = normState({ people: [], products: [], moves: [], votes: [
    { s: '2026-10-12', v: 'pj', c: 'pesce', y: 'Urla', ys: [' Urla ', 'Urla', '', null, 'x'.repeat(50)], t: TV + 1 },
    { s: '2026-10-12', v: 'conti', c: 'pesce', y: [], t: TV + 2 },
    { s: '2026-10-12', v: 'chicco', c: 'pesce', y: 'S0', ys: Array.from({ length: 20 }, (_, i) => 'S' + i), t: TV + 3 },
    { s: '2026-10-12', v: 'ciccio', c: 'pesce', y: ['Dormire al locale', 'Giocare alle slot'], t: TV + 4 },   // 0.5.0
    { s: '2026-10-12', v: 'conti2', c: 'pesce', y: ['Stato depressivo'], t: TV + 5 },                          // 0.5.0, uno solo
  ] });
  assert.strictEqual(ny.votes[0].y, 'Urla'); assert.deepStrictEqual(ny.votes[0].ys, ['Urla', 'x'.repeat(40)]);
  assert.ok(!('y' in ny.votes[1]) && !('ys' in ny.votes[1]), 'lista vuota: niente campi');
  assert.strictEqual(ny.votes[2].ys.length, 12); assert.strictEqual(ny.votes[2].y, 'S0');
  assert.strictEqual(ny.votes[3].y, 'Dormire al locale'); assert.deepStrictEqual(ny.votes[3].ys, ['Dormire al locale', 'Giocare alle slot']);
  assert.strictEqual(ny.votes[4].y, 'Stato depressivo'); assert.ok(!('ys' in ny.votes[4]));
  assert.ok(ny.votes.every((v) => v.y == null || typeof v.y === 'string'), '«y» resta sempre testo');
  assert.deepStrictEqual(sintomiDi(ny, 'pesce').Urla, 1);
  assert.strictEqual(sintomiDi(ny, 'pesce').S0, 1);
  // il salvataggio non cambia un voto già pulito (niente rimbalzi tra telefoni)
  assert.deepStrictEqual(normState(JSON.parse(JSON.stringify(ny))).votes, ny.votes);
}

// ---------- soldi del locale: attuale (cassa + scorte) e previsionale (con graffi e crediti) ----------
{
  const { previsione } = extra;
  const P0 = seedState(1);
  const id = (n) => P0.products.find((p) => p.name === n).id;
  const b = id('Birra'), k = id('Kit Kat'), c = id('Coca Cola lattina');
  let tt = TV + 10;
  const add = (o) => { const x = Object.assign({ id: 'q' + tt, t: tt++ }, o); P0.moves.push(x); return x; };
  const vuota = previsione(P0, derive(P0));
  assert.strictEqual(vuota.attuale, 0); assert.strictEqual(vuota.previsionale, 0); assert.strictEqual(vuota.righe.length, 0);
  assert.strictEqual(vuota.nonContati, P0.products.length, 'all’inizio nessun prodotto è contato');
  add({ k: 'in', a: 5000 });
  add({ k: 'inv', a: 0, items: [{ id: b, n: 'Birra', q: 10, pr: 100 }, { id: k, n: 'Kit Kat', q: 4, pr: 150 }, { id: c, n: 'Coca Cola lattina', q: 1, pr: 120 }] });
  const graffio = add({ k: 'tab', p: 'pesce', a: 300, items: [{ id: b, n: 'Birra', q: 3, pr: 100 }] });   // birre 7, PESCE deve 3 €
  add({ k: 'sale', p: 'conti', a: 240, items: [{ id: c, n: 'Coca Cola lattina', q: 2, pr: 120 }] });   // coca a −1
  add({ k: 'exp', a: 900, paidBy: 'chicco', settle: 'debito' });                                         // CHICCO in credito di 9 €
  const pr = previsione(P0, derive(P0));
  assert.strictEqual(pr.cassa, 5240);
  assert.strictEqual(pr.scorte, 7 * 100 + 4 * 150, 'la coca sotto zero vale zero, non meno');
  assert.strictEqual(pr.attuale, 5240 + 1300, 'attuale: cassa + scorte, senza graffi');
  assert.strictEqual(pr.incassare, 300); assert.strictEqual(pr.nInc, 1);
  assert.strictEqual(pr.restituire, 900); assert.strictEqual(pr.nRes, 1);
  assert.strictEqual(pr.previsionale, pr.attuale + 300 - 900, 'previsionale: in più i graffi, meno i crediti');
  assert.deepStrictEqual(pr.righe.map((r) => [r.n, r.q, r.v]), [['Birra', 7, 700], ['Kit Kat', 4, 600]], 'ordinate per valore');
  assert.strictEqual(pr.negativi, 1);
  assert.strictEqual(pr.nonContati, P0.products.length - 3);
  assert.strictEqual(pr.nCosto, 0); assert.strictEqual(pr.scorteCosto, 0);
  // costi d'acquisto noti (dagli scontrini): scorte anche a costo, e margine
  P0.products.find((p) => p.id === b).cost = 60;
  const prC = previsione(P0, derive(P0));
  assert.strictEqual(prC.scorteCosto, 7 * 60); assert.strictEqual(prC.margine, 7 * 40); assert.strictEqual(prC.nCosto, 1);
  assert.strictEqual(prC.attuale, pr.attuale, 'il totale resta a prezzo di vendita');
  // un prodotto fuori listino ma ancora in magazzino conta; uno fuori listino mai contato non è «da contare»
  P0.products.find((p) => p.id === k).on = false;
  assert.strictEqual(previsione(P0, derive(P0)).scorte, 1300);
  P0.products.find((p) => p.id === id('Mars')).on = false;
  assert.strictEqual(previsione(P0, derive(P0)).nonContati, P0.products.length - 3 - 1);
  // annullare il graffio: niente da incassare, le birre tornano in magazzino
  graffio.x = { t: 99 };
  const pr2 = previsione(P0, derive(P0));
  assert.strictEqual(pr2.incassare, 0); assert.strictEqual(pr2.nInc, 0);
  assert.strictEqual(pr2.scorte, 10 * 100 + 4 * 150);
  // cassa in rosso: i totali possono essere negativi, nessuna somma nascosta
  add({ k: 'exp', a: 20000, paidBy: 'cassa' });
  const pr4 = previsione(P0, derive(P0));
  assert.strictEqual(pr4.attuale, pr4.cassa + pr4.scorte); assert.ok(pr4.attuale < 0);
  assert.strictEqual(pr4.previsionale, pr4.attuale + pr4.incassare - pr4.restituire);
}

// ---------- chi dà più del conto: la differenza scala i graffi, oltre va in credito ----------
{
  const PD = seedState(1);
  PD.moves.push({ id: 'd1', t: TV + 1, k: 'tab', p: 'pesce', a: 500, items: [{ n: 'Birra', q: 5, pr: 100 }] });
  // paga una consumazione da 3,30 dando 5 €: 3,30 la consumazione, 1,70 sui graffi (come fa la Farmacia)
  PD.moves.push({ id: 'd2', t: TV + 2, k: 'sale', p: 'pesce', a: 330, items: [{ n: 'Birra', q: 2, pr: 100 }, { n: 'Kinder Bueno', q: 1, pr: 130 }] });
  PD.moves.push({ id: 'd3', t: TV + 3, k: 'pay', p: 'pesce', a: 170, note: 'Dato in più pagando una consumazione' });
  let DD = derive(PD);
  assert.strictEqual(DD.cash, 500, 'in cassa entra tutto quello che ha dato');
  assert.strictEqual(DD.debt.pesce, 330, 'graffi scesi da 5,00 a 3,30');
  // poi dà 10 € per 1 €: 3,30 chiudono i graffi, 5,70 in credito
  PD.moves.push({ id: 'd4', t: TV + 4, k: 'sale', p: 'pesce', a: 100, items: [{ n: 'Birra', q: 1, pr: 100 }] });
  PD.moves.push({ id: 'd5', t: TV + 5, k: 'pay', p: 'pesce', a: 900 });
  DD = derive(PD);
  assert.strictEqual(DD.debt.pesce, -570, 'oltre i graffi resta in credito');
  assert.strictEqual(DD.units.pesce || 0, 0, 'nessuna tacca aperta');
  assert.strictEqual(DD.cash, 1500);
}

// ---------- scontrini: dal testo letto alle righe ----------
{
  const { leggiScontrino, propostaScontrino, abbinaRiga, applicaScontrino, confezione, nomeProposto, ricordaAlias, chiaveScontrino } = extra;
  const fx = (n) => fs.readFileSync(path.join(__dirname, 'fixtures', 'ocr', n + '.txt'), 'utf8');
  const { DESPAR, CONAD } = require('./scontrini.js');
  const riga = (l) => l.righe.map((r) => [r.d, r.q, r.tot]);
  const despar = [['COCA COLA LATTINA 33CL', 1, 89], ['KINDER BUENO T2', 2, 158], ['BIRRA PERONI 66CL', 1, 119], ['PATATINE CIPSTER 85G', 1, 119], ['SACCHI NERI 50PZ', 1, 249], ['ESTATHE PESCA 33CL', 1, 79]];
  const conad = [['FONZIES 100G', 1, 169], ['MARS X4', 1, 299], ['ACQUA NATURALE 2L', 3, 330], ['NUTELLA B-READY T6', 1, 349], ['KIT KAT 41,5G', 1, 110]];
  // testo pulito: quantità sopra l'articolo («2 x 0,79»), sconto, totale, negozio e data
  let l = leggiScontrino(DESPAR.join('\n'));
  assert.deepStrictEqual(riga(l), despar);
  assert.strictEqual(l.totale, 813); assert.ok(l.coerente); assert.strictEqual(l.negozio, 'DESPAR ALTAMURA'); assert.strictEqual(l.data, '12/10/2026');
  l = leggiScontrino(CONAD.join('\n'));
  assert.deepStrictEqual(riga(l), conad); assert.strictEqual(l.totale, 1257); assert.strictEqual(l.data, '13/10/2026');
  // letture vere del motore su foto di prova (ombra, carattere diverso): stesse righe
  assert.deepStrictEqual(riga(leggiScontrino(fx('despar-ombra-2'))), despar);
  assert.deepStrictEqual(riga(leggiScontrino(fx('conad-free-2'))), conad);
  assert.deepStrictEqual(riga(leggiScontrino(fx('conad-ombra-0'))).map((r) => r[2]), [169, 299, 330, 349, 110]);
  // cifre in più davanti al prezzo («60,79» per «0,79»): il totale stampato permette di correggerle, e restano da verificare
  const rip = leggiScontrino(fx('despar-piccolo-2'));
  assert.ok(rip.coerente); assert.strictEqual(rip.somma, 813);
  assert.deepStrictEqual(rip.righe.filter((r) => r.corretta).map((r) => r.d), ['COCA COLA LATTINA 33CL', 'ESTATHE PESCA 33CL']);
  const rip0 = leggiScontrino(fx('despar-piccolo-0'));   // anche uno sconto letto «6,20» invece di «-0,20»
  assert.ok(rip0.coerente); assert.strictEqual(rip0.righe.length, 6);
  // altri formati: quantità sotto l'articolo, quantità con il totale sulla riga dopo la descrizione, totale da contanti − resto
  l = leggiScontrino(['BIRRA MORETTI 33CL   1,50', '3 x 0,50', 'MARS              1,00', 'KINDER BUENO', '2 x 0,90          1,80', 'CONTANTE 10,00', 'RESTO 5,70'].join('\n'));
  assert.deepStrictEqual(riga(l), [['BIRRA MORETTI 33CL', 3, 150], ['MARS', 1, 100], ['KINDER BUENO', 2, 180]]);
  assert.strictEqual(l.totale, 430); assert.ok(l.coerente);
  assert.deepStrictEqual(riga(leggiScontrino('ACQUA 1,5L € 0,35\n0,350 kg x 2,90 €/kg\nPANE 1,02 B\nTOTALE EURO 1,37')), [['ACQUA 1,5L', 1, 35], ['PANE', 1, 102]]);
  l = leggiScontrino('niente di utile qui\n12/10/2026');
  assert.strictEqual(l.righe.length, 0); assert.strictEqual(l.totale, null); assert.ok(!l.coerente);
  assert.deepStrictEqual(leggiScontrino('').righe, []);
  // abbinamento al listino
  const SL = seedState(1);
  const nome = (r) => (r ? SL.products.find((p) => p.id === r.id).name : null);
  assert.strictEqual(nome(abbinaRiga('COCA COLA LATTINA 33CL', SL.products)), 'Coca Cola lattina');
  assert.strictEqual(nome(abbinaRiga('KINDFR BUENO T2', SL.products)), 'Kinder Bueno', 'una lettera sbagliata');
  assert.strictEqual(nome(abbinaRiga('BIRRA PERONI 66CL', SL.products)), 'Birra');
  assert.strictEqual(nome(abbinaRiga('ESTATHE PESCA 33CL', SL.products)), 'Estathé limone / pesca', 'accenti e parole in più');
  assert.strictEqual(abbinaRiga('SACCHI NERI 50PZ', SL.products), null, 'non è nel listino');
  assert.strictEqual(abbinaRiga('ACQUA NATURALE 2L', SL.products), null, 'una parola su tre non basta: decide chi conferma');
  // dopo la conferma l'app ricorda come compare sullo scontrino, con i pezzi per confezione
  const acqua = SL.products.find((p) => p.name === 'Acqua liscia / frizzante');
  ricordaAlias(SL.products, acqua.id, 'ACQUA NATURALE 2L', 6);
  assert.deepStrictEqual(abbinaRiga('acqua naturale 2l', SL.products), { id: acqua.id, k: 6, s: 2 });
  const birraId = SL.products.find((p) => p.name === 'Birra').id;
  ricordaAlias(SL.products, birraId, 'ACQUA NATURALE 2L', 1);
  assert.ok(!acqua.al, 'una descrizione appartiene a un solo prodotto');
  assert.strictEqual(abbinaRiga('ACQUA NATURALE 2L', SL.products).id, birraId);
  assert.strictEqual(confezione('MARS X4'), 4); assert.strictEqual(confezione('NUTELLA B-READY T6'), 6); assert.strictEqual(confezione('PERONI 3X33CL'), 3);
  assert.strictEqual(confezione('COCA COLA 33CL'), 1); assert.strictEqual(confezione('ACQUA X 50'), 1);
  assert.strictEqual(nomeProposto('SACCHI NERI 50PZ'), 'Sacchi neri'); assert.strictEqual(nomeProposto('PERONI 3X33CL 66CL'), 'Peroni 3x33cl');
  assert.strictEqual(chiaveScontrino(' Kinder  Buenò, T2 '), 'KINDER BUENO T2');
  // proposta: prodotti riconosciuti, pezzi dagli alias, confezione suggerita
  const pp = propostaScontrino(leggiScontrino(CONAD.join('\n')), SL.products);
  assert.deepStrictEqual(pp.map((r) => [nome(r.prod && { id: r.prod }), r.pezzi, r.conf]), [['Fonzies', 1, 1], ['Mars', 1, 4], ['Birra', 3, 1], ['Nutella B-Ready', 1, 6], ['Kit Kat', 1, 1]]);
  // registrazione: prodotti nuovi, costo al pezzo, alias, carico e spesa (una sola volta, tutto confermato)
  const SR = seedState(1), mars = SR.products.find((p) => p.name === 'Mars'), kitkat = SR.products.find((p) => p.name === 'Kit Kat');
  SR.moves.push({ id: 'i0', t: TV, k: 'inv', a: 0, items: [{ id: mars.id, n: 'Mars', q: 2, pr: 100 }] });
  let n = 0;
  const r = applicaScontrino(SR, [
    { tipo: 'prod', prod: mars.id, d: 'MARS X4', q: 1, pezzi: 4, spesa: 299 },
    { tipo: 'prod', prod: mars.id, d: 'MARS SINGOLO', q: 2, pezzi: 2, spesa: 160 },
    { tipo: 'nuovo', nome: 'Gin tonic', cat: 'Bevande', prezzo: 500, d: 'GIN TONIC 20CL', q: 2, pezzi: 2, spesa: 400 },
    { tipo: 'altro', d: 'SACCHI NERI 50PZ', q: 1, spesa: 249 },
    { tipo: 'no', d: 'SIGARETTE', q: 1, spesa: 600 },
    { tipo: 'prod', prod: kitkat.id, d: 'KIT KAT', q: 1, pezzi: 1, spesa: 0 },
  ], { negozio: 'CONAD CITY', data: '13/10/2026', spesa: true, by: 'chicco', settle: 'dividi', tra: ['pj', 'pesce'] }, TV + 100, () => 'x' + (++n));
  assert.strictEqual(r.totale, 299 + 160 + 400 + 249 + 0, 'le escluse non contano, le altre spese sì');
  assert.strictEqual(r.nuovi.length, 1); assert.strictEqual(r.pezzi, 4 + 2 + 2 + 1);
  const gin = SR.products.find((p) => p.name === 'Gin tonic');
  assert.deepStrictEqual([gin.price, gin.cost, gin.cat, gin.on, gin.min], [500, 200, 'Bevande', true, null]);
  assert.strictEqual(mars.cost, Math.round((299 + 160) / 6), 'costo al pezzo pesato sulle due righe');
  assert.strictEqual(kitkat.cost, 0);
  assert.deepStrictEqual(mars.al, [{ d: 'MARS X4', k: 4 }, { d: 'MARS SINGOLO', k: 1 }]);
  assert.deepStrictEqual(r.mosse.map((m) => m.k), ['load', 'exp']);
  const ex = r.mosse[1];
  assert.deepStrictEqual([ex.a, ex.paidBy, ex.settle, ex.note, ex.cat], [1108, 'chicco', 'dividi', 'Scontrino CONAD CITY del 13/10/2026', 'Rifornimento bar']);
  assert.deepStrictEqual(ex.shares, { pj: 554, pesce: 554 });
  const DR = derive(SR);
  assert.strictEqual(DR.stock[mars.id], 2 + 6); assert.strictEqual(DR.stock[gin.id], 2); assert.strictEqual(DR.stock[kitkat.id], 1);
  assert.strictEqual(DR.debt.chicco, -1108 + 0); assert.strictEqual(DR.debt.pj, 554); assert.strictEqual(DR.cash, 0, 'pagata da CHICCO: la cassa non cambia');
  // tutto sopravvive al salvataggio (costi, alias e costo nel carico)
  const SN = normState(JSON.parse(JSON.stringify(SR)));
  assert.deepStrictEqual(SN.products.find((p) => p.id === mars.id), mars);
  assert.strictEqual(SN.moves.find((m) => m.k === 'load').items[0].c, mars.cost);
  // senza spesa: solo carico; pagata dalla cassa: esce dalla cassa
  const S2 = seedState(1);
  const r2 = applicaScontrino(S2, [{ tipo: 'prod', prod: birraId, d: 'BIRRA', q: 6, pezzi: 6, spesa: 480 }], { spesa: false }, TV + 5, () => 'y' + (++n));
  assert.deepStrictEqual(r2.mosse.map((m) => m.k), ['load']);
  const r3 = applicaScontrino(S2, [{ tipo: 'altro', d: 'SCOPA', q: 1, spesa: 350 }], { spesa: true, by: 'cassa' }, TV + 6, () => 'z' + (++n));
  assert.deepStrictEqual(r3.mosse.map((m) => [m.k, m.a, m.paidBy]), [['exp', 350, 'cassa']]);
  assert.strictEqual(derive(S2).cash, -350);
}

// ---------- dati che arrivano da versioni più nuove: i campi sconosciuti restano ----------
{
  const raw = { people: [{ id: 'pj', name: 'PJ', soprannome: 'Il dottore' }], products: [{ id: 'p1', name: 'Birra', cat: 'Bevande', price: 100, scaffale: 'B2', al: [{ d: 'birra', k: 0 }, { d: 'BIRRA' }, 'x'] }],
    moves: [{ id: 'm1', t: TV, k: 'in', a: 100, cassetto: 2, items: [{ id: 'p1', n: 'Birra', q: 1, pr: 100, c: 60, lotto: 'A' }] }],
    votes: [{ id: 'v1', s: '2026-10-13', v: 'pj', c: 'pesce', t: TV + 1, nota: 'grave' }], cfg: { voteCut: 6, tema: 'notte', 'chiave strana': 1, Maiuscola: 2 } };
  const N = normState(raw);
  assert.strictEqual(N.people[0].soprannome, 'Il dottore');
  assert.strictEqual(N.products[0].scaffale, 'B2');
  assert.deepStrictEqual(N.products[0].al, [{ d: 'BIRRA', k: 1 }], 'alias puliti: uno per descrizione, pezzi almeno 1');
  assert.strictEqual(N.moves[0].cassetto, 2); assert.strictEqual(N.moves[0].items[0].c, 60);
  assert.strictEqual(N.votes[0].nota, 'grave');
  assert.strictEqual(N.cfg.tema, 'notte'); assert.ok(!('chiave strana' in N.cfg) && !('Maiuscola' in N.cfg));
  assert.deepStrictEqual(normState(JSON.parse(JSON.stringify(N))), N, 'stabile: niente rimbalzi tra telefoni');
  const grosso = normState({ people: [], products: [{ id: 'p1', name: 'X', enorme: 'x'.repeat(5000) }], moves: [] });
  assert.ok(!('enorme' in grosso.products[0]), 'campi troppo grandi scartati');
}

// ---------- voti azzerati alla 0.6.0: spariscono quelli di prima, restano i nuovi; tutto il resto non si tocca ----------
{
  const raw = seedState(1);
  raw.votes = [{ id: 'vecchio', s: '2026-10-11', v: 'pj', c: 'pesce', t: TV - 3600e3 }, { id: 'nuovo', s: '2026-10-12', v: 'pesce', c: 'conti', t: TV + 60e3 }];
  raw.moves = [{ id: 'm', t: TV - 864e5, k: 'tab', p: 'pesce', a: 300, items: [{ n: 'Birra', q: 3, pr: 100 }] }];
  raw.trash = [{ id: 'r', s: '2026-10-10', p: ['pj'], f: ['vetro'], t: TV - 864e5 }];
  const N = normState(JSON.parse(JSON.stringify(raw)));
  assert.deepStrictEqual(N.votes.map((v) => v.id), ['nuovo']);
  assert.strictEqual(N.moves.length, 1, 'i movimenti di prima restano'); assert.strictEqual(N.trash.length, 1);
  assert.strictEqual(derive(N).debt.pesce, 300);
}

console.log('calcoli: tutto torna (' + S.moves.length + ' movimenti di prova, più voto, freccette, classifiche, rifiuti e pulizie)');
