(function(){
'use strict';

/* ===================== PURE ===================== */
var APP_V='0.6.0';
var MODI={'501':'501','301':'301','orologio':'Giro dell’orologio'};
var CFG0={voteCut:6,selfVote:true,puliziaGiorni:14};
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
function derive(S){
  var D={cash:0,debt:{},units:{},stock:{},sold:{},spent:{}};
  var q={},cred={};
  function add(p,a,u){
    if(!p||a<=0)return;
    D.debt[p]=(D.debt[p]||0)+a;
    var c=cred[p]||0;
    if(c>=a){cred[p]=c-a;return;}
    if(c>0){a-=c;cred[p]=0;}
    (q[p]=q[p]||[]).push({rem:a,u:u||1});
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
    }
  });
  Object.keys(q).forEach(function(p){var u=0;q[p].forEach(function(c){u+=c.u;});D.units[p]=u;});
  return D;
}

/* serata: vale fino all'ora di chiusura del mattino dopo (ora locale, anche nei cambi d'ora) */
function serata(t,cut){
  var d=new Date(t);
  if(d.getHours()<cut)d=new Date(d.getFullYear(),d.getMonth(),d.getDate()-1,12);
  return ymd(d);
}
function prevMonth(ym){var y=+ym.slice(0,4),m=+ym.slice(5,7)-1;if(m<1){m=12;y--;}return y+'-'+pad(m);}
function inPer(key,per,openKey){
  if(per==='sempre')return true;
  var ym=openKey.slice(0,7);
  if(per==='scorso')ym=prevMonth(ym);
  return String(key).slice(0,7)===ym;
}
/* voto palese: un voto per votante, vale l'ultimo; pari merito = più vincitori */
/* sintomi di un voto. Formato: «y» è il primo sintomo, come testo (così lo leggono anche i telefoni non aggiornati);
   «ys» è la lista completa, solo se i sintomi sono più di uno. La 0.5.0 per poco ha salvato «y» come lista. */
function sintomiVoto(v){return Array.isArray(v.ys)&&v.ys.length?v.ys:(Array.isArray(v.y)?v.y:(v.y?[v.y]:[]));}
function metiSintomi(v,ys){if(ys.length)v.y=ys[0];else delete v.y;if(ys.length>1)v.ys=ys.slice();else delete v.ys;}
function voteSummary(list){
  var last={},by={},tally={},sint={},max=0;
  list.forEach(function(v){last[v.v]=v;});
  Object.keys(last).forEach(function(k){
    var v=last[k],c=v.c;by[k]=c;tally[c]=(tally[c]||0)+1;if(tally[c]>max)max=tally[c];
    sintomiVoto(v).forEach(function(y){var s=sint[c]=sint[c]||{};s[y]=(s[y]||0)+1;});
  });
  return {by:by,tally:tally,sint:sint,max:max,n:Object.keys(by).length,winners:max?Object.keys(tally).filter(function(c){return tally[c]===max;}):[]};
}
/* i sintomi più votati (a pari merito tutti, al massimo «quanti») */
function topSintomi(conta,quanti){
  var ks=Object.keys(conta||{});if(!ks.length)return [];
  var max=Math.max.apply(null,ks.map(function(s){return conta[s];}));
  return ks.filter(function(s){return conta[s]===max;}).slice(0,quanti||3);
}
function topSintomo(conta){return topSintomi(conta,1)[0]||null;}
function sintomiDi(S,id){
  var conta={};
  S.votes.forEach(function(v){if(v.c===id)sintomiVoto(v).forEach(function(y){conta[y]=(conta[y]||0)+1;});});
  return conta;
}
/* soldi del locale. Attuale: cassa + scorte a prezzo di vendita. Previsionale, a parte: in più i graffi da incassare,
   meno i crediti da restituire. Le scorte valgono anche a costo d'acquisto, per i prodotti che ce l'hanno (dagli scontrini). */
function previsione(S,D){
  var o={cassa:D.cash,incassare:0,restituire:0,nInc:0,nRes:0,scorte:0,scorteCosto:0,margine:0,nCosto:0,righe:[],nonContati:0,negativi:0};
  Object.keys(D.debt).forEach(function(p){var d=D.debt[p];if(d>0){o.incassare+=d;o.nInc++;}else if(d<0){o.restituire-=d;o.nRes++;}});
  S.products.forEach(function(p){
    if(!(p.id in D.stock)){if(p.on)o.nonContati++;return;}
    if(toInt(D.stock[p.id])<0)o.negativi++;
    var q=Math.max(0,toInt(D.stock[p.id]));
    if(q<=0)return;
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
var SC_QTA=/^(?:N\.?\s*)?(\d{1,3})\s*(?:PZ\.?\s*)?[X×*\/]+[^0-9]{0,3}(\d{1,4})\s?[,.]\s?(\d{2})(?:\s+(\d{1,4})\s?[,.]\s?(\d{2}))?/;
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
    if(!out.data){var md=/(\d{1,2})[-\/.](\d{1,2})[-\/.](20\d{2}|\d{2})\b/.exec(l);if(md&&+md[1]>=1&&+md[1]<=31&&+md[2]>=1&&+md[2]<=12)out.data=(md[1].length<2?'0':'')+md[1]+'/'+(md[2].length<2?'0':'')+md[2]+'/'+(md[3].length===2?'20'+md[3]:md[3]);}
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
  S.votes.forEach(function(v){if(v.s<openKey)(g[v.s]=g[v.s]||[]).push(v);});
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
    sm.winners.forEach(function(w){(by[w]=by[w]||{rossi:0,voti:0}).rossi++;});
    Object.keys(sm.tally).forEach(function(c){(by[c]=by[c]||{rossi:0,voti:0}).voti+=sm.tally[c];});
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
    moves:[],shop:[],votes:[],games:[],trash:[],cleanings:[],
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
  cfg:['voteCut','selfVote','puliziaGiorni','rifiuti','sintomi','buttiamo'],
  people:['id','name','kind','on','img'],
  products:['id','name','cat','price','min','on','cost','al'],
  moves:['id','t','k','a','p','note','cat','items','paidBy','settle','shares','counted','expected','x'],
  votes:['id','s','v','c','t','y','ys']
};
function normCfg(c){
  c=c&&typeof c==='object'?c:{};
  var cut=c.voteCut==null||c.voteCut===''?CFG0.voteCut:toInt(c.voteCut);
  var pg=c.puliziaGiorni==null||c.puliziaGiorni===''?CFG0.puliziaGiorni:toInt(c.puliziaGiorni);
  var rif={},src=c.rifiuti&&typeof c.rifiuti==='object'?c.rifiuti:{};
  for(var g=0;g<7;g++){var a=Array.isArray(src[g])?src[g]:[];rif[g]=FRAZ_ID.filter(function(id){return a.indexOf(id)>=0;});}
  var sint=SINTOMI0.slice();
  if(Array.isArray(c.sintomi)){
    sint=[];
    c.sintomi.slice(0,40).forEach(function(s){s=str(s,40).trim();if(s&&sint.indexOf(s)<0)sint.push(s);});
  }
  var but=FRAZ_ID.filter(function(id){return (Array.isArray(c.buttiamo)?c.buttiamo:BUTTIAMO0).indexOf(id)>=0;});
  return tieniAltro(c,{voteCut:cut>=0&&cut<=12?cut:CFG0.voteCut,selfVote:c.selfVote!==false,
    puliziaGiorni:pg>=1&&pg<=90?pg:CFG0.puliziaGiorni,rifiuti:rif,sintomi:sint,buttiamo:but},NOTI.cfg);
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
function normIds(a){
  var out=[];(Array.isArray(a)?a:[]).slice(0,12).forEach(function(p){p=str(p,24);if(p&&out.indexOf(p)<0)out.push(p);});
  return out;
}
function normState(raw){
  if(!raw||typeof raw!=='object'||!Array.isArray(raw.people)||!Array.isArray(raw.moves)||!Array.isArray(raw.products))return null;
  var S={v:1,people:[],products:[],moves:[],shop:[],votes:[],games:[],trash:[],cleanings:[],cfg:normCfg(raw.cfg),meta:{}};
  raw.people.forEach(function(p){
    if(p&&typeof p.id==='string'&&p.id){
      var id=str(p.id,40);
      S.people.push(tieniAltro(p,{id:id,name:str(p.name,24).trim()||'Senza nome',kind:p.kind==='amico'?'amico':'paziente',on:p.on!==false,
        img:normImg(p.img)},NOTI.people));
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
    var ys=[];
    sintomiVoto(v).slice(0,12).forEach(function(x){x=str(x,40).trim();if(x&&ys.indexOf(x)<0)ys.push(x);});
    metiSintomi(o,ys);
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
  var me=raw.meta&&typeof raw.meta==='object'?raw.meta:{};
  S.meta={created:toInt(me.created),rev:toInt(me.rev),saved:toInt(me.saved),exported:toInt(me.exported),img0:str(me.img0,200),cal0:str(me.cal0,200),sint0:str(me.sint0,2000)};
  return S;
}
/* ---------- sincronizzazione tra telefoni (parte pura) ----------
   Ogni cosa segnata è un'«entità» con chiave «raccolta~id». SY.ent[chiave] = [u, impronta, confermata]:
   u = ora della modifica (vince la più recente), impronta = hash del JSON canonico ('-' = cancellata). */
var COLS=['people','products','moves','shop','votes','games','trash','cleanings'];
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
  var raw={people:[],products:[],moves:[],shop:[],votes:[],games:[],trash:[],cleanings:[]};
  raw[c]=[e];
  var st=normState(raw);
  return st&&st[c]&&st[c][0]||null;
}
function perT(a,b){return (a.t||0)-(b.t||0);}
/* app aggiornata: le copie già confermate che cambiano solo di forma (normalizzazione nuova) NON si rimandano,
   perché una copia impoverita da una versione vecchia cancellerebbe dati veri sugli altri telefoni.
   Si segnano «da rileggere» e si rilegge tutto il locale: per la stessa scrittura vince il server. */
function syncNuovaVersione(S,SY,ver){
  if(SY.ver===ver)return false;
  var h={};entita(S).forEach(function(x){h[x.k]=hashStr(canon(x.e));});
  Object.keys(SY.ent).forEach(function(k){
    var e=SY.ent[k];
    if(!e||!e[2]||!(k in h))return;   // in coda: si manda come sempre; tolta qui: lapide come sempre
    e[1]=h[k];e[3]='r';
  });
  SY.ver=ver;
  if(SY.init)SY.cursor=0;
  return true;
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
    S.moves.sort(perT);S.votes.sort(perT);S.games.sort(perT);S.cleanings.sort(perT);
    S.trash.sort(function(a,b){return a.s<b.s?-1:a.s>b.s?1:0;});
  }
  return changed;
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
  croce:'<path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5z"/>',
  bicchiere:'<path d="M6 3h12l-1.4 9.2a4.6 4.6 0 0 1-9.2 0L6 3z"/><path d="M12 16.8V21"/><path d="M8.5 21h7"/>',
  tacche:'<path d="M6 5v14M10 5v14M14 5v14M18 5v14M3 16.5L21 7.5"/>',
  cassa:'<rect x="3" y="7" width="18" height="11" rx="2"/><circle cx="12" cy="12.5" r="2.6"/>',
  altro:'<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
  bersaglio:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  avanti:'<path d="M9 6l6 6-6 6"/>',
  indietro:'<path d="M15 6l-6 6 6 6"/>',
  scontrino:'<path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z"/><path d="M9 8h6M9 12h6M9 16h3"/>'
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
var UI={tab:'reparto',sub:null,pos:{p:null,qty:{},extra:[]},filter:'tutto',limit:40,per:'mese',dart:{mode:'501',players:[],mol:1,vista:null}};
function lsGet(k){try{return localStorage.getItem(k);}catch(e){storageOk=false;return null;}}
function lsSet(k,v){try{localStorage.setItem(k,v);return true;}catch(e){storageOk=false;return false;}}
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
var SYNC=null,SY=null,remote=null,DEV='',syncTimer=0,inVolo={};
var SST={stato:'spento',errore:'',ultimo:0,attesa:0};   // spento · collego · ok · attesa · errore
var SDK='https://www.gstatic.com/firebasejs/10.12.2/';
function syncCarica(){
  try{SY=JSON.parse(lsGet(KEY+'.sync')||'null');}catch(e){SY=null;}
  if(!SY||typeof SY!=='object'||!SY.ent||typeof SY.ent!=='object')SY={cursor:0,init:false,ent:{},ver:APP_V};
  DEV=lsGet(KEY+'.dev');
  if(!DEV){DEV='d'+rid();lsSet(KEY+'.dev',DEV);}
}
function syncSalva(){lsSet(KEY+'.sync',JSON.stringify(SY));}
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
  // se qualcosa è rimasto in coda (rete caduta), riprovo ogni tanto
  setInterval(function(){
    if(!remote||!SY||!SY.init)return;
    for(var k in SY.ent)if(!SY.ent[k][2]&&!inVolo[k]){syncSpingi(true);return;}
  },10000);
  (SYNC.mock?remoteMock(SYNC):remoteFirestore(SYNC)).then(function(r){
    remote=r;
    r.subscribe(SY.init?SY.cursor:0,ricevi,function(e){SST.errore=errTesto(e);SST.stato=SY.init?'attesa':'errore';statoSync();});
  },function(e){SST.stato='errore';SST.errore='Non riesco a caricare la sincronizzazione ('+(e&&e.message||e)+'). Riprovo alla prossima apertura con internet.';statoSync();});
}
function ricevi(changes,fromCache){
  if(fromCache&&!SY.init)return;   // prima di fondere aspetto i dati veri del locale
  var init=!SY.init;
  var cambiato=syncApply(S,changes,SY,init);
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
}
function syncTesto(){
  switch(SST.stato){
    case 'ok':return 'sincronizzati';
    case 'attesa':return SST.attesa+(SST.attesa===1?' modifica da inviare':' modifiche da inviare')+(navigator.onLine===false?' (senza rete)':'');
    case 'collego':return 'mi collego al locale…';
    case 'errore':return 'non collegati';
    default:return '';
  }
}
function paintSync(){
  var el=$('#sync');if(!el)return;
  var on=!!SYNC&&SST.stato!=='spento';
  el.hidden=!on;
  if(!on)return;
  el.className='sync-dot '+SST.stato;
  el.setAttribute('aria-label','Telefoni: '+syncTesto());
  el.title='Telefoni: '+syncTesto()+(SST.errore?' · '+SST.errore:'');
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
function pName(id){var p=person(id);return p?p.name:'Ex paziente';}
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
function riduciFoto(f,cb){
  var url,im=new Image();
  try{url=URL.createObjectURL(f);}catch(e){cb(null);return;}
  im.onload=function(){
    try{
      var w=im.naturalWidth,hh=im.naturalHeight,s=Math.min(w,hh),c=document.createElement('canvas');
      c.width=c.height=256;
      c.getContext('2d').drawImage(im,(w-s)/2,(hh-s)*0.3,s,s,0,0,256,256);
      URL.revokeObjectURL(url);cb(c.toDataURL('image/jpeg',0.82));
    }catch(e){URL.revokeObjectURL(url);cb(null);}
  };
  im.onerror=function(){URL.revokeObjectURL(url);cb(null);};
  im.src=url;
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
function addMove(o,say){
  var mv=Object.assign({id:rid(),t:Date.now()},o);
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

/* ---------- toast e fogli ---------- */
function toast(msg,undo,label){
  var box=$('#toast');clearTimeout(toastTimer);
  var d=h('div',null,h('span',null,msg));
  if(undo)d.append(h('button',{type:'button',onclick:function(){box.replaceChildren();undo();}},label||'Annulla'));
  box.replaceChildren(d);
  toastTimer=setTimeout(function(){box.replaceChildren();},label?20000:undo?7000:3200);
}
var foglio,foglioT,foglioB;
function openSheet(title,body,live){
  foglioT.textContent=title;foglioB.replaceChildren(frag(body));liveSheet=live||null;
  if(!foglio.open){try{foglio.showModal();}catch(e){foglio.setAttribute('open','');}}
  foglioB.scrollTop=0;
}
function closeSheet(){liveSheet=null;if(foglio.open){try{foglio.close();}catch(e){foglio.removeAttribute('open');}}}
function refreshSheet(){
  if(liveSheet&&foglio.open){var st=foglioB.scrollTop;foglioB.replaceChildren(frag(liveSheet()));foglioB.scrollTop=st;}
}
function formSheet(title,fields,onSave,label){
  var err=h('p',{class:'errore',role:'alert',hidden:true});
  var form=h('form',{class:'modulo',novalidate:true},fields,err,h('button',{class:'pill duo-verde largo',type:'submit'},label||'Salva'));
  form.addEventListener('submit',function(ev){
    ev.preventDefault();var r;
    try{r=onSave();}catch(e){r='Qualcosa non va: '+(e&&e.message?e.message:e);}
    if(typeof r==='string'){err.textContent=r;err.hidden=false;return;}
    closeSheet();
  });
  openSheet(title,form);
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
  return people(extraAll).map(function(p){return {v:p.id,label:p.name,cls:p.kind==='amico'?'amico':''};});
}

/* ---------- navigazione ---------- */
var TABS=[['reparto','Reparto','croce'],['farmacia','Farmacia','bicchiere'],['ticket','Ticket','tacche'],['freccette','Freccette','bersaglio'],['altro','Altro','altro']];
var NOMI_TAB={reparto:'Reparto',farmacia:'Farmacia',ticket:'Ticket',freccette:'Freccette',altro:'Altro'};
function go(tab,sub){
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
  $('#nav').replaceChildren(frag(TABS.map(function(t){
    return h('button',{type:'button',class:'tab','aria-current':UI.tab===t[0]?'page':null,onclick:function(){go(t[0]);}},ic(t[2]),h('span',null,t[1]));
  })));
  var av=$('#avviso'),msg='';
  if(!storageOk)msg='Questo dispositivo non sta salvando i dati: quello che segni resta solo finché la pagina è aperta.';
  else if(IN_CLAUDE)msg='Anteprima dentro Claude: i dati restano su questo dispositivo e possono azzerarsi. L’app vera si installa dal suo indirizzo web.';
  else if(IOS&&!installata())msg='Su iPhone installa l’app prima di usarla: Condividi, poi «Aggiungi alla schermata Home»'+(SYNC?', e da lì usa sempre l’icona.':'. Quello che segni qui in Safari non passa all’app installata.');
  av.textContent=msg;av.hidden=!msg;
  var posOn=UI.tab==='farmacia'&&!UI.sub&&(UI.pos.p||posTotal().n>0);
  document.body.classList.toggle('con-pos',!!posOn);
  document.body.classList.toggle('in-gioco',UI.tab==='freccette'&&!UI.sub);
  var vista=UI.sub&&SUBS[UI.sub]?SUBS[UI.sub]:VIEWS[UI.tab];
  $('#view').replaceChildren(frag(vista()));
  if(key){var el=document.querySelector('[data-k="'+key+'"]');if(el){try{el.focus({preventScroll:true});}catch(e){}}}
  refreshSheet();
  paintSync();
}

/* ---------- righe e descrizioni ---------- */
function itemsText(mv){return (mv.items||[]).map(function(it){return (it.q>1?it.q+'× ':'')+it.n;}).join(', ');}
function moveInfo(mv){
  var a=mv.k==='count'?toInt(mv.a):Math.max(0,toInt(mv.a)),who=mv.p?pName(mv.p):'';
  switch(mv.k){
    case 'sale':return {t:'Pagato subito · '+who,s:itemsText(mv),cash:a,tag:'cassa'};
    case 'tab':return {t:'Sul ticket · '+who,s:itemsText(mv),debt:a,tag:'ticket'};
    case 'dplus':return {t:'Debito aggiunto · '+who,s:mv.note||'',debt:a,tag:'ticket'};
    case 'dminus':return {t:'Debito tolto · '+who,s:mv.note||'',debt:-a,tag:'ticket'};
    case 'pay':return {t:'Ticket incassato · '+who,s:mv.note||'',cash:a,tag:'cassa'};
    case 'in':return {t:'Entrata',s:mv.note||'',cash:a,tag:'cassa'};
    case 'exp':
      var by=mv.paidBy&&mv.paidBy!=='cassa'?pName(mv.paidBy):'',how,daCassa=!by||mv.settle==='cassa';
      if(!by)how='pagata dalla cassa';
      else if(mv.settle==='cassa')how='anticipata da '+by+', rimborsata dalla cassa';
      else if(mv.settle==='dividi')how='anticipata da '+by+', divisa tra '+Object.keys(mv.shares||{}).length;
      else how='anticipata da '+by+', scalata dal suo ticket';
      return {t:'Spesa'+(mv.cat?' · '+mv.cat:''),s:[mv.note,how].filter(Boolean).join(' · '),cash:daCassa?-a:null,fuori:daCassa?null:a,tag:daCassa?'cassa':'ticket'};
    case 'count':return {t:'Conta cassa',s:'contati '+eur(mv.counted)+', attesi '+eur(mv.expected),cash:a,tag:'cassa'};
    case 'load':return {t:'Carico scorte',s:itemsText(mv),tag:'scorte'};
    case 'inv':return {t:'Inventario',s:(mv.items||[]).length+' prodotti contati',tag:'scorte'};
    default:return {t:'Movimento',s:'',tag:''};
  }
}
function amountNode(inf){
  if(inf.cash!=null)return h('span',{class:'importo '+(inf.cash>0?'verde':inf.cash<0?'rosso':'spento')},eurS(inf.cash),h('small',null,'cassa'));
  if(inf.debt!=null)return h('span',{class:'importo '+(inf.debt>0?'rosso':'verde')},eurS(inf.debt),h('small',null,'ticket'));
  if(inf.fuori!=null)return h('span',{class:'importo spento'},eur(inf.fuori),h('small',null,'anticipo'));
  return h('span',{class:'importo spento'},h('small',null,inf.tag||''));
}
function moveRow(mv,withDay){
  var inf=moveInfo(mv);
  return h('li',null,h('button',{type:'button',class:'riga'+(mv.x?' annullato':''),onclick:function(){openMove(mv.id);}},
    h('span',{class:'ora'},withDay?GIORNI3[new Date(mv.t).getDay()]+' '+hm(mv.t):hm(mv.t)),
    h('span',{class:'cresce'},h('span',{class:'nome'},inf.t,mv.x?h('span',{class:'tag'},'annullato'):null),inf.s?h('span',{class:'sotto'},inf.s):null),
    amountNode(inf)));
}
function personRow(p){
  var d=D.debt[p.id]||0,u=D.units[p.id]||0;
  return h('li',null,h('button',{type:'button',class:'riga',onclick:function(){openCartella(p.id);}},
    ava(p.id),
    h('span',{class:'cresce'},
      h('span',{class:'nome'},p.name,p.kind==='amico'?h('span',{class:'tag'},'visitatore'):null,p.on?null:h('span',{class:'tag'},'dimesso')),
      d>0?tally(u):null),
    h('span',{class:'importo '+(d>0?'rosso':d<0?'verde':'spento')},d<0?'credito '+eur(-d):eur(d))));
}
function rigaB(dt,dd,cls){return h('div',null,h('dt',null,dt),h('dd',{class:cls||null},dd));}

/* ---------- vista: Reparto ---------- */
function vReparto(){
  var now=new Date(),out=[];
  var deb=people(true).filter(function(p){return (D.debt[p.id]||0)>0;}).sort(function(a,b){return D.debt[b.id]-D.debt[a.id];});
  var tot=deb.reduce(function(s,p){return s+D.debt[p.id];},0);
  var low=lowStock(),contati=S.products.some(function(p){return p.id in D.stock;});
  var fac=statoFaccende();
  var urgente=low.length>0||backupOld()||D.cash<0||fac.daFare;
  var scorte=!contati?'non ancora contate':low.length?low.length+(low.length===1?' prodotto da ricomprare':' prodotti da ricomprare'):'a posto';
  out.push(h('section',{class:'cartella'},
    h('div',{class:'cart-h'},h('h2',{class:'etichetta'},'Bollettino di '+GIORNI[now.getDay()].toLowerCase()+' '+now.getDate()+'/'+(now.getMonth()+1)),
      h('span',{class:'timbro'+(urgente?'':' ok')},urgente?'Urgente':'Stabile')),
    h('div',{class:'riga-tratt'}),
    h('dl',{class:'bollettino'},
      rigaB('Cassa farmacia',eur(D.cash),D.cash<0?'rosso':null),
      rigaB('Ticket aperti',tot?eur(tot)+' · '+deb.length+(deb.length===1?' paziente':' pazienti'):'nessuno',tot?'rosso':null),
      rigaB('Soldi del locale',h('button',{type:'button',class:'link','data-k':'apri-soldi',onclick:function(){go('reparto','soldi');}},eur(previsione(S,D).attuale))),
      rigaB('Scorte',scorte,low.length?'rosso':null),
      partitaAttiva()?rigaB('Freccette','partita in corso: '+nomeModo(partitaAttiva().mode)):null,
      SYNC&&SST.stato!=='spento'?rigaB('Telefoni',h('span',{id:'sync-riga'},syncTesto()),SST.stato==='errore'?'rosso':null):null,
      rigaB('Backup',backupLine(),backupOld()?'rosso':null)),
    h('div',{class:'azioni'},
      h('button',{class:'pill duo-rosa',type:'button',onclick:function(){go('farmacia');}},'Segna consumazione'),
      h('button',{class:'pill','data-k':'apri-cassa',type:'button',onclick:function(){go('reparto','cassa');}},'Cassa'))));
  out.push(cardFaccende(fac));
  out.push(cardTriage());
  out.push(h('section',{class:'cartella'},
    h('div',{class:'cart-h'},h('h2',{class:'etichetta'},'Ticket più salati'),h('button',{class:'pill sm',type:'button',onclick:function(){go('ticket');}},'Tutti i ticket')),
    h('div',{class:'riga-tratt'}),
    deb.length?h('ul',{class:'righe'},deb.slice(0,3).map(personRow)):h('p',{class:'vuoto'},'Nessun ticket aperto. Reparto tranquillo, per ora.')));
  var ult=S.moves.filter(function(m){return !m.x;}).slice(-5).reverse();
  out.push(h('section',{class:'cartella'},
    h('div',{class:'cart-h'},h('h2',{class:'etichetta'},'Ultime somministrazioni'),h('button',{class:'pill sm',type:'button',onclick:function(){go('reparto','cassa');}},'Registro')),
    h('div',{class:'riga-tratt'}),
    ult.length?h('ul',{class:'righe'},ult.map(function(m){return moveRow(m,true);})):h('p',{class:'vuoto'},'Ancora niente. La prima consumazione si segna dalla Farmacia.')));
  return out;
}

/* ---------- faccende: rifiuti e pulizie ---------- */
function nomiFraz(ids){return ids.map(function(id){var f=FRAZ.find(function(x){return x[0]===id;});return f?f[1]:id;}).join(' · ');}
function statoFaccende(){
  var k=openKey(),cal=calPieno(S.cfg),fr=cal?rifiutiSerata(S.cfg,k):[];
  var fatto=S.trash.find(function(r){return r.s===k;})||null;
  var pul=pulizieStato(S,Date.now(),S.cfg.puliziaGiorni);
  return {k:k,cal:cal,fr:fr,fatto:fatto,pul:pul,daFare:(fr.length>0&&!fatto)||pul.scadute};
}
function cardFaccende(st){
  var rif,pul;
  if(!st.cal){
    rif=h('div',{class:'faccenda'},
      h('span',{class:'cresce'},h('span',{class:'nome'},'Rifiuti'),h('span',{class:'sotto'},'Calendario da compilare: segnate i giorni di ritiro e l’app li ricorda la sera prima.')),
      h('button',{class:'pill sm',type:'button',onclick:function(){go('reparto','regole');}},'Compila'));
  }else if(st.fr.length){
    var f=st.fatto;
    rif=h('div',{class:'faccenda'+(f?'':' accesa')},
      h('span',{class:'cresce'},h('span',{class:'nome'},'Stasera fuori: '+nomiFraz(st.fr)),
        h('span',{class:'sotto'},f?'Portati giù da '+nomiLista(f.p)+' alle '+hm(f.t)+'.':'Dalle 21:00, ritiro domattina entro le 5:00.')),
      f?h('button',{class:'pill sm',type:'button',onclick:function(){S.trash=S.trash.filter(function(r){return r!==f;});commit();toast('Segnati di nuovo come da fare.');}},'Annulla')
       :h('button',{class:'pill sm duo-verde','data-k':'rif-fatto',type:'button',onclick:openRifiuti},'Portati giù'));
  }else{
    var nx=prossimiRifiuti(S.cfg,st.k);
    rif=h('div',{class:'faccenda'},
      h('span',{class:'cresce'},h('span',{class:'nome'},'Stasera niente rifiuti'),
        nx?h('span',{class:'sotto'},'Prossima uscita '+serataFutura(nx.k)+': '+nomiFraz(nx.f)+'.'):null));
  }
  var p=st.pul,giorni=S.cfg.puliziaGiorni;
  pul=h('div',{class:'faccenda'+(p.scadute?' accesa':'')},
    h('span',{class:'cresce'},
      h('span',{class:'nome'},p.mai?'Pulizie: mai segnate':p.scadute?'Pulizie scadute':'Pulizie a posto'),
      h('span',{class:'sotto'},p.mai?'Segnate l’ultima pulizia: dopo '+giorni+' giorni arriva l’avviso.'
        :'Ultima '+(p.giorni===0?'oggi':p.giorni===1?'ieri':p.giorni+' giorni fa')+(p.scadute?': si pulisce ogni '+giorni+' giorni.':'; la prossima tra '+p.mancano+(p.mancano===1?' giorno.':' giorni.')))),
    h('button',{class:'pill sm'+(p.scadute||p.mai?' duo-verde':''),'data-k':'pul-fatta',type:'button',onclick:openPulizia},'Pulizia fatta'));
  return h('section',{class:'cartella'},
    h('div',{class:'cart-h'},h('h2',{class:'etichetta'},'Faccende'),h('span',{class:'timbro'+(st.daFare?'':' ok')},st.daFare?'Da fare':'A posto')),
    h('div',{class:'riga-tratt'}),rif,h('div',{class:'riga-tratt'}),pul);
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
function nomiLista(ids){
  var n=ids.map(pName);
  return n.length<2?n.join(''):n.slice(0,-1).join(', ')+' e '+n[n.length-1];
}
function vota(chi,per,ys){
  ys=(ys||[]).slice();
  var k=openKey(),v=S.votes.find(function(x){return x.s===k&&x.v===chi;}),prima=v?{c:v.c,t:v.t,y:sintomiVoto(v).slice()}:null;
  if(prima&&prima.c===per&&prima.y.slice().sort().join('|')===ys.slice().sort().join('|')){toast(pName(chi)+' aveva già votato così.');return;}
  if(v){v.c=per;v.t=Date.now();metiSintomi(v,ys);}
  else{v={id:'v'+k+'_'+chi,s:k,v:chi,c:per,t:Date.now()};metiSintomi(v,ys);S.votes.push(v);}   // stesso voto = stesso documento su tutti i telefoni
  commit();
  toast(pName(chi)+(prima?' cambia voto: ':' vota ')+pName(per)+(ys.length?' · '+ys.join(', ').toLowerCase():''),function(){
    if(prima){v.c=prima.c;v.t=prima.t;metiSintomi(v,prima.y);}
    else{var i=S.votes.indexOf(v);if(i>=0)S.votes.splice(i,1);}
    commit();toast('Voto annullato.');
  });
}
function ultimoVerdetto(){
  var ch=serateChiuse(S,openKey()),ks=Object.keys(ch).sort();
  for(var i=ks.length-1;i>=0;i--)if(ch[ks[i]].n)return {k:ks[i],sm:ch[ks[i]]};
  return null;
}
function reDelMese(){
  var k=openKey(),r=statRe(S,'mese',k),max=0,ids=[];
  Object.keys(r.by).forEach(function(id){var n=r.by[id].rossi;if(n>max){max=n;ids=[id];}else if(n&&n===max)ids.push(id);});
  return max?{ids:ids,n:max,mese:MESI[+k.slice(5,7)-1]}:null;
}
function cardTriage(){
  var k=openKey(),sm=voteSummary(votiSerata(k)),cand=people();
  var grid=h('div',{class:'tri-grid'},cand.map(function(p){
    var n=sm.tally[p.id]||0,testa=n>0&&n===sm.max;
    return h('button',{type:'button',class:'tri'+(p.kind==='amico'?' amico':'')+(testa?' testa':''),'data-k':'tri-'+p.id,
      'aria-label':'Vota '+p.name+(n?', '+n+(n===1?' voto':' voti'):''),onclick:function(){openVoto(p.id);}},
      ava(p.id,'tri-ava'),h('span',{class:'tri-n'},p.name),h('span',{class:'tri-v'},n?n+(n===1?' voto':' voti'):'—'));
  }),h('button',{type:'button',class:'tri piu',onclick:function(){openPerson(null);}},h('span',{class:'tri-n'},'+ Visitatore')));
  var testa=null;
  if(sm.n)testa=sm.winners.length>1?'Pari: '+nomiLista(sm.winners)+' con '+sm.max+(sm.max===1?' voto':' voti')+'.':'In testa '+pName(sm.winners[0])+' con '+sm.max+(sm.max===1?' voto':' voti')+'.';
  var lista=Object.keys(sm.by).map(function(v){return pName(v)+' → '+pName(sm.by[v]);}).join(' · ');
  var ver=ultimoVerdetto(),re=reDelMese();
  var diag=ver&&ver.sm.winners.length===1?topSintomi(ver.sm.sint[ver.sm.winners[0]],3):[];
  return h('section',{class:'triage'},
    h('div',{class:'cart-h'},h('h2',{class:'tri-t'},'Triage: chi sta peggio?'),h('span',{class:'timbro scuro'},sm.n+(sm.n===1?' voto':' voti'))),
    h('p',{class:'tri-s'},'Voto palese della serata, visitatori compresi. Tocca chi sta peggio, poi chi vota. Si chiude '+chiusuraTxt()+'.'),
    grid,
    testa?h('p',{class:'tri-s forte'},testa):null,
    lista?h('p',{class:'tri-s'},'Voti: '+lista):null,
    ver?h('div',{class:'verdetto'},ver.sm.winners.length===1?ava(ver.sm.winners[0],'sm'):null,
      h('p',null,h('b',null,'Codice rosso '+(nomeSerata(ver.k)==='ieri sera'?'di ieri sera':'della '+nomeSerata(ver.k))+': '),
        nomiLista(ver.sm.winners)+' ('+ver.sm.max+(ver.sm.max===1?' voto':' voti')+' su '+ver.sm.n+')',
        diag.length?[h('br'),'Diagnosi: '+diag.map(function(x){return x.toLowerCase();}).join(', ')+'.']:null)):null,
    re?h('p',{class:'tri-s'},(re.ids.length>1?'Re dell’oblio di '+re.mese+' a pari merito: ':'Re dell’oblio di '+re.mese+': ')+nomiLista(re.ids)+', '+re.n+(re.n===1?' codice rosso.':' codici rossi.')):null,
    h('div',{class:'azioni'},
      h('button',{class:'pill sm',type:'button',disabled:!sm.n,onclick:openVoti},'Vedi i voti'),
      h('button',{class:'pill sm',type:'button',onclick:function(){go('reparto','classifiche');}},'Classifiche')));
}
function openVoto(per){
  var syv=[];
  var live=function(){
    var sm=voteSummary(votiSerata(openKey()));
    var sy=S.cfg.sintomi.length?chipSel(S.cfg.sintomi.map(function(s){return {v:s,label:s,cls:'sm'};}),syv,true):null;
    if(sy)sy.addEventListener('change',function(){syv=sy.get();});
    var chips=h('div',{class:'chips'},people().map(function(p){
      var gia=sm.by[p.id],bloccato=p.id===per&&!S.cfg.selfVote;
      return h('button',{type:'button',class:'chip con-ava'+(p.kind==='amico'?' amico':''),'data-k':'vt-'+p.id,'aria-pressed':String(gia===per),disabled:bloccato,
        onclick:function(){closeSheet();vota(p.id,per,syv);}},
        ava(p.id,'xs'),p.name,gia&&gia!==per?h('small',{class:'chip-s'},'ha votato '+pName(gia)):null);
    }));
    return [
      h('div',{class:'voto-chi'},ava(per,'grande'),h('p',{class:'aiuto'},(sy?'Se vuoi scegli uno o più sintomi, poi tocca chi vota. ':'Tocca chi vota. ')+'Chi ha già votato stasera cambia il suo voto.'+(S.cfg.selfVote?' Ci si può votare da soli.':''))),
      sy?gruppo('Sintomi (facoltativi, anche più di uno)',sy):null,
      gruppo('Chi vota?',chips),
      h('div',{class:'azioni'},h('button',{type:'button',class:'chip piu',onclick:function(){openPerson(null,function(){setTimeout(function(){openVoto(per);},60);});}},'+ Visitatore che vota'))];
  };
  openSheet('Voto per '+pName(per),live(),live);
}
function openVoti(){
  var live=function(){
    var k=openKey(),list=votiSerata(k),sm=voteSummary(list);
    if(!sm.n)return [h('p',{class:'vuoto'},'Nessun voto stasera.')];
    var ord=Object.keys(sm.tally).sort(function(a,b){return sm.tally[b]-sm.tally[a]||pName(a).localeCompare(pName(b));});
    return [
      h('p',{class:'aiuto'},'Voto palese. Si chiude '+chiusuraTxt()+': fino ad allora ogni voto si può cambiare o togliere.'),
      h('div',{class:'barre'},ord.map(function(c){
        var n=sm.tally[c];
        return h('div',{class:'barra'},ava(c,'xs'),h('span',{class:'barra-n'},pName(c)),
          h('span',{class:'barra-b'},h('i',{style:'width:'+Math.round(n/sm.max*100)+'%'})),h('span',{class:'barra-v'},String(n)));
      })),
      h('div',{class:'riga-tratt'}),
      h('span',{class:'etichetta'},'Chi ha votato chi'),
      h('ul',{class:'righe'},list.map(function(v){
        return h('li',null,h('div',{class:'riga'},
          h('span',{class:'ora'},hm(v.t)),
          h('span',{class:'cresce'},h('span',{class:'nome'},pName(v.v)+' → '+pName(v.c)),sintomiVoto(v).length?h('span',{class:'sotto'},sintomiVoto(v).join(', ')):null),
          h('button',{type:'button',class:'pill sm',onclick:function(){var i=S.votes.indexOf(v);if(i>=0){S.votes.splice(i,1);commit();toast('Voto di '+pName(v.v)+' tolto.');}}},'Togli')));
      }))];
  };
  openSheet('Voti di stasera',live(),live);
}

/* ---------- vista: Farmacia ---------- */
function prodTile(p){
  var n=UI.pos.qty[p.id]||0,st=D.stock[p.id];
  return h('div',{class:'prod'+(n?' on':'')},
    h('button',{type:'button',class:'prod-add','data-k':'add-'+p.id,onclick:function(){UI.pos.qty[p.id]=n+1;render();}},
      h('span',{class:'prod-n'},p.name),h('span',{class:'prod-p'},eur(p.price)),
      st!=null?h('span',{class:'prod-s'+(st<=0?' zero':'')},st<=0?'finito':st+' pz'):null),
    n?h('button',{type:'button',class:'prod-less','data-k':'less-'+p.id,'aria-label':'Togli uno: '+p.name,onclick:function(){if(n<=1)delete UI.pos.qty[p.id];else UI.pos.qty[p.id]=n-1;render();}},'−'):null,
    n?h('span',{class:'prod-q'},String(n)):null);
}
function posClear(){UI.pos={p:null,qty:{},extra:[]};render();}
function posSave(kind,dato){
  var pos=UI.pos,items=[],a=0;
  S.products.forEach(function(p){var q=pos.qty[p.id]||0;if(q){items.push({id:p.id,n:p.name,q:q,pr:p.price});a+=q*p.price;}});
  pos.extra.forEach(function(x){items.push({n:x.n,q:1,pr:x.pr});a+=x.pr;});
  if(!pos.p||!items.length)return;
  var who=pName(pos.p),chi=pos.p;
  UI.pos={p:null,qty:{},extra:[]};
  if(kind==='sale'&&dato>a){
    // ha dato più del conto: la differenza è un incasso sul suo ticket (scala i graffi; oltre, credito)
    var deb=Math.max(0,D.debt[chi]||0),ex=dato-a,t=Date.now();
    var m1={id:rid(),t:t,k:'sale',p:chi,items:items,a:a},m2={id:rid(),t:t+1,k:'pay',p:chi,a:ex,note:'Dato in più pagando una consumazione'};
    S.moves.push(m1,m2);commit();
    toast(who+' ha dato '+eur(dato)+': '+eur(a)+' la consumazione, '+(ex<=deb?eur(ex)+' scalati dai graffi':(deb?eur(deb)+' chiudono i graffi e '+eur(ex-deb)+' in credito':eur(ex)+' in credito')),function(){
      S.moves=S.moves.filter(function(m){return m!==m1&&m!==m2;});commit();toast('Annullato.');
    });
    return;
  }
  addMove({k:kind,p:chi,items:items,a:a},kind==='tab'?'Sul ticket di '+who+': '+eur(a):who+' ha pagato in cassa: '+eur(a));
}
function openHaDato(){
  var pos=UI.pos,t=posTotal();if(!pos.p||!t.n)return;
  var chi=pos.p,deb=Math.max(0,D.debt[chi]||0),cred=Math.max(0,-(D.debt[chi]||0));
  var a=soldi('hd-a'),info=h('p',{class:'aiuto','aria-live':'polite'});
  function upd(){
    var v=parseEur(a.value);
    if(isNaN(v)){info.textContent='Scrivi quanto ha dato.';return;}
    if(v<t.a){info.textContent='È meno del conto ('+eur(t.a)+'): per lasciare il resto sul ticket usa «Sul ticket».';return;}
    var ex=v-t.a;
    if(!ex)info.textContent='Paga giusto: '+eur(t.a)+'.';
    else if(ex<=deb)info.textContent=eur(t.a)+' per questa consumazione, '+eur(ex)+' scalano i graffi: '+(ex<deb?'ne restano '+eur(deb-ex)+'.':'chiusi tutti.');
    else info.textContent=eur(t.a)+' per questa consumazione'+(deb?', '+eur(deb)+' chiudono i graffi':'')+' e '+eur(ex-deb)+' vanno in credito.';
  }
  function metti(v){a.value=c2s(v);upd();}
  a.addEventListener('input',upd);
  var tagli=[];
  if(deb)tagli.push(h('button',{type:'button',class:'chip sm',onclick:function(){metti(t.a+deb);}},'Conto + graffi: '+eur(t.a+deb)));
  [500,1000,2000,5000].forEach(function(v){if(v>t.a)tagli.push(h('button',{type:'button',class:'chip sm',onclick:function(){metti(v);}},eur(v)));});
  formSheet('Paga '+pName(chi),[
    h('dl',{class:'scheda'},h('dt',null,'Conto di adesso'),h('dd',null,eur(t.a)),h('dt',null,'Graffi aperti'),h('dd',{class:deb?'rosso':null},deb?eur(deb):(cred?'nessuno, è in credito di '+eur(cred):'nessuno'))),
    campo('Quanto ha dato',a,'hd-a'),h('div',{class:'chips'},tagli),info,
    h('p',{class:'aiuto'},'Quello che dà in più scala i suoi graffi, dai più vecchi; se li supera, resta in credito per le prossime volte.')],function(){
    var v=parseEur(a.value);
    if(isNaN(v)||v<t.a)return 'Scrivi almeno '+eur(t.a)+'.';
    posSave('sale',v);
  },'Registra il pagamento');
  upd();
}
function vFarmacia(){
  var pos=UI.pos,out=[h('h2',{class:'titolo'},'Farmacia')];
  var chips=h('div',{class:'chips',role:'group','aria-label':'Paziente'});
  people().forEach(function(p){
    chips.append(h('button',{type:'button',class:'chip con-ava'+(p.kind==='amico'?' amico':''),'data-k':'chi-'+p.id,'aria-pressed':String(pos.p===p.id),onclick:function(){pos.p=pos.p===p.id?null:p.id;render();}},ava(p.id,'xs'),p.name));
  });
  chips.append(h('button',{type:'button',class:'chip piu',onclick:function(){openPerson(null,function(id){UI.pos.p=id;});}},'+ Visitatore'));
  out.push(h('section',{class:'blocco'},h('h3',{class:'etichetta chiara'},'Chi è il paziente?'),chips));
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
        h('span',{class:'pos-dx'},h('strong',null,t.n?eur(t.a)+' · '+t.n+(t.n===1?' pezzo':' pezzi'):'Scegli cosa prende'),
          ok?h('button',{type:'button',class:'link chiaro','data-k':'ha-dato',onclick:openHaDato},'Ha dato di più?'):null)),
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
function vTicket(){
  var list=people(true).filter(function(p){return p.on||(D.debt[p.id]||0)!==0;});
  list.sort(function(a,b){return (D.debt[b.id]||0)-(D.debt[a.id]||0);});
  var tot=list.reduce(function(s,p){return s+Math.max(0,D.debt[p.id]||0);},0);
  return [h('h2',{class:'titolo'},'Ticket'),
    h('section',{class:'cartella'},
      h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Ticket non pagati'),h('strong',{class:'importo '+(tot?'rosso':'spento')},eur(tot))),
      h('div',{class:'riga-tratt'}),
      h('ul',{class:'righe'},list.map(personRow)),
      h('p',{class:'aiuto'},'Una tacca per ogni consumazione non ancora pagata. Tocca un nome per incassare, aggiungere o togliere un debito.'),
      h('div',{class:'azioni'},h('button',{class:'pill',type:'button',onclick:function(){openPerson(null);}},'+ Visitatore')))];
}
function openCartella(id){
  var live=function(){
    var p=S.people.find(function(x){return x.id===id;});
    if(!p)return [h('p',{class:'vuoto'},'Paziente non trovato.')];
    var d=D.debt[id]||0,u=D.units[id]||0,k=openKey();
    var hist=S.moves.filter(function(m){return m.p===id||m.paidBy===id||(m.shares&&(id in m.shares));}).slice(-30).reverse();
    var re=statRe(S,'sempre',k).by[id],fr=statFreccette(S,'sempre',k,S.cfg.voteCut)[id],co=statConsumi(S,'mese',k,S.cfg.voteCut)[id];
    var foto=imgSrc(p,true);
    return [
      h('div',{class:'cart-top'},
        foto?h('figure',{class:'segnaletica'},h('img',{src:foto,alt:'Caricatura di '+p.name})):ava(id,'grande'),
        h('dl',{class:'scheda'},
          h('dt',null,'Codici rossi'),h('dd',null,re&&re.rossi?String(re.rossi):'nessuno'),
          h('dt',null,'Freccette'),h('dd',null,fr&&fr.gare?fr.vinte+' vinte su '+fr.gare:'mai giocato'),
          h('dt',null,'Consumi del mese'),h('dd',null,co?eur(co.eur)+' · '+co.pz+' pz':'niente'),
          h('dt',null,'Spazzatura'),h('dd',null,(function(x){return x?x.n+(x.n===1?' volta':' volte'):'mai';})(statSpazzatura(S,'sempre',k)[id])),
          (function(t){return t.length?[h('dt',null,t.length>1?'Sintomi prevalenti':'Sintomo prevalente'),h('dd',null,t.join(', '))]:null;})(topSintomi(sintomiDi(S,id),2)))),
      h('div',{class:'riga-tratt'}),
      h('div',{class:'cart-h'},h('span',{class:'etichetta'},d<0?'È in credito di':'Deve al reparto'),h('span',{class:'cifrona '+(d>0?'rosso':d<0?'verde':'')},eur(Math.abs(d)))),
      d>0?tally(u):null,
      h('div',{class:'azioni tre'},
        h('button',{class:'pill duo-verde',type:'button',disabled:d<=0,onclick:function(){openPay(id);}},'Incassa'),
        h('button',{class:'pill',type:'button',onclick:function(){openDebt(id,1);}},'+ Debito'),
        h('button',{class:'pill',type:'button',onclick:function(){openDebt(id,-1);}},'− Debito')),
      h('div',{class:'azioni'},
        h('button',{class:'pill sm',type:'button',onclick:function(){UI.pos.p=id;closeSheet();go('farmacia');}},'Segna consumazione'),
        h('button',{class:'pill sm',type:'button',onclick:function(){openPerson(id);}},'Nome e faccia')),
      h('div',{class:'riga-tratt'}),
      h('span',{class:'etichetta'},'Storia clinica'),
      hist.length?h('ul',{class:'righe'},hist.map(function(m){return moveRow(m,true);})):h('p',{class:'vuoto'},'Cartella pulita.')
    ];
  };
  openSheet('Cartella di '+pName(id),live(),live);
}
function openPay(id){
  var d=Math.max(0,D.debt[id]||0),a=soldi('py-a',d);
  formSheet('Incassa da '+pName(id),[
    h('p',{class:'aiuto'},'Ticket aperto: '+eur(d)+'. I soldi entrano nella cassa della farmacia.'),
    campo('Quanto versa',a,'py-a')],function(){
    var v=parseEur(a.value);
    if(!(v>0))return 'Scrivi quanto versa, per esempio 5,00.';
    addMove({k:'pay',p:id,a:v},'Incassati '+eur(v)+' da '+pName(id));
  },'Incassa');
}
function openDebt(id,segno){
  var a=soldi('db-a'),n=testo('db-n','Es. vecchio conto, scommessa persa',80);
  formSheet((segno>0?'Aggiungi debito a ':'Togli debito a ')+pName(id),[
    h('p',{class:'aiuto'},segno>0?'Il debito sale senza toccare la cassa.':'Il debito scende senza che entrino soldi in cassa: per un pagamento usa «Incassa».'),
    campo('Importo',a,'db-a'),campo('Motivo',n,'db-n')],function(){
    var v=parseEur(a.value);
    if(!(v>0))return 'Scrivi l’importo, per esempio 3,00.';
    addMove({k:segno>0?'dplus':'dminus',p:id,a:v,note:n.value.trim()},(segno>0?'Debito aggiunto a ':'Debito tolto a ')+pName(id)+': '+eur(v));
  },segno>0?'Aggiungi':'Togli');
}
function openPerson(id,after){
  var p=id?S.people.find(function(x){return x.id===id;}):null;
  var n=testo('pe-n','Nome o soprannome',24,p?p.name:'');
  var kind=chipSel([{v:'paziente',label:'Paziente'},{v:'amico',label:'Visitatore'}],p?p.kind:'amico');
  var on=h('input',{type:'checkbox',id:'pe-on',checked:p?p.on:true});
  var faccia=sceltaFaccia(p);
  formSheet(p?'Modifica '+p.name:'Nuovo visitatore',[
    campo('Nome',n,'pe-n'),
    gruppo('Tipo',kind),
    h('div',{class:'campo'},h('span',{class:'lab'},'Faccia'),faccia,
      h('p',{class:'aiuto'},'Ogni caricatura va a una persona sola: se la scegli qui, la togli a chi l’aveva. «Dal telefono» prende una foto dalla galleria'+(SYNC&&remote?' e la manda anche agli altri telefoni.':' e la tiene solo su questo dispositivo.'))),
    p?h('label',{class:'spunta',for:'pe-on'},on,'Ancora in reparto'):null,
    p?null:h('p',{class:'aiuto'},'Il visitatore entra nell’elenco dei ticket: a segnare a suo nome sarà sempre uno di voi.')],function(){
    var nome=n.value.trim();
    if(!nome)return 'Scrivi un nome.';
    if(S.people.some(function(x){return x.id!==id&&x.name.toLowerCase()===nome.toLowerCase();}))return 'C’è già qualcuno con questo nome.';
    if(p){p.name=nome;p.kind=kind.get()||p.kind;p.on=on.checked;mettiFaccia(p,faccia.get());commit();toast('Aggiornato: '+nome);}
    else{var np={id:'a'+rid(),name:nome,kind:kind.get()||'amico',on:true,img:''};mettiFaccia(np,faccia.get());S.people.push(np);if(after)after(np.id);commit();toast('Aggiunto: '+nome);}
  });
}

/* ---------- vista: Cassa ---------- */
function inFilter(mv,f){
  if(f==='tutto')return true;
  var inf=moveInfo(mv);
  if(f==='cassa')return inf.cash!=null;
  if(f==='ticket')return inf.debt!=null||inf.fuori!=null;
  return inf.tag==='scorte';
}
function vCassa(){
  var out=[indietro(),h('h2',{class:'titolo'},'Cassa')];
  out.push(h('section',{class:'cartella'},
    h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'In cassa adesso'),h('span',{class:'timbro'+(D.cash<0?'':' ok')},D.cash<0?'In rosso':'Farmacia')),
    h('span',{class:'cifrona'+(D.cash<0?' rosso':'')},eur(D.cash)),
    h('div',{class:'azioni tre'},
      h('button',{class:'pill duo-verde',type:'button',onclick:openEntrata},'Entrata'),
      h('button',{class:'pill duo-rosa',type:'button',onclick:function(){openSpesa();}},'Spesa'),
      h('button',{class:'pill',type:'button',onclick:openConta},'Conta cassa')),
    (function(P){return h('p',{class:'aiuto'},'Con le scorte il locale ha ',h('button',{type:'button',class:'link','data-k':'cassa-soldi',onclick:function(){go(UI.tab,'soldi');}},eur(P.attuale)),'; con i graffi, previsionale '+eur(P.previsionale)+'.');})(previsione(S,D))));
  var filtri=h('div',{class:'chips',role:'group','aria-label':'Filtro'});
  [['tutto','Tutto'],['cassa','Cassa'],['ticket','Ticket'],['scorte','Scorte']].forEach(function(f){
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
function openEntrata(){
  var a=soldi('en-a'),n=testo('en-n','Es. fondo iniziale, offerta',80);
  formSheet('Entrata in cassa',[campo('Importo',a,'en-a'),campo('Da dove arriva',n,'en-n')],function(){
    var v=parseEur(a.value);
    if(!(v>0))return 'Scrivi l’importo, per esempio 20,00.';
    addMove({k:'in',a:v,note:n.value.trim()},'Entrata registrata: '+eur(v));
  },'Registra');
}
function openSpesa(pre){
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
function openConta(){
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
function openMove(id){
  var chiedi=false;
  var live=function(){
    var mv=S.moves.find(function(m){return m.id===id;});
    if(!mv)return [h('p',{class:'vuoto'},'Movimento non più presente.')];
    var inf=moveInfo(mv),dt=new Date(mv.t);
    var dl=h('dl',{class:'scheda'},
      h('dt',null,'Quando'),h('dd',null,dLong(dt)+', '+hm(mv.t)),
      h('dt',null,'Cosa'),h('dd',null,inf.t),
      inf.s?[h('dt',null,'Dettaglio'),h('dd',null,inf.s)]:null,
      mv.k!=='load'&&mv.k!=='inv'?[h('dt',null,'Importo'),h('dd',null,eur(Math.abs(toInt(mv.a))))]:null,
      mv.shares?[h('dt',null,'Quote'),h('dd',null,Object.keys(mv.shares).map(function(k){return pName(k)+' '+eur(mv.shares[k]);}).join(', '))]:null,
      mv.x?[h('dt',null,'Stato'),h('dd',{class:'rosso'},'Annullato')]:null);
    var az;
    if(mv.x)az=h('div',{class:'azioni'},h('button',{class:'pill',type:'button',onclick:function(){delete mv.x;commit();toast('Movimento ripristinato.');}},'Ripristina'));
    else if(chiedi)az=[h('p',{class:'errore'},'Annullare questo movimento? Cassa, ticket e scorte vengono ricalcolati.'),
      h('div',{class:'azioni'},
        h('button',{class:'pill pericolo',type:'button',onclick:function(){mv.x={t:Date.now()};chiedi=false;commit();toast('Movimento annullato.');}},'Sì, annulla'),
        h('button',{class:'pill',type:'button',onclick:function(){chiedi=false;refreshSheet();}},'No'))];
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
  if(P.negativi)av.push(h('li',{class:'rosso'},P.negativi+(P.negativi===1?' prodotto risulta':' prodotti risultano')+' sotto zero (venduto più di quanto contato): conta zero finché non rifate l’inventario.'));
  av.push(h('li',null,P.nCosto?'Le scorte valgono al prezzo di vendita; il valore a costo vale solo per i prodotti passati da uno scontrino.':'Le scorte valgono al prezzo di vendita: quello che le avete pagate è meno. Con gli scontrini l’app impara anche il costo.'));
  av.push(h('li',null,'Il previsionale conta i graffi per intero: ogni ticket che non viene pagato lo abbassa.'));
  out.push(h('section',{class:'cartella'},
    h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Prima di fidarvi')),
    h('div',{class:'riga-tratt'}),
    h('ul',{class:'avvisi'},av),
    h('div',{class:'azioni'},
      h('button',{class:'pill sm',type:'button',onclick:openConta},'Conta cassa'),
      h('button',{class:'pill sm',type:'button',onclick:function(){openInventario();}},'Inventario'))));

  var tutte=UI.soldiTutte||P.righe.length<=10,mostra=tutte?P.righe:P.righe.slice(0,10);
  out.push(h('section',{class:'cartella'},
    h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Scorte in magazzino'),h('span',{class:'importo'},eur(P.scorte))),
    h('div',{class:'riga-tratt'}),
    P.righe.length?h('ul',{class:'righe'},mostra.map(function(r){
      return rigaConto(r.n,r.q+' pz × '+eur(r.pr)+(r.c!=null?' · costo '+eur(r.c):''),eur(r.v));
    })):h('p',{class:'vuoto'},'Ancora nessun prodotto contato. Fate un inventario da Scorte e qui compare quanto valgono.'),
    tutte?null:h('div',{class:'azioni'},h('button',{class:'pill sm',type:'button',onclick:function(){UI.soldiTutte=true;render();}},'Mostra tutti ('+P.righe.length+')'))));

  out.push(h('section',{class:'cartella'},
    h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Graffi da incassare'),h('button',{class:'pill sm',type:'button',onclick:function(){go('ticket');}},'Tutti i ticket')),
    h('div',{class:'riga-tratt'}),
    deb.length?h('ul',{class:'righe'},deb.map(personRow)):h('p',{class:'vuoto'},'Nessun graffio aperto: tutti in regola.'),
    cred.length?[h('h4',{class:'giorno'},'Da restituire'),h('ul',{class:'righe'},cred.map(personRow))]:null));
  return out;
}
/* ---------- vista: Altro ---------- */
function voce(titolo,sotto,onclick){
  return h('li',null,h('button',{type:'button',class:'voce',onclick:onclick},
    h('span',{class:'cresce'},h('span',{class:'nome'},titolo),sotto?h('span',{class:'sotto'},sotto):null),ic('avanti')));
}
function indietro(){var t=UI.tab;return h('button',{type:'button',class:'pill viola sm indietro',onclick:function(){go(t);}},ic('indietro',18),NOMI_TAB[t]||'Indietro');}
function vAltro(){
  var low=lowStock(),da=low.length+S.shop.length,senzaFaccia=people().filter(function(p){return !p.img;}).length;
  return [h('h2',{class:'titolo'},'Altro'),
    h('ul',{class:'menu'},
      voce('Classifiche','Re dell’oblio, consumi, freccette, debiti, pagatori, spazzatura',function(){go('altro','classifiche');}),
      voce('Guida all’uso','Come funziona ogni sezione, per chi è appena entrato in reparto',function(){var u=IN_CLAUDE?'https://ciccionaso.github.io/oblio-house/guida.html':'guida.html';if(IN_CLAUDE)window.open(u,'_blank');else location.href=u;}),
      SYNC?voce('Telefoni collegati',syncTesto()+(SST.errore?' · '+SST.errore:''),openSync):null,
      voce('Cassa e registro',eur(D.cash)+' in cassa',function(){go('altro','cassa');}),
      (function(P){return voce('Soldi del locale','Adesso '+eur(P.attuale)+' · previsionale con i graffi '+eur(P.previsionale),function(){go('altro','soldi');});})(previsione(S,D)),
      voce('Scorte e lista della spesa',da?da+(da===1?' cosa da comprare':' cose da comprare'):'Niente da comprare',function(){go('altro','scorte');}),
      voce('Listino',S.products.filter(function(p){return p.on;}).length+' prodotti',function(){go('altro','listino');}),
      voce('Pazienti e visitatori',people().length+' in reparto'+(senzaFaccia?' · '+senzaFaccia+' senza faccia':''),function(){go('altro','persone');}),
      voce('Regole del reparto','Voto, calendario dei rifiuti'+(calPieno(S.cfg)?'':' (da compilare)')+', pulizie ogni '+S.cfg.puliziaGiorni+' giorni',function(){go('altro','regole');}),
      voce('Backup',backupLine()==='mai fatto'?(SYNC&&remote?'Mai fatto: i dati sono anche sul database del locale':'Mai fatto: i dati stanno solo su questo telefono'):'Ultimo: '+backupLine(),function(){go('altro','backup');}),
      voce('Installa sul telefono','Icona sulla schermata Home, funziona senza rete',function(){go('altro','installa');})),
    h('p',{class:'piede'},'The Oblio House · versione '+APP_V+' · su questo dispositivo: '+S.moves.length+' movimenti, '+S.votes.length+' voti, '+S.games.length+' partite.')];
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
      h('button',{class:'pill',type:'button',onclick:openSoglie},'Soglie')),
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
  },'Registra il carico');
}
function openInventario(pre){
  pre=pre||{};
  var L=listaNumeri('iv-',function(p){return p.id in pre?pre[p.id]:D.stock[p.id];});
  formSheet('Inventario',[h('p',{class:'aiuto'},'Scrivi quanti pezzi ci sono davvero. I campi vuoti restano come sono.'),
    h('div',{class:'azioni'},h('button',{class:'pill sm',type:'button','data-k':'iv-nuovo',onclick:function(){var v=scritti(L);openProdotto(null,{poi:function(){openInventario(v);}});}},'+ Prodotto nuovo')),L.ul],function(){
    var items=[],bad=false;
    S.products.forEach(function(p){var i=L.inputs[p.id];if(!i)return;var n=leggiNumero(i.value);if(n==null)return;if(isNaN(n)){bad=true;return;}if(n!==D.stock[p.id])items.push({id:p.id,n:p.name,q:n,pr:p.price});});
    if(bad)return 'Usa solo numeri interi, per esempio 12.';
    if(!items.length)return 'Non è cambiato nulla.';
    addMove({k:'inv',a:0,items:items},'Inventario salvato: '+items.length+(items.length===1?' prodotto':' prodotti'));
  },'Salva l’inventario');
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
      righe.push(h('li',null,h('button',{type:'button',class:'riga',onclick:function(){openProdotto(p.id);}},
        h('span',{class:'cresce'},h('span',{class:'nome'},p.name,p.on?null:h('span',{class:'tag'},'fuori listino'))),
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
  formSheet(p?'Modifica prodotto':'Nuovo prodotto',[campo('Nome',n,'pr-n'),campo('Prezzo di vendita',a,'pr-a'),campo('Categoria',cat,'pr-c'),campo('Oppure nuova categoria',nuova,'pr-nc'),
    conPezzi?h('div',{class:'linea'},h('label',{class:'cresce1 nome',for:'pr-pz'},'Pezzi che ci sono adesso'),pz):null,
    p?null:h('div',{class:'linea'},h('label',{class:'cresce1 nome',for:'pr-so'},'Soglia per la lista della spesa'),so),
    p?null:h('p',{class:'aiuto'},conPezzi?'Se scrivi i pezzi, il prodotto entra subito in magazzino e da lì scende da solo a ogni consumazione. Campi vuoti: lo conti dopo con l’inventario.':'Dopo il salvataggio torni al carico: scrivi lì quanti pezzi sono arrivati.'),
    h('label',{class:'spunta',for:'pr-on'},on,'In vendita')],function(){
    var nome=n.value.trim(),v=parseEur(a.value),c=nuova.value.trim()||cat.value;
    if(!nome)return 'Scrivi il nome del prodotto.';
    if(isNaN(v))return 'Scrivi il prezzo, per esempio 1,20.';
    if(S.products.some(function(x){return x!==p&&x.name.toLowerCase()===nome.toLowerCase();}))return 'C’è già un prodotto con questo nome.';
    if(p){p.name=nome;p.price=v;p.cat=c;p.on=on.checked;commit();toast('Prodotto aggiornato.');}
    else{
      var q=pz?leggiNumero(pz.value):null,m=leggiNumero(so.value);
      if((q!=null&&isNaN(q))||(m!=null&&isNaN(m)))return 'Pezzi e soglia: solo numeri interi, per esempio 12.';
      var np={id:'p'+rid(),name:nome,cat:c,price:v,min:m==null?null:m,on:on.checked};
      S.products.push(np);
      if(q!=null)S.moves.push({id:rid(),t:Date.now(),k:'inv',a:0,items:[{id:np.id,n:np.name,q:q,pr:np.price}]});
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
    var primaP=JSON.parse(JSON.stringify(S.products));
    var r=applicaScontrino(S,vere,opz,Date.now(),rid);
    closeSheet();commit();
    toast('Scontrino registrato: '+r.pezzi+(r.pezzi===1?' pezzo':' pezzi')+(r.nuovi.length?', '+r.nuovi.length+(r.nuovi.length===1?' prodotto nuovo':' prodotti nuovi'):'')+(opz.spesa?', spesa '+eur(r.totale):''),function(){
      S.products=primaP;S.moves=S.moves.filter(function(m){return r.mosse.indexOf(m)<0;});commit();toast('Scontrino annullato.');
    });
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
  aggSomma();
}
function vPersone(){
  return [indietro(),h('h2',{class:'titolo'},'Pazienti'),
    h('section',{class:'cartella'},
      h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'In reparto'),h('button',{class:'pill sm',type:'button',onclick:function(){openPerson(null);}},'+ Visitatore')),
      h('div',{class:'riga-tratt'}),
      h('ul',{class:'righe'},S.people.map(function(p){
        return h('li',null,h('button',{type:'button',class:'riga',onclick:function(){openPerson(p.id);}},
          ava(p.id),
          h('span',{class:'cresce'},h('span',{class:'nome'},p.name,p.kind==='amico'?h('span',{class:'tag'},'visitatore'):null,p.on?null:h('span',{class:'tag'},'dimesso')),
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
function chiediImport(b){
  var st=b.state;
  openSheet('Ripristina questo backup?',[
    h('dl',{class:'scheda'},
      h('dt',null,'Salvato il'),h('dd',null,b.exported?b.exported.slice(0,10).split('-').reverse().join('/'):'data non indicata'),
      h('dt',null,'Contiene'),h('dd',null,st.people.length+' persone, '+st.products.length+' prodotti, '+st.moves.length+' movimenti, '+st.votes.length+' voti, '+st.games.length+' partite')),
    h('p',{class:'errore'},SYNC&&remote?'I dati attuali vengono sostituiti su tutti i telefoni collegati, non solo su questo.':'I dati che ci sono adesso su questo telefono vengono sostituiti.'),
    h('div',{class:'azioni'},
      h('button',{class:'pill pericolo',type:'button',onclick:function(){S=st;closeSheet();commit();toast('Backup ripristinato.');}},'Sostituisci i dati'),
      h('button',{class:'pill',type:'button',onclick:closeSheet},'Lascia stare'))]);
}
function vBackup(){
  var file=h('input',{class:'inp',id:'bk-file',type:'file',accept:'application/json,.json'});
  file.addEventListener('change',function(){
    var f=file.files&&file.files[0];if(!f)return;
    var r=new FileReader();
    r.onload=function(){var b=leggiBackup(String(r.result||''));if(!b){toast('Questo file non è un backup dell’Oblio House.');return;}chiediImport(b);};
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
    h('section',{class:'cartella'},
      h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Ripristina')),
      campo('File di backup',file,'bk-file'),
      h('div',{class:'campo'},h('label',{for:'bk-in'},'Testo di backup'),incolla),
      h('div',{class:'azioni'},
        h('button',{class:'pill',type:'button',onclick:function(){var b=leggiBackup(incolla.value);if(!b){toast('Il testo incollato non è un backup valido.');return;}chiediImport(b);}},'Ripristina dal testo'),
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
  g.d.push(c);UI.dart.mol=1;
  var st=playDarts(g);
  if(st.win)g.end=Date.now();
  commit();
  if(st.win)toast(pName(st.win)+(g.players.length>1?' chiude e vince!':' chiude!'));
  else if(st.turns.length>prima){var t=st.turns[st.turns.length-1];if(t.bust)toast('Sballato! '+pName(t.p)+' resta a '+t.a+'.');}
}
function annullaFreccia(g){
  if(!g.d.length)return;
  g.d.pop();g.end=0;UI.dart.mol=1;UI.dart.vista=g.id;
  commit();toast('Ultima freccetta tolta.');
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
      'aria-label':p.name+(i>=0?', tira per '+(i===0?'primo':i===1?'secondo':i===2?'terzo':(i+1)+'°'):''),
      onclick:function(){if(i>=0)st.players.splice(i,1);else if(st.players.length<8)st.players.push(p.id);render();}},
      i>=0?h('span',{class:'ordine'},String(i+1)):ava(p.id,'xs'),p.name);
  }),h('button',{type:'button',class:'chip piu',onclick:function(){openPerson(null,function(id){if(st.players.length<8)st.players.push(id);});}},'+ Visitatore'));
  var regola=st.mode==='orologio'
    ?'Dall’1 al 20 in ordine: conta solo il numero di turno. Il doppio fa avanzare di 2, il triplo di 3. Niente centro alla fine: vince chi supera il 20 per primo.'
    :'Si parte da '+st.mode+' e si scala. Chiusura libera: vince chi arriva a zero preciso, con qualsiasi settore. Chi va sotto zero è sballato: il turno non conta e torna al punteggio di prima.';
  var recenti=S.games.slice(-8).reverse();
  return [h('h2',{class:'titolo'},'Freccette'),
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
      h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Ultime partite'),h('button',{class:'pill sm',type:'button',onclick:function(){go('freccette','classifiche');}},'Classifica')),
      h('div',{class:'riga-tratt'}),
      recenti.length?h('ul',{class:'righe'},recenti.map(rigaPartita)):h('p',{class:'vuoto'},'Ancora nessuna partita. Il bersaglio aspetta.'))];
}
function barraTurno(g,st){
  var p=g.players[st.cur];
  var slots=[0,1,2].map(function(i){var c=st.turn[i];return h('span',{class:'slot'+(c?' pieno':'')},c?dartLabel(c,st.x01):String(i+1));});
  var parz=st.turn.reduce(function(s,c){return s+dartVal(c).v;},0);
  return h('div',{class:'turno'},
    h('span',{class:'turno-chi'},'Tocca a '+pName(p)),
    h('span',{class:'slots'},slots),
    st.x01&&st.turn.length?h('span',{class:'turno-tot'},'= '+parz):null);
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
    var r=st.R[p],att=!fin&&i===st.cur,vin=st.win===p;
    return h('div',{class:'gioc'+(att?' attivo':'')+(vin?' vince':'')},
      h('span',{class:'gioc-h'},ava(p,'xs'),h('span',{class:'gioc-n'},pName(p))),
      h('span',{class:'gioc-p'},st.x01?String(r.left):(r.tgt>20?'Fatto':'al '+r.tgt)),
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
    else if(!st.win&&!g.ab)az=h('div',{class:'azioni'},h('button',{class:'pill duo-verde',type:'button',onclick:function(){UI.dart.vista=g.id;closeSheet();go('freccette');}},'Riprendi'));
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
function boardC(titolo,sotto,items,vuoto){
  return h('section',{class:'cartella'},
    h('div',{class:'cart-h'},h('h3',{class:'etichetta'},titolo)),
    sotto?h('p',{class:'aiuto'},sotto):null,
    h('div',{class:'riga-tratt'}),
    items.length?h('ol',{class:'classifica'},righeClassifica(items)):h('p',{class:'vuoto'},vuoto));
}
function vClassifiche(){
  var k=openKey(),per=UI.per,cut=S.cfg.voteCut,now=Date.now(),ym=k.slice(0,7);
  var quando=per==='mese'?meseNome(ym):per==='scorso'?meseNome(prevMonth(ym)):'da sempre';
  var chips=h('div',{class:'chips',role:'group','aria-label':'Periodo'},[['mese','Questo mese'],['scorso','Mese scorso'],['sempre','Da sempre']].map(function(x){
    return h('button',{type:'button',class:'chip','data-k':'per-'+x[0],'aria-pressed':String(per===x[0]),onclick:function(){UI.per=x[0];render();}},x[1]);
  }));
  var re=statRe(S,per,k),co=statConsumi(S,per,k,cut),fr=statFreccette(S,per,k,cut),pg=statPagatori(S,per,k,cut,now);
  var iRe=ordina(Object.keys(re.by).filter(function(id){return re.by[id].voti>0;}).map(function(id){
    var x=re.by[id];return {id:id,a:x.rossi,b:x.voti,val:x.rossi+(x.rossi===1?' codice rosso':' codici rossi'),sub:x.voti+(x.voti===1?' voto ricevuto':' voti ricevuti')};}));
  var iCo=ordina(Object.keys(co).map(function(id){var x=co[id];return {id:id,a:x.eur,b:x.pz,val:eur(x.eur),sub:x.pz+(x.pz===1?' pezzo':' pezzi')};}));
  var iFr=ordina(Object.keys(fr).filter(function(id){return fr[id].gare>0||fr[id].darts>0;}).map(function(id){
    var x=fr[id],avg=x.darts?x.pts/x.darts*3:0;
    return {id:id,a:x.vinte,b:Math.round(avg*10),val:x.vinte+(x.vinte===1?' vinta':' vinte'),
      sub:[x.gare+(x.gare===1?' partita':' partite'),x.darts?'media '+numIt(avg,1):null,x.co?'chiusura migliore '+x.co:null,x.ultimo?'ultimo '+x.ultimo+(x.ultimo===1?' volta':' volte'):null].filter(Boolean).join(' · ')};}));
  var iDe=ordina(people(true).filter(function(p){return (D.debt[p.id]||0)>0;}).map(function(p){
    var u=D.units[p.id]||0;return {id:p.id,a:D.debt[p.id],b:u,val:eur(D.debt[p.id]),cls:'rosso',sub:u+(u===1?' tacca':' tacche')};}));
  var iPg=ordina(Object.keys(pg).map(function(id){
    var x=pg[id],g10=Math.round(x.giorni*10);
    // a parità di giorni passa avanti chi ha meno ancora da saldare
    return {id:id,a:-g10,b:-x.open,val:g10===0&&!x.open?'subito':numIt(g10/10,1)+(g10===10?' giorno':' giorni'),
      sub:'su '+eur(x.eur)+(x.open?' · '+eur(x.open)+' ancora sul ticket':' · tutto saldato')};}));
  var sp=statSpazzatura(S,per,k);
  var iSp=ordina(Object.keys(sp).map(function(id){var x=sp[id];return {id:id,a:x.n,b:0,val:x.n+(x.n===1?' volta':' volte'),sub:'ultima: '+dShort(x.ultima)};}));
  var ch=serateChiuse(S,k),ks=Object.keys(ch).filter(function(s){return inPer(s,per,k)&&ch[s].n;}).sort().reverse().slice(0,10);
  return [indietro(),h('h2',{class:'titolo'},'Classifiche'),chips,
    h('p',{class:'nota-chiara'},'Periodo: '+quando+'. Tutto si conta per serata: quello che succede prima delle '+(cut===0?'24':cut)+':00 vale per la sera prima.'),
    boardC('Re dell’oblio','Codici rossi: le serate vinte al triage.'+(re.serate?' '+re.serate+(re.serate===1?' serata votata.':' serate votate.'):''),iRe,'Nessuna serata votata in questo periodo. La serata in corso conta da quando si chiude, '+chiusuraTxt()+'.'),
    ks.length?h('section',{class:'cartella'},h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Ultimi codici rossi')),h('div',{class:'riga-tratt'}),
      h('ul',{class:'righe'},ks.map(function(s){
        var sm=ch[s];
        return h('li',null,h('div',{class:'riga'},
          h('span',{class:'ora'},dShort(s)),
          sm.winners.length===1?ava(sm.winners[0],'sm'):null,
          h('span',{class:'cresce'},h('span',{class:'nome'},nomiLista(sm.winners))),
          h('span',{class:'importo spento'},sm.max+' su '+sm.n,h('small',null,'voti'))));
      }))):null,
    boardC('Consumi','Quanto ha preso ognuno in farmacia, pagato subito o sul ticket.',iCo,'Nessuna consumazione in questo periodo.'),
    boardC('Freccette','Vittorie nelle partite finite con almeno due giocatori. La media è per tre freccette, solo 501 e 301.',iFr,'Nessuna partita finita in questo periodo.'),
    boardC('Debiti','Ticket aperti adesso: non dipende dal periodo.',iDe,'Nessun ticket aperto.'),
    boardC('Migliori pagatori','Giorni in media tra consumazione e saldo, pesati sugli euro. «Paga subito» conta zero; quello ancora sul ticket conta fino a oggi.',iPg,'Nessuna consumazione in questo periodo.'),
    boardC('Spazzatura','Chi ha portato giù i rifiuti: una volta per ogni serata di uscita.',iSp,
      calPieno(S.cfg)?'Nessuno ha portato giù i rifiuti in questo periodo.':'Prima va compilato il calendario dei rifiuti, in Altro › Regole del reparto.'),
    h('section',{class:'cartella spenta'},h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Multe e penitenze'),h('span',{class:'timbro'},'In arrivo')),
      h('p',{class:'aiuto'},'Parte con le multe: codice rosso, ultimo a freccette, ticket non saldati.'))];
}

/* ---------- regole ---------- */
function vRegole(){
  var ora=h('select',{class:'inp',id:'rg-ora'},[0,1,2,3,4,5,6,7,8,9,10,11,12].map(function(n){return h('option',{value:String(n)},n===0?'a mezzanotte':'alle '+n+':00 del mattino');}));
  ora.value=String(S.cfg.voteCut);
  var self=h('input',{type:'checkbox',id:'rg-self',checked:S.cfg.selfVote});
  var form=h('form',{class:'modulo',onsubmit:function(ev){ev.preventDefault();S.cfg.voteCut=+ora.value;S.cfg.selfVote=self.checked;commit();toast('Regole del triage salvate.');}},
    campo('La serata si chiude',ora,'rg-ora'),
    h('label',{class:'spunta',for:'rg-self'},self,'Ci si può votare da soli'),
    h('button',{class:'pill duo-verde largo',type:'submit'},'Salva il triage'));
  var giorni=[1,2,3,4,5,6].map(function(g){
    var sel=chipSel(FRAZ.map(function(f){return {v:f[0],label:f[1]};}),S.cfg.rifiuti[g],true);
    return {g:g,sel:sel,box:gruppo('Ritiro '+GIORNI[g].toLowerCase()+' mattina',sel)};
  });
  var butt=chipSel(FRAZ.map(function(f){return {v:f[0],label:f[1]};}),S.cfg.buttiamo||BUTTIAMO0,true);
  var formR=h('form',{class:'modulo',onsubmit:function(ev){
      ev.preventDefault();S.cfg.buttiamo=butt.get();giorni.forEach(function(x){S.cfg.rifiuti[x.g]=x.sel.get();});commit();toast('Calendario dei rifiuti salvato.');}},
    gruppo('Cosa buttate (gli avvisi arrivano solo per queste)',butt),
    giorni.map(function(x){return x.box;}),
    h('button',{class:'pill duo-verde largo',type:'submit'},'Salva il calendario'));
  var pg=h('input',{class:'inp corto',id:'rg-pul',type:'text',inputmode:'numeric',autocomplete:'off',value:String(S.cfg.puliziaGiorni)});
  var errP=h('p',{class:'errore',role:'alert',hidden:true});
  var formP=h('form',{class:'modulo',onsubmit:function(ev){
      ev.preventDefault();var n=leggiNumero(pg.value);
      if(n==null||isNaN(n)||n<1||n>90){errP.textContent='Scrivi un numero di giorni da 1 a 90.';errP.hidden=false;return;}
      errP.hidden=true;S.cfg.puliziaGiorni=n;commit();toast('Ogni '+n+' giorni: salvato.');}},
    h('div',{class:'linea'},h('label',{class:'cresce1 nome',for:'rg-pul'},'Avviso dopo quanti giorni'),pg),errP,
    h('button',{class:'pill duo-verde largo',type:'submit'},'Salva le pulizie'));
  var ta=h('textarea',{class:'inp',id:'rg-sint',rows:9});
  ta.value=S.cfg.sintomi.join('\n');
  var formS=h('form',{class:'modulo',onsubmit:function(ev){
      ev.preventDefault();var list=[];
      ta.value.split('\n').forEach(function(s){s=s.trim().slice(0,40);if(s&&list.indexOf(s)<0&&list.length<40)list.push(s);});
      S.cfg.sintomi=list;commit();toast(list.length+(list.length===1?' sintomo salvato.':' sintomi salvati.'));}},
    campo('Uno per riga',ta,'rg-sint'),
    h('button',{class:'pill duo-verde largo',type:'submit'},'Salva i sintomi'));
  return [indietro(),h('h2',{class:'titolo'},'Regole del reparto'),
    h('section',{class:'cartella'},
      h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Triage e serate')),
      h('p',{class:'aiuto'},'La serata vale fino a quest’ora del mattino dopo: il voto si chiude lì, e anche classifiche e consumi contano per serata. I voti già dati restano nella serata in cui sono stati dati.'),
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
      h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Sintomi dell’oblio')),
      h('p',{class:'aiuto'},'Nel triage, insieme al voto, si possono scegliere uno o più sintomi, se si vuole. La diagnosi del codice rosso sono i sintomi più votati per lui quella sera.'),
      formS)];
}

var VIEWS={reparto:vReparto,farmacia:vFarmacia,ticket:vTicket,freccette:vFreccette,altro:vAltro};
var SUBS={cassa:vCassa,soldi:vSoldi,classifiche:vClassifiche,scorte:vScorte,listino:vListino,persone:vPersone,regole:vRegole,backup:vBackup,installa:vInstalla};

/* ---------- avvio ---------- */
function start(){
  foglio=$('#foglio');foglioT=$('#foglio-t');foglioB=$('#foglio-b');
  $('#foglio-x').addEventListener('click',closeSheet);
  foglio.addEventListener('close',function(){liveSheet=null;});
  foglio.addEventListener('click',function(e){if(e.target===foglio)closeSheet();});
  var st=loadState();
  S=st||seedState(Date.now());
  if(st&&lsGet(KEY+'.sync')){syncCarica();if(syncNuovaVersione(S,SY,APP_V))syncSalva();}
  var cambiato=applyImg0(S);
  if(applyCal0(S))cambiato=true;
  if(applySintomi0(S))cambiato=true;
  if(cambiato||!st)persist();
  D=derive(S);
  var hs=(location.hash||'').replace('#','').split('/');
  if(hs[0]==='cassa'){UI.tab='reparto';UI.sub='cassa';}
  else if(VIEWS[hs[0]]){UI.tab=hs[0];if(hs[1]&&SUBS[hs[1]])UI.sub=hs[1];}
  window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();installEvt=e;if(UI.sub==='installa')render();});
  // a mezzanotte cambia il bollettino, all'ora di chiusura cambia la serata: ridisegno da solo
  var chiave=today()+'|'+openKey();
  function controlla(){var k=today()+'|'+openKey();if(k!==chiave){chiave=k;if(!foglio.open)render();}}
  document.addEventListener('visibilitychange',function(){if(!document.hidden)controlla();});
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
