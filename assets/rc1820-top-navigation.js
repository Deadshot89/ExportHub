/* RC1820 Design "Neu" (Prototyp A): Menü oben mit Mega-Menü statt Seitenleiste.
   Aktiv nur bei html[data-eh-layout="top"] (Design-Umschalter RC1304, Auswahl "neu") und ab 1024px Breite.
   Die Leiste spiegelt das bestehende Menü #nav (RC1579): gleiche Rechte, gleiche Reihenfolge, Klick löst den
   Original-Menüknopf aus. Darunter bleibt die Seitenleiste unverändert für Handy und Tablet. */
(function(w,d){
 'use strict';
 if(w.ExportHUBTopNavigation1820)return;
 var ID='rc1820TopNav',ATTR='data-eh-layout';
 var TEXT={
  de:{quick:'Schnellstart',quickTitle:'Sendung in drei Schritten anlegen',quickText:'Kunde wählen, Daten erfassen, Dokumente hochladen.',start:'Jetzt starten',menu:'Hauptmenü',more:'Weitere Punkte'},
  en:{quick:'Quick start',quickTitle:'Create a shipment in three steps',quickText:'Choose the customer, enter the data, upload documents.',start:'Start now',menu:'Main menu',more:'More'},
  fr:{quick:'Démarrage rapide',quickTitle:'Créer un envoi en trois étapes',quickText:'Choisir le client, saisir les données, charger les documents.',start:'Commencer',menu:'Menu principal',more:'Plus'},
  it:{quick:'Avvio rapido',quickTitle:'Crea una spedizione in tre passi',quickText:'Scegli il cliente, inserisci i dati, carica i documenti.',start:'Inizia ora',menu:'Menu principale',more:'Altro'},
  es:{quick:'Inicio rápido',quickTitle:'Crear un envío en tres pasos',quickText:'Elegir el cliente, introducir los datos, subir los documentos.',start:'Empezar',menu:'Menú principal',more:'Más'},
  pl:{quick:'Szybki start',quickTitle:'Utwórz przesyłkę w trzech krokach',quickText:'Wybierz klienta, wprowadź dane, prześlij dokumenty.',start:'Zacznij teraz',menu:'Menu główne',more:'Więcej'}
 };
 var bar=null,pills=null,mega=null,bell=null,cta=null,openKey='',lastSig='',scheduled=false,navObserver=null;

 function on(){return d.documentElement.getAttribute(ATTR)==='top'}
 function lang(){var l='';try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.language==='function')l=String(w.ExportHUBI18n.language()||'').toLowerCase()}catch(_){}if(!TEXT[l]){var s=d.getElementById('languageSelect');l=String(s&&s.value||'').toLowerCase()}return TEXT[l]?l:'de'}
 function tx(k){return TEXT[lang()][k]||TEXT.de[k]}
 function nav(){return d.getElementById('nav')}
 function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
 function labelOf(el){var l=el&&el.querySelector('.index308-nav-label,.rc1579-section-label');return clean(l?l.textContent:el&&el.textContent).replace(/^[•⌕🛡️\s]+/u,'')}
 function viewOf(el){return el.getAttribute('data-index321-view')||el.getAttribute('data-view')||(el.hasAttribute('data-exporthub-urgent-nav')?'urgentorders':'')||el.getAttribute('data-rc1579-proxy')||''}
 function orderOf(el){var o=parseInt(w.getComputedStyle(el).order,10);return isFinite(o)?o:0}
 // Rechte wie RC1579: gesperrt = hidden, aria-hidden oder inline display:none (nicht das Einklappen eines Bereichs)
 function allowed(el){return !el.hidden&&el.getAttribute('aria-hidden')!=='true'&&el.style.display!=='none'}
 // Genau ein aktiver Punkt: eingebettete Module (Urgent Order, Fehler & Verbesserungen) setzen nur aria-current und
 // lassen das Dashboard "active"; ein echter Menüpunkt mit class active hat Vorrang (2026-11-06)
 var activeEl=null;
 function findActive(n){
  var real=null,cur=null,dash=null;
  Array.prototype.forEach.call(n.children,function(el){
   if(el.tagName!=='BUTTON')return;var v=viewOf(el);
   if(el.classList.contains('active')){if(v==='dashboard')dash=el;else if(!real)real=el}
   else if(el.getAttribute('aria-current')==='page'&&!cur)cur=el;
  });
  // Fehlerdiagnose, Release-Center und Update erscheinen als Punkt IT
  if(real&&/^(diagnostics|release|update)$/.test(viewOf(real)))real=n.querySelector(':scope>[data-rc1579-proxy="it"]')||real;
  return real||cur||dash;
 }
 function isActive(el){return !!el&&el===activeEl}
 function iconVars(src){
  var icon=src&&src.querySelector('.index308-nav-icon,.rc1579-section-icon');if(!icon)return '';
  var cs=w.getComputedStyle(icon),mask=cs.getPropertyValue('--rc1579-icon').trim(),accent=(src.getAttribute('data-menu-accent')||w.getComputedStyle(src).getPropertyValue('--menu-accent')||w.getComputedStyle(src).getPropertyValue('--rc1579-accent')||'').trim();
  var out='';if(mask)out+='--rc1820-icon:'+mask+';';if(accent)out+='--rc1820-accent:'+accent+';';return out;
 }

 // Menü aus #nav lesen: Start-Punkte (Ordnung 101..199) direkt, Bereiche (200, 300, ...) als Mega-Menü
 function model(){
  var n=nav();if(!n)return null;
  activeEl=findActive(n);
  var start=[],sections=[],byBase={},notifications=null,shipment=null;
  Array.prototype.forEach.call(n.children,function(el){
   if(el.classList.contains('rc1579-section')){
    if(el.hidden)return;var base=orderOf(el);if(!base)return;
    var s={key:el.getAttribute('data-rc1579-section'),label:labelOf(el),el:el,base:base,items:[]};
    byBase[base]=s;sections.push(s);return;
   }
   if(el.tagName!=='BUTTON'||!allowed(el))return;
   var o=orderOf(el);if(!o)return;
   var v=viewOf(el);
   // Fehlerdiagnose, Release-Center und Update stecken wie in RC1579 im Punkt IT
   if(v==='diagnostics'||v==='release'||v==='update')return;
   if(v==='notifications'){notifications=el;return}
   if(v==='shipment')shipment=el;
   if(o>100&&o<200){start.push({el:el,order:o});return}
   (byBase[Math.floor(o/100)*100]||(byBase[Math.floor(o/100)*100]={items:[],pending:true})).items.push({el:el,order:o});
  });
  // Punkte, die vor ihrem Bereichskopf im DOM stehen, nachtragen
  Array.prototype.forEach.call(n.children,function(el){
   if(el.tagName!=='BUTTON'||!allowed(el)||/^(diagnostics|release|update|notifications)$/.test(viewOf(el)))return;var o=orderOf(el),b=Math.floor(o/100)*100,s=byBase[b];
   if(!s||s.pending||o<200)return;if(!s.items.some(function(i){return i.el===el}))s.items.push({el:el,order:o});
  });
  sections.forEach(function(s){var p=byBase[s.base];s.items=(p&&p.items||[]).slice().sort(function(a,b){return a.order-b.order})});
  sections=sections.filter(function(s){return s.items.length}).sort(function(a,b){return a.base-b.base});
  start.sort(function(a,b){return a.order-b.order});
  return {start:start,sections:sections,notifications:notifications,shipment:shipment};
 }
 function sigOf(m){
  if(!m)return '';
  return [lang(),m.start.map(function(i){return viewOf(i.el)+(isActive(i.el)?'*':'')+labelOf(i.el)}).join(','),
   m.sections.map(function(s){return s.key+':'+s.label+':'+s.items.map(function(i){return viewOf(i.el)+(isActive(i.el)?'*':'')+labelOf(i.el)}).join('.')}).join('|'),
   m.notifications?(m.notifications.getAttribute('data-index236-notification-count')||'0'):'-',Math.max(0,Number(w.__EXPORTHUB_WARNING_SUMMARY__&&w.__EXPORTHUB_WARNING_SUMMARY__.total)||0),m.shipment?labelOf(m.shipment):'-',openKey].join('#');
 }

 function svg(path){return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+path+'</svg>'}
 function ensureBar(){
  if(bar&&bar.isConnected)return bar;
  var main=d.querySelector('main.main');if(!main)return null;
  bar=d.getElementById(ID);
  if(!bar){
   bar=d.createElement('div');bar.id=ID;bar.className='rc1820-topnav no-print';
   bar.innerHTML='<div class="rc1820-bar">'+
    '<button type="button" class="rc1820-brand" data-rc1820-home="1"><span class="rc1820-logo" aria-hidden="true">'+svg('<path d="M4 12h12"/><path d="M12 6l6 6-6 6"/>')+'</span><span class="rc1820-brand-name">ExportHUB</span></button>'+
    '<nav class="rc1820-pills"></nav>'+
    '<div class="rc1820-actions"><button type="button" class="rc1820-bell" data-rc1820-bell="1">'+svg('<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>')+'<span class="rc1820-bell-count" hidden></span></button>'+
    '<button type="button" class="rc1820-cta" data-rc1820-cta="1">'+svg('<path d="M12 5v14M5 12h14"/>')+'<span></span></button></div>'+
    '</div><div class="rc1820-mega" hidden></div>';
   main.insertBefore(bar,main.firstChild);
  }
  pills=bar.querySelector('.rc1820-pills');mega=bar.querySelector('.rc1820-mega');bell=bar.querySelector('[data-rc1820-bell]');cta=bar.querySelector('[data-rc1820-cta]');
  if(!bar.__rc1820Bound){
   bar.__rc1820Bound=true;
   bar.addEventListener('click',onClick);
   bar.addEventListener('keydown',function(e){if(e.key==='Escape'&&openKey){close();var p=pills.querySelector('[aria-expanded="true"]');if(p)p.focus()}});
  }
  return bar;
 }
 var current=null;
 function target(kind,idx){
  if(!current)return null;
  if(kind==='start')return current.start[idx]&&current.start[idx].el;
  var p=String(idx).split(':'),s=current.sections[+p[0]];return s&&s.items[+p[1]]&&s.items[+p[1]].el;
 }
 function onClick(e){
  var el=e.target.closest('button,[data-rc1820-go]');if(!el||!bar.contains(el))return;
  if(el.hasAttribute('data-rc1820-home')){var dash=nav()&&nav().querySelector(':scope>[data-view="dashboard"]');close();if(dash)dash.click();return}
  if(el.hasAttribute('data-rc1820-bell')){close();if(current&&current.notifications)current.notifications.click();return}
  if(el.hasAttribute('data-rc1820-cta')||el.hasAttribute('data-rc1820-quick')){close();if(current&&current.shipment)current.shipment.click();return}
  var sec=el.getAttribute('data-rc1820-section');
  if(sec!=null){if(openKey===sec)close();else{openKey=sec;render(true)}return}
  var go=el.getAttribute('data-rc1820-go');
  if(go){var t=target(go.split('|')[0],go.split('|')[1]);close();if(t)t.click()}
 }
 function close(){if(!openKey)return;openKey='';render(true)}
 function esc(v){return String(v).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}

 function render(force){
  scheduled=false;
  if(!on()){if(bar)bar.hidden=true;return}
  if(!ensureBar())return;
  bar.hidden=false;
  var m=model();if(!m)return;
  var sig=sigOf(m);if(!force&&sig===lastSig)return;
  lastSig=sig;current=m;
  if(openKey&&!m.sections.some(function(s){return s.key===openKey}))openKey='';
  var html='';
  // Dashboard steckt im Logo (wie im Prototyp), damit alle Punkte in eine Zeile passen
  var dash=null;m.start.forEach(function(i){if(viewOf(i.el)==='dashboard')dash=i.el});
  var brand=bar.querySelector('[data-rc1820-home]');brand.classList.toggle('is-active',!!(dash&&isActive(dash)));if(dash){brand.title=labelOf(dash);brand.setAttribute('aria-label','ExportHUB · '+labelOf(dash))}
  m.start.forEach(function(i,idx){if(i.el===dash){html+='<button type="button" class="rc1820-pill rc1820-pill-home'+(isActive(i.el)?' is-active':'')+'" data-rc1820-go="start|'+idx+'"'+(isActive(i.el)?' aria-current="page"':'')+' style="'+esc(iconVars(i.el))+'"><span class="rc1820-pill-icon" aria-hidden="true"></span>'+esc(labelOf(i.el))+'</button>';return}html+='<button type="button" class="rc1820-pill'+(isActive(i.el)?' is-active':'')+'" data-rc1820-go="start|'+idx+'"'+(isActive(i.el)?' aria-current="page"':'')+' style="'+esc(iconVars(i.el))+'"><span class="rc1820-pill-icon" aria-hidden="true"></span>'+esc(labelOf(i.el))+'</button>'});
  m.sections.forEach(function(s,si){
   var act=s.items.some(function(i){return isActive(i.el)});
   html+='<button type="button" class="rc1820-pill rc1820-pill-menu'+(act?' is-active':'')+(openKey===s.key?' is-open':'')+'" data-rc1820-section="'+esc(s.key)+'" aria-expanded="'+(openKey===s.key)+'" aria-haspopup="true" style="'+esc(iconVars(s.el))+'"><span class="rc1820-pill-icon" aria-hidden="true"></span>'+esc(s.label)+'<span class="rc1820-chev" aria-hidden="true"></span></button>';
  });
  pills.innerHTML=html;
  pills.setAttribute('aria-label',tx('menu'));
  // Glocke = Benachrichtigungen, mit Zähler
  bell.hidden=!m.notifications;
  if(m.notifications){
   var tasks=parseInt(m.notifications.getAttribute('data-index236-notification-count')||'0',10)||0,warningCount=Math.max(0,Number(w.__EXPORTHUB_WARNING_SUMMARY__&&w.__EXPORTHUB_WARNING_SUMMARY__.total)||0),c=tasks+warningCount,badge=bell.querySelector('.rc1820-bell-count');
   badge.hidden=!c;badge.textContent=c>99?'99+':String(c);
   bell.setAttribute('aria-label',labelOf(m.notifications)+(c?' ('+c+')':''));bell.title=labelOf(m.notifications);
   bell.classList.toggle('is-active',isActive(m.notifications));
  }
  cta.hidden=!m.shipment;if(m.shipment){cta.querySelector('span').textContent=labelOf(m.shipment);cta.title=labelOf(m.shipment);cta.setAttribute('aria-label',labelOf(m.shipment))}
  // Mega-Menü
  var s=null,si=-1;m.sections.forEach(function(x,i){if(x.key===openKey){s=x;si=i}});
  if(!s){mega.hidden=true;mega.innerHTML='';return}
  var items='';
  s.items.forEach(function(i,ii){items+='<button type="button" class="rc1820-item'+(isActive(i.el)?' is-active':'')+'" data-rc1820-go="sec|'+si+':'+ii+'" style="'+esc(iconVars(i.el))+'"><span class="rc1820-item-icon" aria-hidden="true"></span><span class="rc1820-item-label">'+esc(labelOf(i.el))+'</span></button>'});
  var quick=m.shipment&&s.key==='shipments'?'<div class="rc1820-quick"><span class="rc1820-quick-kicker">'+esc(tx('quick'))+'</span><strong>'+esc(tx('quickTitle'))+'</strong><span>'+esc(tx('quickText'))+'</span><button type="button" class="rc1820-cta" data-rc1820-quick="1">'+esc(tx('start'))+'</button></div>':'';
  mega.innerHTML='<div class="rc1820-mega-list" style="'+esc(iconVars(s.el))+'"><div class="rc1820-mega-title"><span class="rc1820-mega-icon" aria-hidden="true"></span>'+esc(s.label)+'</div><div class="rc1820-mega-grid">'+items+'</div></div>'+quick;
  mega.hidden=false;
 }
 function schedule(){if(scheduled)return;scheduled=true;(w.requestAnimationFrame||setTimeout)(function(){render(false)})}

 function watch(){
  var n=nav();
  if(n&&(!navObserver||navObserver.__nav!==n)){
   if(navObserver)navObserver.disconnect();
   navObserver=new MutationObserver(schedule);navObserver.__nav=n;
   navObserver.observe(n,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','style','aria-hidden','aria-current','data-index236-notification-count']});
  }
 }
 new MutationObserver(function(){watch();if(!on())close();lastSig='';schedule()}).observe(d.documentElement,{attributes:true,attributeFilter:[ATTR]});
 d.addEventListener('click',function(e){if(openKey&&bar&&!bar.contains(e.target))close()},true);
 w.addEventListener('exporthub:designchange',function(){lastSig='';schedule()});
 w.addEventListener('exporthub:languagechange',function(){lastSig='';schedule()});
 d.addEventListener('change',function(e){if(e.target&&e.target.id==='languageSelect'){lastSig='';setTimeout(schedule,50)}});
 w.addEventListener('resize',function(){if(openKey&&w.innerWidth<1024)close()});
 function boot(){watch();render(true)}
 if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',boot);else boot();
 // #nav entsteht teils erst nach dem Login: kurz nachfassen
 var tries=0,timer=setInterval(function(){tries++;watch();schedule();if(tries>40)clearInterval(timer)},500);
 w.ExportHUBTopNavigation1820=Object.freeze({version:'RC1820',refresh:function(){lastSig='';render(true)}});
})(window,document);
