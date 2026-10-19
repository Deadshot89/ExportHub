/* ExportHUB360 RC1570 – task focus view: overdue and today first, rest of the week compact by work group,
   a real "new task" form and a working task detail view ("Aufgabenansicht").
   Data stays in state.tasks; completing uses the app's toggleTaskCard, saving uses the RC524 editor path. */
(function(w){
'use strict';
if(!w||w.__EXPORTHUB_RC1570_TASKS__)return;
w.__EXPORTHUB_RC1570_TASKS__=true;

var VERSION='RC1570';
var SECTION_ID='rc1570Tasks';
var BODY_FLAG='data-rc1570-tasks';
var SCOPE_KEY='exporthub.rc1570.scope';
var FILTER_KEY='exporthub.rc1570.filters';
var MAX_OVERDUE=12;
var WEEKDAYS=['sonntag','montag','dienstag','mittwoch','donnerstag','freitag','samstag'];

// texts live in assets/i18n/rc1570-tasks-focus.js (loaded first)
function packs(){var p=w.ExportHUBTasksFocus1570I18n;return p&&p.packs||{de:{}}}
function dayNames(l){var p=w.ExportHUBTasksFocus1570I18n,d=p&&p.days||{};return d[l]||d.de||['0','1','2','3','4','5','6']}

function q(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function low(v){return q(v).toLowerCase()}
function arr(v){return Array.isArray(v)?v:[]}
function esc(v){return q(v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function lang(){try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.language==='function'){var l=low(w.ExportHUBI18n.language());if(packs()[l])return l}}catch(_){}return'de'}
function t(key,vars){var all=packs(),pack=all[lang()]||all.de||{},text=pack[key]||(all.de||{})[key]||key;if(vars)Object.keys(vars).forEach(function(k){text=text.split('{'+k+'}').join(String(vars[k]))});return text}
function state(){try{if(typeof w.__EXPORTHUB_GET_STATE__==='function'){var s=w.__EXPORTHUB_GET_STATE__();if(s&&typeof s==='object')return s}}catch(_){}return{}}
function currentUser(){
  try{if(typeof w.__EXPORTHUB_GET_CURRENT_USER__==='function'){var u=w.__EXPORTHUB_GET_CURRENT_USER__();if(u)return u}}catch(_){}
  var s=state();return s.currentUser||s.activeUser||s.user||{}
}
function view(){var d=w.document;return d&&d.body?low(d.body.getAttribute('data-exporthub-view')||d.body.getAttribute('data-current-view')):''}
function canWrite(){try{return typeof w.canWrite!=='function'||w.canWrite('tasks')!==false}catch(_){return true}}

/* dates */
function dayKey(d){return d?d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'):''}
function atNoon(d){var x=new Date(d);x.setHours(12,0,0,0);return x}
function mondayOf(d){var x=atNoon(d),n=x.getDay()||7;x.setDate(x.getDate()-n+1);return x}
function isoWeekMonday(key){
  var m=q(key).match(/^(\d{4})-W(\d{1,2})$/);if(!m)return null;
  var jan4=new Date(Number(m[1]),0,4,12);var mon=mondayOf(jan4);mon.setDate(mon.getDate()+(Number(m[2])-1)*7);return mon
}
function parseDate(v){
  var s=q(v);if(!s)return null;
  var m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(m)return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12);
  m=s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);if(m)return new Date(Number(m[3]),Number(m[2])-1,Number(m[1]),12);
  if(/^\d{4}-\d{2}-\d{2}T/.test(s)){var d=new Date(s);if(!isNaN(d.getTime()))return atNoon(d)}
  return null
}
function taskDate(task){
  var keys=['dueAt','dueDate','plannedDate','plannedAt','date','targetDate','deadline'];
  for(var i=0;i<keys.length;i++){var d=parseDate(task&&task[keys[i]]);if(d)return d}
  // weekly plan tasks only carry a weekday; place them in the week they were created for
  var idx=WEEKDAYS.indexOf(low(task&&(task.day||task.originalDay||task.weekday)));
  if(idx<0)return null;
  var base=isoWeekMonday(task.weekKey||task.createdForWeek)||parseDate(task.sourceWeekStart);
  if(!base){
    // a weekly task without a plan week (created in this view) is due on its next weekday, never in the past
    var next=atNoon(new Date());next.setDate(next.getDate()+(idx-next.getDay()+7)%7);return next
  }
  var x=new Date(base);x.setDate(x.getDate()+((idx||7)-1));return x
}
function fmtDate(d){try{return d.toLocaleDateString(lang(),{weekday:'short',day:'2-digit',month:'2-digit'})}catch(_){return dayKey(d)}}
function dayName(d){return dayNames(lang())[d.getDay()]}

/* task fields */
function taskId(task){return q(task&&(task.id||task.taskId||task.uuid))}
function title(task){return q(task&&(task.title||task.name||task.subject))}
function isDone(task){return !!(task&&(task.done===true||task.completed===true))||/^(erledigt|done|abgeschlossen|completed|archiviert|storniert|cancelled|canceled)$/i.test(q(task&&task.status))}
function isTemplate(task){return !!(task&&(task.isTemplate||task.template||task.recurringTemplate||task.repeatTemplate||task.isRecurringTemplate))}
function area(task){return q(task&&(task.area||task.category||task.group))||t('other')}
function ownerName(task,users){
  var name=q(task&&task.assignedToName);if(name)return name;
  var raw=q(task&&(task.effectiveAssignee||task.owner||task.assignee||task.responsible));
  var hit=users.find(function(u){return low(u.id)===low(raw)||low(u.user||u.username||u.login)===low(raw)});
  return hit?q(hit.name||hit.displayName||hit.user):raw
}
function isMine(task){
  var u=currentUser(),ids=[u.id,u.userId].map(low).filter(Boolean),names=[u.name,u.displayName,u.user,u.login,u.username].map(low).filter(Boolean);
  var eff=low(task&&task.effectiveAssignee);
  var keys=eff?[eff]:[task&&task.owner,task&&task.assignee,task&&task.assigneeId,task&&task.assignedTo,task&&task.userId,task&&task.responsible,task&&task.assignedToName].map(low).filter(Boolean);
  if(!keys.length)return true;
  return keys.some(function(k){return k==='alle'||k==='all'||ids.indexOf(k)>=0||names.some(function(n){return k===n||(k.length>2&&n.length>2&&(n.indexOf(k)>=0||k.indexOf(n)>=0))})})
}
function priority(task){var p=q(task&&task.priority).toUpperCase();return /^P\d$/.test(p)?p:''}
function urgent(p){return /^P[0-2]$/.test(p)}
function priorityRank(task){var p=priority(task);return p?Number(p.slice(1)):5}
function isWeekly(task){return !!(task&&(task.masterTaskRC848||task.weeklySeriesId||task.seriesId||task.recurringSeriesId||/week|woch/i.test(q(task.recurrence))))}
function ref(task){return q(task&&(task.linkedShipmentRef||task.shipmentRef||task.sourceRef||task.reference))}

/* model */
var ui={search:'',scope:'',expanded:{},filters:null};
// filters (spec §13): customer, area, process, priority, status, owner and period combine with AND
var FILTERS=['customer','area','process','priority','status','owner','period'];
var PERIODS=['overdue','today','week','later','none'];
var STATUS_KEYS={open:'stOpen',planned:'stPlanned',in_progress:'stInProgress',waiting:'stWaiting',waiting_feedback:'stWaitingFeedback',blocked:'stBlocked'};
function readFilters(){
  if(ui.filters)return ui.filters;var f={};
  try{var raw=w.localStorage&&w.localStorage.getItem(FILTER_KEY);if(raw){var o=JSON.parse(raw);if(o&&typeof o==='object')FILTERS.forEach(function(k){if(typeof o[k]==='string'&&o[k])f[k]=o[k]})}}catch(_){}
  ui.filters=f;return f
}
function setFilter(key,value){var f=readFilters();if(FILTERS.indexOf(key)<0)return;if(q(value))f[key]=q(value);else delete f[key];try{w.localStorage.setItem(FILTER_KEY,JSON.stringify(f))}catch(_){}}
function resetFilters(){ui.filters={};try{w.localStorage.removeItem(FILTER_KEY)}catch(_){}}
function customer(task){return q(task&&(task.customerName||task.linkedCustomer||task.customer))}
function processOf(task){return q(task&&(task.processId||task.process))}
function priorityKey(task){return priority(task)||'P2'}
function statusKey(task){
  var core=w.ExportHUBTaskCoreV2;
  try{if(core&&typeof core.normalizeTask==='function'){var s=q(core.normalizeTask(task).status);if(s)return s}}catch(_){}
  var raw=low(task&&task.status).replace(/[\s-]+/g,'_');return STATUS_KEYS[raw]?raw:'open'
}
function filterValue(task,key,us){
  if(key==='customer')return customer(task);
  if(key==='area')return area(task);
  if(key==='process')return processOf(task);
  if(key==='priority')return priorityKey(task);
  if(key==='status')return statusKey(task);
  if(key==='owner')return ownerName(task,us);
  return''
}
function matchesFilters(task,filters,us){return FILTERS.every(function(k){return k==='period'||!filters[k]||filterValue(task,k,us)===filters[k]})}
function filterOptions(rows,us){
  var out={};
  FILTERS.forEach(function(k){if(k==='period')return;var seen={};rows.forEach(function(x){var v=filterValue(x,k,us);if(v)seen[v]=1});out[k]=Object.keys(seen).sort(function(a,b){return a.localeCompare(b)})});
  return out
}
function activeFilterCount(filters){return FILTERS.filter(function(k){return !!filters[k]}).length}
function readScope(){if(ui.scope)return ui.scope;try{ui.scope=w.localStorage&&w.localStorage.getItem(SCOPE_KEY)||''}catch(_){}return ui.scope||'mine'}
function users(){var s=state();return arr(s.users).concat(arr(s.userAccounts))}
function buildModel(now){
  now=now||new Date();
  var today=dayKey(now),weekEnd=new Date(mondayOf(now));weekEnd.setDate(weekEnd.getDate()+6);var weekEndKey=dayKey(weekEnd);
  var scope=readScope(),needle=low(ui.search),us=users();
  var all=arr(state().tasks).filter(function(x){return x&&!isTemplate(x)&&title(x)});
  var scoped=all.filter(function(x){return scope==='all'||isMine(x)});
  if(needle)scoped=scoped.filter(function(x){return low([title(x),area(x),q(x.group),ownerName(x,us),ref(x),q(x.note),customer(x)].join(' ')).indexOf(needle)>=0});
  var filters=readFilters(),options=filterOptions(scoped.filter(function(x){return !isDone(x)}),us);
  scoped=scoped.filter(function(x){return matchesFilters(x,filters,us)});
  var model={overdue:[],today:[],week:{},later:[],none:[],doneToday:[],total:0,scope:scope,users:us,filters:filters,filterOptions:options};
  scoped.forEach(function(x){
    var d=taskDate(x),k=d?dayKey(d):'';
    var row={task:x,id:taskId(x),date:d,key:k};
    if(isDone(x)){var at=parseDate(x.completedAt||x.doneAt);if(at&&dayKey(at)===today)model.doneToday.push(row);return}
    model.total++;
    if(!k)model.none.push(row);
    else if(k<today)model.overdue.push(row);
    else if(k===today)model.today.push(row);
    else if(k<=weekEndKey)(model.week[k]=model.week[k]||[]).push(row);
    else model.later.push(row)
  });
  var period=PERIODS.indexOf(filters.period)>=0?filters.period:'';
  if(period){
    if(period!=='overdue')model.overdue=[];if(period!=='today')model.today=[];if(period!=='week')model.week={};if(period!=='later')model.later=[];if(period!=='none')model.none=[];
    model.doneToday=[];
    model.total=model.overdue.length+model.today.length+model.later.length+model.none.length+Object.keys(model.week).reduce(function(n,k){return n+model.week[k].length},0)
  }
  var byUrgency=function(a,b){if(a.key!==b.key)return a.key<b.key?-1:1;var p=priorityRank(a.task)-priorityRank(b.task);if(p)return p;return q(a.task.time).localeCompare(q(b.task.time))};
  model.overdue.sort(byUrgency);model.today.sort(byUrgency);model.later.sort(byUrgency);
  return model
}
// work groups as in the old task list (RC874): same rules, same order
var GROUPS=['shipments','pod','customer','picks','abds'];
var GROUP_KEYS={shipments:'gShipments',pod:'gPod',customer:'gCustomer',picks:'gPicks',abds:'gAbds'};
function fold(v){return low(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
function workGroup(task){
  var x=task||{},a=fold(x.area||x.category||x.section||x.type),tt=fold(x.title||x.name),hay=fold([a,tt,x.note,x.source,x.recurringSource].join(' '));
  var ship=fold(x.shipmentStatus||x.linkedShipmentStatus||x.deliveryStatus);
  var pickedUp=!!(x.pickedUp===true||x.pickupConfirmed===true||x.pickedUpAt||x.pickupAt||x.abgeholtAt)||/abgeholt|picked up|pickedup/.test(ship);
  var hasPod=!!(x.pod===true||x.hasPod===true||x.podAvailable===true||x.podAt||x.podUrl||x.podFile||x.podDocument);
  if((/pod/.test(hay)||x.requiresPod===true)&&pickedUp&&!hasPod)return'pod';
  if(/abd|mrn|ausfuhr/.test(hay))return'abds';
  if(/^(picken|pick|heute picken)$/.test(a)||(a.indexOf('pick')>=0&&a.indexOf('pickup')<0)||/picken|pick/.test(tt))return'picks';
  if(/kunde.*angemeld|angemeld.*kunde|anmeld|avis|spedition|carrier/.test(hay))return'customer';
  return'shipments'
}
function byGroup(rows){
  var groups={};
  rows.forEach(function(r){var g=workGroup(r.task);(groups[g]=groups[g]||[]).push(r)});
  return GROUPS.filter(function(g){return groups[g]}).map(function(g){return{group:g,label:t(GROUP_KEYS[g]),rows:groups[g].sort(function(x,y){return priorityRank(x.task)-priorityRank(y.task)||q(x.task.time).localeCompare(q(y.task.time))})}})
}

/* render */
function card(r,opts){
  var x=r.task,p=priority(x),done=isDone(x),owner=ownerName(x,opts.users),rf=ref(x),meta=[];
  if(opts.showDate&&r.date)meta.push(t('due',{date:fmtDate(r.date)}));
  if(q(x.time))meta.push(esc(q(x.time)));
  if(opts.showOwner&&owner)meta.push(esc(owner));
  if(opts.showArea)meta.push(esc(area(x)));
  if(isWeekly(x))meta.push('↻ '+esc(t('weekly')));
  return'<li class="rc1570-card'+(done?' is-done':'')+(opts.late?' is-late':'')+'" data-rc1570-task="'+esc(r.id)+'">'+
    '<button type="button" class="rc1570-check" data-rc1570-toggle="'+esc(r.id)+'" aria-label="'+esc(done?t('reopen'):t('done'))+'" title="'+esc(done?t('reopen'):t('done'))+'"><span aria-hidden="true">'+(done?'✓':'')+'</span></button>'+
    '<div class="rc1570-card-main"><button type="button" class="rc1570-card-title" data-rc1570-open="'+esc(r.id)+'">'+esc(title(x))+'</button>'+
    '<div class="rc1570-card-meta">'+(urgent(p)?'<span class="rc1570-prio" data-p="'+esc(p)+'">'+esc(p)+'</span>':'')+meta.map(function(m){return'<span>'+m+'</span>'}).join('')+
    (rf?'<button type="button" class="rc1570-ref" data-rc1570-ref="'+esc(rf)+'">'+esc(rf)+'</button>':'')+'</div></div>'+
    '<button type="button" class="rc1570-edit" data-rc1570-edit="'+esc(r.id)+'" aria-label="'+esc(t('edit'))+'" title="'+esc(t('edit'))+'">✎</button></li>'
}
function cards(rows,opts){return'<ul class="rc1570-cards">'+rows.map(function(r){return card(r,opts)}).join('')+'</ul>'}
function groupBlocks(rows,opts){
  var o=Object.assign({},opts,{showArea:true});
  return byGroup(rows).map(function(g){return'<div class="rc1570-area" data-rc1570-group="'+g.group+'"><h4>'+esc(g.label)+' <span>'+g.rows.length+'</span></h4>'+cards(g.rows,o)+'</div>'}).join('')
}
function countLabel(n){return n===1?t('task'):t('tasks',{count:n})}
function section(id,label,count,body,tone,extra){
  return'<section class="rc1570-section" data-rc1570-section="'+id+'"'+(tone?' data-tone="'+tone+'"':'')+'><header><h3>'+esc(label)+'</h3><span class="rc1570-count">'+esc(countLabel(count))+'</span>'+(extra||'')+'</header>'+body+'</section>'
}
function filterLabel(key,value){
  if(key==='status')return STATUS_KEYS[value]?t(STATUS_KEYS[value]):value;
  if(key==='period')return t({overdue:'overdue',today:'today',week:'week',later:'later',none:'noDate'}[value]||value);
  return value
}
function filterSelect(key,values,current){
  if(current&&values.indexOf(current)<0)values=values.concat(current);
  return'<label class="rc1570-filter"><span>'+esc(t('filter_'+key))+'</span><select data-rc1570-filter="'+key+'"><option value="">'+esc(t('filterAll'))+'</option>'+
    values.map(function(v){return'<option value="'+esc(v)+'"'+(v===current?' selected':'')+'>'+esc(filterLabel(key,v))+'</option>'}).join('')+'</select></label>'
}
function filtersHtml(model){
  var f=model.filters||{},o=model.filterOptions||{},html='';
  ['customer','area','process','priority','status'].forEach(function(k){var vals=o[k]||[];if(vals.length||f[k])html+=filterSelect(k,vals,f[k]||'')});
  if(model.scope==='all'&&((o.owner||[]).length||f.owner))html+=filterSelect('owner',o.owner||[],f.owner||'');
  html+=filterSelect('period',PERIODS.slice(),f.period||'');
  var n=activeFilterCount(f);
  return'<div class="rc1570-filters" role="group" aria-label="'+esc(t('filters'))+'">'+html+(n?'<button type="button" class="ghost rc1570-filter-reset" data-rc1570-filter-reset="1">'+esc(t('filterReset',{count:n}))+'</button>':'')+'</div>'
}
function renderHtml(model,now){
  now=now||new Date();
  var showOwner=model.scope==='all',opts={users:model.users,showOwner:showOwner};
  var html='<div class="rc1570-head"><div><h2>✅ '+esc(t('title'))+'</h2></div><div class="rc1570-actions">'+
    '<button type="button" class="btn" data-rc1570-new="1">'+esc(t('newTask'))+'</button>'+
    '<button type="button" class="ghost" data-rc1570-route="planning">'+esc(t('planner'))+'</button></div></div>'+
    '<div class="rc1570-toolbar"><input type="search" class="rc1570-search" data-rc1570-search="1" placeholder="'+esc(t('search'))+'" value="'+esc(ui.search)+'">'+
    '<div class="rc1570-scope" role="group">'+['mine','all'].map(function(s){return'<button type="button" data-rc1570-scope="'+s+'" aria-pressed="'+(model.scope===s)+'">'+esc(t(s==='mine'?'scopeMine':'scopeAll'))+'</button>'}).join('')+'</div>'+
    '<div class="rc1570-chips">'+
      '<a href="#rc1570-overdue" class="rc1570-chip" data-tone="crit">'+esc(t('overdue'))+' <b>'+model.overdue.length+'</b></a>'+
      '<a href="#rc1570-today" class="rc1570-chip">'+esc(t('today'))+' <b>'+model.today.length+'</b></a>'+
      '<a href="#rc1570-week" class="rc1570-chip">'+esc(t('week'))+' <b>'+Object.keys(model.week).reduce(function(n,k){return n+model.week[k].length},0)+'</b></a>'+
      '<span class="rc1570-chip" data-tone="ok">'+esc(t('doneToday'))+' <b>'+model.doneToday.length+'</b></span></div></div>'+filtersHtml(model);
  var filtered=!!ui.search||activeFilterCount(model.filters||{})>0;
  if(!model.total&&!model.doneToday.length)return html+'<p class="rc1570-empty">'+esc(filtered?t('noMatch'):t('empty'))+'</p>';
  if(model.overdue.length){
    var expanded=!!ui.expanded.overdue,rows=expanded?model.overdue:model.overdue.slice(0,MAX_OVERDUE);
    var more=model.overdue.length>MAX_OVERDUE?'<button type="button" class="rc1570-more" data-rc1570-expand="overdue">'+esc(expanded?t('showLess'):t('showAll',{count:model.overdue.length}))+'</button>':'';
    html+='<a id="rc1570-overdue"></a>'+section('overdue',t('overdue'),model.overdue.length,cards(rows,{users:model.users,showOwner:showOwner,showDate:true,showArea:true,late:true})+more,'crit')
  }
  html+='<a id="rc1570-today"></a>'+section('today',t('today')+' · '+dayName(now)+' '+fmtDate(now).replace(/^[^,\s]+,?\s*/,''),model.today.length,
    model.today.length?groupBlocks(model.today,opts):'<p class="rc1570-empty">'+esc(t('emptyToday'))+'</p>');
  var days=Object.keys(model.week).sort();
  if(days.length){
    html+='<a id="rc1570-week"></a><section class="rc1570-section" data-rc1570-section="week"><header><h3>'+esc(t('week'))+'</h3></header>'+days.map(function(k){
      var rows=model.week[k],d=rows[0].date,open=!!ui.expanded['day:'+k];
      return'<details class="rc1570-day"'+(open?' open':'')+' data-rc1570-day="'+esc(k)+'"><summary><strong>'+esc(dayName(d))+'</strong> <span>'+esc(fmtDate(d))+'</span><span class="rc1570-count">'+esc(countLabel(rows.length))+'</span></summary>'+(open?groupBlocks(rows,opts):'')+'</details>'
    }).join('')+'</section>'
  }
  if(model.later.length)html+=section('later',t('later'),model.later.length,cards(model.later,{users:model.users,showOwner:showOwner,showDate:true,showArea:true}));
  if(model.none.length)html+=section('none',t('noDate'),model.none.length,groupBlocks(model.none,opts));
  if(model.doneToday.length)html+='<details class="rc1570-section rc1570-done"><summary><h3>'+esc(t('doneToday'))+'</h3><span class="rc1570-count">'+esc(countLabel(model.doneToday.length))+'</span></summary>'+cards(model.doneToday,{users:model.users,showOwner:showOwner})+'</details>';
  return html
}

/* actions */
function findTask(id){return arr(state().tasks).find(function(x){return taskId(x)===q(id)})||null}
function toggle(id){
  if(!canWrite()){alert(t('noRights'));return}
  try{if(typeof w.toggleTaskCard==='function')w.toggleTaskCard({preventDefault:function(){},stopPropagation:function(){}},id)}catch(err){try{console.warn('RC1570 toggle',err)}catch(_){}}
  lastHtml='';schedule()
}
function openDetail(id){
  var task=findTask(id),rt=w.ExportHUBRC1014TaskRuntime;if(!task)return;
  try{if(rt&&typeof rt.openTask==='function'){rt.openTask(task,{state:state()});return}}catch(err){try{console.warn('RC1570 open',err)}catch(_){}}
  edit(id)
}
function edit(id){try{if(typeof w.rc524OpenTaskEditor==='function')w.rc524OpenTaskEditor(id)}catch(_){}}
function openShipment(r){try{if(w.ExportHUBShipmentView&&typeof w.ExportHUBShipmentView.open==='function'){w.ExportHUBShipmentView.open(r,'tasks');return}}catch(_){}try{if(typeof w.setView==='function')w.setView('shipmentoverview')}catch(_){}}
function route(v){try{if(typeof w.setView==='function')w.setView(v)}catch(_){}}

/* new task form – saves through the RC524 editor (rights check, save, audit, render) */
function knownAreas(){var seen={};arr(state().tasks).forEach(function(x){var a=q(x&&(x.area||x.category));if(a)seen[a]=1});return Object.keys(seen).sort()}
function knownOwners(){
  var seen={},us=users();us.forEach(function(u){var n=q(u&&(u.name||u.displayName||u.user));if(n)seen[n]=1});
  arr(state().tasks).forEach(function(x){var n=ownerName(x,us);if(n&&!/^[A-Z0-9-]{6,}$/.test(n))seen[n]=1});
  var me=q(currentUser().name||currentUser().displayName||currentUser().user);if(me)seen[me]=1;
  return Object.keys(seen).sort()
}
function openForm(){
  var d=w.document;if(!d)return;
  if(!canWrite()){alert(t('noRights'));return}
  var old=d.getElementById('rc1570Form');if(old)old.remove();
  var me=q(currentUser().name||currentUser().displayName||currentUser().user),today=dayKey(new Date()),wd=new Date().getDay();
  var dlg=d.createElement('div');dlg.id='rc1570Form';dlg.className='rc1570-modal';
  dlg.innerHTML='<form class="rc1570-dialog" novalidate role="dialog" aria-modal="true" aria-labelledby="rc1570FormTitle"><h2 id="rc1570FormTitle">'+esc(t('formTitle'))+'</h2>'+
    '<label class="rc1570-field rc1570-wide"><span>'+esc(t('fTitle'))+'</span><input name="title" required maxlength="160" autocomplete="off"></label>'+
    '<label class="rc1570-field"><span>'+esc(t('fArea'))+'</span><input name="area" list="rc1570Areas" maxlength="60"><datalist id="rc1570Areas">'+knownAreas().map(function(a){return'<option value="'+esc(a)+'">'}).join('')+'</datalist></label>'+
    '<label class="rc1570-field"><span>'+esc(t('fOwner'))+'</span><input name="owner" list="rc1570Owners" maxlength="80" value="'+esc(me)+'"><datalist id="rc1570Owners">'+knownOwners().map(function(o){return'<option value="'+esc(o)+'">'}).join('')+'</datalist></label>'+
    '<fieldset class="rc1570-field rc1570-wide"><legend>'+esc(t('fWhen'))+'</legend><div class="rc1570-when">'+
      '<label><input type="radio" name="repeat" value="once" checked> '+esc(t('fOnce'))+'</label><input type="date" name="date" value="'+today+'">'+
      '<label><input type="radio" name="repeat" value="weekly"> '+esc(t('fWeekly'))+'</label><select name="weekday">'+[1,2,3,4,5,6,0].map(function(i){return'<option value="'+i+'"'+(i===wd?' selected':'')+'>'+esc(dayNames(lang())[i])+'</option>'}).join('')+'</select></div></fieldset>'+
    '<label class="rc1570-field"><span>'+esc(t('fTime'))+'</span><input type="time" name="time"></label>'+
    '<label class="rc1570-field"><span>'+esc(t('fPriority'))+'</span><select name="priority"><option value="P1">P1</option><option value="P2">P2</option><option value="Normal" selected>'+esc(t('pNormal'))+'</option><option value="P4">P4</option></select></label>'+
    '<label class="rc1570-field rc1570-wide"><span>'+esc(t('fRef'))+'</span><input name="ref" maxlength="40" autocomplete="off"></label>'+
    '<label class="rc1570-field rc1570-wide"><span>'+esc(t('fNote'))+'</span><textarea name="note" rows="3" maxlength="1000"></textarea></label>'+
    '<p class="rc1570-error" role="alert" hidden></p>'+
    '<div class="rc1570-form-actions"><button type="submit" class="btn">'+esc(t('save'))+'</button><button type="button" class="ghost" data-rc1570-cancel="1">'+esc(t('cancel'))+'</button></div></form>';
  d.body.appendChild(dlg);
  var form=dlg.querySelector('form'),first=form.querySelector('[name="title"]');if(first)first.focus();
  var close=function(){dlg.remove()};
  dlg.addEventListener('click',function(e){if(e.target===dlg||(e.target.closest&&e.target.closest('[data-rc1570-cancel]')))close()});
  dlg.addEventListener('keydown',function(e){if(e.key==='Escape')close()});
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var f=form.elements,err=form.querySelector('.rc1570-error'),name=q(f.title.value);
    if(!name){err.textContent=t('required');err.hidden=false;f.title.focus();return}
    var weekly=form.querySelector('[name="repeat"]:checked').value==='weekly';
    var day=weekly?dayNames('de')[Number(f.weekday.value)]:q(f.date.value);
    var created=saveTask({title:name,area:q(f.area.value)||'Manuell',owner:q(f.owner.value)||me,day:day,time:q(f.time.value),priority:q(f.priority.value),ref:q(f.ref.value),note:q(f.note.value)});
    if(created){close();lastHtml='';schedule()}
  })
}
function saveTask(v){
  var d=w.document;if(!d||typeof w.rc524OpenTaskEditor!=='function'||typeof w.rc524SaveTask!=='function')return false;
  var before={};arr(state().tasks).forEach(function(x){before[taskId(x)]=1});
  w.rc524OpenTaskEditor('');
  var set=function(id,val){var el=d.getElementById(id);if(el)el.value=val};
  set('rc524TaskTitle',v.title);set('rc524TaskOwner',v.owner);set('rc524TaskArea',v.area);set('rc524TaskDay',v.day);set('rc524TaskTime',v.time);set('rc524TaskPriority',v.priority);set('rc524TaskNote',v.note);
  var done=d.getElementById('rc524TaskDone');if(done)done.checked=false;
  w.rc524SaveTask();
  var modal=d.getElementById('rc524TaskModal');if(modal){modal.remove();return false}
  var created=arr(state().tasks).find(function(x){return !before[taskId(x)]});
  if(created){
    // mark as manual so roster cleanup never treats it as a shipment task; keep reference and author
    var patch={sourceType:'manual',createdAt:new Date().toISOString(),createdBy:q(currentUser().name||currentUser().user)};
    if(v.ref)patch.linkedShipmentRef=v.ref;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(v.day))patch.recurrence='weekly';else patch.dueDate=v.day;
    var rt=w.ExportHUBRC1014TaskRuntime;
    try{if(rt&&typeof rt.applyTaskPatch==='function')rt.applyTaskPatch(taskId(created),patch,{state:state()});else Object.assign(created,patch)}catch(_){Object.assign(created,patch)}
  }
  return true
}

/* mounting */
var lastHtml='';
function hostRoot(){var d=w.document;return d&&d.getElementById('content')}
function refresh(){
  var d=w.document;if(!d||!d.body)return;
  var v=view(),root=hostRoot();
  if(v==='taskdetail'&&root){
    // the menu entry and openTask() route here; the RC1152 detail renderer was never called by the router
    var rt=w.ExportHUBRC1014TaskRuntime;
    if(!d.getElementById('rc1152TaskDetail')&&rt&&typeof rt.renderTaskDetailView==='function'){
      var remembered=null;try{remembered=rt.rememberedTask&&rt.rememberedTask({state:state()})}catch(_){}
      if(remembered){try{rt.renderTaskDetailView(remembered,{state:state()})}catch(err){try{console.warn('RC1570 detail',err)}catch(_){}}}
      else route('tasks');
    }
    return
  }
  var existing=d.getElementById(SECTION_ID);
  if(v!=='tasks'||!root){if(existing)existing.remove();d.body.removeAttribute(BODY_FLAG);lastHtml='';return}
  var html=renderHtml(buildModel(new Date()),new Date());
  var section=existing;
  if(!section||section.parentNode!==root){
    if(section)section.remove();
    section=d.createElement('section');section.id=SECTION_ID;section.className='rc1570-tasks';root.insertBefore(section,root.firstChild);lastHtml='';bind(section)
  }
  if(html!==lastHtml){
    var active=d.activeElement,searching=active&&active.getAttribute&&active.getAttribute('data-rc1570-search'),pos=searching?active.selectionStart:0;
    section.innerHTML=html;lastHtml=html;
    if(searching){var s=section.querySelector('[data-rc1570-search]');if(s){s.focus();try{s.setSelectionRange(pos,pos)}catch(_){}}}
  }
  if(d.body.getAttribute(BODY_FLAG)!=='1')d.body.setAttribute(BODY_FLAG,'1')
}
function refreshNow(){try{refresh()}catch(err){try{console.warn('RC1570 tasks',err)}catch(_){}}}
var frame=0;
function schedule(){if(frame)return;var raf=w.requestAnimationFrame||function(fn){return setTimeout(fn,16)};frame=raf(function(){frame=0;refreshNow()})}
function bind(section){
  section.addEventListener('click',function(e){
    var el=e.target&&e.target.closest?e.target:null;if(!el)return;
    var b;
    if((b=el.closest('[data-rc1570-toggle]'))){e.preventDefault();toggle(b.getAttribute('data-rc1570-toggle'));return}
    if((b=el.closest('[data-rc1570-open]'))){e.preventDefault();openDetail(b.getAttribute('data-rc1570-open'));return}
    if((b=el.closest('[data-rc1570-edit]'))){e.preventDefault();edit(b.getAttribute('data-rc1570-edit'));return}
    if((b=el.closest('[data-rc1570-ref]'))){e.preventDefault();openShipment(b.getAttribute('data-rc1570-ref'));return}
    if((b=el.closest('[data-rc1570-new]'))){e.preventDefault();openForm();return}
    if((b=el.closest('[data-rc1570-route]'))){e.preventDefault();route(b.getAttribute('data-rc1570-route'));return}
    if((b=el.closest('[data-rc1570-scope]'))){e.preventDefault();ui.scope=b.getAttribute('data-rc1570-scope');try{w.localStorage.setItem(SCOPE_KEY,ui.scope)}catch(_){}refreshNow();return}
    if((b=el.closest('[data-rc1570-filter-reset]'))){e.preventDefault();resetFilters();refreshNow();return}
    if((b=el.closest('[data-rc1570-expand]'))){e.preventDefault();var k=b.getAttribute('data-rc1570-expand');ui.expanded[k]=!ui.expanded[k];refreshNow();return}
    if((b=el.closest('a[href^="#rc1570-"]'))){e.preventDefault();var target=w.document.getElementById(b.getAttribute('href').slice(1));if(target&&target.scrollIntoView)target.scrollIntoView({behavior:'smooth',block:'start'})}
  });
  section.addEventListener('toggle',function(e){var det=e.target;if(!det||!det.getAttribute)return;var k=det.getAttribute('data-rc1570-day');if(!k)return;ui.expanded['day:'+k]=det.open;if(det.open)refreshNow()},true);
  section.addEventListener('change',function(e){var k=e.target&&e.target.getAttribute&&e.target.getAttribute('data-rc1570-filter');if(!k)return;setFilter(k,e.target.value);refreshNow()});
  section.addEventListener('input',function(e){if(!e.target||!e.target.getAttribute||!e.target.getAttribute('data-rc1570-search'))return;ui.search=e.target.value;schedule()})
}
function install(){
  var d=w.document;if(!d)return;
  ['exporthub:ready','exporthub:viewchange','exporthub:rendered','exporthub:sync','exporthub:tasks-updated','exporthub:language-changed','exporthub:state-loaded'].forEach(function(n){try{w.addEventListener(n,schedule)}catch(_){}});
  var mount=function(){var v=view();if(v==='tasks'&&!d.getElementById(SECTION_ID))refreshNow();else if(v==='taskdetail'&&!d.getElementById('rc1152TaskDetail'))refreshNow();else if(v!=='tasks'&&d.body&&d.body.hasAttribute(BODY_FLAG))refreshNow()};
  var watch=function(){var c=d.getElementById('content');if(!c||c.__rc1570Observed||typeof w.MutationObserver!=='function')return;c.__rc1570Observed=true;new w.MutationObserver(mount).observe(c,{childList:true})};
  if(typeof w.MutationObserver==='function'&&d.body)new w.MutationObserver(function(){watch();mount()}).observe(d.body,{attributes:true,attributeFilter:['data-exporthub-view','data-current-view']});
  var check=function(){if(d.hidden)return;watch();mount()};
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',check);else check();
  setInterval(check,1500);
  // completed tasks from other tabs/devices: refresh the counts once a minute while the view is open
  setInterval(function(){if(!d.hidden&&view()==='tasks')schedule()},60000)
}

w.ExportHUBTasksFocus1570=Object.freeze({version:VERSION,buildModel:buildModel,renderHtml:renderHtml,setFilter:setFilter,resetFilters:resetFilters,taskDate:taskDate,isMine:isMine,workGroup:workGroup,refresh:refreshNow,openForm:openForm});
install();
})(window);
