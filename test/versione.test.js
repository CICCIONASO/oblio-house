// La versione sta in due posti: package.json e APP_V in src/app.js (quella che l'app mostra e che il build usa).
// Devono coincidere; se la prova gira su un tag (vX.Y.Z), anche il tag deve dire la stessa versione.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const app = (/APP_V='([^']+)'/.exec(fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8')) || [])[1];

assert.ok(app, 'APP_V non trovata in src/app.js');
assert.strictEqual(pkg, app, 'package.json dice ' + pkg + ', src/app.js dice ' + app);

if (process.env.GITHUB_REF_TYPE === 'tag') {
  assert.strictEqual(process.env.GITHUB_REF_NAME, 'v' + pkg, 'il tag ' + process.env.GITHUB_REF_NAME + ' non corrisponde alla versione ' + pkg);
}

console.log('versione ok:', pkg);
