// Controllo del codice: regole consigliate di ESLint, nessuna regola di stile (lo stile lo tiene Prettier).
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: ['docs/', 'preview.html', 'test/shots/', 'test/fixtures/', 'src/ocr/tesseract-core-*.js', 'node_modules/'],
  },
  js.configs.recommended,
  {
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // l'app gira nel browser, script classico (niente moduli)
    files: ['src/app.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser } },
  },
  {
    files: ['src/sw.js'],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.serviceworker, __IMMAGINI__: 'readonly', __ESTERNI__: 'readonly' },
    },
  },
  {
    files: ['src/ocr/lettore.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.worker } },
  },
  {
    files: ['*.js', 'test/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
  },
  {
    // le funzioni passate a page.evaluate girano dentro la pagina
    files: ['test/e2e.js'],
    languageOptions: { globals: { ...globals.browser } },
  },
];
