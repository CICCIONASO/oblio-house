// Prova a schermo: flussi principali a larghezza telefono, voto, freccette, classifiche,
// chiusura della serata alle 6 (orologio finto) e riapertura senza rete.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'docs');
const PURE = /\/\* =+ PURE =+ \*\/([\s\S]*?)\/\* =+ END PURE =+ \*\//.exec(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8')
)[1];
const calc = new Function(PURE + '\nreturn {derive,previsione,normState,canon,hashStr};')();
const statoDi = async (pg) => calc.normState(await pg.evaluate(() => JSON.parse(localStorage.getItem('oblio.v1'))));
// «1.234,56 €» → 123456 centesimi
const centesimi = (s) => {
  const m = /([-−])?\s*([\d.]+),(\d{2})/.exec(s || '');
  return m ? (m[1] ? -1 : 1) * (parseInt(m[2].replace(/\./g, ''), 10) * 100 + parseInt(m[3], 10)) : NaN;
};
const shots = path.join(__dirname, 'shots');
fs.mkdirSync(shots, { recursive: true });
const { DESPAR, CONAD, foto } = require('./scontrini.js');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
  '.gz': 'application/gzip',
  '.txt': 'text/plain; charset=utf-8',
};
// servito sotto /app/ per provare i percorsi relativi come su un sito con sottocartella
// finto server di sincronizzazione (al posto di Firebase): l'ultimo che scrive vince, «s» è l'ora del server
const stanze = {};
let orologio = 0;
function mock(req, res) {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'POST' && u.pathname === '/mock/w') {
    let b = '';
    req.on('data', (c) => {
      b += c;
    });
    req.on('end', () => {
      const d = JSON.parse(b);
      const st = (stanze[d.room] = stanze[d.room] || {});
      st[d.key] = { key: d.key, c: d.c, i: d.i, j: d.j, u: d.u, by: d.by, s: ++orologio };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
    });
    return;
  }
  if (u.pathname === '/mock/r') {
    const since = +u.searchParams.get('since') || 0;
    const st = stanze[u.searchParams.get('room')] || {};
    const out = Object.values(st)
      .filter((d) => d.s > since)
      .sort((a, b) => a.s - b.s);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(out));
    return;
  }
  res.writeHead(404);
  res.end('no');
}
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.startsWith('/mock/')) {
    mock(req, res);
    return;
  }
  if (!p.startsWith('/app/')) {
    res.writeHead(404);
    res.end('no');
    return;
  }
  p = p.slice(4);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(dist, p);
  if (!f.startsWith(dist) || !fs.existsSync(f)) {
    res.writeHead(404);
    res.end('no');
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(f).pipe(res);
});

const problems = [];
const note = (m) => {
  console.log(m);
};
const fail = (m) => {
  problems.push(m);
  console.log('PROBLEMA: ' + m);
};

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port + '/app/';
  const browser = await chromium.launch();
  // niente Firebase vero durante la prova: il pacchetto in docs/ porta la configurazione del locale,
  // e senza questi blocchi la prova scriverebbe i suoi movimenti finti nei dati veri
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (o) => {
    const c = await newContext(o);
    // sincronizzazione spenta (le prove dei telefoni la riaccendono col finto server);
    // in più la rete verso Firebase resta chiusa, nel caso qualcosa la riaccendesse
    await c.addInitScript(() => {
      window.OBLIO_SYNC = {};
    });
    await c.route(/gstatic\.com\/firebasejs|firestore\.googleapis\.com|firebaseio\.com|firebaseapp\.com/, (r) => r.abort());
    return c;
  };
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  const ascolta = (pg) => {
    pg.on('console', (m) => {
      if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) fail('console: ' + m.text());
    });
    pg.on('pageerror', (e) => fail('errore pagina: ' + e.message));
  };
  ascolta(page);

  const shot = async (name, full, pg) => {
    await (pg || page).screenshot({ path: path.join(shots, name + '.png'), fullPage: !!full });
  };
  const overflow = async (where) => {
    const o = await page.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, iw: window.innerWidth }));
    if (o.sw > o.iw + 1) fail('scorrimento orizzontale in ' + where + ': ' + o.sw + ' > ' + o.iw);
  };
  const facce = async (where, pg) => {
    const r = await (pg || page).evaluate(async () => {
      const imgs = [...document.querySelectorAll('img')];
      await Promise.all(
        imgs.map((i) =>
          i.complete
            ? null
            : new Promise((ok) => {
                i.onload = i.onerror = ok;
              })
        )
      );
      return { n: imgs.length, rotte: imgs.filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src').slice(0, 40)) };
    });
    if (r.rotte.length) fail('immagini che non si aprono in ' + where + ': ' + r.rotte.join(', '));
    return r.n;
  };
  // 0.11.0: Ticket è una linguetta della Farmacia, le freccette stanno nella Ludoteca
  const tab = async (name, pg) => {
    pg = pg || page;
    const vero = name === 'Ticket' ? 'Farmacia' : name === 'Freccette' ? 'Ludoteca' : name;
    await pg.click('.tab:has-text("' + vero + '")');
    await pg.waitForTimeout(80);
    if (name === 'Ticket') await pg.click('[data-k="farm-ticket"]');
    else if (name === 'Farmacia') await pg.click('[data-k="farm-banco"]');
    else if (name === 'Freccette') await pg.click('[data-k="apri-freccette"]');
    else return;
    await pg.waitForTimeout(80);
  };
  const text = async (sel) => (await page.textContent(sel)) || '';
  const cassa = async () => {
    await tab('Reparto');
    await page.click('[data-k="apri-cassa"]');
    await page.waitForTimeout(80);
  };

  // dalla 0.11.0 si entra con il proprio nome e un PIN personale (qui CICCIO, PIN 1111)
  const entra = async (pg, nome, pin) => {
    pg = pg || page;
    await pg.waitForSelector('[data-k^="chi-sono-"]');
    if (await pg.$('.tab:visible')) fail('senza login la barra in basso non deve vedersi');
    await pg.click('[data-k="chi-sono-' + (nome || 'ciccio') + '"]');
    if (await pg.$('#lg-n1')) {
      await pg.fill('#lg-n1', pin || '1111');
      await pg.fill('#lg-n2', pin || '1111');
    } else await pg.fill('#lg-pin', pin || '1111');
    await pg.click('[data-k="lg-ok"]');
    const regole = await pg.waitForSelector('[data-k="regole-ok"]', { timeout: 3000 }).catch(() => null);
    if (regole) await regole.click();
    await pg.waitForSelector('.tab');
  };
  await page.goto(base);
  await page.waitForSelector('[data-k^="chi-sono-"]');
  await shot('00-chi-sei', true);
  await overflow('chi sei');
  if ((await page.$$('[data-k^="chi-sono-"]')).length !== 7) fail('«Chi sei?»: attese 7 persone (i 6 più ELENA)');
  const nFacce = await facce('chi sei');
  if (nFacce < 6) fail('in «Chi sei?» attese 6 caricature, trovate ' + nFacce);
  await entra();
  await page.waitForTimeout(300);
  await shot('01-reparto-vuoto', true);
  await overflow('reparto');

  // Farmacia: PESCE prende 2 birre e un Kinder Bueno, sul ticket
  await tab('Farmacia');
  await shot('02-farmacia', true);
  await overflow('farmacia');
  await page.click('.chip:has-text("PESCE")');
  await page.click('.prod-add:has-text("Birra")');
  await page.click('.prod-add:has-text("Birra")');
  await page.click('.prod-add:has-text("Kinder Bueno")');
  await page.waitForTimeout(80);
  await shot('03-farmacia-selezione');
  await overflow('farmacia selezione');
  const tot = await text('.pos-tot strong');
  if (!/3,30/.test(tot)) fail('totale atteso 3,30, trovato: ' + tot);
  await page.click('.posbar .pill:has-text("Sul ticket")');
  await page.waitForTimeout(100);
  if (!/ticket di PESCE/i.test(await text('#toast'))) fail('toast ticket mancante: ' + (await text('#toast')));

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
  await shot('05-ticket', true);
  await overflow('ticket');
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
  // senza admin + e − debito non ci sono: resta solo «Prende dalla cassa»
  if (await page.$('#foglio .pill:has-text("+ Debito")')) fail('«+ Debito» visibile senza admin');
  await page.click('#foglio [data-k="prende"]');
  // azione sensibile: il PIN compare sopra la cartella; sbagliato → errore, giusto → si apre il modulo (e per 10 minuti basta)
  if (!(await page.$('#foglio .pin-box'))) fail('«Prende dalla cassa» senza richiesta del PIN');
  await page.fill('#pin-c', '1234');
  await page.click('#foglio [data-k="pin-ok"]');
  await page.waitForTimeout(60);
  if (!/PIN sbagliato/.test(await text('#foglio .pin-box'))) fail('PIN sbagliato non segnalato');
  await shot('06b-pin');
  await page.fill('#pin-c', '1111');
  await page.click('#foglio [data-k="pin-ok"]');
  await page.waitForTimeout(80);
  await page.fill('#pr-a', '5');
  await page.fill('#pr-n', 'Pizza');
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
  // 1,20 (coca) + 2,00 (pesce) − 5,00 (presi da CONTI) + 50,00 = 48,20
  if (!/48,20/.test(cassaTxt)) fail('cassa attesa 48,20, trovata: ' + cassaTxt);
  await page.click('.pill:has-text("Conta cassa")');
  await page.fill('#ct-a', '53');
  await page.waitForTimeout(60);
  if (!/in più/.test(await text('#foglio'))) fail('differenza conta cassa non mostrata');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(80);
  await shot('08-cassa', true);
  await overflow('cassa');
  if (!/53,00/.test(await text('.cifrona'))) fail('cassa dopo conta attesa 53,00: ' + (await text('.cifrona')));
  if (!/Reparto/.test(await text('.indietro'))) fail('dalla cassa il tasto indietro non torna al Reparto');

  // dettaglio e annullo di un movimento
  await page.click('.riga:has-text("Entrata")');
  await page.click('#foglio .pill:has-text("Annulla movimento")');
  // 50 € è più di 20: senza motivo non si annulla
  await page.click('#foglio .pill:has-text("Sì, annulla")');
  await page.waitForTimeout(80);
  if (await page.$('#foglio .pill:has-text("Ripristina")')) fail('annullato un movimento grande senza motivo');
  if (!/motivo/i.test(await text('#toast'))) fail('manca l’avviso del motivo obbligatorio');
  await page.fill('#mv-mot', 'Segnata per prova');
  await page.click('#foglio .pill:has-text("Sì, annulla")');
  await page.waitForTimeout(80);
  if (!/Segnata per prova/.test(await text('#foglio'))) fail('il motivo dell’annullamento non si vede nel movimento');
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
  await shot('11-altro', true);
  await overflow('altro');
  // Admin: senza codice le impostazioni non si vedono; con 0101 il telefono diventa admin
  if (await page.$('.menu.admin')) fail('le voci admin si vedono senza modalità admin');
  await page.click('.voce:has-text("Admin")');
  await page.fill('#adm-c', '9999');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(60);
  if (!/Codice sbagliato/.test(await text('#foglio'))) fail('codice admin sbagliato non segnalato');
  await page.fill('#adm-c', '0101');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(100);
  if (!(await page.$('.menu.admin .voce:has-text("Listino")'))) fail('dopo il codice admin il Listino non compare');
  await shot('11b-altro-admin', true);
  await overflow('altro admin');
  await page.click('.voce:has-text("Scorte e spesa")');
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
  await shot('13-scorte', true);
  await overflow('scorte');
  const sc = await text('#view');
  if (!/Birra/.test(sc) || !/Sacchi neri/.test(sc) || !/ne restano 3/.test(sc)) fail('lista spesa non coerente');
  await page.click('.pill:has-text("Carico")');
  await page.fill('#ca-p2', '24');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(80);
  if (!/27 pz/.test(await text('#view'))) fail('carico birra: attesi 27 pz');

  // prodotto nuovo dal magazzino, con i pezzi che ci sono già e la soglia
  await page.click('[data-k="nuovo-prodotto"]');
  await page.fill('#pr-n', 'Gin tonic');
  await page.fill('#pr-a', '5');
  await page.fill('#pr-pz', '6');
  await page.fill('#pr-so', '2');
  await shot('13b-nuovo-prodotto');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(80);
  if (!/6 pz/.test(await text('.riga:has-text("Gin tonic")'))) fail('prodotto nuovo non entrato in magazzino con 6 pezzi');
  if (!/soglia 2/.test(await text('.riga:has-text("Gin tonic")'))) fail('prodotto nuovo senza soglia');
  // dall'inventario: aggiungo un prodotto a metà conta, i numeri già scritti restano
  await page.click('.pill:has-text("Inventario")');
  await page.fill('#iv-p4', '7');
  await page.click('#foglio [data-k="iv-nuovo"]');
  if (!(await page.$('#pr-pz'))) fail('dall’inventario il prodotto nuovo deve chiedere i pezzi');
  await page.fill('#pr-n', 'Taralli');
  await page.fill('#pr-a', '1');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(150);
  if ((await page.inputValue('#iv-p4').catch(() => '')) !== '7') fail('tornando all’inventario il numero scritto prima si è perso');
  await page.fill('#foglio li:has(label:text-is("Taralli")) input', '5');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(80);
  if (!/5 pz/.test(await text('.riga:has-text("Taralli")'))) fail('inventario del prodotto nuovo non salvato');
  // dal carico: niente «pezzi adesso», si scrivono come arrivati (una volta sola)
  await page.click('.pill:has-text("Carico")');
  await page.fill('#ca-p4', '2');
  await page.click('#foglio [data-k="ca-nuovo"]');
  if (await page.$('#pr-pz')) fail('dal carico il prodotto nuovo non deve chiedere i pezzi presenti');
  await page.fill('#pr-n', 'Patatine');
  await page.fill('#pr-a', '0,80');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(150);
  if ((await page.inputValue('#ca-p4').catch(() => '')) !== '2') fail('tornando al carico il numero scritto prima si è perso');
  await page.fill('#foglio li:has(label:text-is("Patatine")) input', '10');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(80);
  if (!/10 pz/.test(await text('.riga:has-text("Patatine")'))) fail('carico del prodotto nuovo non salvato');
  if (!/9 pz/.test(await text('.riga:has-text("Estath")'))) fail('Estathé: attesi 7 + 2 = 9 pezzi');
  await shot('13c-scorte-prodotti-nuovi', true);
  await overflow('scorte con prodotti nuovi');

  // Soldi del locale: stessa cifra in pagina, nel bollettino e nella cassa; il conto lo rifà la prova
  await tab('Altro');
  await page.click('.voce:has-text("Soldi del locale")');
  await page.waitForTimeout(80);
  await shot('13d-soldi', true);
  await overflow('soldi');
  {
    const st = calc.normState(await page.evaluate(() => JSON.parse(localStorage.getItem('oblio.v1'))));
    const P = calc.previsione(st, calc.derive(st));
    if (P.attuale !== P.cassa + P.scorte) fail('soldi: l’attuale non è cassa + scorte');
    if (P.previsionale !== P.attuale + P.incassare - P.restituire) fail('soldi: il previsionale non torna');
    const mostrato = centesimi(await text('#soldi-tot'));
    if (mostrato !== P.attuale) fail('soldi: in pagina ' + mostrato + ' centesimi, attesi ' + P.attuale);
    if (centesimi(await text('#soldi-prev')) !== P.previsionale) fail('soldi: previsionale in pagina sbagliato');
    const gin = P.righe.find((r) => r.n === 'Gin tonic');
    if (!gin || gin.v !== 3000) fail('soldi: Gin tonic deve valere 30,00 € (6 × 5,00)');
    if (!/Gin tonic6 pz × 5,00\s€30,00\s€/.test(await text('.cartella:has(h3:text("Scorte in magazzino"))')))
      fail('soldi: riga del Gin tonic sbagliata: ' + (await text('.cartella:has(h3:text("Scorte in magazzino"))')).slice(0, 200));
    if (!/Prima di fidarvi/.test(await text('#view')) || !/prezzo di vendita/.test(await text('#view')))
      fail('soldi: mancano le avvertenze');
    await tab('Reparto');
    if (centesimi(await text('[data-k="apri-soldi"]')) !== P.attuale) fail('bollettino: soldi del locale diversi dalla pagina');
    await page.click('[data-k="apri-soldi"]');
    await page.waitForTimeout(80);
    if (!/Soldi del locale/.test(await text('h2.titolo'))) fail('dal bollettino non si apre la pagina dei soldi');
    if (!/Reparto/.test(await text('.indietro'))) fail('dai soldi il tasto indietro non torna al Reparto');
    await cassa();
    if (centesimi(await text('[data-k="cassa-soldi"]')) !== P.attuale) fail('cassa: collegamento ai soldi del locale sbagliato');
    note(
      'soldi del locale: adesso ' +
        (P.attuale / 100).toFixed(2) +
        ' € (cassa ' +
        P.cassa / 100 +
        ', scorte ' +
        P.scorte / 100 +
        '), previsionale ' +
        (P.previsionale / 100).toFixed(2) +
        ' € (graffi ' +
        P.incassare / 100 +
        ', crediti ' +
        P.restituire / 100 +
        ')'
    );
  }
  await tab('Altro');
  await page.click('.voce:has-text("Scorte e spesa")');

  // ---------- Scontrino: foto letta sul telefono (motore vero, foto di prova), conferma riga per riga ----------
  {
    const fotoD = await foto(DESPAR, path.join(shots, 'scontrino-despar.jpg'), { ombra: '8a8378', storto: 2, sfoca: 1 });
    const fotoC = await foto(CONAD, path.join(shots, 'scontrino-conad.jpg'), {
      font: 'Liberation Mono',
      storto: -2,
      sfoca: 1.0,
      luce: 0.85,
    });
    const leggi = async (file) => {
      const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-k="scontrino"]')]);
      await fc.setFiles(file);
      const ok = await page.waitForSelector('#foglio-t:text("Conferma lo scontrino")', { timeout: 90000 }).then(
        () => true,
        () => false
      );
      if (!ok) fail('scontrino: la conferma non arriva: ' + (await text('#foglio')).slice(0, 300));
      return ok;
    };
    const righe = async () =>
      page.$$eval('#foglio .sc-riga', (li) =>
        li.map((r) => ({
          d: r.querySelector('.sc-d span').textContent,
          sel: r.querySelector('select.sc-prod').selectedOptions[0].textContent,
          pz: (r.querySelector('.sc-num input') || {}).value,
          sp: r.querySelectorAll('.sc-num input')[1].value,
        }))
      );
    const sceglie = async (n, testo) => {
      const s = page.locator('#foglio .sc-riga').nth(n).locator('select.sc-prod');
      await s.selectOption({ label: testo });
    };
    const prima = await statoDi(page),
      D0 = calc.derive(prima);
    const t0 = Date.now();
    if (await leggi(fotoD)) {
      note('scontrino letto in ' + (Date.now() - t0) + ' ms (prima volta, con il download del lettore)');
      await shot('13e-scontrino-conferma', true);
      const r = await righe();
      // la descrizione può avere qualche lettera storta (è una foto): contano prodotto, pezzi e prezzo
      const attese = [
        ['COCA', 'Coca Cola lattina', '1', '0,89'],
        ['KINDER', 'Kinder Bueno', '2', '1,58'],
        ['BIRRA', 'Birra', '1', '1,19'],
        ['PATATINE', 'Cipster', '1', '1,19'],
        ['SACCHI', '+ Prodotto nuovo', '1', '2,49'],
        ['ESTATHE', 'Estathé limone / pesca', '1', '0,79'],
      ];
      if (JSON.stringify(r.map((x) => [x.d.split(' ')[0], x.sel, x.pz, x.sp])) !== JSON.stringify(attese))
        fail('scontrino: righe proposte diverse: ' + JSON.stringify(r));
      if (!/Totale letto sullo scontrino: 8,13\s€ · torna/.test(await text('#foglio .sc-somma')))
        fail('scontrino: somma e totale non tornano: ' + (await text('#foglio .sc-somma')));
      if (/\[object|null|undefined|NaN/.test(await text('#foglio')))
        fail('scontrino: nel foglio compare testo tecnico: ' + (await text('#foglio')).slice(0, 400));
      const larg = await page.$eval('#foglio-b', (b) => [b.scrollWidth, b.clientWidth]);
      if (larg[0] > larg[1] + 1) fail('scontrino: il foglio scorre di lato ' + larg.join(' > '));
      // chiusura per sbaglio: chiede prima di buttare lo scontrino letto
      await page.click('#foglio-x');
      await page.waitForTimeout(60);
      if (!/Esci senza registrare\?/.test(await text('#foglio .uscita')))
        fail('scontrino: chiudendo non chiede niente e le righe lette vanno perse');
      await page.click('[data-k="esci-resta"]');
      await page.waitForTimeout(60);
      if (!(await page.$('#foglio .sc-righe'))) fail('scontrino: dopo «Resto qui» lo scontrino non c’è più');
      // la birra la escludo (presa per casa), i sacchi sono una spesa del locale ma non vanno in magazzino
      await sceglie(2, 'Escludi: non è del locale');
      await sceglie(4, 'Altra spesa (non va in magazzino)');
      if (!/Righe: 6,94\s€/.test(await text('#foglio .sc-somma')))
        fail('scontrino: somma dopo le scelte: ' + (await text('#foglio .sc-somma')));
      await page.click('#foglio button:has-text("Registra lo scontrino")');
      await page.waitForTimeout(150);
      if (!/Scontrino registrato: 5 pezzi, spesa 6,94/.test(await text('#toast')))
        fail('scontrino: messaggio finale: ' + (await text('#toast')));
      const dopo = await statoDi(page),
        D1 = calc.derive(dopo),
        pid = (n) => dopo.products.find((p) => p.name === n);
      if (D1.cash !== D0.cash - 694) fail('scontrino: la spesa doveva uscire dalla cassa (6,94)');
      if (D1.stock[pid('Coca Cola lattina').id] !== D0.stock[pid('Coca Cola lattina').id] + 1) fail('scontrino: coca non caricata');
      if (D1.stock[pid('Kinder Bueno').id] !== 2 || D1.stock[pid('Birra').id] !== D0.stock[pid('Birra').id])
        fail('scontrino: carico sbagliato');
      if (pid('Kinder Bueno').cost !== 79 || pid('Cipster').cost !== 119) fail('scontrino: costi d’acquisto sbagliati');
      if (!(pid('Kinder Bueno').al || []).some((a) => a.d === 'KINDER BUENO T2')) fail('scontrino: la descrizione non è stata ricordata');
      if (dopo.products.some((p) => /sacchi/i.test(p.name))) fail('scontrino: i sacchi non dovevano diventare un prodotto');
      const sp = dopo.moves.filter((m) => m.k === 'exp').pop();
      if (!sp || sp.note !== 'Scontrino DESPAR ALTAMURA del 12/10/2026' || sp.a !== 694) fail('scontrino: spesa nel registro sbagliata');
    }
    // secondo scontrino: un prodotto nuovo, una confezione da 4, pagato da CHICCO e scalato dal suo ticket
    if (await leggi(fotoC)) {
      const r = await righe();
      if (r.length !== 5 || r[2].sel !== '+ Prodotto nuovo' || r[1].sel !== 'Mars')
        fail('scontrino 2: righe proposte: ' + JSON.stringify(r));
      await page.locator('#foglio .sc-riga').nth(1).locator('button:has-text("Confezione da 4")').click();
      const nuovo = page.locator('#foglio .sc-riga').nth(2);
      if ((await nuovo.locator('.sc-nuovo input').first().inputValue()) !== 'Acqua naturale') fail('scontrino 2: nome proposto');
      await page.click('#foglio button:has-text("Registra lo scontrino")');
      if (!/prezzo di vendita di «Acqua naturale»/.test(await text('#foglio .errore')))
        fail('scontrino 2: senza prezzo di vendita non deve salvare');
      await nuovo.locator('.sc-nuovo input.soldi').fill('0,50');
      await page.click('#foglio .chip:has-text("CHICCO")');
      await page.click('#foglio .chip:has-text("Scala dal suo ticket")');
      await shot('13f-scontrino-nuovo-prodotto', true);
      const p0 = await statoDi(page),
        d0 = calc.derive(p0);
      await page.click('#foglio button:has-text("Registra lo scontrino")');
      await page.waitForTimeout(150);
      const p1 = await statoDi(page),
        d1 = calc.derive(p1),
        acqua = p1.products.find((p) => p.name === 'Acqua naturale'),
        mars = p1.products.find((p) => p.name === 'Mars');
      if (!acqua || acqua.price !== 50 || acqua.cost !== 110 || d1.stock[acqua.id] !== 3)
        fail('scontrino 2: prodotto nuovo sbagliato ' + JSON.stringify(acqua));
      if (mars.cost !== 75 || d1.stock[mars.id] !== (d0.stock[mars.id] || 0) + 4) fail('scontrino 2: confezione da 4 non caricata');
      if (d1.debt.chicco !== d0.debt.chicco - 1257 || d1.cash !== d0.cash) fail('scontrino 2: spesa di CHICCO non scalata dal ticket');
      note('scontrini: 2 letti con il motore vero, righe abbinate, prodotto nuovo, costi e spesa registrati');
    }
  }

  // la Farmacia mostra le scorte e scala
  await tab('Farmacia');
  if (!/27 pz/.test(await text('.prod-add:has-text("Birra")'))) fail('scorta non mostrata in farmacia');
  await page.click('.chip:has-text("PJ")');
  await page.click('.prod-add:has-text("Birra")');
  await page.click('.posbar .pill:has-text("Paga subito")');
  await page.waitForTimeout(80);
  if (!/26 pz/.test(await text('.prod-add:has-text("Birra")'))) fail('scorta non scalata');
  // PESCE prende una birra e dà di più per chiudere i suoi graffi
  {
    const s0 = await statoDi(page),
      d0 = calc.derive(s0),
      deb = d0.debt.pesce;
    await page.click('.chip:has-text("PESCE")');
    await page.click('.prod-add:has-text("Birra")');
    await page.click('[data-k="ha-dato"]');
    await page.click('#foglio .chip:has-text("Conto + graffi")');
    if (!/scalano i graffi: chiusi tutti/.test(await text('#foglio')))
      fail('ha dato: anteprima sbagliata: ' + (await text('#foglio')).slice(0, 200));
    await shot('13g-ha-dato');
    await page.click('#foglio button[type=submit]');
    await page.waitForTimeout(100);
    if (!/scalati dai graffi/.test(await text('#toast'))) fail('ha dato: messaggio: ' + (await text('#toast')));
    const d1 = calc.derive(await statoDi(page));
    if (d1.debt.pesce !== 0 || d1.cash !== d0.cash + 100 + deb)
      fail('ha dato: graffi o cassa sbagliati (' + d1.debt.pesce + ', ' + (d1.cash - d0.cash) + ')');
    note('ha dato di più: ' + (100 + deb) / 100 + ' € per una birra da 1 €, graffi di PESCE chiusi');
  }

  // Listino e persone
  await tab('Altro');
  await page.click('.voce:has-text("Listino")');
  await shot('14-listino', true);
  await overflow('listino');
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
    // non tutte le sere si espone qualcosa: per la prova segno il vetro tutti i giorni
    await tab('Altro');
    await page.click('.voce:has-text("Regole")');
    for (const g of ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']) {
      const c = page.locator('.campo:has(.lab:text("Ritiro ' + g + ' mattina")) .chip:has-text("Vetro")');
      if ((await c.getAttribute('aria-pressed')) !== 'true') await c.click();
    }
    await page.click('button:has-text("Salva il calendario")');
    await tab('Reparto');
  }
  if (!/Stasera fuori:/.test(await text('#view'))) fail('manca il promemoria dei rifiuti di stasera');
  if (/Organico|Carta/.test(await text('.cartella:has(h2:text("Faccende"))')))
    fail('rifiuti: organico e carta non li buttate, niente avviso');
  {
    await tab('Altro');
    await page.click('.voce:has-text("Regole")');
    const premuto = async (n) => page.getAttribute('.campo:has(.lab:text("Cosa buttate")) .chip:has-text("' + n + '")', 'aria-pressed');
    if (
      (await premuto('Organico')) !== 'false' ||
      (await premuto('Vetro')) !== 'true' ||
      (await premuto('Indifferenziata')) !== 'true' ||
      (await premuto('Plastica')) !== 'true'
    )
      fail('rifiuti: «Cosa buttate» di partenza sbagliato');
    await tab('Reparto');
  }
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
  if (!/Ultima 3 giorni fa; la prossima tra 11 giorni/.test(await text('#view')))
    fail('pulizie: conto alla rovescia sbagliato: ' + (await text('.cartella:has(h2:text("Faccende"))')));
  await page.locator('.cartella:has(h2:text("Faccende"))').screenshot({ path: path.join(shots, '15d-faccende-fatte.png') });

  // ---------- Triage (0.11.0): voto a podio, ognuno dal suo telefono ----------
  await tab('Ludoteca');
  if (!/Podio: il 1° vale 3 punti/.test(await text('.triage'))) fail('triage: manca la regola del podio');
  await page.click('[data-k="vota"]');
  await page.waitForTimeout(80);
  await shot('16-voto-podio');
  await page.click('#foglio [data-k="vt-pesce"]');
  await page.click('#foglio [data-k="vt-conti"]');
  await page.click('#foglio [data-k="vt-pj"]');
  await page.waitForTimeout(60);
  const posti = await page.$$eval('#foglio .chips .posto', (els) => els.map((e) => e.textContent));
  if (posti.join() !== '3°,1°,2°') fail('podio: i posti seguono l’ordine dei tocchi: ' + posti);
  await page.click('#foglio .voto-posto >> nth=0 >> .chip:has-text("Urla strazianti")');
  await page.click('#foglio .voto-posto >> nth=0 >> .chip:has-text("Silenzio assordante")');
  await shot('16b-voto-sintomi');
  await page.click('#foglio [data-k="salva-voto"]');
  await page.waitForTimeout(80);
  if (!/CICCIO vota 1° PESCE, 2° CONTI, 3° PJ/i.test(await text('#toast'))) fail('toast del voto: ' + (await text('#toast')));
  let tri = await text('.triage');
  if (!/PESCE\s*3 punti/i.test(tri) || !/Il tuo voto: 1° PESCE/i.test(tri)) fail('triage dopo il voto: ' + tri);
  // un visitatore vota da questo telefono
  await page.click('[data-k="vota-visitatore"]');
  await page.click('#foglio .chip:has-text("Gigi")');
  await page.waitForTimeout(500);
  await page.click('#foglio [data-k="vt-conti"]');
  await page.click('#foglio [data-k="vt-pesce"]');
  await shot('16c-voto-visitatore');
  await page.click('#foglio [data-k="salva-voto"]');
  await page.waitForTimeout(80);
  tri = await text('.triage');
  if (!/CONTI\s*5 punti/i.test(tri) || !/PESCE\s*5 punti/i.test(tri)) fail('pari punti dopo il visitatore: ' + tri);
  await shot('17-triage', false);
  await page.locator('.triage').screenshot({ path: path.join(shots, '17b-triage-card.png') });
  await overflow('triage');
  // Vedi i voti (admin: può togliere)
  await page.click('.triage .pill:has-text("Vedi i voti")');
  await page.waitForTimeout(80);
  await shot('18-voti');
  if (!/CICCIO → PESCE\s*1°, 3 punti · Silenzio assordante, Urla strazianti/i.test(await text('#foglio')))
    fail('in «Vedi i voti» manca il podio con i sintomi: ' + (await text('#foglio')).slice(0, 300));
  await page.click(
    '#foglio [data-k="togli-' +
      (await page.evaluate(() => JSON.parse(localStorage.getItem('oblio.v1')).people.find((p) => p.name === 'Gigi').id)) +
      '-conti"]'
  );
  await page.waitForTimeout(80);
  await page.click('#foglio-x');
  tri = await text('.triage');
  if (!/CONTI\s*2 punti/i.test(tri)) fail('dopo aver tolto un voto: ' + tri);
  // regola: niente voto a se stessi
  await tab('Altro');
  await page.click('.voce:has-text("Regole")');
  await shot('19-regole', true);
  await overflow('regole');
  await page.uncheck('#rg-self');
  await page.click('button:has-text("Salva il triage")');
  await tab('Ludoteca');
  await page.click('[data-k="vota"]');
  if (!(await page.isDisabled('#foglio [data-k="vt-ciccio"]'))) fail('con la regola spenta CICCIO può ancora votarsi');
  await page.click('#foglio-x');
  await tab('Altro');
  await page.click('.voce:has-text("Regole")');
  await page.check('#rg-self');
  await page.click('button:has-text("Salva il triage")');

  // ---------- Freccette: 301 a chiusura libera ----------
  await tab('Freccette');
  await shot('20-freccette-nuova', true);
  await overflow('freccette');
  await page.click('[data-k="modo-301"]');
  await page.click('[data-k="gioc-pj"]');
  await page.click('[data-k="gioc-pesce"]');
  await page.click('[data-k="inizia"]');
  await page.waitForTimeout(80);
  const dart = async (mol, n) => {
    if (mol > 1) await page.click('[data-k="mol-' + mol + '"]');
    await page.click('[data-k="n-' + n + '"]');
  };
  const punti = async () => await page.$$eval('.gioc .gioc-p', (els) => els.map((e) => e.textContent));
  await dart(3, 20);
  await dart(3, 20);
  await shot('21-partita-in-corso');
  await overflow('partita');
  await dart(3, 20);
  if ((await punti())[0] !== '121') fail('dopo 180 PJ dovrebbe avere 121: ' + (await punti()));
  await dart(1, 20);
  await dart(1, 20);
  await dart(1, 20);
  await dart(3, 20);
  await dart(1, 20);
  await dart(1, 1);
  if ((await punti()).join() !== '40,241') fail('punteggi attesi 40,241: ' + (await punti()));
  await page.click('[data-k="n-0"]');
  await page.click('[data-k="n-0"]');
  await page.click('[data-k="n-0"]');
  await dart(3, 20);
  if (!/Sballato/.test(await text('#toast'))) fail('sballato non segnalato');
  if ((await punti())[0] !== '40' || !/Tocca a PESCE/i.test(await text('.turno'))) fail('dopo lo sballo PJ resta a 40 e tocca a PESCE');
  await dart(1, 1);
  await dart(1, 1);
  await dart(1, 1);
  await dart(2, 20);
  if (!/PJ vince/.test(await text('.vincitore'))) fail('PJ doveva chiudere con D20');
  await shot('22-partita-finita', true);
  await overflow('partita finita');
  await page.click('.pill:has-text("Togli l’ultima freccetta")');
  await page.waitForTimeout(80);
  if ((await punti())[0] !== '40' || !/Tocca a PJ/.test(await text('.turno'))) fail('togliere l’ultima freccetta non riapre la partita');
  await dart(2, 20);
  await page.click('.pill:has-text("Rivincita")');
  await page.waitForTimeout(80);
  if (!/Tocca a PESCE/i.test(await text('.turno'))) fail('nella rivincita deve cominciare PESCE');
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
  await shot('23-orologio');
  await overflow('orologio');
  if (!/Tocca a PESCE/i.test(await text('.turno'))) fail('dopo tre freccette tocca a PESCE');
  await page.click('.pill:has-text("Abbandona")');
  await page.click('#foglio .pill:has-text("Sì, abbandona")');
  await page.waitForTimeout(80);
  const fr = await text('#view');
  if (!/vince PJ/.test(fr) || !/abbandonata/.test(fr)) fail('storico partite incompleto: ' + fr.slice(0, 300));
  await shot('24-freccette-storico', true);

  // ---------- Classifiche ----------
  await page.click('.pill:has-text("Classifica")');
  await page.waitForTimeout(80);
  await shot('25-classifiche', true);
  await overflow('classifiche');
  await facce('classifiche');
  const cl = await text('#view');
  if (!/Nessuna serata votata/.test(cl)) fail('re dell’oblio: la serata in corso non deve contare ancora');
  if (!/1 vinta/.test(cl)) fail('classifica freccette senza la vittoria di PJ');
  const primoConsumi = await page.$eval('section:has(h3:text("Consumi")) .classifica li:first-child .nome', (e) => e.textContent);
  if (!/PESCE/i.test(primoConsumi)) fail('consumi: primo atteso PESCE, trovato ' + primoConsumi);
  if (!/subito/.test(await page.textContent('section:has(h3:text("Migliori pagatori"))')))
    fail('migliori pagatori: chi paga subito deve risultare «subito»');
  if (!/Ludoteca/.test(await text('.indietro'))) fail('dalla classifica il tasto indietro deve tornare alla Ludoteca');
  const spz = await page.textContent('section:has(h3:text("Spazzatura"))');
  if (!/PJ/.test(spz) || !/1 volta/.test(spz)) fail('classifica spazzatura senza PJ: ' + spz);

  // Backup: scarica, poi controlla che contenga voti e partite
  await tab('Altro');
  await page.click('[data-k="apri-backup"]');
  await shot('26-backup', true);
  await overflow('backup');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), page.click('.pill:has-text("Scarica backup")')]);
  const bkPath = path.join(shots, 'backup.json');
  await dl.saveAs(bkPath);
  const bk = JSON.parse(fs.readFileSync(bkPath, 'utf8'));
  if (!bk.state || bk.state.moves.length < 10) fail('backup incompleto');
  if (bk.state.votes.length !== 2 || bk.state.games.length !== 2)
    fail('backup: attesi 2 voti e 2 partite, trovati ' + bk.state.votes.length + ' e ' + bk.state.games.length);
  note(
    'backup: ' +
      bk.state.moves.length +
      ' movimenti, ' +
      bk.state.votes.length +
      ' voti, ' +
      bk.state.games.length +
      ' partite, ' +
      bk.state.people.length +
      ' persone'
  );
  await page.click('.indietro');
  await page.click('[data-k="apri-installa"]');
  await shot('27-installa', true);

  // ricarica: i dati restano
  await page.reload();
  await page.waitForSelector('.tab');
  await page.waitForTimeout(200);
  await tab('Reparto');
  await shot('28-reparto-pieno', true);
  await overflow('reparto pieno');
  const rep = await text('#view');
  if (!/Urgente|Stabile/.test(rep)) fail('bollettino senza timbro');
  if (!/Stasera hai già votato/.test(rep)) fail('i voti non restano dopo la ricarica');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('oblio.v1')).moves.length);
  if (saved !== bk.state.moves.length) fail('movimenti salvati ' + saved + ' diversi dal backup ' + bk.state.moves.length);

  // senza rete: l'app si riapre dal service worker, caricature comprese
  await page
    .waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 8000 })
    .catch(() => fail('service worker non attivo'));
  await page.waitForTimeout(500);
  await ctx.setOffline(true);
  await page.reload().catch((e) => fail('ricarica senza rete fallita: ' + e.message));
  const okOff = await page.waitForSelector('.tab', { timeout: 5000 }).then(
    () => true,
    () => false
  );
  if (!okOff) fail('senza rete la pagina non si apre');
  else {
    await tab('Reparto');
    await facce('reparto senza rete');
    await tab('Ticket');
    await shot('29-senza-rete');
    note('senza rete: app aperta, dati e caricature presenti');
  }
  await ctx.setOffline(false);

  // ---------- novità 0.7.0 ----------
  const conti = async () => calc.derive(await statoDi(page));
  const ymdPagina = (giorni) =>
    page.evaluate((g) => {
      const d = new Date();
      d.setDate(d.getDate() + g);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }, giorni);
  // resto: Kinder Bueno 1,30 pagato con 5 euro
  await tab('Farmacia');
  await page.click('.chip:has-text("PEPPECARLO")');
  await page.click('.prod-add:has-text("Kinder Bueno")');
  let D0 = await conti();
  await page.click('[data-k="ha-dato"]');
  await page.fill('#hd-a', '5');
  await page.waitForTimeout(60);
  if (!/Resto: 3,70/.test(await text('#foglio .resto'))) fail('resto non calcolato: ' + (await text('#foglio .resto')));
  await shot('42-resto');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(80);
  if (!/resto da dare 3,70/.test(await text('#toast'))) fail('toast del resto: ' + (await text('#toast')));
  let D1 = await conti();
  if (D1.cash - D0.cash !== 130 || (D1.debt.peppecarlo || 0) !== (D0.debt.peppecarlo || 0))
    fail('resto: in cassa doveva entrare solo il conto');
  // pagamento misto: 2,50 di conto, 1 euro in contanti, il resto sul ticket
  await page.click('.chip:has-text("PEPPECARLO")');
  await page.click('.prod-add:has-text("Kit Kat")');
  await page.click('.prod-add:has-text("Mars")');
  await page.click('[data-k="ha-dato"]');
  await page.fill('#hd-a', '1');
  await page.waitForTimeout(60);
  if (
    !/Pagamento misto[\s\S]*1,00 € in contanti adesso, 1,50 € sul suo ticket/.test((await text('#foglio .resto')).replace(/\u00a0/g, ' '))
  )
    fail('pagamento misto non spiegato: ' + (await text('#foglio .resto')));
  await shot('43-misto');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(80);
  D0 = D1;
  D1 = await conti();
  if (D1.cash - D0.cash !== 100 || (D1.debt.peppecarlo || 0) - (D0.debt.peppecarlo || 0) !== 150)
    fail('pagamento misto: cassa +1,00 e ticket +1,50 attesi');
  const stM = await statoDi(page);
  const misti = stM.moves.slice(-2);
  if (!misti[0].g || misti[0].g !== misti[1].g) fail('i due movimenti del pagamento misto non sono collegati');
  // annullare uno dei due annulla anche l'altro
  await cassa();
  await page.click('.riga:has-text("Ticket incassato · PEPPECARLO")');
  if (!/Va insieme a/.test(await text('#foglio'))) fail('nel movimento non si vede il collegamento del pagamento misto');
  await page.click('#foglio .pill:has-text("Annulla movimento")');
  await page.click('#foglio .pill:has-text("Sì, annulla")');
  await page.waitForTimeout(80);
  {
    const st = await statoDi(page);
    const g = st.moves.filter((m) => m.g === misti[0].g);
    if (!g.every((m) => m.x)) fail('annullando il pagamento misto l’altro movimento resta');
  }
  await page.click('#foglio .pill:has-text("Ripristina")');
  await page.waitForTimeout(80);
  await page.click('#foglio-x');
  // conto in sospeso: se lo lasci in Farmacia, il Reparto lo ricorda
  await tab('Farmacia');
  if ((await page.getAttribute('.chip:has-text("CICCIO")', 'aria-pressed')) !== 'true') await page.click('.chip:has-text("CICCIO")');
  await page.click('.prod-add:has-text("Birra")');
  await tab('Reparto');
  if (!/non è registrato/.test(await text('#toast'))) fail('uscendo dalla Farmacia con un conto aperto manca l’avviso');
  if (!(await page.$('[data-k="riprendi-conto"]'))) fail('il Reparto non mostra il conto in sospeso');
  await page.click('[data-k="riprendi-conto"]');
  await page.waitForTimeout(60);
  if (!/CICCIO/i.test(await text('.pos-who'))) fail('riprendendo il conto non torna CICCIO');
  await page.click('.posbar .pill-x');
  // bozza: un modulo lasciato a metà
  await cassa();
  await page.click('.pill:has-text("Entrata")');
  await page.fill('#en-a', '7');
  await page.click('#foglio-x');
  await page.waitForTimeout(60);
  if (!(await page.$('#foglio .uscita'))) fail('uscendo senza salvare non chiede cosa fare');
  await shot('44-uscita-senza-salvare');
  await page.click('[data-k="esci-bozza"]');
  await page.waitForTimeout(60);
  await page.click('.pill:has-text("Entrata")');
  if ((await page.inputValue('#en-a')) !== '7' || !(await page.$('#foglio .bozza'))) fail('la bozza non torna');
  await page.click('#foglio-x');
  await page.click('[data-k="esci-no"]');
  await page.waitForTimeout(60);
  await page.click('.pill:has-text("Entrata")');
  if ((await page.inputValue('#en-a')) !== '') fail('dopo «Esci senza salvare» la bozza resta');
  await page.click('#foglio-x');
  // quota del locale: l'admin la imposta (scaduta ieri, per provare il ritardo), ognuno la segna, chi è in ritardo la trova nei graffi
  await tab('Altro');
  await page.click('.menu:not(.admin) .voce:has-text("Quota e fondo")');
  await page.click('[data-k="nuova-quota"]');
  await page.fill('#qm-a', '20');
  await page.fill('#qm-s', await ymdPagina(-1));
  await shot('45-quota-imposta');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(80);
  const meseQ = (await statoDi(page)).quote.slice(-1)[0].mese;
  await page.click('[data-k="qv-' + meseQ + '-pj"]');
  if ((await page.inputValue('#vq-a')) !== '20,00') fail('versando la quota l’importo non è proposto');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(80);
  if (!/20,00/.test(await text('#fondo-tot'))) fail('il fondo non sale con la quota: ' + (await text('#fondo-tot')));
  await shot('46-quota', true);
  await overflow('quota');
  await tab('Ticket');
  if (!/di cui quota locale 20,00/.test((await text('#view')).replace(/\u00a0/g, ' '))) fail('la quota non pagata non compare nei graffi');
  D0 = await conti();
  await page.click('.riga:has-text("PESCE")');
  await page.click('#foglio .pill:has-text("Incassa")');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(60);
  if (!/Scegli se sono/.test(await text('#foglio'))) fail('incassando non si obbliga a scegliere tra consumazioni e quota');
  await page.click('#foglio .chip:has-text("Quota")');
  if ((await page.inputValue('#py-a')) !== '20,00') fail('scegliendo la quota l’importo non diventa 20,00');
  await shot('47-incassa-quota');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(80);
  D1 = await conti();
  if (D1.cash !== D0.cash || D1.fondo - D0.fondo !== 2000) fail('la quota incassata deve andare nel fondo, non in cassa');
  await tab('Altro');
  await page.click('.menu:not(.admin) .voce:has-text("Quota e fondo")');
  await page.click('[data-k="pagato-locale"]');
  await page.fill('#pl-a', '30');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(80);
  if (!/10,00/.test(await text('#fondo-tot'))) fail('pagato il locale: il fondo doveva scendere a 10,00');
  if (!/Pagato dal fondo/.test(await text('#view'))) fail('manca lo storico di quando avete pagato il locale');
  // Muroblio del pianto
  await tab('Ludoteca');
  await page.click('[data-k="apri-muro"]');
  await page.click('[data-k="nuovo-postit"]');
  await page.fill('#pi-t', 'Ho perso a freccette tre volte di fila');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(80);
  if ((await page.$$('.postit')).length !== 1 || !/CICCIO/i.test(await text('.postit')))
    fail('il post-it non è sul muro firmato da chi è entrato');
  await page.click('.postit-mod');
  await page.fill('#pi-t', 'Ho perso a freccette QUATTRO volte di fila');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(80);
  if (!/QUATTRO[\s\S]*modificato/.test(await text('.postit'))) fail('il post-it modificato non si aggiorna');
  await shot('48-muro', true);
  await overflow('muro');
  await tab('Reparto');
  if (!/Dal Muroblio del pianto/.test(await text('#view'))) fail('il Reparto non mostra l’ultimo post-it');
  // compleanno di PESCE oggi (admin)
  await tab('Altro');
  await page.click('.voce:has-text("Compleanni")');
  {
    const oggi = await ymdPagina(0);
    await page.selectOption('select[aria-label="Giorno, PESCE"]', oggi.slice(8, 10));
    await page.selectOption('select[aria-label="Mese, PESCE"]', oggi.slice(5, 7));
  }
  await page.click('button:has-text("Salva i compleanni")');
  await page.waitForTimeout(80);
  await tab('Reparto');
  if (!/Oggi compie gli anni PESCE/i.test(await text('.festa'))) fail('il Reparto non festeggia il compleanno');
  await page.locator('.festa').screenshot({ path: path.join(shots, '49-compleanno.png') });
  // storico dei prezzi
  await tab('Altro');
  await page.click('.voce:has-text("Listino")');
  await page.click('.riga:has-text("Pinguì")');
  await page.fill('#pr-a', '1,20');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(80);
  if (!/era 1,00 € fino al/.test((await text('.riga:has-text("Pinguì")')).replace(/\u00a0/g, ' ')))
    fail('il listino non mostra il prezzo di prima');
  await page.click('.riga:has-text("Pinguì")');
  if (!/Prezzi di prima: 1,00 €/.test((await text('#foglio')).replace(/\u00a0/g, ' ')))
    fail('il prodotto non mostra lo storico dei prezzi');
  await page.click('#foglio-x');
  // regole: un modulo cambiato e non salvato, uscendo dalla pagina
  await tab('Altro');
  await page.click('.voce:has-text("Regole")');
  await page.fill('#rg-gv', '45');
  await tab('Reparto');
  await page.waitForTimeout(60);
  if (!/Modifiche non salvate/.test(await text('#foglio-t'))) fail('uscendo dalle Regole senza salvare non chiede niente');
  await page.click('[data-k="pg-salva"]');
  await page.waitForTimeout(80);
  if ((await statoDi(page)).cfg.graffiGiorni !== 45) fail('«Salva ed esci» non ha salvato le regole');
  // verifica del mese: foto e confronto
  await tab('Altro');
  await page.click('.voce:has-text("Soldi del locale")');
  await page.click('[data-k="salva-verifica"]');
  await page.click('#foglio button[type=submit]');
  await page.waitForTimeout(80);
  await page.click('.cartella:has(h3:text("Verifica del mese")) .riga');
  await page.waitForTimeout(60);
  if (!/Come si spiega/.test(await text('#foglio')) || !/Non è sfuggito niente/.test(await text('#foglio')))
    fail('confronto della verifica non coerente: ' + (await text('#foglio')).slice(0, 300));
  await shot('50-verifica');
  await page.click('#foglio-x');
  // statistiche, medaglie e albo, record
  await tab('Altro');
  await page.click('.voce:has-text("Classifiche")');
  await page.click('[data-k="cl-statistiche"]');
  if (!/Il mese in numeri/.test(await text('#view')) || !(await page.$('.scheda-mese'))) fail('statistiche del mese vuote');
  await shot('51-statistiche', true);
  await overflow('statistiche');
  await tab('Altro');
  await page.click('.voce:has-text("Classifiche")');
  await page.click('[data-k="cl-medaglie"]');
  if (!/Albo d’oro/.test(await text('#view')) || (await page.$$('.medaglia-riga')).length !== 8) fail('pagina medaglie e albo incompleta');
  await shot('52-medaglie', true);
  await overflow('medaglie');
  await tab('Freccette');
  if (!/Record/.test(await text('#view'))) fail('manca la scheda dei record delle freccette');
  // codice admin: l'admin lo cambia (solo impronta nei dati), poi lo rimette
  await tab('Altro');
  await page.click('.voce:has-text("Codice admin")');
  if (!/ancora quello iniziale/.test(await text('#view'))) fail('manca l’avviso del codice admin iniziale');
  {
    const c = page.locator('.cartella:has(h3:text("Codice admin")) input');
    await c.nth(0).fill('2468');
    await c.nth(1).fill('2468');
  }
  await page.click('button:has-text("Cambia il codice admin")');
  await page.waitForTimeout(80);
  {
    const st = await statoDi(page);
    if (!st.cfg.admH || /2468/.test(JSON.stringify(st.cfg))) fail('il codice nuovo deve essere salvato solo come impronta');
  }
  await page.click('button:has-text("Torna a 0101")');
  await page.waitForTimeout(80);
  if ((await statoDi(page)).cfg.admH) fail('il codice admin non torna a 0101');
  // esco dalla modalità admin: le voci admin spariscono
  await tab('Altro');
  await page.click('[data-k="esci-admin"]');
  await page.waitForTimeout(80);
  if (await page.$('.menu.admin')) fail('uscito dall’admin, le voci admin restano');
  note(
    'novità 0.7.0: resto, pagamento misto, conto in sospeso, bozze, quota e fondo, muro, compleanni, prezzi, verifica, statistiche, medaglie, codici'
  );

  // schermo stretto e largo
  await page.setViewportSize({ width: 320, height: 640 });
  await tab('Farmacia');
  await page.click('.chip:has-text("PJ")');
  await page.click('.prod-add:has-text("Nutella")');
  await page.waitForTimeout(80);
  await shot('30-farmacia-320');
  await overflow('farmacia 320');
  await tab('Ticket');
  await overflow('ticket 320');
  await tab('Reparto');
  await overflow('reparto 320');
  await shot('31-reparto-320', true);
  await tab('Freccette');
  await page.click('[data-k="modo-501"]');
  await page.click('[data-k="gioc-peppecarlo"]');
  await page.click('[data-k="gioc-chicco"]');
  await page.click('[data-k="gioc-conti"]');
  await page.click('[data-k="inizia"]');
  await page.waitForTimeout(80);
  await overflow('freccette 320');
  await shot('32-freccette-320');
  await page.click('.pill:has-text("Abbandona")');
  await page.click('#foglio .pill:has-text("Sì, abbandona")');
  await tab('Altro');
  await page.click('.voce:has-text("Classifiche")');
  await overflow('classifiche 320');
  await shot('33-classifiche-320', true);
  await tab('Altro');
  await page.click('.voce:has-text("Soldi del locale")');
  await overflow('soldi 320');
  await shot('33b-soldi-320', true);
  await tab('Ludoteca');
  await page.click('[data-k="apri-muro"]');
  await overflow('muro 320');
  await shot('33e-muro-320', true);
  await tab('Altro');
  await page.click('.voce:has-text("Classifiche")');
  await page.click('[data-k="cl-statistiche"]');
  await overflow('statistiche 320');
  await tab('Altro');
  await page.click('.voce:has-text("Classifiche")');
  await page.click('[data-k="cl-medaglie"]');
  await overflow('medaglie 320');
  await tab('Altro');
  await page.click('.menu:not(.admin) .voce:has-text("Quota e fondo")');
  await overflow('quota 320');
  await shot('33f-quota-320', true);
  await tab('Farmacia');
  await page.click('.chip:has-text("CONTI")');
  await page.click('.prod-add:has-text("Mars")');
  await overflow('farmacia con ha dato 320');
  await shot('33d-posbar-320');
  await page.click('[data-k="ha-dato"]');
  {
    const l = await page.$eval('#foglio-b', (b) => [b.scrollWidth, b.clientWidth]);
    if (l[0] > l[1] + 1) fail('ha dato 320: il foglio scorre di lato');
  }
  await page.click('#foglio-x');
  await page.click('.posbar .pill-x');
  await tab('Altro');
  await page.click('.voce:has-text("Scorte e spesa")');
  await page.click('[data-k="nuovo-prodotto"]');
  await overflow('nuovo prodotto 320');
  await shot('33c-nuovo-prodotto-320');
  await page.click('#foglio-x');
  await page.setViewportSize({ width: 1100, height: 800 });
  await cassa();
  await shot('34-cassa-desktop');
  await overflow('cassa desktop');

  // ---------- la serata si chiude alle 6 del mattino (orologio finto) ----------
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'it-IT', timezoneId: 'Europe/Rome' });
  await ctx2.clock.install({ time: new Date('2026-10-13T05:58:00+02:00') });
  const p2 = await ctx2.newPage();
  ascolta(p2);
  await p2.goto(base);
  await entra(p2, 'pj', '2222');
  await tab('Ludoteca', p2);
  await p2.click('[data-k="vota"]');
  await p2.click('#foglio [data-k="vt-ciccio"]');
  await p2.click('#foglio .voto-posto .chip:has-text("Dormire al locale")');
  await p2.click('#foglio .voto-posto .chip:has-text("Giocare alle slot")');
  await p2.click('#foglio [data-k="salva-voto"]');
  await p2.waitForTimeout(80);
  if (!/1 votante/.test(await p2.textContent('.triage'))) fail('alle 5:58 il voto deve contare nella serata in corso');
  await p2.clock.fastForward('03:00');
  await p2.waitForTimeout(150);
  const dopo = await p2.textContent('.triage');
  if (!/Ieri sera: 1° CICCIO/i.test(dopo)) fail('alle 6:01 manca il podio della serata: ' + dopo);
  if (!/Diagnosi di CICCIO: dormire al locale, giocare alle slot\./i.test(dopo))
    fail('alle 6:01 la diagnosi non ha i due sintomi: ' + dopo);
  if (!/0 votanti/.test(dopo)) fail('alle 6:01 il triage deve ripartire da zero: ' + dopo);
  await p2.locator('.triage').screenshot({ path: path.join(shots, '35-triage-dopo-le-6.png') });
  await tab('Reparto', p2);
  if (!/Codice rosso di ieri sera: CICCIO/i.test(await p2.textContent('.riga-triage')))
    fail('il Reparto non mostra il codice rosso di ieri sera');
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
  // graffi vecchi: una birra sul ticket, poi passano 31 giorni
  await tab('Farmacia', p2);
  if ((await p2.getAttribute('.chip:has-text("PJ")', 'aria-pressed')) !== 'true')
    fail('in Farmacia il paziente proposto non è chi è entrato');
  await p2.click('.prod-add:has-text("Birra")');
  await p2.click('.posbar .pill:has-text("Sul ticket")');
  await p2.waitForTimeout(80);
  {
    const ora = await p2.evaluate(() => Date.now());
    await p2.clock.setSystemTime(ora + 31 * 864e5);
  }
  await tab('Ticket', p2);
  await p2.waitForTimeout(100);
  if (!/Graffi vecchi/.test(await p2.textContent('#view'))) fail('dopo 31 giorni il graffio non risulta vecchio');
  await p2.screenshot({ path: path.join(shots, '37-graffi-vecchi.png') });
  await p2.click('.tab:has-text("Reparto")');
  await p2.waitForTimeout(60);
  if (!/Graffi vecchi/.test(await p2.textContent('#view'))) fail('il Reparto non segnala i graffi vecchi');
  note('graffi vecchi: dopo 30 giorni in rosso nei Ticket e nel bollettino');
  note('chiusura alle 6: verdetto e nuova serata ok');
  await ctx2.close();

  // ---------- guida all'uso: si apre da Altro, si legge bene sul telefono, funziona senza rete ----------
  await page.setViewportSize({ width: 390, height: 844 });
  await tab('Altro');
  await Promise.all([page.waitForNavigation(), page.click('[data-k="apri-guida"]')]);
  if (!/guida\.html$/.test(page.url())) fail('la voce Guida non apre guida.html: ' + page.url());
  if (!/Guida all'uso del reparto/.test(await page.textContent('h2.titolo'))) fail('guida senza titolo');
  if ((await page.$$('section.cartella')).length !== 18) fail('la guida non ha 18 capitoli');
  await overflow('guida 390');
  await shot('41-guida', true);
  await page.setViewportSize({ width: 320, height: 640 });
  await overflow('guida 320');
  await ctx.setOffline(true);
  const guidaOff = await page.reload().then(
    () => page.textContent('h2.titolo'),
    () => ''
  );
  if (!/Guida/.test(guidaOff || '')) fail('la guida non si apre senza rete');
  await ctx.setOffline(false);
  await page.click('.piede .pill');
  await page.waitForSelector('.tab');
  note('guida: aperta da Altro, leggibile a 320 px, disponibile senza rete');

  // ---------- più telefoni, stessi dati (finto server al posto di Firebase) ----------
  const telefono = async (nome, chi, pin) => {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'it-IT', timezoneId: 'Europe/Rome' });
    await c.addInitScript(() => {
      window.OBLIO_SYNC = { room: 'prova', mock: location.origin + '/mock/' };
    });
    const p = await c.newPage();
    ascolta(p);
    await p.goto(base);
    await entra(p, chi, pin);
    const ok = await p
      .waitForFunction(
        () => {
          const d = document.querySelector('#sync');
          return d && !d.hidden && d.classList.contains('ok');
        },
        null,
        { timeout: 10000 }
      )
      .then(
        () => true,
        () => false
      );
    if (!ok) fail(nome + ': non risulta sincronizzato');
    return {
      c,
      p,
      tab: (n) => tab(n, p),
    };
  };
  const aspetta = async (pg, fn, arg, cosa) => {
    const ok = await pg.waitForFunction(fn, arg, { timeout: 15000 }).then(
      () => true,
      () => false
    );
    if (!ok) fail(cosa);
    return ok;
  };
  const A = await telefono('telefono A', 'pesce', '3333');
  await A.tab('Farmacia'); // PESCE è già proposto: è lui che è entrato su A
  await A.p.click('.prod-add:has-text("Birra")');
  await A.p.click('.posbar .pill:has-text("Sul ticket")');
  await A.p.waitForTimeout(400);
  const B = await telefono('telefono B', 'pj', '4444');
  await B.tab('Ticket');
  await aspetta(B.p, () => /1,00/.test(document.querySelector('#view').textContent), null, 'B non vede il ticket di PESCE segnato da A');
  await shot('38-sync-b-ticket', false, B.p);
  // B vota, A vede il voto
  await B.tab('Ludoteca');
  await B.p.click('[data-k="vota"]');
  await B.p.click('#foglio [data-k="vt-pesce"]');
  await B.p.click('#foglio [data-k="salva-voto"]');
  await A.tab('Ludoteca');
  await aspetta(A.p, () => /1 votante/.test(document.querySelector('.triage').textContent), null, 'A non vede il voto dato da B');
  // A cambia il prezzo della birra, B lo vede nel listino
  await A.tab('Altro');
  await A.p.click('.voce:has-text("Admin")');
  await A.p.fill('#adm-c', '0101');
  await A.p.click('#foglio button[type=submit]');
  await A.p.waitForTimeout(80);
  await A.p.click('.voce:has-text("Listino")');
  await A.p.click('.riga:has-text("Birra")');
  await A.p.fill('#pr-a', '1,50');
  await A.p.click('#foglio button[type=submit]');
  await B.tab('Farmacia'); // B non è admin: il prezzo nuovo lo vede in Farmacia
  await aspetta(
    B.p,
    () => [...document.querySelectorAll('.prod-add')].some((r) => /Birra/.test(r.textContent) && /1,50/.test(r.textContent)),
    null,
    'B non vede il nuovo prezzo della birra'
  );
  // B senza rete incassa da PESCE; quando torna la rete A vede il ticket chiuso
  await B.c.setOffline(true);
  await B.tab('Ticket');
  await B.p.click('.riga:has-text("PESCE")');
  await B.p.click('#foglio .pill:has-text("Incassa")');
  await B.p.fill('#py-a', '1,00');
  await B.p.click('#foglio button[type=submit]');
  await aspetta(
    B.p,
    () => {
      const d = document.querySelector('#sync');
      return d && (d.classList.contains('attesa') || d.classList.contains('errore'));
    },
    null,
    'senza rete B non segnala le modifiche in attesa'
  );
  await shot('39-sync-b-senza-rete', false, B.p);
  await A.tab('Ticket');
  await A.p.waitForTimeout(800);
  if (!/1,00/.test(await A.p.textContent('#view'))) fail('A ha perso il ticket di PESCE prima che B tornasse online');
  await B.c.setOffline(false);
  await aspetta(
    A.p,
    () => /Ticket non pagati\s*0,00/.test(document.querySelector('#view').textContent.replace(/\u00a0/g, ' ')),
    null,
    'tornata la rete, A non vede l’incasso fatto da B'
  );
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
  await aspetta(
    B.p,
    () => [...document.querySelectorAll('.gioc-p')].some((e) => e.textContent === '241'),
    null,
    'B non vede la partita di A'
  );
  await shot('40-sync-freccette-b', false, B.p);
  // un terzo telefono nuovo trova tutto uguale e non sovrascrive niente
  const C = await telefono('telefono C', 'conti', '5555');
  await C.tab('Farmacia');
  await aspetta(
    C.p,
    () => [...document.querySelectorAll('.prod-add')].some((r) => /Birra/.test(r.textContent) && /1,50/.test(r.textContent)),
    null,
    'il telefono nuovo ha rimesso il prezzo di partenza'
  );
  const totali = await Promise.all(
    [A, B, C].map(async (t) => {
      await t.tab('Reparto');
      return (await t.p.textContent('.bollettino')).replace(/\s+/g, ' ').replace(/Telefoni.*?Backup/, 'Backup');
    })
  );
  if (totali[0] !== totali[1] || totali[1] !== totali[2]) fail('i bollettini dei tre telefoni non coincidono: ' + totali.join(' | '));
  note('sincronizzazione: 3 telefoni allineati (consumi, voti, prezzi, incasso senza rete, freccette)');

  // B si aggiorna: sul server c'è un voto con due sintomi scritto dalla 0.5.0, ma la copia di B era rimasta ridotta
  // (come la tiene una versione vecchia). Al riavvio con la versione nuova B rilegge il locale, si ripara e non scrive niente.
  {
    const st = stanze.prova,
      key = 'votes~vprova_conti',
      u = Date.now();
    const tv = Date.now(); // dopo l'azzeramento dei voti della 0.6.0
    const voto = { id: 'vprova_conti', s: '2026-10-10', v: 'conti', c: 'pesce', t: tv, y: ['Dormire al locale', 'Giocare alle slot'] };
    st[key] = { key, c: 'votes', i: voto.id, j: calc.canon(voto), u, by: 'P', s: ++orologio };
    await aspetta(
      B.p,
      () => (JSON.parse(localStorage.getItem('oblio.v1')).votes || []).some((v) => v.id === 'vprova_conti'),
      null,
      'B non riceve il voto scritto dalla 0.5.0'
    );
    await B.p.waitForTimeout(400);
    const ridotto = { id: 'vprova_conti', s: '2026-10-10', v: 'conti', c: 'pesce', t: tv, y: 'Dormire al locale' };
    await B.p.goto(base + 'guida.html'); // pagina senza app: posso toccare i dati salvati senza che l'app li riscriva
    await B.p.evaluate(
      ([rid, h, u]) => {
        const S = JSON.parse(localStorage.getItem('oblio.v1'));
        S.votes = S.votes.map((v) => (v.id === rid.id ? rid : v));
        localStorage.setItem('oblio.v1', JSON.stringify(S));
        const SY = JSON.parse(localStorage.getItem('oblio.v1.sync'));
        SY.ent['votes~' + rid.id] = [u, h, 1];
        SY.ver = '0.5.0';
        localStorage.setItem('oblio.v1.sync', JSON.stringify(SY));
      },
      [ridotto, calc.hashStr(calc.canon(ridotto)), u]
    );
    const scritture = () =>
      Object.values(st)
        .map((d) => d.key + ':' + d.s)
        .sort()
        .join('|');
    const prima = scritture();
    await B.p.goto(base);
    await B.p.waitForSelector('.tab');
    await aspetta(
      B.p,
      () => {
        const v = JSON.parse(localStorage.getItem('oblio.v1')).votes.find((x) => x.id === 'vprova_conti');
        return !!v && Array.isArray(v.ys) && v.ys.length === 2;
      },
      null,
      'B aggiornato non ha riparato la copia ridotta del voto'
    );
    await aspetta(B.p, () => document.querySelector('#sync').classList.contains('ok'), null, 'B aggiornato non torna sincronizzato');
    await B.p.waitForTimeout(600);
    if (scritture() !== prima) fail('B aggiornato ha riscritto qualcosa sul server');
    const ver = await B.p.evaluate(() => JSON.parse(localStorage.getItem('oblio.v1.sync')).ver);
    if (ver === '0.5.0' || !ver) fail('dopo l’aggiornamento la sincronizzazione non segna la versione nuova: ' + ver);
    note('aggiornamento: B rilegge il locale, ripara il voto ridotto e non rimanda niente');
  }
  // login: PESCE prova a entrare da un telefono nuovo. Serve il codice admin e poi il suo PIN; A esce da solo.
  {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'it-IT', timezoneId: 'Europe/Rome' });
    await c.addInitScript(() => {
      window.OBLIO_SYNC = { room: 'prova', mock: location.origin + '/mock/' };
    });
    const d = await c.newPage();
    ascolta(d);
    await d.goto(base);
    await d.waitForSelector('[data-k="chi-sono-pesce"]');
    await aspetta(
      d,
      () => /ha già il telefono/.test(document.querySelector('[data-k="chi-sono-pesce"]').textContent),
      null,
      'il telefono nuovo non sa che PESCE ha già il telefono'
    );
    await d.click('[data-k="chi-sono-pesce"]');
    if (!(await d.$('#lg-adm'))) fail('telefono nuovo: per un nome già preso non chiede il codice admin');
    await d.fill('#lg-adm', '9999');
    await d.click('[data-k="lg-ok"]');
    if (!/Codice admin sbagliato/.test(await d.textContent('#view'))) fail('codice admin sbagliato non segnalato');
    await d.fill('#lg-adm', '0101');
    await d.click('[data-k="lg-ok"]');
    await d.fill('#lg-pin', '0000');
    await d.click('[data-k="lg-ok"]');
    if (!/PIN sbagliato/.test(await d.textContent('#view'))) fail('PIN sbagliato non segnalato');
    await d.fill('#lg-pin', '3333');
    await d.click('[data-k="lg-ok"]');
    await d.click('[data-k="regole-ok"]');
    await d.waitForSelector('.tab');
    await aspetta(A.p, () => !!document.querySelector('[data-k^="chi-sono-"]'), null, 'il vecchio telefono di PESCE non esce da solo');
    await shot('42-telefono-spostato', false, A.p);
    // uscire chiede il PIN
    await tab('Altro', d);
    await d.click('[data-k="esci-io"]');
    await d.fill('#pin-c', '1111');
    await d.click('#foglio button[type=submit]');
    if (!/PIN sbagliato/.test(await d.textContent('#foglio'))) fail('per uscire basta un PIN qualsiasi');
    await d.fill('#pin-c', '3333');
    await d.click('#foglio button[type=submit]');
    await d.waitForSelector('[data-k^="chi-sono-"]');
    await c.close();
    note('login: telefono nuovo con codice admin + PIN, il vecchio esce; uscire chiede il PIN');
  }
  for (const t of [A, B, C]) await t.c.close();

  const ctx3 = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'it-IT',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  });
  const p3 = await ctx3.newPage();
  ascolta(p3);
  await p3.goto(base);
  await p3.waitForSelector('#avviso:not([hidden])');
  if (!/installa l’app prima di usarla/.test(await p3.textContent('#avviso')))
    fail('su iPhone in Safari manca l’avviso di installare prima');
  await shot('37-iphone-safari', false, p3);
  await ctx3.close();

  await browser.close();
  server.close();
  console.log(problems.length ? '\n' + problems.length + ' problemi' : '\nprova a schermo: nessun problema');
  process.exit(problems.length ? 1 : 0);
})().catch((e) => {
  console.error('ERRORE PROVA', e);
  server.close();
  process.exit(2);
});
