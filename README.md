# The Oblio House

[![Prove](https://github.com/CICCIONASO/oblio-house/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/CICCIONASO/oblio-house/actions/workflows/test.yml)

L'app del reparto: il bar di casa, i debiti di ognuno, la cassa, la quota del locale, le faccende e un po' di sana competizione (freccette, classifiche, medaglie). Si installa sul telefono come un'app vera, funziona anche senza rete e tiene gli stessi dati su tutti i telefoni del locale.

**App:** https://ciccionaso.github.io/oblio-house/
**Guida all'uso completa:** https://ciccionaso.github.io/oblio-house/guida.html

## Che cos'è

Oblio House nasce per un problema semplicissimo: in un locale condiviso tra amici, chi ha preso cosa, chi deve quanto e chi tocca buttare la spazzatura stasera? Invece del quaderno appeso al frigo c'è un'app che ognuno apre dal proprio telefono. Si segna la consumazione, il debito sale; si paga, il debito scende e la cassa sale. Tutto il resto (quota del locale, scorte, pulizie) gira attorno a questo.

La usano i «pazienti» del reparto, cioè chi frequenta il locale, più qualche visitatore di passaggio. Non serve un account: basta aprire il link, installarla e scegliere il proprio nome.

## Cosa fa

- **Bar (Farmacia)**: segni chi prende cosa con un tocco per pezzo; paghi subito o lo metti sul ticket. Calcola il resto e gestisce il pagamento misto (una parte in contanti, il resto a debito). Le scorte scendono da sole.
- **Debiti (Ticket)**: ogni nome ha la sua cartella con le consumazioni non pagate, gli incassi parziali e i graffi più vecchi in evidenza.
- **Cassa e soldi del locale**: la cassa del bar, i soldi attuali e quelli previsionali, il registro di tutti i movimenti con gli annulli motivati.
- **Quota del locale**: la quota periodica di ognuno, con il suo fondo tenuto separato dalla cassa e il promemoria dai 15 giorni prima della scadenza.
- **Lettura degli scontrini (OCR)**: fotografi lo scontrino della spesa e l'app ne legge le righe direttamente sul telefono, senza mandarlo a nessun servizio esterno.
- **Scorte e spesa**: cosa sta finendo e la lista della spesa pronta, con lo storico dei prezzi.
- **Faccende**: rifiuti di stasera, pulizie, cose da fare, tutto in una scheda sola ordinata per urgenza.
- **Il lato ludico**: triage della serata (il voto di chi sta peggio), freccette con i record, classifiche, statistiche del mese, medaglie, albo d'oro, compleanni e il Muroblio del pianto per sfogarsi.
- **Più telefoni, stessi dati**: sincronizzazione tramite Cloud Firestore. Il pallino in alto a destra è verde quando è tutto allineato, giallo se ci sono modifiche da inviare.
- **Funziona offline**: ogni telefono tiene la sua copia; senza rete si segna tutto come sempre e si riallinea appena torna internet.
- **Backup e Admin**: backup da Altro › Backup; impostazioni in Altro › Admin (codice admin); le azioni delicate chiedono il PIN del reparto.

## Come si usa

La barra in basso ha cinque sezioni:

| Sezione       | A cosa serve                                                                                                                                                                                                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Reparto**   | La schermata principale: il bollettino a riquadri (cassa, ticket aperti, soldi del locale, fondo della quota o scorte), la scheda «Faccende e cose da fare», il triage, l'ultimo post-it del muro e le ultime somministrazioni.                                              |
| **Farmacia**  | Il bar. Tocchi chi prende, poi i prodotti, poi scegli «Sul ticket» o «Paga subito» (con resto o pagamento misto se serve).                                                                                                                                                   |
| **Ticket**    | I debiti di ognuno. Tocchi un nome per aprire la sua cartella e incassare, tutto o in parte.                                                                                                                                                                                 |
| **Freccette** | Partite, punteggi e record.                                                                                                                                                                                                                                                  |
| **Altro**     | Tutto il resto, diviso in quattro gruppi: **Soldi** (cassa, soldi del locale, quota e fondo, scorte e spesa), **Il reparto** (classifiche, statistiche, medaglie, muro), **Telefono e app** (di chi è il telefono, telefoni collegati, guida, backup, installa) e **Admin**. |

Due regole d'oro: si segna sempre a nome di chi consuma, anche se lo segna un altro; e se esci dalla Farmacia senza registrare, il conto resta in sospeso nelle Faccende finché non lo riprendi o lo scarti.

### Installarla sul telefono

**iPhone**

1. Apri il link con Safari.
2. Tocca Condividi, poi «Aggiungi alla schermata Home».
3. Da lì in poi usa sempre l'icona: l'app installata non vede i dati segnati in Safari.

**Android**

1. Apri il link con Chrome.
2. Menu ⋮, poi «Installa app».

La prima apertura va fatta con internet. Quando esce una versione nuova compare il pulsante **Aggiorna**: toccalo.

## Lavorarci in locale

### Cosa serve

- [Node.js](https://nodejs.org/) 20 o più recente (le prove automatiche girano con Node 22)
- npm (arriva insieme a Node)
- git

### Passo per passo

```bash
git clone https://github.com/CICCIONASO/oblio-house.git
cd oblio-house
npm install          # strumenti di sviluppo: sharp, playwright, c8, ESLint, Prettier
npm run build        # monta l'app in docs/
```

Poi servi la cartella `docs/` con un server qualsiasi e apri l'indirizzo nel browser:

```bash
python3 -m http.server 8000 --directory docs
# oppure: npx serve docs
```

Va aperta da `http://localhost`, non facendo doppio clic su `index.html`: il service worker (installazione e funzionamento offline) non parte da `file://`.

Cosa produce `npm run build`:

- `docs/`: l'app pubblicata (`index.html`, `sw.js`, `manifest.webmanifest`, icone, `guida.html`, caricature, motore OCR). È la cartella servita da GitHub Pages, quindi va committata solo quando si pubblica una versione.
- `preview.html`: un'anteprima in un file solo, ignorata da git.

### La sincronizzazione con Firebase

La sincronizzazione si accende solo se esiste `src/sync-config.json`. Senza quel file l'app funziona lo stesso, ma ogni telefono (o browser) tiene i suoi dati e basta.

> **Attenzione:** il `src/sync-config.json` presente nel repo punta al database vero del locale. Se fai prove in locale con quel file, quello che segni finisce sui telefoni di tutti. Per sperimentare, spostalo da parte (e rifai `npm run build`) oppure usa un progetto Firebase tuo.

Per collegare un progetto Firebase tuo:

1. Crea un progetto su [console.firebase.google.com](https://console.firebase.google.com/) (basta il piano gratuito Spark).
2. Attiva **Cloud Firestore**.
3. In Impostazioni progetto › Le tue app, aggiungi un'app **Web** e copia la configurazione.
4. Scrivi `src/sync-config.json` così:

   ```json
   {
     "room": "un-nome-stanza-difficile-da-indovinare",
     "firebase": {
       "apiKey": "…",
       "authDomain": "…",
       "projectId": "…",
       "storageBucket": "…",
       "messagingSenderId": "…",
       "appId": "…"
     }
   }
   ```

   `room` è il nome del «locale»: tutti i telefoni con la stessa stanza vedono gli stessi dati.

5. In `firestore.rules` sostituisci il nome della stanza (`oblio-0awwk6pqgkvr8o1x`) con il tuo e pubblica le regole dalla console Firebase (Firestore › Regole) o con la Firebase CLI.
6. `npm run build`: nel riepilogo deve comparire «sincronizzazione attiva».

Le regole permettono di leggere e scrivere solo dentro la stanza indicata e solo documenti con la forma attesa; non si cancella niente: l'app scrive una «lapide» e gli altri telefoni la tolgono.

## Come contribuire

I comandi da conoscere:

```bash
npm test             # calcoli, novità, sincronizzazione, compatibilità tra versioni e numero di versione
npm run coverage     # le stesse prove, con la copertura del blocco PURE di src/app.js
npm run test:e2e     # monta l'app e la prova a schermo con Playwright (Chromium)
npm run lint         # ESLint
npm run format       # sistema la formattazione con Prettier (format:check la controlla soltanto)
```

- `npm test` non ha bisogno di browser né di rete: prova i calcoli (`test/pure.test.js`), le novità della 0.7.0 (`test/novita.test.js`), la sincronizzazione (`test/sync.test.js`), la convivenza con le versioni vecchie dell'app sullo stesso locale (`test/compat.test.js`, con le versioni 0.4.4, 0.5.0, 0.5.1, 0.6.0 e 0.7.0 in `test/fixtures/`) e che la versione coincida tra `package.json`, app e tag git (`test/versione.test.js`).
- `npm run coverage` usa c8; le righe sono numerate come nell'originale di `src/app.js`.
- `npm run test:e2e` usa un finto server di sincronizzazione al posto di Firebase, quindi non tocca il database vero. Simula i flussi principali a larghezza telefono, la lettura di scontrini di prova (`test/fixtures/ocr/`), la chiusura della serata e la riapertura senza rete. Gli screenshot finiscono in `test/shots/`. La prima volta potrebbe servire `npx playwright install chromium`.

Su GitHub Actions (`.github/workflows/test.yml`), a ogni pull request e a ogni push su `main`, girano `npm audit` (si ferma solo per vulnerabilità critiche), lint e formattazione, le prove con la copertura (percentuali nel riepilogo del giro) e la prova a schermo. Il badge in cima dice se l'ultimo giro su `main` è verde.

Qualche consiglio:

- Lavora su un ramo e apri una pull request verso `main`; i rami vengono cancellati da soli dopo il merge.
- Prima di aprire la PR lancia `npm test`, `npm run lint` e `npm run format:check`.
- I dati condivisi sono documenti `raccolta~id` (persone, prodotti, movimenti, voti, partite, rifiuti, pulizie, quote, muro, verifiche, regole). I campi che una versione non conosce devono restare com'erano, così un telefono non aggiornato non cancella i dati nuovi: se aggiungi un campo, aggiungi anche una prova in `test/compat.test.js`.
- Se cambi qualcosa che si vede, aggiorna anche la guida (`src/guida.html`).

## Tecnologie

- **JavaScript, HTML e CSS senza framework**: niente React né altre librerie per l'interfaccia. I sorgenti sono `src/app.js`, `src/app.css` e `src/body.html`; `build.js` li monta in una pagina sola.
- **PWA**: manifest, icone generate con [sharp](https://sharp.pixelplumbing.com/) e un service worker (`src/sw.js`) che tiene l'app in cache per l'uso offline.
- **Cloud Firestore** (Firebase JS SDK 10.12.2, caricato da gstatic) per la sincronizzazione tra telefoni; i dati locali stanno nel `localStorage` del telefono.
- **OCR sul telefono**: [tesseract.js-core](https://github.com/naptha/tesseract.js-core) 6.1.2 in WebAssembly con il modello italiano di tessdata (4.0.0_best_int). Il lettore (`src/ocr/lettore.js`) è nostro; motore e modello sono di terzi, con licenza Apache-2.0 (testi in `src/ocr/`). Vengono scaricati la prima volta che servono e poi restano in cache.
- **GitHub Pages** per la pubblicazione (ramo `main`, cartella `/docs`) e **GitHub Actions** per le prove.
- **Playwright** per la prova a schermo, **c8** per la copertura, **ESLint** e **Prettier** per lo stile del codice.
- Caratteri: IBM Plex Sans per i testi, IBM Plex Mono per i numeri, Shrikhand per i titoli (da Google Fonts).

## Com'è fatta

```
src/
  app.js, app.css, body.html   l'app
  sw.js                        service worker
  guida.html                   guida all'uso, pubblicata accanto all'app
  icon.svg, img/               icona e caricature
  ocr/                         lettore di scontrini (motore e modello inclusi)
  sync-config.json             configurazione della sincronizzazione (facoltativa)
build.js                       monta l'app in docs/
docs/                          app pubblicata (GitHub Pages)
firestore.rules                regole del database
test/                          prove automatiche e scontrini di prova
```
