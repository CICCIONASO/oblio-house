// Prova a schermo: flussi principali a larghezza telefono, voto, freccette, classifiche,
// chiusura della serata alle 6 (orologio finto) e riapertura senza rete.
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'docs');
const shots = path.join(__dirname, 'shots');
fs.mkdirSync(shots, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };
// servito sotto /app/ per provare i percorsi relativi come su un sito con sottocartella
// finto server di sincronizzazione (al posto di Firebase): l'ultimo che scrive vince, «s» è l'ora del server
const stanze = {};
let orologio = 0;
function mock(req, res) {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'POST' && u.pathname === '/mock/w') {
    let b = '';
    req.on('data', (c) => { b += c; });
    req.on('end', () => {
      const d = JSON.parse(b);
      const st = (stanze[d.room] = stanze[d.room] || {});
      st[d.key] = { key: d.key, c: d.c, i: d.i, j: d.j, u: d.u, by: d.by, s: ++orologio };
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}');
    });
    return;
  }
  if (u.pathname === '/mock/r') {
    const since = +u.searchParams.get('since') || 0;
    const st = stanze[u.searchParams.get('room')] || {};
    const out = Object.values(st).filter((d) => d.s > since).sort((a, b) => a.s - b.s);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(out));
    return;
  }
  res.writeHead(404); res.end('no');
}
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.startsWith('/mock/')) { mock(req, res); return; }
  if (!p.startsWith('/app/')) { res.writeHead(404); res.end('no'); return; }
  p = p.slice(4);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(dist, p);
  if (!f.startsWith(dist) || !fs.existsSync(f)) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(f).pipe(res);
});

const problems = [];
const note = (m) => { console.log(m); };
const fail = (m) => { problems.push(m); console.log('PROBLEMA: ' + m); };

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port + '/app/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'it-IT', timezoneId: 'Europe/Rome', acceptDownloads: true });
  const page = await ctx.newPage();
  const ascolta = (pg) => {
    pg.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) fail('console: ' + m.text()); });
    pg.on('pageerror', (e) => fail('errore pagina: ' + e.message));
  };
  ascolta(page);

  const shot = async (name, full, pg) => { await (pg || page).screenshot({ path: path.join(shots, name + '.png'), fullPage: !!full }); };
  const overflow = async (where) => {
    const o = await page.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, iw: window.innerWidth }));
    if (o.sw > o.iw + 1) fail('scorrimento orizzontale in ' + where + ': ' + o.sw + ' > ' + o.iw);
  };
  const facce = async (where, pg) => {
    const r = await (pg || page).evaluate(async () => {
      const imgs = [...document.querySelectorAll('img')];
      await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((ok) => { i.onload = i.onerror = ok; }))));
      return { n: imgs.length, rotte: imgs.filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src').slice(0, 40)) };
    });
    if (r.rotte.length) fail('immagini che non si aprono in ' + where + ': ' + r.rotte.join(', '));
    return r.n;
  };
  const tab = async (name) => { await page.click('.tab:has-text("' + name + '")'); await page.waitForTimeout(80); };
  const text = async (sel) => (await page.textContent(sel)) || '';
  const cassa = async () => { await tab('Reparto'); await page.click('[data-k="apri-cassa"]'); await page.waitForTimeout(80); };

  await page.goto(base);
  await page.waitForSelector('.tab');
  await page.waitForTimeout(300);
  await shot('01-reparto-vuoto', true); await overflow('reparto');
  const nFacce = await facce('reparto');
  if (nFacce < 6) fail('nel triage attese 6 caricature, trovate ' + nFacce);

  // Farmacia: PESCE prende 2 birre e un Kinder Bueno, sul ticket
  await tab('Farmacia');
  await shot('02-farmacia', true); await overflow('farmacia');
  await page.click('.chip:has-text("PESCE")');
  await page.click('.prod-add:has-text("Birra")');
  await page.click('.prod-add:has-text("Birra")');
  await page.click('.prod-add:has-text("Kinder Bueno")');
  await page.waitForTimeout(80);
  await shot('03-farmacia-selezione'); await overflow('farmacia selezione');
  const tot = await text('.pos-tot strong');
  if (!/3,30/.test(tot)) fail('totale atteso 3,30, trovato: ' + tot);
  await page.click('.posbar .pill:has-text("Sul ticket")');
  await page.waitForTimeout(100);
  if (!/ticket di PESCE/.test(await text('#toast'))) fail('toast ticket mancante: ' + (await text('#toast')));

  // CICCIO paga subito una Coca Cola; importo fuori listino per CONTI
  await page.click('.chip:has-text("CICCIO")');
  await page.click('.prod-add:has-text("Coca Cola")');
  await page.click('.posbar .pill:has-text("Paga subito")');
  await page.click('.chip:has-text("CONTI")');
  await page.click('.pill:has-text("Altro importo")');
  await page.fill('#ex-n', 'Panino');
  await page.fill('#ex-a', '2,50');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(80);
  await page.click('.posbar .pill:has-text("Sul ticket")');
  // visitatore aggiunto al volo
  await page.click('.chip.piu');
  await page.fill('#pe-n', 'Gigi');
  await shot('04-nuovo-visitatore');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(80);
  await page.click('.prod-add:has-text("Mars")');
  await page.click('.posbar .pill:has-text("Sul ticket")');
  await page.waitForTimeout(80);

  // Ticket
  await tab('Ticket');
  await shot('05-ticket', true); await overflow('ticket');
  const tk = await text('#view');
  if (!/3,30/.test(tk) || !/2,50/.test(tk) || !/Gigi/.test(tk)) fail('ticket non coerenti: ' + tk.slice(0, 300));
  await page.click('.riga:has-text("PESCE")');
  await page.waitForTimeout(150);
  await facce('cartella');
  if (!(await page.$('#foglio .segnaletica img'))) fail('la cartella di PESCE non mostra la caricatura');
  await shot('06-cartella-pesce');
  await page.click('#foglio .pill:has-text("Incassa")');
  await page.fill('#py-a', '2,00');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(80);
  await page.click('.riga:has-text("CONTI")');
  await page.click('#foglio .pill:has-text("+ Debito")');
  await page.fill('#db-a', '5');
  await page.fill('#db-n', 'Scommessa persa');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(80);

  // Cassa (dal Reparto): entrata, spesa anticipata e divisa, conta
  await cassa();
  await page.click('.pill:has-text("Entrata")');
  await page.fill('#en-a', '50');
  await page.fill('#en-n', 'Fondo iniziale');
  await page.click('#foglio button[type=submit]');
  await page.click('.pill:has-text("Spesa")');
  await page.fill('#sp-a', '9,00');
  await page.fill('#sp-n', 'Supermercato');
  await page.click('#foglio .chip:has-text("CHICCO")');
  await page.click('#foglio .chip:has-text("Dividi tra tutti")');
  await page.waitForTimeout(60);
  await shot('07-spesa-divisa');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(80);
  const cassaTxt = await text('.cifrona');
  // 1,20 (coca) + 2,00 (pesce) + 50,00 = 53,20
  if (!/53,20/.test(cassaTxt)) fail('cassa attesa 53,20, trovata: ' + cassaTxt);
  await page.click('.pill:has-text("Conta cassa")');
  await page.fill('#ct-a', '53');
  await page.waitForTimeout(60);
  if (!/Mancano/.test(await text('#foglio'))) fail('differenza conta cassa non mostrata');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(80);
  await shot('08-cassa', true); await overflow('cassa');
  if (!/53,00/.test(await text('.cifrona'))) fail('cassa dopo conta attesa 53,00: ' + (await text('.cifrona')));
  if (!/Reparto/.test(await text('.indietro'))) fail('dalla cassa il tasto indietro non torna al Reparto');

  // dettaglio e annullo di un movimento
  await page.click('.riga:has-text("Entrata")');
  await page.click('#foglio .pill:has-text("Annulla movimento")');
  await page.click('#foglio .pill:has-text("Sì, annulla")');
  await page.waitForTimeout(80);
  await shot('09-movimento-annullato');
  await page.click('#foglio .pill:has-text("Ripristina")');
  await page.click('#foglio-x');
  if (!/53,00/.test(await text('.cifrona'))) fail('cassa dopo ripristino: ' + (await text('.cifrona')));

  // Ticket dopo la divisione: CHICCO in credito, gli altri +1,50
  await tab('Ticket');
  const tk2 = await text('#view');
  if (!/credito/.test(tk2)) fail('credito di CHICCO non mostrato');
  await shot('10-ticket-dopo', true);

  // Scorte: inventario, soglie, carico, lista spesa
  await tab('Altro');
  await shot('11-altro', true); await overflow('altro');
  await page.click('.voce:has-text("Scorte")');
  await page.click('.pill:has-text("Inventario")');
  await page.fill('#iv-p2', '3');
  await page.fill('#iv-p3', '12');
  await shot('12-inventario');
  await page.click('#foglio button[type=submit]');
  await page.click('.pill:has-text("Soglie")');
  await page.fill('#so-tutti', '4');
  await page.click('#foglio .pill:has-text("Applica a tutti")');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(80);
  await page.fill('#sh-n', 'Sacchi neri');
  await page.click('.linea button[type=submit]');
  await page.waitForTimeout(80);
  await shot('13-scorte', true); await overflow('scorte');
  const sc = await text('#view');
  if (!/Birra/.test(sc) || !/Sacchi neri/.test(sc) || !/ne restano 3/.test(sc)) fail('lista spesa non coerente');
  await page.click('.pill:has-text("Carico")');
  await page.fill('#ca-p2', '24');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(80);
  if (!/27 pz/.test(await text('#view'))) fail('carico birra: attesi 27 pz');

  // la Farmacia mostra le scorte e scala
  await tab('Farmacia');
  if (!/27 pz/.test(await text('.prod-add:has-text("Birra")'))) fail('scorta non mostrata in farmacia');
  await page.click('.chip:has-text("PJ")');
  await page.click('.prod-add:has-text("Birra")');
  await page.click('.posbar .pill:has-text("Paga subito")');
  await page.waitForTimeout(80);
  if (!/26 pz/.test(await text('.prod-add:has-text("Birra")'))) fail('scorta non scalata');

  // Listino e persone
  await tab('Altro');
  await page.click('.voce:has-text("Listino")');
  await shot('14-listino', true); await overflow('listino');
  await page.click('.riga:has-text("Birra")');
  await page.fill('#pr-a', '1,50');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(60);
  if (!/1,50/.test(await text('.riga:has-text("Birra")'))) fail('prezzo non aggiornato');
  await page.click('.indietro');
  await page.click('.voce:has-text("Pazienti")');
  await shot('15-pazienti', true);
  // faccia dal telefono per il visitatore Gigi
  await page.click('.riga:has-text("Gigi")');
  await page.waitForTimeout(80);
  await shot('15b-scelta-faccia');
  await page.setInputFiles('#foglio input[type=file]', path.join(__dirname, '..', 'src', 'img', 'c6.jpg'));
  await page.waitForTimeout(400);
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(100);
  if (!(await page.$('.riga:has-text("Gigi") img.ava[src^="data:image/jpeg"]'))) fail('foto dal telefono non salvata per Gigi');
  await facce('pazienti');
  await page.click('.indietro');

  // ---------- Faccende: rifiuti (calendario del centro già compilato) e pulizie ----------
  await tab('Reparto');
  await page.locator('.cartella:has(h2:text("Faccende"))').screenshot({ path: path.join(shots, '15c-faccende.png') });
  if (!(await page.$('[data-k="rif-fatto"]'))) {
    // sabato sera non si espone niente: per la prova segno l'organico tutti i giorni
    await tab('Altro'); await page.click('.voce:has-text("Regole")');
    for (const g of ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']) {
      const c = page.locator('.campo:has(.lab:text("Ritiro ' + g + ' mattina")) .chip:has-text("Organico")');
      if ((await c.getAttribute('aria-pressed')) !== 'true') await c.click();
    }
    await page.click('button:has-text("Salva il calendario")');
    await tab('Reparto');
  }
  if (!/Stasera fuori:/.test(await text('#view'))) fail('manca il promemoria dei rifiuti di stasera');
  await page.click('[data-k="rif-fatto"]');
  await page.click('#foglio .chip:has-text("PJ")');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(80);
  if (!/Portati giù da PJ/.test(await text('#view'))) fail('rifiuti non segnati come portati giù');
  if (!/Pulizie: mai segnate/.test(await text('#view'))) fail('pulizie: all’inizio devono risultare mai segnate');
  await page.click('[data-k="pul-fatta"]');
  await page.selectOption('#pu-q', '3');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(80);
  if (!/Ultima 3 giorni fa; la prossima tra 11 giorni/.test(await text('#view'))) fail('pulizie: conto alla rovescia sbagliato: ' + (await text('.cartella:has(h2:text("Faccende"))')));
  await page.locator('.cartella:has(h2:text("Faccende"))').screenshot({ path: path.join(shots, '15d-faccende-fatte.png') });

  // ---------- Triage: voto palese della serata ----------
  await tab('Reparto');
  await page.click('[data-k="tri-pesce"]');
  await page.waitForTimeout(80);
  await shot('16-voto-per-pesce');
  await page.click('#foglio [data-k="vt-pj"]');
  await page.waitForTimeout(80);
  if (!/PJ vota PESCE/.test(await text('#toast'))) fail('toast del voto mancante: ' + (await text('#toast')));
  await page.click('[data-k="tri-pesce"]'); await page.click('#foglio .chip:has-text("Urla strazianti")'); await page.click('#foglio [data-k="vt-ciccio"]'); await page.waitForTimeout(60);
  if (!/urla strazianti/.test(await text('#toast'))) fail('il sintomo non arriva nel voto: ' + (await text('#toast')));
  await page.click('[data-k="tri-ciccio"]'); await page.click('#foglio [data-k="vt-pesce"]'); await page.waitForTimeout(60);
  await page.click('[data-k="tri-pesce"]'); await page.click('#foglio .chip:has-text("Gigi")'); await page.waitForTimeout(60);
  let tri = await text('.triage');
  if (!/In testa PESCE con 3 voti/.test(tri)) fail('triage: atteso PESCE in testa con 3 voti: ' + tri);
  // PJ cambia idea: ora pari
  await page.click('[data-k="tri-ciccio"]');
  await page.waitForTimeout(60);
  if (!/ha votato PESCE/.test(await text('#foglio [data-k="vt-pj"]'))) fail('nel foglio non si vede chi ha già votato');
  await page.click('#foglio [data-k="vt-pj"]');
  await page.waitForTimeout(80);
  tri = await text('.triage');
  if (!/Pari: .*con 2 voti/.test(tri)) fail('triage: atteso pari con 2 voti: ' + tri);
  await shot('17-triage', false);
  await page.locator('.triage').screenshot({ path: path.join(shots, '17b-triage-card.png') });
  await overflow('triage');
  // Vedi i voti, poi tolgo quello di Gigi
  await page.click('.triage .pill:has-text("Vedi i voti")');
  await page.waitForTimeout(80);
  await shot('18-voti');
  await page.click('#foglio li:has-text("Gigi → PESCE") button');
  await page.waitForTimeout(80);
  await page.click('#foglio-x');
  tri = await text('.triage');
  if (!/In testa CICCIO con 2 voti/.test(tri)) fail('dopo aver tolto il voto di Gigi: ' + tri);
  // regola: niente voto a se stessi
  await tab('Altro');
  await page.click('.voce:has-text("Regole")');
  await shot('19-regole', true); await overflow('regole');
  await page.uncheck('#rg-self');
  await page.click('button:has-text("Salva il triage")');
  await tab('Reparto');
  await page.click('[data-k="tri-pesce"]');
  if (!(await page.isDisabled('#foglio [data-k="vt-pesce"]'))) fail('con la regola spenta PESCE può ancora votarsi');
  await page.click('#foglio-x');
  await tab('Altro'); await page.click('.voce:has-text("Regole")'); await page.check('#rg-self'); await page.click('button:has-text("Salva il triage")');

  // ---------- Freccette: 301 a chiusura libera ----------
  await tab('Freccette');
  await shot('20-freccette-nuova', true); await overflow('freccette');
  await page.click('[data-k="modo-301"]');
  await page.click('[data-k="gioc-pj"]');
  await page.click('[data-k="gioc-pesce"]');
  await page.click('[data-k="inizia"]');
  await page.waitForTimeout(80);
  const dart = async (mol, n) => { if (mol > 1) await page.click('[data-k="mol-' + mol + '"]'); await page.click('[data-k="n-' + n + '"]'); };
  const punti = async () => (await page.$$eval('.gioc .gioc-p', (els) => els.map((e) => e.textContent)));
  await dart(3, 20); await dart(3, 20);
  await shot('21-partita-in-corso'); await overflow('partita');
  await dart(3, 20);
  if ((await punti())[0] !== '121') fail('dopo 180 PJ dovrebbe avere 121: ' + (await punti()));
  await dart(1, 20); await dart(1, 20); await dart(1, 20);
  await dart(3, 20); await dart(1, 20); await dart(1, 1);
  if ((await punti()).join() !== '40,241') fail('punteggi attesi 40,241: ' + (await punti()));
  await page.click('[data-k="n-0"]'); await page.click('[data-k="n-0"]'); await page.click('[data-k="n-0"]');
  await dart(3, 20);
  if (!/Sballato/.test(await text('#toast'))) fail('sballato non segnalato');
  if ((await punti())[0] !== '40' || !/Tocca a PESCE/.test(await text('.turno'))) fail('dopo lo sballo PJ resta a 40 e tocca a PESCE');
  await dart(1, 1); await dart(1, 1); await dart(1, 1);
  await dart(2, 20);
  if (!/PJ vince/.test(await text('.vincitore'))) fail('PJ doveva chiudere con D20');
  await shot('22-partita-finita', true); await overflow('partita finita');
  await page.click('.pill:has-text("Togli l’ultima freccetta")');
  await page.waitForTimeout(80);
  if ((await punti())[0] !== '40' || !/Tocca a PJ/.test(await text('.turno'))) fail('togliere l’ultima freccetta non riapre la partita');
  await dart(2, 20);
  await page.click('.pill:has-text("Rivincita")');
  await page.waitForTimeout(80);
  if (!/Tocca a PESCE/.test(await text('.turno'))) fail('nella rivincita deve cominciare PESCE');
  await page.click('.pill:has-text("Abbandona")');
  await page.click('#foglio .pill:has-text("Sì, abbandona")');
  await page.waitForTimeout(80);
  // Giro dell'orologio
  await page.click('[data-k="modo-orologio"]');
  await page.click('[data-k="inizia"]');
  await page.waitForTimeout(80);
  await page.click('[data-k="o-T"]');
  if ((await punti())[0] !== 'al 4') fail('triplo sull’1: PJ deve andare al 4, trovato ' + (await punti())[0]);
  await page.click('[data-k="o-D"]');
  if ((await punti())[0] !== 'al 6') fail('doppio sul 4: PJ deve andare al 6');
  await page.click('[data-k="o-M"]');
  await page.waitForTimeout(80);
  await shot('23-orologio'); await overflow('orologio');
  if (!/Tocca a PESCE/.test(await text('.turno'))) fail('dopo tre freccette tocca a PESCE');
  await page.click('.pill:has-text("Abbandona")');
  await page.click('#foglio .pill:has-text("Sì, abbandona")');
  await page.waitForTimeout(80);
  const fr = await text('#view');
  if (!/vince PJ/.test(fr) || !/abbandonata/.test(fr)) fail('storico partite incompleto: ' + fr.slice(0, 300));
  await shot('24-freccette-storico', true);

  // ---------- Classifiche ----------
  await page.click('.pill:has-text("Classifica")');
  await page.waitForTimeout(80);
  await shot('25-classifiche', true); await overflow('classifiche');
  await facce('classifiche');
  const cl = await text('#view');
  if (!/Nessuna serata votata/.test(cl)) fail('re dell’oblio: la serata in corso non deve contare ancora');
  if (!/1 vinta/.test(cl)) fail('classifica freccette senza la vittoria di PJ');
  const primoConsumi = await page.$eval('section:has(h3:text("Consumi")) .classifica li:first-child .nome', (e) => e.textContent);
  if (!/PESCE/.test(primoConsumi)) fail('consumi: primo atteso PESCE, trovato ' + primoConsumi);
  if (!/subito/.test(await page.textContent('section:has(h3:text("Migliori pagatori"))'))) fail('migliori pagatori: chi paga subito deve risultare «subito»');
  if (!/Freccette/.test(await text('.indietro'))) fail('dalla classifica il tasto indietro deve tornare alle Freccette');
  const spz = await page.textContent('section:has(h3:text("Spazzatura"))');
  if (!/PJ/.test(spz) || !/1 volta/.test(spz)) fail('classifica spazzatura senza PJ: ' + spz);

  // Backup: scarica, poi controlla che contenga voti e partite
  await tab('Altro');
  await page.click('.voce:has-text("Backup")');
  await shot('26-backup', true); await overflow('backup');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), page.click('.pill:has-text("Scarica backup")')]);
  const bkPath = path.join(shots, 'backup.json');
  await dl.saveAs(bkPath);
  const bk = JSON.parse(fs.readFileSync(bkPath, 'utf8'));
  if (!bk.state || bk.state.moves.length < 10) fail('backup incompleto');
  if (bk.state.votes.length !== 3 || bk.state.games.length !== 2) fail('backup: attesi 3 voti e 2 partite, trovati ' + bk.state.votes.length + ' e ' + bk.state.games.length);
  note('backup: ' + bk.state.moves.length + ' movimenti, ' + bk.state.votes.length + ' voti, ' + bk.state.games.length + ' partite, ' + bk.state.people.length + ' persone');
  await page.click('.indietro');
  await page.click('.voce:has-text("Installa")');
  await shot('27-installa', true);

  // ricarica: i dati restano
  await page.reload();
  await page.waitForSelector('.tab');
  await page.waitForTimeout(200);
  await tab('Reparto');
  await shot('28-reparto-pieno', true); await overflow('reparto pieno');
  const rep = await text('#view');
  if (!/Urgente|Stabile/.test(rep)) fail('bollettino senza timbro');
  if (!/In testa CICCIO/.test(rep)) fail('i voti non restano dopo la ricarica');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('oblio.v1')).moves.length);
  if (saved !== bk.state.moves.length) fail('movimenti salvati ' + saved + ' diversi dal backup ' + bk.state.moves.length);

  // senza rete: l'app si riapre dal service worker, caricature comprese
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 8000 }).catch(() => fail('service worker non attivo'));
  await page.waitForTimeout(500);
  await ctx.setOffline(true);
  await page.reload().catch((e) => fail('ricarica senza rete fallita: ' + e.message));
  const okOff = await page.waitForSelector('.tab', { timeout: 5000 }).then(() => true, () => false);
  if (!okOff) fail('senza rete la pagina non si apre');
  else {
    await tab('Reparto');
    await facce('reparto senza rete');
    await tab('Ticket'); await shot('29-senza-rete'); note('senza rete: app aperta, dati e caricature presenti');
  }
  await ctx.setOffline(false);

  // schermo stretto e largo
  await page.setViewportSize({ width: 320, height: 640 });
  await tab('Farmacia'); await page.click('.chip:has-text("PJ")'); await page.click('.prod-add:has-text("Nutella")');
  await page.waitForTimeout(80); await shot('30-farmacia-320'); await overflow('farmacia 320');
  await tab('Ticket'); await overflow('ticket 320');
  await tab('Reparto'); await overflow('reparto 320'); await shot('31-reparto-320', true);
  await tab('Freccette'); await page.click('[data-k="modo-501"]');
  await page.click('[data-k="gioc-peppecarlo"]'); await page.click('[data-k="gioc-chicco"]'); await page.click('[data-k="gioc-conti"]');
  await page.click('[data-k="inizia"]'); await page.waitForTimeout(80);
  await overflow('freccette 320'); await shot('32-freccette-320');
  await page.click('.pill:has-text("Abbandona")'); await page.click('#foglio .pill:has-text("Sì, abbandona")');
  await tab('Altro'); await page.click('.voce:has-text("Classifiche")'); await overflow('classifiche 320'); await shot('33-classifiche-320', true);
  await page.setViewportSize({ width: 1100, height: 800 });
  await cassa(); await shot('34-cassa-desktop'); await overflow('cassa desktop');

  // ---------- la serata si chiude alle 6 del mattino (orologio finto) ----------
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'it-IT', timezoneId: 'Europe/Rome' });
  await ctx2.clock.install({ time: new Date('2026-10-13T05:58:00+02:00') });
  const p2 = await ctx2.newPage();
  ascolta(p2);
  await p2.goto(base);
  await p2.waitForSelector('.tab');
  await p2.click('[data-k="tri-ciccio"]');
  await p2.click('#foglio [data-k="vt-pj"]');
  await p2.waitForTimeout(80);
  if (!/1 voto/.test(await p2.textContent('.triage'))) fail('alle 5:58 il voto deve contare nella serata in corso');
  await p2.clock.fastForward('03:00');
  await p2.waitForTimeout(150);
  const dopo = await p2.textContent('.triage');
  if (!/Codice rosso di ieri sera: CICCIO/.test(dopo)) fail('alle 6:01 manca il verdetto della serata: ' + dopo);
  if (!/0 voti/.test(dopo)) fail('alle 6:01 il triage deve ripartire da zero: ' + dopo);
  if (!/Re dell’oblio di ottobre: CICCIO/.test(dopo)) fail('re dell’oblio del mese non aggiornato: ' + dopo);
  await p2.locator('.triage').screenshot({ path: path.join(shots, '35-triage-dopo-le-6.png') });
  await p2.click('[data-k="pul-fatta"]');
  await p2.selectOption('#pu-q', '13');
  await p2.click('#foglio button[type=submit]');
  await p2.waitForTimeout(80);
  if (!/la prossima tra 1 giorno/.test(await p2.textContent('#view'))) fail('pulizie a 13 giorni: manca «la prossima tra 1 giorno»');
  await p2.clock.fastForward('24:00:00');
  await p2.waitForTimeout(150);
  if (!/Pulizie scadute/.test(await p2.textContent('#view'))) fail('dopo 14 giorni non esce l’avviso delle pulizie');
  if (!/Da fare|Urgente/.test(await p2.textContent('#view'))) fail('con le pulizie scadute il reparto non segnala nulla');
  await p2.locator('.cartella:has(h2:text("Faccende"))').screenshot({ path: path.join(shots, '36-pulizie-scadute.png') });
  note('pulizie: avviso dopo 14 giorni ok');
  note('chiusura alle 6: verdetto e nuova serata ok');
  await ctx2.close();

  // ---------- più telefoni, stessi dati (finto server al posto di Firebase) ----------
  const telefono = async (nome) => {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'it-IT', timezoneId: 'Europe/Rome' });
    await c.addInitScript(() => { window.OBLIO_SYNC = { room: 'prova', mock: location.origin + '/mock/' }; });
    const p = await c.newPage();
    ascolta(p);
    await p.goto(base);
    await p.waitForSelector('.tab');
    const ok = await p.waitForFunction(() => { const d = document.querySelector('#sync'); return d && !d.hidden && d.classList.contains('ok'); }, null, { timeout: 10000 }).then(() => true, () => false);
    if (!ok) fail(nome + ': non risulta sincronizzato');
    return { c, p, tab: async (n) => { await p.click('.tab:has-text("' + n + '")'); await p.waitForTimeout(60); } };
  };
  const aspetta = async (pg, fn, arg, cosa) => {
    const ok = await pg.waitForFunction(fn, arg, { timeout: 15000 }).then(() => true, () => false);
    if (!ok) fail(cosa);
    return ok;
  };
  const A = await telefono('telefono A');
  await A.tab('Farmacia');
  await A.p.click('.chip:has-text("PESCE")');
  await A.p.click('.prod-add:has-text("Birra")');
  await A.p.click('.posbar .pill:has-text("Sul ticket")');
  await A.p.waitForTimeout(400);
  const B = await telefono('telefono B');
  await B.tab('Ticket');
  await aspetta(B.p, () => /1,00/.test(document.querySelector('#view').textContent), null, 'B non vede il ticket di PESCE segnato da A');
  await shot('38-sync-b-ticket', false, B.p);
  // B vota, A vede il voto
  await B.tab('Reparto');
  await B.p.click('[data-k="tri-pesce"]');
  await B.p.click('#foglio [data-k="vt-pj"]');
  await A.tab('Reparto');
  await aspetta(A.p, () => /1 voto/.test(document.querySelector('.triage').textContent), null, 'A non vede il voto dato da B');
  // A cambia il prezzo della birra, B lo vede nel listino
  await A.tab('Altro');
  await A.p.click('.voce:has-text("Listino")');
  await A.p.click('.riga:has-text("Birra")');
  await A.p.fill('#pr-a', '1,50');
  await A.p.click('#foglio button[type=submit]');
  await B.tab('Altro');
  await B.p.click('.voce:has-text("Listino")');
  await aspetta(B.p, () => /1,50/.test((document.querySelector('.riga') && [...document.querySelectorAll('.riga')].find((r) => /Birra/.test(r.textContent)) || {}).textContent || ''), null, 'B non vede il nuovo prezzo della birra');
  // B senza rete incassa da PESCE; quando torna la rete A vede il ticket chiuso
  await B.c.setOffline(true);
  await B.tab('Ticket');
  await B.p.click('.riga:has-text("PESCE")');
  await B.p.click('#foglio .pill:has-text("Incassa")');
  await B.p.fill('#py-a', '1,00');
  await B.p.click('#foglio button[type=submit]');
  await aspetta(B.p, () => { const d = document.querySelector('#sync'); return d && (d.classList.contains('attesa') || d.classList.contains('errore')); }, null, 'senza rete B non segnala le modifiche in attesa');
  await shot('39-sync-b-senza-rete', false, B.p);
  await A.tab('Ticket');
  await A.p.waitForTimeout(800);
  if (!/1,00/.test(await A.p.textContent('#view'))) fail('A ha perso il ticket di PESCE prima che B tornasse online');
  await B.c.setOffline(false);
  await aspetta(A.p, () => /Ticket non pagati\s*0,00/.test(document.querySelector('#view').textContent.replace(/\u00a0/g, ' ')), null, 'tornata la rete, A non vede l’incasso fatto da B');
  await aspetta(B.p, () => document.querySelector('#sync').classList.contains('ok'), null, 'B non torna sincronizzato');
  // freccette dal vivo: A tira, B vede la partita
  await A.tab('Freccette');
  await A.p.click('[data-k="modo-301"]');
  await A.p.click('[data-k="gioc-pj"]');
  await A.p.click('[data-k="gioc-pesce"]');
  await A.p.click('[data-k="inizia"]');
  await A.p.click('[data-k="mol-3"]');
  await A.p.click('[data-k="n-20"]');
  await B.tab('Freccette');
  await aspetta(B.p, () => [...document.querySelectorAll('.gioc-p')].some((e) => e.textContent === '241'), null, 'B non vede la partita di A');
  await shot('40-sync-freccette-b', false, B.p);
  // un terzo telefono nuovo trova tutto uguale e non sovrascrive niente
  const C = await telefono('telefono C');
  await C.tab('Altro');
  await C.p.click('.voce:has-text("Listino")');
  await aspetta(C.p, () => [...document.querySelectorAll('.riga')].some((r) => /Birra/.test(r.textContent) && /1,50/.test(r.textContent)), null, 'il telefono nuovo ha rimesso il prezzo di partenza');
  const totali = await Promise.all([A, B, C].map(async (t) => { await t.tab('Reparto'); return (await t.p.textContent('.bollettino')).replace(/\s+/g, ' ').replace(/Telefoni.*?Backup/, 'Backup'); }));
  if (totali[0] !== totali[1] || totali[1] !== totali[2]) fail('i bollettini dei tre telefoni non coincidono: ' + totali.join(' | '));
  note('sincronizzazione: 3 telefoni allineati (consumi, voti, prezzi, incasso senza rete, freccette)');
  for (const t of [A, B, C]) await t.c.close();

  const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'it-IT', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  const p3 = await ctx3.newPage();
  ascolta(p3);
  await p3.goto(base);
  await p3.waitForSelector('.tab');
  if (!/installa l’app prima di usarla/.test(await p3.textContent('#avviso'))) fail('su iPhone in Safari manca l’avviso di installare prima');
  await shot('37-iphone-safari', false, p3);
  await ctx3.close();

  await browser.close();
  server.close();
  console.log(problems.length ? '\n' + problems.length + ' problemi' : '\nprova a schermo: nessun problema');
  process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error('ERRORE PROVA', e); server.close(); process.exit(2); });
