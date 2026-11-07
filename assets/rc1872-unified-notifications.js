/* RC1872: One visible notification center; retain the canonical warning and task engines.
 * Warning summary stays read-only. Do not replace shipment states, push channels or task counters. */
(function(w,d){
'use strict';
if(w.ExportHUBUnifiedNotifications1872)return;
var section=null,center=null,lastSignature='',tab='all',lastWarningCount=-1,scheduled=false,observedRoot=null,rootObserver=null;
var labels={
 de:{all:'Alle',warnings:'Warnungen',tasks:'Aufgaben',title:'Operative Warnungen',none:'Keine aktiven Sendungswarnungen.',open:'Öffnen',more:'Weitere anzeigen',intro:'Hier findest du deine persönlichen Aufgaben und operative Sendungswarnungen an einem Ort. Aufgaben-Erinnerungen bleiben um 09:00, 12:00 und 15:00 Uhr aktiv.',type:['POD fehlt','Dokumente prüfen','Abholung offen']},
 en:{all:'All',warnings:'Warnings',tasks:'Tasks',title:'Operational warnings',none:'No active shipment warnings.',open:'Open shipment overview',more:'More shipments in overview',intro:'Personal tasks and shipment warnings are in one place. Task reminders remain active at 09:00, 12:00 and 15:00.',type:['POD missing','Check documents','Collection pending']},
 pl:{all:'Wszystkie',warnings:'Ostrzeżenia',tasks:'Zadania',title:'Ostrzeżenia operacyjne',none:'Brak aktywnych ostrzeżeń.',open:'Otwórz listę przesyłek',more:'Więcej przesyłek na liście',intro:'Zadania osobiste i ostrzeżenia dotyczące przesyłek w jednym miejscu.',type:['Brak POD','Sprawdź dokumenty','Odbiór oczekuje']},
 es:{all:'Todo',warnings:'Alertas',tasks:'Tareas',title:'Alertas operativas',none:'No hay alertas activas.',open:'Abrir lista de envíos',more:'Más envíos en la lista',intro:'Tareas personales y alertas de envío en un solo lugar.',type:['Falta POD','Revisar documentos','Recogida pendiente']},
 fr:{all:'Tout',warnings:'Alertes',tasks:'Tâches',title:'Alertes opérationnelles',none:'Aucune alerte active.',open:'Ouvrir les expéditions',more:'Autres expéditions dans la liste',intro:'Tâches personnelles et alertes d’expédition au même endroit.',type:['POD manquant','Vérifier les documents','Collecte en attente']},
 it:{all:'Tutte',warnings:'Avvisi',tasks:'Attività',title:'Avvisi operativi',none:'Nessun avviso attivo.',open:'Apri elenco spedizioni',more:'Altre spedizioni nell’elenco',intro:'Attività personali e avvisi sulle spedizioni in un unico punto.',type:['POD mancante','Controlla documenti','Ritiro in sospeso']}
};
function language(){var code='de';try{var a=w.ExportHUBI18n;if(a&&typeof a.language==='function')code=String(a.language()||'de').toLowerCase().slice(0,2)}catch(_){}return labels[code]?code:'de'}
function tr(){return labels[language()]}
function node(tag,cls,value){var el=d.createElement(tag);if(cls)el.className=cls;if(value!=null)el.textContent=String(value);return el}
function summary(){var s=w.__EXPORTHUB_WARNING_SUMMARY__||{},groups=Array.isArray(s.groups)?s.groups:[];return{total:groups.reduce(function(n,g){return n+Math.max(0,Number(g&&g.count)||0)},0),groups:groups}}
function styles(){
 if(d.getElementById('eh1872-style'))return;
 var style=node('style');style.id='eh1872-style';
 style.textContent='html[data-eh-layout] body[data-eh-layout] #rc885WarningButton,html[data-eh-layout] body[data-eh-layout] #rc885WarningDrawer,body #rc885WarningButton,body #rc885WarningDrawer{display:none!important;pointer-events:none!important}'+
 'html body:has(#rc885WarningButton) .topbar .eh-topbar-actions{padding-right:20px!important}'+
 '.eh1872{border:1px solid var(--border,#d7e1ed);border-radius:16px;background:var(--card,#fff);color:inherit;padding:14px 16px;margin:14px 0;min-width:0}'+
 '.eh1872-top{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin:0 0 12px}.eh1872-top strong{font-size:17px;font-weight:800}.eh1872-count{font-weight:800;display:inline-flex;min-width:27px;justify-content:center;border-radius:99px;background:#fef2f2;color:#991b1b;padding:3px 8px;margin-left:8px}'+
 '.eh1872-tabs{display:flex;flex-wrap:wrap;gap:6px}.eh1872-tabs button{border:1px solid #aebdcf;background:transparent;color:inherit;border-radius:9px;padding:8px 11px;cursor:pointer;font:inherit;font-weight:650}'+
 '.eh1872-tabs button[aria-selected="true"]{background:#155ea4;border-color:#155ea4;color:#fff}.eh1872-tabs button:focus-visible,.eh1872-link:focus-visible{outline:3px solid #e49a24;outline-offset:2px}'+
 '.eh1872-groups{display:grid;gap:10px}.eh1872-group{padding:12px;border-radius:12px;border:1px solid var(--border,#d7e1ed);background:var(--rc990-surface,#f8fafc)}'+
 '.eh1872-group-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}.eh1872-group-head strong{font-size:14px}.eh1872-group-head span{font-weight:800;color:#a01c1c}'+
 '.eh1872-list{display:grid;gap:6px}.eh1872-item{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;padding:8px 10px;border-radius:8px;background:var(--card,#fff);border:1px solid var(--border,#d7e1ed);font-size:13px}'+
 '.eh1872-item span{min-width:0;overflow-wrap:anywhere}.eh1872-item small{display:block;opacity:.75;margin-top:3px}.eh1872-link{border:1px solid #aebdcf;border-radius:8px;background:transparent;color:inherit;padding:6px 10px;cursor:pointer;font:inherit;font-size:12px;font-weight:750}'+
 '.eh1872-empty{font-size:13px;margin:4px 0;opacity:.75}.eh1872 [hidden],#index236NotificationCenter .eh1872-filter-hidden{display:none!important}'+
 '.eh1872-nav-warning{display:inline-flex;align-items:center;justify-content:center;margin-left:5px;border-radius:99px;background:#b91c1c;color:#fff;font-size:11px;font-weight:800;min-width:19px;padding:1px 5px}'+
 '@media(max-width:620px){.eh1872{padding:12px}.eh1872-tabs{width:100%}.eh1872-tabs button{flex:1}}';
 (d.head||d.documentElement).appendChild(style)
}
function navWarningIndicator(total){
 var target=d.querySelector('#nav [data-view="notifications"],#nav [data-index321-view="notifications"]');
 if(!target)return;
 var chip=target.querySelector('[data-eh1872-nav-warning]');
 if(total>0){
  if(!chip){chip=node('span','eh1872-nav-warning');chip.setAttribute('data-eh1872-nav-warning','1');target.appendChild(chip)}
  chip.textContent=total>99?'99+':String(total);
  chip.setAttribute('aria-label',total+' '+tr().warnings)
 }else if(chip)chip.remove();
}
function draw(){
 scheduled=false;styles();
 var s=summary(),l=tr();
 navWarningIndicator(s.total);
 if(s.total!==lastWarningCount){lastWarningCount=s.total;try{if(w.ExportHUBTopNavigation1820&&typeof w.ExportHUBTopNavigation1820.refresh==='function')w.ExportHUBTopNavigation1820.refresh()}catch(_){}}
 var c=d.getElementById('index236NotificationCenter');if(!c){center=null;section=null;lastSignature='';return}
 var headline=c.querySelector('.page-head p');
 if(headline&&/Warncenter|ausschließlich deine offenen Aufgaben/i.test(headline.textContent))headline.textContent=l.intro;
 var sig=language()+'|'+JSON.stringify(s.groups.map(function(g){return[g.label,g.count,(g.items||[]).map(function(i){return[i.title,i.sub]})]}));
 if(c===center&&section&&section.isConnected&&sig===lastSignature){applyFilter();return}
 center=c;lastSignature=sig;
 if(!section||!section.isConnected||!c.contains(section)){
  section=node('section','eh1872');section.id='eh1872UnifiedCenter';
  var anchor=c.querySelector('.index236-statusbar,.index236-metrics');
  if(anchor)c.insertBefore(section,anchor);else c.appendChild(section)
 }
 section.replaceChildren();
 var top=node('div','eh1872-top');
 var title=node('strong',null,l.title),count=node('span','eh1872-count',s.total);
 title.appendChild(count);top.appendChild(title);
 var tabs=node('div','eh1872-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label',l.all);
 [['all',l.all],['warnings',l.warnings],['tasks',l.tasks]].forEach(function(pair){
  var b=node('button',null,pair[1]);b.type='button';b.setAttribute('role','tab');b.setAttribute('data-eh1872-tab',pair[0]);b.setAttribute('aria-selected',pair[0]===tab?'true':'false');
  b.addEventListener('click',function(){tab=pair[0];applyFilter()});tabs.appendChild(b)
 });
 top.appendChild(tabs);section.appendChild(top);
 var content=node('div','eh1872-groups');content.setAttribute('data-eh1872-warning-content','1');
 var nonempty=s.groups.filter(function(g){return Number(g&&g.count)>0});
 if(!nonempty.length)content.appendChild(node('p','eh1872-empty',l.none));
 s.groups.forEach(function(g,index){
  if(!(Number(g&&g.count)>0))return;
  var group=node('div','eh1872-group'),head=node('div','eh1872-group-head');
  head.appendChild(node('strong',null,l.type[index]||g.label));
  head.appendChild(node('span',null,Math.max(0,Number(g.count)||0)));
  group.appendChild(head);
  var list=node('div','eh1872-list');
  var items=Array.isArray(g.items)?g.items:[];
  items.slice(0,60).forEach(function(item){
   var row=node('div','eh1872-item'),info=node('span'),name=node('strong',null,item.title||g.label);
   info.appendChild(name);if(item.sub)info.appendChild(node('small',null,item.sub));
   row.appendChild(info);
   var action=node('button','eh1872-link',l.open);
   action.type='button';action.setAttribute('data-rc885-route','shipmentoverview');
   row.appendChild(action);list.appendChild(row)
  });
  if(Number(g.count)>60){
   var more=node('button','eh1872-link',l.more+' ('+(Number(g.count)-60)+')');more.type='button';more.setAttribute('data-rc885-route','shipmentoverview');list.appendChild(more)
  }
  group.appendChild(list);content.appendChild(group)
 });
 section.appendChild(content);applyFilter()
}
function applyFilter(){
 if(!center||!section||!section.isConnected)return;
 section.querySelectorAll('[data-eh1872-tab]').forEach(function(b){var on=b.getAttribute('data-eh1872-tab')===tab;b.setAttribute('aria-selected',on?'true':'false');b.tabIndex=on?0:-1});
 var content=section.querySelector('[data-eh1872-warning-content]');if(content)content.hidden=tab==='tasks';
 // Personal tasks and their independent reminder history are never deleted.
 var head=center.querySelector('.index236-section-head');
 var taskSection=head&&head.closest('section');
 if(taskSection)taskSection.classList.toggle('eh1872-filter-hidden',tab==='warnings');
 var history=center.querySelector('.index236-history-card');
 if(history)history.classList.toggle('eh1872-filter-hidden',tab==='warnings')
}
function schedule(){if(scheduled)return;scheduled=true;(w.requestAnimationFrame||w.setTimeout)(draw,0)}
function watch(){
 var root=d.getElementById('content')||d.querySelector('main.main')||d.body;
 if(!root||root===observedRoot)return;
 if(rootObserver)rootObserver.disconnect();
 observedRoot=root;
 if(w.MutationObserver){rootObserver=new MutationObserver(schedule);rootObserver.observe(root,{childList:true,subtree:true})}
}
function boot(){styles();watch();draw()}
['exporthub:ready','exporthub:viewchange','exporthub:sync','exporthub:shipments-updated','exporthub:shipment-saved','exporthub:warnings-updated','exporthub:languagechange'].forEach(function(ev){w.addEventListener(ev,function(){watch();schedule()})});
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
w.ExportHUBUnifiedNotifications1872=Object.freeze({refresh:schedule,version:'RC1872'});
})(window,document);
