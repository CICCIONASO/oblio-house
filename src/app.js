(function(){
'use strict';

/* ===================== PURE ===================== */
var APP_V='0.21.0';
var MODI={'501':'501','301':'301','orologio':'Giro dell’orologio'};
/* votiMax: come si vota, 3 = podio (1°, 2°, 3°), 1 = un voto solo (fino alla 0.10 si poteva scegliere da 1 a 5); graffiGiorni: dopo quanti giorni un graffio è «vecchio» */
var CFG0={voteCut:6,selfVote:true,puliziaGiorni:14,votiMax:3,graffiGiorni:30};
/* codici: PIN per le azioni sensibili (tutti) e codice per attivare l'Admin su un telefono. Si cambiano dall'Admin. */
var ADMIN0='0101';
/* annullare un movimento più grande di così chiede il motivo */
var ANNULLO_GRANDE=2000;
/* frazioni del calendario Teknoservice di Altamura */
var FRAZ=[['organico','Organico'],['secco','Indifferenziata (secco)'],['vetro','Vetro'],['carta','Carta e cartone'],['plastica','Plastica e metalli'],['pannolini','Pannolini e pannoloni']];
var FRAZ_ID=FRAZ.map(function(f){return f[0];});
/* calendario «Centro – utenze domestiche» dalla foto (Comune di Altamura): giorno di ritiro → frazioni.
   Pannolini (mar, gio, sab) lasciati fuori: si spuntano dalle Regole se servono. */
var CAL0={1:['organico','vetro'],2:['secco'],3:['organico'],4:['plastica'],5:['organico'],6:['carta']};
/* cosa butta davvero il locale: gli avvisi arrivano solo per queste (si cambia dalle Regole) */
var BUTTIAMO0=['secco','plastica','vetro'];
/* voti azzerati alla 0.6.0: quelli registrati prima di questo istante spariscono da tutti i telefoni */
var VOTI_DAL=Date.parse('2026-10-12T20:11:00Z');   // 22:11 ora italiana, pubblicazione della 0.6.0
/* sintomi dell'oblio: motivo (facoltativo) del voto nel triage, modificabili dalle Regole */
var SINTOMI0=['Silenzio assordante','Grida silenziose','Richieste di aiuto','Urla strazianti','Scomparsa del volto',
  'Fumare 5/6 canne la sera','Dormire al locale','Sempre al cellulare senza parlare','Giocare alle slot','Stato depressivo',
  'Richieste di essere ucciso'];
var PEOPLE0=[['pj','PJ'],['pesce','PESCE'],['ciccio','CICCIO'],['peppecarlo','PEPPECARLO'],['conti','CONTI'],['chicco','CHICCO']];
var LISTINO0=[
  ['Bevande','Acqua liscia / frizzante',50],['Bevande','Birra',100],['Bevande','Coca Cola lattina',120],['Bevande','Estathé limone / pesca',150],
  ['Dolci','Pan goccioli',60],['Dolci','Nutella B-Ready',80],['Dolci','Kinder Bueno',130],['Dolci','Milka brownies',80],['Dolci','Kinder cereali',80],
  ['Dolci','Happy Hippo',100],['Dolci','Lotus',50],['Dolci','Snickers',100],['Dolci','Fetta al latte',100],['Dolci','Pinguì',100],['Dolci','Paradiso',100],
  ['Dolci','Choco Fresh',80],['Dolci','Delice',80],['Dolci','Kit Kat',150],['Dolci','Mars',100],
  ['Salato','Più Gusto',80],['Salato','Despar',60],['Salato','Wacos',80],['Salato','Cipster',70],['Salato','Fonzies',70]
];
function pad(n){return String(n).padStart(2,'0');}
function ymd(dt){return dt.getFullYear()+'-'+pad(dt.getMonth()+1)+'-'+pad(dt.getDate());}
function toInt(v){v=Math.round(Number(v));return isFinite(v)?v:0;}
function str(v,n){return String(v==null?'':v).slice(0,n);}
function parseEur(s){
  s=String(s==null?'':s).replace(/[€\s]/g,'');
  if(!s)return NaN;
  if(s.indexOf(',')>=0)s=s.replace(/\./g,'').replace(',','.');
  var m=/^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(s);
  if(!m)return NaN;
  return parseInt(m[1],10)*100+(m[2]?parseInt((m[2]+'0').slice(0,2),10):0);
}
function splitShares(total,ids){
  var out={},n=ids.length;if(!n)return out;
  var base=Math.floor(total/n),rest=total-base*n;
  ids.forEach(function(id,i){out[id]=base+(i<rest?1:0);});
  return out;
}
function unitsOf(mv){var u=0;(mv.items||[]).forEach(function(it){u+=Math.max(1,toInt(it&&it.q));});return u||1;}
/* D.open[p]: i graffi ancora aperti, dal più vecchio ({rem: centesimi, t: quando}); D.fondo: il fondo quota del locale,
   separato dalla cassa; D.qv["mese|persona"]: quanto ha versato quella persona per la quota di quel mese */
function derive(S){
  var D={cash:0,debt:{},units:{},stock:{},sold:{},spent:{},open:{},fondo:0,qv:{}};
  var q={},cred={},ora=0;
  function add(p,a,u){
    if(!p||a<=0)return;
    D.debt[p]=(D.debt[p]||0)+a;
    var c=cred[p]||0;
    if(c>=a){cred[p]=c-a;return;}
    if(c>0){a-=c;cred[p]=0;}
    (q[p]=q[p]||[]).push({rem:a,u:u||1,t:ora});
  }
  function sub(p,a){
    if(!p||a<=0)return;
    D.debt[p]=(D.debt[p]||0)-a;
    var l=q[p]||[],r=a;
    while(r>0&&l.length){if(l[0].rem<=r){r-=l[0].rem;l.shift();}else{l[0].rem-=r;r=0;}}
    if(r>0)cred[p]=(cred[p]||0)+r;
  }
  function out(mv){
    (mv.items||[]).forEach(function(it){
      if(!it||!it.id)return;var n=toInt(it.q);
      D.sold[it.id]=(D.sold[it.id]||0)+n;
      if(it.id in D.stock)D.stock[it.id]-=n;
    });
  }
  S.moves.forEach(function(mv){
    if(!mv||mv.x)return;
    var a=mv.k==='count'?toInt(mv.a):Math.max(0,toInt(mv.a));
    ora=toInt(mv.t);
    switch(mv.k){
      case 'sale':D.cash+=a;out(mv);if(mv.p)D.spent[mv.p]=(D.spent[mv.p]||0)+a;break;
      case 'tab':add(mv.p,a,unitsOf(mv));out(mv);if(mv.p)D.spent[mv.p]=(D.spent[mv.p]||0)+a;break;
      case 'dplus':add(mv.p,a,1);break;
      case 'dminus':sub(mv.p,a);break;
      case 'pay':sub(mv.p,a);D.cash+=a;break;
      case 'in':D.cash+=a;break;
      case 'exp':
        if(!mv.paidBy||mv.paidBy==='cassa'||mv.settle==='cassa')D.cash-=a;
        else if(mv.settle==='dividi'){
          sub(mv.paidBy,a);
          var sh=mv.shares||{};
          Object.keys(sh).forEach(function(pid){add(pid,toInt(sh[pid]),1);});
        }else sub(mv.paidBy,a);
        break;
      case 'count':D.cash+=a;break;
      case 'load':(mv.items||[]).forEach(function(it){if(it&&it.id)D.stock[it.id]=(D.stock[it.id]||0)+toInt(it.q);});break;
      case 'inv':(mv.items||[]).forEach(function(it){if(it&&it.id)D.stock[it.id]=toInt(it.q);});break;
      // quota del locale: soldi a parte, non entrano in cassa e non sono graffi
      case 'qin':if(mv.p){D.fondo+=a;var kq=str(mv.mese,7)+'|'+mv.p;D.qv[kq]=(D.qv[kq]||0)+a;}break;
      case 'qout':D.fondo-=a;break;
    }
  });
  Object.keys(q).forEach(function(p){
    var u=0;q[p].forEach(function(c){u+=c.u;});D.units[p]=u;
    if(q[p].length)D.open[p]=q[p].map(function(c){return {rem:c.rem,t:c.t};});
  });
  return D;
}
/* graffi vecchi: per ogni persona quanto dei graffi aperti ha più di «giorni» giorni, e da quando */
function graffiVecchi(D,now,giorni){
  var lim=now-giorni*864e5,o={};
  Object.keys(D.open).forEach(function(p){
    if((D.debt[p]||0)<=0)return;
    var a=0,t0=0;
    D.open[p].forEach(function(c){if(c.t&&c.t<=lim){a+=c.rem;if(!t0||c.t<t0)t0=c.t;}});
    if(a>0)o[p]={a:a,da:t0,giorni:Math.floor((now-t0)/864e5)};
  });
  return o;
}
/* prezzi: «ph» tiene i cambi di prezzo ({t: quando è cambiato, da: il prezzo di prima}). I movimenti salvano già
   il prezzo del momento, quindi i conti passati non cambiano; lo storico serve a vederli e a spiegare le verifiche. */
function prezzoAl(p,t){
  var l=p.ph||[];
  for(var i=0;i<l.length;i++)if(l[i].t>t)return l[i].da;
  return p.price;
}
function cambiaPrezzo(p,v,ora){
  v=Math.max(0,toInt(v));
  if(v===p.price)return false;
  p.ph=(p.ph||[]).concat([{t:ora,da:p.price}]).slice(-20);
  p.price=v;return true;
}
/* ---------- quota del locale ----------
   S.quote: una per mese ({mese: 'AAAA-MM', a: quota a testa, chi: chi la paga, scad: 'AAAA-MM-GG', note}).
   I versamenti sono movimenti «qin» (persona, mese), le uscite «qout» (es. l'affitto pagato). */
function scadenzaQuota(q){return q.scad||(q.mese+'-01');}
function statoQuote(S,D,oggi){
  return S.quote.slice().sort(function(a,b){return a.mese<b.mese?-1:a.mese>b.mese?1:0;}).map(function(q){
    var scad=scadenzaQuota(q),righe=q.chi.map(function(p){
      var v=D.qv[q.mese+'|'+p]||0;
      return {p:p,dovuto:q.a,versato:v,resto:Math.max(0,q.a-v),piu:Math.max(0,v-q.a)};
    });
    var tot=0,ver=0;righe.forEach(function(r){tot+=r.dovuto;ver+=Math.min(r.dovuto,r.versato);});
    return {q:q,mese:q.mese,scad:scad,scaduta:oggi>scad,righe:righe,dovuto:tot,versato:ver,mancano:righe.filter(function(r){return r.resto>0;}).map(function(r){return r.p;})};
  });
}
/* quote non pagate dopo la scadenza: finiscono nei graffi della persona, come voce a parte */
function quoteArretrate(S,D,oggi){
  var o={};
  statoQuote(S,D,oggi).forEach(function(st){
    if(!st.scaduta)return;
    st.righe.forEach(function(r){if(r.resto>0)(o[r.p]=o[r.p]||[]).push({mese:st.mese,a:r.resto});});
  });
  return o;
}
function totArretrato(l){return (l||[]).reduce(function(n,x){return n+x.a;},0);}

/* serata: vale fino all'ora di chiusura del mattino dopo (ora locale, anche nei cambi d'ora) */
function serata(t,cut){
  var d=new Date(t);
  if(d.getHours()<cut)d=new Date(d.getFullYear(),d.getMonth(),d.getDate()-1,12);
  return ymd(d);
}
function prevMonth(ym){var y=+ym.slice(0,4),m=+ym.slice(5,7)-1;if(m<1){m=12;y--;}return y+'-'+pad(m);}
function inPer(key,per,openKey){
  if(per==='sempre')return true;
  if(per.slice(0,2)==='a:')return String(key).slice(0,4)===per.slice(2);   // un anno: «a:2026»
  if(per.slice(0,2)==='m:')return String(key).slice(0,7)===per.slice(2);   // un mese: «m:2026-10»
  if(per==='7g'){var d=openKey.split('-');return String(key)>=ymd(new Date(+d[0],+d[1]-1,+d[2]-7,12))&&String(key)<=openKey;}   // le ultime 7 serate e quella in corso
  var ym=openKey.slice(0,7);
  if(per==='scorso')ym=prevMonth(ym);
  return String(key).slice(0,7)===ym;
}
/* voto palese: un voto per votante, vale l'ultimo; pari merito = più vincitori */
/* sintomi di un voto. Formato: «y» è il primo sintomo, come testo (così lo leggono anche i telefoni non aggiornati);
   «ys» è la lista completa, solo se i sintomi sono più di uno. La 0.5.0 per poco ha salvato «y» come lista. */
function sintomiVoto(v){return Array.isArray(v.ys)&&v.ys.length?v.ys:(Array.isArray(v.y)?v.y:(v.y?[v.y]:[]));}
function metiSintomi(v,ys){if(ys.length)v.y=ys[0];else delete v.y;if(ys.length>1)v.ys=ys.slice();else delete v.ys;}
/* più persone votate (dalla 0.7.0). Un documento per votante e serata, come prima:
   «c» + «y/ys» = il primo votato e i suoi sintomi (così lo leggono anche i telefoni non aggiornati);
   «cs» = tutti i votati, in ordine; «cy» = i sintomi di ognuno. Con un solo votato il formato è quello di prima. */
function candidatiVoto(v){return Array.isArray(v.cs)&&v.cs.length?v.cs:(v.c?[v.c]:[]);}
function sintomiPer(v,c){
  if(c===v.c)return sintomiVoto(v);
  return v.cy&&Array.isArray(v.cy[c])?v.cy[c]:[];
}
function metiVoto(v,cs,cy){
  cy=cy||{};
  v.c=cs[0];metiSintomi(v,(cy[cs[0]]||[]).slice());
  if(cs.length>1){
    v.cs=cs.slice();var o={},n=0;
    cs.forEach(function(c){if(cy[c]&&cy[c].length){o[c]=cy[c].slice();n++;}});
    if(n)v.cy=o;else delete v.cy;
  }else{delete v.cs;delete v.cy;}
}
function sintomiDiVoto(v){var o={};candidatiVoto(v).forEach(function(c){o[c]=sintomiPer(v,c).slice();});return o;}
/* punti di un voto (dalla 0.11.0). Voto a podio («m»: "p"): 1° 3 punti, 2° 2, 3° 1. Voto singolo e voti delle versioni
   precedenti: 1 punto a ognuno dei votati. «tally» sono i punti; a pari punti vincono tutti i pari. */
function puntiVoto(v,i){return v.m==='p'?[3,2,1][i]||0:1;}
function voteSummary(list){
  var last={},by={},tally={},sint={},max=0,nv=0;
  list.forEach(function(v){last[v.v]=v;});
  Object.keys(last).forEach(function(k){
    var v=last[k],cs=candidatiVoto(v);by[k]=cs;
    cs.forEach(function(c,i){
      var pt=puntiVoto(v,i);if(!pt)return;
      tally[c]=(tally[c]||0)+pt;nv++;if(tally[c]>max)max=tally[c];
      sintomiPer(v,c).forEach(function(y){var s=sint[c]=sint[c]||{};s[y]=(s[y]||0)+1;});
    });
  });
  return {by:by,tally:tally,sint:sint,max:max,n:Object.keys(by).length,voti:nv,winners:max?Object.keys(tally).filter(function(c){return tally[c]===max;}):[]};
}
/* il podio di una serata: [{id, punti, pos}] dal più votato; a pari punti stessa posizione (1, 1, 3…) */
function podioSerata(sm){
  var ids=Object.keys(sm.tally).sort(function(a,b){return sm.tally[b]-sm.tally[a]||(a<b?-1:1);}),out=[];
  ids.forEach(function(id,i){var pos=i&&sm.tally[id]===sm.tally[ids[i-1]]?out[i-1].pos:i+1;out.push({id:id,punti:sm.tally[id],pos:pos});});
  return out;
}
/* dalla 0.11.0 ognuno vota dal suo telefono: l'app segna nel voto chi l'ha dato («da»). Il voto di un paziente dato
   dal telefono di un altro non conta; i visitatori si fanno votare da qualsiasi telefono. I voti senza «da» (versioni
   precedenti) restano come sono. */
function votoConta(S,v){
  if(!v.da||v.da===v.v)return true;
  var p=S.people.find(function(x){return x.id===v.v;});
  return !!p&&p.kind==='amico';
}
/* operazioni da confermare (dalla 0.16.0). Se un non-admin segna per un altro una consumazione sul ticket, soldi presi
   dalla cassa o il voto di un visitatore, la cosa conta subito ma porta «dc» (da confermare) finché l'admin non la
   conferma (via «dc») o la annulla come sospetta (il movimento resta nel registro annullato, con «dc»: se qualcuno lo
   ripristina torna da confermare; il voto invece si toglie). io = chi è entrato, chi = per chi si segna. */
function vaConfermato(chi,io,admin){return !admin&&!!io&&!!chi&&chi!==io;}
/* le voci in attesa, dalla più vecchia: i movimenti che vanno insieme (stesso «g») sono una voce sola */
function daConfermare(S){
  var out=[],visti={};
  S.moves.forEach(function(m){
    if(!m.dc||m.x)return;
    var key=m.g||m.id;if(visti[key])return;visti[key]=1;
    out.push({id:'m'+key,t:m.t,da:m.da||'',mv:m.g?S.moves.filter(function(x){return x.g===m.g;}):[m]});
  });
  S.votes.forEach(function(v){if(v.dc)out.push({id:'v'+v.id,t:v.t,da:v.da||'',voto:v});});
  return out.sort(function(a,b){return a.t-b.t;});
}
function confermaOp(op){(op.voto?[op.voto]:op.mv).forEach(function(x){delete x.dc;});}
function annullaOp(S,op,t){
  if(op.voto){var i=S.votes.indexOf(op.voto);if(i>=0)S.votes.splice(i,1);return;}
  op.mv.forEach(function(m){if(!m.x){m.x={t:t};m.xm='Operazione sospetta, annullata dall’admin';}});
}
/* i sintomi più votati (a pari merito tutti, al massimo «quanti») */
function topSintomi(conta,quanti){
  var ks=Object.keys(conta||{});if(!ks.length)return [];
  var max=Math.max.apply(null,ks.map(function(s){return conta[s];}));
  return ks.filter(function(s){return conta[s]===max;}).slice(0,quanti||3);
}
// eslint-disable-next-line no-unused-vars -- usata dai test (blocco PURE)
function topSintomo(conta){return topSintomi(conta,1)[0]||null;}
function sintomiDi(S,id){
  var conta={};
  S.votes.forEach(function(v){if(candidatiVoto(v).indexOf(id)>=0)sintomiPer(v,id).forEach(function(y){conta[y]=(conta[y]||0)+1;});});
  return conta;
}
/* soldi del locale. Attuale: cassa + scorte a prezzo di vendita. Previsionale, a parte: in più i graffi da incassare,
   meno i crediti da restituire. Le scorte valgono anche a costo d'acquisto, per i prodotti che ce l'hanno (dagli scontrini).
   Una scorta sotto zero vale in negativo: così vendere a listino non cambia mai il previsionale, nemmeno senza merce
   segnata (prima contava zero e ogni vendita lo alzava). L'inventario la rimette a posto. */
function previsione(S,D){
  var o={cassa:D.cash,incassare:0,restituire:0,nInc:0,nRes:0,scorte:0,scorteCosto:0,margine:0,nCosto:0,righe:[],nonContati:0,negativi:0};
  Object.keys(D.debt).forEach(function(p){var d=D.debt[p];if(d>0){o.incassare+=d;o.nInc++;}else if(d<0){o.restituire-=d;o.nRes++;}});
  S.products.forEach(function(p){
    if(!(p.id in D.stock)){if(p.on)o.nonContati++;return;}
    var q=toInt(D.stock[p.id]);
    if(q<0)o.negativi++;
    if(!q)return;
    var r={id:p.id,n:p.name,q:q,pr:p.price,v:q*p.price};
    if(p.cost!=null){r.c=p.cost;r.vc=q*p.cost;o.scorteCosto+=r.vc;o.margine+=r.v-r.vc;o.nCosto++;}
    o.scorte+=r.v;o.righe.push(r);
  });
  o.righe.sort(function(a,b){return b.v-a.v||a.n.localeCompare(b.n);});
  o.attuale=o.cassa+o.scorte;
  o.previsionale=o.attuale+o.incassare-o.restituire;
  return o;
}
/* ---------- scontrini: dal testo letto dalla foto alle righe da confermare ---------- */
function normUp(s){return String(s==null?'':s).normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase();}
function chiaveScontrino(d){return normUp(d).replace(/[^A-Z0-9]+/g,' ').trim().slice(0,40);}
var SC_PREZZO=/^(.*?)\s*[€]?\s*([-–—~]?)\s*(\d{1,4})\s?[,.]\s?(\d{2})\d?\s*(?:€|EUR|[A-Z*]{1,2})?\s*$/;
var SC_QTA=/^(?:N\.?\s*)?(\d{1,3})\s*(?:PZ\.?\s*)?[X×*/]+[^0-9]{0,3}(\d{1,4})\s?[,.]\s?(\d{2})(?:\s+(\d{1,4})\s?[,.]\s?(\d{2}))?/;
var SC_SCONTO=/^(SCONTO|SCONT|SC\.|PROMO|OFFERTA|RIDUZ|STORNO|ABBUONO|BUONO SCONTO|COUPON|RIBASSO)/;
var SC_NO=/^(SUB ?TOTALE|TOTALE|TOT\b|TOT\.|DI CUI|IVA\b|IMPONIBILE|CONTANT|PAGAMENT|PAGATO|IMPORTO|RESTO|CARTA|BANCOMAT|ELETTRONIC|POS\b|CREDITO|DEBITO|BUONI?\b|ARROTOND|SALDO|PUNTI|N\.? ?PEZZI|NUMERO|DOCUMENTO|DOC\b|SCONTRINO|CASSA|CASSIERE|OPERATORE|P\.? ?IVA|C\.? ?F\b|TEL\b|DESCRIZIONE|PREZZO|EURO\b|EUR\b|GRAZIE|RT\b|MATRICOLA|RESO\b|ACCONTO|NON RISCOSSO)/;
function scCent(n,d,neg){var v=parseInt(n,10)*100+parseInt(d,10);return neg?-v:v;}
function scPulisci(d){
  return normUp(d).replace(/[€]/g,' ').replace(/\s\d{1,2}(?:[,.]\d{1,2})?\s?%/g,' ').replace(/^\s*\d{5,}\s+/,'')
    .replace(/[|_]+/g,' ').replace(/\s+/g,' ').trim();
}
function scDescrizione(d){return /[A-Z]{2}/.test(d)&&!SC_NO.test(d);}
/* righe dello scontrino: {d: descrizione, q: quantità sullo scontrino, tot: importo della riga in centesimi} */
function leggiScontrino(testo){
  var out={righe:[],totale:null,somma:0,coerente:false,negozio:'',data:''},cand={},qPend=null,descPend=null,ultima=null,prima=-1;
  String(testo||'').split(/\r?\n/).forEach(function(raw,i){
    var l=normUp(raw).replace(/\s+/g,' ').trim();if(!l)return;
    if(!out.data){var md=/(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|\d{2})\b/.exec(l);if(md&&+md[1]>=1&&+md[1]<=31&&+md[2]>=1&&+md[2]<=12)out.data=(md[1].length<2?'0':'')+md[1]+'/'+(md[2].length<2?'0':'')+md[2]+'/'+(md[3].length===2?'20'+md[3]:md[3]);}
    if(!out.negozio&&prima<0&&/[A-Z]{3}/.test(l)&&!/^(VIA|V\.LE|VIALE|C\.?SO|CORSO|PIAZZA|P\.? ?IVA|TEL|DOCUMENTO)/.test(l)&&!SC_PREZZO.test(l))out.negozio=l.replace(/[^A-Z0-9 &'.-]/g,'').trim().slice(0,30);
    if(/^\d+[,.]\d{3}\s*KG/.test(l))return;                       // riga del peso: informazione, non articolo
    var q=SC_QTA.exec(l);
    if(q){
      var qq=parseInt(q[1],10),un=scCent(q[2],q[3]);
      if(!qq||qq>99){qPend=null;return;}
      if(q[4]!=null){                                               // «2 x 0,79   1,58»: la descrizione era sulla riga prima
        var t=scCent(q[4],q[5]);
        if(descPend){out.righe.push(ultima={d:descPend,q:qq,tot:t});descPend=null;if(prima<0)prima=i;}
        else if(ultima&&ultima.q===1&&Math.abs(ultima.tot-t)<=2)ultima.q=qq;
        qPend=null;return;
      }
      if(ultima&&ultima.q===1&&ultima.i===i-1&&Math.abs(ultima.tot-qq*un)<=2){ultima.q=qq;qPend=null;}   // quantità sotto l'articolo
      else qPend={q:qq,u:un};                                                                           // quantità sopra l'articolo
      return;
    }
    var m=SC_PREZZO.exec(l);
    if(!m){descPend=scDescrizione(scPulisci(l))?scPulisci(l):null;return;}
    var cent=scCent(m[3],m[4],!!m[2]),d=scPulisci(m[1]);
    if(SC_SCONTO.test(d)||cent<0){                                   // sconto: scala dall'articolo prima
      if(ultima){
        var sc=Math.abs(cent);
        if(sc>=ultima.tot){                                          // sconto più grande dell'articolo: lettura sbagliata
          var alt=parseInt(String(sc).slice(1),10)||0;sc=alt>0&&alt<ultima.tot?alt:0;ultima.corretta=true;
        }
        ultima.tot-=sc;
      }
      descPend=null;return;
    }
    if(!d||SC_NO.test(d)){
      if(/^SUB ?TOTALE/.test(d))cand.sub=cent;
      else if(/^TOTALE|^TOT\b|^TOT\./.test(d))cand.tot=cent;
      else if(/^(IMPORTO PAGATO|PAGATO|IMPORTO)/.test(d))cand.pag=cent;
      else if(/ELETTRONIC|CARTA|BANCOMAT|POS\b/.test(d))cand.el=cent;
      else if(/CONTANT/.test(d))cand.cont=cent;
      else if(/^RESTO/.test(d))cand.resto=cent;
      descPend=null;return;
    }
    if(!/[A-Z]{2}/.test(d)){descPend=null;return;}
    var r={d:d.slice(0,40),q:1,tot:cent,i:i};
    if(qPend){
      var att=qPend.q*qPend.u;
      if(Math.abs(att-cent)<=2)r.q=qPend.q;
      else if(ultima&&ultima.q===1&&Math.abs(ultima.tot-att)<=2)ultima.q=qPend.q;
      else r.q=qPend.q;                                              // nessuno torna (lettura sporca): di solito sta sopra
      qPend=null;
    }
    out.righe.push(r);ultima=r;descPend=null;if(prima<0)prima=i;
  });
  if(qPend&&ultima&&ultima.q===1&&Math.abs(ultima.tot-qPend.q*qPend.u)<=2)ultima.q=qPend.q;
  out.righe.forEach(function(r){delete r.i;out.somma+=r.tot;});
  // il totale: quello che torna con la somma delle righe, altrimenti quello stampato
  var lista=[cand.tot,cand.sub,cand.pag,cand.el,(cand.cont!=null&&cand.resto!=null)?cand.cont-cand.resto:null].filter(function(x){return x!=null&&x>0;});
  var giusto=lista.filter(function(x){return Math.abs(x-out.somma)<=1;})[0];
  if(giusto==null&&lista.length&&scRipara(out.righe,lista)){out.somma=out.righe.reduce(function(n,r){return n+r.tot;},0);giusto=lista.filter(function(x){return Math.abs(x-out.somma)<=1;})[0];}
  out.totale=giusto!=null?giusto:(cand.tot!=null?cand.tot:(lista[0]!=null?lista[0]:null));
  out.coerente=out.totale!=null&&Math.abs(out.totale-out.somma)<=1;
  return out;
}
/* errore tipico della lettura: una cifra in più davanti al prezzo («60,89» per «0,89»). Se togliendola a una, due
   o tre righe la somma torna con un totale stampato, la correggo e segno la riga come da verificare. */
function scRipara(righe,totali){
  var somma=righe.reduce(function(n,r){return n+r.tot;},0),cand=[];
  righe.forEach(function(r,i){if(r.tot>=100){var c=String(r.tot),v=parseInt(c.slice(1),10)||0;cand.push({i:i,giu:r.tot-v,v:v});}});
  if(!cand.length||cand.length>14)return false;
  var trovate={},n=0;
  totali.filter(function(T,i){return totali.indexOf(T)===i;}).forEach(function(T){
    var serve=somma-T;if(serve<=0)return;
    (function cerca(da,scelte,tot){
      if(n>1)return;
      if(Math.abs(tot-serve)<=1&&scelte.length){var k=scelte.map(function(c){return c.i;}).join(',');if(!trovate[k]){trovate[k]=scelte.slice();n++;}return;}
      if(scelte.length===3)return;
      for(var j=da;j<cand.length;j++){scelte.push(cand[j]);cerca(j+1,scelte,tot+cand[j].giu);scelte.pop();}
    })(0,[],0);
  });
  if(n!==1)return false;   // una sola spiegazione possibile, altrimenti lascio decidere a chi conferma
  trovate=trovate[Object.keys(trovate)[0]];
  trovate.forEach(function(c){righe[c.i].tot=c.v;righe[c.i].corretta=true;});
  return true;
}
/* abbinamento a un prodotto del listino: prima i nomi già confermati (alias), poi le parole in comune */
var SC_VUOTE={'DI':1,'DA':1,'AL':1,'ALLA':1,'LA':1,'IL':1,'LO':1,'CON':1,'E':1,'ED':1,'PER':1,'GUSTO':0};
function scParole(s,desc){
  return normUp(s).replace(/[^A-Z0-9]+/g,' ').split(' ').filter(function(w){
    return w.length>=2&&!SC_VUOTE[w]&&!/^\d/.test(w)&&!(desc&&/^[XT]\d+$/.test(w));
  });
}
function scDist(a,b){   // distanza di modifica limitata (basta sapere se è 0, 1 o di più)
  if(Math.abs(a.length-b.length)>1)return 2;
  var i=0,j=0,e=0;
  while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++e>1)return 2;if(a.length>b.length)i++;else if(b.length>a.length)j++;else{i++;j++;}}
  return e+(a.length-i)+(b.length-j);
}
function abbinaRiga(d,products){
  var k=chiaveScontrino(d),best=null;
  products.forEach(function(p){
    (p.al||[]).forEach(function(a){if(!best&&a.d===k)best={id:p.id,k:a.k||1,s:2};});
  });
  if(best)return best;
  var dw=scParole(d,true);if(!dw.length)return null;
  products.forEach(function(p){
    var pw=scParole(p.name,false);if(!pw.length)return;
    var hit=0;
    pw.forEach(function(w){
      var b=0;
      dw.forEach(function(x){
        if(x===w)b=1;
        else if(Math.min(x.length,w.length)>=3&&(x.indexOf(w)===0||w.indexOf(x)===0))b=Math.max(b,0.85);
        else if(Math.min(x.length,w.length)>=4&&scDist(x,w)<=1)b=Math.max(b,0.75);
      });
      hit+=b;
    });
    var s=hit/pw.length;
    if(s>=0.6&&(!best||s>best.s||(s===best.s&&p.on&&!prod0(products,best.id).on)))best={id:p.id,k:1,s:s};
  });
  return best;
}
function prod0(products,id){for(var i=0;i<products.length;i++)if(products[i].id===id)return products[i];return {};}
/* pezzi per confezione scritti nella descrizione: «MARS X4», «NUTELLA T6», «PERONI 3X33CL» (solo un suggerimento) */
function confezione(d){
  var u=normUp(d),m=/\bX\s?(\d{1,2})\b/.exec(u)||/\bT(\d{1,2})\b/.exec(u)||/\b(\d{1,2})\s?X\s?\d/.exec(u);
  var n=m?parseInt(m[1],10):1;return n>=2&&n<=24?n:1;
}
/* nome proposto per un prodotto nuovo: la descrizione dello scontrino, in minuscolo e senza i formati */
function nomeProposto(d){
  var t=normUp(d).replace(/\b\d+([,.]\d+)?\s?(CL|ML|LT|L|G|GR|KG|PZ)\b/g,' ').replace(/\b[XT]\d+\b/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
  return (t.charAt(0).toUpperCase()+t.slice(1)).slice(0,40);
}
/* proposta da confermare: righe con il prodotto abbinato, i pezzi (quantità × pezzi per confezione già noti) */
function propostaScontrino(letto,products){
  return letto.righe.map(function(r){
    var a=abbinaRiga(r.d,products),pezzi=r.q*(a?a.k:1);
    return {d:r.d,q:r.q,tot:r.tot,prod:a?a.id:null,k:a?a.k:1,pezzi:pezzi,certo:!!a&&a.s>=1&&!r.corretta,corretta:!!r.corretta,conf:a&&a.s>=2?1:confezione(r.d)};
  });
}
/* ricorda come un prodotto compare sugli scontrini (una sola scheda per descrizione) */
function ricordaAlias(products,id,d,k){
  var key=chiaveScontrino(d);if(!key)return;
  products.forEach(function(p){
    if(!p.al||p.id===id)return;
    p.al=p.al.filter(function(a){return a.d!==key;});if(!p.al.length)delete p.al;
  });
  var p=prod0(products,id);if(!p.id)return;
  p.al=(p.al||[]).filter(function(a){return a.d!==key;});
  p.al.push({d:key,k:Math.min(99,Math.max(1,toInt(k)||1))});
  if(p.al.length>12)p.al=p.al.slice(-12);
}
/* registra uno scontrino confermato. righe: {tipo:'prod'|'nuovo'|'altro'|'no', prod, nome, cat, prezzo, pezzi, spesa, d, q}.
   Crea i prodotti nuovi, aggiorna costo d'acquisto e alias, aggiunge il carico e, se richiesta, la spesa.
   opz: {negozio, data, spesa (bool), by ('cassa' o paziente), settle, tra (per dividi)}. id(): nuovo identificativo. */
function applicaScontrino(S,righe,opz,ora,id){
  var agg={},ordine=[],tot=0,nuovi=[];
  var nota=('Scontrino'+(opz.negozio?' '+opz.negozio:'')+(opz.data?' del '+opz.data:'')).slice(0,120);
  righe.forEach(function(r){
    if(r.tipo==='no')return;
    tot+=Math.max(0,toInt(r.spesa));
    if(r.tipo==='altro')return;
    var p;
    if(r.tipo==='nuovo'){
      p={id:'p'+id(),name:str(r.nome,40).trim()||'Prodotto',cat:str(r.cat,20).trim()||'Altro',price:Math.max(0,toInt(r.prezzo)),min:null,on:true};
      S.products.push(p);nuovi.push(p);
    }else p=prod0(S.products,r.prod);
    if(!p||!p.id)return;
    if(!agg[p.id]){agg[p.id]={p:p,pezzi:0,spesa:0};ordine.push(p.id);}
    agg[p.id].pezzi+=Math.max(0,toInt(r.pezzi));agg[p.id].spesa+=Math.max(0,toInt(r.spesa));
    if(r.d)ricordaAlias(S.products,p.id,r.d,r.q>0&&toInt(r.pezzi)%r.q===0?toInt(r.pezzi)/r.q:1);
  });
  var items=[];
  ordine.forEach(function(pid){
    var a=agg[pid];if(a.pezzi<=0)return;
    a.p.cost=Math.round(a.spesa/a.pezzi);
    items.push({id:pid,n:a.p.name,q:a.pezzi,pr:a.p.price,c:a.p.cost});
  });
  var mosse=[];
  if(items.length)mosse.push({id:id(),t:ora,k:'load',a:0,items:items,note:nota});
  if(opz.spesa&&tot>0){
    var e={id:id(),t:ora+1,k:'exp',a:tot,note:nota,cat:'Rifornimento bar',paidBy:opz.by||'cassa'};
    if(e.paidBy!=='cassa'){
      e.settle=opz.settle||'cassa';
      if(e.settle==='dividi')e.shares=splitShares(tot,opz.tra||[]);
    }
    mosse.push(e);
  }
  mosse.forEach(function(m){S.moves.push(m);});
  return {mosse:mosse,nuovi:nuovi,totale:tot,pezzi:items.reduce(function(n,it){return n+it.q;},0)};
}
function serateChiuse(S,openKey){
  var g={},out={};
  S.votes.forEach(function(v){if(v.s<openKey&&votoConta(S,v))(g[v.s]=g[v.s]||[]).push(v);});
  Object.keys(g).forEach(function(k){out[k]=voteSummary(g[k]);});
  return out;
}

/* freccette: si salvano solo i tiri, il resto si ricalcola */
var DART_RE=/^(M|[SDT]([1-9]|1\d|20)|[SD]25)$/;
function dartVal(c){
  if(c==='M'||!DART_RE.test(c))return {n:0,m:0,v:0};
  var m=c.charAt(0)==='T'?3:c.charAt(0)==='D'?2:1,n=parseInt(c.slice(1),10);
  return {n:n,m:m,v:n*m};
}
function playDarts(g){
  var x01=g.mode!=='orologio',start=g.mode==='301'?301:501,P=(g.players||[]).slice();
  var R={},turns=[],cur=0,turn=[],t0=0,win=null,used=0,d=g.d||[];
  P.forEach(function(p){R[p]={left:start,tgt:1,darts:0,pts:0,best:0,co:0,turns:0,busts:0};});
  function chiudi(p,bust,fin){
    var r=R[p],pts=x01&&!bust?t0-r.left:0;
    turns.push({p:p,d:turn,pts:pts,bust:bust,fin:fin,da:t0,a:x01?r.left:r.tgt});
    r.turns++;r.pts+=pts;if(pts>r.best)r.best=pts;if(bust)r.busts++;if(fin&&x01)r.co=pts;
    turn=[];if(!fin)cur=(cur+1)%P.length;
  }
  for(var i=0;i<d.length&&P.length&&!win;i++){
    var p=P[cur],r=R[p],v=dartVal(d[i]);
    if(!turn.length)t0=x01?r.left:r.tgt;
    turn.push(d[i]);r.darts++;used++;
    if(x01){
      var nl=r.left-v.v;
      if(nl<0){r.left=t0;chiudi(p,true,false);continue;}   // sballato: il turno non conta
      r.left=nl;
      if(nl===0){win=p;chiudi(p,false,true);continue;}    // chiusura libera: basta lo zero preciso
    }else{
      if(v.m&&v.n===r.tgt)r.tgt+=v.m;                      // doppio +2, triplo +3
      if(r.tgt>20){r.tgt=21;win=p;chiudi(p,false,true);continue;}
    }
    if(turn.length===3)chiudi(p,false,false);
  }
  var ultimi=[];
  if(win&&P.length>1){
    var altri=P.filter(function(p){return p!==win;});
    var vals=altri.map(function(p){return x01?R[p].left:-R[p].tgt;});
    var peggio=Math.max.apply(null,vals);
    ultimi=altri.filter(function(p,i){return vals[i]===peggio;});
  }
  var cp=P[cur];
  return {x01:x01,start:start,R:R,turns:turns,cur:cur,turn:turn,t0:turn.length?t0:(cp?(x01?R[cp].left:R[cp].tgt):0),win:win,ultimi:ultimi,used:used};
}

/* classifiche: tutte per serata (una consumazione alle 2 di notte conta nella sera prima) */
function statRe(S,per,openKey){
  var ch=serateChiuse(S,openKey),by={},n=0;
  Object.keys(ch).forEach(function(k){
    if(!inPer(k,per,openKey))return;
    var sm=ch[k];n++;
    function P(c){return by[c]=by[c]||{rossi:0,voti:0,pos:[0,0,0]};}
    sm.winners.forEach(function(w){P(w).rossi++;});
    Object.keys(sm.tally).forEach(function(c){P(c).voti+=sm.tally[c];});
    podioSerata(sm).forEach(function(x){if(x.pos<=3)P(x.id).pos[x.pos-1]++;});
  });
  return {by:by,serate:n};
}
function statConsumi(S,per,openKey,cut){
  var o={};
  S.moves.forEach(function(m){
    if(!m||m.x||(m.k!=='sale'&&m.k!=='tab')||!m.p)return;
    if(!inPer(serata(m.t,cut),per,openKey))return;
    var a=o[m.p]=o[m.p]||{eur:0,pz:0};
    a.eur+=Math.max(0,toInt(m.a));
    (m.items||[]).forEach(function(it){a.pz+=Math.max(0,toInt(it&&it.q));});
  });
  return o;
}
function statFreccette(S,per,openKey,cut){
  var o={};
  S.games.forEach(function(g){
    if(g.x||g.ab)return;
    var st=playDarts(g);if(!st.win)return;
    if(!inPer(serata(g.t,cut),per,openKey))return;
    var multi=g.players.length>1;
    g.players.forEach(function(p){
      var r=st.R[p],a=o[p]=o[p]||{gare:0,vinte:0,ultimo:0,darts:0,pts:0,best:0,co:0};
      if(multi){a.gare++;if(p===st.win)a.vinte++;if(st.ultimi.indexOf(p)>=0)a.ultimo++;}
      if(st.x01){a.darts+=r.darts;a.pts+=r.pts;if(r.best>a.best)a.best=r.best;if(p===st.win&&r.co>a.co)a.co=r.co;}
    });
  });
  return o;
}
/* classifica delle freccette (dalla 0.11.0): percentuale di vittorie sulle partite giocate (con almeno due giocatori).
   Si entra in classifica da FRECCE_MIN partite: con meno, una vittoria su una farebbe il 100%. */
var FRECCE_MIN=5;
function percFreccette(x){return x&&x.gare>=FRECCE_MIN?x.vinte/x.gare:-1;}
/* migliori pagatori: giorni medi tra consumazione e saldo, pesati sugli euro.
   «Paga subito» conta 0; quello ancora sul ticket conta fino a adesso. Stessa coda FIFO dei ticket. */
function statPagatori(S,per,openKey,cut,now){
  var q={},cred={},o={};
  function acc(p,a,days,open){var x=o[p]=o[p]||{w:0,a:0,open:0};x.w+=a*days;x.a+=a;if(open)x.open+=a;}
  function charge(p,a,t,count){
    if(!p||a<=0)return;
    var c=cred[p]||0;
    if(c>0){var use=Math.min(c,a);cred[p]=c-use;a-=use;if(count)acc(p,use,0);}
    if(a>0)(q[p]=q[p]||[]).push({rem:a,t:t,count:count});
  }
  function settle(p,a,t){
    if(!p||a<=0)return;
    var l=q[p]||[],r=a;
    while(r>0&&l.length){var c=l[0],use=Math.min(c.rem,r);if(c.count)acc(p,use,Math.max(0,t-c.t)/864e5);c.rem-=use;r-=use;if(!c.rem)l.shift();}
    if(r>0)cred[p]=(cred[p]||0)+r;
  }
  S.moves.forEach(function(m){
    if(!m||m.x)return;
    var a=Math.max(0,toInt(m.a)),cnt=inPer(serata(m.t,cut),per,openKey);
    switch(m.k){
      case 'sale':if(m.p&&cnt&&a>0)acc(m.p,a,0);break;
      case 'tab':case 'dplus':charge(m.p,a,m.t,cnt);break;
      case 'dminus':case 'pay':settle(m.p,a,m.t);break;
      case 'exp':
        if(m.paidBy&&m.paidBy!=='cassa'&&m.settle!=='cassa'){
          settle(m.paidBy,a,m.t);
          if(m.settle==='dividi'){var sh=m.shares||{};Object.keys(sh).forEach(function(pid){charge(pid,toInt(sh[pid]),m.t,cnt);});}
        }
        break;
    }
  });
  Object.keys(q).forEach(function(p){q[p].forEach(function(c){if(c.count&&c.rem>0)acc(p,c.rem,Math.max(0,now-c.t)/864e5,true);});});
  var out={};
  Object.keys(o).forEach(function(p){var x=o[p];if(x.a>0)out[p]={giorni:x.w/x.a,eur:x.a,open:x.open};});
  return out;
}
/* chi ha il valore più alto (pari merito: tutti) */
function vincitori(m){var max=0;Object.keys(m).forEach(function(p){if(m[p]>max)max=m[p];});return max>0?Object.keys(m).filter(function(p){return m[p]===max;}).sort():[];}

/* ---------- statistiche del mese (ym = 'AAAA-MM'), tutto per serata ---------- */
function statMese(S,ym,cut,openKey){
  var per='m:'+ym,o={},tot={eur:0,pz:0,tab:0,prod:{},serate:{},voti:0,partite:0};
  function P(id){return o[id]=o[id]||{eur:0,pz:0,tab:0,prod:{},serate:{},votiRic:0,votiDati:0,rossi:0,gare:0,vinte:0,darts:0,pts:0,rifiuti:0,pulizie:0};}
  S.moves.forEach(function(m){
    if(!m||m.x||(m.k!=='sale'&&m.k!=='tab')||!m.p)return;
    var k=serata(m.t,cut);if(!inPer(k,per,openKey))return;
    var x=P(m.p),a=Math.max(0,toInt(m.a));
    x.eur+=a;tot.eur+=a;x.serate[k]=1;tot.serate[k]=1;
    if(m.k==='tab'){x.tab+=a;tot.tab+=a;}
    (m.items||[]).forEach(function(it){
      if(!it)return;var q=Math.max(0,toInt(it.q)),n=it.n||'?';
      x.pz+=q;tot.pz+=q;x.prod[n]=(x.prod[n]||0)+q;tot.prod[n]=(tot.prod[n]||0)+q;
    });
  });
  var g={};
  S.votes.forEach(function(v){if(inPer(v.s,per,openKey)&&votoConta(S,v))(g[v.s]=g[v.s]||[]).push(v);});
  Object.keys(g).forEach(function(k){
    var sm=voteSummary(g[k]);
    Object.keys(sm.by).forEach(function(vot){var x=P(vot);x.votiDati+=sm.by[vot].length;x.serate[k]=1;tot.serate[k]=1;});
    Object.keys(sm.tally).forEach(function(c){P(c).votiRic+=sm.tally[c];tot.voti+=sm.tally[c];});
    if(k<openKey)sm.winners.forEach(function(w){P(w).rossi++;});
  });
  S.games.forEach(function(gm){
    if(gm.x||gm.ab)return;
    var k=serata(gm.t,cut);if(!inPer(k,per,openKey))return;
    var st=playDarts(gm);if(!st.win)return;
    tot.partite++;tot.serate[k]=1;
    gm.players.forEach(function(p){
      var x=P(p),r=st.R[p];x.serate[k]=1;
      if(gm.players.length>1){x.gare++;if(p===st.win)x.vinte++;}
      if(st.x01){x.darts+=r.darts;x.pts+=r.pts;}
    });
  });
  S.trash.forEach(function(r){if(inPer(r.s,per,openKey))r.p.forEach(function(p){var x=P(p);x.rifiuti++;x.serate[r.s]=1;});});
  S.cleanings.forEach(function(c){var k=serata(c.t,cut);if(inPer(k,per,openKey))c.p.forEach(function(p){P(p).pulizie++;});});
  Object.keys(o).forEach(function(p){
    var x=o[p];x.nSerate=Object.keys(x.serate).length;
    var best=null;Object.keys(x.prod).forEach(function(n){if(!best||x.prod[n]>x.prod[best]||(x.prod[n]===x.prod[best]&&n<best))best=n;});
    x.preferito=best?{n:best,q:x.prod[best]}:null;
  });
  tot.nSerate=Object.keys(tot.serate).length;
  var top=null;Object.keys(tot.prod).forEach(function(n){if(!top||tot.prod[n]>tot.prod[top]||(tot.prod[n]===tot.prod[top]&&n<top))top=n;});
  tot.top=top?{n:top,q:tot.prod[top]}:null;
  return {per:o,tot:tot};
}

/* ---------- record delle freccette (di sempre; a pari merito resta il primo che l'ha fatto) ---------- */
function recordFreccette(S){
  var R={turno:null,chiusura:null,media:null,veloce501:null,veloce301:null,orologio:null,serie:null,c180:{}},giocate={};
  S.games.forEach(function(g){
    if(g.x)return;
    var st=playDarts(g);
    if(st.x01)st.turns.forEach(function(t){
      if(t.bust||t.pts<=0)return;
      if(!R.turno||t.pts>R.turno.v)R.turno={v:t.pts,p:t.p,t:g.t};
      if(t.pts===180)R.c180[t.p]=(R.c180[t.p]||0)+1;
    });
    if(g.ab||!st.win)return;
    var w=st.R[st.win];
    if(st.x01){
      if(!R.chiusura||w.co>R.chiusura.v)R.chiusura={v:w.co,p:st.win,t:g.t};
      var k=g.mode==='301'?'veloce301':'veloce501';
      if(!R[k]||w.darts<R[k].v)R[k]={v:w.darts,p:st.win,t:g.t};
      g.players.forEach(function(p){var r=st.R[p];if(r.darts>=9){var m=r.pts/r.darts*3;if(!R.media||m>R.media.v+1e-9)R.media={v:m,p:p,t:g.t};}});
    }else if(!R.orologio||w.darts<R.orologio.v)R.orologio={v:w.darts,p:st.win,t:g.t};
    if(g.players.length>1)g.players.forEach(function(p){(giocate[p]=giocate[p]||[]).push(p===st.win);});
  });
  Object.keys(giocate).sort().forEach(function(p){
    var s=0,best=0;giocate[p].forEach(function(w){s=w?s+1:0;if(s>best)best=s;});
    if(best>=2&&(!R.serie||best>R.serie.v))R.serie={v:best,p:p};
  });
  return R;
}

/* ---------- medaglie: si guadagnano e restano. I mesi contano solo quando sono finiti. ---------- */
var MEDAGLIE=[
  ['cento','Cento pezzi','100 consumazioni in tutto: una medaglia ogni 100.'],
  ['graffio','Re del graffio','Il più grosso conto sul ticket di un mese.'],
  ['pulito','Fedina pulita','90 giorni di fila senza graffi aperti, consumando almeno 5 volte.'],
  ['puntuale','Sempre puntuale','La quota del locale sempre pagata entro la scadenza (almeno 2 mesi).'],
  ['rosso','Re dell’oblio','Più codici rossi di tutti in un mese.'],
  ['freccia','Campione del mese','Più partite vinte a freccette in un mese.'],
  ['cecchino','Cecchino','Un turno da 180 a freccette.'],
  ['spazzino','Spazzino','I rifiuti portati giù 10 volte: una medaglia ogni 10.']
];
function medaglie(S,now,cut,openKey){
  var o={},cur=openKey.slice(0,7);
  function dai(p,k,n){if(!p||!(n>0))return;var x=o[p]=o[p]||{};x[k]=(x[k]||0)+n;}
  var pz={},tabM={};
  S.moves.forEach(function(m){
    if(!m||m.x||(m.k!=='sale'&&m.k!=='tab')||!m.p)return;
    (m.items||[]).forEach(function(it){pz[m.p]=(pz[m.p]||0)+Math.max(0,toInt(it&&it.q));});
    var ym=serata(m.t,cut).slice(0,7);
    if(m.k==='tab'&&ym<cur){var x=tabM[ym]=tabM[ym]||{};x[m.p]=(x[m.p]||0)+Math.max(0,toInt(m.a));}
  });
  Object.keys(pz).forEach(function(p){dai(p,'cento',Math.floor(pz[p]/100));});
  Object.keys(tabM).forEach(function(ym){vincitori(tabM[ym]).forEach(function(p){dai(p,'graffio',1);});});
  var ch=serateChiuse(S,openKey),rm={};
  Object.keys(ch).forEach(function(k){var ym=k.slice(0,7);if(ym>=cur)return;ch[k].winners.forEach(function(w){var x=rm[ym]=rm[ym]||{};x[w]=(x[w]||0)+1;});});
  Object.keys(rm).forEach(function(ym){vincitori(rm[ym]).forEach(function(p){dai(p,'rosso',1);});});
  var fm={};
  S.games.forEach(function(g){
    if(g.x)return;
    var st=playDarts(g);
    if(st.x01)st.turns.forEach(function(t){if(!t.bust&&t.pts===180)dai(t.p,'cecchino',1);});
    if(g.ab||!st.win||g.players.length<2)return;
    var ym=serata(g.t,cut).slice(0,7);if(ym>=cur)return;
    var x=fm[ym]=fm[ym]||{};x[st.win]=(x[st.win]||0)+1;
  });
  Object.keys(fm).forEach(function(ym){vincitori(fm[ym]).forEach(function(p){dai(p,'freccia',1);});});
  var sp={};S.trash.forEach(function(r){r.p.forEach(function(p){sp[p]=(sp[p]||0)+1;});});
  Object.keys(sp).forEach(function(p){dai(p,'spazzino',Math.floor(sp[p]/10));});
  // puntuale: per ogni quota già scaduta, versato tutto entro la fine del giorno di scadenza
  var oggi=ymd(new Date(now)),qs=S.quote.filter(function(q){return oggi>scadenzaQuota(q);}),pt={};
  qs.forEach(function(q){
    var s=scadenzaQuota(q).split('-'),fine=new Date(+s[0],+s[1]-1,+s[2]+1).getTime(),v={};
    S.moves.forEach(function(m){if(m&&!m.x&&m.k==='qin'&&m.mese===q.mese&&m.p&&toInt(m.t)<fine)v[m.p]=(v[m.p]||0)+Math.max(0,toInt(m.a));});
    q.chi.forEach(function(p){var x=pt[p]=pt[p]||{mesi:0,ok:0};x.mesi++;if((v[p]||0)>=q.a)x.ok++;});
  });
  Object.keys(pt).forEach(function(p){if(pt[p].mesi>=2&&pt[p].ok===pt[p].mesi)dai(p,'puntuale',pt[p].ok);});
  // fedina pulita: tratti di almeno 90 giorni con il conto a zero o in credito, con almeno 5 consumazioni
  var debt={},da={},cons={};
  function chiudi(p,t){if(da[p]!=null&&t-da[p]>=90*864e5&&(cons[p]||0)>=5)dai(p,'pulito',1);}
  function muovi(p,d,t){
    if(!p)return;
    if(da[p]==null&&!(debt[p]>0)){da[p]=t;cons[p]=0;}
    var prima=(debt[p]||0)>0;debt[p]=(debt[p]||0)+d;var dopo=debt[p]>0;
    if(!prima&&dopo){chiudi(p,t);da[p]=null;}
    else if(prima&&!dopo){da[p]=t;cons[p]=0;}
  }
  S.moves.forEach(function(m){
    if(!m||m.x)return;
    var a=Math.max(0,toInt(m.a)),t=toInt(m.t);
    switch(m.k){
      case 'sale':if(m.p){muovi(m.p,0,t);if(da[m.p]!=null)cons[m.p]++;}break;
      case 'tab':muovi(m.p,a,t);if(m.p&&da[m.p]!=null)cons[m.p]++;break;
      case 'dplus':muovi(m.p,a,t);break;
      case 'dminus':case 'pay':muovi(m.p,-a,t);break;
      case 'exp':
        if(m.paidBy&&m.paidBy!=='cassa'&&m.settle!=='cassa'){
          muovi(m.paidBy,-a,t);
          if(m.settle==='dividi'){var sh=m.shares||{};Object.keys(sh).forEach(function(p){muovi(p,Math.max(0,toInt(sh[p])),t);});}
        }
        break;
    }
  });
  Object.keys(da).forEach(function(p){if(da[p]!=null)chiudi(p,now);});
  return o;
}

/* ---------- albo d'oro di un anno: i primi di ogni categoria (pari merito: tutti) ---------- */
function alboOro(S,anno,cut,openKey,now){
  var per='a:'+anno,r=statRe(S,per,openKey).by,co=statConsumi(S,per,openKey,cut),fr=statFreccette(S,per,openKey,cut),sp=statSpazzatura(S,per,openKey),pg=statPagatori(S,per,openKey,cut,now);
  function mappa(o,f){var m={};Object.keys(o).forEach(function(p){var v=f(o[p]);if(v>0)m[p]=v;});return m;}
  function voce(k,titolo,m,u){var w=vincitori(m);return {k:k,titolo:titolo,chi:w,n:w.length?m[w[0]]:0,u:u};}
  var pag={},best=null;
  Object.keys(pg).forEach(function(p){var x=pg[p];if(x.eur<1000)return;var g=Math.round(x.giorni*10);if(best==null||g<best){best=g;pag={};}if(g===best)pag[p]=1;});
  return [
    voce('rosso','Re dell’oblio',mappa(r,function(x){return x.rossi;}),['codice rosso','codici rossi']),
    voce('votato','Il più votato',mappa(r,function(x){return x.voti;}),['punto ricevuto','punti ricevuti']),
    voce('freccette','Campione delle freccette',mappa(fr,function(x){return x.vinte?Math.round(percFreccette(x)*100):0;}),['% di vittorie','% di vittorie']),
    voce('consumi','Re della farmacia',mappa(co,function(x){return x.eur;}),['euro','euro']),
    {k:'pagatore',titolo:'Miglior pagatore',chi:Object.keys(pag).sort(),n:best==null?0:best/10,u:['giorno','giorni']},
    voce('spazzino','Spazzino dell’anno',mappa(sp,function(x){return x.n;}),['uscita dei rifiuti','uscite dei rifiuti'])
  ];
}

/* ---------- compleanni: i prossimi, dal più vicino (il 29 febbraio, negli anni normali, si festeggia il 28) ---------- */
function prossimiCompleanni(S,oggi){
  var y=+oggi.slice(0,4),d0=new Date(y,+oggi.slice(5,7)-1,+oggi.slice(8,10),12),out=[];
  S.people.forEach(function(p){
    if(!p.on||!p.nato)return;
    var mm=+p.nato.slice(0,2),gg=+p.nato.slice(3,5);
    function giorno(a){var d=new Date(a,mm-1,gg,12);if(d.getMonth()!==mm-1)d=new Date(a,mm-1,28,12);return d;}
    var d=giorno(y);if(d<d0)d=giorno(y+1);
    out.push({p:p.id,giorni:Math.round((d-d0)/864e5),data:ymd(d)});
  });
  return out.sort(function(a,b){return a.giorni-b.giorni||(a.p<b.p?-1:1);});
}

/* ---------- verifica del mese: dalla «foto» del previsionale a adesso, voce per voce ----------
   Ripercorre i movimenti (e i cambi di prezzo) con le stesse regole di derive e previsione:
   previsionale = cassa + graffi (al netto dei crediti) + scorte contate × prezzo di quel momento.
   «correzioni»: quello che è cambiato nel passato dopo la foto (annullamenti, movimenti segnati in ritardo). */
function spiegaVerifica(S,snap,tFine){
  var prod={},stock={},cash=0,debt=0,cat={carichi:0,vendite:0,spese:0,entrate:0,debiti:0,prelievi:0,conte:0,inventari:0,prezzi:0,altro:0};
  S.products.forEach(function(p){prod[p.id]=p;});
  function vp(id,t){return (id in stock)&&prod[id]?stock[id]*prezzoAl(prod[id],t):0;}
  function valore(t){var v=cash+debt;Object.keys(stock).forEach(function(id){v+=vp(id,t);});return v;}
  var ev=[];
  S.moves.forEach(function(m){if(m&&!m.x&&toInt(m.t)<=tFine)ev.push({t:toInt(m.t),m:m});});
  S.products.forEach(function(p){(p.ph||[]).forEach(function(x){if(x.t<=tFine)ev.push({t:x.t,p:p,x:x});});});
  ev.sort(function(a,b){return a.t-b.t||(a.m?0:1)-(b.m?0:1);});
  var t0=snap.t,v0=null;
  function fuori(m){(m.items||[]).forEach(function(it){if(it&&it.id&&(it.id in stock))stock[it.id]-=toInt(it.q);});}
  function applica(e){
    if(!e.m){   // cambio di prezzo: le scorte di quel prodotto cambiano valore
      var p=e.p,dopo=prezzoAl(p,e.x.t),q=(p.id in stock)?stock[p.id]:0;
      return {k:'prezzi',d:q*(dopo-e.x.da)};
    }
    var m=e.m,a=m.k==='count'?toInt(m.a):Math.max(0,toInt(m.a)),ids={},prima=0,dopo2=0,k='altro';
    (m.items||[]).forEach(function(it){if(it&&it.id)ids[it.id]=1;});
    Object.keys(ids).forEach(function(id){prima+=vp(id,e.t);});
    var c0=cash,d0=debt;
    switch(m.k){
      case 'sale':cash+=a;fuori(m);k='vendite';break;
      case 'tab':if(m.p)debt+=a;fuori(m);k='vendite';break;
      case 'dplus':if(m.p)debt+=a;k=m.pc?'prelievi':'debiti';break;
      case 'dminus':if(m.p)debt-=a;k='debiti';break;
      case 'pay':cash+=a;if(m.p)debt-=a;break;
      case 'in':cash+=a;k='entrate';break;
      case 'exp':
        if(!m.paidBy||m.paidBy==='cassa'||m.settle==='cassa')cash-=a;
        else if(m.settle==='dividi'){debt-=a;var sh=m.shares||{};Object.keys(sh).forEach(function(p){debt+=toInt(sh[p]);});}
        else debt-=a;
        k=m.pc?'prelievi':'spese';break;
      case 'count':cash+=a;k='conte';break;
      case 'load':(m.items||[]).forEach(function(it){if(it&&it.id)stock[it.id]=(stock[it.id]||0)+toInt(it.q);});k='carichi';break;
      case 'inv':(m.items||[]).forEach(function(it){if(it&&it.id)stock[it.id]=toInt(it.q);});k='inventari';break;
    }
    Object.keys(ids).forEach(function(id){dopo2+=vp(id,e.t);});
    return {k:k,d:(cash-c0)+(debt-d0)+(dopo2-prima)};
  }
  ev.forEach(function(e){
    if(e.t>t0&&v0==null)v0=valore(t0);
    var r=applica(e);
    if(e.t>t0)cat[r.k]+=r.d;
  });
  if(v0==null)v0=valore(t0);
  var v1=valore(tFine),somma=0;Object.keys(cat).forEach(function(k){somma+=cat[k];});
  return {foto:snap.previsionale,rifatto:v0,correzioni:v0-snap.previsionale,cat:cat,somma:somma,adesso:v1,diff:v1-snap.previsionale,
    sfuggito:cat.conte+cat.inventari};
}

/* rifiuti: cfg.rifiuti[g] = frazioni ritirate la mattina del giorno g (0 dom … 6 sab).
   Si espongono la sera prima, quindi la serata K mostra il ritiro del giorno dopo. */
function rifiutiSerata(cfg,key){
  var p=String(key).split('-'),g=new Date(+p[0],+p[1]-1,+p[2]+1,12).getDay(),b=cfg.buttiamo||BUTTIAMO0;
  return ((cfg.rifiuti&&cfg.rifiuti[g])||[]).filter(function(f){return b.indexOf(f)>=0;});
}
function calPieno(cfg){for(var g=0;g<7;g++)if(cfg.rifiuti&&cfg.rifiuti[g]&&cfg.rifiuti[g].length)return true;return false;}
function prossimiRifiuti(cfg,key){
  var p=String(key).split('-');
  for(var i=1;i<=7;i++){var k=ymd(new Date(+p[0],+p[1]-1,+p[2]+i,12)),f=rifiutiSerata(cfg,k);if(f.length)return {k:k,f:f};}
  return null;
}
function statSpazzatura(S,per,openKey){
  var o={};
  S.trash.forEach(function(r){
    if(!inPer(r.s,per,openKey))return;
    r.p.forEach(function(p){var x=o[p]=o[p]||{n:0,ultima:''};x.n++;if(r.s>x.ultima)x.ultima=r.s;});
  });
  return o;
}
/* pulizie: l'avviso scatta quando dall'ultima pulizia sono passati «giorni» giorni */
function pulizieStato(S,now,giorni){
  var last=0;
  S.cleanings.forEach(function(c){if(c.t>last&&c.t<=now)last=c.t;});
  if(!last)return {mai:true,giorni:null,scadute:false,mancano:null,ultima:0};
  var g=Math.floor((now-last)/864e5);
  return {mai:false,ultima:last,giorni:g,scadute:g>=giorni,mancano:Math.max(0,giorni-g)};
}

/* caricature incluse nell'app (img/c1.jpg …); IMG0 = chi è chi, da confermare */
var CARIC=['c1','c2','c3','c4','c5','c6'];
var IMG0={pesce:'c1',conti:'c2',chicco:'c3',pj:'c4',peppecarlo:'c5',ciccio:'c6'};
function normImg(v){
  v=v==null?'':String(v);
  if(CARIC.indexOf(v)>=0)return v;
  if(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v)&&v.length<=160000)return v;
  return '';
}
/* assegna le caricature di IMG0 una volta sola, senza toccare scelte già fatte nell'app */
function applyImg0(S){
  var sig=Object.keys(IMG0).sort().map(function(k){return k+'='+IMG0[k];}).join(',');
  if(!sig||S.meta.img0===sig)return false;
  var usate={};S.people.forEach(function(p){if(p.img)usate[p.img]=1;});
  S.people.forEach(function(p){var c=IMG0[p.id];if(c&&!p.img&&!usate[c]){p.img=c;usate[c]=1;}});
  S.meta.img0=sig;return true;
}
function seedState(now){
  return {
    v:1,
    people:PEOPLE0.map(function(p){return {id:p[0],name:p[1],kind:'paziente',on:true,img:''};}),
    products:LISTINO0.map(function(p,i){return {id:'p'+(i+1),name:p[1],cat:p[0],price:p[2],min:null,on:true};}),
    moves:[],shop:[],votes:[],games:[],trash:[],cleanings:[],quote:[],muro:[],capisco:[],verifiche:[],
    cfg:normCfg(null),
    meta:{created:now,rev:0,saved:0,exported:0,img0:'',cal0:'',sint0:''}
  };
}
/* campi che questa versione non conosce, aggiunti da versioni più nuove: restano come sono, così un telefono
   non aggiornato non li cancella quando modifica la stessa cosa. «noti» sono i campi che la versione gestisce già. */
function tieniAltro(raw,o,noti){
  Object.keys(raw).forEach(function(k){
    if(noti.indexOf(k)>=0||k in o||!/^[a-z][A-Za-z0-9]{0,15}$/.test(k))return;
    var v=raw[k];if(v===undefined||typeof v==='function')return;
    try{var j=JSON.stringify(v);if(j&&j.length<=2000)o[k]=JSON.parse(j);}catch(e){}
  });
  return o;
}
var NOTI={
  cfg:['voteCut','selfVote','puliziaGiorni','rifiuti','sintomi','buttiamo','votiMax','graffiGiorni','pinH','admH','voto'],
  people:['id','name','kind','on','img','nato','tel','pin','noq','visto'],
  products:['id','name','cat','price','min','on','cost','al','ph'],
  moves:['id','t','k','a','p','note','cat','items','paidBy','settle','shares','counted','expected','x','xm','g','mese','pc','da','dc'],
  votes:['id','s','v','c','t','y','ys','cs','cy','da','m','dc'],
  quote:['id','mese','a','chi','scad','note','t'],
  muro:['id','t','p','testo','col','dv','mod','fis'],
  capisco:['id','w','p','t'],
  verifiche:['id','t','cassa','scorte','incassare','restituire','previsionale','fondo','nota','da']
};
/* codici salvati come impronta (non in chiaro nei dati condivisi) */
function impronta(code){return hashStr('oblio|'+String(code==null?'':code).trim());}
function normCfg(c){
  c=c&&typeof c==='object'?c:{};
  var cut=c.voteCut==null||c.voteCut===''?CFG0.voteCut:toInt(c.voteCut);
  var pg=c.puliziaGiorni==null||c.puliziaGiorni===''?CFG0.puliziaGiorni:toInt(c.puliziaGiorni);
  var vm=c.votiMax==null||c.votiMax===''?CFG0.votiMax:toInt(c.votiMax);
  var gg=c.graffiGiorni==null||c.graffiGiorni===''?CFG0.graffiGiorni:toInt(c.graffiGiorni);
  var rif={},src=c.rifiuti&&typeof c.rifiuti==='object'?c.rifiuti:{};
  for(var g=0;g<7;g++){var a=Array.isArray(src[g])?src[g]:[];rif[g]=FRAZ_ID.filter(function(id){return a.indexOf(id)>=0;});}
  var sint=SINTOMI0.slice();
  if(Array.isArray(c.sintomi)){
    sint=[];
    c.sintomi.slice(0,40).forEach(function(s){s=str(s,40).trim();if(s&&sint.indexOf(s)<0)sint.push(s);});
  }
  var but=FRAZ_ID.filter(function(id){return (Array.isArray(c.buttiamo)?c.buttiamo:BUTTIAMO0).indexOf(id)>=0;});
  var o={voteCut:cut>=0&&cut<=12?cut:CFG0.voteCut,selfVote:c.selfVote!==false,
    puliziaGiorni:pg>=1&&pg<=90?pg:CFG0.puliziaGiorni,rifiuti:rif,sintomi:sint,buttiamo:but,
    votiMax:vm>=1&&vm<=5?vm:CFG0.votiMax,graffiGiorni:gg>=7&&gg<=365?gg:CFG0.graffiGiorni};
  if(c.voto==='n')o.voto='n';                                   // «fino a N persone»; senza = podio (dalla 0.11.0)
  if(c.pinH&&typeof c.pinH==='string')o.pinH=str(c.pinH,24);
  if(c.admH&&typeof c.admH==='string')o.admH=str(c.admH,24);
  return tieniAltro(c,o,NOTI.cfg);
}
/* sintomi: chi aveva la lista di partenza precedente riceve quelli aggiunti dopo, una volta sola */
function applySintomi0(S){
  var sig=SINTOMI0.join('|');
  if(S.meta.sint0===sig)return false;
  if(!S.meta.sint0&&S.cfg.sintomi.join('|')===SINTOMI0.slice(0,10).join('|'))S.cfg.sintomi=SINTOMI0.slice();
  S.meta.sint0=sig;return true;
}
/* calendario dei rifiuti precompilato una volta sola, senza toccare un calendario già compilato a mano */
function applyCal0(S){
  var sig=Object.keys(CAL0).sort().map(function(k){return k+'='+CAL0[k].join('+');}).join(',');
  if(S.meta.cal0===sig)return false;
  if(!calPieno(S.cfg))Object.keys(CAL0).forEach(function(g){S.cfg.rifiuti[g]=CAL0[g].slice();});
  S.meta.cal0=sig;return true;
}
/* 0.11.0: ELENA entra tra i pazienti (ticket e voti, ma niente quota), una volta sola. Se c'è già, anche come
   visitatrice, diventa paziente: niente doppioni e nessun dato tolto. */
function applyElena(S){
  if(S.meta.elena0)return false;
  var e=S.people.find(function(p){return String(p.name||'').trim().toLowerCase()==='elena';});
  if(e){e.kind='paziente';e.on=true;e.noq=1;}
  else if(!S.people.some(function(p){return p.id==='elena';}))S.people.push({id:'elena',name:'ELENA',kind:'paziente',on:true,img:'',noq:1});
  S.meta.elena0=1;return true;
}
function normIds(a){
  var out=[];(Array.isArray(a)?a:[]).slice(0,12).forEach(function(p){p=str(p,24);if(p&&out.indexOf(p)<0)out.push(p);});
  return out;
}
/* compleanno «MM-GG» (anche 29 febbraio); niente anno di nascita */
function normNato(v){
  var m=/^(\d{2})-(\d{2})$/.exec(String(v==null?'':v));if(!m)return '';
  var mm=+m[1],gg=+m[2],max=[31,29,31,30,31,30,31,31,30,31,30,31][mm-1];
  return mm>=1&&mm<=12&&gg>=1&&gg<=max?m[0]:'';
}
function normState(raw){
  if(!raw||typeof raw!=='object'||!Array.isArray(raw.people)||!Array.isArray(raw.moves)||!Array.isArray(raw.products))return null;
  var S={v:1,people:[],products:[],moves:[],shop:[],votes:[],games:[],trash:[],cleanings:[],quote:[],muro:[],capisco:[],verifiche:[],cfg:normCfg(raw.cfg),meta:{}};
  raw.people.forEach(function(p){
    if(p&&typeof p.id==='string'&&p.id){
      var id=str(p.id,40);
      var o={id:id,name:str(p.name,24).trim()||'Senza nome',kind:p.kind==='amico'?'amico':'paziente',on:p.on!==false,img:normImg(p.img)};
      if(normNato(p.nato))o.nato=normNato(p.nato);                       // compleanno: solo «MM-GG», senza anno
      if(p.tel&&typeof p.tel==='string')o.tel=str(p.tel,40);              // il telefono di questa persona (id del dispositivo)
      if(p.pin&&typeof p.pin==='string')o.pin=str(p.pin,24);              // impronta del PIN personale
      if(p.noq)o.noq=1;                                                   // non paga la quota del locale
      if(typeof p.visto==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(p.visto))o.visto=p.visto;   // ultimo giorno in cui ha aperto l'app (dalla 0.17.0)
      S.people.push(tieniAltro(p,o,NOTI.people));
    }
  });
  raw.products.forEach(function(p){
    if(!p||typeof p.id!=='string'||!p.id)return;
    var o={id:str(p.id,40),name:str(p.name,40).trim()||'Prodotto',cat:str(p.cat,20).trim()||'Altro',price:Math.max(0,toInt(p.price)),min:(p.min==null||p.min==='')?null:Math.max(0,toInt(p.min)),on:p.on!==false};
    if(p.cost!=null&&p.cost!=='')o.cost=Math.max(0,toInt(p.cost));            // costo d'acquisto al pezzo, dall'ultimo scontrino
    var al=[];                                                                   // come compare sugli scontrini (chiave) e pezzi per confezione
    (Array.isArray(p.al)?p.al:[]).forEach(function(a){
      if(!a||typeof a!=='object')return;var d=chiaveScontrino(a.d);if(!d||al.some(function(x){return x.d===d;}))return;
      al.push({d:d,k:Math.min(99,Math.max(1,toInt(a.k)||1))});
    });
    if(al.length)o.al=al.slice(-12);
    var ph=[];                                                                   // storico dei prezzi
    (Array.isArray(p.ph)?p.ph:[]).forEach(function(x){if(x&&typeof x==='object'&&toInt(x.t)>0)ph.push({t:toInt(x.t),da:Math.max(0,toInt(x.da))});});
    if(ph.length){ph.sort(function(a,b){return a.t-b.t;});o.ph=ph.slice(-20);}
    S.products.push(tieniAltro(p,o,NOTI.products));
  });
  raw.moves.forEach(function(m){
    if(!m||typeof m.k!=='string')return;
    var o={id:str(m.id,40)||('m'+S.moves.length),t:toInt(m.t),k:str(m.k,10),a:toInt(m.a)};
    if(m.p)o.p=str(m.p,24);
    if(m.note)o.note=str(m.note,120);
    if(m.cat)o.cat=str(m.cat,30);
    if(Array.isArray(m.items))o.items=m.items.filter(function(it){return it&&typeof it==='object';}).slice(0,80).map(function(it){
      var x={n:str(it.n,40),q:Math.max(0,toInt(it.q)),pr:Math.max(0,toInt(it.pr))};if(it.id)x.id=str(it.id,40);if(it.c!=null)x.c=Math.max(0,toInt(it.c));return x;});
    if(m.paidBy)o.paidBy=str(m.paidBy,24);
    if(m.settle)o.settle=str(m.settle,10);
    if(m.shares&&typeof m.shares==='object'){o.shares={};Object.keys(m.shares).slice(0,40).forEach(function(k){o.shares[str(k,24)]=Math.max(0,toInt(m.shares[k]));});}
    if(m.counted!=null)o.counted=toInt(m.counted);
    if(m.expected!=null)o.expected=toInt(m.expected);
    if(m.x)o.x={t:toInt(m.x.t)};
    if(m.xm)o.xm=str(m.xm,120);                     // motivo dell'annullamento
    if(m.g)o.g=str(m.g,40);                         // movimenti che vanno insieme (pagamento misto, resto in più)
    if(m.pc)o.pc=1;                                 // preso dalla cassa: debito + uscita, non è una spesa del locale
    if(m.da)o.da=str(m.da,24);                      // chi l'ha segnato (dalla 0.11.0, con il login)
    if(m.dc)o.dc=1;                                 // da confermare dall'admin (dalla 0.16.0)
    if(m.mese&&/^\d{4}-\d{2}$/.test(String(m.mese)))o.mese=String(m.mese);   // quota del locale: di che mese
    S.moves.push(tieniAltro(m,o,NOTI.moves));
  });
  S.moves.sort(function(a,b){return a.t-b.t;});
  (Array.isArray(raw.shop)?raw.shop:[]).forEach(function(s){if(s&&s.text)S.shop.push({id:str(s.id,40)||('s'+S.shop.length),text:str(s.text,60),t:toInt(s.t)});});
  var vv=[],ultimo={};
  (Array.isArray(raw.votes)?raw.votes:[]).forEach(function(v){
    if(!v||typeof v!=='object')return;
    var s=str(v.s,10),chi=str(v.v,24),per=str(v.c,24);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!chi||!per)return;
    if(toInt(v.t)<VOTI_DAL)return;                                     // voti azzerati alla 0.6.0
    var o={id:str(v.id,40)||('v'+vv.length),s:s,v:chi,c:per,t:toInt(v.t)};
    function pulisci(l){var ys=[];(Array.isArray(l)?l:[]).slice(0,12).forEach(function(x){x=str(x,40).trim();if(x&&ys.indexOf(x)<0)ys.push(x);});return ys;}
    // più votati: un telefono non aggiornato cambia solo «c» (e i suoi sintomi), quindi «c» resta sempre il primo
    var cs=[];(Array.isArray(v.cs)?v.cs:[]).forEach(function(x){x=str(x,24);if(x&&cs.indexOf(x)<0)cs.push(x);});
    if(cs.length&&cs[0]!==per){var i=cs.indexOf(per);if(i>=0)cs.splice(i,1);else cs.shift();cs.unshift(per);}
    if(!cs.length)cs=[per];
    var cy={};cs.slice(0,5).forEach(function(c,i){cy[c]=i===0?pulisci(sintomiVoto(v)):pulisci(v.cy&&typeof v.cy==='object'?v.cy[c]:null);});
    metiVoto(o,cs.slice(0,5),cy);
    if(v.da)o.da=str(v.da,24);                                          // chi l'ha segnato (il telefono di chi)
    if(v.m==='p')o.m='p';                                               // voto a podio: 3, 2 e 1 punto
    if(v.dc)o.dc=1;                                                     // da confermare dall'admin (dalla 0.16.0)
    vv.push(tieniAltro(v,o,NOTI.votes));
  });
  vv.sort(function(a,b){return a.t-b.t;});
  vv.forEach(function(v){ultimo[v.s+'|'+v.v]=v;});
  S.votes=vv.filter(function(v){return ultimo[v.s+'|'+v.v]===v;});
  (Array.isArray(raw.games)?raw.games:[]).forEach(function(g){
    if(!g||typeof g!=='object'||!Object.prototype.hasOwnProperty.call(MODI,g.mode))return;
    var pl=[];
    (Array.isArray(g.players)?g.players:[]).slice(0,8).forEach(function(p){p=str(p,24);if(p&&pl.indexOf(p)<0)pl.push(p);});
    if(!pl.length)return;
    var o={id:str(g.id,40)||('g'+S.games.length),t:toInt(g.t),mode:g.mode,players:pl,
      d:(Array.isArray(g.d)?g.d:[]).slice(0,1200).map(function(c){return str(c,4);}).filter(function(c){return DART_RE.test(c);}),end:0};
    var st=playDarts(o);
    if(st.used<o.d.length)o.d=o.d.slice(0,st.used);
    if(st.win)o.end=toInt(g.end)||o.t||1;
    if(g.ab)o.ab=toInt(g.ab);
    if(g.x)o.x={t:toInt(g.x.t)};
    S.games.push(o);
  });
  S.games.sort(function(a,b){return a.t-b.t;});
  var perSerata={};
  (Array.isArray(raw.trash)?raw.trash:[]).forEach(function(r){
    if(!r||typeof r!=='object')return;
    var s=str(r.s,10),ps=normIds(r.p);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!ps.length)return;
    var o={id:str(r.id,40)||('r'+s),s:s,p:ps,f:(Array.isArray(r.f)?r.f:[]).filter(function(f){return FRAZ_ID.indexOf(f)>=0;}),t:toInt(r.t)};
    if(!perSerata[s]||perSerata[s].t<=o.t)perSerata[s]=o;   // una sola uscita dei rifiuti per serata
  });
  S.trash=Object.keys(perSerata).sort().map(function(k){return perSerata[k];});
  (Array.isArray(raw.cleanings)?raw.cleanings:[]).forEach(function(c){
    if(!c||typeof c!=='object'||!(toInt(c.t)>0))return;
    S.cleanings.push({id:str(c.id,40)||('c'+S.cleanings.length),t:toInt(c.t),p:normIds(c.p)});
  });
  S.cleanings.sort(function(a,b){return a.t-b.t;});
  // quota del locale: una per mese (vince la più recente se due telefoni la scrivono insieme)
  var perMese={};
  (Array.isArray(raw.quote)?raw.quote:[]).forEach(function(q){
    if(!q||typeof q!=='object'||!/^\d{4}-\d{2}$/.test(String(q.mese)))return;
    var o={id:'q'+q.mese,mese:String(q.mese),a:Math.max(0,toInt(q.a)),chi:normIds(q.chi),t:toInt(q.t)};
    if(/^\d{4}-\d{2}-\d{2}$/.test(String(q.scad||'')))o.scad=String(q.scad);
    if(q.note)o.note=str(q.note,120);
    if(!o.chi.length)return;
    if(!perMese[o.mese]||perMese[o.mese].t<=o.t)perMese[o.mese]=tieniAltro(q,o,NOTI.quote);
  });
  S.quote=Object.keys(perMese).sort().map(function(k){return perMese[k];});
  // muroblio del pianto: post-it firmati
  (Array.isArray(raw.muro)?raw.muro:[]).forEach(function(x){
    if(!x||typeof x!=='object'||!x.p||!x.testo)return;
    var o={id:str(x.id,40)||('w'+S.muro.length),t:toInt(x.t),p:str(x.p,24),testo:str(x.testo,300).trim(),col:Math.min(5,Math.max(0,toInt(x.col))),dv:str(x.dv,40)};
    if(!o.testo)return;
    if(x.mod)o.mod=toInt(x.mod);
    if(x.fis)o.fis=1;
    S.muro.push(tieniAltro(x,o,NOTI.muro));
  });
  S.muro.sort(function(a,b){return a.t-b.t;});
  // «Ti capisco» sui post-it (dalla 0.13.0): un documento per post-it e persona, così due tocchi insieme non si perdono
  (Array.isArray(raw.capisco)?raw.capisco:[]).forEach(function(x){
    if(!x||typeof x!=='object'||!x.w||!x.p)return;
    var o={id:str(x.id,40)||idCapisco(str(x.w,40),str(x.p,24)),w:str(x.w,40),p:str(x.p,24),t:toInt(x.t)};
    S.capisco.push(tieniAltro(x,o,NOTI.capisco));
  });
  S.capisco.sort(function(a,b){return a.t-b.t;});
  // verifiche del mese: la «foto» dei soldi del locale in quel momento
  (Array.isArray(raw.verifiche)?raw.verifiche:[]).forEach(function(x){
    if(!x||typeof x!=='object'||!(toInt(x.t)>0))return;
    var o={id:str(x.id,40)||('k'+S.verifiche.length),t:toInt(x.t)};
    ['cassa','scorte','incassare','restituire','previsionale','fondo'].forEach(function(k){o[k]=toInt(x[k]);});
    if(x.nota)o.nota=str(x.nota,120);
    if(x.da)o.da=str(x.da,24);
    S.verifiche.push(tieniAltro(x,o,NOTI.verifiche));
  });
  S.verifiche.sort(function(a,b){return a.t-b.t;});
  var me=raw.meta&&typeof raw.meta==='object'?raw.meta:{};
  S.meta={created:toInt(me.created),rev:toInt(me.rev),saved:toInt(me.saved),exported:toInt(me.exported),img0:str(me.img0,200),cal0:str(me.cal0,200),sint0:str(me.sint0,2000),elena0:me.elena0?1:0};
  return S;
}
/* ---------- sincronizzazione tra telefoni (parte pura) ----------
   Ogni cosa segnata è un'«entità» con chiave «raccolta~id». SY.ent[chiave] = [u, impronta, confermata]:
   u = ora della modifica (vince la più recente), impronta = hash del JSON canonico ('-' = cancellata). */
var COLS=['people','products','moves','shop','votes','games','trash','cleanings','quote','muro','capisco','verifiche'];
function canon(v){
  if(Array.isArray(v))return '['+v.map(canon).join(',')+']';
  if(v&&typeof v==='object')return '{'+Object.keys(v).sort().filter(function(k){return v[k]!==undefined;}).map(function(k){return JSON.stringify(k)+':'+canon(v[k]);}).join(',')+'}';
  return JSON.stringify(v===undefined?null:v);
}
function hashStr(s){var h=0x811c9dc5;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193);}return (h>>>0).toString(36)+'.'+s.length.toString(36);}
function entita(S){
  var out=[];
  COLS.forEach(function(c){(S[c]||[]).forEach(function(e){if(e&&e.id)out.push({k:c+'~'+e.id,c:c,i:e.id,e:e});});});
  out.push({k:'cfg~main',c:'cfg',i:'main',e:S.cfg});
  return out;
}
/* cosa va mandato: entità nuove, cambiate o non ancora confermate, e lapidi per quelle tolte */
function syncDiff(S,SY){
  var w=[],vivi={};
  entita(S).forEach(function(x){
    var j=canon(x.e),h=hashStr(j),loc=SY.ent[x.k];vivi[x.k]=1;
    if(!loc||loc[1]!==h||!loc[2])w.push({key:x.k,c:x.c,i:x.i,j:j,h:h});
  });
  Object.keys(SY.ent).forEach(function(k){
    if(vivi[k])return;
    var loc=SY.ent[k],p=k.split('~');
    if(loc[1]!=='-'||!loc[2])w.push({key:k,c:p[0],i:p.slice(1).join('~'),j:null,h:'-'});
  });
  return w;
}
function normEnt(c,e){
  if(c==='cfg')return normCfg(e);
  var raw={people:[],products:[],moves:[],shop:[],votes:[],games:[],trash:[],cleanings:[],quote:[],muro:[],capisco:[],verifiche:[]};
  raw[c]=[e];
  var st=normState(raw);
  return st&&st[c]&&st[c][0]||null;
}
function perT(a,b){return (a.t||0)-(b.t||0);}
/* app aggiornata: le copie già confermate che cambiano solo di forma (normalizzazione nuova) NON si rimandano,
   perché una copia impoverita da una versione vecchia cancellerebbe dati veri sugli altri telefoni.
   Si segnano «da rileggere» e si rilegge tutto il locale: per la stessa scrittura vince il server. */
/* Rilettura completa solo per chi arriva da una versione più vecchia di RILEGGI_DAL: rileggere tutto costa una lettura
   per documento e per telefono (quota gratuita di Firebase: 50.000 al giorno). Va alzata alla versione che si pubblica
   quando una versione cambia il formato di un campo che esiste già (come i sintomi della 0.5.0). */
var RILEGGI_DAL='0.19.0';
function versionePrima(a,b){
  var x=String(a||'0').split('.'),y=String(b||'0').split('.');
  for(var i=0;i<3;i++){var d=(+x[i]||0)-(+y[i]||0);if(d)return d<0;}
  return false;
}
function syncNuovaVersione(S,SY,ver){
  if(SY.ver===ver)return false;
  var rilegge=versionePrima(SY.ver,RILEGGI_DAL);
  var h={};entita(S).forEach(function(x){h[x.k]=hashStr(canon(x.e));});
  Object.keys(SY.ent).forEach(function(k){
    var e=SY.ent[k];
    if(!e||!e[2]||!(k in h))return;   // in coda: si manda come sempre; tolta qui: lapide come sempre
    e[1]=h[k];if(rilegge)e[3]='r';
  });
  SY.ver=ver;
  if(rilegge&&SY.init)SY.cursor=0;
  return true;
}
/* Protezione dalle cancellazioni a catena. Le cose che il registro dà per ricevute ma che mancano nei dati
   (un salvataggio fallito, dati del telefono persi) diventerebbero lapidi per tutti i telefoni. Se sono più di «soglia»
   non è una cancellazione fatta da qualcuno: le tolgo dal registro e rileggo tutto, così tornano dal server. */
var SOGLIA_LAPIDI=20;
function syncMancanti(S,SY){
  var vivi={};entita(S).forEach(function(x){vivi[x.k]=1;});
  return Object.keys(SY.ent).filter(function(k){var e=SY.ent[k];return !vivi[k]&&e&&e[1]!=='-'&&e[2];});
}
function syncRipara(S,SY,soglia){
  if(!SY.init)return 0;
  var m=syncMancanti(S,SY);
  if(m.length<=soglia)return 0;
  m.forEach(function(k){delete SY.ent[k];});
  SY.cursor=0;
  return m.length;
}
/* applica le modifiche arrivate dagli altri telefoni, sul posto. Alla prima unione (init) vince il locale condiviso. */
function syncApply(S,changes,SY,init){
  var changed=false;
  changes.forEach(function(ch){
    if(!ch||typeof ch.key!=='string')return;
    var key=ch.key,loc=SY.ent[key],hr=ch.j==null?'-':hashStr(ch.j),rilegge=!!(loc&&loc[3]==='r');
    if(loc&&loc[0]===ch.u&&loc[1]===hr){loc[2]=1;if(rilegge)loc.length=3;return;}
    // da rileggere (nuova versione): per la stessa scrittura vale la copia del server
    if(!init&&loc&&(loc[0]>ch.u||(!rilegge&&loc[0]===ch.u&&loc[1]>hr)))return;
    var c=ch.c,id=ch.i,hn=hr;
    if(c==='cfg'){
      if(ch.j==null)return;
      var cf;try{cf=normCfg(JSON.parse(ch.j));}catch(x){return;}
      S.cfg=cf;hn=hashStr(canon(cf));changed=true;
    }else if(COLS.indexOf(c)>=0&&typeof id==='string'){
      var arr=S[c],pos=-1;
      for(var i=0;i<arr.length;i++)if(arr[i].id===id){pos=i;break;}
      if(ch.j==null){if(pos>=0){arr.splice(pos,1);changed=true;}}
      else{
        var e=null;try{e=normEnt(c,JSON.parse(ch.j));}catch(x){e=null;}
        if(!e||e.id!==id)return;
        if(pos>=0)arr[pos]=e;else arr.push(e);
        hn=hashStr(canon(e));changed=true;
      }
    }else return;
    SY.ent[key]=[ch.u,hn,1];
  });
  if(changed){
    S.moves.sort(perT);S.votes.sort(perT);S.games.sort(perT);S.cleanings.sort(perT);S.muro.sort(perT);S.capisco.sort(perT);S.verifiche.sort(perT);
    S.quote.sort(function(a,b){return a.mese<b.mese?-1:a.mese>b.mese?1:0;});
    S.trash.sort(function(a,b){return a.s<b.s?-1:a.s>b.s?1:0;});
  }
  return changed;
}
/* ---------- muroblio (dalla 0.13.0) ---------- */
function idCapisco(w,p){return 'k'+hashStr(w+'|'+p);}
/* chi ha detto «Ti capisco» a un post-it, nell'ordine */
function capiti(S,w){return (S.capisco||[]).filter(function(c){return c.w===w;}).map(function(c){return c.p;});}
/* il muro come si mostra: prima i fissati, poi dal più nuovo */
function muroOrdinato(S){
  var l=S.muro.slice().reverse();
  return l.filter(function(w){return w.fis;}).concat(l.filter(function(w){return !w.fis;}));
}
/* freccette: il tiro consigliato per chiudere a zero con le freccette rimaste del turno (chiusura libera) */
var ORDINE_TIRI=(function(){
  var o=[],n;
  for(n=20;n>=1;n--)o.push('T'+n);
  o.push('D25','S25');
  for(n=20;n>=1;n--)o.push('D'+n);
  for(n=20;n>=1;n--)o.push('S'+n);
  return o;
})();
function unTiro(v){
  if(v<=0)return null;
  if(v<=20)return 'S'+v;
  if(v===25)return 'S25';
  if(v===50)return 'D25';
  if(v%2===0&&v<=40)return 'D'+v/2;
  if(v%3===0&&v<=60)return 'T'+v/3;
  return null;
}
function chiusuraX01(left,freccette){
  if(!(left>0)||left>180||!(freccette>0))return null;
  function cerca(v,k){
    var u=unTiro(v);if(u)return [u];
    if(k<2)return null;
    for(var i=0;i<ORDINE_TIRI.length;i++){
      var c=ORDINE_TIRI[i],r=v-dartVal(c).v;
      if(r<=0)continue;
      var resto=cerca(r,k-1);if(resto)return [c].concat(resto);
    }
    return null;
  }
  for(var k=1;k<=Math.min(3,freccette);k++){var r=cerca(left,k);if(r&&r.length===k)return r;}
  return null;
}
/* riepilogo di una serata: consumi, soldi entrati in cassa, triage e freccette. null se non è successo niente */
function riepilogoSerata(S,k,cut){
  var R={k:k,eur:0,pz:0,graffi:0,cassa:0,prod:{},chi:{},partite:0,vinte:{},podio:[],winners:[]};
  S.moves.forEach(function(m){
    if(!m||m.x||!m.t||serata(m.t,cut)!==k)return;
    var a=Math.max(0,toInt(m.a));
    if(m.k==='sale'||m.k==='tab'){
      R.eur+=a;if(m.k==='tab')R.graffi+=a;else R.cassa+=a;
      (m.items||[]).forEach(function(it){if(!it)return;var q=Math.max(0,toInt(it.q)),n=it.n||'?';R.pz+=q;R.prod[n]=(R.prod[n]||0)+q;if(m.p)R.chi[m.p]=(R.chi[m.p]||0)+q;});
    }else if(m.k==='pay'||m.k==='in')R.cassa+=a;
  });
  S.games.forEach(function(g){
    if(g.x||g.ab||serata(g.t,cut)!==k)return;
    var st=playDarts(g);if(!st.win)return;
    R.partite++;if(g.players.length>1)R.vinte[st.win]=(R.vinte[st.win]||0)+1;
  });
  var vv=S.votes.filter(function(v){return v.s===k&&votoConta(S,v);});
  if(vv.length){var sm=voteSummary(vv);R.winners=sm.winners;R.podio=podioSerata(sm).filter(function(x){return x.pos<=3;});}
  function top(o){return Object.keys(o).sort(function(a,b){return o[b]-o[a]||(a<b?-1:1);});}
  R.topProd=top(R.prod).slice(0,3).map(function(n){return {n:n,q:R.prod[n]};});
  var tc=top(R.chi);R.beve=tc.length?{p:tc[0],q:R.chi[tc[0]]}:null;
  var tv=top(R.vinte);R.freccia=tv.length?{p:tv[0],n:R.vinte[tv[0]]}:null;
  if(!R.eur&&!R.cassa&&!R.partite&&!R.winners.length)return null;
  return R;
}
/* ---------- copia automatica cifrata (dalla 0.21.0) ----------
   Ogni notte GitHub salva una copia del database del locale (scripts/backup.js). Il repository è pubblico, quindi la
   copia è cifrata con una password (AES-GCM, chiave da PBKDF2-SHA256). Le stesse funzioni cifrano lì e decifrano qui. */
var CIFRA_ITER=250000;
function b64da(u8){var s='';for(var i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return btoa(s);}
function b64a(t){var s=atob(t),u=new Uint8Array(s.length);for(var i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u;}
function chiaveBackup(pw,salt,iter){
  var C=crypto.subtle;
  return C.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveKey']).then(function(k){
    return C.deriveKey({name:'PBKDF2',salt:salt,iterations:iter,hash:'SHA-256'},k,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  });
}
// eslint-disable-next-line no-unused-vars -- la usa scripts/backup.js (e le prove), non l app
function cifraBackup(txt,pw){
  var salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  return chiaveBackup(pw,salt,CIFRA_ITER).then(function(k){
    return crypto.subtle.encrypt({name:'AES-GCM',iv:iv},k,new TextEncoder().encode(txt));
  }).then(function(d){return {kdf:'PBKDF2-SHA256',iter:CIFRA_ITER,salt:b64da(salt),iv:b64da(iv),dati:b64da(new Uint8Array(d))};});
}
/* restituisce il testo del backup, o null se la password è sbagliata o il file è rovinato */
function decifraBackup(c,pw){
  try{
    var iter=+c.iter||0;if(!(iter>=1000&&iter<=5000000))return Promise.resolve(null);
    var iv=b64a(c.iv),dati=b64a(c.dati);
    return chiaveBackup(pw,b64a(c.salt),iter).then(function(k){
      return crypto.subtle.decrypt({name:'AES-GCM',iv:iv},k,dati);
    }).then(function(d){return new TextDecoder().decode(d);},function(){return null;});
  }catch(e){return Promise.resolve(null);}
}
/* =================== END PURE =================== */

/* ---------- ambiente ---------- */
var IN_CLAUDE=!!(window.claude&&typeof window.claude.use==='function');
var IOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
function installata(){try{return window.navigator.standalone===true||window.matchMedia('(display-mode: standalone)').matches;}catch(e){return false;}}
var KEY='oblio.v1';
var GIORNI=['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];
var GIORNI3=['dom','lun','mar','mer','gio','ven','sab'];
var MESI=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
var CATS_SPESA=['Rifornimento bar','Affitto','Bollette','Pulizie','Attrezzatura','Altro'];
var EUR=new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'});
function eur(c){return EUR.format((c||0)/100);}
function eurS(c){return (c>0?'+':c<0?'−':'')+EUR.format(Math.abs(c||0)/100);}
function c2s(c){return (Math.abs(c||0)/100).toFixed(2).replace('.',',');}
function today(){return ymd(new Date());}
function dLong(dt){return GIORNI[dt.getDay()]+' '+dt.getDate()+' '+MESI[dt.getMonth()];}
function relDay(key){
  var now=new Date();if(key===ymd(now))return 'Oggi';
  var y=new Date(now.getFullYear(),now.getMonth(),now.getDate()-1,12);if(key===ymd(y))return 'Ieri';
  var p=key.split('-');return dLong(new Date(+p[0],+p[1]-1,+p[2],12));
}
function hm(t){var d=new Date(t);return pad(d.getHours())+':'+pad(d.getMinutes());}
function rid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
function keyDate(key){var p=key.split('-');return new Date(+p[0],+p[1]-1,+p[2],12);}
function openKey(){return serata(Date.now(),S.cfg.voteCut);}
function chiusuraTxt(){var c=S.cfg.voteCut;return c===0?'a mezzanotte':'alle '+c+':00';}
function nomeSerata(key){
  var ok=openKey();
  if(key===ok)return 'stasera';
  var d=keyDate(ok);
  if(key===ymd(new Date(d.getFullYear(),d.getMonth(),d.getDate()-1,12)))return 'ieri sera';
  return 'serata di '+dLong(keyDate(key)).toLowerCase();
}
function dShort(key){var d=keyDate(key);return GIORNI3[d.getDay()]+' '+d.getDate()+'/'+(d.getMonth()+1);}
function dShortT(t){var d=new Date(t);return d.getDate()+'/'+(d.getMonth()+1)+(d.getFullYear()!==new Date().getFullYear()?'/'+d.getFullYear():'');}
function dataBreve(key){var p=String(key).split('-');return (+p[2])+' '+MESI[+p[1]-1];}
function serataFutura(key){
  var d=keyDate(openKey());
  if(key===ymd(new Date(d.getFullYear(),d.getMonth(),d.getDate()+1,12)))return 'domani sera';
  return dLong(keyDate(key)).toLowerCase()+' sera';
}
function meseNome(ym){return MESI[+ym.slice(5,7)-1]+' '+ym.slice(0,4);}
function numIt(n,dec){return n.toFixed(dec).replace('.',',');}

/* ---------- DOM ---------- */
function $(s,r){return (r||document).querySelector(s);}
var PROPS={value:1,checked:1,disabled:1,hidden:1,selected:1};
function put(el,kids){
  kids.forEach(function(c){
    if(c==null||c===false||c===true)return;
    if(Array.isArray(c))put(el,c);
    else el.append(c.nodeType?c:document.createTextNode(String(c)));
  });
  return el;
}
function h(tag,props){
  var el=document.createElement(tag),late=[],k,v;
  if(props)for(k in props){
    v=props[k];
    if(v==null||v===false)continue;
    if(k==='class')el.className=v;
    else if(k.slice(0,2)==='on')el.addEventListener(k.slice(2),v);
    else if(PROPS[k])late.push(k);
    else el.setAttribute(k,v===true?'':String(v));
  }
  put(el,Array.prototype.slice.call(arguments,2));
  late.forEach(function(x){el[x]=props[x];});
  return el;
}
function frag(nodes){var f=document.createDocumentFragment();put(f,[nodes]);return f;}
var IC={
  croce:'<path d="M3 11l9-7 9 7"/><path d="M5 9.5V20h14V9.5"/><path d="M12 11v6M9 14h6"/>',
  bicchiere:'<path d="M4 4h16l-8 9z"/><path d="M12 13v7"/><path d="M8 20h8"/><circle cx="14.5" cy="6.5" r="1"/>',
  tacche:'<path d="M6 5v14M10 5v14M14 5v14M18 5v14M3 16.5L21 7.5"/>',
  cassa:'<rect x="3" y="7" width="18" height="11" rx="2"/><circle cx="12" cy="12.5" r="2.6"/>',
  altro:'<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
  bersaglio:'<circle cx="11" cy="13" r="8"/><circle cx="11" cy="13" r="3.5"/><path d="M11 13l9-9"/><path d="M17 4h3v3"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  avanti:'<path d="M9 6l6 6-6 6"/>',
  indietro:'<path d="M15 6l-6 6 6 6"/>',
  scontrino:'<path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  // 0.8: icone delle voci e delle schede (stesso tratto delle schede in basso)
  andamento:'<path d="M4 19.5h16"/><path d="M5 15l4-4 3 3 6-6.5"/><path d="M14.5 7.5H18v3.5"/>',
  casa:'<path d="M4 11l8-6.5 8 6.5"/><path d="M6.5 9.5V19.5h11V9.5"/><path d="M10 19.5v-5h4v5"/>',
  scatola:'<path d="M3.5 8L12 4l8.5 4v8.5L12 20.5 3.5 16.5z"/><path d="M3.5 8L12 12l8.5-4M12 12v8.5"/>',
  podio:'<path d="M9 20V9h6v11"/><path d="M3 20v-6h6M15 20v-8h6v8"/><path d="M2 20h20"/>',
  barre:'<path d="M5 20v-7M10 20V6M15 20v-9M20 20V9"/>',
  medaglia:'<circle cx="12" cy="15" r="5"/><path d="M9 10.6L6.5 3.5h3.8L12 8l1.7-4.5h3.8L15 10.6"/>',
  postit:'<path d="M5 4h14v10l-6 6H5z"/><path d="M13 20v-6h6"/>',
  telefono:'<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  libro:'<path d="M4 4.5C4 3.7 4.7 3 5.5 3H19v16H5.5C4.7 19 4 19.7 4 20.5z"/><path d="M4 20.5c0 .8.7 1.5 1.5 1.5H19"/>',
  nuvola:'<path d="M7 18a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.2A3.8 3.8 0 0 1 17 18"/><path d="M12 12.5v8M9 15.5l3-3 3 3"/>',
  scarica:'<path d="M12 3v11M8 10l4 4 4-4"/><path d="M5 17v3h14v-3"/>',
  lucchetto:'<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  etichetta:'<path d="M3.5 12.5v-8h8l9 9-8 8z"/><circle cx="8" cy="9" r="1.4"/>',
  persone:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.8 3-6 6-6s5.4 2.2 6 6"/><path d="M15.5 4.8a3.2 3.2 0 0 1 0 6.4M17.5 14.3c2 .8 3.2 2.8 3.5 5.7"/>',
  cursori:'<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  torta:'<path d="M4 20h16v-7.5H4z"/><path d="M4 15.5c1.4 1.3 2.6 1.3 4 0s2.6-1.3 4 0 2.6 1.3 4 0 2.6-1.3 4 0"/><path d="M12 12.5v-4"/><path d="M12 5.8c-.9-.8-.9-2.1 0-3.1.9 1 .9 2.3 0 3.1z"/>',
  chiave:'<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16.5 6.5l2.5 2.5M14 9l2 2"/>',
  registro:'<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  piu:'<path d="M12 5v14M5 12h14"/>',
  meno:'<path d="M5 12h14"/>',
  sacco:'<path d="M8 6.5h8"/><path d="M9.5 6.5L8.5 3.5h7l-1 3"/><path d="M7 8h10l1.2 12.5H5.8z"/>',
  scopa:'<path d="M15 3.5L10.5 11"/><path d="M6 11h9l1.5 9.5h-12z"/><path d="M8.5 15v5.5M12 15v5.5"/>',
  orologio:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  avviso:'<path d="M12 3.5l9 16H3z"/><path d="M12 10v4.5M12 17.5h.01"/>',
  rete:'<path d="M2.5 9a14 14 0 0 1 19 0"/><path d="M5.5 12.5a9.5 9.5 0 0 1 13 0"/><path d="M9 16a4.6 4.6 0 0 1 6 0"/><path d="M12 19.5h.01"/>',
  esci:'<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>'
};
function ic(n,s){
  var e=document.createElement('span');e.className='ic';e.setAttribute('aria-hidden','true');
  e.innerHTML='<svg viewBox="0 0 24 24" width="'+(s||24)+'" height="'+(s||24)+'" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+IC[n]+'</svg>';
  return e;
}
function tally(n,max){
  n=toInt(n);max=max||40;var shown=Math.min(n,max);if(shown<=0)return null;
  var box=document.createElement('span');box.className='tally';box.setAttribute('role','img');
  box.setAttribute('aria-label',n+(n===1?' graffio aperto':' graffi aperti'));
  var html='',g,i,k,p,w,x,j;
  for(g=0;g*5<shown;g++){
    k=Math.min(5,shown-g*5);p='';
    for(i=0;i<Math.min(k,4);i++){x=4+i*5.4;j=(((g*5+i)*7)%5-2)*0.35;p+='<path d="M'+(x+j).toFixed(1)+' 3.5L'+(x-j).toFixed(1)+' 20.5"/>';}
    if(k===5)p+='<path d="M1.5 17.5L25.5 6"/>';
    w=k===5?27:(8+(k-1)*5.4);
    html+='<svg viewBox="0 0 '+w.toFixed(1)+' 24" width="'+w.toFixed(1)+'" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">'+p+'</svg>';
  }
  if(n>max)html+='<b>+'+(n-max)+'</b>';
  box.innerHTML=html;return box;
}

/* ---------- stato ---------- */
var S,D,storageOk=true,liveSheet=null,toastTimer=0,installEvt=null;
var UI={tab:'reparto',sub:null,pos:{p:null,qty:{},extra:[]},filter:'tutto',limit:40,per:'mese',aperte:{},dart:{mode:'501',players:[],mol:1,vista:null}};
/* Dalla 0.20.0 i dati grandi (stato, registro della sincronizzazione, copie di riserva) stanno in IndexedDB, che ha
   spazio per centinaia di MB; localStorage (circa 5 MB) tiene solo le cose piccole. All'avvio i dati grandi si leggono
   tutti in memoria (BIG.mem), così lsGet resta immediato; le scritture partono in coda, una transazione alla volta.
   Se una transazione fallisce, il suo lotto si fonde con il successivo: il registro non viene mai salvato senza
   i dati scritti insieme a lui. Senza IndexedDB tutto resta in localStorage come prima. */
var BIGK={};BIGK[KEY]=1;BIGK[KEY+'.sync']=1;BIGK[KEY+'.snap']=1;BIGK[KEY+'.rotto']=1;
var BIG=null;
function lsGet(k){
  if(BIG&&BIGK[k])return Object.prototype.hasOwnProperty.call(BIG.mem,k)?BIG.mem[k]:null;
  try{return localStorage.getItem(k);}catch(e){storageOk=false;return null;}
}
function lsSet(k,v){
  if(BIG&&BIGK[k]){BIG.mem[k]=v;BIG.coda[k]=v;bigScrivi();return BIG.ok;}
  try{localStorage.setItem(k,v);return true;}catch(e){storageOk=false;return false;}
}
function lsDel(k){
  if(BIG&&BIGK[k]){delete BIG.mem[k];BIG.coda[k]=null;bigScrivi();return;}
  try{localStorage.removeItem(k);}catch(e){}
}
function bigScrivi(){
  if(BIG.inVolo||BIG.pronta)return;
  BIG.pronta=true;
  Promise.resolve().then(function(){
    BIG.pronta=false;
    var lotto=BIG.coda,chiavi=Object.keys(lotto),chiuso=false;
    if(!chiavi.length)return;
    BIG.coda={};BIG.inVolo=true;
    function fine(ok){
      if(chiuso)return;chiuso=true;BIG.inVolo=false;
      if(!ok)chiavi.forEach(function(k){if(!(k in BIG.coda))BIG.coda[k]=lotto[k];});
      if(BIG.ok!==ok){BIG.ok=ok;storageOk=ok;if(S)renderSoon();}
      if(Object.keys(BIG.coda).length){if(ok)bigScrivi();else setTimeout(function(){if(!BIG.inVolo)bigScrivi();},5000);}
    }
    try{
      var tx=BIG.db.transaction('kv','readwrite'),st=tx.objectStore('kv');
      chiavi.forEach(function(k){if(lotto[k]==null)st.delete(k);else st.put(lotto[k],k);});
      tx.oncomplete=function(){fine(true);};
      tx.onabort=tx.onerror=function(){fine(false);};
    }catch(e){fine(false);}
  });
}
/* apre IndexedDB, legge i dati grandi e, la prima volta, li sposta da localStorage. cb() parte comunque:
   se IndexedDB non c'è o non risponde entro 4 secondi, si resta su localStorage. */
function bigApri(cb){
  var fatto=false,timer=0;
  function via(db){
    if(fatto){if(db)try{db.close();}catch(e){}return;}
    fatto=true;clearTimeout(timer);
    if(!db){cb();return;}
    var mem={},chiavi=Object.keys(BIGK);
    try{
      var tx=db.transaction('kv','readonly'),st=tx.objectStore('kv');
      chiavi.forEach(function(k){var r=st.get(k);r.onsuccess=function(){if(typeof r.result==='string')mem[k]=r.result;};});
      tx.oncomplete=function(){trasloca(db,mem);};
      tx.onabort=tx.onerror=function(){try{db.close();}catch(e){}cb();};
    }catch(e){try{db.close();}catch(x){}cb();}
  }
  function trasloca(db,mem){
    var ls=null;try{ls=localStorage.getItem(KEY);}catch(e){}
    if(ls==null){BIG={db:db,mem:mem,coda:{},ok:true,inVolo:false,pronta:false};cb();return;}
    // dati in localStorage: sono i più recenti (dopo il trasloco non ci restano), quindi vincono su quelli di IndexedDB
    var dal={};Object.keys(BIGK).forEach(function(k){var v=null;try{v=localStorage.getItem(k);}catch(e){}dal[k]=v;});
    try{
      var tx=db.transaction('kv','readwrite'),st=tx.objectStore('kv');
      Object.keys(dal).forEach(function(k){
        if(dal[k]!=null){st.put(dal[k],k);mem[k]=dal[k];}
        else if(k===KEY+'.sync'){st.delete(k);delete mem[k];}   // il registro va sempre insieme ai suoi dati
      });
      tx.oncomplete=function(){
        Object.keys(dal).forEach(function(k){if(dal[k]!=null)try{localStorage.removeItem(k);}catch(e){}});
        BIG={db:db,mem:mem,coda:{},ok:true,inVolo:false,pronta:false};cb();
      };
      tx.onabort=tx.onerror=function(){try{db.close();}catch(e){}cb();};
    }catch(e){try{db.close();}catch(x){}cb();}
  }
  function apri(ver){
    var r;
    try{r=ver?indexedDB.open('oblio',ver):indexedDB.open('oblio');}catch(e){via(null);return;}
    r.onupgradeneeded=function(){var db=r.result;if(!db.objectStoreNames.contains('kv'))db.createObjectStore('kv');};
    r.onsuccess=function(){
      var db=r.result;
      if(!db.objectStoreNames.contains('kv')){var v=db.version+1;db.close();apri(v);return;}
      db.onversionchange=function(){try{db.close();}catch(e){}};
      via(db);
    };
    r.onerror=r.onblocked=function(){via(null);};
  }
  if(IN_CLAUDE||typeof indexedDB==='undefined'){cb();return;}
  timer=setTimeout(function(){via(null);},4000);
  apri(0);
}
function loadState(){
  var raw=lsGet(KEY);
  if(raw){try{var st=normState(JSON.parse(raw));if(st)return st;}catch(e){}}
  return null;
}
function persist(){
  S.meta.rev=(S.meta.rev||0)+1;S.meta.saved=Date.now();
  var last=+lsGet(KEY+'.snapT')||0;
  if(Date.now()-last>20*3600*1000){var cur=lsGet(KEY);if(cur){lsSet(KEY+'.snap',cur);lsSet(KEY+'.snapT',String(Date.now()));}}
  storageOk=lsSet(KEY,JSON.stringify(S));
}
function commit(){persist();D=derive(S);render();syncSpingi();}

/* ---------- sincronizzazione tra telefoni ---------- */
var SYNC=null,SY=null,remote=null,DEV='',syncTimer=0,inVolo={},stopAscolto=null,lapidiOk=false;
var SST={stato:'spento',errore:'',ultimo:0,attesa:0};   // spento · collego · ok · attesa · errore
var SDK='https://www.gstatic.com/firebasejs/10.12.2/';
function syncCarica(){
  try{SY=JSON.parse(lsGet(KEY+'.sync')||'null');}catch(e){SY=null;}
  if(!SY||typeof SY!=='object'||!SY.ent||typeof SY.ent!=='object')SY={cursor:0,init:false,ent:{},ver:APP_V};
  devId();
}
// il registro si salva solo se anche i dati sono salvati: un registro più avanti dei dati farebbe partire lapidi
function syncSalva(){if(storageOk)lsSet(KEY+'.sync',JSON.stringify(SY));}
function errTesto(e){if(!e)return 'errore sconosciuto';return (e.code?e.code+': ':'')+String(e.message||e).slice(0,200);}
function remoteFirestore(cfg){
  return Promise.all([import(SDK+'firebase-app.js'),import(SDK+'firebase-firestore.js')]).then(function(m){
    var A=m[0],F=m[1];
    var app=A.initializeApp(cfg.firebase);
    var db=F.getFirestore(app);
    var col=F.collection(db,'locali',cfg.room,'e');
    return {
      write:function(key,d){return F.setDoc(F.doc(col,key),{c:d.c,i:d.i,j:d.j,u:d.u,by:d.by,s:F.serverTimestamp()});},
      subscribe:function(since,onCh,onErr){
        var q=F.query(col,F.where('s','>',F.Timestamp.fromMillis(Math.max(0,since-120000))));
        return F.onSnapshot(q,function(snap){
          var out=[];
          snap.docChanges().forEach(function(ch){
            // le mie scritture non ancora confermate dal server non contano: la conferma arriva da setDoc
            if(ch.type==='removed'||ch.doc.metadata.hasPendingWrites)return;
            var d=ch.doc.data({serverTimestamps:'none'});
            out.push({key:ch.doc.id,c:d.c,i:d.i,j:d.j==null?null:d.j,u:d.u,by:d.by,s:d.s&&d.s.toMillis?d.s.toMillis():0});
          });
          onCh(out,snap.metadata.fromCache);
        },onErr);
      }
    };
  });
}
/* solo per le prove automatiche: un finto server locale al posto di Firebase */
function remoteMock(cfg){
  var url=cfg.mock;
  return Promise.resolve({
    write:function(key,d){
      return fetch(url+'w',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({room:cfg.room,key:key,c:d.c,i:d.i,j:d.j,u:d.u,by:d.by})})
        .then(function(r){if(!r.ok)throw new Error('scrittura rifiutata');});
    },
    subscribe:function(since,onCh,onErr){
      var stop=false,cur=since,primo=true;
      (function giro(){
        if(stop)return;
        fetch(url+'r?room='+encodeURIComponent(cfg.room)+'&since='+cur).then(function(r){return r.json();}).then(function(list){
          list.forEach(function(x){if(x.s>cur)cur=x.s;});
          if(list.length||primo){primo=false;onCh(list,false);}
        }).catch(function(e){onErr(e);}).then(function(){setTimeout(giro,250);});
      })();
      return function(){stop=true;};
    }
  });
}
function syncAvvia(){
  SYNC=window.OBLIO_SYNC||null;
  if(!SYNC||!SYNC.room||IN_CLAUDE||(!SYNC.firebase&&!SYNC.mock))return;
  syncCarica();SST.stato='collego';
  if(syncRipara(S,SY,SOGLIA_LAPIDI))syncSalva();
  // se qualcosa è rimasto in coda (rete caduta), riprovo ogni tanto
  setInterval(function(){
    if(!remote||!SY||!SY.init)return;
    for(var k in SY.ent)if(!SY.ent[k][2]&&!inVolo[k]){syncSpingi(true);return;}
  },10000);
  (SYNC.mock?remoteMock(SYNC):remoteFirestore(SYNC)).then(function(r){
    remote=r;
    ascolta();
  },function(e){SST.stato='errore';SST.errore='Non riesco a caricare la sincronizzazione ('+(e&&e.message||e)+'). Riprovo alla prossima apertura con internet.';statoSync();});
}
function ascolta(){
  if(stopAscolto){try{stopAscolto();}catch(e){}}
  stopAscolto=remote.subscribe(SY.init?SY.cursor:0,ricevi,function(e){SST.errore=errTesto(e);SST.stato=SY.init?'attesa':'errore';statoSync();});
}
function ricevi(changes,fromCache){
  if(fromCache&&!SY.init)return;   // prima di fondere aspetto i dati veri del locale
  var init=!SY.init;
  var cambiato=syncApply(S,changes,SY,init);
  if(init&&applyElena(S))cambiato=true;
  if(!fromCache&&segnaVisto())cambiato=true;
  if(!fromCache)setTimeout(rimpicciolisciFoto,3000);
  changes.forEach(function(ch){if(ch.s>SY.cursor)SY.cursor=ch.s;});
  if(init)SY.init=true;
  SST.errore='';SST.ultimo=Date.now();
  if(cambiato){storageOk=lsSet(KEY,JSON.stringify(S));D=derive(S);renderSoon();}
  syncSalva();
  syncSpingi(true);
}
function syncSpingi(subito){
  if(!remote||!SY||!SY.init){statoSync();return;}
  clearTimeout(syncTimer);
  syncTimer=setTimeout(function(){
    if(!lapidiOk&&syncRipara(S,SY,SOGLIA_LAPIDI)){syncSalva();ascolta();}
    lapidiOk=false;
    var w=syncDiff(S,SY);
    w.forEach(function(x){
      if(inVolo[x.key]===x.h)return;
      inVolo[x.key]=x.h;
      var prima=SY.ent[x.key],u=Math.max(Date.now(),prima?prima[0]+1:0);
      SY.ent[x.key]=[u,x.h,0];
      remote.write(x.key,{c:x.c,i:x.i,j:x.j,u:u,by:DEV}).then(function(){
        var e=SY.ent[x.key];if(e&&e[0]===u)e[2]=1;
        if(inVolo[x.key]===x.h)delete inVolo[x.key];
        SST.errore='';syncSalva();statoSync();
      },function(err){
        if(inVolo[x.key]===x.h)delete inVolo[x.key];
        SST.errore=errTesto(err);statoSync();
      });
    });
    syncSalva();statoSync();
  },subito?0:250);
}
function statoSync(){
  if(!SYNC||!remote&&SST.stato==='spento'){paintSync();return;}
  var att=0;Object.keys(SY.ent).forEach(function(k){if(!SY.ent[k][2])att++;});
  SST.attesa=att;
  if(!SY.init)SST.stato=SST.errore?'errore':'collego';
  else SST.stato=att?'attesa':'ok';
  paintSync();
  // la schermata «Chi sei?» aspetta il collegamento: quando arriva (o salta) si ridisegna
  var asp=loginAspetta();if(asp!==ASP_PRIMA){ASP_PRIMA=asp;if(!loggato())render();}
}
var ASP_PRIMA=null;
function loginAspetta(){return !!SYNC&&(SST.stato==='collego'||SST.stato==='errore');}
function syncTesto(){
  switch(SST.stato){
    case 'ok':return 'sincronizzati';
    case 'attesa':return SST.attesa+(SST.attesa===1?' modifica da inviare':' modifiche da inviare')+(navigator.onLine===false?' (senza rete)':'');
    case 'collego':return 'mi collego al locale…';
    case 'errore':return 'non collegati';
    default:return '';
  }
}
// etichetta corta nell'intestazione, al posto del pallino
function syncBreve(){
  switch(SST.stato){
    case 'ok':return 'Sincronizzato';
    case 'attesa':return SST.attesa+' da inviare';
    case 'collego':return 'Mi collego…';
    case 'errore':return 'Non collegati';
    default:return '';
  }
}
function paintSync(){
  var el=$('#sync');if(!el)return;
  var io=loggato()?mio():'',on=!!io||(!!SYNC&&SST.stato!=='spento');
  el.hidden=!on;
  if(!on)return;
  var st=SYNC?SST.stato:'spento';
  if(paintSync.prima==='attesa'&&st==='ok'){paintSync.inviato=Date.now();setTimeout(paintSync,1900);}
  paintSync.prima=st;
  var inv=st==='ok'&&Date.now()-(paintSync.inviato||0)<1800;
  el.className='sync-et '+st+(io?' nome-io':'')+(inv?' inviato':'')+(ospite()?' tocca':'');
  if(ospite()){el.onclick=openOspite;el.setAttribute('role','button');el.tabIndex=0;}
  else{el.onclick=null;el.removeAttribute('role');el.removeAttribute('tabindex');}
  // il nome di chi è entrato: verde collegato, giallo in coda, rosa non collegato
  el.textContent=io?pName(io)+(inv?' · inviato a tutti':st==='attesa'?' · '+SST.attesa+' da inviare':st==='errore'||st==='spento'?' · non collegato':''):syncBreve();
  el.setAttribute('aria-label',(io?pName(io)+'. ':'')+'Telefoni: '+(SYNC?syncTesto():'non collegati'));
  el.title='Telefoni: '+(SYNC?syncTesto():'non collegati')+(SST.errore?' · '+SST.errore:'');
  var r=$('#sync-riga');if(r)r.textContent=syncTesto();
  if(foglio&&foglio.open&&foglioT&&foglioT.textContent==='Telefoni collegati')refreshSheet();
}
function openSync(){
  var live=function(){
    var n=0,att=0;if(SY)Object.keys(SY.ent).forEach(function(k){n++;if(!SY.ent[k][2])att++;});
    return [
      h('dl',{class:'scheda'},
        h('dt',null,'Stato'),h('dd',{class:SST.stato==='errore'?'rosso':null},syncTesto()||'spenta'),
        SST.errore?[h('dt',null,'Errore'),h('dd',{class:'rosso'},SST.errore)]:null,
        h('dt',null,'Ultimo contatto'),h('dd',null,SST.ultimo?hm(SST.ultimo):'mai'),
        h('dt',null,'Cose condivise'),h('dd',null,String(n)),
        h('dt',null,'Da inviare'),h('dd',null,String(att)),
        h('dt',null,'Rete'),h('dd',null,navigator.onLine===false?'assente':'presente'),
        h('dt',null,'Telefono'),h('dd',null,DEV||'—'),
        h('dt',null,'Versione'),h('dd',null,APP_V)),
      h('p',{class:'aiuto'},'Se resta «non collegati» o «mi collego», manda uno screenshot di questa pagina.'),
      h('div',{class:'azioni'},h('button',{class:'pill',type:'button',onclick:function(){location.reload();}},'Ricarica l’app'))];
  };
  openSheet('Telefoni collegati',live(),live);
}
/* se arriva una modifica mentre si sta scrivendo in un campo, ridisegno dopo */
var renderRinviato=false;
function renderSoon(){
  var a=document.activeElement;
  if(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&a.type!=='checkbox'&&a.type!=='file'){
    if(!renderRinviato){renderRinviato=true;a.addEventListener('blur',function(){renderRinviato=false;setTimeout(render,0);},{once:true});}
    return;
  }
  render();
}
function people(all){return S.people.filter(function(p){return all||p.on;});}
function person(id){return S.people.find(function(x){return x.id===id;});}
// nomi da leggere: chi è salvato tutto in maiuscolo si mostra «Peppecarlo» (le sigle corte come PJ restano); il dato salvato resta com'è
function nomeVis(n){n=String(n==null?'':n);return n.length>3&&n===n.toUpperCase()&&n!==n.toLowerCase()?n.toLowerCase().replace(/(^|[\s'’-])(\S)/g,function(m,a,b){return a+b.toUpperCase();}):n;}
function nomeP(p){return nomeVis(p.name);}
function pName(id){var p=person(id);return p?nomeP(p):'Ex paziente';}
function isVisitor(id){var p=person(id);return !!p&&p.kind==='amico';}

/* ---------- facce ---------- */
function imgSrc(p,grande){
  if(!p||!p.img)return null;
  if(CARIC.indexOf(p.img)>=0)return 'img/'+p.img+(grande?'.jpg':'-viso.jpg');
  return p.img;
}
var TINTE=['#FF4D97','#FF7A1A','#9BE22D','#FFD23F','#C9B6F0','#8FB3A4'];
function iniziali(n){n=String(n||'?').trim();var w=n.split(/\s+/);return (w.length>1?w[0].charAt(0)+w[1].charAt(0):n.slice(0,2)).toUpperCase();}
function ava(id,cls){
  var p=person(id),src=imgSrc(p),c='ava'+(cls?' '+cls:'');
  if(src)return h('img',{class:c,src:src,alt:'',decoding:'async'});
  var nm=p?p.name:'?',k=0;
  for(var i=0;i<nm.length;i++)k=(k*31+nm.charCodeAt(i))>>>0;
  return h('span',{class:c+' iniz',style:'background:'+TINTE[k%TINTE.length],'aria-hidden':'true'},iniziali(nm));
}
/* foto profilo: quadrata, 176 px (il cerchio più grande è 84 px, 168 sugli schermi fitti), circa 15-25 KB.
   Fino alla 0.19.0 erano 256 px e pesavano circa 60 KB l'una su ogni telefono. */
var FOTO_PX=176,FOTO_Q=0.72,FOTO_GRANDE=36000;
function riduciImg(src,ritaglia,cb,fine){
  var im=new Image();
  im.onload=function(){
    try{
      var w=im.naturalWidth,hh=im.naturalHeight,s=Math.min(w,hh),c=document.createElement('canvas');
      c.width=c.height=FOTO_PX;
      c.getContext('2d').drawImage(im,(w-s)/2,ritaglia?(hh-s)*0.3:(hh-s)/2,s,s,0,0,FOTO_PX,FOTO_PX);
      if(fine)fine();cb(c.toDataURL('image/jpeg',FOTO_Q));
    }catch(e){if(fine)fine();cb(null);}
  };
  im.onerror=function(){if(fine)fine();cb(null);};
  im.src=src;
}
function riduciFoto(f,cb){
  var url;
  try{url=URL.createObjectURL(f);}catch(e){cb(null);return;}
  riduciImg(url,true,cb,function(){URL.revokeObjectURL(url);});
}
/* le foto grandi di prima le rimpicciolisce un telefono solo: quello della persona, o quello dell'admin per chi
   non ha l'app. Una per volta, al massimo una volta per apertura. */
var fotoFatte={};
function rimpicciolisciFoto(){
  if(!SY||!SY.init)return;
  var io=mio(),adm=isAdmin();
  var p=S.people.find(function(x){
    return !fotoFatte[x.id]&&/^data:image\//.test(x.img||'')&&x.img.length>FOTO_GRANDE&&(x.id===io||(adm&&!haApp(x)));
  });
  if(!p)return;
  fotoFatte[p.id]=1;
  var prima=p.img;
  riduciImg(prima,false,function(nuova){
    var q=person(p.id);
    if(nuova&&q&&q.img===prima&&nuova.length<prima.length*0.8){q.img=nuova;persist();D=derive(S);renderSoon();syncSpingi();}
    setTimeout(rimpicciolisciFoto,500);
  });
}
function sceltaFaccia(p){
  var val=p?p.img:'',box=h('div',{class:'galleria',role:'group','aria-label':'Caricatura'});
  var file=h('input',{type:'file',accept:'image/*',class:'nascosto'});
  function disegna(){
    var kids=CARIC.map(function(c){
      var chi=S.people.find(function(x){return x.img===c&&(!p||x.id!==p.id);});
      return h('button',{type:'button',class:'gal','aria-pressed':String(val===c),'aria-label':'Caricatura '+c.slice(1)+(chi?', ora di '+chi.name:''),onclick:function(){val=c;disegna();}},
        h('img',{src:'img/'+c+'-viso.jpg',alt:''}),h('span',{class:'gal-s'},chi?chi.name:'libera'));
    });
    if(/^data:/.test(val))kids.push(h('button',{type:'button',class:'gal','aria-pressed':'true','aria-label':'Foto dal telefono'},h('img',{src:val,alt:''}),h('span',{class:'gal-s'},'dal telefono')));
    kids.push(h('button',{type:'button',class:'gal vuota','aria-pressed':String(!val),onclick:function(){val='';disegna();}},h('span',{class:'gal-x'},'Nessuna')));
    kids.push(h('label',{class:'gal vuota'},h('span',{class:'gal-x'},'Dal telefono'),file));
    box.replaceChildren(frag(kids));
  }
  file.addEventListener('change',function(){
    var f=file.files&&file.files[0];if(!f)return;
    riduciFoto(f,function(u){if(u&&normImg(u)){val=u;disegna();}else toast('Questa immagine non si riesce ad aprire.');});
  });
  disegna();
  box.get=function(){return val;};
  return box;
}
function mettiFaccia(p,img){
  if(CARIC.indexOf(img)>=0)S.people.forEach(function(x){if(x!==p&&x.img===img)x.img='';});
  p.img=img;
}
function prod(id){return S.products.find(function(x){return x.id===id;});}
function cats(){var o=[];S.products.forEach(function(p){if(o.indexOf(p.cat)<0)o.push(p.cat);});return o;}
/* chi ha segnato il movimento: nel registro resta il nome di chi è entrato su questo telefono */
function firma(m){var io=mio();if(io&&!m.da)m.da=io;return m;}
function addMove(o,say){
  var mv=firma(Object.assign({id:rid(),t:Date.now()},o));
  S.moves.push(mv);commit();
  if(say)toast(say,function(){var i=S.moves.indexOf(mv);if(i>=0){S.moves.splice(i,1);commit();toast('Annullato.');}});
  return mv;
}
function lowStock(){
  return S.products.filter(function(p){return p.on&&(p.id in D.stock)&&(D.stock[p.id]<=0||(p.min!=null&&D.stock[p.id]<=p.min));});
}
function backupLine(){
  var t=S.meta.exported;if(!t)return 'mai fatto';
  var g=Math.floor((Date.now()-t)/864e5);return g<=0?'fatto oggi':g===1?'fatto ieri':g+' giorni fa';
}
function backupOld(){var t=S.meta.exported;if(!t)return S.moves.length>=10;return Date.now()-t>14*864e5;}

/* ---------- questo telefono: di chi è, modalità admin, PIN ----------
   Restano solo su questo telefono (non si sincronizzano). I codici invece valgono per tutti: se l'admin li cambia,
   nei dati condivisi va solo la loro impronta. Non è una cassaforte: serve contro sbagli e curiosi. */
/* ---------- login con PIN personale (dalla 0.11.0) ----------
   Ogni paziente ha il suo PIN (nei dati condivisi va solo l'impronta, person.pin) e un telefono (person.tel = id del
   dispositivo). Questo telefono è di «io» finché person.tel è il suo: se un altro telefono si prende quel nome
   (con codice admin + PIN), questo esce da solo. Non è una sicurezza vera: niente server, controlli fatti dall'app. */
function mio(){var id=lsGet(KEY+'.io')||'',p=person(id);return p&&p.tel===devId()?id:'';}
function loggato(){var id=mio();return !!id&&!!person(id).pin;}
function improntaPin(id,pin){return hashStr('oblio|pin|'+id+'|'+String(pin==null?'':pin).trim());}
function pinGiusto(id,pin){var p=person(id);return !!p&&!!p.pin&&p.pin===improntaPin(id,pin);}
function legaTelefono(id){
  var dev=devId();
  S.people.forEach(function(p){if(p.id===id){p.tel=dev;p.visto=today();}else if(p.tel===dev)delete p.tel;});
}
/* l'ultimo giorno in cui ognuno ha aperto l'app, per l'elenco dell'admin (dalla 0.17.0). Si scrive al massimo una volta
   al giorno e solo dopo aver ricevuto i dati veri del locale: così non si riscrive una persona con dati vecchi. */
function segnaVisto(){
  var id=mio(),p=id&&person(id);
  if(!p||!p.pin||!SY||!SY.init||p.visto===today())return false;
  p.visto=today();return true;
}
function vistoTxt(p){
  if(!p.visto)return 'ultima apertura non ancora registrata';
  var g=-giorniA(p.visto);
  return g<=0?'visto oggi':g===1?'visto ieri':'visto '+g+' giorni fa';
}
function haApp(p){return !!(p.pin&&p.tel);}
/* chi può fare il login: i pazienti in reparto; i visitatori solo se l'admin ha creato il loro codice ospite */
function chiPuoEntrare(){return people().filter(function(p){return p.kind==='paziente';});}
function ospitiCheEntrano(){return people().filter(function(p){return p.kind==='amico'&&!!p.pin;});}
/* ospite (dalla 0.15.0): un visitatore entrato con il codice che gli ha dato l'admin. Vede solo Ludoteca e Classifiche
   e vota solo per sé, dal suo telefono. */
function ospite(){return loggato()&&isVisitor(mio());}
function codiceOspite(p){return !!p&&p.kind==='amico'&&!!p.pin;}
var LOG={chi:null,passo:'chi',admin:false,v:{}};
function campoPin(id,label){
  // il valore resta in LOG.v: se arrivano dati dagli altri telefoni e la pagina si ridisegna, non si perde
  LOG.v=LOG.v||{};
  var i=h('input',{class:'inp pin',id:id,'data-k':id,type:'password',inputmode:'numeric',autocomplete:'off',maxlength:4,pattern:'[0-9]*'});
  if(id.indexOf('lg-')===0){i.value=LOG.v[id]||'';i.addEventListener('input',function(){LOG.v[id]=i.value;});}
  return {el:campo(label,i,id),i:i};
}
function vLogin(){
  var dev=devId(),aspetta=loginAspetta();
  var out=[h('h2',{class:'titolo'},'Chi sei?')];
  if(aspetta){
    out.push(h('section',{class:'cartella'},h('p',{class:'aiuto'},SST.stato==='errore'?'Non riesco a collegarmi al locale. Serve la rete per il primo accesso: riprova quando sei collegato.':'Mi collego al locale per sapere chi ha già il telefono…')));
    return out;
  }
  var p=LOG.chi?person(LOG.chi):null;
  if(!p||(p.kind==='amico'&&(!p.pin||LOG.passo!=='pin'))){LOG.passo='chi';LOG.admin=false;}
  var ospiteP=!!p&&p.kind==='amico';
  if(LOG.passo==='chi'){
    out.push(h('p',{class:'nota-chiara'},'Succede una volta sola: da qui in poi questo telefono entra sempre a nome tuo.'),
      h('section',{class:'cartella'},
        h('div',{class:'chips'},chiPuoEntrare().map(function(x){
          var altrove=x.tel&&x.tel!==dev;
          return h('button',{type:'button',class:'chip con-ava'+(altrove?' altrove':''),'data-k':'chi-sono-'+x.id,onclick:function(){
            LOG.chi=x.id;LOG.admin=false;LOG.passo=altrove?'admin':x.pin?'pin':'nuovo';render();}},
            ava(x.id,'xs'),nomeP(x),altrove?h('small',{class:'chip-s'},'ha già il telefono'):null);
        })),
        h('p',{class:'aiuto'},'Chi ha già il suo telefono può entrare da qui solo con il codice admin e il suo PIN.')));
    var osp=ospitiCheEntrano();
    if(osp.length)out.push(h('section',{class:'cartella'},
      h('h3',{class:'etichetta'},'Sei un ospite?'),
      h('div',{class:'chips'},osp.map(function(x){
        var altrove=x.tel&&x.tel!==dev;
        return h('button',{type:'button',class:'chip con-ava amico'+(altrove?' altrove':''),'data-k':'chi-sono-'+x.id,onclick:function(){
          LOG.chi=x.id;LOG.admin=false;LOG.passo='pin';render();}},
          ava(x.id,'xs'),nomeP(x),altrove?h('small',{class:'chip-s'},'ha già il telefono'):null);
      })),
      h('p',{class:'aiuto'},'Entra con il codice che ti ha dato l’admin.')));
    return out;
  }
  var err=h('p',{class:'errore',role:'alert',hidden:true}),f,a,b;
  function sbaglio(t,inp){err.textContent=t;err.hidden=false;scuoti(err);if(inp){scuoti(inp);inp.value='';LOG.v[inp.id]='';try{inp.focus();}catch(e){}}}
  function entra(nuovoPin){
    if(nuovoPin)p.pin=improntaPin(p.id,nuovoPin);
    legaTelefono(p.id);lsSet(KEY+'.io',p.id);LOG={chi:null,passo:'chi',admin:false,v:{}};
    commit();tocco([12,40,12]);window.scrollTo(0,0);
  }
  var indietroLog=h('button',{type:'button',class:'pill viola sm indietro',onclick:function(){LOG={chi:null,passo:'chi',admin:false,v:{}};render();}},ic('indietro',18),'Cambia nome');
  if(LOG.passo==='admin'){
    a=campoPin('lg-adm','Codice admin');a.i.maxLength=12;
    f=h('form',{class:'modulo'},h('p',{class:'aiuto'},pName(p.id)+' ha già il suo telefono. Per spostarlo su questo serve il codice admin, poi il PIN di '+pName(p.id)+'. L’altro telefono esce da solo.'),a.el,err,
      h('button',{class:'pill duo-verde largo',type:'submit','data-k':'lg-ok'},'Avanti'));
    f.addEventListener('submit',function(ev){ev.preventDefault();
      if(!codiceOk(a.i.value,'admH',ADMIN0))return sbaglio('Codice admin sbagliato.',a.i);
      LOG.admin=true;LOG.passo=p.pin?'pin':'nuovo';render();});
  }else if(LOG.passo==='pin'){
    a=campoPin('lg-pin',ospiteP?'Il codice ospite di '+pName(p.id):'Il PIN di '+pName(p.id));
    f=h('form',{class:'modulo'},a.el,err,h('button',{class:'pill duo-verde largo',type:'submit','data-k':'lg-ok'},'Entra'),
      h('p',{class:'aiuto'},ospiteP?'Codice dimenticato o telefono nuovo? Te ne crea uno nuovo l’admin.':'PIN dimenticato? Lo azzera l’admin, poi ne crei uno nuovo.'));
    f.addEventListener('submit',function(ev){ev.preventDefault();
      if(ospiteP&&p.tel&&p.tel!==dev)return sbaglio(pName(p.id)+' è già entrato da un altro telefono. Per entrare da questo chiedi all’admin un codice nuovo.',a.i);
      if(p.tel&&p.tel!==dev&&!LOG.admin){LOG.passo='admin';render();return;}
      if(!pinGiusto(p.id,a.i.value))return sbaglio(ospiteP?'Codice sbagliato.':'PIN sbagliato.',a.i);
      entra(null);});
  }else{
    a=campoPin('lg-n1','Crea il tuo PIN (4 cifre)');b=campoPin('lg-n2','Riscrivilo');
    f=h('form',{class:'modulo'},h('p',{class:'aiuto'},'Ti servirà per le operazioni sensibili (cassa, spese, debiti a mano, inventario) e per uscire. Nel registro resterà il tuo nome.'),a.el,b.el,err,
      h('button',{class:'pill duo-verde largo',type:'submit','data-k':'lg-ok'},'Crea il PIN ed entra'));
    f.addEventListener('submit',function(ev){ev.preventDefault();
      var v=a.i.value.trim();
      if(!/^\d{4}$/.test(v))return sbaglio('Il PIN è di 4 cifre.',a.i);
      if(v!==b.i.value.trim())return sbaglio('I due PIN non sono uguali.',b.i);
      if(p.tel&&p.tel!==dev&&!LOG.admin){LOG.passo='admin';render();return;}
      entra(v);});
  }
  out.push(indietroLog,h('section',{class:'cartella'},h('div',{class:'linea'},ava(p.id,'grande'),h('h3',{class:'nome'},nomeP(p))),f));
  setTimeout(function(){try{a.i.focus();}catch(e){}},80);
  return out;
}
/* dopo il primo login: le regole principali, una volta per telefono */
var REGOLE=[
  ['Questo telefono è tuo.','Ogni volta che apri l’app sei già tu.'],
  ['Voti solo per te.','I visitatori si fanno votare dal telefono di uno di voi.'],
  ['Il tuo PIN firma.','Cassa, spese, debiti a mano e inventario lo chiedono, e nel registro resta il tuo nome.'],
  ['Ogni consumazione si segna:','sul ticket oppure paga subito.'],
  ['PIN dimenticato?','Lo azzera l’admin e ne crei uno nuovo.']];
var REGOLE_OSPITE=[
  ['Sei ospite.','Vedi la Ludoteca e le Classifiche.'],
  ['Voti solo per te,','con il podio: 1°, 2° e 3°.'],
  ['Questo telefono è tuo.','Ogni volta che apri l’app sei già tu.'],
  ['Codice dimenticato o telefono nuovo?','Te ne crea uno nuovo l’admin.']];
function vRegolePrime(){
  var osp=ospite();
  return [h('h2',{class:'titolo'},'Benvenuto, '+pName(mio())),
    h('p',{class:'nota-chiara'},osp?'Le regole per gli ospiti, in breve.':'Le regole del reparto, in breve. Le ritrovi nella Guida.'),
    h('section',{class:'cartella'},h('ol',{class:'righe regole-prime'},(osp?REGOLE_OSPITE:REGOLE).map(function(r){return h('li',null,h('b',null,r[0]),' '+r[1]);}))),
    h('button',{class:'pill duo-verde largo',type:'button','data-k':'regole-ok',onclick:function(){lsSet(KEY+'.regole','1');go(osp?'ludoteca':'reparto');}},'Ho capito, entra')];
}
/* l'ospite tocca il suo nome in alto: esce da qui */
function openOspite(){
  var io=mio();if(!io)return;
  openSheet(pName(io)+' · ospite',[
    h('p',{class:'aiuto'},'Sei entrato come ospite: vedi la Ludoteca e le Classifiche e voti solo per te.'),
    h('div',{class:'azioni'},h('button',{type:'button',class:'pill viola','data-k':'esci-ospite',onclick:function(){closeSheet();esci();}},ic('esci',18),'Esci'))]);
}
function esci(){
  var osp=ospite();
  conPin(function(){lsSet(KEY+'.io','');lsSet(KEY+'.dentro','');pinFino=0;LOG={chi:null,passo:'chi',admin:false,v:{}};render();toast(osp?'Sei uscito. Per rientrare serve il tuo codice.':'Sei uscito. Per rientrare serve il tuo PIN.');},'Uscire dal tuo nome',true);
}
function openCambiaPin(){
  var io=mio(),v=campoPin('cp-v','PIN attuale'),a=campoPin('cp-1','Nuovo PIN (4 cifre)'),b=campoPin('cp-2','Riscrivilo');
  formSheet('Cambia il tuo PIN',[v.el,a.el,b.el],function(){
    if(!pinGiusto(io,v.i.value)){v.i.value='';return 'PIN attuale sbagliato.';}
    var n=a.i.value.trim();
    if(!/^\d{4}$/.test(n))return 'Il nuovo PIN è di 4 cifre.';
    if(n!==b.i.value.trim())return 'I due PIN non sono uguali.';
    person(io).pin=improntaPin(io,n);commit();toast('PIN cambiato.');
  },'Cambia il PIN',{noBozza:true});
}
function devId(){if(!DEV){DEV=lsGet(KEY+'.dev')||'';if(!DEV){DEV='d'+rid();lsSet(KEY+'.dev',DEV);}}return DEV;}
function isAdmin(){return lsGet(KEY+'.admin')==='1';}
function codiceOk(code,campo,def){code=String(code==null?'':code).trim();var h=S.cfg[campo];return h?impronta(code)===h:code===def;}
var pinFino=0;
/* azione sensibile: chiede il PIN personale di chi è entrato (sull'admin no; dopo il PIN giusto, per 10 minuti non lo
   richiede). sempre=true: lo chiede comunque (per uscire dal proprio nome). */
function conPin(azione,cosa,sempre){
  if(!sempre&&(isAdmin()||Date.now()<pinFino)){azione();return;}
  var io=mio();if(!io){render();return;}
  var i=h('input',{class:'inp pin',id:'pin-c',type:'password',inputmode:'numeric',autocomplete:'off',maxlength:4});
  var testoAiuto=(cosa||'Questa azione')+': serve il tuo PIN.'+(sempre?'':' Per 10 minuti non te lo richiedo.');
  if(foglio.open){
    // c'è già un foglio aperto (uno scontrino, una cartella): il PIN compare sopra, senza perdere niente
    var vecchio=foglioB.querySelector('.pin-box');if(vecchio)vecchio.remove();
    var err=h('p',{class:'errore',role:'alert',hidden:true});
    var ok=function(){
      if(!pinGiusto(io,i.value)){i.value='';err.textContent='PIN sbagliato.';err.hidden=false;scuoti(err);scuoti(i);try{i.focus();}catch(e){}return;}
      pinFino=Date.now()+10*60000;box.remove();azione();
    };
    i.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();ok();}});
    var box=h('div',{class:'pin-box',role:'group','aria-label':'Il tuo PIN'},
      h('p',{class:'aiuto'},testoAiuto),campo('Il PIN di '+pName(io),i,'pin-c'),err,
      h('div',{class:'azioni'},h('button',{type:'button',class:'pill duo-verde sm','data-k':'pin-ok',onclick:ok},'Conferma'),
        h('button',{type:'button',class:'pill sm',onclick:function(){box.remove();}},'Lascia stare')));
    foglioB.prepend(box);foglioB.scrollTop=0;
    setTimeout(function(){try{i.focus();}catch(e){}},80);
    return;
  }
  formSheet('Il tuo PIN',[h('p',{class:'aiuto'},testoAiuto),campo('Il PIN di '+pName(io),i,'pin-c')],function(){
    if(!pinGiusto(io,i.value)){i.value='';return 'PIN sbagliato.';}
    pinFino=Date.now()+10*60000;
    setTimeout(azione,60);
  },'Conferma',{noBozza:true});
  setTimeout(function(){try{i.focus();}catch(e){}},80);
}
function openAdminAccesso(){
  var i=h('input',{class:'inp pin',id:'adm-c',type:'password',inputmode:'numeric',autocomplete:'off',maxlength:12});
  formSheet('Modalità admin',[h('p',{class:'aiuto'},'Scrivi il codice admin. Questo telefono resta admin finché non esci dalla modalità admin.'),campo('Codice admin',i,'adm-c')],function(){
    if(!codiceOk(i.value,'admH',ADMIN0)){i.value='';return 'Codice sbagliato.';}
    lsSet(KEY+'.admin','1');pinFino=0;render();toast('Questo telefono adesso è admin.');
  },'Entra',{noBozza:true});
  setTimeout(function(){try{i.focus();}catch(e){}},80);
}
function esciAdmin(){lsSet(KEY+'.admin','');pinFino=0;go('altro');toast('Modalità admin chiusa su questo telefono.');}
function soloAdmin(azione){if(isAdmin())azione();else toast('Solo l’admin può farlo: Altro › Admin.');}
/* ---------- toast e fogli ---------- */
function toast(msg,undo,label){
  var box=$('#toast');clearTimeout(toastTimer);
  var d=h('div',null,h('span',null,msg));
  var dur=label?20000:undo?7000:3200;
  if(undo){d.append(h('button',{type:'button',onclick:function(){box.replaceChildren();undo();}},label||'Annulla'));d.classList.add('con-annulla');d.append(h('i',{class:'toast-barra',style:'animation-duration:'+dur+'ms','aria-hidden':'true'}));}
  box.replaceChildren(d);
  toastTimer=setTimeout(function(){box.replaceChildren();},dur);
}
var foglio,foglioT,foglioB;
var guardia=null;   // il modulo aperto nel foglio: se si esce senza salvare, si chiede cosa fare
function openSheet(title,body,live){
  guardia=null;
  foglioT.textContent=title;foglioB.replaceChildren(frag(body));liveSheet=live||null;
  if(!foglio.open){try{foglio.showModal();}catch(e){foglio.setAttribute('open','');}}
  foglioB.scrollTop=0;
}
function closeSheet(){guardia=null;liveSheet=null;if(foglio.open){try{foglio.close();}catch(e){foglio.removeAttribute('open');}}}
function refreshSheet(){
  if(liveSheet&&foglio.open){var st=foglioB.scrollTop;foglioB.replaceChildren(frag(liveSheet()));foglioB.scrollTop=st;}
}
/* ---------- moduli: valori, bozze e avviso di uscita ---------- */
function controlli(form){return Array.prototype.slice.call(form.querySelectorAll('input,select,textarea,.chips')).filter(function(e){return !(e.tagName==='INPUT'&&(e.type==='file'||e.type==='password'));});}
function valoriForm(form){
  return controlli(form).map(function(e){
    if(e.classList.contains('chips'))return 'p:'+Array.prototype.map.call(e.querySelectorAll(':scope>button'),function(b){return b.getAttribute('aria-pressed')==='true'?'1':'0';}).join('');
    if(e.type==='checkbox')return 'c:'+(e.checked?1:0);
    return 'v:'+e.value;
  });
}
function applicaValori(form,vals){
  controlli(form).forEach(function(e,i){
    var v=vals[i];if(v==null)return;
    if(e.classList.contains('chips')){
      var bs=Array.prototype.slice.call(e.querySelectorAll(':scope>button')),voglio=v.slice(2);
      bs.forEach(function(b,j){var on=b.getAttribute('aria-pressed')==='true';if(voglio.charAt(j)==='1'&&!on)b.click();});
      bs.forEach(function(b,j){var on=b.getAttribute('aria-pressed')==='true';if(voglio.charAt(j)!=='1'&&on)b.click();});
    }else if(e.type==='checkbox'){var c=v==='c:1';if(e.checked!==c){e.checked=c;e.dispatchEvent(new Event('change'));}}
    else if(e.value!==v.slice(2)){e.value=v.slice(2);e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input'));}
  });
}
function stessaForma(a,b){return a.length===b.length&&a.every(function(x,i){return x.slice(0,2)===b[i].slice(0,2)&&(x.charAt(0)!=='p'||x.length===b[i].length);});}
function bozze(){var o;try{o=JSON.parse(lsGet(KEY+'.bozze')||'{}');}catch(e){o={};}return o&&typeof o==='object'?o:{};}
function bozzaSalva(titolo,vals){var o=bozze();o[titolo]={v:vals,t:Date.now()};Object.keys(o).forEach(function(k){if(Date.now()-o[k].t>7*864e5)delete o[k];});lsSet(KEY+'.bozze',JSON.stringify(o));}
function bozzaVia(titolo){var o=bozze();if(o[titolo]){delete o[titolo];lsSet(KEY+'.bozze',JSON.stringify(o));}}
function sporco(g){return !!g&&g.form.isConnected&&(g.soloConferma||JSON.stringify(valoriForm(g.form))!==JSON.stringify(g.iniz));}
/* chiusura chiesta da chi usa l'app (X, fuori dal foglio, tasto indietro): se il modulo è cambiato, chiedo */
function tentaChiudere(){
  var g=guardia;
  if(!sporco(g)){closeSheet();return;}
  var box=foglioB.querySelector('.uscita');if(box){box.scrollIntoView({block:'center'});return;}
  if(g.soloConferma){   // fogli che non si possono tenere come bozza (es. lo scontrino letto dalla foto)
    box=h('div',{class:'uscita',role:'alertdialog','aria-label':'Uscire senza registrare'},
      h('p',null,h('b',null,'Esci senza registrare? '),g.testo||''),
      h('div',{class:'azioni'},
        h('button',{type:'button',class:'pill duo-verde sm','data-k':'esci-resta',onclick:function(){box.remove();}},'Resto qui'),
        h('button',{type:'button',class:'pill sm pericolo','data-k':'esci-no',onclick:function(){closeSheet();}},'Esci senza registrare')));
    foglioB.prepend(box);foglioB.scrollTop=0;return;
  }
  box=h('div',{class:'uscita',role:'alertdialog','aria-label':'Modifiche non salvate'},
    h('p',null,h('b',null,'Non hai salvato. '),'Cosa faccio?'),
    h('div',{class:'azioni'},
      h('button',{type:'button',class:'pill duo-verde sm','data-k':'esci-salva',onclick:function(){box.remove();g.form.requestSubmit();}},'Salva'),
      h('button',{type:'button',class:'pill sm','data-k':'esci-bozza',onclick:function(){bozzaSalva(g.titolo,valoriForm(g.form));closeSheet();toast('Tenuto come bozza: lo ritrovi la prossima volta che lo apri.');}},'Tieni la bozza'),
      h('button',{type:'button',class:'pill sm pericolo','data-k':'esci-no',onclick:function(){bozzaVia(g.titolo);closeSheet();}},'Esci senza salvare')));
  foglioB.prepend(box);foglioB.scrollTop=0;
}
function formSheet(title,fields,onSave,label,opz){
  opz=opz||{};
  var err=h('p',{class:'errore',role:'alert',hidden:true});
  var form=h('form',{class:'modulo',novalidate:true},fields,err,h('div',{class:'salva-fisso'},h('button',{class:'pill duo-verde largo',type:'submit'},label||'Salva')));
  form.addEventListener('submit',function(ev){
    ev.preventDefault();var r;
    var u=foglioB.querySelector('.uscita');if(u)u.remove();
    try{r=onSave();}catch(e){r='Qualcosa non va: '+(e&&e.message?e.message:e);}
    if(typeof r==='string'){err.textContent=r;err.hidden=false;scuoti(err);err.scrollIntoView({block:'center'});return;}
    if(!opz.noBozza)bozzaVia(title);
    if(form.isConnected)closeSheet();   // se il salvataggio ha già aperto un altro foglio, lo lascio
  });
  openSheet(title,form);
  if(!opz.noBozza){
    var iniz=valoriForm(form),bz=bozze()[title];
    // giaSporco: il modulo riparte con valori scritti prima (es. tornando al carico dopo un prodotto nuovo)
    guardia={form:form,titolo:title,iniz:opz.giaSporco?[]:iniz};
    if(!opz.giaSporco&&bz&&Array.isArray(bz.v)&&stessaForma(iniz,bz.v)&&JSON.stringify(bz.v)!==JSON.stringify(iniz)){
      applicaValori(form,bz.v);
      form.prepend(h('p',{class:'bozza'},'Bozza ripresa: è quello che avevi lasciato senza salvare. ',
        h('button',{type:'button',class:'link',onclick:function(ev){applicaValori(form,iniz);bozzaVia(title);ev.target.parentNode.remove();}},'Ricomincia da capo')));
    }
  }
  return form;
}
function campo(label,control,id){control.id=id;return h('div',{class:'campo'},h('label',{for:id},label),control);}
function gruppo(label,control){control.setAttribute('role','group');control.setAttribute('aria-label',label);return h('div',{class:'campo'},h('span',{class:'lab'},label),control);}
function soldi(id,cents){return h('input',{class:'inp soldi',id:id,type:'text',inputmode:'decimal',autocomplete:'off',placeholder:'0,00',value:cents!=null?c2s(cents):''});}
function testo(id,ph,max,val){return h('input',{class:'inp',id:id,type:'text',autocomplete:'off',placeholder:ph||'',maxlength:max||80,value:val||''});}
function chipSel(opts,val,multi,libero){
  var sel={};(multi?val||[]:(val!=null?[val]:[])).forEach(function(v){sel[v]=1;});
  var box=h('div',{class:'chips'});
  var btns=opts.map(function(o){
    var b=h('button',{type:'button',class:'chip'+(o.cls?' '+o.cls:''),'aria-pressed':String(!!sel[o.v])},o.label);
    b.addEventListener('click',function(){
      if(multi){if(sel[o.v])delete sel[o.v];else sel[o.v]=1;}
      else if(libero&&sel[o.v])sel={};
      else{sel={};sel[o.v]=1;}
      btns.forEach(function(x,i){x.setAttribute('aria-pressed',String(!!sel[opts[i].v]));});
      box.dispatchEvent(new Event('change'));
    });
    return b;
  });
  put(box,btns);
  box.get=function(){var a=opts.map(function(o){return o.v;}).filter(function(v){return sel[v];});return multi?a:(a.length?a[0]:null);};
  return box;
}
function peopleOpts(extraAll){
  return people(extraAll).map(function(p){return {v:p.id,label:nomeP(p),cls:p.kind==='amico'?'amico':''};});
}

/* ---------- navigazione ---------- */
var TABS=[['reparto','Reparto','croce'],['farmacia','Farmacia','bicchiere'],['ludoteca','Ludoteca','bersaglio'],['altro','Altro','altro']];
var NOMI_TAB={reparto:'Reparto',farmacia:'Farmacia',ludoteca:'Ludoteca',altro:'Altro',classifiche:'Classifiche'};
/* l'ospite ha due tasti: Ludoteca e Classifiche (dalla 0.15.0) */
var TABS_OSPITE=[['ludoteca','Ludoteca','bersaglio'],['classifiche','Classifiche','podio']];
var TAB_OSPITE={ludoteca:1,classifiche:1},SUB_OSPITE={freccette:1,classifiche:1,statistiche:1,medaglie:1,muro:1};
/* i Ticket stanno nella Farmacia, le freccette nella Ludoteca (dalla 0.11.0) */
function apriTicket(){UI.farm='ticket';go('farmacia');}
function apriFreccette(){go('ludoteca','freccette');}
function go(tab,sub,forza){
  // moduli della pagina (es. Regole) cambiati e non salvati: prima di uscire chiedo
  if(!forza){
    var sp=Array.prototype.filter.call(document.querySelectorAll('#view form.guardia'),function(f){return f._iniz&&JSON.stringify(valoriForm(f))!==JSON.stringify(f._iniz);});
    if(sp.length){
      openSheet('Modifiche non salvate',[
        h('p',{class:'aiuto'},'In questa pagina hai cambiato qualcosa senza toccare «Salva».'),
        h('div',{class:'azioni'},
          h('button',{type:'button',class:'pill duo-verde','data-k':'pg-salva',onclick:function(){closeSheet();var ok=true;sp.forEach(function(f){if(f._salva()===false)ok=false;});if(ok)go(tab,sub,true);}},'Salva ed esci'),
          h('button',{type:'button',class:'pill pericolo','data-k':'pg-no',onclick:function(){closeSheet();go(tab,sub,true);}},'Esci senza salvare'),
          h('button',{type:'button',class:'pill',onclick:closeSheet},'Resta qui'))]);
      return;
    }
  }
  if(UI.tab==='farmacia'&&tab!=='farmacia'&&contoAperto()&&posTotal().n)toast('Il conto di '+(UI.pos.p?pName(UI.pos.p):'chi non hai scelto')+' non è registrato: resta in sospeso in Farmacia.');
  // in Farmacia il paziente parte dal padrone del telefono (si cambia con un tocco)
  if(tab==='farmacia'&&UI.tab!=='farmacia'&&!UI.pos.p&&!posTotal().n)UI.pos.p=mio()||null;
  if(sub!=='muro')UI.muroPrima=null;
  UI.tab=tab;UI.sub=sub||null;
  try{history.replaceState(null,'','#'+tab+(sub?'/'+sub:''));}catch(e){}
  render();window.scrollTo(0,0);
}
function posTotal(){
  var a=0,n=0;
  S.products.forEach(function(p){var q=UI.pos.qty[p.id]||0;if(q){a+=q*p.price;n+=q;}});
  UI.pos.extra.forEach(function(x){a+=x.pr;n+=1;});
  return {a:a,n:n};
}
function render(){
  var act=document.activeElement,key=act&&act.dataset?act.dataset.k:null;
  $('#nav').hidden=!(loggato()&&lsGet(KEY+'.regole')==='1');
  var nuovi=loggato()&&UI.sub!=='muro'?muroNuovi():0;
  var osp=ospite();
  if(osp&&(!TAB_OSPITE[UI.tab]||(UI.sub&&!SUB_OSPITE[UI.sub]))){UI.tab='ludoteca';UI.sub=null;}
  $('#nav').replaceChildren(frag((osp?TABS_OSPITE:TABS).map(function(t){
    var pall=t[0]==='ludoteca'&&nuovi;
    return h('button',{type:'button',class:'tab','aria-current':UI.tab===t[0]?'page':null,'aria-label':pall?t[1]+', '+nuovi+(nuovi===1?' post-it nuovo':' post-it nuovi'):null,onclick:function(){go(t[0]);}},
      pall?h('i',{class:'pallino','aria-hidden':'true'}):null,ic(t[2]),h('span',null,t[1]));
  })));
  var av=$('#avviso'),msg='';
  if(!storageOk)msg='Questo dispositivo non sta salvando i dati: quello che segni resta solo finché la pagina è aperta.';
  else if(IN_CLAUDE)msg='Anteprima dentro Claude: i dati restano su questo dispositivo e possono azzerarsi. L’app vera si installa dal suo indirizzo web.';
  else if(IOS&&!installata())msg='Su iPhone installa l’app prima di usarla: Condividi, poi «Aggiungi alla schermata Home»'+(SYNC?', e da lì usa sempre l’icona.':'. Quello che segni qui in Safari non passa all’app installata.');
  av.textContent=msg;av.hidden=!msg;
  var posOn=UI.tab==='farmacia'&&!UI.sub&&farm()==='banco'&&(UI.pos.p||posTotal().n>0);
  document.body.classList.toggle('con-pos',!!posOn);
  document.body.classList.toggle('in-gioco',UI.sub==='freccette');
  // senza login l'app mostra solo «Chi sei?»; dopo il primo login, una volta, le regole
  var dentro=loggato(),regole=dentro&&lsGet(KEY+'.regole')==='1';
  if(!dentro&&lsGet(KEY+'.dentro')==='1'){
    var ex=person(lsGet(KEY+'.io')||''),tolto=!!ex&&ex.kind==='amico'&&!ex.pin;
    lsSet(KEY+'.dentro','');setTimeout(function(){toast(tolto?'L’admin ha tolto il tuo accesso da ospite.':'Il tuo nome adesso è su un altro telefono: qui sei uscito.');},0);}
  else if(dentro)lsSet(KEY+'.dentro','1');
  document.body.classList.toggle('fuori',!regole);
  var vista=!dentro?vLogin:!regole?vRegolePrime:UI.sub&&SUBS[UI.sub]?(ADMIN_SUBS[UI.sub]&&!isAdmin()?vBloccato:SUBS[UI.sub]):VIEWS[UI.tab];
  $('#view').replaceChildren(frag(vista()));
  var pagina=(dentro?'d':'f')+'|'+UI.tab+'|'+(UI.sub||'')+'|'+(UI.sub==='classifiche'?UI.cl:'');
  if(UI.pagina&&UI.pagina!==pagina&&!movimentoRidotto()){var vw=$('#view');vw.classList.remove('entra');void vw.offsetWidth;vw.classList.add('entra');}
  UI.pagina=pagina;
  contaNumeri();
  Array.prototype.forEach.call(document.querySelectorAll('#view form.guardia'),function(f){f._iniz=valoriForm(f);});
  if(key){var el=document.querySelector('[data-k="'+key+'"]');if(el){try{el.focus({preventScroll:true});}catch(e){}}}
  refreshSheet();
  paintSync();
  salvaConto();
}
/* modulo dentro una pagina (non nel foglio): se si esce senza salvare, go() chiede. salva() torna false se non va. */
function formPagina(salva,kids){
  var err=h('p',{class:'errore',role:'alert',hidden:true});
  var f=h('form',{class:'modulo guardia'},kids,err);
  f._salva=function(){var r=salva();if(typeof r==='string'){err.textContent=r;err.hidden=false;return false;}err.hidden=true;return true;};
  f.addEventListener('submit',function(ev){ev.preventDefault();f._salva();});
  return f;
}
function vBloccato(){
  return [indietro(),h('h2',{class:'titolo'},'Solo admin'),
    h('section',{class:'cartella'},h('p',{class:'aiuto'},'Questa parte si apre solo sul telefono dell’admin, con il codice admin.'),
      h('div',{class:'azioni'},h('button',{class:'pill duo-verde',type:'button',onclick:openAdminAccesso},'Ho il codice admin')))];
}

/* ---------- righe e descrizioni ---------- */
function itemsText(mv){return (mv.items||[]).map(function(it){return (it.q>1?it.q+'× ':'')+it.n;}).join(', ');}
function moveInfo(mv){
  var a=mv.k==='count'?toInt(mv.a):Math.max(0,toInt(mv.a)),who=mv.p?pName(mv.p):'';
  switch(mv.k){
    case 'sale':return {t:'Pagato subito · '+who,s:itemsText(mv),cash:a,tag:'cassa'};
    case 'tab':return {t:'Sul ticket · '+who,s:itemsText(mv),debt:a,tag:'ticket'};
    case 'dplus':return {t:(mv.pc?'Preso dalla cassa · ':'Debito aggiunto · ')+who,s:mv.note||'',debt:a,tag:'ticket'};
    case 'dminus':return {t:'Debito tolto · '+who,s:mv.note||'',debt:-a,tag:'ticket'};
    case 'pay':return {t:'Ticket incassato · '+who,s:mv.note||'',cash:a,tag:'cassa'};
    case 'in':return {t:'Entrata',s:mv.note||'',cash:a,tag:'cassa'};
    case 'exp':
      if(mv.pc)return {t:'Uscito dalla cassa',s:[mv.note,'va sul ticket di chi l’ha preso'].filter(Boolean).join(' · '),cash:-a,tag:'cassa'};
      var by=mv.paidBy&&mv.paidBy!=='cassa'?pName(mv.paidBy):'',how,daCassa=!by||mv.settle==='cassa';
      if(!by)how='pagata dalla cassa';
      else if(mv.settle==='cassa')how='anticipata da '+by+', rimborsata dalla cassa';
      else if(mv.settle==='dividi')how='anticipata da '+by+', divisa tra '+Object.keys(mv.shares||{}).length;
      else how='anticipata da '+by+', scalata dal suo ticket';
      return {t:'Spesa'+(mv.cat?' · '+mv.cat:''),s:[mv.note,how].filter(Boolean).join(' · '),cash:daCassa?-a:null,fuori:daCassa?null:a,tag:daCassa?'cassa':'ticket'};
    case 'count':return {t:'Conta cassa',s:'contati '+eur(mv.counted)+', attesi '+eur(mv.expected),cash:a,tag:'cassa'};
    case 'load':return {t:'Carico scorte',s:itemsText(mv),tag:'scorte'};
    case 'inv':return {t:'Inventario',s:(mv.items||[]).length+' prodotti contati',tag:'scorte'};
    case 'qin':return {t:'Quota locale · '+who,s:(mv.mese?meseNome(mv.mese):'')+(mv.note?' · '+mv.note:''),fondo:a,tag:'fondo'};
    case 'qout':return {t:'Pagato dal fondo',s:[mv.note,mv.mese?'quota di '+meseNome(mv.mese):''].filter(Boolean).join(' · '),fondo:-a,tag:'fondo'};
    default:return {t:'Movimento',s:'',tag:''};
  }
}
function amountNode(inf){
  if(inf.fondo!=null)return h('span',{class:'importo '+(inf.fondo>0?'blu':'rosso')},eurS(inf.fondo),h('small',null,'fondo'));
  if(inf.cash!=null)return h('span',{class:'importo '+(inf.cash>0?'verde':inf.cash<0?'rosso':'spento')},eurS(inf.cash),h('small',null,'cassa'));
  if(inf.debt!=null)return h('span',{class:'importo '+(inf.debt>0?'rosso':'verde')},eurS(inf.debt),h('small',null,'ticket'));
  if(inf.fuori!=null)return h('span',{class:'importo spento'},eur(inf.fuori),h('small',null,'anticipo'));
  return h('span',{class:'importo spento'},h('small',null,inf.tag||''));
}
function moveRow(mv,withDay){
  var inf=moveInfo(mv);
  return h('li',null,h('button',{type:'button',class:'riga'+(mv.x?' annullato':''),onclick:function(){openMove(mv.id);}},
    h('span',{class:'ora'},withDay?GIORNI3[new Date(mv.t).getDay()]+' '+hm(mv.t):hm(mv.t)),
    h('span',{class:'cresce'},h('span',{class:'nome'},inf.t,mv.x?h('span',{class:'tag'},'annullato'):mv.dc?h('span',{class:'tag attesa'},'da confermare'):null),inf.s?h('span',{class:'sotto'},inf.s):null),
    amountNode(inf)));
}
/* calcoli che dipendono dalla data di oggi: rifatti quando cambiano i conti o il giorno */
var EXTRA={D:null,k:'',v:{},q:{}};
function extra(){
  var k=today()+'|'+S.cfg.graffiGiorni;
  if(EXTRA.D!==D||EXTRA.k!==k)EXTRA={D:D,k:k,v:graffiVecchi(D,Date.now(),S.cfg.graffiGiorni),q:quoteArretrate(S,D,today())};
  return EXTRA;
}
function arretrato(id){return totArretrato(extra().q[id]);}
/* riga di una persona. conQuota: nei Ticket la quota del locale non pagata dopo la scadenza si somma ai graffi, a parte */
function personRow(p,conQuota){
  var d=D.debt[p.id]||0,u=D.units[p.id]||0,x=extra(),vec=x.v[p.id],qa=conQuota?arretrato(p.id):0,tot=Math.max(0,d)+qa;
  var sotto=[];
  if(qa)sotto.push('di cui quota locale '+eur(qa));
  if(qa&&d<0)sotto.push('sulle consumazioni è in credito di '+eur(-d));
  if(vec)sotto.push(eur(vec.a)+' da più di '+S.cfg.graffiGiorni+' giorni');
  return h('li',null,h('button',{type:'button',class:'riga',onclick:function(){openCartella(p.id);}},
    ava(p.id),
    h('span',{class:'cresce'},
      h('span',{class:'nome'},nomeP(p),p.kind==='amico'?h('span',{class:'tag'},'visitatore'):null,p.on?null:h('span',{class:'tag'},'dimesso'),vec?h('span',{class:'tag rosso'},'vecchio'):null),
      d>0?tally(u):null,
      sotto.length?h('span',{class:'sotto'+(vec?' rosso':'')},sotto.join(' · ')):null),
    h('span',{class:'importo '+(tot>0?'rosso':d<0?'verde':'spento')},tot>0?eur(tot):d<0?'credito '+eur(-d):eur(0))));
}

/* ---------- vista: Reparto ---------- */
function vReparto(){
  var now=new Date(),out=[];
  var tot=people(true).reduce(function(s,p){return s+Math.max(0,D.debt[p.id]||0);},0),nDeb=people(true).filter(function(p){return (D.debt[p.id]||0)>0;}).length;
  var low=lowStock(),fac=statoFaccende(),P=previsione(S,D);
  var urgente=low.length>0||backupOld()||D.cash<0||fac.daFare;
  var comp=prossimiCompleanni(S,today()).filter(function(c){return c.giorni>0&&c.giorni<=30;})[0],gioco=partitaAttiva();
  out.push(cardCompleanno());
  out.push(cardRiepilogo());
  // il bollettino: i quattro numeri che contano, a colpo d'occhio
  out.push(h('section',{class:'cartella'},
    h('div',{class:'cart-h'},h('h2',{class:'etichetta'},'Bollettino di '+GIORNI[now.getDay()].toLowerCase()+' '+now.getDate()+'/'+(now.getMonth()+1)),
      h('span',{class:'timbro'+(urgente?'':' ok')},urgente?'Urgente':'Stabile')),
    h('div',{class:'bollettino cruscotto'},
      tessera('Cassa',eur(D.cash),D.cash<0?'rosso':null,'cassa farmacia',function(){go('reparto','cassa');},'t-cassa',D.cash),
      tessera('Ticket aperti',tot?eur(tot):'nessuno',tot?'rosso':null,tot?nDeb+(nDeb===1?' paziente':' pazienti'):'tutti in regola',function(){apriTicket();},'t-ticket',tot||null),
      tessera('Soldi del locale',eur(P.attuale),P.attuale<0?'rosso':null,'previsionale '+eur(P.previsionale),function(){go('reparto','soldi');},'apri-soldi',P.attuale),
      S.quote.length||D.fondo?tessera('Fondo quota',eur(D.fondo),D.fondo<0?'rosso':null,'a parte dalla cassa',function(){go('reparto','quota');},'t-fondo',D.fondo)
        :tessera('Scorte',low.length?low.length+' da prendere':'a posto',low.length?'rosso':null,'lista della spesa',function(){go('reparto','scorte');},'t-scorte')),
    gioco||comp?h('ul',{class:'bollettino-note'},
      gioco?h('li',null,ic('bersaglio',16),h('button',{type:'button',class:'link',onclick:function(){apriFreccette();}},'Partita in corso: '+nomeModo(gioco.mode))):null,
      comp?h('li',null,ic('torta',16),'Compleanno di '+pName(comp.p)+', '+dataBreve(comp.data)+(comp.giorni===1?' (domani)':' (tra '+comp.giorni+' giorni)')):null):null,
    h('div',{class:'azioni'},
      h('button',{class:'pill duo-rosa',type:'button',onclick:function(){go('farmacia');}},ic('bicchiere',20),'Segna consumazione'),
      h('button',{class:'pill','data-k':'apri-cassa',type:'button',onclick:function(){go('reparto','cassa');}},ic('cassa',20),'Cassa'))));
  out.push(cardFaccende(fac));
  out.push(rigaTriage());
  out.push(cardMuro());
  return out;
}
/* un numero del bollettino: etichetta, cifra, riga sotto; si tocca per aprire la pagina giusta */
function tessera(etich,valore,cls,sotto,onclick,k,num){
  return h('button',{type:'button',class:'tessera','data-k':k,onclick:onclick},
    h('span',{class:'tessera-e'},etich),h('span',{class:'tessera-v'+(cls?' '+cls:''),'data-conta':num!=null?num:null,'data-ck':k,'data-fmt':'eur'},valore),sotto?h('span',{class:'tessera-s'},sotto):null);
}

/* ---------- faccende: rifiuti e pulizie ---------- */
function nomiFraz(ids){return ids.map(function(id){var f=FRAZ.find(function(x){return x[0]===id;});return f?f[1]:id;}).join(' · ');}
function statoFaccende(){
  var k=openKey(),cal=calPieno(S.cfg),fr=cal?rifiutiSerata(S.cfg,k):[];
  var fatto=S.trash.find(function(r){return r.s===k;})||null;
  var pul=pulizieStato(S,Date.now(),S.cfg.puliziaGiorni);
  return {k:k,cal:cal,fr:fr,fatto:fatto,pul:pul,daFare:(fr.length>0&&!fatto)||pul.scadute};
}
function rigaFare(o){
  return h('div',{class:'faccenda'+(o.accesa?' accesa':'')},
    h('span',{class:'fare-ic'+(o.accesa?' acceso':'')},ic(o.ic,20)),
    h('span',{class:'cresce'},h('span',{class:'nome'},o.titolo),o.sotto?h('span',{class:'sotto'},o.sotto):null),
    o.azione||null);
}
function cardFaccende(st){
  var urg=[],ok=[];
  // il conto lasciato in Farmacia
  if(UI.tab!=='farmacia'&&contoAperto()&&posTotal().n){
    var tc=posTotal();
    urg.push(rigaFare({ic:'bicchiere',accesa:true,titolo:'Conto non registrato',
      sotto:(UI.pos.p?pName(UI.pos.p):'paziente da scegliere')+' · '+tc.n+(tc.n===1?' pezzo · ':' pezzi · ')+eur(tc.a),
      azione:h('span',{class:'fare-az'},
        h('button',{class:'pill sm duo-verde',type:'button','data-k':'riprendi-conto',onclick:function(){go('farmacia');}},'Riprendi'),
        h('button',{class:'link',type:'button','data-k':'scarta-conto',onclick:function(){UI.pos={p:null,qty:{},extra:[]};render();toast('Conto scartato.');}},'Scarta'))}));
  }
  // operazioni fatte per conto di altri, da confermare: le vede solo l'admin
  var att=isAdmin()?daConfermare(S):[];
  if(att.length)urg.push(rigaFare({ic:'avviso',accesa:true,titolo:att.length===1?'1 operazione da confermare':att.length+' operazioni da confermare',
    sotto:'Segnate per conto di altri. Contano già: se una è sospetta, annullala.',
    azione:h('button',{class:'pill sm duo-verde',type:'button','data-k':'apri-conferme',onclick:openConferme},'Vedi')}));
  // rifiuti
  if(!st.cal){
    urg.push(rigaFare({ic:'sacco',titolo:'Rifiuti',sotto:'Calendario da compilare: l’app li ricorda la sera prima.',
      azione:h('button',{class:'pill sm',type:'button',onclick:function(){soloAdmin(function(){go('reparto','regole');});}},'Compila')}));
  }else if(st.fr.length){
    var f=st.fatto;
    (f?ok:urg).push(rigaFare({ic:'sacco',accesa:!f,titolo:'Stasera fuori: '+nomiFraz(st.fr),
      sotto:f?'Portati giù da '+nomiLista(f.p)+' alle '+hm(f.t)+'.':'Dalle 21:00, ritiro domattina entro le 5:00.',
      azione:f?h('button',{class:'pill sm',type:'button',onclick:function(){S.trash=S.trash.filter(function(r){return r!==f;});commit();toast('Segnati di nuovo come da fare.');}},'Annulla')
        :h('button',{class:'pill sm duo-verde','data-k':'rif-fatto',type:'button',onclick:openRifiuti},'Portati giù')}));
  }else{
    var nx=prossimiRifiuti(S.cfg,st.k);
    ok.push(rigaFare({ic:'sacco',titolo:'Stasera niente rifiuti',sotto:nx?'Prossima uscita '+serataFutura(nx.k)+': '+nomiFraz(nx.f)+'.':null}));
  }
  // pulizie
  var p=st.pul,giorni=S.cfg.puliziaGiorni;
  (p.scadute||p.mai?urg:ok).push(rigaFare({ic:'scopa',accesa:p.scadute,titolo:p.mai?'Pulizie: mai segnate':p.scadute?'Pulizie scadute':'Pulizie a posto',
    sotto:p.mai?'Segnate l’ultima pulizia: dopo '+giorni+' giorni arriva l’avviso.'
      :'Ultima '+(p.giorni===0?'oggi':p.giorni===1?'ieri':p.giorni+' giorni fa')+(p.scadute?': si pulisce ogni '+giorni+' giorni.':'; la prossima tra '+p.mancano+(p.mancano===1?' giorno.':' giorni.')),
    azione:h('button',{class:'pill sm'+(p.scadute||p.mai?' duo-verde':''),'data-k':'pul-fatta',type:'button',onclick:openPulizia},'Pulizia fatta')}));
  // quota del locale: dai 15 giorni prima della scadenza
  var io=mio();
  statoQuote(S,D,today()).filter(function(x){return x.mancano.length&&(x.scaduta||giorniA(x.scad)<=15);}).forEach(function(x){
    var g=giorniA(x.scad),mia=io&&x.mancano.indexOf(io)>=0;
    urg.push(rigaFare({ic:'casa',accesa:x.scaduta,titolo:'Quota di '+meseNome(x.mese)+': '+eur(x.q.a)+' a testa',
      sotto:(x.scaduta?'Scaduta il '+dataBreve(x.scad)+'. In ritardo: ':'Entro il '+dataBreve(x.scad)+(g===0?' (oggi)':g===1?' (domani)':' (tra '+g+' giorni)')+'. Mancano: ')+nomiLista(x.mancano)+'.',
      azione:h('button',{class:'pill sm duo-verde',type:'button','data-k':'quota-segna',onclick:function(){openVersaQuota(x.mese,mia?io:null);}},mia?'La mia':'Segna')}));
  });
  // scorte da ricomprare
  var low=lowStock();
  if(low.length)urg.push(rigaFare({ic:'scatola',titolo:low.length+(low.length===1?' prodotto da ricomprare':' prodotti da ricomprare'),
    sotto:low.slice(0,4).map(function(x){return x.name;}).join(', ')+(low.length>4?'…':''),
    azione:h('button',{class:'pill sm',type:'button',onclick:function(){go('reparto','scorte');}},'Lista')}));
  // graffi vecchi
  var x=extra(),vecchi=Object.keys(x.v);
  if(vecchi.length){
    var totV=vecchi.reduce(function(n,id){return n+x.v[id].a;},0);
    urg.push(rigaFare({ic:'orologio',accesa:true,titolo:'Graffi vecchi: '+eur(totV),sotto:'Da più di '+S.cfg.graffiGiorni+' giorni: '+nomiLista(vecchi)+'.',
      azione:h('button',{class:'pill sm',type:'button','data-k':'apri-vecchi',onclick:function(){apriTicket();}},'Vedi')}));
  }
  // backup e telefoni
  if(backupOld())urg.push(rigaFare({ic:'nuvola',titolo:'Backup da fare',sotto:'Ultimo: '+backupLine()+'. È una copia in più dei dati.',
    azione:h('button',{class:'pill sm',type:'button',onclick:function(){go('reparto','backup');}},'Fallo')}));
  if(SYNC&&SST.stato==='errore')urg.push(rigaFare({ic:'rete',accesa:true,titolo:'Telefoni non collegati',sotto:'Quello che segni resta su questo telefono e parte appena torna il collegamento.',
    azione:h('button',{class:'pill sm',type:'button',onclick:openSync},'Dettagli')}));
  var righe=[];
  urg.concat(ok).forEach(function(r,i){if(i)righe.push(h('div',{class:'riga-tratt'}));righe.push(r);});
  return h('section',{class:'cartella'},
    h('div',{class:'cart-h'},h('h2',{class:'etichetta'},'Faccende e cose da fare'),h('span',{class:'timbro'+(urg.length?'':' ok')},urg.length?(urg.length===1?'1 da fare':urg.length+' da fare'):'A posto')),
    h('div',{class:'riga-tratt'}),righe);
}
function openRifiuti(){
  var k=openKey(),fr=rifiutiSerata(S.cfg,k);
  var chi=chipSel(peopleOpts(),[],true);
  formSheet('Chi ha portato giù i rifiuti?',[
    h('p',{class:'aiuto'},'Stasera: '+nomiFraz(fr)+'. Conta per la classifica della spazzatura.'),
    gruppo('Chi li ha portati giù',chi)],function(){
    var ids=chi.get();
    if(!ids.length)return 'Scegli chi li ha portati giù.';
    var rec={id:'r'+k,s:k,p:ids,f:fr.slice(),t:Date.now()};   // una sola uscita per serata, anche da due telefoni
    S.trash=S.trash.filter(function(r){return r.s!==k;});S.trash.push(rec);commit();
    toast('Rifiuti fuori: grazie '+nomiLista(ids)+'.',function(){S.trash=S.trash.filter(function(r){return r!==rec;});commit();toast('Annullato.');});
  },'Segna');
}
function openPulizia(){
  var chi=chipSel(peopleOpts(),[],true);
  var quando=h('select',{class:'inp',id:'pu-q'},[0,1,2,3,4,5,6,7,8,9,10,11,12,13].map(function(n){return h('option',{value:String(n)},n===0?'Oggi':n===1?'Ieri':n+' giorni fa');}));
  formSheet('Pulizia fatta',[
    h('p',{class:'aiuto'},'Da qui riparte il conto: l’avviso torna dopo '+S.cfg.puliziaGiorni+' giorni.'),
    campo('Quando',quando,'pu-q'),
    gruppo('Chi ha pulito (facoltativo)',chi)],function(){
    var d=new Date();d.setDate(d.getDate()-(+quando.value||0));
    var rec={id:'c'+rid(),t:d.getTime(),p:chi.get()};
    S.cleanings.push(rec);S.cleanings.sort(function(a,b){return a.t-b.t;});commit();
    toast('Pulizia segnata.',function(){S.cleanings=S.cleanings.filter(function(c){return c!==rec;});commit();toast('Annullato.');});
  },'Segna la pulizia');
}

/* ---------- triage: chi sta peggio ---------- */
function votiSerata(k){return S.votes.filter(function(v){return v.s===k;});}
function votiValidi(k){return votiSerata(k).filter(function(v){return votoConta(S,v);});}
function nomiLista(ids){
  var n=ids.map(pName);
  return n.length<2?n.join(''):n.slice(0,-1).join(', ')+' e '+n[n.length-1];
}
/* come si vota lo sceglie l'admin: podio (1°, 2°, 3°: 3, 2 e 1 punto) oppure «fino a N persone» (1 punto a testa).
   Con il podio «votiMax» resta 3, così anche i telefoni non ancora aggiornati lasciano tre voti. */
function podio(){return S.cfg.voto!=='n';}
function votiMassimi(){return podio()?3:(S.cfg.votiMax||1);}
var POSTI=['1°','2°','3°'];
function puntiTxt(n){return n+(n===1?' punto':' punti');}
function descrVoto(v){
  var cs=candidatiVoto(v);
  return cs.map(function(c,i){return (v.m==='p'&&cs.length>1?POSTI[i]+' ':'')+pName(c);}).join(', ');
}
/* da questo telefono si vota solo per sé (il padrone del telefono) e per i visitatori senza codice ospite (gli ospiti
   votano dal loro telefono). L'ospite vota solo per sé. */
function puoVotare(chi){return !!chi&&(chi===mio()||(!ospite()&&isVisitor(chi)&&!codiceOspite(person(chi))));}
function puoTogliere(){return isAdmin();}
function nonPuoiVotare(){toast(ospite()?'Da questo telefono voti solo tu.':mio()?'Da questo telefono vota solo '+pName(mio())+', più i visitatori.':'Per votare entra con il tuo nome.');}
/* il voto di «chi» nella serata: cs = i votati in ordine, cy = i sintomi di ognuno; cs vuoto = toglie il voto.
   Un documento per votante e serata: stesso voto = stesso documento su tutti i telefoni. */
function salvaVoto(chi,cs,cy){
  if(!puoVotare(chi)){nonPuoiVotare();return;}
  var k=openKey(),v=S.votes.find(function(x){return x.s===k&&x.v===chi;});
  var prima=v?JSON.parse(JSON.stringify(v)):null;
  if(!cs.length){if(!v)return;S.votes.splice(S.votes.indexOf(v),1);}
  else{
    if(!v){v={id:'v'+k+'_'+chi,s:k,v:chi,t:Date.now()};S.votes.push(v);}
    v.t=Date.now();metiVoto(v,cs,cy);
    if(podio())v.m='p';else delete v.m;
    var io=mio();if(io)v.da=io;else delete v.da;
    if(vaConfermato(chi,io,isAdmin()))v.dc=1;else delete v.dc;
  }
  commit();tocco();
  toast(cs.length?pName(chi)+(prima?' cambia voto: ':' vota ')+descrVoto(v):'Tolto il voto di '+pName(chi)+'.',function(){
    var j=v?S.votes.indexOf(v):-1;
    if(prima){if(j>=0){Object.keys(v).forEach(function(x){delete v[x];});Object.assign(v,prima);}else S.votes.push(prima);}
    else if(j>=0)S.votes.splice(j,1);
    commit();toast('Annullato.');
  });
}
function togliVoto(v,c){
  if(!puoTogliere()){toast('I voti li toglie solo l’admin.');return;}
  var cs=candidatiVoto(v).filter(function(x){return x!==c;}),cy=sintomiDiVoto(v);delete cy[c];
  if(!cs.length){var j=S.votes.indexOf(v);if(j>=0)S.votes.splice(j,1);}
  else{metiVoto(v,cs,cy);v.t=Date.now();}
  commit();toast('Tolto il voto di '+pName(v.v)+' a '+pName(c)+'.');
}
function ultimoVerdetto(){
  var ch=serateChiuse(S,openKey()),ks=Object.keys(ch).sort();
  for(var i=ks.length-1;i>=0;i--)if(ch[ks[i]].n)return {k:ks[i],sm:ch[ks[i]]};
  return null;
}
function testoPodio(sm){
  return podioSerata(sm).filter(function(x){return x.pos<=3;}).map(function(x){return x.pos+'° '+pName(x.id);}).join(', ');
}
function nomeSerataDi(k){return nomeSerata(k)==='ieri sera'?'Ieri sera':'La '+nomeSerata(k);}
function ordineVoti(sm){
  return Object.keys(sm.tally).sort(function(a,b){return sm.tally[b]-sm.tally[a]||pName(a).localeCompare(pName(b));});
}
function cardTriage(){
  var k=openKey(),sm=voteSummary(votiValidi(k)),io=mio(),ord=ordineVoti(sm);
  var tuo=io?S.votes.find(function(v){return v.s===k&&v.v===io;}):null,perso=!io&&lsGet(KEY+'.io')&&person(lsGet(KEY+'.io'));
  var ver=ultimoVerdetto();
  var diag=ver&&ver.sm.winners.length===1?topSintomi(ver.sm.sint[ver.sm.winners[0]],3):[];
  return h('section',{class:'triage'},
    h('div',{class:'cart-h'},h('h2',{class:'tri-t'},'Triage: chi sta peggio?'),h('span',{class:'timbro scuro'},sm.n+(sm.n===1?' votante':' votanti'))),
    h('p',{class:'tri-s'},(podio()?'Podio: il 1° vale 3 punti, il 2° 2, il 3° 1. ':votiMassimi()>1?'Ognuno vota fino a '+votiMassimi()+' persone, 1 punto a testa. ':'Un voto a testa. ')+'Ognuno vota dal suo telefono. Si chiude '+chiusuraTxt()+'.'),
    ord.length?h('ol',{class:'tri-podio'},ord.slice(0,3).map(function(c){
      return h('li',{class:sm.winners.indexOf(c)>=0?'testa':null},ava(c,'sm'),h('span',{class:'nome'},pName(c)),h('span',{class:'tri-v'},puntiTxt(sm.tally[c])));
    })):h('p',{class:'tri-s'},'Ancora nessun voto stasera.'),
    io?h('p',{class:'tri-s forte'},tuo?'Il tuo voto: '+descrVoto(tuo)+'.':'Non hai ancora votato.')
      :h('p',{class:'tri-s forte'},perso?'Questo telefono non è più di '+pName(lsGet(KEY+'.io'))+': lo ha preso un altro telefono. Chiedi all’admin.':'Per votare entra con il tuo nome.'),
    h('div',{class:'azioni'},
      io?h('button',{class:'pill duo-rosa',type:'button','data-k':'vota',onclick:function(){openVoto(io);}},tuo?'Cambia il tuo voto':'Vota')
        :null,
      ospite()?null:h('button',{class:'pill sm',type:'button','data-k':'vota-visitatore',onclick:openVotoVisitatore},'Voto di un visitatore')),
    ver?h('div',{class:'verdetto'},ver.sm.winners.length===1?ava(ver.sm.winners[0],'sm'):null,
      h('p',null,h('b',null,nomeSerataDi(ver.k)+': '),testoPodio(ver.sm)+' ('+ver.sm.n+(ver.sm.n===1?' votante':' votanti')+').',
        diag.length?[h('br'),'Diagnosi di '+pName(ver.sm.winners[0])+': '+diag.map(function(x){return x.toLowerCase();}).join(', ')+'.']:null)):null,
    h('div',{class:'azioni'},
      h('button',{class:'pill sm',type:'button',disabled:!votiSerata(k).length,onclick:openVoti},'Vedi i voti'),
      h('button',{class:'pill sm',type:'button',onclick:function(){UI.cl='triage';go(UI.tab,'classifiche');}},'Classifiche')));
}
/* nel Reparto il triage è una riga: com'è finita ieri sera e il pulsante per votare (il triage intero è in Ludoteca) */
function rigaTriage(){
  var k=openKey(),io=mio(),tuo=io?S.votes.find(function(v){return v.s===k&&v.v===io;}):null,ver=ultimoVerdetto();
  return h('section',{class:'triage riga-triage'},
    h('div',{class:'linea'},ver&&ver.sm.winners.length===1?ava(ver.sm.winners[0],'sm'):null,
      h('p',{class:'tri-s cresce1'},ver?[h('b',null,'Codice rosso '+(nomeSerata(ver.k)==='ieri sera'?'di ieri sera':'della '+nomeSerata(ver.k))+': '+nomiLista(ver.sm.winners)),h('br')]:null,
        tuo?'Stasera hai già votato.':'Stasera non hai ancora votato.'),
      h('button',{class:'pill sm',type:'button','data-k':'vota-rep',onclick:function(){if(io)openVoto(io);else go('ludoteca');}},tuo?'Cambia':'Vota')));
}
/* il voto: si toccano le persone in ordine (1°, 2°, 3°), sotto ognuna i suoi sintomi, poi «Vota» */
function openVoto(chi){
  if(!puoVotare(chi)){nonPuoiVotare();return;}
  var k=openKey(),v=S.votes.find(function(x){return x.s===k&&x.v===chi;});
  var max=votiMassimi(),pod=podio(),cs=v?candidatiVoto(v).slice(0,max):[],cy=v?sintomiDiVoto(v):{};
  var live=function(){
    var chips=h('div',{class:'chips'},people().map(function(p){
      var i=cs.indexOf(p.id);
      return h('button',{type:'button',class:'chip con-ava'+(p.kind==='amico'?' amico':''),'data-k':'vt-'+p.id,'aria-pressed':String(i>=0),disabled:p.id===chi&&!S.cfg.selfVote,
        onclick:function(){
          if(i>=0){cs.splice(i,1);delete cy[p.id];}
          else if(cs.length<max)cs.push(p.id);
          else if(max===1){delete cy[cs[0]];cs=[p.id];}
          else{toast(pod?'Hai già scelto i tre del podio: tocca uno di loro per toglierlo.':'Puoi votare fino a '+max+' persone: tocca uno dei tuoi per toglierlo.');return;}
          tocco();refreshSheet();}},
        i>=0&&pod?h('b',{class:'posto'},POSTI[i]):null,ava(p.id,'xs'),nomeP(p));
    }));
    var righe=cs.map(function(c,i){
      var sy=S.cfg.sintomi.length?chipSel(S.cfg.sintomi.map(function(s){return {v:s,label:s,cls:'sm'};}),cy[c]||[],true):null;
      if(sy)sy.addEventListener('change',function(){cy[c]=sy.get();});
      return h('div',{class:'voto-posto'},
        h('div',{class:'linea'},pod?h('b',{class:'posto'},POSTI[i]):null,ava(c,'xs'),h('span',{class:'nome cresce1'},pName(c)),pod?h('span',{class:'tri-v'},puntiTxt(3-i)):null),
        sy?gruppo('Sintomi (facoltativi)',sy):null);
    });
    return [
      h('p',{class:'aiuto'},(pod?'Tocca chi sta peggio, in ordine: il primo tocco è il 1°, poi il 2° e il 3°. Ritocca un nome per toglierlo.':max>1?'Tocca chi sta peggio, fino a '+max+' persone: ognuna prende 1 punto.':'Tocca chi sta peggio.')+' Fino alla chiusura, '+chiusuraTxt()+', il voto si cambia.'),
      gruppo(pod?'Il podio':'Chi sta peggio',chips),
      righe,
      h('div',{class:'azioni'},
        h('button',{class:'pill duo-verde largo',type:'button','data-k':'salva-voto',disabled:!cs.length,onclick:function(){closeSheet();salvaVoto(chi,cs.slice(),cy);}},v?'Salva il voto':'Vota'))];
  };
  openSheet(chi===mio()?'Il tuo voto':'Voto di '+pName(chi),live(),live);
}
/* i visitatori non hanno l'app: il loro voto si segna da qualsiasi telefono */
function openVotoVisitatore(){
  var live=function(){
    var vis=people().filter(function(p){return p.kind==='amico'&&!p.pin;});
    return [
      h('p',{class:'aiuto'},'I visitatori votano dal telefono di uno di voi. Scegli chi vota. Gli ospiti con il codice votano dal loro telefono.'),
      vis.length?h('div',{class:'chips'},vis.map(function(p){
        return h('button',{type:'button',class:'chip con-ava amico','data-k':'vv-'+p.id,onclick:function(){closeSheet();openVoto(p.id);}},ava(p.id,'xs'),nomeP(p));
      })):h('p',{class:'vuoto'},'Nessun visitatore in reparto.'),
      h('div',{class:'azioni'},h('button',{type:'button',class:'chip piu','data-k':'nuovo-visitatore',onclick:function(){openPerson(null,function(id){setTimeout(function(){if(id)openVoto(id);},60);});}},'+ Nuovo visitatore'))];
  };
  openSheet('Voto di un visitatore',live(),live);
}
function openVoti(){
  var live=function(){
    var k=openKey(),list=votiSerata(k),sm=voteSummary(list.filter(function(v){return votoConta(S,v);}));
    if(!list.length)return [h('p',{class:'vuoto'},'Nessun voto stasera.')];
    var ord=ordineVoti(sm);
    return [
      h('p',{class:'aiuto'},'Voto palese. Si chiude '+chiusuraTxt()+': fino ad allora ognuno cambia il suo voto dal suo telefono. I voti li toglie solo l’admin.'),
      h('div',{class:'barre'},ord.map(function(c){
        var n=sm.tally[c];
        return h('div',{class:'barra'},ava(c,'xs'),h('span',{class:'barra-n'},pName(c)),
          h('span',{class:'barra-b'},h('i',{style:'width:'+Math.round(n/sm.max*100)+'%'})),h('span',{class:'barra-v'},String(n)));
      })),
      h('div',{class:'riga-tratt'}),
      h('span',{class:'etichetta'},'Chi ha votato chi'),
      h('ul',{class:'righe'},list.map(function(v){
        var conta=votoConta(S,v);
        return candidatiVoto(v).map(function(c,i){
          var sy=sintomiPer(v,c),pt=puntiVoto(v,i);
          var note=[v.m==='p'?POSTI[i]+', '+puntiTxt(pt):'',sy.join(', '),i===0&&!conta?'non conta: segnato dal telefono di '+(v.da?pName(v.da):'nessuno'):'',i===0&&conta&&v.dc?'da confermare, segnato da '+pName(v.da):''].filter(Boolean).join(' · ');
          return h('li',{class:conta&&pt?null:'spento'},h('div',{class:'riga'},
            h('span',{class:'ora'},i===0?hm(v.t):''),
            h('span',{class:'cresce'},h('span',{class:'nome'},pName(v.v)+' → '+pName(c)),note?h('span',{class:'sotto'},note):null),
            puoTogliere()?h('button',{type:'button',class:'pill sm','data-k':'togli-'+v.v+'-'+c,onclick:function(){togliVoto(v,c);}},'Togli'):null));
        });
      }))];
  };
  openSheet('Voti di stasera',live(),live);
}

/* ---------- operazioni da confermare (dalla 0.16.0): solo l'admin ---------- */
function descrOp(op){
  if(op.voto)return {t:'Voto di '+pName(op.voto.v)+' (visitatore)',s:descrVoto(op.voto),a:null};
  var m=op.mv.find(function(x){return x.dc;})||op.mv[0],inf=moveInfo(m);
  if(m.pc)return {t:pName(m.p)+' prende dalla cassa',s:m.note||'',a:eur(toInt(m.a))};
  return {t:'Sul ticket di '+pName(m.p),s:inf.s,a:eur(toInt(m.a))};
}
function bottoniConferma(op){
  return h('div',{class:'azioni'},
    h('button',{class:'pill sm duo-verde',type:'button','data-k':'conferma-'+op.id,onclick:function(){
      if(!isAdmin()){toast('Lo conferma solo l’admin.');return;}
      confermaOp(op);commit();refreshSheet();toast('Confermata.');}},'Conferma'),
    h('button',{class:'pill sm pericolo',type:'button','data-k':'sospetta-'+op.id,onclick:function(){
      if(!isAdmin()){toast('La annulla solo l’admin.');return;}
      var vecchio=op.voto?JSON.parse(JSON.stringify(op.voto)):null;
      annullaOp(S,op,Date.now());commit();refreshSheet();
      toast(op.voto?'Voto tolto.':'Annullata: resta nel registro come sospetta.',function(){
        if(op.voto)S.votes.push(vecchio);else op.mv.forEach(function(m){delete m.x;delete m.xm;});
        commit();refreshSheet();toast('Rimessa da confermare.');});}},'Annulla operazione sospetta'));
}
function openConferme(){
  if(!isAdmin()){toast('Le operazioni da confermare le vede solo l’admin.');return;}
  var live=function(){
    var l=daConfermare(S);
    if(!l.length)return [h('p',{class:'vuoto'},'Niente da confermare. Tutto a posto.')];
    return [h('p',{class:'aiuto'},'Segnate da qualcuno per conto di un altro. Contano già: conferma quelle giuste, annulla quelle sospette.'),
      h('ul',{class:'righe conferme'},l.map(function(op){
        var d=descrOp(op);
        return h('li',{class:'conferma'},
          h('div',{class:'riga'},h('span',{class:'ora'},GIORNI3[new Date(op.t).getDay()]+' '+hm(op.t)),
            h('span',{class:'cresce'},h('span',{class:'nome'},d.t),h('span',{class:'sotto'},[d.s,'segnato da '+(op.da?pName(op.da):'chi non si sa')].filter(Boolean).join(' · '))),
            d.a?h('span',{class:'importo rosso'},d.a):null),
          bottoniConferma(op));
      }))];
  };
  openSheet('Da confermare',live(),live);
}

/* ---------- vista: Farmacia ---------- */
function prodTile(p){
  var n=UI.pos.qty[p.id]||0,st=D.stock[p.id];
  var bump=UI.bump===p.id;if(bump)UI.bump=null;
  return h('div',{class:'prod'+(n?' on':'')},
    h('button',{type:'button',class:'prod-add','data-k':'add-'+p.id,onclick:function(e){tocco();UI.bump=p.id;UI.totBump=true;UI.pos.qty[p.id]=n+1;volaPiu(e.currentTarget);render();}},
      h('span',{class:'prod-n'},p.name),h('span',{class:'prod-p'},eur(p.price)),
      st!=null?h('span',{class:'prod-s'+(st<=0?' zero':p.min!=null&&st<=p.min?' poco':'')},st<=0?'finito':p.min!=null&&st<=p.min?'ultimi '+st+' pz':st+' pz'):null),
    n?h('button',{type:'button',class:'prod-less','data-k':'less-'+p.id,'aria-label':'Togli uno: '+p.name,onclick:function(){if(n<=1)delete UI.pos.qty[p.id];else UI.pos.qty[p.id]=n-1;render();}},'−'):null,
    n?h('span',{class:'prod-q'+(bump?' scatta':'')},String(n)):null);
}
function posClear(){UI.pos={p:null,qty:{},extra:[]};render();}
function contoAperto(){return !!UI.pos.p||posTotal().n>0;}
/* il conto della Farmacia non ancora registrato resta anche se si cambia pagina o si chiude l'app (per 3 giorni) */
function salvaConto(){lsSet(KEY+'.conto',contoAperto()?JSON.stringify({pos:UI.pos,t:Date.now()}):'');}
function riprendiConto(){
  var o;try{o=JSON.parse(lsGet(KEY+'.conto')||'null');}catch(e){o=null;}
  if(!o||!o.pos||Date.now()-toInt(o.t)>3*864e5)return;
  var p=o.pos,q={};
  Object.keys(p.qty||{}).forEach(function(id){var n=toInt(p.qty[id]);if(prod(id)&&n>0)q[id]=Math.min(99,n);});
  UI.pos={p:person(p.p)?p.p:null,qty:q,extra:(Array.isArray(p.extra)?p.extra:[]).filter(function(x){return x&&x.n&&toInt(x.pr)>0;}).map(function(x){return {n:str(x.n,40),pr:toInt(x.pr)};}).slice(0,20)};
}
/* registra il conto. kind: 'tab' (sul ticket), 'sale' (paga in contanti).
   dato: quanto ha dato in contanti. modo: 'resto' (gli si dà il resto), 'tieni' (la differenza scala i graffi o va in credito),
   'misto' (dà meno del conto: il resto va sul ticket) */
function tocco(ms){try{if(navigator.vibrate)navigator.vibrate(ms||8);}catch(e){}}
function posSave(kind,dato,modo){
  var pos=UI.pos,items=[],a=0;
  S.products.forEach(function(p){var q=pos.qty[p.id]||0;if(q){items.push({id:p.id,n:p.name,q:q,pr:p.price});a+=q*p.price;}});
  pos.extra.forEach(function(x){items.push({n:x.n,q:1,pr:x.pr});a+=x.pr;});
  if(!pos.p||!items.length)return;
  var who=pName(pos.p),chi=pos.p,t=Date.now(),g='g'+rid(),dc=vaConfermato(chi,mio(),isAdmin());
  UI.pos={p:null,qty:{},extra:[]};tocco([12,40,12]);
  function due(m1,m2,msg){
    S.moves.push(firma(m1),firma(m2));commit();
    toast(msg,function(){S.moves=S.moves.filter(function(m){return m!==m1&&m!==m2;});commit();toast('Annullato.');});
  }
  if(kind==='sale'&&modo==='tieni'&&dato>a){
    // ha dato più del conto e non vuole il resto: la differenza è un incasso sul suo ticket (scala i graffi; oltre, credito)
    var deb=Math.max(0,D.debt[chi]||0),ex=dato-a;
    due({id:rid(),t:t,k:'sale',p:chi,items:items,a:a,g:g},{id:rid(),t:t+1,k:'pay',p:chi,a:ex,note:'Dato in più pagando una consumazione',g:g},
      who+' ha dato '+eur(dato)+': '+eur(a)+' la consumazione, '+(ex<=deb?eur(ex)+' scalati dai graffi':(deb?eur(deb)+' chiudono i graffi e '+eur(ex-deb)+' in credito':eur(ex)+' in credito')));
    return;
  }
  if(kind==='misto'&&dato>0&&dato<a){
    // pagamento misto: tutto il conto va sul ticket e subito dopo entra in cassa quello che ha dato
    var mt={id:rid(),t:t,k:'tab',p:chi,items:items,a:a,g:g};if(dc)mt.dc=1;
    due(mt,{id:rid(),t:t+1,k:'pay',p:chi,a:dato,note:'Pagamento misto: contanti al momento',g:g},
      who+': '+eur(dato)+' in contanti e '+eur(a-dato)+' sul ticket'+(dc?' (da confermare)':''));
    return;
  }
  if(kind==='sale'&&modo==='resto'&&dato>a){
    addMove({k:'sale',p:chi,items:items,a:a},who+' ha pagato '+eur(a)+': resto da dare '+eur(dato-a));
    return;
  }
  if(kind==='tab'){addMove(dc?{k:'tab',p:chi,items:items,a:a,dc:1}:{k:'tab',p:chi,items:items,a:a},'Sul ticket di '+who+': '+eur(a)+(dc?' (da confermare)':''));return;}
  addMove({k:'sale',p:chi,items:items,a:a},who+' ha pagato in cassa: '+eur(a));
}
/* pagamento in contanti con il calcolo del resto, oppure misto (parte contanti, parte sul ticket) */
function openHaDato(){
  var pos=UI.pos,t=posTotal();if(!pos.p||!t.n)return;
  var chi=pos.p,deb=Math.max(0,D.debt[chi]||0),cred=Math.max(0,-(D.debt[chi]||0));
  var a=soldi('hd-a'),info=h('div',{class:'resto','aria-live':'polite'});
  var dove=chipSel([{v:'resto',label:'Gli do il resto'},{v:'tieni',label:deb?'Scala dai suoi graffi':'Lo lascia in credito'}],'resto');
  var boxDove=gruppo('Quello che ha dato in più',dove);
  function upd(){
    var v=parseEur(a.value);info.replaceChildren();boxDove.hidden=true;
    if(isNaN(v)){put(info,[h('p',{class:'aiuto'},'Scrivi quanto ti ha dato in contanti.')]);return;}
    if(v===0){put(info,[h('p',{class:'aiuto'},'Non dà niente adesso: usa «Sul ticket».')]);return;}
    if(v<t.a){put(info,[h('span',{class:'resto-n'},'Pagamento misto'),h('p',null,eur(v)+' in contanti adesso, '+eur(t.a-v)+' sul suo ticket.')]);return;}
    var ex=v-t.a;
    if(!ex){put(info,[h('span',{class:'resto-n'},'Paga giusto'),h('p',null,eur(t.a)+'.')]);return;}
    boxDove.hidden=false;
    if(dove.get()==='tieni'){
      put(info,[h('span',{class:'resto-n'},'Niente resto'),h('p',null,ex<=deb?eur(ex)+' scalano i graffi: '+(ex<deb?'ne restano '+eur(deb-ex)+'.':'chiusi tutti.'):(deb?eur(deb)+' chiudono i graffi e '+eur(ex-deb)+' vanno in credito.':eur(ex)+' vanno in credito per le prossime volte.'))]);
    }else put(info,[h('span',{class:'resto-n'},'Resto: '+eur(ex)),h('p',null,'Da dare a '+pName(chi)+'. In cassa entra solo il conto, '+eur(t.a)+'.')]);
  }
  function metti(v){a.value=c2s(v);upd();}
  a.addEventListener('input',upd);dove.addEventListener('change',upd);
  var tagli=[h('button',{type:'button',class:'chip sm',onclick:function(){metti(t.a);}},'Giusto')];
  if(deb)tagli.push(h('button',{type:'button',class:'chip sm',onclick:function(){metti(t.a+deb);dove.querySelectorAll('button')[1].click();}},'Conto + graffi: '+eur(t.a+deb)));
  [500,1000,2000,5000].forEach(function(v){if(v>t.a)tagli.push(h('button',{type:'button',class:'chip sm',onclick:function(){metti(v);}},eur(v)));});
  formSheet('Paga '+pName(chi),[
    h('dl',{class:'scheda'},h('dt',null,'Conto di adesso'),h('dd',null,eur(t.a)),h('dt',null,'Graffi aperti'),h('dd',{class:deb?'rosso':null},deb?eur(deb):(cred?'nessuno, è in credito di '+eur(cred):'nessuno'))),
    campo('Quanto ti dà in contanti',a,'hd-a'),h('div',{class:'tagli'},tagli),info,boxDove,
    h('p',{class:'aiuto'},'Se dà meno del conto, il resto va sul suo ticket (pagamento misto). Se dà di più, scegli se dargli il resto o tenere la differenza sui suoi graffi.')],function(){
    var v=parseEur(a.value);
    if(isNaN(v)||v<=0)return 'Scrivi quanto ti dà, per esempio 5,00. Se non dà niente usa «Sul ticket».';
    if(v<t.a)posSave('misto',v);
    else posSave('sale',v,v>t.a?dove.get():null);
  },'Registra il pagamento',{noBozza:true});
  upd();
}
/* Farmacia: tre linguette, Banco (si segna), Ticket, Ultime consumazioni */
function farm(){return UI.farm==='ticket'||UI.farm==='ultime'?UI.farm:'banco';}
function vFarmacia(){
  var t=farm();
  var out=[h('h2',{class:'titolo'},'Farmacia'),linguette('farm',[['banco','Banco'],['ticket','Ticket'],['ultime','Ultime']],t,function(v){UI.farm=v;render();window.scrollTo(0,0);})];
  return out.concat(t==='ticket'?corpoTicket():t==='ultime'?corpoUltime():corpoBanco());
}
function corpoUltime(){
  var ult=S.moves.filter(function(m){return !m.x&&(m.k==='sale'||m.k==='tab');}).slice(-30).reverse();
  return [h('section',{class:'cartella'},
    h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Ultime consumazioni'),h('button',{class:'pill sm',type:'button',onclick:function(){go('farmacia','cassa');}},'Registro')),
    h('div',{class:'riga-tratt'}),
    ult.length?h('ul',{class:'righe'},ult.map(function(m){return moveRow(m,true);})):h('p',{class:'vuoto'},'Ancora niente. La prima consumazione si segna dal Banco.'))];
}
function corpoBanco(){
  var pos=UI.pos,out=[];
  var chips=h('div',{class:'chips scorre',role:'group','aria-label':'Paziente'});
  people().forEach(function(p){
    chips.append(h('button',{type:'button',class:'chip con-ava'+(p.kind==='amico'?' amico':''),'data-k':'chi-'+p.id,'aria-pressed':String(pos.p===p.id),onclick:function(){tocco();pos.p=pos.p===p.id?null:p.id;render();}},ava(p.id,'sm'),h('span',{class:'chip-n'},nomeP(p))));
  });
  chips.append(h('button',{type:'button',class:'chip piu',onclick:function(){openPerson(null,function(id){UI.pos.p=id;});}},'+ Visitatore'));
  out.push(h('section',{class:'blocco'},h('h3',{class:'etichetta chiara'},'Chi è il paziente?'),chips));
  // il paziente scelto resta in vista nella riga che scorre
  if(pos.p)requestAnimationFrame(function(){var b=chips.querySelector('[aria-pressed="true"]'),x=b?b.offsetLeft-chips.offsetLeft:0;if(b&&(x<chips.scrollLeft||x+b.offsetWidth>chips.scrollLeft+chips.clientWidth))chips.scrollLeft=Math.max(0,x-16);});
  cats().forEach(function(c){
    var list=S.products.filter(function(p){return p.on&&p.cat===c;});
    if(!list.length)return;
    out.push(h('section',{class:'blocco'},h('h3',{class:'etichetta chiara'},c),h('div',{class:'prods'},list.map(prodTile))));
  });
  out.push(h('section',{class:'blocco'},
    h('h3',{class:'etichetta chiara'},'Fuori listino'),
    pos.extra.length?h('ul',{class:'extra'},pos.extra.map(function(x,i){
      return h('li',null,h('span',{class:'cresce1'},x.n+' · '+eur(x.pr)),
        h('button',{type:'button',class:'pill-x','aria-label':'Togli '+x.n,onclick:function(){pos.extra.splice(i,1);render();}},ic('x',20)));
    })):null,
    h('div',{class:'azioni'},h('button',{type:'button',class:'pill viola',onclick:openExtra},'Altro importo'))));
  var t=posTotal(),ok=!!pos.p&&t.n>0;
  if(pos.p||t.n>0){
    out.push(h('div',{class:'posbar'},h('div',{class:'posbar-in'},
      h('div',{class:'pos-tot'},h('span',{class:'pos-who'},pos.p?pName(pos.p):'Scegli il paziente'),
        h('span',{class:'pos-dx'},h('strong',{class:UI.totBump&&!(UI.totBump=false)?'scatta':null},t.n?eur(t.a)+' · '+t.n+(t.n===1?' pezzo':' pezzi'):'Scegli cosa prende'),
          ok?h('button',{type:'button',class:'link chiaro','data-k':'ha-dato',onclick:openHaDato},'Resto o pagamento misto'):null)),
      h('div',{class:'pos-btns'},
        h('button',{type:'button',class:'pill duo-verde',disabled:!ok,onclick:function(){posSave('tab');}},'Sul ticket'),
        h('button',{type:'button',class:'pill',disabled:!ok,onclick:function(){posSave('sale');}},'Paga subito'),
        h('button',{type:'button',class:'pill-x','aria-label':'Svuota la selezione',onclick:posClear},ic('x',20))))));
  }
  return out;
}
function openExtra(){
  var n=testo('ex-n','Es. panino, giro offerto',40),a=soldi('ex-a');
  formSheet('Altro importo',[campo('Cosa',n,'ex-n'),campo('Quanto',a,'ex-a')],function(){
    var v=parseEur(a.value),nome=n.value.trim();
    if(!nome)return 'Scrivi di cosa si tratta.';
    if(!(v>0))return 'Scrivi l’importo, per esempio 2,50.';
    UI.pos.extra.push({n:nome,pr:v});render();
  },'Aggiungi');
}

/* ---------- vista: Ticket ---------- */
function corpoTicket(){
  var x=extra(),dovuto=function(p){return Math.max(0,D.debt[p.id]||0)+arretrato(p.id);};
  var list=people(true).filter(function(p){return p.on||(D.debt[p.id]||0)!==0||arretrato(p.id)>0;});
  list.sort(function(a,b){return (dovuto(b)-dovuto(a))||((D.debt[b.id]||0)-(D.debt[a.id]||0));});
  var tot=list.reduce(function(s,p){return s+dovuto(p);},0),totQ=list.reduce(function(s,p){return s+arretrato(p.id);},0);
  // chi non deve niente e non è in credito va in fondo, nel gruppo «In pari»
  var aperti=list.filter(function(p){return dovuto(p)>0||(D.debt[p.id]||0)<0;}),pari=list.filter(function(p){return aperti.indexOf(p)<0;});
  var vecchi=people(true).filter(function(p){return x.v[p.id];}).sort(function(a,b){return x.v[b.id].a-x.v[a.id].a;});
  var out=[];
  if(vecchi.length)out.push(h('section',{class:'cartella allarme'},
    h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Graffi vecchi'),h('span',{class:'timbro'},'Da più di '+S.cfg.graffiGiorni+' giorni')),
    h('div',{class:'riga-tratt'}),
    h('ul',{class:'righe'},vecchi.map(function(p){
      var v=x.v[p.id];
      return h('li',null,h('button',{type:'button',class:'riga',onclick:function(){openCartella(p.id);}},ava(p.id,'sm'),
        h('span',{class:'cresce'},h('span',{class:'nome'},nomeP(p)),h('span',{class:'sotto'},'il più vecchio è del '+dShortT(v.da)+', '+v.giorni+' giorni fa')),
        h('span',{class:'importo rosso'},eur(v.a))));
    })),
    h('p',{class:'aiuto'},'Contano dal più vecchio: chi paga chiude prima questi.')));
  out.push(h('section',{class:'cartella'},
      h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Ticket non pagati'),h('strong',{class:'importo '+(tot?'rosso':'spento')},eur(tot))),
      totQ?h('p',{class:'aiuto'},'Di cui quota del locale non pagata: '+eur(totQ)+'. Va nel fondo, non in cassa.'):null,
      h('div',{class:'riga-tratt'}),
      h('ul',{class:'righe'},aperti.map(function(p){return personRow(p,true);})),
      pari.length?h('details',{class:'in-pari'},h('summary',null,'In pari',h('span',{class:'tag'},String(pari.length))),
        h('ul',{class:'righe'},pari.map(function(p){return personRow(p,true);}))):null,
      h('p',{class:'aiuto'},'Una tacca per ogni consumazione non ancora pagata. Tocca un nome per incassare o segnare soldi presi dalla cassa.'),
      h('div',{class:'azioni'},h('button',{class:'pill',type:'button',onclick:function(){openPerson(null);}},'+ Visitatore'))));
  return out;
}
function openCartella(id){
  var live=function(){
    var p=S.people.find(function(x){return x.id===id;});
    if(!p)return [h('p',{class:'vuoto'},'Paziente non trovato.')];
    var d=D.debt[id]||0,u=D.units[id]||0,k=openKey(),vec=extra().v[id],qa=quoteAperte(id);
    var hist=S.moves.filter(function(m){return m.p===id||m.paidBy===id||(m.shares&&(id in m.shares));}).slice(-30).reverse();
    var re=statRe(S,'sempre',k).by[id],fr=statFreccette(S,'sempre',k,S.cfg.voteCut)[id],co=statConsumi(S,'mese',k,S.cfg.voteCut)[id];
    var foto=imgSrc(p,true);
    return [
      h('div',{class:'cart-top'},
        foto?h('figure',{class:'segnaletica'},h('img',{src:foto,alt:'Caricatura di '+nomeP(p)})):ava(id,'grande'),
        h('dl',{class:'scheda'},
          h('dt',null,'Codici rossi'),h('dd',null,re&&re.rossi?String(re.rossi):'nessuno'),
          h('dt',null,'Freccette'),h('dd',null,fr&&fr.gare?fr.vinte+(fr.vinte===1?' vinta su ':' vinte su ')+fr.gare:'mai giocato'),
          h('dt',null,'Consumi del mese'),h('dd',null,co?eur(co.eur)+' · '+co.pz+' pz':'niente'),
          h('dt',null,'Spazzatura'),h('dd',null,(function(x){return x?x.n+(x.n===1?' volta':' volte'):'mai';})(statSpazzatura(S,'sempre',k)[id])),
          (function(t){return t.length?[h('dt',null,t.length>1?'Sintomi prevalenti':'Sintomo prevalente'),h('dd',null,t.join(', '))]:null;})(topSintomi(sintomiDi(S,id),2)),
          p.nato?[h('dt',null,'Compleanno'),h('dd',null,dataBreve('2000-'+p.nato))]:null)),
      medaglieDi(id),
      h('div',{class:'riga-tratt'}),
      h('div',{class:'cart-h'},h('span',{class:'etichetta'},d<0?'È in credito di':'Deve al reparto'),h('span',{class:'cifrona '+(d>0?'rosso':d<0?'verde':'')},eur(Math.abs(d)))),
      d>0?tally(u):null,
      vec?h('p',{class:'avviso-riga'},eur(vec.a)+' di graffi hanno più di '+S.cfg.graffiGiorni+' giorni: il più vecchio è del '+dShortT(vec.da)+'.'):null,
      qa.length?h('ul',{class:'righe quota-righe'},qa.map(function(q){
        return h('li',null,h('div',{class:'riga'},h('span',{class:'cresce'},h('span',{class:'nome'},'Quota locale · '+meseNome(q.mese)),
          h('span',{class:'sotto'+(q.scaduta?' rosso':'')},q.scaduta?'scaduta il '+dataBreve(q.scad)+': è nei suoi graffi, a parte':'da portare entro il '+dataBreve(q.scad))),
          h('span',{class:'importo'+(q.scaduta?' rosso':'')},eur(q.resto))));
      })):null,
      h('button',{class:'pill duo-verde largo',type:'button',disabled:d<=0&&!qa.length,onclick:function(){openPay(id);}},'Incassa'),
      // correzioni a mano del debito, senza soldi: solo l'admin (usate al posto di «Incassa» sballano la cassa)
      isAdmin()?h('div',{class:'azioni'},
        h('button',{class:'pill sm',type:'button',onclick:function(){openDebt(id,1);}},'+ Debito'),
        h('button',{class:'pill sm',type:'button',onclick:function(){openDebt(id,-1);}},'− Debito')):null,
      h('div',{class:'azioni secondarie'},
        h('button',{class:'pill sm',type:'button','data-k':'prende',onclick:function(){openPrende(id);}},'Prende dalla cassa'),
        h('button',{class:'pill sm',type:'button',onclick:function(){UI.pos.p=id;closeSheet();go('farmacia');}},'Segna consumazione'),
        h('button',{class:'pill sm',type:'button',onclick:function(){soloAdmin(function(){openPerson(id);});}},'Nome e faccia')),
      h('div',{class:'riga-tratt'}),
      h('span',{class:'etichetta'},'Storia clinica'),
      hist.length?h('ul',{class:'righe'},hist.map(function(m){return moveRow(m,true);})):h('p',{class:'vuoto'},'Cartella pulita.')
    ];
  };
  openSheet('Cartella di '+pName(id),live(),live);
}
/* incasso da una persona. Se ha anche la quota del locale da versare, chi incassa sceglie per cosa sono i soldi:
   le consumazioni vanno in cassa, la quota va nel fondo (nessuna scelta automatica) */
function openPay(id){
  var d=Math.max(0,D.debt[id]||0),qa=quoteAperte(id),a=soldi('py-a',qa.length?null:d);
  var per=qa.length?chipSel([{v:'graffi',label:'Consumazioni'+(d?' ('+eur(d)+')':'')}].concat(qa.map(function(q){return {v:'q:'+q.mese,label:'Quota '+meseNome(q.mese)+' ('+eur(q.resto)+')'};})),null):null;
  if(per)per.addEventListener('change',function(){
    var x=per.get();if(!x)return;
    var q=qa.find(function(z){return 'q:'+z.mese===x;});
    a.value=c2s(x==='graffi'?d:q.resto);
  });
  formSheet('Incassa da '+pName(id),[
    h('p',{class:'aiuto'},'Ticket aperto: '+eur(d)+'. '+(qa.length?'Quota del locale da versare: '+qa.map(function(q){return meseNome(q.mese)+' '+eur(q.resto);}).join(', ')+'.':'I soldi entrano nella cassa della farmacia.')),
    per?gruppo('Per cosa sono questi soldi',per):null,
    campo('Quanto versa',a,'py-a'),
    per?h('p',{class:'aiuto'},'Le consumazioni entrano in cassa; la quota va nel fondo del locale, a parte. Se porta soldi per tutte e due, fai due incassi.'):null],function(){
    var v=parseEur(a.value),x=per?per.get():'graffi';
    if(!x)return 'Scegli se sono per le consumazioni o per la quota del locale.';
    if(!(v>0))return 'Scrivi quanto versa, per esempio 5,00.';
    if(x==='graffi')addMove({k:'pay',p:id,a:v},'Incassati '+eur(v)+' da '+pName(id));
    else{var m=x.slice(2);addMove({k:'qin',p:id,a:v,mese:m},'Quota di '+meseNome(m)+': '+eur(v)+' da '+pName(id)+', nel fondo');}
  },'Incassa');
}
function openDebt(id,segno){conPin(function(){openDebt_(id,segno);},segno>0?'Aggiungere un debito a mano':'Togliere un debito a mano');}
function openDebt_(id,segno){
  var a=soldi('db-a'),n=testo('db-n','Es. vecchio conto, scommessa persa',80);
  formSheet((segno>0?'Aggiungi debito a ':'Togli debito a ')+pName(id),[
    h('p',{class:'aiuto'},segno>0?'Il debito sale senza toccare la cassa.':'Il debito scende senza che entrino soldi in cassa: per un pagamento usa «Incassa».'),
    campo('Importo',a,'db-a'),campo('Motivo',n,'db-n')],function(){
    var v=parseEur(a.value);
    if(!(v>0))return 'Scrivi l’importo, per esempio 3,00.';
    addMove({k:segno>0?'dplus':'dminus',p:id,a:v,note:n.value.trim()},(segno>0?'Debito aggiunto a ':'Debito tolto a ')+pName(id)+': '+eur(v));
  },segno>0?'Aggiungi':'Togli');
}
/* prende dalla cassa: soldi che una persona si porta via e deve restituire. Due movimenti insieme (debito a lui,
   uscita dalla cassa, segnati «pc»), che anche i telefoni non aggiornati contano giusti: la cassa scende, il ticket
   sale, il previsionale non cambia e non è una spesa del locale. Si annullano insieme. */
function openPrende(id){conPin(function(){openPrende_(id);},'Prendere soldi dalla cassa');}
function openPrende_(id){
  var a=soldi('pr-a'),n=testo('pr-n','Es. pizza',80);
  formSheet(pName(id)+' prende dalla cassa',[
    h('p',{class:'aiuto'},'I soldi escono dalla cassa e vanno sul suo ticket: li restituisce con «Incassa».'),
    campo('Quanto prende',a,'pr-a'),campo('Per cosa',n,'pr-n')],function(){
    var v=parseEur(a.value),nota=n.value.trim();
    if(!(v>0))return 'Scrivi quanto prende, per esempio 10,00.';
    var t=Date.now(),g='g'+rid(),m1={id:rid(),t:t,k:'dplus',p:id,a:v,note:nota,g:g,pc:1},m2={id:rid(),t:t+1,k:'exp',a:v,note:nota,cat:'Preso dalla cassa',paidBy:'cassa',g:g,pc:1};
    if(vaConfermato(id,mio(),isAdmin()))m1.dc=1;
    S.moves.push(firma(m1),firma(m2));commit();
    toast(pName(id)+' ha preso '+eur(v)+' dalla cassa: sul suo ticket'+(m1.dc?' (da confermare)':''),function(){S.moves=S.moves.filter(function(m){return m!==m1&&m!==m2;});commit();toast('Annullato.');});
  },'Prende');
}
function openPerson(id,after){
  var p=id?S.people.find(function(x){return x.id===id;}):null;
  var n=testo('pe-n','Nome o soprannome',24,p?p.name:'');
  var kind=chipSel([{v:'paziente',label:'Paziente'},{v:'amico',label:'Visitatore'}],p?p.kind:'amico');
  var on=h('input',{type:'checkbox',id:'pe-on',checked:p?p.on:true});
  var noq=h('input',{type:'checkbox',id:'pe-noq',checked:!!(p&&p.noq)});
  var faccia=sceltaFaccia(p);
  // PIN e telefono: solo per i pazienti già in elenco (li vede solo l'admin)
  var pinBox=p&&p.kind==='paziente'?h('div',{class:'campo'},h('span',{class:'lab'},'PIN e telefono'),
    h('p',{class:'aiuto'},(p.pin?'Ha il suo PIN. ':'Non ha ancora un PIN. ')+(p.tel?(p.tel===devId()?'Il suo telefono è questo.':'Ha il suo telefono.'):'Nessun telefono collegato.')+(p.pin?' '+vistoTxt(p).charAt(0).toUpperCase()+vistoTxt(p).slice(1)+'.':'')),
    h('div',{class:'azioni'},
      p.pin?h('button',{type:'button',class:'pill sm','data-k':'pe-azzera',onclick:function(){
        delete p.pin;commit();toast('PIN di '+pName(p.id)+' azzerato: al prossimo accesso ne crea uno nuovo.');closeSheet();}},'Azzera il PIN'):null,
      p.tel?h('button',{type:'button',class:'pill sm','data-k':'pe-scollega',onclick:function(){
        delete p.tel;commit();toast(pName(p.id)+' scollegato dal suo telefono: rientra con il suo PIN su qualsiasi telefono.');closeSheet();}},'Scollega il telefono'):null)):null;
  // codice ospite: lo crea l'admin e lo dà al visitatore, che entra dal suo telefono (dalla 0.15.0)
  if(p&&p.kind==='amico')pinBox=h('div',{class:'campo'},h('span',{class:'lab'},'Accesso ospite'),
    h('p',{class:'aiuto'},p.pin?'Ha il codice ospite: entra dal suo telefono e vede solo Ludoteca e Classifiche. '+(p.tel?'È già entrato.':'Non è ancora entrato.'):'Senza codice non entra nell’app: a segnare a suo nome è uno di voi.'),
    h('div',{class:'azioni'},
      h('button',{type:'button',class:'pill sm','data-k':'pe-codice',onclick:function(){closeSheet();setTimeout(function(){openCodiceOspite(p.id);},60);}},p.pin?'Nuovo codice ospite':'Crea codice ospite'),
      p.pin?h('button',{type:'button',class:'pill sm pericolo','data-k':'pe-togli',onclick:function(){
        var q=person(p.id)||p;delete q.pin;delete q.tel;commit();toast(pName(p.id)+' non entra più come ospite.');closeSheet();}},'Togli accesso'):null));   // la persona può essere arrivata nuova da un altro telefono mentre il foglio era aperto
  formSheet(p?'Modifica '+nomeP(p):'Nuovo visitatore',[
    campo('Nome',n,'pe-n'),
    gruppo('Tipo',kind),
    h('div',{class:'campo'},h('span',{class:'lab'},'Faccia'),faccia,
      h('p',{class:'aiuto'},'Ogni caricatura va a una persona sola: se la scegli qui, la togli a chi l’aveva. «Dal telefono» prende una foto dalla galleria'+(SYNC&&remote?' e la manda anche agli altri telefoni.':' e la tiene solo su questo dispositivo.'))),
    p?h('label',{class:'spunta',for:'pe-on'},on,'Ancora in reparto'):null,
    p&&p.kind==='paziente'?h('label',{class:'spunta',for:'pe-noq'},noq,'Non paga la quota del locale'):null,
    pinBox,
    p?null:h('p',{class:'aiuto'},'Il visitatore entra nell’elenco dei ticket: a segnare a suo nome sarà sempre uno di voi.')],function(){
    var nome=n.value.trim();
    if(!nome)return 'Scrivi un nome.';
    if(S.people.some(function(x){return x.id!==id&&x.name.toLowerCase()===nome.toLowerCase();}))return 'C’è già qualcuno con questo nome.';
    if(p){p.name=nome;p.kind=kind.get()||p.kind;p.on=on.checked;if(p.kind==='paziente'&&noq.checked)p.noq=1;else delete p.noq;mettiFaccia(p,faccia.get());commit();toast('Aggiornato: '+nome);}
    else{var np={id:'a'+rid(),name:nome,kind:kind.get()||'amico',on:true,img:''};mettiFaccia(np,faccia.get());S.people.push(np);if(after)after(np.id);commit();toast('Aggiunto: '+nome);}
  });
}

/* l'admin sceglie il codice (4 cifre) e lo dà all'ospite. Un codice nuovo fa uscire il telefono vecchio. */
function openCodiceOspite(id){
  var p=person(id);if(!p)return;
  var c=h('input',{class:'inp pin',type:'text',inputmode:'numeric',autocomplete:'off',maxlength:4,pattern:'[0-9]*'});
  formSheet('Codice ospite di '+pName(id),[
    campo('Codice (4 cifre)',c,'co-c'),
    h('p',{class:'aiuto'},'Scegli tu il codice e dallo a '+pName(id)+': si sceglie in «Chi sei?» e lo scrive per entrare.'+(p.tel?' Il telefono da cui è entrato finora esce da solo.':''))],function(){
    var v=c.value.trim();
    if(!/^\d{4}$/.test(v))return 'Il codice è di 4 cifre.';
    p.pin=improntaPin(id,v);delete p.tel;commit();toast('Codice ospite di '+pName(id)+': '+v+'. Daglielo.');
  },'Crea il codice',{noBozza:true});
}

/* ---------- vista: Cassa ---------- */
function inFilter(mv,f){
  if(f==='tutto')return true;
  var inf=moveInfo(mv);
  if(f==='cassa')return inf.cash!=null;
  if(f==='ticket')return inf.debt!=null||inf.fuori!=null;
  if(f==='fondo')return inf.fondo!=null;
  return inf.tag==='scorte';
}
function vCassa(){
  var out=[indietro(),h('h2',{class:'titolo'},'Cassa')];
  out.push(h('section',{class:'cartella'},
    h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'In cassa adesso'),h('span',{class:'timbro'+(D.cash<0?'':' ok')},D.cash<0?'In rosso':'Farmacia')),
    h('span',{class:'cifrona'+(D.cash<0?' rosso':'')},eur(D.cash)),
    h('div',{class:'azioni tre'},
      h('button',{class:'pill duo-verde',type:'button',onclick:openEntrata},ic('piu',18),'Entrata'),
      h('button',{class:'pill duo-rosa',type:'button',onclick:function(){openSpesa();}},ic('meno',18),'Spesa'),
      h('button',{class:'pill',type:'button',onclick:openConta},ic('cassa',18),'Conta cassa')),
    (function(P){return h('p',{class:'aiuto'},'Con le scorte il locale ha ',h('button',{type:'button',class:'link','data-k':'cassa-soldi',onclick:function(){go(UI.tab,'soldi');}},eur(P.attuale)),'; con i graffi, previsionale '+eur(P.previsionale)+'.');})(previsione(S,D))));
  var filtri=h('div',{class:'chips',role:'group','aria-label':'Filtro'});
  [['tutto','Tutto'],['cassa','Cassa'],['ticket','Ticket'],['scorte','Scorte'],['fondo','Fondo']].forEach(function(f){
    filtri.append(h('button',{type:'button',class:'chip','data-k':'f-'+f[0],'aria-pressed':String(UI.filter===f[0]),onclick:function(){UI.filter=f[0];UI.limit=40;render();}},f[1]));
  });
  var all=S.moves.filter(function(m){return inFilter(m,UI.filter);}).reverse(),shown=all.slice(0,UI.limit);
  var kids=[],last='';
  shown.forEach(function(m){
    var k=ymd(new Date(m.t));
    if(k!==last){last=k;kids.push(h('li',{class:'giorno'},relDay(k)));}
    kids.push(moveRow(m,false));
  });
  out.push(h('section',{class:'cartella'},
    h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Registro')),
    filtri,
    h('div',{class:'riga-tratt'}),
    shown.length?h('ul',{class:'righe'},kids):h('p',{class:'vuoto'},'Nessun movimento in questo elenco.'),
    all.length>shown.length?h('div',{class:'azioni'},h('button',{class:'pill sm',type:'button',onclick:function(){UI.limit+=40;render();}},'Mostra altri')):null));
  return out;
}
function openEntrata(){conPin(openEntrata_,'Registrare un’entrata in cassa');}
function openEntrata_(){
  var a=soldi('en-a'),n=testo('en-n','Es. fondo iniziale, offerta',80);
  formSheet('Entrata in cassa',[campo('Importo',a,'en-a'),campo('Da dove arriva',n,'en-n')],function(){
    var v=parseEur(a.value);
    if(!(v>0))return 'Scrivi l’importo, per esempio 20,00.';
    addMove({k:'in',a:v,note:n.value.trim()},'Entrata registrata: '+eur(v));
  },'Registra');
}
function openSpesa(pre){conPin(function(){openSpesa_(pre);},'Registrare una spesa');}
function openSpesa_(pre){
  pre=pre||{};
  var a=soldi('sp-a'),n=testo('sp-n','Es. spesa al supermercato',80,pre.note||'');
  var cat=h('select',{class:'inp',id:'sp-c'},CATS_SPESA.map(function(c){return h('option',{value:c},c);}));
  cat.value=pre.cat||CATS_SPESA[0];
  var chi=chipSel([{v:'cassa',label:'La cassa'}].concat(peopleOpts()),'cassa');
  var come=chipSel([{v:'cassa',label:'Rimborso dalla cassa'},{v:'debito',label:'Scala dal suo ticket'},{v:'dividi',label:'Dividi tra tutti'}],'cassa');
  var tra=chipSel(peopleOpts(),people().filter(function(p){return p.kind==='paziente';}).map(function(p){return p.id;}),true);
  var boxCome=gruppo('Come rientra dei soldi',come),boxTra=gruppo('Tra chi si divide',tra);
  function sync(){boxCome.hidden=chi.get()==='cassa';boxTra.hidden=chi.get()==='cassa'||come.get()!=='dividi';}
  chi.addEventListener('change',sync);come.addEventListener('change',sync);sync();
  formSheet('Spesa',[campo('Importo',a,'sp-a'),campo('Cosa',n,'sp-n'),campo('Categoria',cat,'sp-c'),gruppo('Chi ha pagato',chi),boxCome,boxTra],function(){
    var v=parseEur(a.value),by=chi.get(),set=come.get();
    if(!(v>0))return 'Scrivi l’importo, per esempio 12,40.';
    if(!by)return 'Scegli chi ha pagato.';
    var mv={k:'exp',a:v,note:n.value.trim(),cat:cat.value,paidBy:by};
    if(by!=='cassa'){
      mv.settle=set||'cassa';
      if(mv.settle==='dividi'){
        var ids=tra.get();
        if(!ids.length)return 'Scegli tra chi dividere la spesa.';
        mv.shares=splitShares(v,ids);
      }
    }
    addMove(mv,'Spesa registrata: '+eur(v));
  },'Registra');
}
function openConta(){conPin(openConta_,'Contare la cassa');}
function openConta_(){
  var a=soldi('ct-a'),diff=h('p',{class:'aiuto'});
  function upd(){
    var v=parseEur(a.value);
    if(isNaN(v)){diff.textContent='La cassa dovrebbe contenere '+eur(D.cash)+'.';return;}
    var d=v-D.cash;
    diff.textContent='Attesi '+eur(D.cash)+'. '+(d===0?'Torna tutto.':d>0?'Ci sono '+eur(d)+' in più.':'Mancano '+eur(-d)+'.');
  }
  a.addEventListener('input',upd);upd();
  formSheet('Conta cassa',[h('p',{class:'aiuto'},'Conta i soldi che ci sono davvero e scrivi il totale: la cassa viene riallineata e la differenza resta nel registro.'),campo('Soldi contati',a,'ct-a'),diff],function(){
    var v=parseEur(a.value);
    if(isNaN(v))return 'Scrivi il totale contato, anche 0.';
    addMove({k:'count',a:v-D.cash,counted:v,expected:D.cash},'Cassa riallineata a '+eur(v));
  },'Conferma il conteggio');
}
/* quanto «pesa» un movimento: l'importo, oppure il valore della merce per carichi e inventari */
function pesoMovimento(mv){
  if(mv.k==='load'||mv.k==='inv')return (mv.items||[]).reduce(function(n,it){return n+Math.max(0,toInt(it.q))*Math.max(0,toInt(it.pr));},0);
  return Math.abs(toInt(mv.a));
}
function gruppoDi(mv){return mv.g?S.moves.filter(function(m){return m.g===mv.g;}):[mv];}
function openMove(id){
  var chiedi=false,motivo=null;
  var live=function(){
    var mv=S.moves.find(function(m){return m.id===id;});
    if(!mv)return [h('p',{class:'vuoto'},'Movimento non più presente.')];
    var inf=moveInfo(mv),dt=new Date(mv.t),gr=gruppoDi(mv),altri=gr.filter(function(m){return m!==mv;});
    var peso=gr.reduce(function(n,m){return Math.max(n,pesoMovimento(m));},0),grande=peso>ANNULLO_GRANDE;
    var dl=h('dl',{class:'scheda'},
      h('dt',null,'Quando'),h('dd',null,dLong(dt)+', '+hm(mv.t)),
      h('dt',null,'Cosa'),h('dd',null,inf.t),
      mv.da?[h('dt',null,'Segnato da'),h('dd',null,pName(mv.da))]:null,
      inf.s?[h('dt',null,'Dettaglio'),h('dd',null,inf.s)]:null,
      mv.k!=='load'&&mv.k!=='inv'?[h('dt',null,'Importo'),h('dd',null,eur(Math.abs(toInt(mv.a))))]:[h('dt',null,'Valore'),h('dd',null,eur(peso)+' a prezzo di vendita')],
      mv.shares?[h('dt',null,'Quote'),h('dd',null,Object.keys(mv.shares).map(function(k){return pName(k)+' '+eur(mv.shares[k]);}).join(', '))]:null,
      altri.length?[h('dt',null,'Va insieme a'),h('dd',null,altri.map(function(m){return moveInfo(m).t+' '+eur(Math.abs(toInt(m.a)));}).join(' · '))]:null,
      mv.x?[h('dt',null,'Stato'),h('dd',{class:'rosso'},'Annullato'+(mv.x.t?' il '+dLong(new Date(mv.x.t)).toLowerCase()+' alle '+hm(mv.x.t):''))]:null,
      mv.x&&mv.xm?[h('dt',null,'Motivo'),h('dd',null,mv.xm)]:null,
      !mv.x&&gr.some(function(m){return m.dc;})?[h('dt',null,'Stato'),h('dd',null,h('span',{class:'tag attesa'},'da confermare'),' Lo conferma l’admin.')]:null);
    var az,op=!mv.x&&daConfermare(S).find(function(o){return o.mv&&o.mv.indexOf(mv)>=0;});
    if(op&&isAdmin())az=bottoniConferma(op);
    else if(mv.x)az=h('div',{class:'azioni'},h('button',{class:'pill',type:'button',onclick:function(){
      conPin(function(){gr.forEach(function(m){delete m.x;delete m.xm;});commit();toast(gr.length>1?'Movimenti ripristinati.':'Movimento ripristinato.');},'Ripristinare un movimento');}},'Ripristina'));
    else if(chiedi){
      motivo=motivo||testo('mv-mot','Es. segnato due volte, persona sbagliata',120);
      az=[h('p',{class:'errore'},'Annullare '+(altri.length?'questo movimento e quelli che vanno con lui':'questo movimento')+'? Cassa, ticket e scorte vengono ricalcolati.'),
        grande?campo('Motivo (obbligatorio sopra '+eur(ANNULLO_GRANDE)+')',motivo,'mv-mot'):null,
        h('div',{class:'azioni'},
          h('button',{class:'pill pericolo',type:'button','data-k':'si-annulla',onclick:function(){
            var mt=motivo.value.trim();
            if(grande&&mt.length<3){toast('Scrivi il motivo: sopra '+eur(ANNULLO_GRANDE)+' è obbligatorio.');try{motivo.focus();}catch(e){}return;}
            conPin(function(){
              var t=Date.now();gr.forEach(function(m){if(!m.x){m.x={t:t};if(mt)m.xm=mt.slice(0,120);}});
              chiedi=false;commit();toast(gr.length>1?'Movimenti annullati.':'Movimento annullato.');
            },'Annullare un movimento');
          }},'Sì, annulla'),
          h('button',{class:'pill',type:'button',onclick:function(){chiedi=false;refreshSheet();}},'No'))];
    }
    else az=h('div',{class:'azioni'},h('button',{class:'pill pericolo',type:'button',onclick:function(){chiedi=true;refreshSheet();}},'Annulla movimento'));
    return [dl,h('div',{class:'riga-tratt'}),az];
  };
  openSheet('Movimento',live(),live);
}

/* ---------- vista: Soldi del locale (previsione) ---------- */
function ultimoDi(k){var t=0;S.moves.forEach(function(m){if(m&&!m.x&&m.k===k&&m.t>t)t=m.t;});return t;}
function daQuando(t){if(!t)return 'mai';var g=Math.floor((Date.now()-t)/864e5);return g<=0?'oggi':g===1?'ieri':g+' giorni fa';}
function rigaConto(nome,sotto,importo,cls,icls){
  return h('li',{class:cls||null},h('div',{class:'riga'},
    h('span',{class:'cresce'},h('span',{class:'nome'},nome),sotto?h('span',{class:'sotto'},sotto):null),
    h('span',{class:'importo'+(icls?' '+icls:'')},importo)));
}
function barraSoldi(parti){   // parti: [classe, nome, centesimi]
  var tot=0,neg=false;
  parti.forEach(function(x){if(x[2]<0)neg=true;tot+=x[2];});
  if(neg||tot<=0)return null;   // con una voce in negativo le proporzioni ingannano: resta solo il conto
  function pc(v){return Math.round(v/tot*100);}
  return [h('div',{class:'soldi-barra',role:'img','aria-label':parti.map(function(x){return x[1]+' '+pc(x[2])+'%';}).join(', ')},
      parti.filter(function(x){return x[2]>0;}).map(function(x){return h('i',{class:'s-'+x[0],style:'flex-grow:'+x[2]});})),
    h('ul',{class:'soldi-leg','aria-hidden':'true'},parti.map(function(x){return h('li',null,h('i',{class:'s-'+x[0]}),x[1]+' '+pc(x[2])+'%');}))];
}
function testoCosto(P){
  if(!P.nCosto)return null;
  return 'a costo d’acquisto '+eur(P.scorteCosto)+(P.nCosto<P.righe.length?' (solo '+P.nCosto+' prodotti su '+P.righe.length+' hanno il costo)':'')+' · margine '+eur(P.margine);
}
function vSoldi(){
  var P=previsione(S,D),tc=ultimoDi('count'),ti=ultimoDi('inv');
  var deb=people(true).filter(function(p){return (D.debt[p.id]||0)>0;}).sort(function(a,b){return D.debt[b.id]-D.debt[a.id];});
  var cred=people(true).filter(function(p){return (D.debt[p.id]||0)<0;}).sort(function(a,b){return D.debt[a.id]-D.debt[b.id];});
  var out=[indietro(),h('h2',{class:'titolo'},'Soldi del locale')];
  out.push(h('section',{class:'cartella'},
    h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Il locale adesso'),h('span',{class:'timbro ok'},'Cassa + scorte')),
    h('span',{class:'cifrona'+(P.attuale<0?' rosso':''),id:'soldi-tot'},eur(P.attuale)),
    h('p',{class:'aiuto'},'I soldi in cassa più le scorte, se le vendete tutte a prezzo di listino. I graffi sono a parte, nel previsionale.'),
    barraSoldi([['cassa','Cassa',P.cassa],['scorte','Scorte',P.scorte]]),
    h('div',{class:'riga-tratt'}),
    h('ul',{class:'righe conto'},
      rigaConto('Cassa adesso','calcolata dall’app · ultima conta: '+daQuando(tc),eur(P.cassa),null,P.cassa<0?'rosso':null),
      rigaConto('Scorte a prezzo di vendita',P.righe.length?P.righe.length+(P.righe.length===1?' prodotto':' prodotti')+' in magazzino · ultimo inventario: '+daQuando(ti):'nessun prodotto contato',eurS(P.scorte)),
      P.nCosto?rigaConto('Le stesse scorte a costo',testoCosto(P),eur(P.scorteCosto)):null,
      rigaConto('Totale attuale',null,eur(P.attuale),'tot',P.attuale<0?'rosso':null))));

  out.push(h('section',{class:'cartella'},
    h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Previsionale, con i graffi'),h('span',{class:'timbro scuro'},'Stima')),
    h('span',{class:'cifrona'+(P.previsionale<0?' rosso':''),id:'soldi-prev'},eur(P.previsionale)),
    h('p',{class:'aiuto'},'Quanto avrebbe il locale se tutti saldassero i graffi e si restituissero i crediti.'),
    h('div',{class:'riga-tratt'}),
    h('ul',{class:'righe conto'},
      rigaConto('Totale attuale','cassa + scorte',eur(P.attuale)),
      rigaConto('Graffi da incassare',P.nInc?P.nInc+(P.nInc===1?' paziente':' pazienti')+' con il ticket aperto':'nessun ticket aperto',eurS(P.incassare)),
      rigaConto('Crediti da restituire',P.nRes?P.nRes+(P.nRes===1?' paziente è':' pazienti sono')+' in credito (spese anticipate o pagato in più)':'nessuno',eurS(-P.restituire)),
      rigaConto('Totale previsionale',null,eur(P.previsionale),'tot',P.previsionale<0?'rosso':null))));

  // avvertenze: prima i dati da sistemare, poi i limiti della stima
  var av=[];
  if(!tc)av.push(h('li',{class:'rosso'},'La cassa non è mai stata contata: il numero è quello calcolato dall’app, non i soldi veri.'));
  else if(Date.now()-tc>14*864e5)av.push(h('li',{class:'rosso'},'Ultima conta della cassa '+daQuando(tc)+': da allora il conto si basa solo su quello che è stato segnato.'));
  if(P.nonContati)av.push(h('li',{class:'rosso'},P.nonContati+(P.nonContati===1?' prodotto in vendita non è mai stato contato e resta':' prodotti in vendita non sono mai stati contati e restano')+' fuori dal conto.'));
  if(P.negativi)av.push(h('li',{class:'rosso'},P.negativi+(P.negativi===1?' prodotto risulta':' prodotti risultano')+' sotto zero (venduto più di quanto contato): vale in negativo finché non segnate il carico o rifate l’inventario.'));
  av.push(h('li',null,P.nCosto?'Le scorte valgono al prezzo di vendita; il valore a costo vale solo per i prodotti passati da uno scontrino.':'Le scorte valgono al prezzo di vendita: quello che le avete pagate è meno. Con gli scontrini l’app impara anche il costo.'));
  av.push(h('li',null,'Il previsionale conta i graffi per intero: ogni ticket che non viene pagato lo abbassa.'));
  out.push(h('section',{class:'cartella'},
    h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Prima di fidarvi')),
    h('div',{class:'riga-tratt'}),
    h('ul',{class:'avvisi'},av),
    h('div',{class:'azioni'},
      h('button',{class:'pill sm',type:'button',onclick:openConta},'Conta cassa'),
      h('button',{class:'pill sm',type:'button',onclick:function(){openInventario();}},'Inventario'))));
  out.push(cardVerifiche());

  var tutte=UI.soldiTutte||P.righe.length<=10,mostra=tutte?P.righe:P.righe.slice(0,10);
  out.push(h('section',{class:'cartella'},
    h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Scorte in magazzino'),h('span',{class:'importo'},eur(P.scorte))),
    h('div',{class:'riga-tratt'}),
    P.righe.length?h('ul',{class:'righe'},mostra.map(function(r){
      return rigaConto(r.n,r.q+' pz × '+eur(r.pr)+(r.c!=null?' · costo '+eur(r.c):''),eur(r.v));
    })):h('p',{class:'vuoto'},'Ancora nessun prodotto contato. Fate un inventario da Scorte e qui compare quanto valgono.'),
    tutte?null:h('div',{class:'azioni'},h('button',{class:'pill sm',type:'button',onclick:function(){UI.soldiTutte=true;render();}},'Mostra tutti ('+P.righe.length+')'))));

  out.push(h('section',{class:'cartella'},
    h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Graffi da incassare'),h('button',{class:'pill sm',type:'button',onclick:function(){apriTicket();}},'Tutti i ticket')),
    h('div',{class:'riga-tratt'}),
    deb.length?h('ul',{class:'righe'},deb.map(personRow)):h('p',{class:'vuoto'},'Nessun graffio aperto: tutti in regola.'),
    cred.length?[h('h4',{class:'giorno'},'Da restituire'),h('ul',{class:'righe'},cred.map(personRow))]:null));
  return out;
}
/* ---------- vista: Altro ---------- */
function indietro(){var t=UI.tab;return h('button',{type:'button',class:'pill viola sm indietro',onclick:function(){go(t);}},ic('indietro',18),NOMI_TAB[t]||'Indietro');}
/* ---------- Altro: voci divise in sezioni, con il numero che conta a destra ---------- */
function voceL(o){
  return h('li',null,h('button',{type:'button',class:'voce','data-k':o.k||null,onclick:o.onclick},
    h('span',{class:'voce-ic '+(o.col||'')},ic(o.ic,22)),
    h('span',{class:'cresce'},h('span',{class:'nome'},o.titolo),o.sotto?h('span',{class:'sotto'+(o.sottoCls?' '+o.sottoCls:'')},o.sotto):null),
    o.val!=null?h('span',{class:'voce-val'+(o.valCls?' '+o.valCls:'')},o.val):null,
    ic('avanti',18)));
}
function gruppoAltro(titolo,voci,cls){
  return h('section',{class:'gruppo'},h('h3',{class:'gruppo-t'},titolo),h('ul',{class:'menu lista'+(cls?' '+cls:'')},voci));
}
function tesseraApp(icona,titolo,sotto,onclick,k,rossa){
  return h('button',{type:'button',class:'tessera-app','data-k':k,onclick:onclick},
    h('span',{class:'voce-ic c-app'},ic(icona,20)),h('span',{class:'nome'},titolo),h('span',{class:'sotto'+(rossa?' rosso':'')},sotto));
}
function vAltro(){
  var low=lowStock(),da=low.length+S.shop.length,senzaFaccia=people().filter(function(p){return !p.img;}).length,adm=isAdmin(),io=mio();
  var P=previsione(S,D),oggi=today();
  var qDue=statoQuote(S,D,oggi).filter(function(st){return st.mancano.length&&(st.scaduta||giorniA(st.scad)<=15);})[0];
  var med=medaglieTutte(),nMed=0;Object.keys(med).forEach(function(id){Object.keys(med[id]).forEach(function(k){nMed+=med[id][k];});});
  var guida=function(){var u=IN_CLAUDE?'https://ciccionaso.github.io/oblio-house/guida.html':'guida.html';if(IN_CLAUDE)window.open(u,'_blank');else location.href=u;};
  var out=[h('h2',{class:'titolo'},'Altro'),
    gruppoAltro('Soldi',[
      voceL({ic:'registro',col:'c-soldi',titolo:'Cassa e registro',sotto:'Entrate, spese, conta, movimenti',val:eur(D.cash),valCls:D.cash<0?'rosso':null,onclick:function(){go('altro','cassa');}}),
      voceL({ic:'andamento',col:'c-soldi',titolo:'Soldi del locale',sotto:'Adesso e previsionale, verifica del mese',val:eur(P.attuale),valCls:P.attuale<0?'rosso':null,onclick:function(){go('altro','soldi');}}),
      voceL({ic:'casa',col:'c-soldi',titolo:'Quota e fondo',sotto:qDue?(qDue.scaduta?'In ritardo: ':'Mancano: ')+qDue.mancano.length+' per '+meseNome(qDue.mese):'Quota del locale, a parte dalla cassa',sottoCls:qDue&&qDue.scaduta?'rosso':null,val:eur(D.fondo),onclick:function(){go('altro','quota');}}),
      voceL({ic:'scatola',col:'c-soldi',titolo:'Scorte e spesa',sotto:'Magazzino, scontrini, lista della spesa',val:da?da+' da prendere':'a posto',valCls:da?'rosso':null,onclick:function(){go('altro','scorte');}})]),
    gruppoAltro('Classifiche',[
      voceL({ic:'podio',col:'c-reparto',titolo:'Classifiche',sotto:'Triage, bar, freccette, medaglie e albo d’oro',val:nMed?nMed+(nMed===1?' medaglia':' medaglie'):null,onclick:function(){go('altro','classifiche');}})]),
    gruppoAltro('Io: '+(io?pName(io):'—'),[
      voceL({ic:'chiave',col:'c-app',titolo:'Cambia il mio PIN',sotto:'Il PIN che firma cassa, spese e debiti',onclick:openCambiaPin}),
      SYNC?voceL({ic:'rete',col:'c-app',titolo:'Telefoni collegati',sotto:SST.stato==='errore'?'Non collegati: tocca per i dettagli':SST.stato==='attesa'?syncTesto():'Versione '+APP_V,sottoCls:SST.stato==='errore'?'rosso':null,
        val:SST.stato==='ok'?'allineati':SST.stato==='attesa'?'in attesa':SST.stato==='errore'?'non collegati':SST.stato==='collego'?'…':'spenti',valCls:SST.stato==='errore'?'rosso':null,onclick:openSync}):null,
      h('li',{class:'tris'},
        tesseraApp('libro','Guida','18 capitoli',guida,'apri-guida'),
        tesseraApp('nuvola','Backup',backupLine(),function(){go('altro','backup');},'apri-backup',backupOld()),
        tesseraApp('scarica','Installa','sul telefono',function(){go('altro','installa');},'apri-installa')),
      h('li',{class:'esci-riga'},h('button',{type:'button',class:'pill viola largo','data-k':'esci-io',onclick:esci},ic('esci',18),'Esci dal mio nome'))])];
  out.push(adm?gruppoAltro('Admin',[
      voceL({ic:'persone',col:'c-admin',titolo:'Persone e PIN',sotto:'Pazienti, visitatori, chi ha l’app, codici ospite, azzera un PIN'+(senzaFaccia?' · '+senzaFaccia+' senza faccia':''),val:String(people().length),onclick:function(){go('altro','persone');}}),
      voceL({ic:'etichetta',col:'c-admin',titolo:'Listino',sotto:'Prezzi e storico dei prezzi',val:String(S.products.filter(function(p){return p.on;}).length),onclick:function(){go('altro','listino');}}),
      voceL({ic:'cursori',col:'c-admin',titolo:'Regole del reparto',sotto:'Voto ('+(podio()?'podio':'fino a '+votiMassimi())+'), rifiuti'+(calPieno(S.cfg)?'':' (da compilare)')+', pulizie, graffi vecchi',onclick:function(){go('altro','regole');}}),
      voceL({ic:'torta',col:'c-admin',titolo:'Compleanni',sotto:S.people.filter(function(p){return p.on&&p.nato;}).length+' segnati',onclick:function(){go('altro','compleanni');}}),
      voceL({ic:'chiave',col:'c-admin',titolo:'Codice admin',sotto:S.cfg.admH?'Cambiato':'Ancora quello iniziale: cambialo',sottoCls:S.cfg.admH?null:'rosso',onclick:function(){go('altro','codici');}}),
      h('li',{class:'esci-riga'},h('button',{type:'button',class:'pill viola largo','data-k':'esci-admin',onclick:esciAdmin},ic('esci',18),'Esci dalla modalità admin'))],'admin')
    :gruppoAltro('Admin',[voceL({ic:'lucchetto',col:'c-admin',titolo:'Admin',sotto:'Persone e PIN, listino, regole, compleanni, codice: serve il codice admin',onclick:openAdminAccesso})]));
  out.push(h('p',{class:'piede'},'The Oblio House · versione '+APP_V+' · su questo dispositivo: '+S.moves.length+(S.moves.length===1?' movimento, ':' movimenti, ')+S.votes.length+(S.votes.length===1?' voto, ':' voti, ')+S.games.length+(S.games.length===1?' partita.':' partite.')));
  return out;
}
function vCompleanni(){
  var righe=[],sel={};
  S.people.filter(function(p){return p.on;}).forEach(function(p){
    var g=h('select',{class:'inp corto3','aria-label':'Giorno, '+p.name},[h('option',{value:''},'—')].concat(Array.from({length:31},function(_,i){return h('option',{value:pad(i+1)},String(i+1));})));
    var m=h('select',{class:'inp corto4','aria-label':'Mese, '+p.name},[h('option',{value:''},'—')].concat(MESI.map(function(n,i){return h('option',{value:pad(i+1)},n);})));
    if(p.nato){g.value=p.nato.slice(3,5);m.value=p.nato.slice(0,2);}
    sel[p.id]={g:g,m:m};
    righe.push(h('li',null,ava(p.id,'xs'),h('span',{class:'cresce1 nome'},nomeP(p)),g,m));
  });
  var f=formPagina(function(){
    var bad='';
    Object.keys(sel).forEach(function(id){
      var x=sel[id],p=person(id);if(!p)return;
      if(!x.g.value&&!x.m.value){delete p.nato;return;}
      var v=normNato(x.m.value+'-'+x.g.value);
      if(!v){bad=bad||nomeP(p);return;}
      p.nato=v;
    });
    if(bad)return 'Data che non esiste per '+bad+'.';
    commit();toast('Compleanni salvati.');
  },[h('ul',{class:'linee'},righe),h('button',{class:'pill duo-verde largo',type:'submit'},'Salva i compleanni')]);
  return [indietro(),h('h2',{class:'titolo'},'Compleanni'),
    h('section',{class:'cartella'},
      h('p',{class:'aiuto'},'Solo giorno e mese, niente anno. Il giorno del compleanno il Reparto lo festeggia per tutti; nei 30 giorni prima lo annuncia nel bollettino.'),
      f)];
}
function vCodici(){
  function modulo(campo0,titolo,def,etich){
    var a=h('input',{class:'inp pin',type:'password',inputmode:'numeric',autocomplete:'off',maxlength:12,'aria-label':'Nuovo '+etich});
    var b=h('input',{class:'inp pin',type:'password',inputmode:'numeric',autocomplete:'off',maxlength:12,'aria-label':'Ripeti il nuovo '+etich});
    var f=formPagina(function(){
      var v=a.value.trim();
      if(!/^\d{4,8}$/.test(v))return 'Da 4 a 8 cifre.';
      if(v!==b.value.trim())return 'I due codici non sono uguali.';
      S.cfg[campo0]=impronta(v);commit();toast(titolo+' cambiato su tutti i telefoni.');
    },[h('div',{class:'campo'},h('span',{class:'lab'},'Nuovo '+etich),a),h('div',{class:'campo'},h('span',{class:'lab'},'Ripeti'),b),
      h('button',{class:'pill duo-verde largo',type:'submit'},'Cambia il '+etich),
      S.cfg[campo0]?h('button',{class:'pill sm',type:'button',onclick:function(){delete S.cfg[campo0];commit();toast(titolo+' tornato a '+def+'.');}},'Torna a '+def):null]);
    return h('section',{class:'cartella'},h('div',{class:'cart-h'},h('h3',{class:'etichetta'},titolo),h('span',{class:'timbro'+(S.cfg[campo0]?' ok':'')},S.cfg[campo0]?'Cambiato':'Iniziale')),f);
  }
  return [indietro(),h('h2',{class:'titolo'},'Codice admin'),
    h('p',{class:'nota-chiara'},'Vale per tutti i telefoni. Nei dati condivisi va solo un’impronta del codice, non il codice. Ognuno ha poi il suo PIN personale per le azioni sensibili.'),
    S.cfg.admH?null:h('p',{class:'nota-chiara rosso'},'Il codice admin è ancora quello iniziale, che sta scritto nel codice dell’app: cambialo subito.'),
    modulo('admH','Codice admin','0101','codice admin')];
}
function vScorte(){
  var low=lowStock(),out=[indietro(),h('h2',{class:'titolo'},'Scorte')];
  var daComprare=[];
  low.forEach(function(p){daComprare.push(h('li',null,h('div',{class:'riga'},h('span',{class:'cresce'},h('span',{class:'nome'},p.name),h('span',{class:'sotto'},D.stock[p.id]<=0?'finito':'ne restano '+D.stock[p.id])))));});
  S.shop.forEach(function(s){daComprare.push(h('li',null,h('div',{class:'riga'},h('span',{class:'cresce'},h('span',{class:'nome'},s.text)),
    h('button',{type:'button',class:'pill sm',onclick:function(){S.shop=S.shop.filter(function(x){return x.id!==s.id;});commit();}},'Preso'))));});
  var nuovo=testo('sh-n','Es. carta igienica, sacchi',60);
  nuovo.setAttribute('aria-label','Aggiungi alla lista della spesa');
  var formN=h('form',{class:'linea',onsubmit:function(ev){ev.preventDefault();var v=nuovo.value.trim();if(!v)return;S.shop.push({id:'s'+rid(),text:v,t:Date.now()});commit();}},
    h('span',{class:'cresce1'},nuovo),h('button',{class:'pill sm',type:'submit'},'Aggiungi'));
  out.push(h('section',{class:'cartella'},
    h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Lista della spesa'),h('span',{class:'timbro'+(daComprare.length?'':' ok')},daComprare.length?'Da comprare':'A posto')),
    h('div',{class:'riga-tratt'}),
    daComprare.length?h('ul',{class:'righe'},daComprare):h('p',{class:'vuoto'},'Niente da comprare. I prodotti entrano qui da soli quando finiscono o scendono sotto la soglia.'),
    formN));
  var righe=[];
  cats().forEach(function(c){
    var list=S.products.filter(function(p){return p.on&&p.cat===c;});
    if(!list.length)return;
    righe.push(h('li',{class:'giorno'},c));
    list.forEach(function(p){
      var st=D.stock[p.id];
      righe.push(h('li',null,h('div',{class:'riga'},
        h('span',{class:'cresce'},h('span',{class:'nome'},p.name),h('span',{class:'sotto'},p.min!=null?'soglia '+p.min:'nessuna soglia')),
        h('span',{class:'importo '+(st==null?'spento':st<=0||(p.min!=null&&st<=p.min)?'rosso':'')},st==null?'non contato':st+' pz'))));
    });
  });
  out.push(h('section',{class:'cartella'},
    h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Magazzino'),h('button',{class:'pill sm',type:'button','data-k':'nuovo-prodotto',onclick:function(){openProdotto(null);}},'+ Nuovo prodotto')),
    h('button',{class:'pill duo-rosa largo',type:'button','data-k':'scontrino',onclick:openScontrino},ic('scontrino',20),'Scontrino'),
    h('div',{class:'azioni tre'},
      h('button',{class:'pill duo-verde',type:'button',onclick:openCarico},'Carico'),
      h('button',{class:'pill',type:'button',onclick:openInventario},'Inventario'),
      h('button',{class:'pill',type:'button',onclick:function(){soloAdmin(openSoglie);}},'Soglie')),
    h('p',{class:'aiuto'},'Le scorte scendono da sole a ogni consumazione, ma solo dopo il primo inventario o carico di quel prodotto.'),
    h('div',{class:'riga-tratt'}),
    h('ul',{class:'righe'},righe)));
  return out;
}
function listaNumeri(prefisso,valore){
  var inputs={},ul=h('ul',{class:'linee'});
  cats().forEach(function(c){
    var list=S.products.filter(function(p){return p.on&&p.cat===c;});
    if(!list.length)return;
    ul.append(h('li',{class:'gruppo-t'},c));
    list.forEach(function(p){
      var v=valore(p),i=h('input',{class:'inp corto',id:prefisso+p.id,type:'text',inputmode:'numeric',autocomplete:'off',value:v==null?'':String(v)});
      inputs[p.id]=i;
      ul.append(h('li',null,h('label',{class:'cresce1 nome',for:prefisso+p.id},p.name),i));
    });
  });
  return {ul:ul,inputs:inputs};
}
function leggiNumero(s){s=String(s||'').trim();if(s==='')return null;if(!/^\d{1,4}$/.test(s))return NaN;return parseInt(s,10);}
function scritti(L){var o={};Object.keys(L.inputs).forEach(function(k){o[k]=L.inputs[k].value;});return o;}
function openCarico(pre){
  pre=pre||{};
  var L=listaNumeri('ca-',function(p){return p.id in pre?pre[p.id]:null;});
  var poi=h('input',{type:'checkbox',id:'ca-poi',checked:!!pre.__poi});
  formSheet('Carico scorte',[h('p',{class:'aiuto'},'Scrivi quanti pezzi sono arrivati, solo per i prodotti comprati.'),
    h('div',{class:'azioni'},h('button',{class:'pill sm',type:'button','data-k':'ca-nuovo',onclick:function(){var v=scritti(L);v.__poi=poi.checked;openProdotto(null,{pezzi:false,poi:function(){openCarico(v);}});}},'+ Prodotto nuovo')),L.ul,h('label',{class:'spunta',for:'ca-poi'},poi,'Dopo registro anche la spesa')],function(){
    var items=[],bad=false;
    S.products.forEach(function(p){var i=L.inputs[p.id];if(!i)return;var n=leggiNumero(i.value);if(n==null)return;if(isNaN(n)){bad=true;return;}if(n>0)items.push({id:p.id,n:p.name,q:n,pr:p.price});});
    if(bad)return 'Usa solo numeri interi, per esempio 12.';
    if(!items.length)return 'Scrivi almeno una quantità.';
    var dopo=poi.checked;
    addMove({k:'load',a:0,items:items},'Carico registrato: '+items.length+(items.length===1?' prodotto':' prodotti'));
    if(dopo)setTimeout(function(){openSpesa({cat:'Rifornimento bar'});},60);
  },'Registra il carico',{giaSporco:Object.keys(pre).some(function(k){return k!=='__poi'&&pre[k]!=null&&pre[k]!=='';})});
}
function openInventario(pre){conPin(function(){openInventario_(pre);},'Fare l’inventario');}
function openInventario_(pre){
  pre=pre||{};
  var L=listaNumeri('iv-',function(p){return p.id in pre?pre[p.id]:D.stock[p.id];});
  formSheet('Inventario',[h('p',{class:'aiuto'},'Scrivi quanti pezzi ci sono davvero. I campi vuoti restano come sono.'),
    h('div',{class:'azioni'},h('button',{class:'pill sm',type:'button','data-k':'iv-nuovo',onclick:function(){var v=scritti(L);openProdotto(null,{poi:function(){openInventario(v);}});}},'+ Prodotto nuovo')),L.ul],function(){
    var items=[],bad=false;
    S.products.forEach(function(p){var i=L.inputs[p.id];if(!i)return;var n=leggiNumero(i.value);if(n==null)return;if(isNaN(n)){bad=true;return;}if(n!==D.stock[p.id])items.push({id:p.id,n:p.name,q:n,pr:p.price});});
    if(bad)return 'Usa solo numeri interi, per esempio 12.';
    if(!items.length)return 'Non è cambiato nulla.';
    addMove({k:'inv',a:0,items:items},'Inventario salvato: '+items.length+(items.length===1?' prodotto':' prodotti'));
  },'Salva l’inventario',{giaSporco:Object.keys(pre).length>0});
}
function openSoglie(){
  var L=listaNumeri('so-',function(p){return p.min;});
  var tutti=h('input',{class:'inp corto',id:'so-tutti',type:'text',inputmode:'numeric',autocomplete:'off'});
  var applica=h('button',{class:'pill sm',type:'button',onclick:function(){var n=leggiNumero(tutti.value);if(n==null||isNaN(n))return;Object.keys(L.inputs).forEach(function(k){L.inputs[k].value=String(n);});}},'Applica a tutti');
  formSheet('Soglie',[h('p',{class:'aiuto'},'Quando un prodotto scende a questa quantità o sotto, finisce nella lista della spesa. Campo vuoto: nessuna soglia.'),
    h('div',{class:'linea'},h('label',{class:'cresce1 nome',for:'so-tutti'},'Stessa soglia'),tutti,applica),L.ul],function(){
    var bad=false,vals={};
    S.products.forEach(function(p){var i=L.inputs[p.id];if(!i)return;var n=leggiNumero(i.value);if(n!=null&&isNaN(n)){bad=true;return;}vals[p.id]=n;});
    if(bad)return 'Usa solo numeri interi, per esempio 3.';
    S.products.forEach(function(p){if(p.id in vals)p.min=vals[p.id];});
    commit();toast('Soglie aggiornate.');
  });
}
function vListino(){
  var righe=[];
  cats().forEach(function(c){
    righe.push(h('li',{class:'giorno'},c));
    S.products.filter(function(p){return p.cat===c;}).forEach(function(p){
      var ult=p.ph&&p.ph.length?p.ph[p.ph.length-1]:null;
      righe.push(h('li',null,h('button',{type:'button',class:'riga',onclick:function(){openProdotto(p.id);}},
        h('span',{class:'cresce'},h('span',{class:'nome'},p.name,p.on?null:h('span',{class:'tag'},'fuori listino')),
          ult?h('span',{class:'sotto'},'era '+eur(ult.da)+' fino al '+dShortT(ult.t)):null),
        h('span',{class:'importo'},eur(p.price)))));
    });
  });
  return [indietro(),h('h2',{class:'titolo'},'Listino'),
    h('section',{class:'cartella'},
      h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Prodotti e prezzi'),h('button',{class:'pill sm',type:'button',onclick:function(){openProdotto(null);}},'+ Prodotto')),
      h('div',{class:'riga-tratt'}),
      h('ul',{class:'righe'},righe),
      h('p',{class:'aiuto'},'Tocca un prodotto per cambiare nome, prezzo o categoria. I prezzi nuovi valgono solo per le consumazioni future.'))];
}
function openProdotto(id,opz){
  opz=opz||{};
  var p=id?prod(id):null;
  var n=testo('pr-n','Nome del prodotto',40,p?p.name:''),a=soldi('pr-a',p?p.price:null);
  var lista=cats();if(lista.indexOf('Altro')<0)lista.push('Altro');
  var cat=h('select',{class:'inp',id:'pr-c'},lista.map(function(c){return h('option',{value:c},c);}));
  cat.value=p?p.cat:lista[0];
  var nuova=testo('pr-nc','Solo se serve una categoria nuova',20);
  var on=h('input',{type:'checkbox',id:'pr-on',checked:p?p.on:true});
  // solo per un prodotto nuovo: quanti pezzi ci sono già e sotto quanti va ricomprato
  var conPezzi=!p&&opz.pezzi!==false;
  var pz=conPezzi?h('input',{class:'inp corto',id:'pr-pz',type:'text',inputmode:'numeric',autocomplete:'off',placeholder:'—'}):null;
  var so=p?null:h('input',{class:'inp corto',id:'pr-so',type:'text',inputmode:'numeric',autocomplete:'off',placeholder:'—'});
  var storico=p&&p.ph&&p.ph.length?h('p',{class:'aiuto storico-prezzi'},'Prezzi di prima: '+p.ph.slice().reverse().map(function(x){return eur(x.da)+' fino al '+dShortT(x.t);}).join(' · ')+'. Le consumazioni già segnate restano al prezzo di allora.'):
    (p?h('p',{class:'aiuto'},'Se cambi il prezzo, vale dalle prossime consumazioni: quelle già segnate restano al prezzo di allora, e il cambio resta nello storico.'):null);
  formSheet(p?'Modifica prodotto':'Nuovo prodotto',[campo('Nome',n,'pr-n'),campo('Prezzo di vendita',a,'pr-a'),storico,campo('Categoria',cat,'pr-c'),campo('Oppure nuova categoria',nuova,'pr-nc'),
    conPezzi?h('div',{class:'linea'},h('label',{class:'cresce1 nome',for:'pr-pz'},'Pezzi che ci sono adesso'),pz):null,
    p?null:h('div',{class:'linea'},h('label',{class:'cresce1 nome',for:'pr-so'},'Soglia per la lista della spesa'),so),
    p?null:h('p',{class:'aiuto'},conPezzi?'Se scrivi i pezzi, il prodotto entra subito in magazzino e da lì scende da solo a ogni consumazione. Campi vuoti: lo conti dopo con l’inventario.':'Dopo il salvataggio torni al carico: scrivi lì quanti pezzi sono arrivati.'),
    h('label',{class:'spunta',for:'pr-on'},on,'In vendita')],function(){
    var nome=n.value.trim(),v=parseEur(a.value),c=nuova.value.trim()||cat.value;
    if(!nome)return 'Scrivi il nome del prodotto.';
    if(isNaN(v))return 'Scrivi il prezzo, per esempio 1,20.';
    if(S.products.some(function(x){return x!==p&&x.name.toLowerCase()===nome.toLowerCase();}))return 'C’è già un prodotto con questo nome.';
    if(p){var prezzoPrima=p.price;p.name=nome;cambiaPrezzo(p,v,Date.now());p.cat=c;p.on=on.checked;commit();toast(prezzoPrima!==v?'Prodotto aggiornato: da '+eur(prezzoPrima)+' a '+eur(v)+' per le consumazioni da adesso.':'Prodotto aggiornato.');}
    else{
      var q=pz?leggiNumero(pz.value):null,m=leggiNumero(so.value);
      if((q!=null&&isNaN(q))||(m!=null&&isNaN(m)))return 'Pezzi e soglia: solo numeri interi, per esempio 12.';
      var np={id:'p'+rid(),name:nome,cat:c,price:v,min:m==null?null:m,on:on.checked};
      S.products.push(np);
      if(q!=null)S.moves.push(firma({id:rid(),t:Date.now(),k:'inv',a:0,items:[{id:np.id,n:np.name,q:q,pr:np.price}]}));
      commit();toast('Prodotto aggiunto: '+nome+(q!=null?' · '+q+' pz in magazzino':''));
    }
    if(opz.poi)setTimeout(opz.poi,60);
  });
}
/* ---------- scontrini: foto → lettura sul telefono → conferma ---------- */
var LETTORE=null,letture={},nLett=0,progLettore=null;
function lettore(){
  if(!LETTORE){
    LETTORE=new Worker('ocr/lettore.js');
    LETTORE.onmessage=function(e){
      var m=e.data||{};
      if(m.t==='carico'||m.t==='leggo'){if(progLettore)progLettore(m.t,m.p);return;}
      var cb=letture[m.id];if(cb){delete letture[m.id];cb(m);}
    };
    LETTORE.onerror=function(e){
      var ks=Object.keys(letture);LETTORE=null;
      ks.forEach(function(k){var cb=letture[k];delete letture[k];cb({t:'errore',msg:(e&&e.message)||'il lettore si è fermato'});});
    };
  }
  return LETTORE;
}
/* la foto diventa un'immagine grigia a contrasto pieno, alta al massimo 2600 punti: legge meglio e consuma meno */
function preparaFoto(file){
  return new Promise(function(ok,ko){
    var url=URL.createObjectURL(file),img=new Image();
    img.onload=function(){
      try{
        var w=img.naturalWidth,hh=img.naturalHeight,m=Math.max(w,hh),k=m>2600?2600/m:(m<1400?1400/m:1);
        var c=document.createElement('canvas');c.width=Math.max(1,Math.round(w*k));c.height=Math.max(1,Math.round(hh*k));
        var x=c.getContext('2d');x.drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);
        var d=x.getImageData(0,0,c.width,c.height),px=d.data,ist=new Uint32Array(256),n=c.width*c.height,i,lo=0,hi=255,a=0;
        for(i=0;i<px.length;i+=4){var y=(px[i]*299+px[i+1]*587+px[i+2]*114)/1000|0;px[i]=y;ist[y]++;}
        for(;lo<255;lo++){a+=ist[lo];if(a>n*0.02)break;}
        for(a=0;hi>0;hi--){a+=ist[hi];if(a>n*0.02)break;}
        var f=hi>lo+10?255/(hi-lo):1;
        for(i=0;i<px.length;i+=4){var v=Math.max(0,Math.min(255,(px[i]-lo)*f))|0;px[i]=px[i+1]=px[i+2]=v;}
        x.putImageData(d,0,0);
        c.toBlob(function(b){if(!b)return ko(new Error('foto non convertita'));b.arrayBuffer().then(ok,ko);},'image/png');
      }catch(e){ko(e);}
    };
    img.onerror=function(){URL.revokeObjectURL(url);ko(new Error('questa foto non si apre'));};
    img.src=url;
  });
}
/* prima lettura con la soglia adattiva (regge le ombre); se righe e totale non tornano, seconda lettura con la soglia
   classica e tengo la migliore. «rilettura» avvisa quando parte la seconda. */
function leggiFoto(file,rilettura){
  return preparaFoto(file).then(function(png){
    function passa(soglia){
      return new Promise(function(ok){var id=++nLett,copia=png.slice(0);letture[id]=ok;lettore().postMessage({t:'leggi',id:id,png:copia,opz:{soglia:soglia}},[copia]);});
    }
    return passa(2).then(function(m){
      if(m.t==='errore')return m;
      var l=leggiScontrino(m.testo);
      if(l.coerente&&l.righe.length)return m;
      if(rilettura)rilettura();
      return passa(0).then(function(m2){
        if(m2.t==='errore')return m;
        var l2=leggiScontrino(m2.testo);
        return (l2.coerente&&!l.coerente)||(l2.coerente===l.coerente&&l2.righe.length>l.righe.length)?m2:m;
      });
    });
  });
}
var fotoInput=null;
function openScontrino(){
  if(IN_CLAUDE){toast('Il lettore di scontrini funziona nell’app vera, non in questa anteprima.');return;}
  if(!fotoInput){
    fotoInput=h('input',{type:'file',accept:'image/*',id:'sc-foto',hidden:true,'aria-hidden':'true',tabindex:'-1'});
    fotoInput.addEventListener('change',function(){var f=fotoInput.files&&fotoInput.files[0];fotoInput.value='';if(f)scontrinoDaFoto(f);});
    document.body.append(fotoInput);
  }
  fotoInput.click();
}
function scontrinoDaFoto(file){
  var stato=h('p',{class:'aiuto','aria-live':'polite'},'Preparo la foto…'),riemp=h('i'),barra=h('div',{class:'progresso'},riemp);
  openSheet('Scontrino',[stato,barra,h('p',{class:'aiuto'},'Tutto avviene sul telefono. La prima volta scarica il lettore (circa 4,5 MB, serve internet); poi legge anche senza rete.')]);
  var fase='Leggo lo scontrino… ';
  function prog(t,p){var n=Math.round(p*100);stato.textContent=(t==='carico'?'Scarico il lettore… ':fase)+n+'%';riemp.style.width=n+'%';}
  progLettore=prog;
  leggiFoto(file,function(){fase='Non torna: rileggo in un altro modo… ';}).then(function(m){
    progLettore=null;
    if(m.t==='errore')throw new Error(m.msg);
    var letto=leggiScontrino(m.testo);
    if(!letto.righe.length){
      openSheet('Scontrino',[h('p',{class:'errore'},'Non trovo righe con un prezzo. Rifai la foto dritta, con buona luce e lo scontrino tutto dentro, oppure inserisci le righe a mano.'),
        h('details',null,h('summary',null,'Testo letto'),h('pre',{class:'sc-pre'},m.testo||'(niente)')),
        h('div',{class:'azioni'},h('button',{class:'pill',type:'button',onclick:openScontrino},'Altra foto'),h('button',{class:'pill',type:'button',onclick:function(){confermaScontrino(letto,m.testo);}},'Inserisci a mano'))]);
      return;
    }
    confermaScontrino(letto,m.testo);
  }).catch(function(err){
    progLettore=null;
    openSheet('Scontrino',[h('p',{class:'errore'},'Lettura non riuscita: '+(err&&err.message||err)+'.'),
      h('p',{class:'aiuto'},'Se è la prima volta serve internet per scaricare il lettore. Puoi anche inserire le righe a mano.'),
      h('div',{class:'azioni'},h('button',{class:'pill',type:'button',onclick:openScontrino},'Riprova'),
        h('button',{class:'pill',type:'button',onclick:function(){confermaScontrino({righe:[],totale:null,somma:0,coerente:false,negozio:'',data:''},'');}},'Inserisci a mano'))]);
  });
}
function opzioniProdotto(sel){
  var o=[];
  cats().forEach(function(c){
    var l=S.products.filter(function(p){return p.cat===c;});if(!l.length)return;
    o.push(h('optgroup',{label:c},l.map(function(p){return h('option',{value:p.id},p.name+(p.on?'':' (fuori listino)'));})));
  });
  o.push(h('optgroup',{label:'Altro'},h('option',{value:'+'},'+ Prodotto nuovo'),h('option',{value:'altro'},'Altra spesa (non va in magazzino)'),h('option',{value:'no'},'Escludi: non è del locale')));
  var s=h('select',{class:'inp sc-prod','aria-label':'Prodotto'},o);s.value=sel;return s;
}
function confermaScontrino(letto,grezzo){
  var righe=propostaScontrino(letto,S.products).map(function(r){
    return {d:r.d,q:r.q,tipo:r.prod?'prod':'+',prod:r.prod,pezzi:r.pezzi,spesa:r.tot,conf:r.conf,certo:r.certo,nome:nomeProposto(r.d),prezzo:'',cat:cats()[0]||'Altro'};
  });
  var lista=h('ol',{class:'sc-righe'}),somma=h('p',{class:'sc-somma','aria-live':'polite'});
  var err=h('p',{class:'errore',role:'alert',hidden:true});
  var conSpesa=h('input',{type:'checkbox',id:'sc-spesa',checked:true});
  var chi=chipSel([{v:'cassa',label:'La cassa'}].concat(peopleOpts()),'cassa');
  var come=chipSel([{v:'cassa',label:'Rimborso dalla cassa'},{v:'debito',label:'Scala dal suo ticket'},{v:'dividi',label:'Dividi tra tutti'}],'cassa');
  var tra=chipSel(peopleOpts(),people().filter(function(p){return p.kind==='paziente';}).map(function(p){return p.id;}),true);
  var boxChi=gruppo('Chi ha pagato',chi),boxCome=gruppo('Come rientra dei soldi',come),boxTra=gruppo('Tra chi si divide',tra);
  function aggSpesa(){boxChi.hidden=!conSpesa.checked;boxCome.hidden=!conSpesa.checked||chi.get()==='cassa';boxTra.hidden=boxCome.hidden||come.get()!=='dividi';}
  conSpesa.addEventListener('change',aggSpesa);chi.addEventListener('change',aggSpesa);come.addEventListener('change',aggSpesa);
  function aggSomma(){
    var t=0,pr=0,al=0;
    righe.forEach(function(r){if(r.tipo==='no')return;var v=parseEur(r.spesaTxt!=null?r.spesaTxt:c2s(r.spesa));if(isNaN(v))return;t+=v;if(r.tipo==='altro')al+=v;else pr+=v;});
    var d=letto.totale!=null?letto.totale-t:null;
    somma.replaceChildren();
    put(somma,[h('b',null,'Righe: '+eur(t)),' (magazzino '+eur(pr)+(al?', altre spese '+eur(al):'')+')',
      letto.totale!=null?[h('br'),'Totale letto sullo scontrino: '+eur(letto.totale)+(d===0?' · torna.':''),
        d?h('span',{class:'rosso'},' · '+(d>0?'mancano '+eur(d):'ci sono '+eur(-d)+' in più')+': controlla le righe.'):null]:null]);
  }
  function rigaUI(r){
    var li=h('li',{class:'sc-riga'+(r.tipo==='prod'&&!r.certo?' dubbio':'')});
    var sel=opzioniProdotto(r.tipo==='prod'?r.prod:r.tipo);
    var pz=h('input',{class:'inp corto',type:'text',inputmode:'numeric',autocomplete:'off',value:String(r.pezzi),'aria-label':'Pezzi'});
    var sp=h('input',{class:'inp soldi corto2',type:'text',inputmode:'decimal',autocomplete:'off',value:c2s(r.spesa),'aria-label':'Spesa della riga'});
    var unit=h('span',{class:'sotto'});
    var nome=testo(null,'Nome del prodotto',40,r.nome),prezzo=soldi(null),cat=h('select',{class:'inp'},cats().concat(cats().indexOf('Altro')<0?['Altro']:[]).map(function(c){return h('option',{value:c},c);}));
    nome.setAttribute('aria-label','Nome del prodotto nuovo');prezzo.setAttribute('aria-label','Prezzo di vendita');prezzo.placeholder='vendita';cat.value=r.cat;cat.setAttribute('aria-label','Categoria');
    var nuovo=h('div',{class:'sc-nuovo'},h('div',{class:'linea'},h('span',{class:'cresce1'},nome)),h('div',{class:'linea'},h('span',{class:'nome cresce1'},'Prezzo di vendita'),prezzo),h('div',{class:'linea'},h('span',{class:'nome cresce1'},'Categoria'),cat));
    var bConf=r.conf>1?h('button',{type:'button',class:'chip sm',onclick:function(){pz.value=String(r.q*r.conf);leggi();}},'Confezione da '+r.conf+'? Metti '+(r.q*r.conf)+' pezzi'):null;
    var numeri=h('div',{class:'sc-num'},h('label',null,h('span',{class:'sotto'},'Pezzi'),pz),h('label',null,h('span',{class:'sotto'},'Spesa €'),sp),unit);
    function leggi(){
      r.tipo=sel.value==='+'||sel.value==='altro'||sel.value==='no'?sel.value:'prod';
      if(r.tipo==='prod')r.prod=sel.value;
      r.pezziTxt=pz.value;r.spesaTxt=sp.value;r.nome=nome.value;r.prezzoTxt=prezzo.value;r.cat=cat.value;
      var n=leggiNumero(pz.value),v=parseEur(sp.value),inMag=r.tipo==='prod'||r.tipo==='+';
      nuovo.hidden=r.tipo!=='+';pz.parentNode.hidden=!inMag;if(bConf)bConf.hidden=!inMag;
      sp.parentNode.hidden=r.tipo==='no';li.classList.toggle('escluso',r.tipo==='no');
      unit.textContent=inMag&&n>0&&!isNaN(v)?eur(Math.round(v/n))+' al pezzo':'';
      aggSomma();
    }
    [sel,pz,sp,nome,prezzo,cat].forEach(function(x){x.addEventListener(x.tagName==='SELECT'?'change':'input',leggi);});
    put(li,[h('div',{class:'sc-d'},h('span',null,r.d||'Riga aggiunta a mano'),r.q>1?h('small',null,' · '+r.q+' sullo scontrino'):null),sel,numeri,bConf,nuovo]);
    setTimeout(leggi,0);
    return li;
  }
  righe.forEach(function(r){lista.append(rigaUI(r));});
  var agg=h('button',{type:'button',class:'pill sm',onclick:function(){var r={d:'',q:1,tipo:'+',prod:null,pezzi:1,spesa:0,conf:1,certo:false,nome:'',prezzo:'',cat:cats()[0]||'Altro'};righe.push(r);lista.append(rigaUI(r));}},'+ Aggiungi riga');
  var salva=h('button',{type:'button',class:'pill duo-verde largo',onclick:function(){
    var vere=[],nomi={},msg='';
    S.products.forEach(function(p){nomi[p.name.toLowerCase()]=1;});
    righe.forEach(function(r,i){
      if(msg||r.tipo==='no')return;
      var n=leggiNumero(r.pezziTxt!=null?r.pezziTxt:String(r.pezzi)),v=parseEur(r.spesaTxt!=null?r.spesaTxt:c2s(r.spesa)),dove='Riga '+(i+1)+': ';
      if(isNaN(v)){msg=dove+'scrivi la spesa, per esempio 1,29.';return;}
      var x={tipo:r.tipo,d:r.d,q:r.q,spesa:v};
      if(r.tipo==='prod'||r.tipo==='+'){
        if(n==null||isNaN(n)||n<1){msg=dove+'scrivi quanti pezzi entrano in magazzino.';return;}
        x.pezzi=n;
      }
      if(r.tipo==='prod')x.prod=r.prod;
      if(r.tipo==='+'){
        var nm=(r.nome||'').trim(),pr=parseEur(r.prezzoTxt||'');
        if(!nm){msg=dove+'scrivi il nome del prodotto nuovo.';return;}
        if(nomi[nm.toLowerCase()]){msg=dove+'«'+nm+'» c’è già nel listino o in un’altra riga: sceglilo dall’elenco.';return;}
        if(isNaN(pr)){msg=dove+'scrivi il prezzo di vendita di «'+nm+'».';return;}
        nomi[nm.toLowerCase()]=1;x.tipo='nuovo';x.nome=nm;x.prezzo=pr;x.cat=r.cat;
      }
      vere.push(x);
    });
    if(!msg&&!vere.length)msg='Non c’è niente da registrare.';
    var by=chi.get(),opz={negozio:letto.negozio,data:letto.data,spesa:conSpesa.checked,by:by,settle:come.get(),tra:tra.get()};
    if(!msg&&opz.spesa&&!by)msg='Scegli chi ha pagato.';
    if(!msg&&opz.spesa&&by!=='cassa'&&opz.settle==='dividi'&&!opz.tra.length)msg='Scegli tra chi dividere la spesa.';
    if(msg){err.textContent=msg;err.hidden=false;err.scrollIntoView({block:'center'});return;}
    err.hidden=true;
    var registra=function(){
      var primaP=JSON.parse(JSON.stringify(S.products));
      var r=applicaScontrino(S,vere,opz,Date.now(),rid);r.mosse.forEach(firma);
      closeSheet();commit();
      toast('Scontrino registrato: '+r.pezzi+(r.pezzi===1?' pezzo':' pezzi')+(r.nuovi.length?', '+r.nuovi.length+(r.nuovi.length===1?' prodotto nuovo':' prodotti nuovi'):'')+(opz.spesa?', spesa '+eur(r.totale):''),function(){
        S.products=primaP;S.moves=S.moves.filter(function(m){return r.mosse.indexOf(m)<0;});commit();toast('Scontrino annullato.');
      });
    };
    // la spesa tocca la cassa: serve il PIN (il foglio dello scontrino resta lì sotto)
    if(opz.spesa)conPin(registra,'Registrare la spesa dello scontrino');else registra();
  }},'Registra lo scontrino');
  aggSpesa();
  openSheet('Conferma lo scontrino',[
    h('p',{class:'aiuto'},(letto.negozio?letto.negozio+(letto.data?' · '+letto.data:'')+'. ':'')+'Controlla ogni riga: prodotto, pezzi che entrano in magazzino e quanto è costata. Le righe evidenziate sono da verificare. Finché non tocchi «Registra» non cambia niente.'),
    h('div',{class:'azioni'},h('button',{type:'button',class:'pill sm',onclick:openScontrino},'Rifai la foto')),
    lista,agg,somma,
    h('div',{class:'riga-tratt'}),
    h('label',{class:'spunta',for:'sc-spesa'},conSpesa,'Registra anche la spesa in cassa'),
    boxChi,boxCome,boxTra,err,salva,
    grezzo?h('details',null,h('summary',null,'Testo letto dalla foto'),h('pre',{class:'sc-pre'},grezzo)):null]);
  guardia={form:lista,soloConferma:true,testo:'Le righe lette dalla foto vanno perse e lo scontrino va rifatto.'};
  aggSomma();
}
/* chi ha l'app: PIN creato e telefono collegato. I PIN non si vedono mai: nei dati c'è solo l'impronta. */
function statoApp(p){
  if(p.kind!=='paziente'){
    if(!p.pin)return null;                                   // visitatore senza codice ospite: niente app
    return haApp(p)?'ha l’app · '+vistoTxt(p):'codice ospite creato · non ancora entrato';
  }
  if(haApp(p))return 'ha l’app · '+vistoTxt(p);
  return (p.pin?'PIN sì':'senza PIN')+' · '+(p.tel?'telefono collegato':'nessun telefono');
}
function riepilogoApp(){
  var tutti=chiPuoEntrare(),senza=tutti.filter(function(p){return !haApp(p);});
  if(!tutti.length)return null;
  return h('section',{class:'cartella','data-k':'riep-app'},
    h('h3',{class:'etichetta'},'Chi ha l’app'),
    h('p',null,h('strong',null,tutti.length-senza.length+' su '+tutti.length),' pazienti hanno l’app'+(senza.length?'. Senza: '+senza.map(nomeP).join(', ')+'.':'. Ci sono tutti.')),
    ospitiCheEntrano().length?h('p',null,h('strong',null,ospitiCheEntrano().filter(haApp).length+' su '+ospitiCheEntrano().length),' ospiti con il codice sono già entrati.'):null,
    h('p',{class:'aiuto'},'«Ha l’app» vuol dire che ha creato il suo PIN ed è entrato dal suo telefono. I PIN non si vedono: chi lo dimentica lo fa azzerare e ne crea uno nuovo.'));
}
function vPersone(){
  return [indietro(),h('h2',{class:'titolo'},'Pazienti'),
    riepilogoApp(),
    h('section',{class:'cartella'},
      h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'In reparto'),h('button',{class:'pill sm',type:'button',onclick:function(){openPerson(null);}},'+ Visitatore')),
      h('div',{class:'riga-tratt'}),
      h('ul',{class:'righe'},S.people.map(function(p){
        var st=statoApp(p),senzaApp=p.kind==='paziente'&&p.on&&!haApp(p);
        return h('li',null,h('button',{type:'button',class:'riga',onclick:function(){openPerson(p.id);}},
          ava(p.id),
          h('span',{class:'cresce'},h('span',{class:'nome'},nomeP(p),p.kind==='amico'?h('span',{class:'tag'},p.pin?'ospite':'visitatore'):null,p.on?null:h('span',{class:'tag'},'dimesso'),senzaApp?h('span',{class:'tag rosso'},'senza app'):null),
            st?h('span',{class:'sotto','data-k':'app-'+p.id},st):null,
            p.img?null:h('span',{class:'sotto'},'senza faccia: tocca per sceglierla')),
          h('span',{class:'importo spento'},h('small',null,'modifica'))));
      })),
      h('p',{class:'aiuto'},'Chi viene «dimesso» sparisce dalla Farmacia ma resta nello storico e nei ticket finché ha un debito.'))];
}

/* ---------- backup ---------- */
function backupData(){return JSON.stringify({app:'the-oblio-house',v:1,exported:new Date().toISOString(),state:S});}
function segnaBackup(){S.meta.exported=Date.now();commit();}
function scaricaBackup(){
  var data=backupData(),name='oblio-backup-'+today()+'.json';
  if(IN_CLAUDE){
    window.claude.use('downloads').then(function(dl){
      if(!dl){mostraBackup(data);return;}
      dl.save({filename:name,data:data}).then(function(){segnaBackup();toast('Backup salvato.');},function(e){if(e&&e.code==='declined')return;mostraBackup(data);});
    },function(){mostraBackup(data);});
    return;
  }
  try{
    var url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
    var a=h('a',{href:url,download:name});document.body.append(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(url);},4000);
    segnaBackup();toast('Backup scaricato: '+name);
  }catch(e){mostraBackup(data);}
}
function condividiBackup(){
  var data=backupData(),name='oblio-backup-'+today()+'.json';
  try{
    var file=new File([data],name,{type:'application/json'});
    navigator.share({files:[file],title:'Backup The Oblio House'}).then(function(){segnaBackup();toast('Backup condiviso.');},function(){});
  }catch(e){scaricaBackup();}
}
function puoCondividere(){
  try{return !IN_CLAUDE&&!!navigator.canShare&&navigator.canShare({files:[new File(['{}'],'x.json',{type:'application/json'})]});}catch(e){return false;}
}
function mostraBackup(data){
  var ta=h('textarea',{class:'inp',id:'bk-ta',rows:8,readonly:true});ta.value=data;
  openSheet('Copia il backup',[h('p',{class:'aiuto'},'Qui il download non è disponibile. Seleziona tutto il testo, copialo e incollalo in una nota o in un messaggio a te stesso.'),ta,
    h('div',{class:'azioni'},h('button',{class:'pill',type:'button',onclick:function(){ta.focus();ta.select();try{navigator.clipboard.writeText(data).then(function(){segnaBackup();toast('Backup copiato.');},function(){});}catch(e){}}},'Copia tutto'))]);
}
function leggiBackup(txt){
  var j;try{j=JSON.parse(txt);}catch(e){return null;}
  var st=normState(j&&j.state?j.state:j);
  return st?{state:st,exported:j&&j.exported?String(j.exported):''}:null;
}
/* backup normale, o copia automatica cifrata (chiede la password) */
function apriBackup(txt,errore){
  var j=null;try{j=JSON.parse(txt);}catch(e){}
  if(!(j&&j.cifrato&&typeof j.cifrato==='object')){var b=leggiBackup(txt);if(!b){toast(errore);return;}chiediImport(b);return;}
  var pw=h('input',{class:'inp',id:'bk-pw',type:'password',autocomplete:'off'});
  openSheet('Copia automatica cifrata',[
    h('p',{class:'aiuto'},'È una copia fatta ogni notte da GitHub. Per aprirla serve la password delle copie automatiche.'),
    campo('Password',pw,'bk-pw'),
    h('div',{class:'azioni'},
      h('button',{class:'pill duo-verde',type:'button','data-k':'bk-apri',onclick:function(){
        var bt=this;bt.disabled=true;
        decifraBackup(j.cifrato,pw.value).then(function(t){
          bt.disabled=false;
          var b=t&&leggiBackup(t);
          if(!b){toast(t?errore:'Password sbagliata.');return;}
          closeSheet();setTimeout(function(){chiediImport(b);},60);
        });
      }},'Apri'),
      h('button',{class:'pill',type:'button',onclick:closeSheet},'Lascia stare'))]);
}
function chiediImport(b){
  var st=b.state;
  openSheet('Ripristina questo backup?',[
    h('dl',{class:'scheda'},
      h('dt',null,'Salvato il'),h('dd',null,b.exported?b.exported.slice(0,10).split('-').reverse().join('/'):'data non indicata'),
      h('dt',null,'Contiene'),h('dd',null,st.people.length+' persone, '+st.products.length+' prodotti, '+st.moves.length+' movimenti, '+st.votes.length+' voti, '+st.games.length+' partite')),
    h('p',{class:'errore'},SYNC&&remote?'I dati attuali vengono sostituiti su tutti i telefoni collegati, non solo su questo.':'I dati che ci sono adesso su questo telefono vengono sostituiti.'),
    h('div',{class:'azioni'},
      h('button',{class:'pill pericolo',type:'button',onclick:function(){var cur=lsGet(KEY);if(cur){lsSet(KEY+'.snap',cur);lsSet(KEY+'.snapT',String(Date.now()));}S=st;lapidiOk=true;closeSheet();commit();toast('Backup ripristinato. I dati di prima sono nella copia automatica.');}},'Sostituisci i dati'),
      h('button',{class:'pill',type:'button',onclick:closeSheet},'Lascia stare'))]);
}
function vBackup(){
  var file=h('input',{class:'inp',id:'bk-file',type:'file',accept:'application/json,.json'});
  file.addEventListener('change',function(){
    var f=file.files&&file.files[0];if(!f)return;
    var r=new FileReader();
    r.onload=function(){apriBackup(String(r.result||''),'Questo file non è un backup dell’Oblio House.');};
    r.readAsText(f);
  });
  var incolla=h('textarea',{class:'inp',id:'bk-in',rows:3,placeholder:'Oppure incolla qui il testo del backup'});
  var snapT=+lsGet(KEY+'.snapT')||0;
  return [indietro(),h('h2',{class:'titolo'},'Backup'),
    h('section',{class:'cartella'},
      h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Metti al sicuro i dati'),h('span',{class:'timbro'+(backupOld()?'':' ok')},backupOld()?'Da fare':'A posto')),
      h('p',{class:'aiuto'},(SYNC&&remote?'I dati sono condivisi tra i telefoni e sul database del locale; il backup è una copia in più, utile se qualcuno cancella per sbaglio. ':'Tutto quello che segni vive solo su questo dispositivo. Se si rompe o si azzera il browser, senza backup si perde. ')+'Ultimo backup: '+backupLine()+'.'),
      h('div',{class:'azioni'},
        puoCondividere()?h('button',{class:'pill duo-verde',type:'button',onclick:condividiBackup},'Condividi backup'):null,
        h('button',{class:'pill'+(puoCondividere()?'':' duo-verde'),type:'button',onclick:scaricaBackup},'Scarica backup'))),
    !isAdmin()?h('section',{class:'cartella'},
      h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Ripristina')),
      h('p',{class:'aiuto'},'Ripristinare un backup sostituisce i dati su tutti i telefoni: lo fa solo l’admin, da Altro › Admin.')):
    h('section',{class:'cartella'},
      h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Ripristina')),
      campo('File di backup',file,'bk-file'),
      h('div',{class:'campo'},h('label',{for:'bk-in'},'Testo di backup'),incolla),
      h('div',{class:'azioni'},
        h('button',{class:'pill',type:'button',onclick:function(){apriBackup(incolla.value,'Il testo incollato non è un backup valido.');}},'Ripristina dal testo'),
        snapT?h('button',{class:'pill',type:'button',onclick:function(){var b=leggiBackup(lsGet(KEY+'.snap')||'');if(!b){toast('Copia automatica non disponibile.');return;}b.exported=new Date(snapT).toISOString();chiediImport(b);}},'Copia automatica'):null),
      snapT?h('p',{class:'aiuto'},'Il telefono tiene da solo una copia di riserva al giorno: l’ultima è di '+relDay(ymd(new Date(snapT))).toLowerCase()+'.'):null)];
}
function vInstalla(){
  var standalone=false;
  try{standalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;}catch(e){}
  var corpo;
  if(IN_CLAUDE)corpo=[h('p',{class:'aiuto'},'Questa è l’anteprima dentro Claude: serve a provare l’app. L’installazione funziona solo aprendo l’app dal suo indirizzo web.')];
  else if(standalone)corpo=[h('p',{class:'aiuto'},'L’app è installata su questo dispositivo e si apre anche senza rete. Per aggiornarla basta aprirla una volta con internet attivo.')];
  else corpo=[
    installEvt?h('div',{class:'azioni'},h('button',{class:'pill duo-verde',type:'button',onclick:function(){try{installEvt.prompt();}catch(e){}}},'Installa adesso')):null,
    h('dl',{class:'scheda'},
      h('dt',null,'iPhone'),h('dd',null,'Apri il link con Safari, tocca Condividi, poi «Aggiungi alla schermata Home» e conferma con «Aggiungi».'),
      h('dt',null,'Android'),h('dd',null,'Menu del browser (tre puntini), poi «Aggiungi a schermata Home» o «Installa app».')),
    h('p',{class:'aiuto'},'Fallo una volta con internet attivo. Da quel momento l’app si apre dall’icona anche senza rete'+(SYNC?'; quando c’è internet si allinea con gli altri telefoni.':' e i dati restano sul telefono.')),
    h('p',{class:'errore'},'Su iPhone l’app sulla Home tiene i dati separati da Safari: installala prima di segnare qualcosa e poi usa sempre l’icona.')];
  return [indietro(),h('h2',{class:'titolo'},'Installa'),h('section',{class:'cartella'},h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Sul telefono del garage'),h('span',{class:'timbro'+(standalone?' ok':'')},standalone?'Installata':'Da fare')),h('div',{class:'riga-tratt'}),corpo)];
}

/* ---------- vista: Freccette ---------- */
function nomeModo(m){return MODI[m]||m;}
function partitaAttiva(){for(var i=S.games.length-1;i>=0;i--){var g=S.games[i];if(!g.x&&!g.ab&&!g.end)return g;}return null;}
function media(r){return r.darts?numIt(r.pts/r.darts*3,1):'—';}
function dartLabel(c,x01){
  if(c==='M')return x01===false?'mancato':'fuori';
  if(c==='D25')return 'centro';
  if(c==='S25')return '25';
  var n=c.slice(1);return c.charAt(0)==='S'?n:c.charAt(0)+n;
}
function descTurno(t,x01){
  var fr=t.d.map(function(c){return dartLabel(c,x01);}).join(' · ');
  if(x01){
    if(t.bust)return pName(t.p)+': '+fr+' · sballato, resta a '+t.a;
    if(t.fin)return pName(t.p)+': '+fr+' = '+t.pts+' · chiude';
    return pName(t.p)+': '+fr+' = '+t.pts+' · resta '+t.a;
  }
  return pName(t.p)+': '+fr+(t.fin?' · giro finito':' · ora al '+t.a);
}
function riassuntoGioc(st,p){
  var r=st.R[p];
  if(st.x01)return (r.left?'resta '+r.left:'chiuso')+' · media '+media(r)+(r.best?' · turno migliore '+r.best:'')+(p===st.win?' · chiusura '+r.co:'');
  return (r.tgt>20?'giro finito':'arrivato al '+r.tgt)+' · '+r.darts+(r.darts===1?' freccetta':' freccette');
}
function mescola(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}}
function nuovaPartita(mode,players){
  var g={id:'g'+rid(),t:Date.now(),mode:mode,players:players.slice(0,8),d:[],end:0};
  S.games.push(g);UI.dart.vista=g.id;UI.dart.mol=1;
  commit();window.scrollTo(0,0);
  toast(nomeModo(mode)+': comincia '+pName(g.players[0])+'.');
}
function rivincita(g){nuovaPartita(g.mode,g.players.slice(1).concat(g.players.slice(0,1)));}
function lancia(g,c){
  if(g.end||g.ab||g.x||!DART_RE.test(c))return;
  var prima=playDarts(g).turns.length;
  var chi=g.players[playDarts(g).cur];
  g.d.push(c);UI.dart.mol=1;UI.dart.appena=Date.now();UI.dart.chi=chi;tocco(15);
  var st=playDarts(g);
  if(st.win)g.end=Date.now();
  commit();
  if(st.win){toast(pName(st.win)+(g.players.length>1?' chiude e vince!':' chiude!'));coriandoli();}
  else if(st.turns.length>prima){var t=st.turns[st.turns.length-1];if(t.bust)toast('Sballato! '+pName(t.p)+' resta a '+t.a+'.');}
}
function annullaFreccia(g){
  if(!g.d.length)return;
  g.d.pop();g.end=0;UI.dart.mol=1;UI.dart.vista=g.id;
  commit();toast('Ultima freccetta tolta.');
}
/* Ludoteca: il voto della serata, le freccette, il muro */
function vLudoteca(){
  var g=partitaAttiva(),ult=S.games.filter(function(x){return !x.x&&!x.ab&&playDarts(x).win;}).slice(-1)[0];
  return [h('h2',{class:'titolo'},'Ludoteca'),
    cardTriage(),
    h('section',{class:'cartella'},
      h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Freccette'),h('button',{class:'pill sm',type:'button',onclick:function(){UI.cl='freccette';go('ludoteca','classifiche');}},'Classifica')),
      h('div',{class:'azioni'},h('button',{class:'pill duo-verde largo',type:'button','data-k':'apri-freccette',onclick:apriFreccette},g?'Riprendi la partita: '+nomeModo(g.mode):'Nuova partita')),
      ult?h('p',{class:'aiuto'},'Ultima: '+nomeModo(ult.mode)+', '+(ult.players.length>1?'vince '+pName(playDarts(ult).win)+' su '+nomiLista(ult.players.filter(function(p){return p!==playDarts(ult).win;})):'allenamento di '+pName(ult.players[0]))+'.'):null),
    cardMuroLudoteca()];
}
function vFreccette(){
  var g=partitaAttiva();
  if(!g&&UI.dart.vista)g=S.games.find(function(x){return x.id===UI.dart.vista&&!x.x&&!x.ab;})||null;
  return g?vPartita(g):vNuovaPartita();
}
function rigaPartita(g){
  var st=playDarts(g),ok=!g.x&&!g.ab&&st.win;
  var esito=g.x?'annullata':g.ab?'abbandonata':st.win?(g.players.length>1?'vince '+pName(st.win):'allenamento'):'in corso';
  return h('li',null,h('button',{type:'button',class:'riga'+(g.x?' annullato':''),onclick:function(){openPartita(g.id);}},
    ok?ava(st.win,'sm'):h('span',{class:'ava sm vuota','aria-hidden':'true'}),
    h('span',{class:'cresce'},h('span',{class:'nome'},nomeModo(g.mode)+' · '+esito),
      h('span',{class:'sotto'},dShort(serata(g.t,S.cfg.voteCut))+' '+hm(g.t)+' · '+g.players.map(pName).join(', '))),
    ic('avanti',20)));
}
function vNuovaPartita(){
  var st=UI.dart,chi=people();
  st.players=st.players.filter(function(id){return chi.some(function(p){return p.id===id;});});
  var modi=h('div',{class:'chips'},Object.keys(MODI).map(function(m){
    return h('button',{type:'button',class:'chip','data-k':'modo-'+m,'aria-pressed':String(st.mode===m),onclick:function(){st.mode=m;render();}},nomeModo(m));
  }));
  var gioc=h('div',{class:'chips'},chi.map(function(p){
    var i=st.players.indexOf(p.id);
    return h('button',{type:'button',class:'chip con-ava num'+(p.kind==='amico'?' amico':''),'data-k':'gioc-'+p.id,'aria-pressed':String(i>=0),
      'aria-label':nomeP(p)+(i>=0?', tira per '+(i===0?'primo':i===1?'secondo':i===2?'terzo':(i+1)+'°'):''),
      onclick:function(){if(i>=0)st.players.splice(i,1);else if(st.players.length<8)st.players.push(p.id);render();}},
      i>=0?h('span',{class:'ordine'},String(i+1)):ava(p.id,'xs'),nomeP(p));
  }),ospite()?null:h('button',{type:'button',class:'chip piu',onclick:function(){openPerson(null,function(id){if(st.players.length<8)st.players.push(id);});}},'+ Visitatore'));
  var regola=st.mode==='orologio'
    ?'Dall’1 al 20 in ordine: conta solo il numero di turno. Il doppio fa avanzare di 2, il triplo di 3. Niente centro alla fine: vince chi supera il 20 per primo.'
    :'Si parte da '+st.mode+' e si scala. Chiusura libera: vince chi arriva a zero preciso, con qualsiasi settore. Chi va sotto zero è sballato: il turno non conta e torna al punteggio di prima.';
  var recenti=S.games.slice(-8).reverse();
  return [indietro(),h('h2',{class:'titolo'},'Freccette'),
    h('section',{class:'cartella'},
      h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Nuova partita')),
      gruppo('Gioco',modi),
      h('p',{class:'aiuto'},regola),
      gruppo('Chi gioca, in ordine di tiro',gioc),
      st.players.length===1?h('p',{class:'aiuto'},'Da solo è allenamento: conta per la media, non per le vittorie.'):null,
      h('div',{class:'azioni'},
        h('button',{class:'pill',type:'button',disabled:st.players.length<2,onclick:function(){mescola(st.players);render();}},'Mescola'),
        h('button',{class:'pill duo-verde',type:'button','data-k':'inizia',disabled:!st.players.length,onclick:function(){nuovaPartita(st.mode,st.players);}},'Inizia la partita'))),
    h('section',{class:'cartella'},
      h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Ultime partite'),h('button',{class:'pill sm',type:'button',onclick:function(){UI.cl='freccette';go('ludoteca','classifiche');}},'Classifica')),
      h('div',{class:'riga-tratt'}),
      recenti.length?h('ul',{class:'righe'},recenti.map(rigaPartita)):h('p',{class:'vuoto'},'Ancora nessuna partita. Il bersaglio aspetta.')),
    cardRecord()];
}
function barraTurno(g,st){
  var p=g.players[st.cur];
  var fresco=Date.now()-(UI.dart.appena||0)<700;
  var slots=[0,1,2].map(function(i){var c=st.turn[i];return h('span',{class:'slot'+(c?' pieno':'')+(c&&fresco&&i===st.turn.length-1?' appena':'')},c?dartLabel(c,st.x01):String(i+1));});
  var parz=st.turn.reduce(function(s,c){return s+dartVal(c).v;},0);
  var ch=st.x01?chiusuraX01(st.R[p].left,3-st.turn.length):null;
  return h('div',{class:'turno'},
    h('span',{class:'turno-chi'},'Tocca a '+pName(p)),
    h('span',{class:'slots'},slots),
    st.x01&&st.turn.length?h('span',{class:'turno-tot'},'= '+parz):null,
    ch?h('p',{class:'consiglio','data-k':'consiglio'},'Per chiudere '+st.R[p].left+': ',h('b',null,ch.map(function(c){return dartLabel(c,true);}).join(' · '))):null);
}
function tastieraX01(g){
  var m=UI.dart.mol,pre=m===3?'T':m===2?'D':'';
  var mods=h('div',{class:'mods',role:'group','aria-label':'Moltiplicatore'},[[1,'Singolo'],[2,'Doppio'],[3,'Triplo']].map(function(x){
    return h('button',{type:'button',class:'mod','data-k':'mol-'+x[0],'aria-pressed':String(m===x[0]),onclick:function(){UI.dart.mol=(m===x[0])?1:x[0];render();}},x[1]);
  }));
  var keys=[];
  for(var n=1;n<=20;n++)(function(n){
    keys.push(h('button',{type:'button',class:'tasto','data-k':'n-'+n,onclick:function(){lancia(g,(m===3?'T':m===2?'D':'S')+n);}},pre+n));
  })(n);
  keys.push(h('button',{type:'button',class:'tasto speciale','data-k':'n-25',disabled:m===3,onclick:function(){lancia(g,m===2?'D25':'S25');}},m===2?'Centro':'25'));
  keys.push(h('button',{type:'button',class:'tasto speciale','data-k':'n-50',onclick:function(){lancia(g,'D25');}},'Centro 50'));
  keys.push(h('button',{type:'button',class:'tasto speciale','data-k':'n-0',onclick:function(){lancia(g,'M');}},'Fuori'));
  keys.push(h('button',{type:'button',class:'tasto speciale indietro-t','data-k':'undo',disabled:!g.d.length,onclick:function(){annullaFreccia(g);}},'↶ Indietro'));
  return h('div',{class:'blocco'},mods,h('div',{class:'tastiera'+(m>1?' mol':'')},keys));
}
function tastieraOrologio(g,st){
  var p=g.players[st.cur],n=st.R[p].tgt;
  function dove(m){return n+m>20?'chiude il giro':'va al '+(n+m);}
  function b(code,titolo,sotto,cls){
    return h('button',{type:'button',class:'tasto grande'+(cls?' '+cls:''),'data-k':'o-'+code.charAt(0),onclick:function(){lancia(g,code);}},h('span',null,titolo),h('small',null,sotto));
  }
  return h('div',{class:'blocco'},
    h('div',{class:'orologio-pad'},
      b('M','Mancato','resta al '+n,'spento'),
      b('S'+n,'Preso il '+n,dove(1)),
      b('D'+n,'Doppio '+n,dove(2)),
      b('T'+n,'Triplo '+n,dove(3))),
    h('button',{type:'button',class:'tasto speciale indietro-t largo','data-k':'undo',disabled:!g.d.length,onclick:function(){annullaFreccia(g);}},'↶ Indietro'));
}
function cardFine(g,st){
  var solo=g.players.length===1;
  return h('section',{class:'cartella'},
    h('div',{class:'cart-h'},h('h3',{class:'etichetta'},solo?'Allenamento finito':'Fine partita'),h('span',{class:'timbro ok'},'Chiusa')),
    h('div',{class:'vincitore'},ava(st.win,'grande'),h('span',{class:'cifrona'},pName(st.win)+(solo?' chiude':' vince'))),
    st.ultimi.length?h('p',{class:'aiuto'},'Ultimo: '+nomiLista(st.ultimi)+'.'):null,
    h('dl',{class:'scheda'},g.players.map(function(p){return [h('dt',null,pName(p)),h('dd',null,riassuntoGioc(st,p))];})),
    h('div',{class:'azioni'},
      h('button',{class:'pill duo-verde',type:'button',onclick:function(){rivincita(g);}},'Rivincita'),
      h('button',{class:'pill',type:'button',onclick:function(){UI.dart.vista=null;render();window.scrollTo(0,0);}},'Nuova partita')),
    h('div',{class:'azioni'},h('button',{class:'pill sm',type:'button',onclick:function(){annullaFreccia(g);}},'↶ Togli l’ultima freccetta')));
}
function vPartita(g){
  var st=playDarts(g),fin=!!st.win,out=[];
  out.push(h('div',{class:'cart-h'},
    h('h2',{class:'titolo'},nomeModo(g.mode)),
    fin?null:h('button',{type:'button',class:'pill sm viola',onclick:function(){openAbbandona(g.id);}},'Abbandona')));
  out.push(h('div',{class:'tabellone'+(g.players.length===1?' uno':g.players.length>2?' molti':'')},g.players.map(function(p,i){
    var r=st.R[p],att=!fin&&i===st.cur,vin=st.win===p,colpo=p===UI.dart.chi&&Date.now()-(UI.dart.appena||0)<700;
    return h('div',{class:'gioc'+(att?' attivo':'')+(vin?' vince':'')+(colpo?' colpo':'')},
      h('span',{class:'gioc-h'},ava(p,'xs'),h('span',{class:'gioc-n'},pName(p))),
      h('span',{class:'gioc-p','data-conta':st.x01?r.left:null,'data-ck':'gioc-'+g.id+'-'+p,'data-fmt':'n'},st.x01?String(r.left):(r.tgt>20?'Fatto':'al '+r.tgt)),
      h('span',{class:'gioc-s'},vin?(g.players.length>1?'vince':'chiude'):att?'tocca a te':st.x01?'media '+media(r):r.darts+(r.darts===1?' freccetta':' freccette')));
  })));
  if(fin)out.push(cardFine(g,st));
  else{
    out.push(barraTurno(g,st));
    out.push(st.x01?tastieraX01(g):tastieraOrologio(g,st));
    var ult=st.turns.length?st.turns[st.turns.length-1]:null;
    if(ult)out.push(h('p',{class:'nota-chiara'},'Ultimo turno · '+descTurno(ult,st.x01)));
  }
  return out;
}
function openAbbandona(id){
  var g=S.games.find(function(x){return x.id===id;});if(!g)return;
  openSheet('Abbandonare la partita?',[
    h('p',{class:'aiuto'},g.d.length?'Resta nello storico come abbandonata e non conta nelle classifiche.':'Non è stata tirata nessuna freccetta: la partita viene cancellata.'),
    h('div',{class:'azioni'},
      h('button',{class:'pill pericolo',type:'button',onclick:function(){
        if(g.d.length)g.ab=Date.now();else S.games=S.games.filter(function(x){return x.id!==id;});
        UI.dart.vista=null;closeSheet();commit();toast('Partita abbandonata.');}},'Sì, abbandona'),
      h('button',{class:'pill',type:'button',onclick:closeSheet},'Continua a giocare'))]);
}
function openPartita(id){
  var chiedi=false;
  var live=function(){
    var g=S.games.find(function(x){return x.id===id;});
    if(!g)return [h('p',{class:'vuoto'},'Partita non più presente.')];
    var st=playDarts(g);
    var dl=h('dl',{class:'scheda'},
      h('dt',null,'Quando'),h('dd',null,dLong(new Date(g.t))+', '+hm(g.t)),
      h('dt',null,'Gioco'),h('dd',null,nomeModo(g.mode)),
      h('dt',null,'Esito'),h('dd',{class:g.x||g.ab?'rosso':null},g.x?'Annullata':g.ab?'Abbandonata':st.win?(g.players.length>1?'Vince '+pName(st.win):'Allenamento di '+pName(st.win)):'In corso'),
      g.players.map(function(p){return [h('dt',null,pName(p)),h('dd',null,riassuntoGioc(st,p))];}));
    var az;
    if(g.x)az=h('div',{class:'azioni'},h('button',{class:'pill',type:'button',onclick:function(){delete g.x;commit();toast('Partita ripristinata.');}},'Ripristina'));
    else if(!st.win&&!g.ab)az=h('div',{class:'azioni'},h('button',{class:'pill duo-verde',type:'button',onclick:function(){UI.dart.vista=g.id;closeSheet();apriFreccette();}},'Riprendi'));
    else if(chiedi)az=[h('p',{class:'errore'},'Annullare la partita? Esce dalle classifiche, ma si può ripristinare.'),
      h('div',{class:'azioni'},
        h('button',{class:'pill pericolo',type:'button',onclick:function(){g.x={t:Date.now()};chiedi=false;if(UI.dart.vista===g.id)UI.dart.vista=null;commit();toast('Partita annullata.');}},'Sì, annulla'),
        h('button',{class:'pill',type:'button',onclick:function(){chiedi=false;refreshSheet();}},'No'))];
    else az=h('div',{class:'azioni'},h('button',{class:'pill pericolo',type:'button',onclick:function(){chiedi=true;refreshSheet();}},'Annulla partita'));
    return [dl,
      st.turns.length?[h('div',{class:'riga-tratt'}),h('span',{class:'etichetta'},'Turni'),h('ol',{class:'turni'},st.turns.map(function(t){return h('li',null,descTurno(t,st.x01));}))]:null,
      h('div',{class:'riga-tratt'}),az];
  };
  openSheet('Partita',live(),live);
}

/* ---------- quota del locale: fondo a parte, una quota a testa al mese ---------- */
function quotaPerMese(mese){return S.quote.find(function(q){return q.mese===mese;})||null;}
function meseDopo(ym){var y=+ym.slice(0,4),m=+ym.slice(5,7)+1;if(m>12){m=1;y++;}return y+'-'+pad(m);}
function giorniA(key){var p=String(key).split('-'),d=new Date(+p[0],+p[1]-1,+p[2],12),o=keyDate(today());return Math.round((d-o)/864e5);}
/* le quote (anche non ancora scadute) che quella persona deve ancora versare, dalla più vecchia */
function quoteAperte(p){
  var out=[];
  statoQuote(S,D,today()).forEach(function(st){
    st.righe.forEach(function(r){if(r.p===p&&r.resto>0)out.push({mese:st.mese,resto:r.resto,scad:st.scad,scaduta:st.scaduta});});
  });
  return out;
}
function versatoIl(mese,p){var t=0;S.moves.forEach(function(m){if(!m.x&&m.k==='qin'&&m.mese===mese&&m.p===p&&m.t>t)t=m.t;});return t;}
function vQuota(){
  var oggi=today(),stati=statoQuote(S,D,oggi).reverse(),adm=isAdmin(),ok=openKey().slice(0,7);
  var prossimo=new Date().getDate()>=15?meseDopo(ok):ok;
  var out=[indietro(),h('h2',{class:'titolo'},'Quota del locale')];
  var mov=S.moves.filter(function(m){return !m.x&&(m.k==='qin'||m.k==='qout');}).slice(-6).reverse();
  out.push(h('section',{class:'cartella'},
    h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Fondo del locale'),h('span',{class:'timbro ok'},'A parte')),
    h('span',{class:'cifrona'+(D.fondo<0?' rosso':''),id:'fondo-tot'},eur(D.fondo)),
    h('p',{class:'aiuto'},'Soldi a parte, non sono in cassa: entrano con le quote di ognuno, escono quando pagate il locale. La quota la pagate solo voi sei.'),
    h('div',{class:'azioni'},
      S.quote.length?h('button',{class:'pill duo-verde',type:'button','data-k':'segna-quota',onclick:function(){openVersaQuota(null,mio()||null);}},'Segna una quota'):null,
      adm?h('button',{class:'pill',type:'button','data-k':'pagato-locale',onclick:openPagatoLocale},'Pagato il locale'):null),
    mov.length?[h('div',{class:'riga-tratt'}),h('span',{class:'etichetta'},'Ultimi movimenti del fondo'),h('ul',{class:'righe'},mov.map(function(m){return moveRow(m,true);}))]:null));
  if(adm&&!quotaPerMese(prossimo))out.push(h('div',{class:'azioni'},h('button',{class:'pill duo-rosa largo',type:'button','data-k':'nuova-quota',onclick:function(){openQuotaMese(null);}},'Imposta la quota di '+meseNome(prossimo))));
  if(!stati.length)out.push(h('section',{class:'cartella'},h('p',{class:'vuoto'},adm?'Nessuna quota ancora: impostala qui sopra. Dal 20 del mese si comincia a raccogliere, entro il 1° si paga.':'Nessuna quota ancora: la imposta l’admin, di solito tra il 20 e il 25 del mese.')));
  stati.slice(0,4).forEach(function(st){
    var q=st.q,tutti=!st.mancano.length;
    out.push(h('section',{class:'cartella'+(st.scaduta&&!tutti?' allarme':'')},
      h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Quota di '+meseNome(st.mese)),
        h('span',{class:'timbro'+(tutti?' ok':'')},tutti?'Pagata':st.scaduta?'In ritardo':'Da raccogliere')),
      h('p',{class:'quota-cifra'},h('b',null,eur(q.a)+' a testa'),' · entro il '+dataBreve(st.scad)+(q.note?' · '+q.note:'')),
      h('p',{class:'aiuto'},'Raccolti '+eur(st.versato)+' su '+eur(st.dovuto)+'.'+(st.scaduta&&!tutti?' Chi non l’ha versata se la ritrova nei graffi, come voce a parte.':'')),
      h('ul',{class:'righe'},st.righe.map(function(r){
        var t=versatoIl(st.mese,r.p);
        return h('li',null,h('button',{type:'button',class:'riga','data-k':'qv-'+st.mese+'-'+r.p,onclick:function(){if(r.resto>0)openVersaQuota(st.mese,r.p);else openCartella(r.p);}},ava(r.p,'sm'),
          h('span',{class:'cresce'},h('span',{class:'nome'},pName(r.p)),
            h('span',{class:'sotto'},r.resto>0?(r.versato?'ha versato '+eur(r.versato)+', '+(st.scaduta?'in ritardo':'mancano '+eur(r.resto)):(st.scaduta?'in ritardo':'non ancora')):'versata il '+dShortT(t)+(r.piu?' · '+eur(r.piu)+' in più':''))),
          h('span',{class:'importo '+(r.resto>0?(st.scaduta?'rosso':''):'verde')},r.resto>0?eur(r.resto):'✓')));
      })),
      adm?h('div',{class:'azioni'},h('button',{class:'pill sm',type:'button',onclick:function(){openQuotaMese(st.mese);}},'Modifica la quota')):null));
  });
  var usc=S.moves.filter(function(m){return !m.x&&m.k==='qout';}).reverse();
  out.push(h('section',{class:'cartella'},
    h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Quando avete pagato il locale')),
    h('div',{class:'riga-tratt'}),
    usc.length?h('ul',{class:'righe'},usc.map(function(m){return moveRow(m,true);})):h('p',{class:'vuoto'},'Ancora nessun pagamento segnato. Lo segna l’admin con «Pagato il locale».')));
  return out;
}
function openQuotaMese(mese){
  if(!isAdmin()){toast('La quota la imposta l’admin.');return;}
  var q=mese?quotaPerMese(mese):null,ok=openKey().slice(0,7),scelte=[ok,meseDopo(ok)];
  if(q&&scelte.indexOf(q.mese)<0)scelte.unshift(q.mese);
  var def=q?q.mese:(new Date().getDate()>=15?meseDopo(ok):ok);
  var mSel=chipSel(scelte.map(function(m){return {v:m,label:meseNome(m)};}),def);
  var a=soldi('qm-a',q?q.a:null);
  var pazienti=people().filter(function(p){return p.kind==='paziente'&&!p.noq;}).map(function(p){return p.id;});
  var chi=chipSel(peopleOpts().filter(function(o){return o.cls!=='amico'||(q&&q.chi.indexOf(o.v)>=0);}),q?q.chi:pazienti,true);
  var note=testo('qm-n','Es. affitto 300 + luce 45 + acqua 15',120,q&&q.note?q.note:'');
  var scad=h('input',{class:'inp',type:'date',id:'qm-s',value:q?scadenzaQuota(q):def+'-01'});
  var info=h('p',{class:'aiuto','aria-live':'polite'});
  function upd(){var v=parseEur(a.value),n=chi.get().length;info.textContent=!isNaN(v)&&v>0&&n?'In tutto '+eur(v*n)+' da '+n+(n===1?' persona.':' persone.'):'';}
  mSel.addEventListener('change',function(){var m=mSel.get();if(m&&!q)scad.value=m+'-01';});
  a.addEventListener('input',upd);chi.addEventListener('change',upd);
  var versamenti=q?S.moves.some(function(m){return !m.x&&m.k==='qin'&&m.mese===q.mese;}):false;
  formSheet(q?'Quota di '+meseNome(q.mese):'Quota del mese',[
    q?null:gruppo('Di che mese',mSel),
    campo('Quota a testa',a,'qm-a'),info,
    gruppo('Chi la paga',chi),
    campo('Cosa comprende (la vedono tutti)',note,'qm-n'),
    campo('Si paga entro',scad,'qm-s'),
    h('p',{class:'aiuto'},'Dal giorno dopo la scadenza, chi non l’ha versata se la ritrova nei graffi come voce a parte. I soldi delle quote vanno nel fondo, non in cassa.'),
    q&&!versamenti?h('div',{class:'azioni'},h('button',{type:'button',class:'pill sm pericolo',onclick:function(){S.quote=S.quote.filter(function(x){return x!==q;});closeSheet();commit();toast('Quota di '+meseNome(q.mese)+' tolta.');}},'Togli questa quota')):null],function(){
    var m=q?q.mese:mSel.get(),v=parseEur(a.value),ids=chi.get(),sc=scad.value;
    if(!m)return 'Scegli il mese.';
    if(!(v>0))return 'Scrivi la quota a testa, per esempio 60,00.';
    if(!ids.length)return 'Scegli chi la paga.';
    if(!/^\d{4}-\d{2}-\d{2}$/.test(sc))return 'Scegli la data di scadenza.';
    var o={id:'q'+m,mese:m,a:v,chi:ids,t:Date.now()};
    if(sc!==m+'-01')o.scad=sc;
    var nt=note.value.trim();if(nt)o.note=nt.slice(0,120);
    S.quote=S.quote.filter(function(x){return x.mese!==m;});S.quote.push(o);
    S.quote.sort(function(x,y){return x.mese<y.mese?-1:1;});
    commit();toast('Quota di '+meseNome(m)+': '+eur(v)+' a testa entro il '+dataBreve(sc)+'.');
  },q?'Salva la quota':'Imposta la quota');
  upd();
}
function openVersaQuota(mese,p){
  var st=statoQuote(S,D,today()),aperte=st.filter(function(x){return x.mancano.length;});
  if(!S.quote.length){toast('Non c’è ancora nessuna quota: la imposta l’admin.');return;}
  var mesi=aperte.map(function(x){return x.mese;});
  if(!mesi.length)mesi=[S.quote[S.quote.length-1].mese];
  if(mese&&mesi.indexOf(mese)<0)mesi.push(mese);
  var chiTutti=[];S.quote.forEach(function(q){if(mesi.indexOf(q.mese)>=0)q.chi.forEach(function(id){if(chiTutti.indexOf(id)<0)chiTutti.push(id);});});
  var mSel=chipSel(mesi.map(function(m){return {v:m,label:meseNome(m)};}),mese||mesi[0]);
  var chi=chipSel(chiTutti.map(function(id){return {v:id,label:pName(id)};}),p&&chiTutti.indexOf(p)>=0?p:null);
  var a=soldi('vq-a'),info=h('p',{class:'aiuto','aria-live':'polite'}),scritto=false;
  function upd(){
    var m=mSel.get(),c=chi.get(),x=st.find(function(z){return z.mese===m;});
    if(!m||!c||!x){info.textContent='Scegli il mese e chi la porta.';return;}
    var r=x.righe.find(function(z){return z.p===c;});
    if(!r){info.textContent=pName(c)+' non è tra chi paga la quota di '+meseNome(m)+'.';return;}
    info.textContent=r.resto>0?'Deve ancora '+eur(r.resto)+' (quota '+eur(r.dovuto)+(r.versato?', già versati '+eur(r.versato):'')+').':'Ha già versato tutta la quota di '+meseNome(m)+'.';
    if(!scritto)a.value=r.resto>0?c2s(r.resto):'';
  }
  a.addEventListener('input',function(){scritto=true;});
  mSel.addEventListener('change',upd);chi.addEventListener('change',upd);
  formSheet('Segna una quota',[
    gruppo('Di che mese',mSel),gruppo('Chi la porta',chi),campo('Quanto',a,'vq-a'),info,
    h('p',{class:'aiuto'},'I soldi vanno nel fondo del locale, non in cassa. Ognuno può segnare la sua quota da sé.')],function(){
    var m=mSel.get(),c=chi.get(),v=parseEur(a.value);
    if(!m)return 'Scegli il mese.';
    if(!c)return 'Scegli chi porta la quota.';
    if(!(v>0))return 'Scrivi quanto ha portato, per esempio 60,00.';
    addMove({k:'qin',p:c,a:v,mese:m},'Quota di '+meseNome(m)+': '+eur(v)+' da '+pName(c)+', nel fondo');
  },'Segna la quota');
  upd();
}
function openPagatoLocale(){
  if(!isAdmin()){toast('Il pagamento del locale lo segna l’admin.');return;}
  var ult=S.quote[S.quote.length-1];
  var mesi=S.quote.slice(-3).map(function(q){return q.mese;});
  var mSel=mesi.length?chipSel(mesi.map(function(m){return {v:m,label:meseNome(m)};}),ult?ult.mese:null,false,true):null;
  var a=soldi('pl-a'),n=testo('pl-n','Es. affitto e bollette di novembre',120,ult?'Affitto e bollette di '+meseNome(ult.mese):'');
  formSheet('Pagato il locale',[
    h('p',{class:'aiuto'},'Nel fondo adesso: '+eur(D.fondo)+'. Quello che segni qui esce dal fondo e resta nello storico, con la data di oggi.'),
    campo('Quanto avete pagato',a,'pl-a'),campo('Cosa',n,'pl-n'),
    mSel?gruppo('Quota di che mese (facoltativo)',mSel):null],function(){
    var v=parseEur(a.value);
    if(!(v>0))return 'Scrivi quanto avete pagato, per esempio 360,00.';
    var mv={k:'qout',a:v,note:n.value.trim().slice(0,120)};
    if(mSel&&mSel.get())mv.mese=mSel.get();
    addMove(mv,'Pagato il locale: '+eur(v)+' dal fondo'+(v>D.fondo?'. Il fondo va sotto zero: qualcuno ha anticipato?':''));
  },'Segna il pagamento');
}
/* ---------- Muroblio del pianto: post-it firmati su un muro di tufo ---------- */
var COLORI_POSTIT=['Giallo','Rosa','Verde','Lilla','Arancio','Azzurro'];
var PUNTINE=['#E8334A','#2BA84A','#F2A900','#7B3FE4','#E8334A','#2E7DE0'];
function puoModificare(w){return isAdmin()||(!!w.dv&&w.dv===devId());}
/* post-it nuovi: quelli scritti da altri dopo l'ultima volta che hai aperto il muro (solo su questo telefono) */
function muroVisto(){var v=+lsGet(KEY+'.muroVisto')||0;if(!v){v=Date.now();lsSet(KEY+'.muroVisto',String(v));}return v;}
function muroNuovi(){var v=muroVisto(),io=mio();return S.muro.filter(function(w){return w.t>v&&w.p!==io;}).length;}
function apriMuro(){UI.muroPrima=muroVisto();lsSet(KEY+'.muroVisto',String(Date.now()));go(UI.tab,'muro');}
function eNuovo(w){var v=UI.muroPrima!=null?UI.muroPrima:muroVisto();return w.t>v&&w.p!==mio();}
function toggleCapisco(w){
  var io=mio();if(!io){toast('Per dire «Ti capisco» entra con il tuo nome.');return;}
  var id=idCapisco(w.id,io),c=S.capisco.find(function(x){return x.id===id;});
  if(c)S.capisco=S.capisco.filter(function(x){return x!==c;});
  else{S.capisco.push({id:id,w:w.id,p:io,t:Date.now()});tocco(12);}
  commit();
}
function postit(w,i,mini){
  var chi=capiti(S,w.id),io=mio(),mioCap=!!io&&chi.indexOf(io)>=0,mod=!mini&&puoModificare(w);
  var r=w.fis&&!mini?-0.5:[-1.8,1.5,-0.6,2,-1.2,0.9][i%6];
  return h('li',{class:'postit c'+w.col+(w.fis&&!mini?' fissato':''),style:'--r:'+r+'deg;--d:'+(3.6+(i*0.7)%2.2).toFixed(2)+'s;--ri:'+(-i*0.9).toFixed(2)+'s;--pc:'+(w.fis?'#2E7DE0':PUNTINE[i%6])},
    h('i',{class:'puntina','aria-hidden':'true'}),
    w.fis&&!mini?h('span',{class:'bandella'},'Fissato dall’admin'):eNuovo(w)?h('span',{class:'nuovo-b'},'Nuovo'):null,
    h('p',{class:'postit-t'},w.testo),
    h('div',{class:'postit-f'},
      h('span',{class:'cresce1'},h('b',null,pName(w.p)),dShortT(w.t)+' '+hm(w.t)+(w.mod&&!mini?' · modificato':'')),
      h('button',{type:'button',class:'capisco','data-k':(mini?'mcap-':'cap-')+w.id,'aria-pressed':String(mioCap),'aria-label':'Ti capisco, '+chi.length,onclick:function(){toggleCapisco(w);}},'Ti capisco ',h('span',{class:'n'},String(chi.length)))),
    !mini&&chi.length?h('p',{class:'chi'},nomiLista(chi)):null,
    mod?h('button',{type:'button',class:'postit-mod','data-k':'mod-'+w.id,'aria-label':'Modifica il post-it di '+pName(w.p),onclick:function(){openPostit(w.id);}},'Modifica'):null);
}
/* gli omini disperati ai piedi del muro: hanno le vostre facce, piangono, pregano, alzano le braccia al cielo */
var POSE_OMINI={
  prega:'<rect class="collo" x="17.5" y="-3" width="5" height="7" rx="2"/><path class="calzoni" d="M16 24L25 36L13 42M23 24L30 36L18 42"/><path class="calzoni-o" d="M16 24L25 36L13 42M23 24L30 36L18 42"/><ellipse class="scarpa" cx="12" cy="42.5" rx="4" ry="2.4"/><ellipse class="scarpa" cx="17" cy="42.5" rx="4" ry="2.4"/><path class="busto" d="M11 4Q20 1 29 4L31 24Q20 26.5 9 24Z"/><path class="ombra" d="M20 2.6Q26 2.8 29 4L31 24Q26 25.6 20 25.8Z"/><path class="cinta" d="M9.6 22.5Q20 25 30.4 22.5"/><path class="colletto" d="M15.5 3.2Q20 8 24.5 3.2"/><path class="manica" d="M12 7L13 16"/><path class="avambraccio" d="M13 16L19 3"/><path class="manica" d="M28 7L27 16"/><path class="avambraccio" d="M27 16L21 3"/><ellipse class="mano" cx="20" cy="1" rx="3.2" ry="5.2"/><path class="dita" d="M20 -4V6"/>',
  piange:'<rect class="collo" x="17.5" y="-3" width="5" height="7" rx="2"/><path class="calzoni" d="M16 24L9 33L11 43M24 24L31 33L29 43"/><path class="calzoni-o" d="M16 24L9 33L11 43M24 24L31 33L29 43"/><ellipse class="scarpa" cx="11" cy="44" rx="4" ry="2.4"/><ellipse class="scarpa" cx="29" cy="44" rx="4" ry="2.4"/><path class="busto" d="M11 4Q20 1 29 4L31 24Q20 26.5 9 24Z"/><path class="ombra" d="M20 2.6Q26 2.8 29 4L31 24Q26 25.6 20 25.8Z"/><path class="cinta" d="M9.6 22.5Q20 25 30.4 22.5"/><path class="colletto" d="M15.5 3.2Q20 8 24.5 3.2"/><path class="manica" d="M12 7L7 1"/><path class="avambraccio" d="M7 1L12 -10"/><path class="manica" d="M28 7L33 1"/><path class="avambraccio" d="M33 1L28 -10"/><ellipse class="mano" cx="12.5" cy="-11" rx="3.4" ry="4.2"/><ellipse class="mano" cx="27.5" cy="-11" rx="3.4" ry="4.2"/>',
  urla:'<rect class="collo" x="17.5" y="-3" width="5" height="7" rx="2"/><path class="calzoni" d="M17 24L15 43M23 24L25 43"/><path class="calzoni-o" d="M17 24L15 43M23 24L25 43"/><ellipse class="scarpa" cx="14" cy="44.5" rx="4" ry="2.4"/><ellipse class="scarpa" cx="26" cy="44.5" rx="4" ry="2.4"/><path class="busto" d="M11 4Q20 1 29 4L31 24Q20 26.5 9 24Z"/><path class="ombra" d="M20 2.6Q26 2.8 29 4L31 24Q26 25.6 20 25.8Z"/><path class="cinta" d="M9.6 22.5Q20 25 30.4 22.5"/><path class="colletto" d="M15.5 3.2Q20 8 24.5 3.2"/><path class="manica" d="M12 7L5 -5"/><path class="avambraccio" d="M5 -5L3 -17"/><path class="manica" d="M28 7L35 -5"/><path class="avambraccio" d="M35 -5L37 -17"/><ellipse class="mano" cx="3" cy="-19" rx="3.2" ry="4"/><ellipse class="mano" cx="37" cy="-19" rx="3.2" ry="4"/>'
};
var ORDINE_POSE=['prega','piange','urla'];
function omini(){
  var e=h('div',{class:'omini','aria-hidden':'true'});
  people().forEach(function(p,i){
    var posa=ORDINE_POSE[i%3],o=h('div',{class:'omino-v '+posa,style:'--oi:'+(-i*0.41).toFixed(2)+'s;--maglia:'+TINTE[(i*3)%TINTE.length]});
    var corpo=h('span',{class:'omino-corpo'});
    corpo.innerHTML='<svg viewBox="0 0 40 46" overflow="visible">'+POSE_OMINI[posa]+'</svg>';
    o.appendChild(h('span',{class:'omino-testa'},ava(p.id),h('i',{class:'occhi'}),h('i',{class:'rivolo s'}),h('i',{class:'rivolo d'}),h('i',{class:'lacr s'}),h('i',{class:'lacr d'})));
    o.appendChild(corpo);
    e.appendChild(o);
  });
  return e;
}
function vMuro(){
  if(UI.muroPrima==null)UI.muroPrima=muroVisto();
  lsSet(KEY+'.muroVisto',String(Date.now()));
  var lista=muroOrdinato(S);
  return [indietro(),h('h2',{class:'titolo'},'Muroblio del pianto'),
    h('p',{class:'nota-chiara'},'Un post-it per dire come va, chiedere aiuto o lamentarsi. Sempre firmato. Resta sul muro finché chi l’ha scritto (o l’admin) non lo stacca.'),
    h('button',{class:'pill duo-rosa largo',type:'button','data-k':'nuovo-postit',onclick:function(){openPostit(null);}},'+ Attacca un post-it'),
    h('div',{class:'tufo muro-tufo'},
      lista.length?h('ul',{class:'muro'},lista.map(function(w,i){return postit(w,i,false);}))
        :h('p',{class:'muro-vuoto'},'Il muro è vuoto. Per ora nessuno piange.'),
      omini())];
}
/* nella Ludoteca: gli ultimi 4 post-it, sul tufo */
function cardMuroLudoteca(){
  var l=S.muro.slice(-4).reverse(),n=S.muro.length;
  return h('section',{class:'cartella'},
    h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Muroblio del pianto'),h('span',{class:'aiuto'},n?n+' post-it':'vuoto')),
    l.length?h('div',{class:'tufo muro-tufo mini'},h('ul',{class:'muro mini'},l.map(function(w,i){return postit(w,i,true);}))):h('p',{class:'aiuto'},'Il muro è vuoto. Scrivi il primo post-it.'),
    h('div',{class:'azioni'},
      h('button',{class:'pill duo-rosa',type:'button','data-k':'scrivi-postit',onclick:function(){openPostit(null);}},'+ Scrivi un post-it'),
      h('button',{class:'pill',type:'button','data-k':'apri-muro',onclick:apriMuro},'Tutto il muro')));
}
function openPostit(id){
  var w=id?S.muro.find(function(x){return x.id===id;}):null;
  if(w&&!puoModificare(w)){toast('Lo può cambiare solo chi l’ha scritto, dal suo telefono, o l’admin.');return;}
  // dalla 0.16.0 il post-it lo firma sempre chi è entrato su questo telefono: niente post-it a nome di un altro
  var io=mio();
  if(!w&&!io){toast('Per scrivere sul muro entra con il tuo nome.');return;}
  var ta=h('textarea',{class:'inp',id:'pi-t',rows:5,maxlength:300,placeholder:'Scrivi qui. Massimo 300 caratteri.'});ta.value=w?w.testo:'';
  var conta=h('p',{class:'aiuto conta','aria-live':'polite'});
  function c(){conta.textContent=ta.value.length+'/300';}
  ta.addEventListener('input',c);c();
  var col=chipSel(COLORI_POSTIT.map(function(n,i){return {v:String(i),label:n,cls:'sm col'+i};}),String(w?w.col:Math.floor(Math.random()*6)));
  var fis=isAdmin()?h('input',{type:'checkbox',id:'pi-fis',checked:!!(w&&w.fis)}):null;
  var togli=w?h('div',{class:'azioni'},h('button',{type:'button',class:'pill sm pericolo','data-k':'stacca',onclick:function(){
    var caps=S.capisco.filter(function(x){return x.w===w.id;});
    S.muro=S.muro.filter(function(x){return x!==w;});S.capisco=S.capisco.filter(function(x){return x.w!==w.id;});closeSheet();commit();
    toast('Post-it staccato.',function(){S.muro.push(w);S.muro.sort(function(a,b){return a.t-b.t;});S.capisco=S.capisco.concat(caps);commit();toast('Rimesso sul muro.');});
  }},'Stacca il post-it')):null;
  formSheet(w?'Post-it di '+pName(w.p):'Nuovo post-it',[
    w?null:h('p',{class:'aiuto'},'Lo firmi tu: '+pName(io)+'.'),
    campo('Cosa vuoi dire',ta,'pi-t'),conta,
    gruppo('Colore',col),
    fis?h('label',{class:'spunta',for:'pi-fis'},fis,'Fissa in cima al muro (avvisi dell’admin)'):null,
    togli],function(){
    var t=ta.value.trim();
    if(t.length<2)return 'Scrivi qualcosa.';
    if(w){w.testo=t.slice(0,300);w.col=+col.get()||0;w.mod=Date.now();if(fis){if(fis.checked)w.fis=1;else delete w.fis;}commit();toast('Post-it aggiornato.');}
    else{var nw={id:'w'+rid(),t:Date.now(),p:io,testo:t.slice(0,300),col:+col.get()||0,dv:devId()};if(fis&&fis.checked)nw.fis=1;S.muro.push(nw);commit();toast('Attaccato sul muro.');}
  },w?'Salva il post-it':'Attacca');
}
/* nel Reparto: l'ultimo post-it, se è dei 3 giorni passati */
function cardMuro(){
  var w=S.muro[S.muro.length-1];
  if(!w||Date.now()-w.t>3*864e5)return null;
  return h('section',{class:'postit-annuncio c'+w.col},
    h('div',{class:'cart-h'},h('h2',{class:'etichetta'},'Dal Muroblio del pianto'),h('button',{class:'pill sm',type:'button',onclick:apriMuro},'Il muro')),
    h('p',{class:'postit-t'},'«'+w.testo+'»'),
    h('p',{class:'postit-f'},'— '+pName(w.p)+', '+relDay(ymd(new Date(w.t))).toLowerCase()+' alle '+hm(w.t)));
}

/* ---------- statistiche del mese ---------- */
function mesiConDati(){
  var min=openKey().slice(0,7);
  S.moves.forEach(function(m){if(m&&m.t){var k=serata(m.t,S.cfg.voteCut).slice(0,7);if(k<min)min=k;}});
  S.games.forEach(function(g){var k=serata(g.t,S.cfg.voteCut).slice(0,7);if(k<min)min=k;});
  var out=[],m=openKey().slice(0,7),n=0;
  while(n<36){out.push(m);if(m<=min)break;m=prevMonth(m);n++;}
  return out;
}
/* statistiche del mese, dentro le Classifiche (dalla 0.11.0 non sono più una pagina a sé) */
/* il mese persona per persona, solo per un argomento: 'triage', 'bar' o 'freccette' */
function meseArgomento(tipo){
  var k=openKey(),mesi=mesiConDati(),ym=UI.statM&&mesi.indexOf(UI.statM)>=0?UI.statM:mesi[0];
  var sel=h('select',{class:'inp',id:'st-mese','aria-label':'Mese'},mesi.map(function(m){return h('option',{value:m},meseNome(m)+(m===k.slice(0,7)?' (in corso)':''));}));
  sel.value=ym;sel.addEventListener('change',function(){UI.statM=sel.value;render();});
  var st=statMese(S,ym,S.cfg.voteCut,k),tot=st.tot;
  var tieni=function(x){return tipo==='triage'?x.votiRic||x.rossi||x.votiDati:tipo==='freccette'?x.gare||x.darts:x.pz||x.tab||x.rifiuti||x.pulizie;};
  var chiave=function(x){return tipo==='triage'?x.votiRic*100+x.rossi:tipo==='freccette'?x.vinte*1000+x.gare:x.eur;};
  var ids=Object.keys(st.per).filter(function(id){return tieni(st.per[id]);}).sort(function(a,b){return chiave(st.per[b])-chiave(st.per[a])||pName(a).localeCompare(pName(b));});
  var numeri=tipo==='triage'?[numero(String(tot.voti),'punti al triage'),numero(String(tot.nSerate),tot.nSerate===1?'serata':'serate')]
    :tipo==='freccette'?[numero(String(tot.partite),tot.partite===1?'partita':'partite')]
    :[numero(eur(tot.eur),'consumato in farmacia'),numero(String(tot.pz),tot.pz===1?'pezzo':'pezzi'),numero(eur(tot.tab),'segnato sul ticket')];
  var out=[h('section',{class:'cartella'},
    h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Il mese in numeri'),h('span',{class:'timbro'+(ym===k.slice(0,7)?'':' ok')},ym===k.slice(0,7)?'In corso':'Chiuso')),
    campo('Mese',sel,'st-mese'),
    h('div',{class:'numeri'},numeri),
    tipo==='bar'&&tot.top?h('p',{class:'aiuto'},'Il più preso: '+tot.top.n+' ('+tot.top.q+(tot.top.q===1?' pezzo).':' pezzi).')):null)];
  if(!ids.length){out.push(h('section',{class:'cartella'},h('p',{class:'vuoto'},'Niente in questo mese.')));return out;}
  var schede=compatta('mese-'+tipo,ids.map(function(id){
    var x=st.per[id],avg=x.darts?x.pts/x.darts*3:0,righe;
    if(tipo==='triage')righe=[
      [h('dt',null,'Ricevuto'),h('dd',null,(x.votiRic===1?'1 punto':x.votiRic+' punti')+(x.rossi?' · '+x.rossi+(x.rossi===1?' codice rosso':' codici rossi'):''))],
      x.votiDati?[h('dt',null,'Ha votato'),h('dd',null,x.votiDati+(x.votiDati===1?' persona':' persone'))]:null];
    else if(tipo==='freccette')righe=[
      [h('dt',null,'Partite'),h('dd',null,x.gare?x.vinte+(x.vinte===1?' vinta su ':' vinte su ')+x.gare:'solo allenamento')],
      x.darts?[h('dt',null,'Media'),h('dd',null,numIt(avg,1)+' ogni tre freccette')]:null];
    else righe=[
      x.pz?[h('dt',null,'Ha preso'),h('dd',null,x.pz+(x.pz===1?' pezzo':' pezzi')+(x.preferito?', soprattutto '+x.preferito.n+' ('+x.preferito.q+')':''))]:null,
      x.tab?[h('dt',null,'Sul ticket'),h('dd',null,eur(x.tab))]:null,
      x.rifiuti||x.pulizie?[h('dt',null,'Faccende'),h('dd',null,[x.rifiuti?'rifiuti '+x.rifiuti+(x.rifiuti===1?' volta':' volte'):'',x.pulizie?'pulizie '+x.pulizie:''].filter(Boolean).join(' · '))]:null];
    return h('section',{class:'cartella scheda-mese'},
      h('div',{class:'cart-h'},h('span',{class:'linea'},ava(id,'sm'),h('h3',{class:'nome'},pName(id))),tipo==='bar'?h('span',{class:'importo'},eur(x.eur)):null),
      h('dl',{class:'scheda'},righe));
  }));
  out.push(schede.righe,schede.tasto);
  return out;
}
function numero(v,l){return h('div',{class:'numero'},h('b',null,v),h('span',null,l));}

/* ---------- medaglie e albo d'oro ---------- */
var ICONE_MEDAGLIA={cento:'100',graffio:'✗',pulito:'✓',puntuale:'€',rosso:'+',freccia:'◎',cecchino:'180',spazzino:'♺'};
function medaglieTutte(){
  var k=today()+'|'+S.moves.length+'|'+S.games.length+'|'+S.votes.length+'|'+S.trash.length+'|'+S.quote.length;
  if(!medaglieTutte.c||medaglieTutte.k!==k||medaglieTutte.D!==D){medaglieTutte.c=medaglie(S,Date.now(),S.cfg.voteCut,openKey());medaglieTutte.k=k;medaglieTutte.D=D;}
  return medaglieTutte.c;
}
function medaglia(k,n){
  var m=MEDAGLIE.find(function(x){return x[0]===k;});
  return h('span',{class:'medaglia m-'+k,title:m?m[2]:''},h('i',{'aria-hidden':'true'},ICONE_MEDAGLIA[k]||'★'),m?m[1]:k,n>1?h('b',null,'×'+n):null);
}
function medaglieDi(id){
  var o=medaglieTutte()[id];if(!o)return null;
  var ks=MEDAGLIE.map(function(x){return x[0];}).filter(function(k){return o[k];});
  return ks.length?h('div',{class:'medaglie','aria-label':'Medaglie'},ks.map(function(k){return medaglia(k,o[k]);})):null;
}
function corpoMedaglie(){
  var o=medaglieTutte(),anni=[],a0=+openKey().slice(0,4),min=a0;
  mesiConDati().forEach(function(m){var y=+m.slice(0,4);if(y<min)min=y;});
  for(var y=a0;y>=min;y--)anni.push(String(y));
  var anno=UI.albo&&anni.indexOf(UI.albo)>=0?UI.albo:anni[0];
  var chips=h('div',{class:'chips',role:'group','aria-label':'Anno'},anni.map(function(y){
    return h('button',{type:'button',class:'chip','aria-pressed':String(y===anno),onclick:function(){UI.albo=y;render();}},y);
  }));
  var albo=alboOro(S,anno,S.cfg.voteCut,openKey(),Date.now());
  var out=[];
  out.push(h('section',{class:'cartella albo'},
    h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Albo d’oro '+anno),h('span',{class:'timbro'+(String(a0)===anno?'':' ok')},String(a0)===anno?'In corso':'Definitivo')),
    chips,
    h('ul',{class:'righe'},albo.map(function(v){
      var val=v.k==='consumi'?eur(v.n):v.k==='pagatore'?(v.n?numIt(v.n,1)+' giorni':'subito'):v.n+' '+v.u[v.n===1?0:1];
      return h('li',null,h('div',{class:'riga'},
        v.chi.length===1?ava(v.chi[0],'sm'):h('span',{class:'ava sm vuota','aria-hidden':'true'}),
        h('span',{class:'cresce'},h('span',{class:'sotto'},v.titolo),h('span',{class:'nome'},v.chi.length?nomiLista(v.chi):'nessuno, per ora')),
        v.chi.length?h('span',{class:'importo'},val):null));
    })),
    h('p',{class:'aiuto'},String(a0)===anno?'L’anno è in corso: i nomi possono ancora cambiare. Dal 1° gennaio restano scritti per sempre.':'I campioni del '+anno+'. Il miglior pagatore conta solo chi ha preso almeno 10 euro.')));
  out.push(h('section',{class:'cartella'},
    h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Medaglie')),
    h('p',{class:'aiuto'},'Si guadagnano e restano. Quelle «del mese» arrivano quando il mese è finito.'),
    h('div',{class:'riga-tratt'}),
    h('ul',{class:'righe'},MEDAGLIE.map(function(m){
      var chi=Object.keys(o).filter(function(id){return o[id][m[0]];}).sort(function(a,b){return o[b][m[0]]-o[a][m[0]]||pName(a).localeCompare(pName(b));});
      return h('li',{class:'medaglia-riga'},medaglia(m[0],0),h('p',{class:'aiuto'},m[2]),
        chi.length?h('p',{class:'chi-medaglia'},chi.map(function(id){return pName(id)+(o[id][m[0]]>1?' ×'+o[id][m[0]]:'');}).join(' · ')):h('p',{class:'aiuto'},'Nessuno, per ora.'));
    }))));
  return out;
}

/* ---------- record delle freccette (nella pagina delle freccette) ---------- */
function cardRecord(){
  var R=recordFreccette(S),righe=[];
  function r(titolo,x,val){if(x)righe.push(h('li',null,h('div',{class:'riga'},ava(x.p,'sm'),h('span',{class:'cresce'},h('span',{class:'sotto'},titolo),h('span',{class:'nome'},pName(x.p)+(x.t?' · '+dShortT(x.t):''))),h('span',{class:'importo'},val))));}
  r('Turno migliore',R.turno,R.turno&&String(R.turno.v));
  r('Chiusura più alta',R.chiusura,R.chiusura&&String(R.chiusura.v));
  r('Media migliore in una partita',R.media,R.media&&numIt(R.media.v,1));
  r('501 più veloce',R.veloce501,R.veloce501&&R.veloce501.v+' freccette');
  r('301 più veloce',R.veloce301,R.veloce301&&R.veloce301.v+' freccette');
  r('Giro dell’orologio più veloce',R.orologio,R.orologio&&R.orologio.v+' freccette');
  r('Vittorie di fila',R.serie,R.serie&&String(R.serie.v));
  var c180=Object.keys(R.c180).sort(function(a,b){return R.c180[b]-R.c180[a];});
  if(c180.length)righe.push(h('li',null,h('div',{class:'riga'},ava(c180[0],'sm'),h('span',{class:'cresce'},h('span',{class:'sotto'},'Turni da 180'),h('span',{class:'nome'},c180.map(function(p){return pName(p)+' '+R.c180[p];}).join(' · '))))));
  return h('section',{class:'cartella'},
    h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Record'),h('span',{class:'timbro ok'},'Di sempre')),
    h('div',{class:'riga-tratt'}),
    righe.length?h('ul',{class:'righe'},righe):h('p',{class:'vuoto'},'Nessun record ancora: servono partite finite.'));
}

/* ---------- coriandoli: vittorie a freccette, Re dell'oblio, compleanni ---------- */
var COLORI_FESTA=['#FFD23F','#FF4D97','#9BE22D','#D9C8FF','#FF7A1A','#BFE3F2'];
function coriandoli(){
  try{if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;}catch(e){}
  var c=document.createElement('canvas'),W=window.innerWidth,H=window.innerHeight,dpr=Math.min(2,window.devicePixelRatio||1);
  c.className='coriandoli';c.setAttribute('aria-hidden','true');c.width=W*dpr;c.height=H*dpr;
  document.body.appendChild(c);
  var x=c.getContext('2d');if(!x){c.remove();return;}
  x.scale(dpr,dpr);
  var P=[],i,t0=Date.now();
  for(i=0;i<140;i++)P.push({x:W*(.2+Math.random()*.6),y:H*.35,vx:(Math.random()-.5)*9,vy:-4-Math.random()*9,r:Math.random()*6.28,vr:(Math.random()-.5)*.4,w:5+Math.random()*5,h:8+Math.random()*6,c:COLORI_FESTA[i%COLORI_FESTA.length]});
  (function passo(){
    var dt=Date.now()-t0;
    x.clearRect(0,0,W,H);
    P.forEach(function(p){p.vy+=.25;p.vx*=.99;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;
      x.save();x.translate(p.x,p.y);x.rotate(p.r);x.fillStyle=p.c;x.fillRect(-p.w/2,-p.h/2,p.w,p.h*Math.abs(Math.cos(p.r*2)));x.restore();});
    if(dt<3200)requestAnimationFrame(passo);else c.remove();
  })();
}
/* la festa una volta sola per telefono (chiave: cosa si festeggia e quando) */
function festa(tipo,quando){
  var k=KEY+'.festa.'+tipo;
  if(lsGet(k)===quando)return;
  if(!lsSet(k,quando))return;
  setTimeout(coriandoli,350);
}

/* ---------- riepilogo di ieri sera, nel Reparto fino alle 20 ---------- */
function cardRiepilogo(){
  var ora=new Date().getHours();if(ora<S.cfg.voteCut||ora>=20)return null;
  var d=keyDate(openKey()),k=ymd(new Date(d.getFullYear(),d.getMonth(),d.getDate()-1,12)),R=riepilogoSerata(S,k,S.cfg.voteCut);
  if(!R)return null;
  if(R.winners.length)festa('re',k);
  var righe=[];
  if(R.winners.length)righe.push(h('li',null,ic('medaglia',18),h('span',null,h('b',null,(R.winners.length>1?'Re dell’oblio, a pari punti: ':'Re dell’oblio: ')+nomiLista(R.winners)),
    R.podio.length>1?' · podio '+R.podio.map(function(x){return x.pos+'° '+pName(x.id);}).join(', '):'')));
  if(R.partite)righe.push(h('li',null,ic('bersaglio',18),h('span',null,R.partite+(R.partite===1?' partita a freccette':' partite a freccette'),R.freccia?' · vince di più '+pName(R.freccia.p)+' ('+R.freccia.n+')':'')));
  if(R.pz)righe.push(h('li',null,ic('bicchiere',18),h('span',null,R.pz+(R.pz===1?' consumazione':' consumazioni'),R.topProd.length?' · '+R.topProd.map(function(x){return x.n+' '+x.q;}).join(', '):'',R.beve?' · il più assetato: '+pName(R.beve.p):'')));
  if(R.cassa||R.graffi)righe.push(h('li',null,ic('cassa',18),h('span',null,'Entrati in cassa '+eur(R.cassa),R.graffi?' · segnati sul ticket '+eur(R.graffi):'')));
  return h('section',{class:'cartella riepilogo'},
    h('div',{class:'cart-h'},h('h2',{class:'etichetta'},'Com’è andata '+nomeSerata(k)),h('span',{class:'timbro ok'},'Riepilogo')),
    h('ul',{class:'riep'},righe));
}

/* ---------- compleanni nel Reparto ---------- */
function cardCompleanno(){
  var l=prossimiCompleanni(S,today()).filter(function(x){return x.giorni===0;});
  if(!l.length)return null;
  festa('compleanno',today());
  return h('section',{class:'festa'},
    h('div',{class:'festa-facce'},l.map(function(x){return ava(x.p,'grande');})),
    h('h2',{class:'festa-t'},'Oggi compie gli anni '+nomiLista(l.map(function(x){return x.p;}))+'!'),
    h('p',null,'Tanti auguri dal reparto. Oggi offre '+(l.length>1?'chi compie gli anni':pName(l[0].p))+'?'));
}

/* ---------- verifica del mese: foto del previsionale e confronto ---------- */
function cardVerifiche(){
  var v=S.verifiche.slice().reverse();
  return h('section',{class:'cartella'},
    h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Verifica del mese'),h('span',{class:'timbro'+(v.length?' ok':'')},v.length?v.length+(v.length===1?' foto':' foto'):'Mai fatta')),
    h('p',{class:'aiuto'},'Alla verifica del mese: contate la cassa, fate l’inventario, controllate i graffi, poi salvate la foto. La volta dopo l’app vi dice quanto è cambiato il previsionale, voce per voce, e cosa è sfuggito.'),
    h('div',{class:'azioni'},h('button',{class:'pill duo-verde',type:'button','data-k':'salva-verifica',onclick:function(){conPin(openVerifica,'Salvare la verifica del mese');}},'Salva la foto di oggi')),
    v.length?[h('div',{class:'riga-tratt'}),h('ul',{class:'righe'},v.map(function(x){
      return h('li',null,h('button',{type:'button',class:'riga',onclick:function(){openConfronto(x.id);}},
        h('span',{class:'cresce'},h('span',{class:'nome'},dLong(new Date(x.t))+' '+new Date(x.t).getFullYear()),h('span',{class:'sotto'},'previsionale '+eur(x.previsionale)+' · cassa '+eur(x.cassa)+(x.nota?' · '+x.nota:''))),
        ic('avanti',20)));
    }))]:null);
}
function openVerifica(){
  var P=previsione(S,D),tc=ultimoDi('count'),ti=ultimoDi('inv');
  var n=testo('vf-n','Es. festa di ottobre',120);
  var avv=[];
  if(!tc||Date.now()-tc>864e5)avv.push('Oggi la cassa non è stata contata: la foto userà la cassa calcolata dall’app.');
  if(!ti||Date.now()-ti>864e5)avv.push('Oggi non è stato fatto l’inventario: le scorte sono quelle calcolate.');
  formSheet('Foto della verifica',[
    h('dl',{class:'scheda'},
      h('dt',null,'Cassa'),h('dd',null,eur(P.cassa)),
      h('dt',null,'Scorte'),h('dd',null,eur(P.scorte)),
      h('dt',null,'Graffi'),h('dd',null,eurS(P.incassare)),
      h('dt',null,'Crediti'),h('dd',null,eurS(-P.restituire)),
      h('dt',null,'Previsionale'),h('dd',null,eur(P.previsionale)),
      h('dt',null,'Fondo quota'),h('dd',null,eur(D.fondo))),
    avv.length?h('ul',{class:'avvisi'},avv.map(function(t){return h('li',{class:'rosso'},t);})):null,
    campo('Nota (facoltativa)',n,'vf-n')],function(){
    var o={id:'k'+rid(),t:Date.now(),cassa:P.cassa,scorte:P.scorte,incassare:P.incassare,restituire:P.restituire,previsionale:P.previsionale,fondo:D.fondo};
    var nt=n.value.trim();if(nt)o.nota=nt.slice(0,120);
    var io=mio();if(io)o.da=io;
    S.verifiche.push(o);commit();toast('Foto della verifica salvata.');
  },'Salva la foto');
}
var VOCI_VERIFICA=[['carichi','Merce arrivata (carichi, a prezzo di vendita)'],['vendite','Consumazioni fuori listino o a un prezzo diverso'],['spese','Spese'],['entrate','Entrate in cassa'],
  ['debiti','Debiti aggiunti o tolti a mano'],['prelievi','Presi dalla cassa (sul ticket)'],['prezzi','Cambi di prezzo sulle scorte'],['conte','Differenze trovate contando la cassa'],['inventari','Differenze trovate all’inventario'],['altro','Altro']];
function openConfronto(id){
  var i=S.verifiche.findIndex(function(x){return x.id===id;});if(i<0)return;
  var v=S.verifiche[i],dopo=S.verifiche[i+1]||null,tFine=dopo?dopo.t:Date.now(),r=spiegaVerifica(S,v,tFine);
  var reale=dopo?dopo.previsionale:r.adesso;
  var righe=VOCI_VERIFICA.filter(function(x){return r.cat[x[0]];}).map(function(x){
    var d=r.cat[x[0]],sf=x[0]==='conte'||x[0]==='inventari';
    return rigaConto(x[1],null,eurS(d),sf?'sfuggito':null,d<0?'rosso':'verde');
  });
  if(r.correzioni)righe.unshift(rigaConto('Correzioni al passato','movimenti di prima della foto annullati o segnati dopo',eurS(r.correzioni),null,r.correzioni<0?'rosso':'verde'));
  var scarto=dopo?reale-(v.previsionale+r.correzioni+r.somma):0;
  openSheet('Verifica del '+dShortT(v.t),[
    h('dl',{class:'scheda'},
      h('dt',null,'Foto del '+dShortT(v.t)),h('dd',null,eur(v.previsionale)),
      h('dt',null,dopo?'Foto del '+dShortT(dopo.t):'Adesso'),h('dd',null,eur(reale)),
      h('dt',null,'Differenza'),h('dd',{class:reale-v.previsionale<0?'rosso':'verde'},eurS(reale-v.previsionale)),
      v.nota?[h('dt',null,'Nota'),h('dd',null,v.nota)]:null),
    h('div',{class:'riga-tratt'}),
    h('span',{class:'etichetta'},'Come si spiega'),
    righe.length?h('ul',{class:'righe conto'},righe):h('p',{class:'vuoto'},'Niente è cambiato.'),
    h('div',{class:'sfuggito-box'+(r.sfuggito<0?' meno':'')},h('b',null,r.sfuggito===0?'Non è sfuggito niente':r.sfuggito<0?'Sfuggiti '+eur(-r.sfuggito):'Trovati '+eur(r.sfuggito)+' in più'),
      h('p',null,'È la somma delle differenze trovate contando la cassa e facendo l’inventario: soldi o merce che non tornavano con quello che era segnato.')),
    scarto?h('p',{class:'aiuto'},'Scarto con la foto successiva: '+eurS(scarto)+' (dati cambiati dopo quella foto).'):null,
    h('p',{class:'aiuto'},'Le consumazioni vendute a listino e i pagamenti dei graffi non cambiano il previsionale: spostano solo soldi tra scorte, graffi e cassa. La quota del locale è a parte.'),
    isAdmin()?h('div',{class:'azioni'},h('button',{type:'button',class:'pill sm pericolo',onclick:function(){S.verifiche=S.verifiche.filter(function(x){return x!==v;});closeSheet();commit();toast('Foto della verifica tolta.');}},'Togli questa foto')):null]);
}

/* ---------- classifiche ---------- */
function ordina(items){return items.sort(function(x,y){return (y.a-x.a)||(y.b-x.b)||pName(x.id).localeCompare(pName(y.id));});}
function righeClassifica(items){
  var rank=0,prev=null;
  return items.map(function(it,i){
    var key=it.a+'|'+it.b;
    if(key!==prev){rank=i+1;prev=key;}
    return h('li',{class:rank===1?'primo':null},
      h('span',{class:'pos'},String(rank)),ava(it.id,'sm'),
      h('span',{class:'cresce'},h('span',{class:'nome'},pName(it.id),isVisitor(it.id)?h('span',{class:'tag'},'visitatore'):null),it.sub?h('span',{class:'sotto'},it.sub):null),
      h('span',{class:'importo'+(it.cls?' '+it.cls:'')},it.val));
  });
}
/* classifiche compatte (dalla 0.19.0): si vedono i primi 3, il resto con «Vedi tutti». k = chiave per ricordarsi cosa è aperto */
var COMPATTA=3;
function compatta(k,list){
  if(list.length<=COMPATTA+1)return {righe:list,tasto:null};
  var aperto=!!UI.aperte[k];
  return {righe:aperto?list:list.slice(0,COMPATTA),
    tasto:h('button',{type:'button',class:'pill sm piu','data-k':'piu-'+k,'aria-expanded':String(aperto),onclick:function(){tocco();UI.aperte[k]=!aperto;render();}},aperto?'Mostra meno':'Vedi tutti ('+list.length+')')};
}
function boardC(titolo,sotto,items,vuoto){
  var c=compatta(titolo,righeClassifica(items));
  return h('section',{class:'cartella'},
    h('div',{class:'cart-h'},h('h3',{class:'etichetta'},titolo)),
    sotto?h('p',{class:'aiuto'},sotto):null,
    h('div',{class:'riga-tratt'}),
    items.length?h('ol',{class:'classifica'},c.righe):h('p',{class:'vuoto'},vuoto),c.tasto);
}
/* linguette in cima a una pagina (Farmacia, Classifiche): [valore, etichetta] */
function linguette(k,voci,att,scegli){
  return h('div',{class:'linguette',role:'tablist'},voci.map(function(v){
    return h('button',{type:'button',role:'tab',class:'linguetta','data-k':k+'-'+v[0],'aria-selected':String(att===v[0]),onclick:function(){tocco();scegli(v[0]);}},v[1]);
  }));
}
/* Classifiche divise per argomento: Triage, Bar, Freccette, Albo (medaglie e albo d'oro) */
var LINGUETTE_CL=[['triage','Triage'],['bar','Bar'],['freccette','Freccette'],['albo','Albo']];
function vClassifiche(){
  // l'ospite non vede la linguetta Bar (consumi e ticket di tutti, in euro)
  var voci=ospite()?LINGUETTE_CL.filter(function(x){return x[0]!=='bar';}):LINGUETTE_CL;
  var t=voci.some(function(x){return x[0]===UI.cl;})?UI.cl:'triage';
  var out=[UI.sub?indietro():null,h('h2',{class:'titolo'},'Classifiche'),
    linguette('cl',voci,t,function(v){UI.cl=v;render();window.scrollTo(0,0);})];
  return out.concat(t==='albo'?corpoMedaglie():t==='bar'?corpoBar():t==='freccette'?corpoFreccette():corpoTriage());
}
function periodoCl(){
  var k=openKey(),per=UI.per,cut=S.cfg.voteCut,ym=k.slice(0,7);
  var quando=per==='7g'?'ultimi 7 giorni':per==='mese'?meseNome(ym):per==='scorso'?meseNome(prevMonth(ym)):'da sempre';
  return [h('div',{class:'chips',role:'group','aria-label':'Periodo'},[['7g','Ultimi 7 giorni'],['mese','Questo mese'],['scorso','Mese scorso'],['sempre','Da sempre']].map(function(x){
      return h('button',{type:'button',class:'chip','data-k':'per-'+x[0],'aria-pressed':String(per===x[0]),onclick:function(){UI.per=x[0];render();}},x[1]);
    })),
    h('p',{class:'nota-chiara'},'Periodo: '+quando+'. Tutto si conta per serata: quello che succede prima delle '+(cut===0?'24':cut)+':00 vale per la sera prima.')];
}
function corpoTriage(){
  var k=openKey(),per=UI.per,re=statRe(S,per,k);
  var iRe=ordina(Object.keys(re.by).filter(function(id){return re.by[id].voti>0;}).map(function(id){
    var x=re.by[id];
    return {id:id,a:x.voti,b:x.rossi,val:puntiTxt(x.voti),
      sub:x.pos.map(function(n,i){return n?(n===1?'1 volta ':n+' volte ')+POSTI[i]:'';}).filter(Boolean).join(' · ')||'mai sul podio'};}));
  // Re dell'oblio: chi ha vinto più serate (codici rossi), come nell'Albo e nella medaglia; a pari serate, più punti
  var iRo=ordina(Object.keys(re.by).filter(function(id){return re.by[id].rossi>0;}).map(function(id){
    var x=re.by[id];
    return {id:id,a:x.rossi,b:x.voti,val:x.rossi+(x.rossi===1?' codice rosso':' codici rossi'),sub:puntiTxt(x.voti)};}));
  var ch=serateChiuse(S,k),tutte=Object.keys(ch).filter(function(s){return inPer(s,per,k)&&ch[s].n;}).sort().reverse(),ks=tutte.slice(0,10);
  var cSe=compatta('serate',ks.map(function(s){
        var sm=ch[s];
        return h('li',null,h('div',{class:'riga'},
          h('span',{class:'ora'},dShort(s)),
          sm.winners.length===1?ava(sm.winners[0],'sm'):null,
          h('span',{class:'cresce'},h('span',{class:'nome'},testoPodio(sm)),h('span',{class:'sotto'},sm.n+(sm.n===1?' votante':' votanti')))));
      }));
  // sintomi più dati nelle serate chiuse del periodo
  var sy={};tutte.forEach(function(s){var si=ch[s].sint;Object.keys(si).forEach(function(c){Object.keys(si[c]).forEach(function(y){sy[y]=(sy[y]||0)+si[c][y];});});});
  var tops=Object.keys(sy).sort(function(a,b){return sy[b]-sy[a]||a.localeCompare(b);}).slice(0,8);
  var cSy=compatta('sintomi',tops.map(function(y){return h('li',null,h('div',{class:'riga'},h('span',{class:'cresce nome'},y),h('span',{class:'tri-v'},sy[y]+(sy[y]===1?' volta':' volte'))));}));
  return periodoCl().concat([
    boardC('Il più votato','I punti del triage di tutte le serate chiuse, e quante volte ognuno è salito sul podio.'+(re.serate?' '+re.serate+(re.serate===1?' serata votata.':' serate votate.'):''),iRe,'Nessuna serata votata in questo periodo. La serata in corso conta da quando si chiude, '+chiusuraTxt()+'.'),
    iRo.length?boardC('Re dell’oblio','Chi ha vinto più serate (codice rosso). A pari serate passa avanti chi ha più punti.',iRo,''):null,
    ks.length?h('section',{class:'cartella'},h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Ultime serate')),h('div',{class:'riga-tratt'}),
      h('ul',{class:'righe'},cSe.righe),cSe.tasto):null,
    tops.length?h('section',{class:'cartella'},h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Sintomi più dati')),h('div',{class:'riga-tratt'}),
      h('ul',{class:'righe'},cSy.righe),cSy.tasto):null
  ],meseArgomento('triage'));
}
function corpoBar(){
  var k=openKey(),per=UI.per,cut=S.cfg.voteCut,now=Date.now(),co=statConsumi(S,per,k,cut),pg=statPagatori(S,per,k,cut,now),sp=statSpazzatura(S,per,k);
  var iCo=ordina(Object.keys(co).map(function(id){var x=co[id];return {id:id,a:x.eur,b:x.pz,val:eur(x.eur),sub:x.pz+(x.pz===1?' pezzo':' pezzi')};}));
  var iDe=ordina(people(true).filter(function(p){return (D.debt[p.id]||0)>0;}).map(function(p){
    var u=D.units[p.id]||0;return {id:p.id,a:D.debt[p.id],b:u,val:eur(D.debt[p.id]),cls:'rosso',sub:u+(u===1?' tacca':' tacche')};}));
  var iPg=ordina(Object.keys(pg).map(function(id){
    var x=pg[id],g10=Math.round(x.giorni*10);
    // a parità di giorni passa avanti chi ha meno ancora da saldare
    return {id:id,a:-g10,b:-x.open,val:g10===0&&!x.open?'subito':numIt(g10/10,1)+(g10===10?' giorno':' giorni'),
      sub:'su '+eur(x.eur)+(x.open?' · '+eur(x.open)+' ancora sul ticket':' · tutto saldato')};}));
  var iSp=ordina(Object.keys(sp).map(function(id){var x=sp[id];return {id:id,a:x.n,b:0,val:x.n+(x.n===1?' volta':' volte'),sub:'ultima: '+dShort(x.ultima)};}));
  return periodoCl().concat([
    boardC('Consumi','Quanto ha preso ognuno in farmacia, pagato subito o sul ticket.',iCo,'Nessuna consumazione in questo periodo.'),
    boardC('Debiti','Ticket aperti adesso: non dipende dal periodo.',iDe,'Nessun ticket aperto.'),
    boardC('Migliori pagatori','Giorni in media tra consumazione e saldo, pesati sugli euro. «Paga subito» conta zero; quello ancora sul ticket conta fino a oggi.',iPg,'Nessuna consumazione in questo periodo.'),
    boardC('Spazzatura','Chi ha portato giù i rifiuti: una volta per ogni serata di uscita.',iSp,
      calPieno(S.cfg)?'Nessuno ha portato giù i rifiuti in questo periodo.':'Prima va compilato il calendario dei rifiuti, in Altro › Regole del reparto.')
  ],meseArgomento('bar'));
}
function corpoFreccette(){
  var k=openKey(),per=UI.per,fr=statFreccette(S,per,k,S.cfg.voteCut);
  var iFr=ordina(Object.keys(fr).filter(function(id){return fr[id].gare>0||fr[id].darts>0;}).map(function(id){
    var x=fr[id],avg=x.darts?x.pts/x.darts*3:0,pc=percFreccette(x);
    return {id:id,a:pc>=0?Math.round(pc*1000):-1,b:x.gare,val:pc>=0?Math.round(pc*100)+'%':'—',
      sub:[x.gare?x.vinte+(x.vinte===1?' vinta su ':' vinte su ')+x.gare:'solo allenamento',pc<0&&x.gare?'poche partite: ne servono '+FRECCE_MIN:null,x.darts?'media '+numIt(avg,1):null,x.co?'chiusura migliore '+x.co:null,x.ultimo?'ultimo '+x.ultimo+(x.ultimo===1?' volta':' volte'):null].filter(Boolean).join(' · ')};}));
  return periodoCl().concat([
    boardC('Freccette','Percentuale di vittorie sulle partite finite con almeno due giocatori. Si entra in classifica da '+FRECCE_MIN+' partite. La media è per tre freccette, solo 501 e 301.',iFr,'Nessuna partita finita in questo periodo.'),
    cardRecord()
  ],meseArgomento('freccette'));
}

/* ---------- regole ---------- */
function vRegole(){
  var ora=h('select',{class:'inp',id:'rg-ora'},[0,1,2,3,4,5,6,7,8,9,10,11,12].map(function(n){return h('option',{value:String(n)},n===0?'a mezzanotte':'alle '+n+':00 del mattino');}));
  ora.value=String(S.cfg.voteCut);
  var self=h('input',{type:'checkbox',id:'rg-self',checked:S.cfg.selfVote});
  var vm=h('select',{class:'inp',id:'rg-vm'},h('option',{value:'p'},'Podio: 1°, 2° e 3° (3, 2 e 1 punto)'),[1,2,3,4,5].map(function(n){return h('option',{value:String(n)},n===1?'Una persona a testa':'Fino a '+n+' persone, 1 punto a testa');}));
  vm.value=podio()?'p':String(S.cfg.votiMax);
  var form=formPagina(function(){
    S.cfg.voteCut=+ora.value;S.cfg.selfVote=self.checked;
    if(vm.value==='p'){delete S.cfg.voto;S.cfg.votiMax=3;}else{S.cfg.voto='n';S.cfg.votiMax=+vm.value;}
    commit();toast('Regole del triage salvate.');},[
    campo('La serata si chiude',ora,'rg-ora'),
    campo('Come si vota',vm,'rg-vm'),
    h('label',{class:'spunta',for:'rg-self'},self,'Ci si può votare da soli'),
    h('button',{class:'pill duo-verde largo',type:'submit'},'Salva il triage')]);
  var giorni=[1,2,3,4,5,6].map(function(g){
    var sel=chipSel(FRAZ.map(function(f){return {v:f[0],label:f[1]};}),S.cfg.rifiuti[g],true);
    return {g:g,sel:sel,box:gruppo('Ritiro '+GIORNI[g].toLowerCase()+' mattina',sel)};
  });
  var butt=chipSel(FRAZ.map(function(f){return {v:f[0],label:f[1]};}),S.cfg.buttiamo||BUTTIAMO0,true);
  var formR=formPagina(function(){S.cfg.buttiamo=butt.get();giorni.forEach(function(x){S.cfg.rifiuti[x.g]=x.sel.get();});commit();toast('Calendario dei rifiuti salvato.');},[
    gruppo('Cosa buttate (gli avvisi arrivano solo per queste)',butt),
    giorni.map(function(x){return x.box;}),
    h('button',{class:'pill duo-verde largo',type:'submit'},'Salva il calendario')]);
  var pg=h('input',{class:'inp corto',id:'rg-pul',type:'text',inputmode:'numeric',autocomplete:'off',value:String(S.cfg.puliziaGiorni)});
  var formP=formPagina(function(){
      var n=leggiNumero(pg.value);
      if(n==null||isNaN(n)||n<1||n>90)return 'Scrivi un numero di giorni da 1 a 90.';
      S.cfg.puliziaGiorni=n;commit();toast('Ogni '+n+' giorni: salvato.');},[
    h('div',{class:'linea'},h('label',{class:'cresce1 nome',for:'rg-pul'},'Avviso dopo quanti giorni'),pg),
    h('button',{class:'pill duo-verde largo',type:'submit'},'Salva le pulizie')]);
  var gv=h('input',{class:'inp corto',id:'rg-gv',type:'text',inputmode:'numeric',autocomplete:'off',value:String(S.cfg.graffiGiorni)});
  var formG=formPagina(function(){
      var n=leggiNumero(gv.value);
      if(n==null||isNaN(n)||n<7||n>365)return 'Scrivi un numero di giorni da 7 a 365.';
      S.cfg.graffiGiorni=n;commit();toast('Graffi vecchi dopo '+n+' giorni: salvato.');},[
    h('div',{class:'linea'},h('label',{class:'cresce1 nome',for:'rg-gv'},'Un graffio è vecchio dopo quanti giorni'),gv),
    h('button',{class:'pill duo-verde largo',type:'submit'},'Salva il promemoria')]);
  var ta=h('textarea',{class:'inp',id:'rg-sint',rows:9});
  ta.value=S.cfg.sintomi.join('\n');
  var formS=formPagina(function(){
      var list=[];
      ta.value.split('\n').forEach(function(s){s=s.trim().slice(0,40);if(s&&list.indexOf(s)<0&&list.length<40)list.push(s);});
      S.cfg.sintomi=list;commit();toast(list.length+(list.length===1?' sintomo salvato.':' sintomi salvati.'));},[
    campo('Uno per riga',ta,'rg-sint'),
    h('button',{class:'pill duo-verde largo',type:'submit'},'Salva i sintomi')]);
  return [indietro(),h('h2',{class:'titolo'},'Regole del reparto'),
    h('section',{class:'cartella'},
      h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Triage e serate')),
      h('p',{class:'aiuto'},'La serata vale fino a quest’ora del mattino dopo: il voto si chiude lì, e anche classifiche e consumi contano per serata. I voti già dati restano nella serata in cui sono stati dati e valgono come sono stati dati, anche se cambiate il modo di votare.'),
      form),
    h('section',{class:'cartella'},
      h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Calendario dei rifiuti'),h('span',{class:'timbro'+(calPieno(S.cfg)?' ok':'')},calPieno(S.cfg)?'Compilato':'Da fare')),
      h('p',{class:'aiuto'},'Segnate cosa passa a ritirare ogni mattina, copiandolo dal calendario Teknoservice della vostra zona. L’app lo ricorda la sera prima: per le utenze domestiche si espone dalle 21:00 del giorno prima alle 5:00 del giorno di ritiro. Le raccolte ogni 15 giorni per ora non sono previste.'),
      formR),
    h('section',{class:'cartella'},
      h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Pulizie')),
      h('p',{class:'aiuto'},'Niente turni: quando dall’ultima pulizia segnata passano questi giorni, nel Reparto compare l’avviso.'),
      formP),
    h('section',{class:'cartella'},
      h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Promemoria graffi vecchi')),
      h('p',{class:'aiuto'},'I graffi aperti da più di questi giorni compaiono in rosso nel Reparto, nei Ticket e nella cartella di chi li ha.'),
      formG),
    h('section',{class:'cartella'},
      h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Sintomi dell’oblio')),
      h('p',{class:'aiuto'},'Nel triage, insieme al voto, si possono scegliere uno o più sintomi, se si vuole. La diagnosi del codice rosso sono i sintomi più votati per lui quella sera.'),
      formS)];
}

var VIEWS={reparto:vReparto,farmacia:vFarmacia,ludoteca:vLudoteca,altro:vAltro,classifiche:vClassifiche};
var SUBS={freccette:vFreccette,cassa:vCassa,soldi:vSoldi,classifiche:vClassifiche,scorte:vScorte,listino:vListino,persone:vPersone,regole:vRegole,backup:vBackup,installa:vInstalla,
  statistiche:function(){UI.cl='triage';return vClassifiche();},medaglie:function(){UI.cl='albo';return vClassifiche();},muro:vMuro,quota:vQuota,compleanni:vCompleanni,codici:vCodici};
var ADMIN_SUBS={listino:1,persone:1,regole:1,compleanni:1,codici:1};

/* ---------- avvio ---------- */
/* feedback (dalla 0.14.0): errori che tremano, +1 che vola, numeri che scorrono */
function movimentoRidotto(){try{return !!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);}catch(e){return false;}}
function scuoti(el){if(!el)return;el.classList.remove('scossa');void el.offsetWidth;el.classList.add('scossa');setTimeout(function(){el.classList.remove('scossa');},500);}
function volaPiu(b){
  if(!b||movimentoRidotto())return;
  var r=b.getBoundingClientRect(),o=document.createElement('span');
  o.className='piu-uno';o.textContent='+1';o.setAttribute('aria-hidden','true');
  o.style.left=(r.left+r.width/2)+'px';o.style.top=(r.top+8)+'px';
  document.body.appendChild(o);setTimeout(function(){o.remove();},800);
}
var CONTA={};
function contaNumeri(){
  var rid=movimentoRidotto();
  Array.prototype.forEach.call(document.querySelectorAll('[data-conta]'),function(el){
    var k=el.getAttribute('data-ck'),v=+el.getAttribute('data-conta'),eu=el.getAttribute('data-fmt')==='eur',old=CONTA[k];
    CONTA[k]=v;
    if(old==null||old===v||rid)return;
    var t0=Date.now();el.classList.add('conta');
    (function passo(){
      var f=Math.min(1,(Date.now()-t0)/500),x=Math.round(old+(v-old)*(1-Math.pow(1-f,3)));
      el.textContent=eu?eur(x):String(x);
      if(f<1&&el.isConnected)requestAnimationFrame(passo);
    })();
  });
}
/* feedback al tocco (dalla 0.13.0): un'onda dove tocchi, anche se la pagina si ridisegna subito dopo */
function onda(e){
  var b=e.target&&e.target.closest?e.target.closest('button,.voce,label.spunta,a,[role="button"]'):null;
  if(!b||b.disabled||e.button>0)return;
  var o=document.createElement('span');o.className='onda';o.setAttribute('aria-hidden','true');
  o.style.left=e.clientX+'px';o.style.top=e.clientY+'px';
  (foglio&&foglio.open&&foglio.contains(b)?foglio:document.body).appendChild(o);
  setTimeout(function(){o.remove();},500);
}
function start(){bigApri(avvia);}
function avvia(){
  foglio=$('#foglio');foglioT=$('#foglio-t');foglioB=$('#foglio-b');
  document.addEventListener('pointerdown',onda,{passive:true});
  document.addEventListener('touchstart',function(){},{passive:true});   // su iPhone fa funzionare :active
  $('#foglio-x').addEventListener('click',tentaChiudere);
  foglio.addEventListener('close',function(){if(foglio.open)return;liveSheet=null;guardia=null;});   // già riaperto (un foglio dopo l'altro): niente da pulire
  foglio.addEventListener('cancel',function(e){e.preventDefault();tentaChiudere();});   // tasto indietro / Esc
  foglio.addEventListener('click',function(e){if(e.target===foglio)tentaChiudere();});
  // l'app va in secondo piano (o il telefono la chiude): il modulo lasciato a metà diventa bozza, il conto in corso resta
  document.addEventListener('visibilitychange',function(){
    if(!document.hidden)return;
    if(sporco(guardia)&&!guardia.soloConferma)bozzaSalva(guardia.titolo,valoriForm(guardia.form));
    salvaConto();
  });
  window.addEventListener('pagehide',function(){if(sporco(guardia)&&!guardia.soloConferma)bozzaSalva(guardia.titolo,valoriForm(guardia.form));salvaConto();});
  devId();
  var st=loadState();
  if(!st){
    // dati illeggibili o spariti: li metto da parte e butto il registro, così si rilegge tutto dal locale condiviso
    var rotto=lsGet(KEY);if(rotto)lsSet(KEY+'.rotto',rotto);
    lsDel(KEY+'.sync');
  }
  S=st||seedState(Date.now());
  if(st&&lsGet(KEY+'.sync')){syncCarica();if(syncNuovaVersione(S,SY,APP_V))syncSalva();}
  var cambiato=applyImg0(S);
  if(applyCal0(S))cambiato=true;
  if(applySintomi0(S))cambiato=true;
  if(!SYNC&&applyElena(S))cambiato=true;   // con la sincronizzazione aspetta i dati veri del locale (ricevi)
  if(cambiato||!st)persist();
  D=derive(S);
  riprendiConto();
  var hs=(location.hash||'').replace('#','').split('/');
  if(hs[0]==='cassa'){UI.tab='reparto';UI.sub='cassa';}
  else if(hs[0]==='ticket'){UI.tab='farmacia';UI.farm='ticket';}                 // indirizzi della 0.10
  else if(hs[0]==='freccette'){UI.tab='ludoteca';UI.sub='freccette';}
  else if(VIEWS[hs[0]]){UI.tab=hs[0];if(hs[1]&&SUBS[hs[1]])UI.sub=hs[1];}
  window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();installEvt=e;if(UI.sub==='installa')render();});
  // a mezzanotte cambia il bollettino, all'ora di chiusura cambia la serata: ridisegno da solo
  var chiave=today()+'|'+openKey();
  function controlla(){var k=today()+'|'+openKey();if(k!==chiave){chiave=k;if(!foglio.open)render();}}
  document.addEventListener('visibilitychange',function(){if(document.hidden)return;controlla();if(segnaVisto()){persist();D=derive(S);syncSpingi();}});
  setInterval(controlla,60000);
  try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist();}catch(e){}
  render();
  syncAvvia();
  window.addEventListener('online',function(){statoSync();syncSpingi(true);});
  window.addEventListener('offline',statoSync);
  if(!IN_CLAUDE&&'serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){
    try{
      // quando arriva una versione nuova dell'app lo dico, senza ricaricare da solo a metà di un conto
      var giaGestita=!!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange',function(){
        if(!giaGestita){giaGestita=true;return;}
        toast('È arrivata una versione nuova dell’app.',function(){location.reload();},'Aggiorna');
      });
      navigator.serviceWorker.register('./sw.js');
    }catch(e){}
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
