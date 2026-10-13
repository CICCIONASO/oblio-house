/* blocco PURE della versione 0.7.0 (commit 48b172c), per le prove di compatibilità tra telefoni */

var APP_V='0.7.0';
var MODI={'501':'501','301':'301','orologio':'Giro dell’orologio'};
/* votiMax: quante persone può votare ognuno in una serata; graffiGiorni: dopo quanti giorni un graffio è «vecchio» */
var CFG0={voteCut:6,selfVote:true,puliziaGiorni:14,votiMax:3,graffiGiorni:30};
/* codici: PIN per le azioni sensibili (tutti) e codice per attivare l'Admin su un telefono. Si cambiano dall'Admin. */
var PIN0='1010',ADMIN0='0101';
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
function voteSummary(list){
  var last={},by={},tally={},sint={},max=0,nv=0;
  list.forEach(function(v){last[v.v]=v;});
  Object.keys(last).forEach(function(k){
    var v=last[k],cs=candidatiVoto(v);by[k]=cs;
    cs.forEach(function(c){
      tally[c]=(tally[c]||0)+1;nv++;if(tally[c]>max)max=tally[c];
      sintomiPer(v,c).forEach(function(y){var s=sint[c]=sint[c]||{};s[y]=(s[y]||0)+1;});
    });
  });
  return {by:by,tally:tally,sint:sint,max:max,n:Object.keys(by).length,voti:nv,winners:max?Object.keys(tally).filter(function(c){return tally[c]===max;}):[]};
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
  S.votes.forEach(function(v){if(candidatiVoto(v).indexOf(id)>=0)sintomiPer(v,id).forEach(function(y){conta[y]=(conta[y]||0)+1;});});
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
  S.votes.forEach(function(v){if(inPer(v.s,per,openKey))(g[v.s]=g[v.s]||[]).push(v);});
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
    voce('votato','Il più votato',mappa(r,function(x){return x.voti;}),['voto ricevuto','voti ricevuti']),
    voce('freccette','Campione delle freccette',mappa(fr,function(x){return x.vinte;}),['partita vinta','partite vinte']),
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
  var prod={},stock={},cash=0,debt=0,cat={carichi:0,vendite:0,spese:0,entrate:0,debiti:0,conte:0,inventari:0,prezzi:0,altro:0};
  S.products.forEach(function(p){prod[p.id]=p;});
  function vp(id,t){return (id in stock)&&prod[id]?Math.max(0,stock[id])*prezzoAl(prod[id],t):0;}
  function valore(t){var v=cash+debt;Object.keys(stock).forEach(function(id){v+=vp(id,t);});return v;}
  var ev=[];
  S.moves.forEach(function(m){if(m&&!m.x&&toInt(m.t)<=tFine)ev.push({t:toInt(m.t),m:m});});
  S.products.forEach(function(p){(p.ph||[]).forEach(function(x){if(x.t<=tFine)ev.push({t:x.t,p:p,x:x});});});
  ev.sort(function(a,b){return a.t-b.t||(a.m?0:1)-(b.m?0:1);});
  var t0=snap.t,v0=null;
  function fuori(m){(m.items||[]).forEach(function(it){if(it&&it.id&&(it.id in stock))stock[it.id]-=toInt(it.q);});}
  function applica(e){
    if(!e.m){   // cambio di prezzo: le scorte di quel prodotto cambiano valore
      var p=e.p,dopo=prezzoAl(p,e.x.t),q=(p.id in stock)?Math.max(0,stock[p.id]):0;
      return {k:'prezzi',d:q*(dopo-e.x.da)};
    }
    var m=e.m,a=m.k==='count'?toInt(m.a):Math.max(0,toInt(m.a)),ids={},prima=0,dopo2=0,k='altro';
    (m.items||[]).forEach(function(it){if(it&&it.id)ids[it.id]=1;});
    Object.keys(ids).forEach(function(id){prima+=vp(id,e.t);});
    var c0=cash,d0=debt;
    switch(m.k){
      case 'sale':cash+=a;fuori(m);k='vendite';break;
      case 'tab':if(m.p)debt+=a;fuori(m);k='vendite';break;
      case 'dplus':if(m.p)debt+=a;k='debiti';break;
      case 'dminus':if(m.p)debt-=a;k='debiti';break;
      case 'pay':cash+=a;if(m.p)debt-=a;break;
      case 'in':cash+=a;k='entrate';break;
      case 'exp':
        if(!m.paidBy||m.paidBy==='cassa'||m.settle==='cassa')cash-=a;
        else if(m.settle==='dividi'){debt-=a;var sh=m.shares||{};Object.keys(sh).forEach(function(p){debt+=toInt(sh[p]);});}
        else debt-=a;
        k='spese';break;
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
    moves:[],shop:[],votes:[],games:[],trash:[],cleanings:[],quote:[],muro:[],verifiche:[],
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
  cfg:['voteCut','selfVote','puliziaGiorni','rifiuti','sintomi','buttiamo','votiMax','graffiGiorni','pinH','admH'],
  people:['id','name','kind','on','img','nato'],
  products:['id','name','cat','price','min','on','cost','al','ph'],
  moves:['id','t','k','a','p','note','cat','items','paidBy','settle','shares','counted','expected','x','xm','g','mese'],
  votes:['id','s','v','c','t','y','ys','cs','cy','da'],
  quote:['id','mese','a','chi','scad','note','t'],
  muro:['id','t','p','testo','col','dv','mod'],
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
  var S={v:1,people:[],products:[],moves:[],shop:[],votes:[],games:[],trash:[],cleanings:[],quote:[],muro:[],verifiche:[],cfg:normCfg(raw.cfg),meta:{}};
  raw.people.forEach(function(p){
    if(p&&typeof p.id==='string'&&p.id){
      var id=str(p.id,40);
      var o={id:id,name:str(p.name,24).trim()||'Senza nome',kind:p.kind==='amico'?'amico':'paziente',on:p.on!==false,img:normImg(p.img)};
      if(normNato(p.nato))o.nato=normNato(p.nato);                       // compleanno: solo «MM-GG», senza anno
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
    S.muro.push(tieniAltro(x,o,NOTI.muro));
  });
  S.muro.sort(function(a,b){return a.t-b.t;});
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
  S.meta={created:toInt(me.created),rev:toInt(me.rev),saved:toInt(me.saved),exported:toInt(me.exported),img0:str(me.img0,200),cal0:str(me.cal0,200),sint0:str(me.sint0,2000)};
  return S;
}
/* ---------- sincronizzazione tra telefoni (parte pura) ----------
   Ogni cosa segnata è un'«entità» con chiave «raccolta~id». SY.ent[chiave] = [u, impronta, confermata]:
   u = ora della modifica (vince la più recente), impronta = hash del JSON canonico ('-' = cancellata). */
var COLS=['people','products','moves','shop','votes','games','trash','cleanings','quote','muro','verifiche'];
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
  var raw={people:[],products:[],moves:[],shop:[],votes:[],games:[],trash:[],cleanings:[],quote:[],muro:[],verifiche:[]};
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
    S.moves.sort(perT);S.votes.sort(perT);S.games.sort(perT);S.cleanings.sort(perT);S.muro.sort(perT);S.verifiche.sort(perT);
    S.quote.sort(function(a,b){return a.mese<b.mese?-1:a.mese>b.mese?1:0;});
    S.trash.sort(function(a,b){return a.s<b.s?-1:a.s>b.s?1:0;});
  }
  return changed;
}
