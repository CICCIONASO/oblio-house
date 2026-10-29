// Copia automatica del locale: legge tutti i documenti da Firestore (solo lettura, come un telefono), li rimette
// insieme come un backup dell'app e lo salva cifrato in backup/. La lancia ogni notte .github/workflows/backup.yml.
// La password è il segreto BACKUP_PASSWORD del repository: senza, la copia non si fa (il repository è pubblico).
const fs = require('fs');
const path = require('path');
const pure = require('../test/pure.js');

const { normState, cifraBackup, COLS } = pure('{normState,cifraBackup,COLS}');
const radice = path.join(__dirname, '..');

// tutti i documenti della stanza, pagina per pagina
async function leggiTutto(cfg, prendi) {
  const base =
    'https://firestore.googleapis.com/v1/projects/' +
    encodeURIComponent(cfg.firebase.projectId) +
    '/databases/(default)/documents/locali/' +
    encodeURIComponent(cfg.room) +
    '/e?pageSize=300&key=' +
    encodeURIComponent(cfg.firebase.apiKey);
  const docs = [];
  let tok = '';
  for (let giri = 0; giri < 1000; giri++) {
    const r = await prendi(base + (tok ? '&pageToken=' + encodeURIComponent(tok) : ''));
    if (!r.ok) throw new Error('Firestore ha risposto ' + r.status + ': ' + (await r.text()).slice(0, 300));
    const j = await r.json();
    (j.documents || []).forEach((d) => docs.push(d));
    tok = j.nextPageToken || '';
    if (!tok) return docs;
  }
  throw new Error('troppe pagine da Firestore');
}

// documenti di Firestore → stato dell'app (le lapidi, j vuoto, sono cose cancellate e restano fuori)
function statoDaDocumenti(docs) {
  const raw = { cfg: null };
  COLS.forEach((c) => (raw[c] = []));
  let vivi = 0;
  docs.forEach((d) => {
    const f = (d && d.fields) || {};
    const c = f.c && f.c.stringValue;
    const j = f.j && f.j.stringValue;
    if (!c || typeof j !== 'string') return;
    let e;
    try {
      e = JSON.parse(j);
    } catch (x) {
      return;
    }
    if (c === 'cfg') raw.cfg = e;
    else if (raw[c]) raw[c].push(e);
    else return;
    vivi++;
  });
  return { stato: normState(raw), vivi };
}

async function main() {
  const pw = process.env.BACKUP_PASSWORD || '';
  if (pw.length < 8) throw new Error('Manca il segreto BACKUP_PASSWORD (almeno 8 caratteri): Settings › Secrets and variables › Actions.');
  const cfg = JSON.parse(fs.readFileSync(path.join(radice, 'src', 'sync-config.json'), 'utf8'));
  const docs = await leggiTutto(cfg, fetch);
  const { stato, vivi } = statoDaDocumenti(docs);
  if (!stato || !stato.people.length) throw new Error('il database non sembra quello del locale: niente persone');
  const quando = new Date().toISOString();
  const testo = JSON.stringify({ app: 'the-oblio-house', v: 1, exported: quando, state: stato });
  const cifrato = await cifraBackup(testo, pw);
  const giorno = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
  const dir = path.join(radice, 'backup');
  fs.mkdirSync(dir, { recursive: true });
  const nome = path.join(dir, 'oblio-copia-' + giorno + '.json');
  fs.writeFileSync(nome, JSON.stringify({ app: 'the-oblio-house', v: 1, exported: quando, cifrato }));
  console.log(
    'copia del ' +
      giorno +
      ': ' +
      docs.length +
      ' documenti (' +
      vivi +
      ' vivi), ' +
      stato.people.length +
      ' persone, ' +
      stato.moves.length +
      ' movimenti, ' +
      stato.votes.length +
      ' voti, ' +
      stato.games.length +
      ' partite, ' +
      Math.round(fs.statSync(nome).size / 1024) +
      ' KB'
  );
}

if (require.main === module)
  main().catch((e) => {
    console.error('COPIA NON FATTA: ' + e.message);
    process.exit(1);
  });

module.exports = { leggiTutto, statoDaDocumenti };
