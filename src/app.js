(function(){
'use strict';

/* ===================== PURE ===================== */
var APP_V='0.4.0';
var MODI={'501':'501','301':'301','orologio':'Giro dell’orologio'};
var CFG0={voteCut:6,selfVote:true,puliziaGiorni:14};
/* frazioni del calendario Teknoservice di Altamura */
var FRAZ=[['organico','Organico'],['secco','Secco residuo'],['vetro','Vetro'],['carta','Carta e cartone'],['plastica','Plastica e metalli'],['pannolini','Pannolini e pannoloni']];
var FRAZ_ID=FRAZ.map(function(f){return f[0];});
/* calendario «Centro – utenze domestiche» dalla foto (Comune di Altamura): giorno di ritiro → frazioni.
   Pannolini (mar, gio, sab) lasciati fuori: si spuntano dalle Regole se servono. */
var CAL0={1:['organico','vetro'],2:['secco'],3:['organico'],4:['plastica'],5:['organico'],6:['carta']};
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
function voteSummary(list){
  var last={},by={},tally={},sint={},max=0;
  list.forEach(function(v){last[v.v]=v;});
  Object.keys(last).forEach(function(k){
    var v=last[k],c=v.c;by[k]=c;tally[c]=(tally[c]||0)+1;if(tally[c]>max)max=tally[c];
    if(v.y){var s=sint[c]=sint[c]||{};s[v.y]=(s[v.y]||0)+1;}
  });
  return {by:by,tally:tally,sint:sint,max:max,n:Object.keys(by).length,winners:max?Object.keys(tally).filter(function(c){return tally[c]===max;}):[]};
}
function topSintomo(conta){
  var best=null,n=0;
  Object.keys(conta||{}).forEach(function(s){if(conta[s]>n){n=conta[s];best=s;}});
  return best;
}
function sintomiDi(S,id){
  var conta={};
  S.votes.forEach(function(v){if(v.c===id&&v.y)conta[v.y]=(conta[v.y]||0)+1;});
  return conta;
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
  var p=String(key).split('-'),g=new Date(+p[0],+p[1]-1,+p[2]+1,12).getDay();
  return (cfg.rifiuti&&cfg.rifiuti[g])||[];
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
  return {voteCut:cut>=0&&cut<=12?cut:CFG0.voteCut,selfVote:c.selfVote!==false,
    puliziaGiorni:pg>=1&&pg<=90?pg:CFG0.puliziaGiorni,rifiuti:rif,sintomi:sint};
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
      S.people.push({id:id,name:str(p.name,24).trim()||'Senza nome',kind:p.kind==='amico'?'amico':'paziente',on:p.on!==false,
        img:normImg(p.img)});
    }
  });
  raw.products.forEach(function(p){
    if(p&&typeof p.id==='string'&&p.id)S.products.push({id:str(p.id,40),name:str(p.name,40).trim()||'Prodotto',cat:str(p.cat,20).trim()||'Altro',price:Math.max(0,toInt(p.price)),min:(p.min==null||p.min==='')?null:Math.max(0,toInt(p.min)),on:p.on!==false});
  });
  raw.moves.forEach(function(m){
    if(!m||typeof m.k!=='string')return;
    var o={id:str(m.id,40)||('m'+S.moves.length),t:toInt(m.t),k:str(m.k,10),a:toInt(m.a)};
    if(m.p)o.p=str(m.p,24);
    if(m.note)o.note=str(m.note,120);
    if(m.cat)o.cat=str(m.cat,30);
    if(Array.isArray(m.items))o.items=m.items.filter(function(it){return it&&typeof it==='object';}).slice(0,80).map(function(it){
      var x={n:str(it.n,40),q:Math.max(0,toInt(it.q)),pr:Math.max(0,toInt(it.pr))};if(it.id)x.id=str(it.id,40);return x;});
    if(m.paidBy)o.paidBy=str(m.paidBy,24);
    if(m.settle)o.settle=str(m.settle,10);
    if(m.shares&&typeof m.shares==='object'){o.shares={};Object.keys(m.shares).slice(0,40).forEach(function(k){o.shares[str(k,24)]=Math.max(0,toInt(m.shares[k]));});}
    if(m.counted!=null)o.counted=toInt(m.counted);
    if(m.expected!=null)o.expected=toInt(m.expected);
    if(m.x)o.x={t:toInt(m.x.t)};
    S.moves.push(o);
  });
  S.moves.sort(function(a,b){return a.t-b.t;});
  (Array.isArray(raw.shop)?raw.shop:[]).forEach(function(s){if(s&&s.text)S.shop.push({id:str(s.id,40)||('s'+S.shop.length),text:str(s.text,60),t:toInt(s.t)});});
  var vv=[],ultimo={};
  (Array.isArray(raw.votes)?raw.votes:[]).forEach(function(v){
    if(!v||typeof v!=='object')return;
    var s=str(v.s,10),chi=str(v.v,24),per=str(v.c,24);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!chi||!per)return;
    var o={id:str(v.id,40)||('v'+vv.length),s:s,v:chi,c:per,t:toInt(v.t)};
    if(v.y)o.y=str(v.y,40).trim();
    if(!o.y)delete o.y;
    vv.push(o);
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
/* applica le modifiche arrivate dagli altri telefoni, sul posto. Alla prima unione (init) vince il locale condiviso. */
function syncApply(S,changes,SY,init){
  var changed=false;
  changes.forEach(function(ch){
    if(!ch||typeof ch.key!=='string')return;
    var key=ch.key,loc=SY.ent[key],hr=ch.j==null?'-':hashStr(ch.j);
    if(loc&&loc[0]===ch.u&&loc[1]===hr){loc[2]=1;return;}
    if(!init&&loc&&(loc[0]>ch.u||(loc[0]===ch.u&&loc[1]>hr)))return;
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
  indietro:'<path d="M15 6l-6 6 6 6"/>'
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
  if(!SY||typeof SY!=='object'||!SY.ent||typeof SY.ent!=='object')SY={cursor:0,init:false,ent:{}};
  DEV=lsGet(KEY+'.dev');
  if(!DEV){DEV='d'+rid();lsSet(KEY+'.dev',DEV);}
}
function syncSalva(){lsSet(KEY+'.sync',JSON.stringify(SY));}
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
    r.subscribe(SY.init?SY.cursor:0,ricevi,function(e){SST.errore=String(e&&e.message||e);SST.stato=SY.init?'attesa':'errore';statoSync();});
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
        SST.errore=String(err&&err.message||err);statoSync();
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
  else if(IOS&&!installata())msg='Su iPhone installa l’app prima di usarla: Condividi, poi «Aggiungi alla schermata Home». Quello che segni qui in Safari non passa all’app installata.';
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
function vota(chi,per,y){
  y=y||'';
  var k=openKey(),v=S.votes.find(function(x){return x.s===k&&x.v===chi;}),prima=v?{c:v.c,t:v.t,y:v.y||''}:null;
  if(prima&&prima.c===per&&prima.y===y){toast(pName(chi)+' aveva già votato così.');return;}
  if(v){v.c=per;v.t=Date.now();if(y)v.y=y;else delete v.y;}
  else{v={id:'v'+k+'_'+chi,s:k,v:chi,c:per,t:Date.now()};if(y)v.y=y;S.votes.push(v);}   // stesso voto = stesso documento su tutti i telefoni
  commit();
  toast(pName(chi)+(prima?' cambia voto: ':' vota ')+pName(per)+(y?' · '+y.toLowerCase():''),function(){
    if(prima){v.c=prima.c;v.t=prima.t;if(prima.y)v.y=prima.y;else delete v.y;}
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
  var diag=ver&&ver.sm.winners.length===1?topSintomo(ver.sm.sint[ver.sm.winners[0]]):null;
  return h('section',{class:'triage'},
    h('div',{class:'cart-h'},h('h2',{class:'tri-t'},'Triage: chi sta peggio?'),h('span',{class:'timbro scuro'},sm.n+(sm.n===1?' voto':' voti'))),
    h('p',{class:'tri-s'},'Voto palese della serata, visitatori compresi. Tocca chi sta peggio, poi chi vota. Si chiude '+chiusuraTxt()+'.'),
    grid,
    testa?h('p',{class:'tri-s forte'},testa):null,
    lista?h('p',{class:'tri-s'},'Voti: '+lista):null,
    ver?h('div',{class:'verdetto'},ver.sm.winners.length===1?ava(ver.sm.winners[0],'sm'):null,
      h('p',null,h('b',null,'Codice rosso '+(nomeSerata(ver.k)==='ieri sera'?'di ieri sera':'della '+nomeSerata(ver.k))+': '),
        nomiLista(ver.sm.winners)+' ('+ver.sm.max+(ver.sm.max===1?' voto':' voti')+' su '+ver.sm.n+')',
        diag?[h('br'),'Diagnosi: '+diag.toLowerCase()+'.']:null)):null,
    re?h('p',{class:'tri-s'},(re.ids.length>1?'Re dell’oblio di '+re.mese+' a pari merito: ':'Re dell’oblio di '+re.mese+': ')+nomiLista(re.ids)+', '+re.n+(re.n===1?' codice rosso.':' codici rossi.')):null,
    h('div',{class:'azioni'},
      h('button',{class:'pill sm',type:'button',disabled:!sm.n,onclick:openVoti},'Vedi i voti'),
      h('button',{class:'pill sm',type:'button',onclick:function(){go('reparto','classifiche');}},'Classifiche')));
}
function openVoto(per){
  var syv=null;
  var live=function(){
    var sm=voteSummary(votiSerata(openKey()));
    var sy=S.cfg.sintomi.length?chipSel(S.cfg.sintomi.map(function(s){return {v:s,label:s,cls:'sm'};}),syv,false,true):null;
    if(sy)sy.addEventListener('change',function(){syv=sy.get();});
    var chips=h('div',{class:'chips'},people().map(function(p){
      var gia=sm.by[p.id],bloccato=p.id===per&&!S.cfg.selfVote;
      return h('button',{type:'button',class:'chip con-ava'+(p.kind==='amico'?' amico':''),'data-k':'vt-'+p.id,'aria-pressed':String(gia===per),disabled:bloccato,
        onclick:function(){closeSheet();vota(p.id,per,syv);}},
        ava(p.id,'xs'),p.name,gia&&gia!==per?h('small',{class:'chip-s'},'ha votato '+pName(gia)):null);
    }));
    return [
      h('div',{class:'voto-chi'},ava(per,'grande'),h('p',{class:'aiuto'},(sy?'Se vuoi scegli il sintomo, poi tocca chi vota. ':'Tocca chi vota. ')+'Chi ha già votato stasera cambia il suo voto.'+(S.cfg.selfVote?' Ci si può votare da soli.':''))),
      sy?gruppo('Sintomo (facoltativo)',sy):null,
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
          h('span',{class:'cresce'},h('span',{class:'nome'},pName(v.v)+' → '+pName(v.c)),v.y?h('span',{class:'sotto'},v.y):null),
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
function posSave(kind){
  var pos=UI.pos,items=[],a=0;
  S.products.forEach(function(p){var q=pos.qty[p.id]||0;if(q){items.push({id:p.id,n:p.name,q:q,pr:p.price});a+=q*p.price;}});
  pos.extra.forEach(function(x){items.push({n:x.n,q:1,pr:x.pr});a+=x.pr;});
  if(!pos.p||!items.length)return;
  var who=pName(pos.p);
  UI.pos={p:null,qty:{},extra:[]};
  addMove({k:kind,p:pos.p,items:items,a:a},kind==='tab'?'Sul ticket di '+who+': '+eur(a):who+' ha pagato in cassa: '+eur(a));
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
        h('strong',null,t.n?eur(t.a)+' · '+t.n+(t.n===1?' pezzo':' pezzi'):'Scegli cosa prende')),
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
          (function(s){return s?[h('dt',null,'Sintomo prevalente'),h('dd',null,s)]:null;})(topSintomo(sintomiDi(S,id))))),
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
      h('p',{class:'aiuto'},'Ogni caricatura va a una persona sola: se la scegli qui, la togli a chi l’aveva. «Dal telefono» prende una foto dalla galleria e la tiene solo su questo dispositivo.')),
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
      h('button',{class:'pill',type:'button',onclick:openConta},'Conta cassa'))));
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
      voce('Cassa e registro',eur(D.cash)+' in cassa',function(){go('altro','cassa');}),
      voce('Scorte e lista della spesa',da?da+(da===1?' cosa da comprare':' cose da comprare'):'Niente da comprare',function(){go('altro','scorte');}),
      voce('Listino',S.products.filter(function(p){return p.on;}).length+' prodotti',function(){go('altro','listino');}),
      voce('Pazienti e visitatori',people().length+' in reparto'+(senzaFaccia?' · '+senzaFaccia+' senza faccia':''),function(){go('altro','persone');}),
      voce('Regole del reparto','Voto, calendario dei rifiuti'+(calPieno(S.cfg)?'':' (da compilare)')+', pulizie ogni '+S.cfg.puliziaGiorni+' giorni',function(){go('altro','regole');}),
      voce('Backup',backupLine()==='mai fatto'?'Mai fatto: i dati stanno solo su questo telefono':'Ultimo: '+backupLine(),function(){go('altro','backup');}),
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
    h('div',{class:'cart-h'},h('h3',{class:'etichetta'},'Magazzino')),
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
function openCarico(){
  var L=listaNumeri('ca-',function(){return null;});
  var poi=h('input',{type:'checkbox',id:'ca-poi'});
  formSheet('Carico scorte',[h('p',{class:'aiuto'},'Scrivi quanti pezzi sono arrivati, solo per i prodotti comprati.'),L.ul,h('label',{class:'spunta',for:'ca-poi'},poi,'Dopo registro anche la spesa')],function(){
    var items=[],bad=false;
    S.products.forEach(function(p){var i=L.inputs[p.id];if(!i)return;var n=leggiNumero(i.value);if(n==null)return;if(isNaN(n)){bad=true;return;}if(n>0)items.push({id:p.id,n:p.name,q:n,pr:p.price});});
    if(bad)return 'Usa solo numeri interi, per esempio 12.';
    if(!items.length)return 'Scrivi almeno una quantità.';
    var dopo=poi.checked;
    addMove({k:'load',a:0,items:items},'Carico registrato: '+items.length+(items.length===1?' prodotto':' prodotti'));
    if(dopo)setTimeout(function(){openSpesa({cat:'Rifornimento bar'});},60);
  },'Registra il carico');
}
function openInventario(){
  var L=listaNumeri('iv-',function(p){return D.stock[p.id];});
  formSheet('Inventario',[h('p',{class:'aiuto'},'Scrivi quanti pezzi ci sono davvero. I campi vuoti restano come sono.'),L.ul],function(){
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
function openProdotto(id){
  var p=id?prod(id):null;
  var n=testo('pr-n','Nome del prodotto',40,p?p.name:''),a=soldi('pr-a',p?p.price:null);
  var lista=cats();if(lista.indexOf('Altro')<0)lista.push('Altro');
  var cat=h('select',{class:'inp',id:'pr-c'},lista.map(function(c){return h('option',{value:c},c);}));
  cat.value=p?p.cat:lista[0];
  var nuova=testo('pr-nc','Solo se serve una categoria nuova',20);
  var on=h('input',{type:'checkbox',id:'pr-on',checked:p?p.on:true});
  formSheet(p?'Modifica prodotto':'Nuovo prodotto',[campo('Nome',n,'pr-n'),campo('Prezzo',a,'pr-a'),campo('Categoria',cat,'pr-c'),campo('Oppure nuova categoria',nuova,'pr-nc'),
    h('label',{class:'spunta',for:'pr-on'},on,'In vendita')],function(){
    var nome=n.value.trim(),v=parseEur(a.value),c=nuova.value.trim()||cat.value;
    if(!nome)return 'Scrivi il nome del prodotto.';
    if(isNaN(v))return 'Scrivi il prezzo, per esempio 1,20.';
    if(p){p.name=nome;p.price=v;p.cat=c;p.on=on.checked;}
    else S.products.push({id:'p'+rid(),name:nome,cat:c,price:v,min:null,on:on.checked});
    commit();toast(p?'Prodotto aggiornato.':'Prodotto aggiunto: '+nome);
  });
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
      h('p',{class:'aiuto'},'Tutto quello che segni vive solo su questo dispositivo. Se si rompe o si azzera il browser, senza backup si perde. Ultimo backup: '+backupLine()+'.'),
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
    h('p',{class:'aiuto'},'Fallo una volta con internet attivo. Da quel momento l’app si apre dall’icona anche senza rete e i dati restano sul telefono.'),
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
  var formR=h('form',{class:'modulo',onsubmit:function(ev){
      ev.preventDefault();giorni.forEach(function(x){S.cfg.rifiuti[x.g]=x.sel.get();});commit();toast('Calendario dei rifiuti salvato.');}},
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
      h('p',{class:'aiuto'},'Nel triage si può scegliere il sintomo insieme al voto, se si vuole. La diagnosi del codice rosso è il sintomo più votato per lui quella sera.'),
      formS)];
}

var VIEWS={reparto:vReparto,farmacia:vFarmacia,ticket:vTicket,freccette:vFreccette,altro:vAltro};
var SUBS={cassa:vCassa,classifiche:vClassifiche,scorte:vScorte,listino:vListino,persone:vPersone,regole:vRegole,backup:vBackup,installa:vInstalla};

/* ---------- avvio ---------- */
function start(){
  foglio=$('#foglio');foglioT=$('#foglio-t');foglioB=$('#foglio-b');
  $('#foglio-x').addEventListener('click',closeSheet);
  foglio.addEventListener('close',function(){liveSheet=null;});
  foglio.addEventListener('click',function(e){if(e.target===foglio)closeSheet();});
  var st=loadState();
  S=st||seedState(Date.now());
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
