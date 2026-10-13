// Prove dei calcoli nuovi della 0.7.0: prezzi storici, graffi vecchi, quota del locale, voto a più persone,
// statistiche del mese, record delle freccette, medaglie, albo d'oro, compleanni, verifica del mese.
process.env.TZ = 'Europe/Rome';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const pure = require('./pure.js');
const A = pure(`{seedState,normState,derive,previsione,graffiVecchi,prezzoAl,cambiaPrezzo,statoQuote,quoteArretrate,totArretrato,scadenzaQuota,
  candidatiVoto,sintomiPer,metiVoto,voteSummary,sintomiDi,serateChiuse,statMese,recordFreccette,medaglie,MEDAGLIE,alboOro,
  prossimiCompleanni,normNato,spiegaVerifica,normCfg,impronta,VOTI_DAL,CFG0,serata,ymd,canon,normEnt,inPer,statRe}`);

const DAY = 864e5;
const T0 = Date.parse('2026-11-02T20:00:00+01:00');   // lunedì 2 novembre 2026, sera
const oggi = (t) => A.ymd(new Date(t));

/* ---------- prezzi storici ---------- */
{
  const S = A.seedState(1);
  const birra = S.products.find((p) => p.name === 'Birra');
  S.moves.push({ id: 'i1', t: T0, k: 'inv', a: 0, items: [{ id: birra.id, n: 'Birra', q: 10, pr: 100 }] });
  S.moves.push({ id: 't1', t: T0 + 1000, k: 'tab', p: 'pesce', a: 200, items: [{ id: birra.id, n: 'Birra', q: 2, pr: 100 }] });
  const prima = A.derive(S);
  assert.strictEqual(A.cambiaPrezzo(birra, 150, T0 + 5000), true);
  assert.strictEqual(A.cambiaPrezzo(birra, 150, T0 + 6000), false, 'stesso prezzo: niente storico');
  assert.deepStrictEqual(birra.ph, [{ t: T0 + 5000, da: 100 }]);
  assert.deepStrictEqual(A.derive(S), prima, 'cambiare prezzo non tocca i conti già fatti');
  assert.strictEqual(A.prezzoAl(birra, T0), 100);
  assert.strictEqual(A.prezzoAl(birra, T0 + 5000), 150, 'dal momento del cambio vale il prezzo nuovo');
  assert.strictEqual(A.prezzoAl(birra, T0 + 9000), 150);
  A.cambiaPrezzo(birra, 120, T0 + 9000);
  assert.strictEqual(A.prezzoAl(birra, T0 + 6000), 150);
  assert.strictEqual(A.prezzoAl(birra, T0 + 1), 100);
  const N = A.normState(JSON.parse(JSON.stringify(S)));
  assert.deepStrictEqual(N.products.find((p) => p.id === birra.id).ph, [{ t: T0 + 5000, da: 100 }, { t: T0 + 9000, da: 150 }]);
  // la consumazione dopo il cambio usa il prezzo nuovo, quelle di prima restano com'erano
  S.moves.push({ id: 't2', t: T0 + 10000, k: 'tab', p: 'pesce', a: 120, items: [{ id: birra.id, n: 'Birra', q: 1, pr: 120 }] });
  assert.strictEqual(A.derive(S).debt.pesce, 320);
}

/* ---------- graffi vecchi: dal più vecchio, i pagamenti chiudono prima quelli ---------- */
{
  const S = A.seedState(1);
  S.moves.push({ id: 'a', t: T0 - 40 * DAY, k: 'tab', p: 'conti', a: 300, items: [] });
  S.moves.push({ id: 'b', t: T0 - 35 * DAY, k: 'dplus', p: 'conti', a: 200 });
  S.moves.push({ id: 'c', t: T0 - 5 * DAY, k: 'tab', p: 'conti', a: 150, items: [] });
  S.moves.push({ id: 'd', t: T0 - 2 * DAY, k: 'pay', p: 'conti', a: 350 });
  S.moves.push({ id: 'e', t: T0 - 50 * DAY, k: 'tab', p: 'pj', a: 100, items: [] });
  S.moves.sort((x, y) => x.t - y.t);
  S.moves.push({ id: 'f', t: T0 - 1 * DAY, k: 'pay', p: 'pj', a: 100 });
  const D = A.derive(S);
  assert.deepStrictEqual(D.open.conti, [{ rem: 150, t: T0 - 35 * DAY }, { rem: 150, t: T0 - 5 * DAY }]);
  const v = A.graffiVecchi(D, T0, 30);
  assert.deepStrictEqual(v.conti, { a: 150, da: T0 - 35 * DAY, giorni: 35 });
  assert.ok(!v.pj, 'chi ha saldato non compare');
  assert.ok(!A.graffiVecchi(D, T0, 40).conti, 'con 40 giorni non è ancora vecchio');
  // credito: un graffio coperto dal credito non è aperto
  S.moves.push({ id: 'g', t: T0, k: 'pay', p: 'chicco', a: 500 });
  S.moves.push({ id: 'h', t: T0 + 1, k: 'tab', p: 'chicco', a: 200, items: [] });
  assert.ok(!A.derive(S).open.chicco);
}

/* ---------- quota del locale ---------- */
{
  const S = A.seedState(1);
  const sei = ['pj', 'pesce', 'ciccio', 'peppecarlo', 'conti', 'chicco'];
  S.quote.push({ id: 'q2026-11', mese: '2026-11', a: 6000, chi: sei, note: 'affitto + luce', t: T0 - 10 * DAY });
  S.moves.push({ id: 'q1', t: Date.parse('2026-10-22T19:00:00+02:00'), k: 'qin', p: 'pj', a: 6000, mese: '2026-11' });
  S.moves.push({ id: 'q2', t: Date.parse('2026-10-25T19:00:00+01:00'), k: 'qin', p: 'pesce', a: 2000, mese: '2026-11' });
  S.moves.push({ id: 'q3', t: Date.parse('2026-10-26T19:00:00+01:00'), k: 'qin', p: 'conti', a: 7000, mese: '2026-11' });
  S.moves.push({ id: 's1', t: Date.parse('2026-10-26T20:00:00+01:00'), k: 'sale', p: 'pj', a: 100, items: [] });
  let D = A.derive(S);
  assert.strictEqual(D.fondo, 15000, 'il fondo raccoglie le quote');
  assert.strictEqual(D.cash, 100, 'la quota non entra in cassa');
  assert.ok(!D.debt.pj && !D.debt.pesce, 'e non è un graffio');
  let st = A.statoQuote(S, D, '2026-10-31')[0];
  assert.strictEqual(st.scad, '2026-11-01');
  assert.strictEqual(st.scaduta, false);
  assert.deepStrictEqual(st.mancano, ['pesce', 'ciccio', 'peppecarlo', 'chicco']);
  assert.strictEqual(st.righe.find((r) => r.p === 'conti').piu, 1000, 'chi mette di più: si vede');
  assert.strictEqual(st.versato, 6000 + 2000 + 6000);
  assert.deepStrictEqual(A.quoteArretrate(S, D, '2026-11-01'), {}, 'il primo del mese è ancora in tempo');
  const arr = A.quoteArretrate(S, D, '2026-11-02');
  assert.deepStrictEqual(arr.pesce, [{ mese: '2026-11', a: 4000 }], 'dopo la scadenza il resto finisce nei graffi, a parte');
  assert.strictEqual(A.totArretrato(arr.ciccio), 6000);
  assert.ok(!arr.pj && !arr.conti);
  // uscita: l'affitto pagato
  S.moves.push({ id: 'q9', t: Date.parse('2026-11-01T10:00:00+01:00'), k: 'qout', a: 12000, note: 'Affitto novembre', mese: '2026-11' });
  D = A.derive(S);
  assert.strictEqual(D.fondo, 3000);
  assert.strictEqual(D.cash, 100);
  // normalizzazione: una sola quota per mese, id fisso
  const N = A.normState(Object.assign(JSON.parse(JSON.stringify(S)), { quote: [S.quote[0], { mese: '2026-11', a: 6500, chi: sei, t: T0 }, { mese: 'boh', a: 1, chi: sei }] }));
  assert.strictEqual(N.quote.length, 1);
  assert.strictEqual(N.quote[0].a, 6500, 'vince la più recente');
  assert.strictEqual(N.quote[0].id, 'q2026-11');
  assert.strictEqual(N.moves.find((x) => x.id === 'q1').mese, '2026-11');
}

/* ---------- voto a più persone ---------- */
{
  const k = '2026-11-02', t = Math.max(T0, A.VOTI_DAL + 1);
  const v1 = { id: 'v' + k + '_pj', s: k, v: 'pj', t };
  A.metiVoto(v1, ['pesce', 'conti', 'chicco'], { pesce: ['Urla strazianti'], chicco: ['Dormire al locale', 'Stato depressivo'] });
  assert.strictEqual(v1.c, 'pesce', 'il primo votato resta in «c» per i telefoni vecchi');
  assert.strictEqual(v1.y, 'Urla strazianti');
  assert.deepStrictEqual(v1.cs, ['pesce', 'conti', 'chicco']);
  assert.deepStrictEqual(v1.cy, { pesce: ['Urla strazianti'], chicco: ['Dormire al locale', 'Stato depressivo'] });
  const v2 = { id: 'v' + k + '_conti', s: k, v: 'conti', t: t + 1 };
  A.metiVoto(v2, ['pesce'], { pesce: [] });
  assert.ok(!('cs' in v2) && !('cy' in v2) && !('y' in v2), 'un votato solo: formato di prima');
  const sm = A.voteSummary([v1, v2]);
  assert.deepStrictEqual(sm.tally, { pesce: 2, conti: 1, chicco: 1 });
  assert.deepStrictEqual(sm.winners, ['pesce']);
  assert.strictEqual(sm.n, 2, 'due votanti');
  assert.strictEqual(sm.voti, 4, 'quattro voti in tutto');
  assert.deepStrictEqual(sm.by.pj, ['pesce', 'conti', 'chicco']);
  assert.deepStrictEqual(sm.sint.chicco, { 'Dormire al locale': 1, 'Stato depressivo': 1 });
  // normalizzazione stabile
  const S = A.seedState(1); S.votes.push(v1, v2);
  const N = A.normState(JSON.parse(JSON.stringify(S)));
  assert.strictEqual(A.canon(N.votes), A.canon(S.votes.slice().sort((a, b) => a.t - b.t)));
  assert.deepStrictEqual(A.sintomiDi(N, 'chicco'), { 'Dormire al locale': 1, 'Stato depressivo': 1 });
  // un telefono non aggiornato cambia il voto: tocca solo «c» e «y»; il nuovo votato va primo, gli altri restano
  const vecchio = JSON.parse(JSON.stringify(v1)); vecchio.c = 'ciccio'; vecchio.y = 'Grida silenziose';
  const n1 = A.normState(Object.assign(A.seedState(1), { votes: [vecchio] })).votes[0];
  assert.deepStrictEqual(A.candidatiVoto(n1), ['ciccio', 'conti', 'chicco']);
  assert.deepStrictEqual(A.sintomiPer(n1, 'ciccio'), ['Grida silenziose']);
  assert.deepStrictEqual(A.sintomiPer(n1, 'chicco'), ['Dormire al locale', 'Stato depressivo']);
  // ... o sceglie uno già votato: passa primo
  const vecchio2 = JSON.parse(JSON.stringify(v1)); vecchio2.c = 'chicco'; delete vecchio2.y;
  const n2 = A.normState(Object.assign(A.seedState(1), { votes: [vecchio2] })).votes[0];
  assert.deepStrictEqual(A.candidatiVoto(n2), ['chicco', 'pesce', 'conti']);
  assert.deepStrictEqual(A.sintomiPer(n2, 'chicco'), [], 'i sintomi del primo sono quelli di «y»');
  // codici rossi della serata con più voti
  const ch = A.serateChiuse(N, '2026-11-03');
  assert.deepStrictEqual(ch[k].winners, ['pesce']);
  assert.strictEqual(A.normCfg({}).votiMax, 3);
  assert.strictEqual(A.normCfg({ votiMax: 9 }).votiMax, 3, 'fuori misura: torna 3');
  assert.strictEqual(A.normCfg({ votiMax: 1 }).votiMax, 1);
}

/* ---------- statistiche del mese, record, medaglie, albo d'oro ---------- */
{
  const S = A.seedState(1);
  const cut = 6;
  const sera = (g, ora) => Date.parse('2026-10-' + String(g).padStart(2, '0') + 'T' + (ora || '22:00') + ':00+02:00');
  const birra = S.products.find((p) => p.name === 'Birra').id;
  // ottobre: PESCE beve 120 birre (medaglia «cento»), CONTI segna sul ticket
  for (let i = 0; i < 12; i++) S.moves.push({ id: 'b' + i, t: sera(13 + i), k: 'sale', p: 'pesce', a: 1000, items: [{ id: birra, n: 'Birra', q: 10, pr: 100 }] });
  S.moves.push({ id: 'c1', t: sera(14), k: 'tab', p: 'conti', a: 300, items: [{ id: birra, n: 'Birra', q: 3, pr: 100 }] });
  S.moves.push({ id: 'c2', t: sera(15, '02:00') + DAY, k: 'tab', p: 'conti', a: 200, items: [{ n: 'Panino', q: 1, pr: 200 }] });   // alle 2 di notte: serata del 15
  S.moves.sort((a, b) => a.t - b.t);
  // voti (dopo l'azzeramento): due serate
  const vt = (s, v, cs, t) => { const o = { id: 'v' + s + '_' + v, s, v, t }; A.metiVoto(o, cs, {}); S.votes.push(o); };
  vt('2026-10-14', 'pj', ['pesce', 'conti'], sera(14, '23:00'));
  vt('2026-10-14', 'ciccio', ['pesce'], sera(14, '23:10'));
  vt('2026-10-15', 'pj', ['conti', 'chicco', 'pesce'], sera(15, '23:00'));
  vt('2026-10-15', 'pesce', ['conti'], sera(15, '23:05'));
  // freccette: PJ vince due 301 di fila contro PESCE con un 180
  const g1 = { id: 'g1', t: sera(14, '21:00'), mode: '301', players: ['pj', 'pesce'], d: ['T20', 'T20', 'T20', 'S1', 'S1', 'S1', 'S1', 'S1', 'S1', 'S1', 'S1', 'S1', 'T20', 'S18', 'D20'], end: 1 };
  const g2 = { id: 'g2', t: sera(15, '21:00'), mode: '301', players: ['pj', 'pesce'], d: ['T20', 'T20', 'T20', 'S1', 'S1', 'S1', 'S1', 'S1', 'S1', 'S1', 'S1', 'S1', 'T20', 'S18', 'D20'], end: 1 };
  S.games.push(g1, g2);
  S.trash.push({ id: 'r1', s: '2026-10-14', p: ['ciccio'], f: ['vetro'], t: sera(14) });
  const N = A.normState(JSON.parse(JSON.stringify(S)));
  const ok = '2026-11-02';
  const st = A.statMese(N, '2026-10', cut, ok);
  assert.strictEqual(st.per.pesce.pz, 120);
  assert.strictEqual(st.per.pesce.eur, 12000);
  assert.deepStrictEqual(st.per.pesce.preferito, { n: 'Birra', q: 120 });
  assert.strictEqual(st.per.conti.tab, 500);
  assert.strictEqual(st.per.conti.votiRic, 3);
  assert.strictEqual(st.per.pesce.votiRic, 3);
  assert.strictEqual(st.per.pj.votiDati, 5);
  assert.strictEqual(st.per.pesce.rossi, 1, '14: PESCE con 2 voti');
  assert.strictEqual(st.per.conti.rossi, 1, '15: CONTI con 2 voti');
  assert.strictEqual(st.per.pj.vinte, 2);
  assert.strictEqual(st.per.pesce.gare, 2);
  assert.strictEqual(st.per.ciccio.rifiuti, 1);
  assert.strictEqual(st.tot.partite, 2);
  assert.strictEqual(st.tot.nSerate, 12);
  assert.strictEqual(st.per.conti.nSerate, 2, 'le 2 di notte contano per la sera prima');
  // record
  const R = A.recordFreccette(N);
  assert.deepStrictEqual(R.turno, { v: 180, p: 'pj', t: g1.t });
  assert.deepStrictEqual(R.c180, { pj: 2 });
  assert.strictEqual(R.chiusura.v, 118);
  assert.strictEqual(R.veloce301.v, 9);
  assert.deepStrictEqual(R.serie, { v: 2, p: 'pj' });
  assert.ok(Math.abs(R.media.v - 301 / 9 * 3) < 1e-9);
  // medaglie (ottobre finito: siamo a novembre)
  const md = A.medaglie(N, Date.parse('2026-11-02T20:00:00+01:00'), cut, ok);
  assert.strictEqual(md.pesce.cento, 1);
  assert.strictEqual(md.conti.graffio, 1);
  assert.strictEqual(md.pj.cecchino, 2);
  assert.strictEqual(md.pj.freccia, 1);
  assert.strictEqual(md.pesce.rosso, 1);
  assert.strictEqual(md.conti.rosso, 1, 'pari merito a ottobre: tutti e due');
  assert.ok(!md.ciccio || !md.ciccio.spazzino);
  // durante ottobre il mese non è finito: niente medaglie del mese
  const md2 = A.medaglie(N, sera(20), cut, '2026-10-20');
  assert.ok(!md2.conti || !md2.conti.graffio);
  assert.strictEqual(A.MEDAGLIE.length, 8);
  // albo d'oro 2026
  const al = A.alboOro(N, '2026', cut, ok, Date.parse('2026-11-02T20:00:00+01:00'));
  const voce = (k) => al.find((x) => x.k === k);
  assert.deepStrictEqual(voce('rosso').chi, ['conti', 'pesce']);
  assert.deepStrictEqual(voce('freccette').chi, ['pj']);
  assert.deepStrictEqual(voce('consumi').chi, ['pesce']);
  assert.deepStrictEqual(voce('pagatore').chi, ['pesce'], 'paga subito: zero giorni');
  assert.deepStrictEqual(voce('spazzino').chi, ['ciccio']);
  assert.deepStrictEqual(A.alboOro(N, '2025', cut, ok, Date.now()).every((x) => !x.chi.length), true);
}

/* ---------- fedina pulita e puntuale ---------- */
{
  const S = A.seedState(1);
  const t0 = Date.parse('2026-06-01T21:00:00+02:00');
  S.moves.push({ id: 'x0', t: t0, k: 'tab', p: 'ciccio', a: 500, items: [] });
  S.moves.push({ id: 'x1', t: t0 + DAY, k: 'pay', p: 'ciccio', a: 500 });
  for (let i = 0; i < 6; i++) S.moves.push({ id: 'y' + i, t: t0 + (10 + i * 10) * DAY, k: 'sale', p: 'ciccio', a: 100, items: [] });
  S.moves.push({ id: 'x2', t: t0 + 100 * DAY, k: 'tab', p: 'ciccio', a: 100, items: [] });
  // PJ: debito sempre aperto → niente
  S.moves.push({ id: 'z0', t: t0, k: 'dplus', p: 'pj', a: 100 });
  for (let i = 0; i < 6; i++) S.moves.push({ id: 'z' + (i + 1), t: t0 + (10 + i * 10) * DAY, k: 'sale', p: 'pj', a: 100, items: [] });
  S.moves.sort((a, b) => a.t - b.t);
  const sei = ['pj', 'pesce'];
  S.quote.push({ id: 'q2026-07', mese: '2026-07', a: 1000, chi: sei, t: t0 });
  S.quote.push({ id: 'q2026-08', mese: '2026-08', a: 1000, chi: sei, t: t0 });
  S.moves.push({ id: 'qa', t: Date.parse('2026-06-25T20:00:00+02:00'), k: 'qin', p: 'pj', a: 1000, mese: '2026-07' });
  S.moves.push({ id: 'qb', t: Date.parse('2026-08-01T23:30:00+02:00'), k: 'qin', p: 'pj', a: 1000, mese: '2026-08' });   // ultimo giorno utile
  S.moves.push({ id: 'qc', t: Date.parse('2026-06-25T20:00:00+02:00'), k: 'qin', p: 'pesce', a: 1000, mese: '2026-07' });
  S.moves.push({ id: 'qd', t: Date.parse('2026-08-02T10:00:00+02:00'), k: 'qin', p: 'pesce', a: 1000, mese: '2026-08' });   // in ritardo
  S.moves.sort((a, b) => a.t - b.t);
  const md = A.medaglie(A.normState(JSON.parse(JSON.stringify(S))), t0 + 120 * DAY, 6, '2026-09-29');
  assert.strictEqual(md.ciccio.pulito, 1, '99 giorni a zero con 6 consumazioni');
  assert.ok(!md.pj || !md.pj.pulito);
  assert.strictEqual(md.pj.puntuale, 2, 'quota pagata in tempo tutti e due i mesi');
  assert.ok(!md.pesce || !md.pesce.puntuale, 'un ritardo e la medaglia salta');
}

/* ---------- compleanni ---------- */
{
  const S = A.seedState(1);
  S.people.find((p) => p.id === 'pesce').nato = '11-02';
  S.people.find((p) => p.id === 'conti').nato = '01-15';
  S.people.find((p) => p.id === 'pj').nato = '02-29';
  const l = A.prossimiCompleanni(S, '2026-11-02');
  assert.deepStrictEqual(l.map((x) => [x.p, x.giorni]), [['pesce', 0], ['conti', 74], ['pj', 118]]);
  assert.strictEqual(l[2].data, '2027-02-28', '29 febbraio negli anni normali: il 28');
  assert.strictEqual(A.normNato('02-30'), '');
  assert.strictEqual(A.normNato('12-31'), '12-31');
  assert.strictEqual(A.normNato('1990-12-31'), '', 'niente anno di nascita');
  const N = A.normState(JSON.parse(JSON.stringify(S)));
  assert.strictEqual(N.people.find((p) => p.id === 'pj').nato, '02-29');
}

/* ---------- verifica del mese: la differenza si spiega voce per voce ---------- */
{
  const S = A.seedState(1);
  const birra = S.products.find((p) => p.name === 'Birra');
  const coca = S.products.find((p) => p.name === 'Coca Cola lattina');
  let t = Date.parse('2026-10-01T20:00:00+02:00');
  const mv = (o) => { const x = Object.assign({ id: 'm' + t, t: t += 60000 }, o); S.moves.push(x); return x; };
  mv({ k: 'in', a: 5000, note: 'fondo' });
  mv({ k: 'inv', a: 0, items: [{ id: birra.id, n: 'Birra', q: 20, pr: 100 }, { id: coca.id, n: 'Coca', q: 5, pr: 120 }] });
  mv({ k: 'tab', p: 'pesce', a: 300, items: [{ id: birra.id, n: 'Birra', q: 3, pr: 100 }] });
  const D0 = A.derive(S), P0 = A.previsione(S, D0);
  const foto = { id: 'k1', t: t + 1, cassa: P0.cassa, scorte: P0.scorte, incassare: P0.incassare, restituire: P0.restituire, previsionale: P0.previsionale, fondo: 0 };
  t += 1000;
  mv({ k: 'sale', p: 'pj', a: 100, items: [{ id: birra.id, n: 'Birra', q: 1, pr: 100 }] });            // neutra
  mv({ k: 'sale', p: 'pj', a: 250, items: [{ n: 'Panino', q: 1, pr: 250 }] });                        // fuori listino: +2,50
  mv({ k: 'exp', a: 1200, paidBy: 'cassa', cat: 'Rifornimento bar' });                                 // −12,00
  mv({ k: 'load', a: 0, items: [{ id: birra.id, n: 'Birra', q: 24, pr: 100 }] });                       // +24,00
  mv({ k: 'pay', p: 'pesce', a: 300 });                                                               // neutro
  mv({ k: 'count', a: -150, counted: 4700, expected: 4850 });                                          // ammanco −1,50
  mv({ k: 'inv', a: 0, items: [{ id: coca.id, n: 'Coca', q: 4, pr: 120 }] });                           // una coca sparita −1,20
  A.cambiaPrezzo(birra, 150, t += 60000);                                                               // 40 birre +0,50 = +20,00
  mv({ k: 'qin', p: 'pj', a: 6000, mese: '2026-11' });                                                 // fondo: fuori dal previsionale
  const D1 = A.derive(S), P1 = A.previsione(S, D1);
  const r = A.spiegaVerifica(S, foto, t + 1);
  assert.strictEqual(r.correzioni, 0);
  assert.strictEqual(r.adesso, P1.previsionale, 'il ricalcolo arriva al previsionale di adesso');
  assert.strictEqual(r.diff, P1.previsionale - P0.previsionale);
  assert.deepStrictEqual(r.cat, { carichi: 2400, vendite: 250, spese: -1200, entrate: 0, debiti: 0, conte: -150, inventari: -120, prezzi: 2000, altro: 0 });
  assert.strictEqual(r.somma, r.diff, 'tutta la differenza è spiegata');
  assert.strictEqual(r.sfuggito, -270);
  // un movimento di prima della foto annullato dopo: finisce nelle correzioni
  S.moves[0].x = { t: t + 5 };
  const r2 = A.spiegaVerifica(S, foto, t + 10);
  assert.strictEqual(r2.correzioni, -5000);
  assert.strictEqual(r2.adesso, A.previsione(S, A.derive(S)).previsionale);
  assert.strictEqual(r2.correzioni + r2.somma, r2.diff);
}

/* ---------- codici, muro, verifiche: normalizzazione ---------- */
{
  assert.notStrictEqual(A.impronta('1010'), A.impronta('0101'));
  assert.strictEqual(A.impronta(' 1010 '), A.impronta('1010'));
  const c = A.normCfg({ pinH: A.impronta('2222') });
  assert.strictEqual(c.pinH, A.impronta('2222'));
  const S = A.seedState(1);
  S.muro.push({ id: 'w1', t: T0, p: 'pesce', testo: '  Aiuto, ho finito le cartine  ', col: 9, dv: 'd123' });
  S.muro.push({ id: 'w2', t: T0, p: '', testo: 'anonimo' });
  S.verifiche.push({ id: 'k1', t: T0, cassa: 100, scorte: 200, incassare: 50, restituire: 0, previsionale: 350, fondo: 0, nota: 'festa di ottobre' });
  const N = A.normState(JSON.parse(JSON.stringify(S)));
  assert.deepStrictEqual(N.muro, [{ id: 'w1', t: T0, p: 'pesce', testo: 'Aiuto, ho finito le cartine', col: 5, dv: 'd123' }], 'i post-it anonimi non entrano');
  assert.strictEqual(N.verifiche[0].previsionale, 350);
  assert.strictEqual(A.normEnt('muro', S.muro[0]).testo, 'Aiuto, ho finito le cartine');
  assert.strictEqual(A.normEnt('quote', { mese: '2026-12', a: 5000, chi: ['pj'], t: 1 }).id, 'q2026-12');
}

console.log('novità 0.7.0: tutto torna (prezzi, graffi vecchi, quota, voto a più persone, statistiche, record, medaglie, albo, compleanni, verifica)');
