# The Oblio House

L'app del reparto: farmacia (bar), ticket, cassa, scorte, triage della serata, freccette, classifiche, rifiuti e pulizie.
Pensata per un solo telefono lasciato al locale: funziona anche senza rete e i dati restano sul telefono (backup da Altro › Backup).

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
- `build.js`: monta l'app pubblicata in `docs/` (servita da GitHub Pages, ramo `main`, cartella `/docs`); se c'è `src/sync-config.json` accende la sincronizzazione.
- `src/ocr/`: lettore di scontrini che gira sul telefono. `lettore.js` è nostro; il motore (`tesseract-core-*`, da tesseract.js-core 6.1.2) e il modello italiano (`ita.traineddata.gz`, tessdata 4.0.0_best_int) sono di terzi, con licenza Apache-2.0 (testi nella stessa cartella).
- `test/`: prova dei calcoli (`node test/pure.test.js`), della sincronizzazione (`node test/sync.test.js`), della compatibilità tra versioni dell'app sullo stesso locale (`node test/compat.test.js`, con le versioni vecchie in `test/fixtures/`; letture vere di scontrini di prova in `test/fixtures/ocr/`) e prova a schermo (`node test/e2e.js`).
