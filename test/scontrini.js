// Scontrini finti per le prove del lettore: testo come quello dei registratori telematici italiani,
// disegnato come una foto da telefono (carta un po' grigia, leggermente storta e sfocata, tavolo scuro intorno).
const sharp = require('sharp');

const DESPAR = [
  '         DESPAR ALTAMURA',
  '   VIA DEI MILLE 12 - ALTAMURA (BA)',
  '        P.IVA 01234560726',
  '',
  '      DOCUMENTO COMMERCIALE',
  '     di vendita o prestazione',
  'DESCRIZIONE              IVA  Prezzo(€)',
  'COCA COLA LATTINA 33CL 22,00%      0,89',
  '2 x 0,79',
  'KINDER BUENO T2        10,00%      1,58',
  'BIRRA PERONI 66CL      22,00%      1,19',
  'PATATINE CIPSTER 85G   10,00%      1,39',
  'SCONTO                            -0,20',
  'SACCHI NERI 50PZ       22,00%      2,49',
  'ESTATHE PESCA 33CL     22,00%      0,79',
  '',
  'SUBTOTALE                          8,13',
  'TOTALE COMPLESSIVO                 8,13',
  'DI CUI IVA                         1,25',
  'Pagamento contante                10,00',
  'Resto                              1,87',
  'Importo pagato                     8,13',
  '',
  '12-10-2026 19:42',
  'DOCUMENTO N. 0158-0042',
];

const CONAD = [
  '            CONAD CITY',
  '    C.SO FEDERICO II 40 ALTAMURA',
  '',
  '      DOCUMENTO COMMERCIALE',
  'DESCRIZIONE                  Prezzo(€)',
  'FONZIES 100G           10%        1,69',
  'MARS X4                22%        2,99',
  '3 X 1,10',
  'ACQUA NATURALE 2L      22%        3,30',
  'NUTELLA B-READY T6     10%        3,49',
  'KIT KAT 41,5G          10%        1,10',
  'TOTALE COMPLESSIVO               12,57',
  'PAGAMENTO ELETTRONICO            12,57',
  '13/10/2026 18:05',
];

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
async function foto(righe, file, opz = {}) {
  const font = opz.font || 'DejaVu Sans Mono',
    fs = opz.size || 22,
    lh = Math.round(fs * 1.45);
  const w = Math.round(fs * 0.62 * 40) + 60,
    h = righe.length * lh + 80;
  const testo = righe
    .map(
      (r, i) =>
        `<text x="30" y="${50 + i * lh}" font-family="${font}" font-size="${fs}" fill="#2b2b2b" xml:space="preserve">${esc(r)}</text>`
    )
    .join('');
  const carta = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#f1eee6"/>${testo}</svg>`
  );
  let img = sharp(carta).rotate(opz.storto == null ? 1.2 : opz.storto, { background: '#3a3530' });
  const meta = await img.toBuffer({ resolveWithObject: true });
  const W = meta.info.width + 160,
    H = meta.info.height + 200;
  const pieno = await sharp({ create: { width: W, height: H, channels: 3, background: '#3a3530' } })
    .composite([{ input: meta.data, left: 80, top: 100 }])
    .png()
    .toBuffer();
  let base = sharp(pieno);
  if (opz.ombra) {
    // luce storta: un lato in ombra, come sotto una lampada
    const g = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="o" x1="0" y1="0" x2="1" y2="0.3"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#${opz.ombra}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#o)"/></svg>`
    );
    base = sharp(
      await base
        .composite([{ input: g, blend: 'multiply' }])
        .png()
        .toBuffer()
    );
  }
  await base
    .blur(opz.sfoca || 0.7)
    .modulate({ brightness: opz.luce || 0.95 })
    .resize({ width: Math.round(W * (opz.scala || 1.6)) })
    .jpeg({ quality: 78 })
    .toFile(file);
  return file;
}
module.exports = { DESPAR, CONAD, foto };
