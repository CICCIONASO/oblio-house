# The Oblio House

L'app del reparto: farmacia (bar, con resto e pagamento misto), ticket, cassa, quota del locale con il suo fondo, scorte,
triage della serata, freccette con i record, classifiche, statistiche del mese, medaglie, albo d'oro, Muroblio del pianto,
rifiuti e pulizie. Funziona anche senza rete; i dati sono condivisi tra i telefoni del locale (backup da Altro › Backup).
Le impostazioni stanno in Altro › Admin (codice admin); le azioni delicate chiedono il PIN del reparto.
Dalla 0.8.0: Altro diviso in sezioni (Soldi, Il reparto, Telefono e app, Admin), bollettino del Reparto a riquadri con una sola scheda «Faccende e cose da fare», testi in IBM Plex Sans e numeri in IBM Plex Mono.

**App:** https://ciccionaso.github.io/oblio-house/

## Installarla sull'iPhone
1. Apri il link con Safari.
2. Tocca Condividi, poi «Aggiungi alla schermata Home».
3. Da lì in poi usa sempre l'icona: l'app installata non vede i dati segnati in Safari.

## Più telefoni
I dati sono sincronizzati tra i telefoni tramite Cloud Firestore (progetto `oblio-house-39fd6`, piano gratuito).
Ogni telefono tiene la sua copia e funziona anche senza rete; il pallino in alto a destra è verde quando è tutto allineato,
giallo se ci sono modifiche da inviare. Le regole del database sono in `firestore.rules`.

## Com'è fatta
- `src/`: sorgenti (`app.js`, `app.css`, `body.html`, `sw.js`, icona, caricature in `img/`).
- `build.js`: monta l'app pubblicata in `docs/`; a ogni push su `main` il workflow `.github/workflows/pages.yml` fa le prove, rimonta `docs/` e la pubblica su GitHub Pages (Settings › Pages › Source: GitHub Actions); se c'è `src/sync-config.json` accende la sincronizzazione.
- `src/ocr/`: lettore di scontrini che gira sul telefono. `lettore.js` è nostro; il motore (`tesseract-core-*`, da tesseract.js-core 6.1.2) e il modello italiano (`ita.traineddata.gz`, tessdata 4.0.0_best_int) sono di terzi, con licenza Apache-2.0 (testi nella stessa cartella).
- `src/guida.html`: guida all'uso, pubblicata accanto all'app.
- `package.json`: dipendenze di sviluppo (`sharp` per le icone e gli scontrini di prova, `playwright` per la prova a schermo). Prima volta: `npm install`; poi `npm run build`, `npm test` (calcoli, novità, sincronizzazione, compatibilità) e `npm run test:e2e` (monta l'app e fa la prova a schermo).
- `test/`: prova dei calcoli (`node test/pure.test.js` e, per le novità della 0.7.0, `node test/novita.test.js`), della sincronizzazione (`node test/sync.test.js`), della compatibilità tra versioni dell'app sullo stesso locale (`node test/compat.test.js`, con le versioni vecchie 0.4.4, 0.5.0, 0.5.1, 0.6.0 e 0.7.0 in `test/fixtures/`; letture vere di scontrini di prova in `test/fixtures/ocr/`) e prova a schermo (`node test/e2e.js`, dopo `node build.js`).
- Dati condivisi: ogni cosa segnata è un documento `raccolta~id` (persone, prodotti, movimenti, voti, partite, rifiuti, pulizie, quote, muro, verifiche, regole). I campi che una versione non conosce restano com'erano, così un telefono non aggiornato non cancella i dati nuovi.
