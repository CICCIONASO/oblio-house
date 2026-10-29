// Prova della copia automatica: documenti di Firestore → backup dell'app, cifratura e decifratura con la password.
process.env.TZ = 'Europe/Rome';
const assert = require('assert');
const pure = require('./pure.js');
const { leggiTutto, statoDaDocumenti } = require('../scripts/backup.js');
const { seedState, canon, entita, cifraBackup, decifraBackup, normState } = pure(
  '{seedState,canon,entita,cifraBackup,decifraBackup,normState}'
);

(async () => {
  // un locale con qualche movimento, scritto come lo scrivono i telefoni (un documento per cosa, più una lapide)
  const S = seedState(Date.parse('2026-10-20T20:00:00Z'));
  S.moves.push({ id: 'm1', t: Date.parse('2026-10-20T21:00:00Z'), k: 'dplus', p: S.people[0].id, a: 250, note: 'birra' });
  S.moves.push({ id: 'm2', t: Date.parse('2026-10-20T21:05:00Z'), k: 'dplus', p: S.people[1].id, a: 300, note: 'panino' });
  const doc = (c, i, j) => ({
    name: 'x/' + c + '~' + i,
    fields: {
      c: { stringValue: c },
      i: { stringValue: i },
      j: j == null ? { nullValue: null } : { stringValue: j },
      u: { integerValue: '1' },
    },
  });
  const docs = entita(S).map((x) => doc(x.c, x.i, canon(x.e)));
  docs.push(doc('moves', 'cancellato', null));
  docs.push(doc('boh', '1', '{}'));
  docs.push(doc('moves', 'rotto', '{non json'));

  // lettura a pagine, come risponde Firestore
  const pagine = [docs.slice(0, 5), docs.slice(5)];
  const chiamate = [];
  const prendi = async (url) => {
    chiamate.push(url);
    const n = /pageToken=p(\d)/.exec(url);
    const i = n ? +n[1] : 0;
    return { ok: true, json: async () => ({ documents: pagine[i], nextPageToken: i + 1 < pagine.length ? 'p' + (i + 1) : undefined }) };
  };
  const cfg = { room: 'stanza', firebase: { projectId: 'prog', apiKey: 'chiave' } };
  const letti = await leggiTutto(cfg, prendi);
  assert.strictEqual(letti.length, docs.length);
  assert.strictEqual(chiamate.length, 2);
  assert.ok(/projects\/prog\/databases\/\(default\)\/documents\/locali\/stanza\/e\?/.test(chiamate[0]));
  await assert.rejects(
    leggiTutto(cfg, async () => ({ ok: false, status: 403, text: async () => 'no' })),
    /403/
  );

  const { stato, vivi } = statoDaDocumenti(letti);
  assert.strictEqual(vivi, entita(S).length, 'lapidi, raccolte sconosciute e documenti rotti restano fuori');
  assert.deepStrictEqual(
    stato.moves.map((m) => m.id),
    ['m1', 'm2']
  );
  assert.deepStrictEqual(canon(stato.people), canon(normState(S).people));

  // cifratura: con la password giusta torna lo stesso testo, con quella sbagliata niente
  const testo = JSON.stringify({ app: 'the-oblio-house', v: 1, exported: 'x', state: stato });
  const c = await cifraBackup(testo, 'password-lunga');
  assert.ok(!JSON.stringify(c).includes('birra'), 'nella copia cifrata non si legge niente');
  assert.strictEqual(await decifraBackup(c, 'password-lunga'), testo);
  assert.strictEqual(await decifraBackup(c, 'sbagliata'), null);
  assert.strictEqual(await decifraBackup({ iter: 'boh' }, 'x'), null);
  assert.strictEqual(await decifraBackup({ ...c, dati: 'AAAA' }, 'password-lunga'), null);

  console.log('copia automatica: tutto torna (' + letti.length + ' documenti, cifratura e password)');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
