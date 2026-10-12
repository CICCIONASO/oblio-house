// Monta l'app: anteprima per Claude (un solo file senza <html>) e pacchetto installabile (dist/).
const fs = require('fs');
const path = require('path');
const sharp = require('/opt/npm-tools/node_modules/sharp');

const root = __dirname;
const src = (f) => fs.readFileSync(path.join(root, 'src', f), 'utf8');
const VERSIONE = (/APP_V='([^']+)'/.exec(src('app.js')) || [])[1] || '0.0.0';
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+Condensed:wght@600;700&family=Shrikhand&display=swap';
const fontLink = '<link rel="stylesheet" href="' + FONT_CSS.replace(/&/g, '&amp;') + '">';

const css = src('app.css');
const js = src('app.js');
const body = src('body.html');
if (js.includes('</script')) throw new Error('lo script contiene </script');

const corpo = fontLink + '\n<style>\n' + css + '</style>\n' + body + '<script>\n' + js + '</script>\n';

// sincronizzazione tra telefoni: solo nel pacchetto pubblicato, se c'è src/sync-config.json
const syncFile = path.join(root, 'src', 'sync-config.json');
const syncCfg = fs.existsSync(syncFile) ? JSON.parse(fs.readFileSync(syncFile, 'utf8')) : null;
if (syncCfg && (!syncCfg.room || !syncCfg.firebase || !syncCfg.firebase.projectId)) throw new Error('sync-config.json incompleto');
const SDK = (/var SDK='([^']+)'/.exec(js) || [])[1];
const esterni = syncCfg ? [SDK + 'firebase-app.js', SDK + 'firebase-firestore.js'] : [];
const syncScript = syncCfg ? '<script>window.OBLIO_SYNC=window.OBLIO_SYNC||' + JSON.stringify({ room: syncCfg.room, firebase: syncCfg.firebase }) + ';</script>\n' : '';

// 1) Anteprima dentro Claude
fs.writeFileSync(path.join(root, 'preview.html'), '<title>The Oblio House</title>\n' + corpo);

// 2) Pacchetto installabile
const dist = path.join(root, 'docs');
fs.mkdirSync(dist, { recursive: true });
const index = '<!doctype html>\n<html lang="it">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' +
  '<title>The Oblio House</title>\n' +
  '<meta name="description" content="Reparto fattoni e obliosi: bar, ticket, cassa, triage, freccette e classifiche.">\n' +
  '<meta name="theme-color" content="#2A0E4F">\n' +
  '<meta name="mobile-web-app-capable" content="yes">\n' +
  '<meta name="apple-mobile-web-app-capable" content="yes">\n' +
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n' +
  '<meta name="apple-mobile-web-app-title" content="Oblio House">\n' +
  '<link rel="manifest" href="manifest.webmanifest">\n' +
  '<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">\n' +
  '<link rel="apple-touch-icon" href="apple-touch-icon.png">\n' +
  '<style>html{padding-top:env(safe-area-inset-top,0px)}img{max-width:100%}</style>\n' +
  '</head>\n<body>\n' + syncScript + corpo + '</body>\n</html>\n';
fs.writeFileSync(path.join(dist, 'index.html'), index);

// caricature: stessi percorsi relativi (img/…) nell'anteprima e nel pacchetto
const imgSrc = path.join(root, 'src', 'img');
const immagini = fs.existsSync(imgSrc) ? fs.readdirSync(imgSrc).filter((f) => /\.(jpe?g|png|webp)$/.test(f)).sort() : [];
fs.rmSync(path.join(dist, 'img'), { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'img'), { recursive: true });
immagini.forEach((f) => fs.copyFileSync(path.join(imgSrc, f), path.join(dist, 'img', f)));
fs.writeFileSync(path.join(root, 'preview-files.json'), JSON.stringify(Object.fromEntries(immagini.map((f) => ['img/' + f, 'src/img/' + f])), null, 2));

fs.writeFileSync(path.join(dist, 'sw.js'), src('sw.js')
  .replace('__VERSIONE__', VERSIONE + '-' + Date.now().toString(36))
  .replace('__FONT_CSS__', FONT_CSS)
  .replace('__IMMAGINI__', JSON.stringify(immagini.map((f) => './img/' + f)))
  .replace('__ESTERNI__', JSON.stringify(esterni)));
fs.writeFileSync(path.join(dist, 'manifest.webmanifest'), JSON.stringify({
  name: 'The Oblio House', short_name: 'Oblio House',
  description: 'Reparto fattoni e obliosi: bar, ticket, cassa, triage, freccette e classifiche.',
  lang: 'it', start_url: './', scope: './', display: 'standalone', orientation: 'portrait',
  background_color: '#2A0E4F', theme_color: '#2A0E4F',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2));
fs.writeFileSync(path.join(dist, '.nojekyll'), '');

const icon = src('icon.svg');
const png = (scala, size, file) => sharp(Buffer.from(icon.replace('__SCALA__', String(scala))), { density: 192 }).resize(size, size).png().toFile(path.join(dist, file));
Promise.all([
  png(8.6, 192, 'icon-192.png'),
  png(8.6, 512, 'icon-512.png'),
  png(6.4, 512, 'icon-maskable-512.png'),
  png(8.2, 180, 'apple-touch-icon.png'),
]).then(() => {
  const kb = (f) => (fs.statSync(f).size / 1024).toFixed(1) + ' KB';
  console.log('versione', VERSIONE, syncCfg ? '· sincronizzazione attiva (' + syncCfg.firebase.projectId + ')' : '· senza sincronizzazione');
  console.log('preview.html', kb(path.join(root, 'preview.html')));
  fs.readdirSync(dist).forEach((f) => { const p = path.join(dist, f); if (fs.statSync(p).isFile()) console.log('docs/' + f, kb(p)); });
  console.log('docs/img', immagini.length + ' immagini', (immagini.reduce((s, f) => s + fs.statSync(path.join(dist, 'img', f)).size, 0) / 1024).toFixed(1) + ' KB');
}).catch((e) => { console.error(e); process.exit(1); });
