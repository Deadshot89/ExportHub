/* ExportHUB360 RC1570 – task focus view: overdue and today first, rest of the week compact by work group,
   plus the "Aufgabenansicht" where tasks are viewed, edited and created (customer, customer number, reference …).
   Data stays in state.tasks; completing in the list uses the app's toggleTaskCard. */
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
  m=s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);if(m)return new Date(Number(m[3]),Number(m[2])-1,Number(m[1]),12);
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
function isWeekly(task){return !!(task&&((q(task.managedBy)==='RC1152'&&q(task.managedKind)==='recurring')||task.masterTaskRC848||task.weeklySeriesId||task.seriesId||task.recurringSeriesId||/week|woch/i.test(q(task.recurrence))))}
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
var GROUPS=['shipments','pod','av','customer','picks','abds','check','extra'];
var GROUP_LIMIT=6;
var GROUP_KEYS={shipments:'gShipments',pod:'gPod',av:'gAv',customer:'gCustomer',picks:'gPicks',abds:'gAbds',check:'gCheck',extra:'gExtra'};
function fold(v){return low(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
function workGroup(task){
  var x=task||{},a=fold(x.area||x.category||x.section||x.type),tt=fold(x.title||x.name),hay=fold([a,tt,x.note,x.source,x.recurringSource].join(' '));
  var ship=fold(x.shipmentStatus||x.linkedShipmentStatus||x.deliveryStatus);
  var pickedUp=!!(x.pickedUp===true||x.pickupConfirmed===true||x.pickedUpAt||x.pickupAt||x.abgeholtAt)||/abgeholt|picked up|pickedup/.test(ship);
  var hasPod=!!(x.pod===true||x.hasPod===true||x.podAvailable===true||x.podAt||x.podUrl||x.podFile||x.podDocument);
  if((/pod/.test(hay)||x.requiresPod===true)&&pickedUp&&!hasPod)return'pod';
  if(low(x.sourceType)==='av_missing'||/ausgangsvermerk|\bav\s+hochladen\b/.test(hay))return'av';
  if(/kontroll|pruf/.test(a))return'check';
  if(/zusatz|additional/.test(a))return'extra';
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
function groupBlocks(rows,opts,scope){
  var o=Object.assign({},opts,{showArea:true});
  return byGroup(rows).map(function(g){
    var key=(scope||'g')+':'+g.group,open=!!ui.expanded[key],shown=open?g.rows:g.rows.slice(0,GROUP_LIMIT);
    var more=g.rows.length>GROUP_LIMIT?'<button type="button" class="rc1570-more" data-rc1570-expand="'+esc(key)+'">'+esc(open?t('showLess'):t('showAll',{count:g.rows.length}))+'</button>':'';
    return'<div class="rc1570-area" data-rc1570-group="'+g.group+'"><h4>'+esc(g.label)+' <span>'+g.rows.length+'</span></h4>'+cards(shown,o)+more+'</div>'
  }).join('')
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
    model.today.length?groupBlocks(model.today,opts,'today'):'<p class="rc1570-empty">'+esc(t('emptyToday'))+'</p>');
  var days=Object.keys(model.week).sort();
  if(days.length){
    html+='<a id="rc1570-week"></a><section class="rc1570-section" data-rc1570-section="week"><header><h3>'+esc(t('week'))+'</h3></header>'+days.map(function(k){
      var rows=model.week[k],d=rows[0].date,open=!!ui.expanded['day:'+k];
      return'<details class="rc1570-day"'+(open?' open':'')+' data-rc1570-day="'+esc(k)+'"><summary><strong>'+esc(dayName(d))+'</strong> <span>'+esc(fmtDate(d))+'</span><span class="rc1570-count">'+esc(countLabel(rows.length))+'</span></summary>'+(open?groupBlocks(rows,opts):'')+'</details>'
    }).join('')+'</section>'
  }
  if(model.later.length)html+=section('later',t('later'),model.later.length,cards(model.later,{users:model.users,showOwner:showOwner,showDate:true,showArea:true}));
  if(model.none.length)html+=section('none',t('noDate'),model.none.length,groupBlocks(model.none,opts,'none'));
  if(model.doneToday.length)html+='<details class="rc1570-section rc1570-done"><summary><h3>'+esc(t('doneToday'))+'</h3><span class="rc1570-count">'+esc(countLabel(model.doneToday.length))+'</span></summary>'+cards(model.doneToday,{users:model.users,showOwner:showOwner})+'</details>';
  return html
}

/* actions */
function findTask(id){return arr(state().tasks).find(function(x){return taskId(x)===q(id)})||weeklyMasterTasks().find(function(x){return taskId(x)===q(id)})||null}
var pendingToggles=new Set();
async function toggle(id){
  if(!canWrite()){alert(t('noRights'));return}
  id=q(id);
  if(pendingToggles.has(id))return;
  var task=findTask(id),runtime=w.ExportHUBRC1014TaskRuntime;
  if(!task||!runtime||typeof runtime.setTaskStatus!=='function'){
    try{if(w.ExportHUBClean&&typeof w.ExportHUBClean.operationStatus==='function')w.ExportHUBClean.operationStatus(t('confirmUnavailable'),'bad')}catch(_){}
    return;
  }
  pendingToggles.add(id);
  try{
    var status=isDone(task)?'open':'done';
    await runtime.setTaskStatus(task,status,{state:state(),currentUser:currentUser()});
  }catch(err){
    try{if(w.ExportHUBClean&&typeof w.ExportHUBClean.operationStatus==='function')w.ExportHUBClean.operationStatus(t('saveFailed'),'bad')}catch(_){}
    try{console.error('RC1570 Aufgabenbestätigung nicht gespeichert',err)}catch(_){}
  }finally{
    pendingToggles.delete(id);
    lastHtml='';refreshNow();
  }
}
function openShipment(r){try{if(w.ExportHUBShipmentView&&typeof w.ExportHUBShipmentView.open==='function'){w.ExportHUBShipmentView.open(r,'tasks');return}}catch(_){}try{if(typeof w.setView==='function')w.setView('shipmentoverview')}catch(_){}}
function route(v){try{if(typeof w.setView==='function')w.setView(v)}catch(_){}}

/* Aufgabenansicht: list, detail, edit and create in one place (view "taskdetail").
   Saves straight into state.tasks; the server merges the changed fields into the stored task. */
var TV_ID='rc1570TaskView';
var TV_FLAG='data-rc1570-taskview';
var tv={mode:'',id:'',search:'',error:'',kind:'all',scope:'mine',moreCount:100};
function knownAreas(){var seen={};arr(state().tasks).forEach(function(x){var a=q(x&&(x.area||x.category));if(a)seen[a]=1});return Object.keys(seen).sort()}
function knownOwners(){
  var seen={},us=users();us.forEach(function(u){var n=q(u&&(u.name||u.displayName||u.user));if(n)seen[n]=1});
  arr(state().tasks).forEach(function(x){var n=ownerName(x,us);if(n&&!/^[A-Z0-9-]{6,}$/.test(n))seen[n]=1});
  var me=q(currentUser().name||currentUser().displayName||currentUser().user);if(me)seen[me]=1;
  return Object.keys(seen).sort()
}
function customers(){
  var seen={},out=[];
  arr(state().customers).forEach(function(c){var name=q(c&&(c.name||c.company||c.companyName)),no=q(c&&(c.customerNumber||c.account||c.accountNumber));if(!name||seen[low(name)])return;seen[low(name)]=1;out.push({name:name,no:no})});
  return out.sort(function(a,b){return a.name.localeCompare(b.name)})
}
function customerNo(task){return q(task&&(task.customerNumber||task.linkedAccount||task.customerAccount||task.account))}
function noteOf(task){return q(task&&(task.note||task.notes||task.comment||task.description))}
function isoDate(task){var d=parseDate(task&&(task.plannedDate||task.dueDate||task.dueAt||task.date||task.targetDate));return d&&!(isWeekly(task)&&!q(task.plannedDate||task.dueDate||task.dueAt))?dayKey(d):''}
function weekdayIndex(task){var i=WEEKDAYS.indexOf(low(task&&(task.day||task.originalDay||task.weekday)));return i}
function weeklyDays(task){
 var x=task||{},series=arr(state().taskSeries).find(function(s){return q(s&&s.id)===q(x.seriesId)});
 var stored=series&&series.rule&&series.rule.type==='weekly'?series.rule.weekdays:x.weekdays;
 var days=arr(stored).map(Number).filter(function(d){return Number.isInteger(d)&&d>=1&&d<=7}).map(function(d){return d===7?0:d});
 if(!days.length){var old=weekdayIndex(x);if(old>=0)days=[old]}
 return Array.from(new Set(days)).sort(function(a,b){return (a||7)-(b||7)})
}
function retireSeriesDays(s,id,days){
 var keep=new Set(days),today=dayKey(new Date());
 arr(s.tasks).forEach(function(row){
  if(q(row&&row.seriesId)!==id||!q(row.occurrenceKey).startsWith(id+'|'))return;
  var date=q(row.originalOccurrenceDate)||q(row.occurrenceKey).slice(id.length+1),day=parseDate(date),weekday=day?day.getDay()||7:0;
  if(!date||date<today||q(row.status)==='in_progress'||row.manualOverride===true)return;
  if(keep.has(weekday)){if(row.status==='cancelled'&&row.cancelReason==='rc1570_schedule_change'){row.status='planned';delete row.cancelReason;delete row.cancelledAt;row.updatedAt=new Date().toISOString();}return;}
  if(isDone(row))return;
  row.status='cancelled';row.cancelReason='rc1570_schedule_change';row.cancelledAt=new Date().toISOString();row.updatedAt=row.cancelledAt;
 })
}
function syncWeeklySeries(s,task,v){
 if(!Array.isArray(s.taskSeries))s.taskSeries=[];
 var id=q(task.seriesId)||'rc1570-series:'+taskId(task),index=s.taskSeries.findIndex(function(row){return q(row&&row.id)===id}),old=index>=0?s.taskSeries[index]:null;
 var days=Array.from(new Set(arr(v.weekdays).map(Number).filter(function(n){return Number.isInteger(n)&&n>=0&&n<=6}).map(function(n){return n||7}))).sort(function(a,b){return a-b});
 if(!days.length)return false;
 var template=Object.assign({},task);
 ['id','isTemplate','template','recurringTemplate','repeatTemplate','isRecurringTemplate','occurrenceKey','originalOccurrenceDate','completedAt','completedBy','doneAt','doneBy','createdAt','updatedAt','status','done','completed','history','dueAt','dueDate','plannedAt','plannedDate','date'].forEach(function(k){delete template[k]});
 template.sourceType='manual';template.isTemplate=false;template.recurrence='';
 var entry=Object.assign({},old||{},{id:id,title:task.title,area:task.area,owner:task.owner,customerName:task.customerName,priority:task.priority,
   startDate:q(old&&old.startDate)||dayKey(new Date()),dueTime:q(v.time)||'16:15',holidayPolicy:q(old&&old.holidayPolicy)||'manual_decision',
   rule:{type:'weekly',intervalWeeks:1,weekdays:days},task:template});
 if(index>=0)s.taskSeries[index]=entry;else s.taskSeries.push(entry);
 retireSeriesDays(s,id,days);
 task.seriesId=id;task.weekdays=days;if(!q(task.occurrenceKey))task.isTemplate=true;
 var engine=w.ExportHUBTaskRecurrenceV2,cal=engine&&typeof engine.calendar==='function'?engine.calendar(s.taskCalendar||{}):null;
 if(engine&&typeof engine.materialize==='function'&&cal){
   var until=new Date();until.setDate(until.getDate()+14);
   var output=engine.materialize({series:[entry],tasks:s.tasks,calendar:cal,now:new Date().toISOString(),range:{start:dayKey(new Date()),end:dayKey(until)}});
   if(output&&Array.isArray(output.tasks))s.tasks=output.tasks;
 }
 return true
}
function findUser(name){var n=low(name);if(!n)return null;return users().find(function(u){return [u.id,u.name,u.displayName,u.user,u.username,u.login].map(low).indexOf(n)>=0})||null}
function openTaskView(mode,id){tv.mode=mode;tv.id=q(id);tv.error='';try{var rt=w.ExportHUBRC1014TaskRuntime,task=id&&findTask(id);if(task&&rt&&typeof rt.rememberTaskDetail==='function')rt.rememberTaskDetail(task)}catch(_){}if(view()==='taskdetail'){lastView='';renderTaskView(true)}else route('taskdetail')}
function openDetail(id){if(!findTask(id))return;openTaskView('show',id)}
function edit(id){if(!findTask(id))return;if(!canWrite()){alert(t('noRights'));return}openTaskView('edit',id)}
function openForm(){if(!canWrite()){alert(t('noRights'));return}openTaskView('new','')}
function statusOf(task){var s=statusKey(task);return isDone(task)?'done':(s==='in_progress'?'in_progress':'open')}
var savePending=false;
async function persist(reason,id){
  // Queueing a change is not a confirmed server save.
  var clean=w.ExportHUBClean;
  if(!clean||typeof clean.queueSave!=='function'||typeof clean.flushSave!=='function')throw new Error('RC1570_TASK_STORAGE_UNAVAILABLE');
  var queued=await Promise.resolve(clean.queueSave(reason));
  if(queued===false)throw new Error('RC1570_TASK_QUEUE_REJECTED');
  var stored=await Promise.resolve(clean.flushSave(reason,{force:true,userInitiated:true}));
  if(stored!==true)throw new Error('RC1570_TASK_SAVE_NOT_CONFIRMED');
  try{w.dispatchEvent(new CustomEvent('exporthub:tasks-updated',{detail:{reason:reason,taskId:id}}))}catch(_){}
  return true
}
function setStatus(task,status){
  var now=new Date().toISOString(),me=q(currentUser().name||currentUser().user);
  if(status==='done'){task.status='done';task.done=true;task.completed=true;task.completedAt=now;task.doneAt=now;task.completedBy=me;task.doneBy=me}
  else{task.status=status==='in_progress'?'in_progress':'open';task.done=false;task.completed=false;task.completedAt='';task.doneAt='';task.completedBy='';task.doneBy='';if(status==='in_progress'&&!q(task.startedAt)){task.startedAt=now;task.startedBy=me}}
}
// form values -> task fields (all the aliases the planner, the list and the old views read)
function applyForm(task,v,isNew){
  var now=new Date().toISOString(),me=q(currentUser().name||currentUser().displayName||currentUser().user);
  task.title=v.title;task.name=v.title;
  task.area=v.area;task.category=v.area;
  if(v.owner&&(isNew||v.owner!==ownerName(task,users()))){var u=findUser(v.owner),key=u?q(u.id||u.user||u.name):v.owner;task.owner=u?q(u.name||u.displayName||u.user)||v.owner:v.owner;task.assignedToName=task.owner;task.assignedTo=key;task.assignee=key;task.originalAssignee=key;task.effectiveAssignee=key}
  if(v.weekly){
    var selected=arr(v.weekdays).length?v.weekdays:[Number.isInteger(Number(v.weekday))&&Number(v.weekday)>=0&&Number(v.weekday)<=6?Number(v.weekday):Math.max(0,weekdayIndex(task))];
    task.day=dayNames('de')[selected[0]];task.weekdays=selected.map(function(d){return Number(d)||7});task.recurrence='weekly';
    if(!q(task.occurrenceKey))['dueAt','dueDate','plannedDate','date','targetDate'].forEach(function(k){if(k in task)task[k]=''});
  }else{
    var before=isoDate(task);
    task.dueDate=v.date;task.plannedDate=v.date;task.date=v.date;task.targetDate=v.date;task.dueAt=v.date?(v.date+(v.time?'T'+v.time+':00':'')):'';
    var d=parseDate(v.date);if(d)task.day=dayNames('de')[d.getDay()];
    if(!isNew&&before&&v.date!==before&&(task.weekKey||task.masterTaskRC848)){task.manualMoved=true;task.plannerMoveReason=t('movedInView')}
    if(isNew)task.recurrence='';
  }
  task.time=v.time;task.priority=v.priority;
  task.customerName=v.customer;task.linkedCustomer=v.customer;
  // RC1650: a customer number links the task to shipments; weekly instances hand the newest value on to their series
  var autoDone=v.autoDone!==false;
  if(isNew||v.customerNo!==customerNo(task)||autoDone!==(task.autoDoneOnShipment!==false))task.customerNumberSetAt=now;
  task.customerNumber=v.customerNo;task.linkedAccount=v.customerNo;task.autoDoneOnShipment=autoDone;
  task.linkedShipmentRef=v.ref;task.note=v.note;
  if(isNew||statusOf(task)!==v.status)setStatus(task,v.status);
  task.updatedAt=now;task.updatedBy=me;
  task._syncUpdatedAt=now;task._syncDeviceId='manual-task-editor';
  return task
}
async function saveForm(form){
  if(savePending)return false;
  if(!canWrite()){alert(t('noRights'));return false}
  var f=form.elements,v={
    title:q(f.title.value),area:q(f.area.value),owner:q(f.owner.value),weekly:form.querySelector('[name="repeat"]:checked').value==='weekly',
    date:q(f.date.value),weekdays:Array.from(form.querySelectorAll('[name="weekdays"]:checked')).map(function(node){return Number(node.value)}),time:q(f.time.value),priority:q(f.priority.value),status:q(f.status.value)||'open',
    customer:q(f.customer.value),customerNo:q(f.customerNo.value),autoDone:f.autoDone?f.autoDone.checked:true,ref:q(f.ref.value),note:String(f.note.value||'').trim()
  };
  var showError=function(msg){tv.error=msg;tv.saved='';var feedback=form.querySelector('.rc1570-error');if(feedback){feedback.hidden=false;feedback.textContent=msg}};
  if(!v.title){showError(t('required'));return false}
  if(v.weekly&&!v.weekdays.length){showError(t('fWeekdaysRequired'));return false}
  if(!v.weekly&&v.date){var pd=parseDate(v.date);if(!pd||pd.getFullYear()<2000||pd.getFullYear()>2100){showError(t('badDate'));return false}v.date=dayKey(pd)}
  var s=state(),isNew=tv.mode==='new',originalTasks=s.tasks,originalSeries=s.taskSeries,originalLedger=s.taskStatusLedger;
  // Stage changes separately: failed server writes must not replace the live task list.
  var draft=Object.assign({},s,{
    tasks:arr(s.tasks).map(function(x){return x&&typeof x==='object'?Object.assign({},x):x}),
    taskSeries:arr(s.taskSeries).map(function(x){return x&&typeof x==='object'?Object.assign({},x):x})
  });
  var task=isNew?null:draft.tasks.find(function(x){return taskId(x)===tv.id});
  if(!isNew&&!task){showError(t('saveFailed'));return false}
  var button=form.querySelector('[type="submit"]');
  savePending=true;if(button)button.disabled=true;
  try{
    if(isNew){
      task={id:'task-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),sourceType:'manual',createdAt:new Date().toISOString(),createdBy:q(currentUser().name||currentUser().user)};
      if(!v.area)v.area=t('manualArea');if(!v.owner)v.owner=q(currentUser().name||currentUser().displayName||currentUser().user);
      draft.tasks.push(task);
    }
    var prior=isNew?null:arr(originalTasks).find(function(x){return taskId(x)===tv.id});
    applyForm(task,v,isNew);
    if(isNew||statusOf(prior)!==v.status){
      var now=task.updatedAt,user=q(currentUser().name||currentUser().user)||'Benutzer';
      var key='id:'+taskId(task).toLowerCase().replace(/\s+/g,' ').replace(/[^a-z0-9äöüß|:_-]+/gi,'');
      draft.taskStatusLedger=Object.assign({},s.taskStatusLedger||{});
      task.statusUpdatedAt=now;
      draft.taskStatusLedger[key]={status:v.status==='done'?'erledigt':'offen',done:v.status==='done',doneAt:v.status==='done'?now:'',doneBy:v.status==='done'?user:'',updatedAt:now};
    }
    if(v.weekly)syncWeeklySeries(draft,task,v);
    else if(q(task.seriesId).indexOf('rc1570-series:')===0){
      retireSeriesDays(draft,q(task.seriesId),[]);
      draft.taskSeries=arr(draft.taskSeries).filter(function(x){return q(x&&x.id)!==q(task.seriesId)});
      task.seriesId='';task.weekdays=[];task.isTemplate=false;task.recurrence='';
    }
    s.tasks=draft.tasks;s.taskSeries=draft.taskSeries;s.taskStatusLedger=draft.taskStatusLedger;
    await persist(isNew?'RC1570 task created':'RC1570 task saved',taskId(task));
    tv.mode='show';tv.id=taskId(task);tv.error='';tv.saved=isNew?t('saved'):t('updated');
    lastHtml='';lastView='';renderTaskView(true);
    var shown=w.document&&w.document.getElementById(TV_ID);
    if(shown&&shown.scrollIntoView)try{shown.scrollIntoView({block:'start'})}catch(_){}
    return true
  }catch(err){
    s.tasks=originalTasks;s.taskSeries=originalSeries;s.taskStatusLedger=originalLedger;
    showError(t('saveFailed'));
    try{if(w.ExportHUBClean&&typeof w.ExportHUBClean.operationStatus==='function')w.ExportHUBClean.operationStatus(t('saveFailed'),'bad')}catch(_){}
    try{console.error('RC1570 task form save rejected',err)}catch(_){}
    return false
  }finally{savePending=false;if(button)button.disabled=false}
}
async function changeTaskStatus(status){
  if(savePending||!canWrite())return false;
  var s=state(),originalTasks=s.tasks,originalLedger=s.taskStatusLedger,task=findTask(tv.id);
  if(!task)return false;
  var rows=arr(s.tasks).map(function(x){return x===task?Object.assign({},x):x});
  var target=rows.find(function(x){return taskId(x)===tv.id});
  var now=new Date().toISOString(),user=q(currentUser().name||currentUser().user)||'Benutzer';
  var key='id:'+tv.id.toLowerCase().replace(/\s+/g,' ').replace(/[^a-z0-9äöüß|:_-]+/gi,'');
  var ledger=Object.assign({},originalLedger||{});
  setStatus(target,status);
  target.updatedAt=now;target.statusUpdatedAt=now;target._syncUpdatedAt=now;target._syncDeviceId='manual-task-status';
  ledger[key]={status:status==='done'?'erledigt':'offen',done:status==='done',doneAt:status==='done'?now:'',doneBy:status==='done'?user:'',updatedAt:now};
  savePending=true;s.tasks=rows;s.taskStatusLedger=ledger;
  try{
    await persist('RC1570 task status changed',tv.id);
    tv.saved=t('updated');tv.error='';lastView='';renderTaskView(true);
    return true
  }catch(err){
    s.tasks=originalTasks;s.taskStatusLedger=originalLedger;tv.saved='';
    try{if(w.ExportHUBClean&&typeof w.ExportHUBClean.operationStatus==='function')w.ExportHUBClean.operationStatus(t('saveFailed'),'bad')}catch(_){}
    try{console.error('RC1570 task status save rejected',err)}catch(_){}
    lastView='';renderTaskView(true);
    return false
  }finally{savePending=false}
}

async function deleteManagedTask(id){
  if(savePending||!canWrite())return false;
  var s=state(),task=findTask(id);
  if(!task)return false;
  if(isSystemManagedTask(task)){
    if(typeof w.alert==='function')w.alert(t('managedByShipment'));
    return false;
  }
  var seriesId=q(task.seriesId),entireSeries=!!seriesId&&isWeekly(task);
  var message=t(entireSeries||managedKey?'confirmDeleteSeries':'confirmDeleteTask',{title:title(task)});
  if(typeof w.confirm==='function'&&!w.confirm(message))return false;
  var managedKey=q(task.managedBy)==='RC1152'?q(task.managedKey):'';
  var originals={tasks:s.tasks,series:s.taskSeries,meta:s._teamSyncMeta,disabled:s.taskManagedDisabled};
  var targets=arr(s.tasks).filter(function(row){return taskId(row)===q(id)||(entireSeries&&q(row&&row.seriesId)===seriesId)||(managedKey&&q(row&&row.managedBy)==='RC1152'&&q(row.managedKey)===managedKey)});
  var ids=new Set(targets.map(taskId).filter(Boolean));
  if(!ids.size&&!managedKey)return false;
  var now=new Date().toISOString(),user=q(currentUser().name||currentUser().displayName||currentUser().user)||'Benutzer';
  var deletedSeries=entireSeries?arr(s.taskSeries).filter(function(row){return q(row&&row.id)===seriesId}):[];
  var meta=Object.assign({fields:{},tombstones:[]},s._teamSyncMeta||{});
  var deletions=targets.map(function(row){return{collection:'tasks',id:taskId(row),deletedAt:now,deletedBy:user,explicitUserAction:true}});
  if(entireSeries&&deletedSeries.length)deletions.push({collection:'taskSeries',id:seriesId,deletedAt:now,deletedBy:user,explicitUserAction:true});
  var keys=new Set(deletions.map(function(row){return row.collection+':'+low(row.id)}));
  meta.tombstones=arr(meta.tombstones).filter(function(row){return row&&!keys.has(q(row.collection)+':'+low(row.id))}).concat(deletions);
  s.tasks=arr(s.tasks).filter(function(row){return !ids.has(taskId(row))});
  if(entireSeries)s.taskSeries=arr(s.taskSeries).filter(function(row){return q(row&&row.id)!==seriesId});
  if(managedKey){s.taskManagedDisabled=Object.assign({},s.taskManagedDisabled||{});s.taskManagedDisabled[managedKey]={disabledAt:now,disabledBy:user};}
  s._teamSyncMeta=meta;
  savePending=true;
  try{
    await persist('RC1570 task permanently deleted',q(id));
    tv.mode='list';tv.id='';tv.error='';tv.saved=t('taskDeleted');
    lastHtml='';lastView='';renderTaskView(true);
    return true;
  }catch(err){
    s.tasks=originals.tasks;s.taskSeries=originals.series;s._teamSyncMeta=originals.meta;s.taskManagedDisabled=originals.disabled;
    tv.error=t('deleteFailed');tv.saved='';
    if(typeof w.alert==='function')w.alert(t('deleteFailed'));
    try{console.error('RC1570 delete was not confirmed by server',err)}catch(_){}
    lastView='';renderTaskView(true);
    return false;
  }finally{savePending=false}
}

function field(label,html,wide){return'<label class="rc1570-field'+(wide?' rc1570-wide':'')+'"><span>'+esc(label)+'</span>'+html+'</label>'}
function formHtml(task){
  var x=task||{},me=q(currentUser().name||currentUser().displayName||currentUser().user),weekly=task?(low(x.recurrence)==='weekly'||(isWeekly(x)&&(!q(x.plannedDate||x.dueDate||x.dueAt)||arr(state().taskSeries).some(function(s){return q(s&&s.id)===q(x.seriesId)&&s.rule&&s.rule.type==='weekly'})))):false;
  var date=task?isoDate(x):dayKey(new Date()),selectedDays=task?weeklyDays(x):[new Date().getDay()],p=q(x.priority).toUpperCase(),st=task?statusOf(x):'open';
  var prios=['P0','P1','P2','P3','P4'];if(p&&!/^P\d$/.test(p))p='';
  return'<form class="rc1570-tv-form" novalidate data-rc1570-tv-form="1"><h2>'+esc(task?t('editTitle'):t('formTitle'))+'</h2>'+
    field(t('fTitle'),'<input name="title" required maxlength="160" autocomplete="off" value="'+esc(task?title(x):'')+'">',true)+
    field(t('fArea'),'<input name="area" list="rc1570Areas" maxlength="60" value="'+esc(task?q(x.area||x.category):'')+'"><datalist id="rc1570Areas">'+knownAreas().map(function(a){return'<option value="'+esc(a)+'">'}).join('')+'</datalist>')+
    field(t('fOwner'),'<input name="owner" list="rc1570Owners" maxlength="80" value="'+esc(task?ownerName(x,users()):me)+'"><datalist id="rc1570Owners">'+knownOwners().map(function(o){return'<option value="'+esc(o)+'">'}).join('')+'</datalist>')+
    '<fieldset class="rc1570-field rc1570-wide"><legend>'+esc(t('fWhen'))+'</legend><div class="rc1570-when">'+
      '<label><input type="radio" name="repeat" value="once"'+(weekly?'':' checked')+'> '+esc(t('fOnce'))+'</label><input type="date" name="date" value="'+esc(date)+'">'+
      '<label><input type="radio" name="repeat" value="weekly"'+(weekly?' checked':'')+'> '+esc(t('fWeekly'))+'</label><div class="rc1570-weekdays" role="group" aria-label="'+esc(t('fWeekdays'))+'">'+[1,2,3,4,5,6,0].map(function(i){return'<label class="rc1570-weekday"><input type="checkbox" name="weekdays" value="'+i+'"'+(selectedDays.indexOf(i)>=0?' checked':'')+'><span>'+esc(dayNames(lang())[i])+'</span></label>'}).join('')+'</div></div></fieldset>'+
    field(t('fTime'),'<input type="time" name="time" value="'+esc(q(x.time))+'">')+
    field(t('fPriority'),'<select name="priority"><option value="Normal"'+(p?'':' selected')+'>'+esc(t('pNormal'))+'</option>'+prios.map(function(v){return'<option value="'+v+'"'+(v===p?' selected':'')+'>'+v+'</option>'}).join('')+'</select>')+
    field(t('fStatus'),'<select name="status">'+['open','in_progress','done'].map(function(v){return'<option value="'+v+'"'+(v===st?' selected':'')+'>'+esc(t({open:'stOpen',in_progress:'stInProgress',done:'done'}[v]))+'</option>'}).join('')+'</select>')+
    field(t('fCustomer'),'<input name="customer" list="rc1570Customers" maxlength="120" autocomplete="off" value="'+esc(task?customer(x):'')+'"><datalist id="rc1570Customers">'+customers().map(function(c){return'<option value="'+esc(c.name)+'">'+esc(c.no)+'</option>'}).join('')+'</datalist>')+
    field(t('fCustomerNo'),'<input name="customerNo" maxlength="120" autocomplete="off" value="'+esc(task?customerNo(x):'')+'">')+
    '<label class="rc1570-field rc1570-wide rc1570-autodone"><span><input type="checkbox" name="autoDone"'+(x.autoDoneOnShipment===false?'':' checked')+'> '+esc(t('fAutoDone'))+'</span><small>'+esc(t('fAutoDoneHint'))+'</small></label>'+
    field(t('fRef'),'<input name="ref" maxlength="40" autocomplete="off" value="'+esc(task?ref(x):'')+'">',true)+
    field(t('fNote'),'<textarea name="note" rows="4" maxlength="2000">'+esc(task?noteOf(x):'')+'</textarea>',true)+
    '<p class="rc1570-error" role="alert"'+(tv.error?'':' hidden')+'>'+esc(tv.error)+'</p>'+
    '<div class="rc1570-form-actions"><button type="submit" class="btn">'+esc(task?t('saveChanges'):t('save'))+'</button><button type="button" class="ghost" data-rc1570-tv="cancel">'+esc(t('cancel'))+'</button></div></form>'
}
function detailHtml(task){
  var x=task,us=users(),d=taskDate(x),st=statusOf(x),rf=ref(x),days=weeklyDays(x),rows=[
    [t('fArea'),q(x.area||x.category)||area(x)],[t('fOwner'),ownerName(x,us)],
    [t('fDue'),isWeekly(x)&&days.length?'↻ '+days.map(function(i){return dayNames(lang())[i]}).join(' + '):(d?fmtDate(d):t('noDate'))],[t('fTimeShort'),q(x.time)],
    [t('fPriority'),priority(x)||t('pNormal')],[t('filter_customer'),customer(x)],[t('fCustomerNoShort'),customerNo(x)],[t('fRefShort'),rf]
  ];
  if(q(x.doneByShipmentRef))rows.push([t('fDoneByShipment'),q(x.doneByShipmentRef)]);
  else if(customerNo(x)&&!isDone(x)&&x.autoDoneOnShipment!==false)rows.push([t('fAutoDoneShort'),t('autoDoneOn')]);
  return'<article class="rc1570-tv-detail" data-rc1570-tv-task="'+esc(taskId(x))+'"><header><div><span class="rc1570-tv-eyebrow">'+esc(area(x))+'</span><h2>'+esc(title(x))+'</h2></div><span class="rc1570-tv-status" data-status="'+st+'">'+esc(t({open:'stOpen',in_progress:'stInProgress',done:'done'}[st]))+'</span></header>'+
    (tv.saved?'<p class="rc1570-tv-saved" role="status">'+esc(tv.saved)+'</p>':'')+
    '<dl>'+rows.map(function(r){return'<div><dt>'+esc(r[0])+'</dt><dd>'+(q(r[1])?esc(r[1]):'<span class="rc1570-tv-empty">–</span>')+'</dd></div>'}).join('')+'</dl>'+
    (noteOf(x)?'<section class="rc1570-tv-note"><h3>'+esc(t('fNote'))+'</h3><p>'+esc(noteOf(x))+'</p></section>':'')+
    '<footer class="rc1570-form-actions">'+(canWrite()?'<button type="button" class="btn" data-rc1570-tv="edit">'+esc(t('edit'))+'</button>'+
      ['open','in_progress','done'].filter(function(s){return s!==st}).map(function(s){return'<button type="button" class="ghost" data-rc1570-tv-status="'+s+'">'+esc(t({open:'markOpen',in_progress:'markInProgress',done:'markDone'}[s]))+'</button>'}).join(''):'')+
      (rf?'<button type="button" class="ghost" data-rc1570-ref="'+esc(rf)+'">'+esc(t('openShipment'))+'</button>':'')+
      (!isSystemManagedTask(x)&&canWrite()?'<button type="button" class="ghost rc1570-tv-delete-action" data-rc1570-tv-delete="'+esc(taskId(x))+'">'+esc(t('deleteTask'))+'</button>':'')+
      (isSystemManagedTask(x)?'<span class="rc1570-tv-managed-hint">'+esc(t('managedByShipment'))+'</span>':'')+'</footer></article>'
}
function weeklyMasterTasks(){
  var runtime=w.ExportHUBRC1014TaskRuntime,u=currentUser(),s=state();
  if(!runtime||typeof runtime.managedTaskPlanItems!=='function')return[];
  var entries=[];
  try{entries=runtime.managedTaskPlanItems({state:s,currentUser:u,currentUserId:q(u.id||u.userId||u.user||u.username||u.login||u.name),now:new Date()})||[]}catch(_){return[]}
  return arr(entries).filter(function(item){return item&&q(item.key)&&q(item.title)}).map(function(item){
    return{id:'managed:template:'+q(item.key),title:q(item.title),name:q(item.title),area:q(item.group),group:q(item.group),
      sourceType:'manual',managedBy:'RC1152',managedKey:q(item.key),managedKind:item.referenceArea?'reference-area':'recurring',
      recurrence:'weekly',weekdays:arr(item.weekdays).slice(),time:q(item.dueTime),description:q(item.description),
      owner:q(u.name||u.displayName||u.user||u.login||u.id),isVirtualTaskMaster:true}
  })
}
function managedRows(){
  var today=dayKey(new Date()),us=users(),rows=arr(state().tasks).concat(weeklyMasterTasks()).filter(function(x){
    return x&&title(x)&&(!isTemplate(x)||(low(x.sourceType)==='manual'&&q(x.seriesId).indexOf('rc1570-series:')===0))
  });
  if(tv.scope==='mine')rows=rows.filter(isMine);
  var counters={all:rows.length,overdue:0,weekly:0,once:0,done:0};
  rows.forEach(function(x){
    if(isDone(x))counters.done++;
    if(isWeekly(x))counters.weekly++;else counters.once++;
    var d=taskDate(x);if(!isDone(x)&&d&&dayKey(d)<today)counters.overdue++;
  });
  if(tv.kind==='done')rows=rows.filter(isDone);
  else if(tv.kind==='overdue')rows=rows.filter(function(x){var d=taskDate(x);return !isDone(x)&&d&&dayKey(d)<today});
  else if(tv.kind==='weekly')rows=rows.filter(isWeekly);
  else if(tv.kind==='once')rows=rows.filter(function(x){return !isWeekly(x)});
  var needle=low(tv.search);
  if(needle)rows=rows.filter(function(x){return low([title(x),area(x),ownerName(x,us),ref(x),customer(x),customerNo(x)].join(' ')).indexOf(needle)>=0});
  rows.sort(function(a,b){
    var ad=taskDate(a),bd=taskDate(b),ak=ad?dayKey(ad):'9999',bk=bd?dayKey(bd):'9999',ao=isDone(a),bo=isDone(b);
    if(ao!==bo)return ao?1:-1;
    if(ak!==bk)return ak<bk?-1:1;
    return title(a).localeCompare(title(b))
  });
  return{rows:rows,counts:counters,users:us,today:today}
}
function isSystemManagedTask(x){
  if(x&&(x.masterTaskRC848||x.masterTaskRC846))return true;
  if(isWeekly(x)&&!q(x&&x.seriesId)&&q(x&&x.managedBy)!=='RC1152')return true;
  if(low(x&&x.sourceType)==='manual'&&!/^(m848:|task:av-missing:)/i.test(taskId(x)))return false;
  if(/^(m848:|task:av-missing:)/i.test(taskId(x)))return true;
  var source=low(x&&x.sourceType);
  if(source&&source!=='user'&&source!=='custom')return true;
  return ['Fehlende POD','Offene Sendungen','Offene ABDs'].indexOf(q(x&&x.group))>=0
}
function listHtml(){
  var model=managedRows(),rows=model.rows,us=model.users,counts=model.counts,shown=rows.slice(0,tv.moreCount);
  var tabs=['all','overdue','weekly','once','done'],keys={all:'managerAll',overdue:'overdue',weekly:'managerWeekly',once:'managerOnce',done:'done'};
  return'<aside class="rc1570-tv-list">'+
    '<input type="search" class="rc1570-search" data-rc1570-tv-search="1" placeholder="'+esc(t('search'))+'" value="'+esc(tv.search)+'">'+
    '<div class="rc1570-tv-scope rc1570-scope" role="group">'+['mine','all'].map(function(scope){return'<button type="button" data-rc1570-tv-scope="'+scope+'" aria-pressed="'+(tv.scope===scope)+'">'+esc(t(scope==='mine'?'scopeMine':'scopeAll'))+'</button>'}).join('')+'</div>'+
    '<div class="rc1570-tv-kind" role="group" aria-label="'+esc(t('managerFilter'))+'">'+tabs.map(function(kind){return'<button type="button" data-rc1570-tv-kind="'+kind+'" aria-pressed="'+(tv.kind===kind)+'">'+esc(t(keys[kind]))+' <strong>'+counts[kind]+'</strong></button>'}).join('')+'</div>'+
    '<p class="rc1570-tv-hint">'+esc(t('managerCount',{count:rows.length}))+'</p>'+
    '<ul>'+shown.map(function(x){
      var id=taskId(x),d=taskDate(x),weekly=isWeekly(x),done=isDone(x),late=!done&&d&&dayKey(d)<model.today,system=isSystemManagedTask(x);
      return'<li class="rc1570-tv-row"'+(late?' data-late="true"':'')+'><button type="button" data-rc1570-tv-open="'+esc(id)+'"'+(id===tv.id?' aria-current="true"':'')+'>'+
        '<strong>'+esc(title(x))+'</strong><span>'+esc([late?t('overdue'):'',weekly?t('managerWeekly'):t('managerOnce'),d?fmtDate(d):t('noDate'),done?t('done'):'',ownerName(x,us),ref(x)].filter(Boolean).join(' · '))+'</span>'+
        '</button>'+(canWrite()&&!system?'<button type="button" class="rc1570-tv-delete" data-rc1570-tv-delete="'+esc(id)+'" aria-label="'+esc(t('deleteTask'))+'" title="'+esc(t('deleteTask'))+'">×</button>':'')+'</li>'
    }).join('')+'</ul>'+
    (rows.length>shown.length?'<button type="button" class="ghost rc1570-tv-more" data-rc1570-tv-more="1">'+esc(t('managerMore',{count:rows.length-shown.length}))+'</button>':'')+
    '</aside>'
}
function taskViewHtml(){
  var task=tv.id?findTask(tv.id):null;
  if((tv.mode==='show'||tv.mode==='edit')&&!task)tv.mode='list';
  var main=tv.mode==='new'?formHtml(null):tv.mode==='edit'?formHtml(task):tv.mode==='show'?detailHtml(task):'<div class="rc1570-tv-pick"><p>'+esc(t('pickTask'))+'</p></div>';
  return'<div class="rc1570-head"><div><span class="rc1570-tv-eyebrow">'+esc(t('title'))+'</span><h2>'+esc(t('viewTitle'))+'</h2></div><div class="rc1570-actions">'+
    (canWrite()?'<button type="button" class="btn" data-rc1570-tv="new">'+esc(t('newTask'))+'</button>':'')+
    '<button type="button" class="ghost" data-rc1570-route="tasks">'+esc(t('toList'))+'</button></div></div>'+
    '<div class="rc1570-tv-grid">'+listHtml()+'<div class="rc1570-tv-main">'+main+'</div></div>'
}
var lastView='';
function renderTaskView(force){
  var d=w.document,root=hostRoot();if(!d||!root)return;
  var panel=d.getElementById(TV_ID);
  if(!panel||panel.parentNode!==root){
    if(panel)panel.remove();
    // the router has no own renderer for this view; whatever it left behind is hidden by the flag
    panel=d.createElement('section');panel.id=TV_ID;panel.className='rc1570-tasks rc1570-taskview';panel.setAttribute('data-rc1306-own-layout','1');root.insertBefore(panel,root.firstChild);lastView='';bindTaskView(panel)
  }
  if(!tv.mode){
    var rt=w.ExportHUBRC1014TaskRuntime,remembered=null;try{remembered=rt&&rt.rememberedTask&&rt.rememberedTask({state:state()})}catch(_){}
    tv.mode=remembered?'show':'list';tv.id=remembered?taskId(remembered):''
  }
  var active=d.activeElement;
  if(!force&&lastView&&(tv.mode==='edit'||tv.mode==='new'))return; // background refreshes never replace an open form
  var html=taskViewHtml();
  if(html!==lastView){
    var searching=active&&active.getAttribute&&active.getAttribute('data-rc1570-tv-search'),pos=searching?active.selectionStart:0;
    panel.innerHTML=html;lastView=html;
    if(searching){var s=panel.querySelector('[data-rc1570-tv-search]');if(s){s.focus();try{s.setSelectionRange(pos,pos)}catch(_){}}}
    else if(tv.mode==='new'||tv.error){var first=panel.querySelector('[name="title"]');if(first)first.focus()}
  }
  if(d.body.getAttribute(TV_FLAG)!=='1')d.body.setAttribute(TV_FLAG,'1')
}
// searching only swaps the list, so an open form keeps what was typed
function refreshList(panel){
  var aside=panel.querySelector('.rc1570-tv-list'),tmp=w.document.createElement('div');if(!aside)return;
  tmp.innerHTML=listHtml();var next=tmp.firstChild;
  ['.rc1570-tv-scope','.rc1570-tv-kind','.rc1570-tv-hint','ul','.rc1570-tv-more'].forEach(function(sel){var o=aside.querySelector(sel),n=next.querySelector(sel);if(o&&n)o.replaceWith(n);else if(o&&!n)o.remove();else if(n&&!o)aside.appendChild(n)});
  lastView=taskViewHtml()
}
function bindTaskView(panel){
  panel.addEventListener('click',function(e){
    if(savePending){e.preventDefault();return}
    var el=e.target&&e.target.closest?e.target:null;if(!el)return;var b;
    if((b=el.closest('[data-rc1570-tv-delete]'))){e.preventDefault();deleteManagedTask(b.getAttribute('data-rc1570-tv-delete'));return}
    if((b=el.closest('[data-rc1570-tv-kind]'))){e.preventDefault();tv.kind=b.getAttribute('data-rc1570-tv-kind');tv.moreCount=100;lastView='';renderTaskView(true);return}
    if((b=el.closest('[data-rc1570-tv-scope]'))){e.preventDefault();tv.scope=b.getAttribute('data-rc1570-tv-scope')==='all'?'all':'mine';tv.moreCount=100;lastView='';renderTaskView(true);return}
    if((b=el.closest('[data-rc1570-tv-more]'))){e.preventDefault();tv.moreCount+=100;lastView='';renderTaskView(true);return}
    if((b=el.closest('[data-rc1570-tv-open]'))){e.preventDefault();tv.saved='';openTaskView('show',b.getAttribute('data-rc1570-tv-open'));return}
    if((b=el.closest('[data-rc1570-tv-status]'))){e.preventDefault();changeTaskStatus(b.getAttribute('data-rc1570-tv-status'));return}
    if((b=el.closest('[data-rc1570-tv]'))){
      e.preventDefault();var a=b.getAttribute('data-rc1570-tv');tv.saved='';tv.error='';
      if(a==='new')openForm();
      else if(a==='edit')edit(tv.id);
      else if(a==='cancel'){tv.mode=tv.id&&findTask(tv.id)?'show':'list';lastView='';renderTaskView(true)}
      return
    }
    if((b=el.closest('[data-rc1570-ref]'))){e.preventDefault();openShipment(b.getAttribute('data-rc1570-ref'));return}
    if((b=el.closest('[data-rc1570-route]'))){e.preventDefault();route(b.getAttribute('data-rc1570-route'))}
  });
  panel.addEventListener('submit',function(e){var form=e.target;if(!form||!form.getAttribute||!form.getAttribute('data-rc1570-tv-form'))return;e.preventDefault();saveForm(form)});
  panel.addEventListener('input',function(e){
    var el=e.target;if(!el||!el.getAttribute)return;
    if(el.getAttribute('data-rc1570-tv-search')){tv.search=el.value;refreshList(panel);return}
    // picking a known customer fills in its customer number
    if(el.name==='customer'){var hit=customers().find(function(c){return low(c.name)===low(el.value)}),no=el.form&&el.form.elements.customerNo;if(hit&&hit.no&&no&&!q(no.value))no.value=hit.no}
  });
  panel.addEventListener('keydown',function(e){if(savePending)return;if(e.key==='Escape'&&(tv.mode==='edit'||tv.mode==='new')){tv.mode=tv.id&&findTask(tv.id)?'show':'list';lastView='';renderTaskView(true)}})
}

/* mounting */
var lastHtml='';
function hostRoot(){var d=w.document;return d&&d.getElementById('content')}
function refresh(){
  var d=w.document;if(!d||!d.body)return;
  var v=view(),root=hostRoot();
  if(v==='taskdetail'&&root){
    // leaving the list: drop the focus flag, otherwise its CSS hides the task view
    var list=d.getElementById(SECTION_ID);if(list)list.remove();d.body.removeAttribute(BODY_FLAG);lastHtml='';
    // the menu entry and openTask() route here: list, detail, edit and create in one place
    var old=d.getElementById('rc1152TaskDetail');if(old)old.remove();
    renderTaskView();
    return
  }
  var tvPanel=d.getElementById(TV_ID);if(tvPanel){tvPanel.remove();lastView='';tv.mode='';tv.saved=''}
  if(d.body.hasAttribute(TV_FLAG))d.body.removeAttribute(TV_FLAG);
  var existing=d.getElementById(SECTION_ID);
  if(v!=='tasks'||!root){if(existing)existing.remove();d.body.removeAttribute(BODY_FLAG);lastHtml='';return}
  var html=renderHtml(buildModel(new Date()),new Date());
  var section=existing;
  if(!section||section.parentNode!==root){
    if(section)section.remove();
    section=d.createElement('section');section.id=SECTION_ID;section.className='rc1570-tasks';section.setAttribute('data-rc1306-own-layout','1');root.insertBefore(section,root.firstChild);lastHtml='';bind(section)
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
  var mount=function(){var v=view();if(v==='tasks'&&!d.getElementById(SECTION_ID))refreshNow();else if(v==='taskdetail'&&!d.getElementById(TV_ID))refreshNow();else if(v!=='tasks'&&d.body&&d.body.hasAttribute(BODY_FLAG))refreshNow();else if(v!=='taskdetail'&&d.body&&d.body.hasAttribute(TV_FLAG))refreshNow()};
  var watch=function(){var c=d.getElementById('content');if(!c||c.__rc1570Observed||typeof w.MutationObserver!=='function')return;c.__rc1570Observed=true;new w.MutationObserver(mount).observe(c,{childList:true})};
  if(typeof w.MutationObserver==='function'&&d.body)new w.MutationObserver(function(){watch();mount()}).observe(d.body,{attributes:true,attributeFilter:['data-exporthub-view','data-current-view']});
  var check=function(){if(d.hidden)return;watch();mount()};
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',check);else check();
  setInterval(check,1500);
  // completed tasks from other tabs/devices: refresh the counts once a minute while the view is open
  setInterval(function(){if(!d.hidden&&view()==='tasks')schedule()},60000)
}

w.ExportHUBTasksFocus1570=Object.freeze({version:VERSION,buildModel:buildModel,weeklyDays:weeklyDays,syncWeeklySeries:syncWeeklySeries,retireSeriesDays:retireSeriesDays,renderHtml:renderHtml,setFilter:setFilter,resetFilters:resetFilters,taskDate:taskDate,isMine:isMine,workGroup:workGroup,refresh:refreshNow,openForm:openForm,openTask:openDetail,editTask:edit,taskViewHtml:taskViewHtml,managedRows:managedRows,_deleteManagedTask:deleteManagedTask,applyForm:applyForm,_saveForm:saveForm,_changeTaskStatus:changeTaskStatus,_tv:tv});
install();
})(window);
