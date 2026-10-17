/* ExportHUB360 RC1558 – one-page dashboard overview (KPIs, today's pickups, attention list, own tasks). */
(function(w){
'use strict';
if(!w||w.__EXPORTHUB_RC1558_DASHBOARD_OVERVIEW__)return;
w.__EXPORTHUB_RC1558_DASHBOARD_OVERVIEW__=true;

var VERSION='RC1558';
var SECTION_ID='rc1558Overview';
var BODY_FLAG='data-rc1558-overview';
var MAX_TODAY=12;
var MAX_ATTENTION=6;
var MAX_TASKS=5;

function q(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function low(v){return q(v).toLowerCase()}
function arr(v){return Array.isArray(v)?v:[]}
function esc(v){return q(v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}

function currentLang(){
  try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.current==='function')return low(w.ExportHUBI18n.current())}catch(_){}
  try{return low(w.document&&w.document.documentElement&&w.document.documentElement.lang||'de')}catch(_){return'de'}
}
function t(key,vars){
  var text='';
  try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.t==='function'){var v=w.ExportHUBI18n.t(key);if(v&&v!==key)text=v}}catch(_){}
  if(!text)try{if(w.ExportHUBDashboardOverview1558I18n)text=w.ExportHUBDashboardOverview1558I18n.t(key,null,currentLang())}catch(_){}
  if(!text||text===key)text=key;
  if(vars)Object.keys(vars).forEach(function(k){text=text.split('{'+k+'}').join(String(vars[k]))});
  return text
}

/* Data access: the canonical predicates live in the RC885 workspace and are exported at build time. */
function workspace(){
  var api=w.ExportHUBWorkspace885;
  return api&&typeof api.shipmentOpenList==='function'&&typeof api.taskOpenList==='function'?api:null
}

function dateOf(v){
  var keys=['plannedPickupDate','pickupDate','plannedDate'];
  for(var i=0;i<keys.length;i++){var raw=v&&v[keys[i]];if(!raw)continue;var d=new Date(raw);if(!isNaN(d.getTime()))return d}
  return null
}
function dueOf(v){
  var keys=['dueAt','dueDate','due','date'];
  for(var i=0;i<keys.length;i++){var raw=v&&v[keys[i]];if(!raw)continue;var d=new Date(raw);if(!isNaN(d.getTime()))return d}
  return null
}
function dayKey(d){return d?d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'):''}
function hhmm(d){return d?String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'):''}
function statusOf(s){return q(s&&(s.status||s.state))}
function refOf(s){return q(s&&(s.ref||s.reference||s.shipmentRef||s.referenceNumber||s.id))}
function keyOf(s){return q(s&&(s.id||s.shipmentId||s.ref||s.reference||s.shipmentRef))}
function customerOf(s){return q(s&&(s.customerName||s.customer||s.customerNumber))}
function countryOf(s){return q(s&&(s.destinationCountry||s.country||s.countryCode)).toUpperCase()}
function colliOf(s){return arr(s&&s.rows).reduce(function(sum,row){var n=Number(row&&(row.count!=null?row.count:row.qty));return sum+(Number.isFinite(n)&&n>0?n:0)},0)}
function isCancelled(s){return /storniert|cancel/.test(low(statusOf(s)))}
function isPickedUp(s){return /abgeholt|pod vorhanden|abgeschlossen|archiviert/.test(low(statusOf(s)))}
function hasDeliveryNote(s){
  var names=arr(s&&(s.documents||s.docs||s.files)).concat(arr(s&&s.deliveryFiles)).map(function(d){return low(d&&(d.type||d.name||d.fileName||d))}).join(' ');
  return /lieferschein|delivery/.test(names)
}
function hasPod(s){return arr(s&&s.podFiles).length>0||/pod vorhanden/.test(low(statusOf(s)))}

/* tone: crit | warn | ok | info | neutral – drives the status pill */
function statusTone(status){
  var s=low(status);
  if(/wartet auf abd/.test(s))return'crit';
  if(/nachbearbeitung/.test(s))return'warn';
  if(/pod vorhanden|abgeschlossen|abgeholt/.test(s))return'ok';
  if(/bereit/.test(s))return'info';
  return'neutral'
}

function buildModel(api,shipments,now){
  now=now||new Date();
  var today=dayKey(now);
  var open=arr(api.shipmentOpenList());
  var openTasks=arr(api.taskOpenList());
  var dueTasks=openTasks.filter(api.dueTask);
  var lateTasks=dueTasks.filter(function(t){var d=dueOf(t);return d&&dayKey(d)<today});
  var todayList=arr(shipments).filter(function(s){var d=dateOf(s);return s&&!isCancelled(s)&&d&&dayKey(d)===today})
    .sort(function(a,b){return dateOf(a)-dateOf(b)});
  var todayDone=todayList.filter(isPickedUp).length;
  var waitingAbd=open.filter(function(s){return /wartet auf abd/.test(low(statusOf(s)))});
  var needsDocs=open.filter(api.shipmentNeedsDocuments);
  var needsPod=open.filter(api.shipmentNeedsPod);
  var readyForPickup=open.filter(function(s){return /bereit/.test(low(statusOf(s)))});

  var kpis=[
    {id:'today',value:todayList.length,sub:t('dashboard.overview.kpi.todaySub',{done:todayDone,open:todayList.length-todayDone}),tone:'neutral',route:'shipmentoverview'},
    {id:'open',value:open.length,sub:t('dashboard.overview.kpi.openSub',{ready:readyForPickup.length}),tone:'neutral',route:'shipmentoverview'},
    {id:'abd',value:waitingAbd.length,sub:t('dashboard.overview.kpi.abdSub'),tone:waitingAbd.length?'crit':'neutral',route:'shipmentoverview'},
    {id:'documents',value:needsDocs.length,sub:t('dashboard.overview.kpi.documentsSub'),tone:needsDocs.length?'warn':'neutral',route:'shipmentoverview'},
    {id:'pod',value:needsPod.length,sub:t('dashboard.overview.kpi.podSub'),tone:needsPod.length?'warn':'neutral',route:'shipmentoverview'},
    {id:'tasks',value:dueTasks.length,sub:t('dashboard.overview.kpi.tasksSub',{late:lateTasks.length}),tone:lateTasks.length?'warn':'neutral',route:'tasks'}
  ];

  var today_rows=todayList.slice(0,MAX_TODAY).map(function(s){
    return{key:keyOf(s),time:hhmm(dateOf(s)),ref:refOf(s),customer:customerOf(s),country:countryOf(s),colli:colliOf(s),deliveryNote:hasDeliveryNote(s),pod:hasPod(s),abd:/wartet auf abd/.test(low(statusOf(s))),status:statusOf(s),tone:statusTone(statusOf(s))}
  });

  var used=Object.create(null),attention=[];
  function push(list,tone,label){
    list.forEach(function(s){var k=keyOf(s)||refOf(s);if(!k||used[k])return;used[k]=1;attention.push({key:keyOf(s),ref:refOf(s),customer:customerOf(s),tone:tone,label:label})})
  }
  push(waitingAbd,'crit',t('dashboard.overview.attention.abd'));
  push(needsPod,'warn',t('dashboard.overview.attention.pod'));
  push(needsDocs,'warn',t('dashboard.overview.attention.documents'));

  var tasks=openTasks.slice().sort(function(a,b){var da=dueOf(a),db=dueOf(b);if(!da&&!db)return 0;if(!da)return 1;if(!db)return-1;return da-db}).slice(0,MAX_TASKS).map(function(task){
    var d=dueOf(task),k=d?dayKey(d):'';
    return{title:q(task&&(task.title||task.name||task.subject))||t('dashboard.overview.tasks.untitled'),due:d,late:!!k&&k<today,today:k===today}
  });

  return{kpis:kpis,today:today_rows,todayTotal:todayList.length,attention:attention.slice(0,MAX_ATTENTION),attentionTotal:attention.length,tasks:tasks,tasksTotal:openTasks.length}
}

function dueLabel(task){
  if(!task.due)return'';
  if(task.late)return t('dashboard.overview.tasks.late');
  if(task.today)return t('dashboard.overview.tasks.today');
  try{return task.due.toLocaleDateString(currentLang(),{day:'2-digit',month:'2-digit'})}catch(_){return dayKey(task.due)}
}

function statusLabel(status){
  var key='dashboard.overview.status.'+low(status).replace(/[^a-zäöüß]+/g,'-').replace(/^-|-$/g,'');
  var text=t(key);
  return text===key?status:text
}

/* 24px stroke icons, drawn in currentColor so every design colors them. */
var ICONS={
  today:'<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  open:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  abd:'<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M12 8v5M12 16v.5"/>',
  documents:'<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>',
  pod:'<path d="M4 17c3-1 4-5 6-5s1.5 4 3.5 4 2-3 3.5-3 2 1.5 3 2"/><path d="M4 21h16"/>',
  tasks:'<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
  check:'<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
  chevron:'<path d="M9 6l6 6-6 6"/>'
};
function icon(name,cls){return'<svg class="'+(cls||'rc1558-icon')+'" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+(ICONS[name]||'')+'</svg>'}

function isoWeek(d){
  var x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));var day=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-day);
  var y=new Date(Date.UTC(x.getUTCFullYear(),0,1));return Math.ceil(((x-y)/86400000+1)/7)
}
function firstName(name){name=q(name);if(!name)return'';return name.indexOf('@')>0?name.split('@')[0]:name.split(' ')[0]}
function headerHtml(meta){
  var now=meta&&meta.now||new Date(),hour=now.getHours();
  var key=hour<11?'morning':hour<17?'day':'evening',name=firstName(meta&&meta.userName);
  var date='';try{date=now.toLocaleDateString(currentLang(),{weekday:'long',day:'numeric',month:'long',year:'numeric'})}catch(_){date=dayKey(now)}
  return'<div class="rc1558-hello">'+
    // divs, not <p>: the design layer forces every <p> to the muted color with !important
    '<div class="rc1558-greeting" role="heading" aria-level="2">'+esc(t('dashboard.overview.greeting.'+key,{name:name}).replace(/,\s*$/,''))+'</div>'+
    '<div class="rc1558-date">'+esc(date)+' · '+esc(t('dashboard.overview.week',{week:isoWeek(now)}))+
      '<span class="rc1558-updated">'+esc(t('dashboard.overview.updated',{time:hhmm(now)}))+'</span></div>'+
  '</div>'
}

function emptyHtml(key){return'<p class="rc1558-empty">'+icon('check','rc1558-empty-icon')+'<span>'+esc(t(key))+'</span></p>'}

function renderHtml(model,meta){
  var kpis=model.kpis.map(function(k){
    return'<button type="button" class="rc1558-kpi" data-tone="'+k.tone+'"'+(k.value?'':' data-zero="1"')+' data-rc1558-route="'+esc(k.route)+'" data-rc1558-kpi="'+esc(k.id)+'">'+
      '<span class="rc1558-kpi-top"><span class="rc1558-kpi-label">'+esc(t('dashboard.overview.kpi.'+k.id))+'</span>'+icon(k.id)+'</span>'+
      '<strong class="rc1558-kpi-value">'+k.value+'</strong>'+
      '<span class="rc1558-kpi-sub">'+esc(k.sub)+'</span>'+
    '</button>'
  }).join('');

  var rows=model.today.map(function(r){
    var docs='<span class="rc1558-doc" data-ok="'+(r.deliveryNote?'1':'0')+'">'+esc(t('dashboard.overview.doc.deliveryNote'))+'</span>'+
      (r.abd?'<span class="rc1558-doc" data-ok="0">'+esc(t('dashboard.overview.doc.abd'))+'</span>':'')+
      (r.pod?'<span class="rc1558-doc" data-ok="1">'+esc(t('dashboard.overview.doc.pod'))+'</span>':'');
    // ARIA grid instead of <table>: the legacy RC913 status sync rewrites the text of every "#content tr td" that looks like a status.
    return'<div class="rc1558-tr" role="row" data-rc1558-shipment="'+esc(r.key)+'" tabindex="0">'+
      '<span role="cell" class="rc1558-time">'+esc(r.time||'–')+'</span>'+
      '<span role="cell" class="rc1558-ref">'+esc(r.ref)+'</span>'+
      '<span role="cell" class="rc1558-customer">'+esc(r.customer)+(r.country?' <span class="rc1558-country">'+esc(r.country)+'</span>':'')+'</span>'+
      '<span role="cell" class="rc1558-num">'+(r.colli||'–')+'</span>'+
      '<span role="cell" class="rc1558-docs">'+docs+'</span>'+
      '<span role="cell"><span class="rc1558-pill" data-tone="'+r.tone+'">'+esc(statusLabel(r.status))+'</span></span>'+
    '</div>'
  }).join('');
  var table=rows?
    '<div class="rc1558-tablewrap"><div class="rc1558-table" role="table" aria-label="'+esc(t('dashboard.overview.today.title'))+'">'+
      '<div role="rowgroup"><div class="rc1558-tr rc1558-thead" role="row">'+
        '<span role="columnheader">'+esc(t('dashboard.overview.col.time'))+'</span><span role="columnheader">'+esc(t('dashboard.overview.col.ref'))+'</span><span role="columnheader">'+esc(t('dashboard.overview.col.customer'))+'</span>'+
        '<span role="columnheader" class="rc1558-num">'+esc(t('dashboard.overview.col.colli'))+'</span><span role="columnheader">'+esc(t('dashboard.overview.col.documents'))+'</span><span role="columnheader">'+esc(t('dashboard.overview.col.status'))+'</span>'+
      '</div></div><div role="rowgroup">'+rows+'</div></div></div>'
    :emptyHtml('dashboard.overview.today.empty');

  var attention=model.attention.length?'<ul class="rc1558-list">'+model.attention.map(function(a){
    return'<li><span class="rc1558-sev" data-tone="'+a.tone+'"></span><button type="button" class="rc1558-item" data-rc1558-shipment="'+esc(a.key)+'">'+
      '<span class="rc1558-item-text"><b>'+esc(a.ref)+' · '+esc(a.label)+'</b><small>'+esc(a.customer)+'</small></span>'+icon('chevron','rc1558-chevron')+'</button></li>'
  }).join('')+'</ul>':emptyHtml('dashboard.overview.attention.empty');

  var tasks=model.tasks.length?'<ul class="rc1558-list">'+model.tasks.map(function(task){
    return'<li><span class="rc1558-sev" data-tone="'+(task.late?'crit':'info')+'"></span><span class="rc1558-task">'+esc(task.title)+'</span>'+
      '<span class="rc1558-due"'+(task.late?' data-late="1"':'')+'>'+esc(dueLabel(task))+'</span></li>'
  }).join('')+'</ul>':emptyHtml('dashboard.overview.tasks.empty');

  function head(titleKey,count,route,linkKey){
    return'<div class="rc1558-head"><h3>'+esc(t(titleKey))+'</h3>'+(count!=null?'<span class="rc1558-count">'+count+'</span>':'')+
      (route?'<button type="button" class="rc1558-link" data-rc1558-route="'+esc(route)+'">'+esc(t(linkKey))+'</button>':'')+'</div>'
  }

  return'<div class="rc1558-top">'+(meta?headerHtml(meta):'')+'<div class="rc1558-kpis">'+kpis+'</div></div>'+
    '<div class="rc1558-grid">'+
      '<section class="rc1558-panel rc1558-today">'+head('dashboard.overview.today.title',model.todayTotal,'shipmentoverview','dashboard.overview.today.link')+table+'</section>'+
      '<div class="rc1558-stack">'+
        '<section class="rc1558-panel">'+head('dashboard.overview.attention.title',model.attentionTotal,'shipmentoverview','dashboard.overview.attention.link')+attention+'</section>'+
        '<section class="rc1558-panel">'+head('dashboard.overview.tasks.title',model.tasksTotal,'tasks','dashboard.overview.tasks.link')+tasks+'</section>'+
      '</div>'+
    '</div>'
}

function getState(){
  try{if(typeof w.__EXPORTHUB_GET_STATE__==='function'){var s=w.__EXPORTHUB_GET_STATE__();if(s&&typeof s==='object')return s}}catch(_){}
  try{if(typeof w.state==='function'){var s2=w.state();if(s2&&typeof s2==='object')return s2}}catch(_){}
  return{}
}
function isDashboard(){
  var d=w.document;if(!d||!d.body)return false;
  var v=low(d.body.getAttribute('data-exporthub-view')||d.body.getAttribute('data-current-view'));
  return v==='dashboard'
}
function hostRoot(){
  var d=w.document;if(!d)return null;
  var content=d.getElementById('content');
  return content&&content.querySelector('.rc205-dashboard-grid')?content:null
}

function openShipment(key){
  key=q(key);if(!key)return false;
  try{if(w.ExportHUBShipmentView&&typeof w.ExportHUBShipmentView.open==='function')return w.ExportHUBShipmentView.open(key,'dashboard')}catch(_){}
  return route('shipmentoverview')
}
function route(view){
  // setView is the app's navigation entry point; route/RC885 are older fallbacks.
  try{if(typeof w.setView==='function'){w.setView(view);return true}}catch(_){}
  try{if(typeof w.route==='function'){w.route(view,'rc1558-overview');return true}}catch(_){}
  var api=workspace();
  try{if(api&&typeof api.routeTo==='function')return api.routeTo(view)}catch(_){}
  return false
}

function bind(section){
  if(!section||section.__rc1558Bound)return;section.__rc1558Bound=true;
  section.addEventListener('click',function(e){
    var target=e.target&&e.target.closest?e.target:null;if(!target)return;
    var r=target.closest('[data-rc1558-route]');if(r){e.preventDefault();route(r.getAttribute('data-rc1558-route'));return}
    var s=target.closest('[data-rc1558-shipment]');if(s){e.preventDefault();openShipment(s.getAttribute('data-rc1558-shipment'))}
  });
  section.addEventListener('keydown',function(e){
    if(e.key!=='Enter'&&e.key!==' ')return;var row=e.target&&e.target.matches&&e.target.matches('.rc1558-tr[data-rc1558-shipment]')?e.target:null;
    if(row){e.preventDefault();openShipment(row.getAttribute('data-rc1558-shipment'))}
  })
}

var lastHtml='';
function refresh(){
  var d=w.document,api=workspace(),root=hostRoot(),existing=d&&d.getElementById(SECTION_ID);
  if(!d||!api||!root||!isDashboard()){
    if(existing)existing.remove();
    if(d&&d.body)d.body.removeAttribute(BODY_FLAG);
    lastHtml='';
    return false
  }
  var state=getState(),user=state.currentUser||state.activeUser||{};
  var html=renderHtml(buildModel(api,arr(state.shipments)),{now:new Date(),userName:q(user.displayName||user.name||user.fullName||user.username||user.email)});
  var section=existing;
  if(!section||section.parentNode!==root){
    if(section)section.remove();
    section=d.createElement('section');section.id=SECTION_ID;section.setAttribute('aria-label',t('dashboard.overview.label'));
    var head=root.querySelector(':scope > .page-head');
    if(head&&head.nextSibling)root.insertBefore(section,head.nextSibling);else root.insertBefore(section,root.firstChild);
    lastHtml=''
  }
  if(html!==lastHtml){section.innerHTML=html;lastHtml=html}
  bind(section);
  d.body.setAttribute(BODY_FLAG,'1');
  return true
}

var scheduled=0;
function schedule(){
  if(scheduled)return;
  var raf=w.requestAnimationFrame||function(fn){return setTimeout(fn,16)};
  scheduled=raf(function(){scheduled=0;try{refresh()}catch(err){try{console.warn('RC1558 overview',err)}catch(_){}}})
}

function install(){
  if(typeof w.addEventListener!=='function')return;
  ['exporthub:ready','exporthub:viewchange','exporthub:rendered','exporthub:sync','exporthub:tasks-updated','exporthub:shipment-saved','exporthub:languagechange','exporthub:designchange','hashchange','popstate','pageshow'].forEach(function(name){w.addEventListener(name,schedule)});
  w.addEventListener('load',schedule);
  var d=w.document;if(!d)return;
  // #content can be created late or swapped (login, design switch) without an event we hear.
  // Watch whichever #content is current, and re-check cheaply every 1.5 s while the dashboard is visible.
  var observe=function(){
    var content=d.getElementById('content');if(!content||content.__rc1558Observed)return;content.__rc1558Observed=true;
    if(typeof w.MutationObserver==='function')new w.MutationObserver(function(){if(!d.getElementById(SECTION_ID)&&isDashboard())schedule()}).observe(content,{childList:true})
  };
  var check=function(){
    if(d.hidden)return;observe();
    if(isDashboard()&&!d.getElementById(SECTION_ID)&&hostRoot())schedule()
  };
  d.addEventListener('visibilitychange',check);
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',check);else check();
  setInterval(check,1500);
  // keep "updated hh:mm" and due labels current while the dashboard stays open
  setInterval(function(){if(!d.hidden&&d.getElementById(SECTION_ID))schedule()},60000);
  schedule()
}

w.ExportHUBDashboardOverview1558=Object.freeze({version:VERSION,buildModel:buildModel,renderHtml:renderHtml,statusTone:statusTone,isoWeek:isoWeek,refresh:refresh});
install();
})(typeof window!=='undefined'?window:globalThis);
