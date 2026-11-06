/* ExportHUB RC1810 – Aufgabenseite mit Reitern Heute / Woche / Monat / Liste.
   - Woche: Tabelle Person (oder Bereich) x Tag. Einzelaufgaben oben, Routine (Wochenplan) zugeklappt.
   - Monat: Kalender mit Feiertagen, Betriebsferien und den wichtigsten Aufgaben je Tag.
   - Liste: die bestehende RC1570-Liste (Filter, Suche, Meine/Alle).
   - Dialog „Betriebsferien & Feiertage“ (RC1810 Kalender).
   Daten bleiben in state.tasks; Abhaken läuft wie in der Liste über ExportHUBRC1014TaskRuntime.setTaskStatus. */
(function(w){
'use strict';
if(!w||w.__EXPORTHUB_RC1810_BOARD__)return;
w.__EXPORTHUB_RC1810_BOARD__=true;

var VERSION='RC1810';
var BOARD_ID='rc1810TaskBoard';
var TAB_ATTR='data-rc1810-board-tab';
var PREF_KEY='exporthub.rc1810.board';
var TABS=['heute','woche','monat','liste'];

var I18N=w.ExportHUBTaskBoard1810I18n||{de:{days:['So','Mo','Di','Mi','Do','Fr','Sa']}};

function q(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function low(v){return q(v).toLowerCase()}
function arr(v){return Array.isArray(v)?v:[]}
function esc(v){return q(v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function lang(){try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.language==='function'){var l=low(w.ExportHUBI18n.language());if(I18N[l])return l;if(l)return 'en'}}catch(_){}return 'de'}
function t(key,vars){var p=I18N[lang()]||I18N.de,s=p[key]!=null?p[key]:(I18N.de[key]!=null?I18N.de[key]:key);if(vars&&typeof s==='string')Object.keys(vars).forEach(function(k){s=s.split('{'+k+'}').join(String(vars[k]))});return s}
function state(){try{if(typeof w.__EXPORTHUB_GET_STATE__==='function'){var s=w.__EXPORTHUB_GET_STATE__();if(s&&typeof s==='object')return s}}catch(_){}return{}}
function currentUser(){try{if(typeof w.__EXPORTHUB_GET_CURRENT_USER__==='function'){var u=w.__EXPORTHUB_GET_CURRENT_USER__();if(u)return u}}catch(_){}var s=state();return s.currentUser||{}}
function view(){var b=w.document&&w.document.body;return b?low(b.getAttribute('data-exporthub-view')||b.getAttribute('data-current-view')):''}
function canWrite(){try{return typeof w.canWrite!=='function'||w.canWrite('tasks')!==false}catch(_){return true}}
function focus(){return w.ExportHUBTasksFocus1570||null}
function cal(){return w.ExportHUBTaskCalendar1810||null}

/* Datum */
function pad(n){return String(n).padStart(2,'0')}
function dayKey(d){return d instanceof Date&&!isNaN(d)?d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()):''}
function parse(k){var p=q(k).split('-').map(Number);return new Date(p[0],p[1]-1,p[2],12)}
function add(k,n){var d=parse(k);d.setDate(d.getDate()+n);return dayKey(d)}
function mondayOf(k){var d=parse(k),n=d.getDay()||7;d.setDate(d.getDate()-n+1);return dayKey(d)}
function todayKey(){return dayKey(new Date())}
function fmt(k){var d=parse(k);return t('days')[d.getDay()]+', '+pad(d.getDate())+'.'+pad(d.getMonth()+1)+'.'}
function isoWeek(k){var d=new Date(Date.UTC(parse(k).getFullYear(),parse(k).getMonth(),parse(k).getDate())),wd=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-wd);var ys=Date.UTC(d.getUTCFullYear(),0,1);return Math.ceil(((d-ys)/864e5+1)/7)}
function monthTitle(y,m){try{return new Intl.DateTimeFormat(lang()==='de'?'de-DE':lang(),{month:'long',year:'numeric'}).format(new Date(y,m-1,15))}catch(_){return pad(m)+'/'+y}}

/* Aufgaben */
function taskId(x){return q(x&&(x.id||x.taskId||x.uuid))}
function title(x){return q(x&&(x.title||x.name||x.text))}
function isCancelled(x){return /^(cancelled|canceled|storniert)$/i.test(q(x&&x.status))}
function isDone(x){return !!(x&&(x.done===true||x.completed===true))||/^(erledigt|done|abgeschlossen|completed|archiviert)$/i.test(q(x&&x.status))}
function isTemplate(x){return !!(x&&(x.isTemplate||x.template||x.recurringTemplate||x.repeatTemplate||x.isRecurringTemplate||x.seriesTemplate))}
function isRoutine(x){var c=cal();if(c&&c.isRoutine(x))return true;return !!(x&&(x.masterTaskRC848||x.weeklySeriesId||/week|woch/i.test(q(x.recurrence))))}
function taskDay(x){var f=focus();if(f&&typeof f.taskDate==='function'){try{return dayKey(f.taskDate(x))}catch(_){}}var v=q(x&&(x.dueDate||x.plannedDate||x.date||x.dueAt));return /^\d{4}-\d{2}-\d{2}/.test(v)?v.slice(0,10):''}
function ownerOf(x){return q(x&&(x.assignedToName||x.owner||x.effectiveAssignee||x.assignee||x.responsible))||t('noOwner')}
function areaOf(x){return q(x&&(x.area||x.category||x.section||x.group))||t('noArea')}
function prio(x){var p=q(x&&x.priority).toUpperCase();if(/^P[0-4]$/.test(p))return p;if(/^(critical|kritisch|urgent|dringend)$/i.test(q(x&&x.priority)))return 'P0';if(/^(high|hoch)$/i.test(q(x&&x.priority)))return 'P1';return ''}
function isMine(x){var f=focus();if(f&&typeof f.isMine==='function'){try{return !!f.isMine(x,currentUser(),arr(state().users))}catch(_){}}var u=currentUser(),me=[u.name,u.displayName,u.user,u.id].map(low).filter(Boolean);return me.indexOf(low(ownerOf(x)))>=0}
function allTasks(){return arr(state().tasks).filter(function(x){return x&&!isTemplate(x)&&title(x)})}
function findTask(id){return arr(state().tasks).find(function(x){return taskId(x)===q(id)})||null}

/* Zustand der Seite */
var ui={tab:'woche',group:'person',who:'alle',weekStart:'',month:'',sel:'',open:{},ensured:{},toast:''};
try{var saved=JSON.parse(w.localStorage.getItem(PREF_KEY)||'{}');if(TABS.indexOf(saved.tab)>=0)ui.tab=saved.tab;if(saved.group==='area')ui.group='area';if(saved.who==='mine')ui.who='mine'}catch(_){}
function remember(){try{w.localStorage.setItem(PREF_KEY,JSON.stringify({tab:ui.tab,group:ui.group,who:ui.who}))}catch(_){}}
function weekStart(){return ui.weekStart||mondayOf(todayKey())}
function monthOf(){var m=ui.month||todayKey().slice(0,7);return{y:Number(m.slice(0,4)),m:Number(m.slice(5,7))}}

/* Wochenplan der angezeigten Wochen bereitstellen (wie der Planer), danach Feiertage anwenden */
function ensureWeeks(dates){
  var master=w.ExportHUBTaskMasterRC848;if(!master||typeof master.ensureWeek!=='function')return;
  var done=false;
  var current=mondayOf(todayKey());
  dates.forEach(function(d){var k=mondayOf(d);if(ui.ensured[k]||k<current)return;ui.ensured[k]=true;try{if(master.ensureWeek(k,false).changed)done=true}catch(_){}});
  if(done){var c=cal();try{if(c&&canWrite())c.applyToTasks(state())}catch(_){}}
}
/* Überfällig: Einzelaufgaben vor heute; Routine nur aus der laufenden Woche (ältere Wochen sind durch den neuen Wochenplan ersetzt) */
function isOverdue(x,today){var d=taskDay(x);if(!d||d>=today||isDone(x)||isCancelled(x))return false;return !isRoutine(x)||d>=mondayOf(today)}
function visible(){return allTasks().filter(function(x){return ui.who!=='mine'||isMine(x)})}

/* Bausteine */
function nonWork(k){var c=cal();if(!c)return null;try{var n=c.nonWork(k);return n&&n.type!=='weekend'?n:null}catch(_){return null}}
function tags(x){
  var p=prio(x),h=x.rc1810Holiday,out='';
  if(p==='P0'||p==='P1')out+='<span class="rc1810-tag rc1810-'+p.toLowerCase()+'">'+p+'</span>';
  if(h&&h.action==='moved')out+='<span class="rc1810-tag rc1810-mv">'+esc(t('movedTag'))+'</span>';
  if(isCancelled(x))out+='<span class="rc1810-tag rc1810-sk">'+esc(t('skipped'))+'</span>';
  return out;
}
function taskBtn(x,opts){
  opts=opts||{};var id=taskId(x),dn=isDone(x)||isCancelled(x);
  var meta=[opts.date?fmt(taskDay(x)):'',q(x.time),opts.meta||''].filter(Boolean).join(' · ');
  return '<div class="rc1810-t'+(dn?' is-done':'')+(id===ui.sel?' is-sel':'')+'">'+
    '<button type="button" class="rc1810-box" data-rc1810-check="'+esc(id)+'" role="checkbox" aria-checked="'+(isDone(x)?'true':'false')+'" aria-label="'+esc(t('markDone'))+': '+esc(title(x))+'"'+(isCancelled(x)?' disabled':'')+'>'+(isDone(x)?'✓':'')+'</button>'+
    '<button type="button" class="rc1810-tt" data-rc1810-open="'+esc(id)+'"><span class="rc1810-name">'+tags(x)+esc(title(x))+'</span>'+(meta?'<span class="rc1810-meta">'+esc(meta)+'</span>':'')+'</button></div>';
}
function rowKey(x){return ui.group==='area'?areaOf(x):ownerOf(x)}
function sortTasks(a,b){var pa=prio(a)||'P9',pb=prio(b)||'P9';if(pa!==pb)return pa<pb?-1:1;var ta=q(a.time),tb=q(b.time);if(ta!==tb)return ta<tb?-1:1;var oa=Number(a.masterOrder),ob=Number(b.masterOrder);if(isFinite(oa)&&isFinite(ob)&&oa!==ob)return oa-ob;return title(a).localeCompare(title(b))}

/* Kopf */
function chipsHtml(){
  var today=todayKey(),ws=mondayOf(today),we=add(ws,6),v=visible(),open=v.filter(function(x){return !isDone(x)&&!isCancelled(x)});
  var over=open.filter(function(x){return isOverdue(x,today)}).length,tod=open.filter(function(x){return taskDay(x)===today}).length;
  var wk=open.filter(function(x){var d=taskDay(x);return d>=ws&&d<=we}).length,mv=open.filter(function(x){var d=taskDay(x);return x.rc1810Holiday&&x.rc1810Holiday.action==='moved'&&d>=ws&&d<=we}).length;
  return '<div class="rc1810-chips">'+
    '<button type="button" class="rc1810-chip rc1810-chip-crit" data-rc1810-tab="heute">'+esc(t('overdue'))+'<b>'+over+'</b></button>'+
    '<button type="button" class="rc1810-chip" data-rc1810-tab="heute">'+esc(t('today'))+'<b>'+tod+'</b></button>'+
    '<button type="button" class="rc1810-chip" data-rc1810-tab="woche">'+esc(t('thisWeek'))+'<b>'+wk+'</b></button>'+
    (mv?'<button type="button" class="rc1810-chip rc1810-chip-warn" data-rc1810-expand-moved="1">'+esc(t('moved'))+'<b>'+mv+'</b></button>':'')+
  '</div>';
}
function headHtml(){
  return '<header class="rc1810-head"><div><div class="rc1810-eyebrow">'+esc(t('eyebrow'))+'</div><h1>'+esc(t('title'))+'</h1></div>'+
    '<div class="rc1810-tabs" role="tablist" aria-label="'+esc(t('title'))+'">'+TABS.map(function(k){return '<button type="button" role="tab" data-rc1810-tab="'+k+'" aria-selected="'+(ui.tab===k)+'">'+esc(t('tab_'+k))+'</button>'}).join('')+'</div>'+
    '<div class="rc1810-actions"><button type="button" class="rc1810-btn" data-rc1810-closures="1">'+esc(t('closures'))+'</button>'+
    '<button type="button" class="rc1810-btn" data-rc1810-route="planning">'+esc(t('planner'))+'</button>'+
    (canWrite()?'<button type="button" class="rc1810-btn rc1810-primary" data-rc1810-new="1">'+esc(t('newTask'))+'</button>':'')+'</div></header>'+
    '<div class="rc1810-bar">'+chipsHtml()+'<div class="rc1810-actions">'+
    (ui.tab==='woche'?'<div class="rc1810-seg" role="group" aria-label="'+esc(t('groupBy'))+'"><button type="button" data-rc1810-group="person" aria-pressed="'+(ui.group==='person')+'">'+esc(t('byPerson'))+'</button><button type="button" data-rc1810-group="area" aria-pressed="'+(ui.group==='area')+'">'+esc(t('byArea'))+'</button></div>':'')+
    (ui.tab!=='liste'?'<div class="rc1810-seg" role="group" aria-label="'+esc(t('who'))+'"><button type="button" data-rc1810-who="alle" aria-pressed="'+(ui.who!=='mine')+'">'+esc(t('all'))+'</button><button type="button" data-rc1810-who="mine" aria-pressed="'+(ui.who==='mine')+'">'+esc(t('mine'))+'</button></div>':'')+
    '</div></div>';
}

/* Woche */
function weekHtml(){
  var ws=weekStart(),days=[0,1,2,3,4].map(function(i){return add(ws,i)}),today=todayKey();ensureWeeks([ws]);
  var inWeek=visible().filter(function(x){var d=taskDay(x);return d>=days[0]&&d<=days[4]});
  var keys={};inWeek.forEach(function(x){keys[rowKey(x)]=true});
  var rows=Object.keys(keys).sort(function(a,b){return a===t('noOwner')||a===t('noArea')?1:b===t('noOwner')||b===t('noArea')?-1:a.localeCompare(b)});
  var head=days.map(function(k){var o=nonWork(k);return '<th scope="col" class="'+(k===today?'is-today ':'')+(o?'is-off':'')+'"><span class="rc1810-d">'+esc(fmt(k))+'</span>'+(o?'<span class="rc1810-lbl">'+esc(o.label)+'</span>':(k===today?'<span class="rc1810-lbl">'+esc(t('today'))+'</span>':''))+'</th>'}).join('');
  var body=rows.map(function(r){
    var list=inWeek.filter(function(x){return rowKey(x)===r});
    var openCount=list.filter(function(x){return !isDone(x)&&!isCancelled(x)}).length;
    var cells=days.map(function(k){
      var o=nonWork(k),cell=list.filter(function(x){return taskDay(x)===k}).sort(sortTasks);
      var imp=cell.filter(function(x){return !isRoutine(x)}),rout=cell.filter(function(x){return isRoutine(x)&&!isCancelled(x)});
      if(o&&!imp.length&&!rout.length)return '<td class="is-off"><span class="rc1810-offtxt">'+esc(t('noTasks'))+'</span></td>';
      var ck=r+'|'+k,isOpen=!!ui.open[ck],dn=rout.filter(isDone).length,hasMoved=rout.some(function(x){return x.rc1810Holiday&&x.rc1810Holiday.action==='moved'});
      var rh=rout.length?'<div class="rc1810-routine"><button type="button" class="rc1810-rtoggle" data-rc1810-toggle="'+esc(ck)+'" aria-expanded="'+isOpen+'">'+(isOpen?'▾':'▸')+' '+esc(t('routine'))+' '+dn+'/'+rout.length+'<span class="rc1810-progress"><i style="width:'+Math.round(dn/rout.length*100)+'%"></i></span>'+(hasMoved?'<span class="rc1810-tag rc1810-mv">'+esc(t('plusMoved'))+'</span>':'')+'</button>'+(isOpen?'<div class="rc1810-rlist">'+rout.map(function(x){return taskBtn(x,{meta:ui.group==='area'?ownerOf(x):''})}).join('')+'</div>':'')+'</div>':'';
      return '<td class="'+(k===today?'is-today ':'')+(o?'is-off':'')+'">'+imp.map(function(x){return taskBtn(x,{meta:ui.group==='area'?ownerOf(x):(areaOf(x)===t('noArea')?'':areaOf(x))})}).join('')+rh+'</td>';
    }).join('');
    return '<tr><th scope="row" class="rc1810-rowh"><span class="rc1810-who" data-i18n-ignore>'+esc(r)+'</span><span class="rc1810-sub">'+esc(t('open',{count:openCount}))+'</span></th>'+cells+'</tr>';
  }).join('');
  if(!rows.length)body='<tr><td colspan="6" class="rc1810-empty">'+esc(t('noTasks'))+'</td></tr>';
  var nav='<div class="rc1810-nav"><div class="rc1810-weeknav"><button type="button" class="rc1810-btn" data-rc1810-week="-7" aria-label="'+esc(t('prevWeek'))+'">‹</button><strong>'+esc(t('week',{week:isoWeek(ws)}))+' · '+esc(fmt(days[0]))+' – '+esc(fmt(days[4]))+'</strong><button type="button" class="rc1810-btn" data-rc1810-week="7" aria-label="'+esc(t('nextWeek'))+'">›</button><button type="button" class="rc1810-btn" data-rc1810-week="0">'+esc(t('today'))+'</button></div><span class="rc1810-hint">'+esc(t('hint'))+'</span></div>';
  if(narrow())return nav+weekListHtml(days,inWeek,rows,today);
  return nav+'<div class="rc1810-scroll"><table class="rc1810-week"><thead><tr><th scope="col" class="rc1810-rowh">'+esc(ui.group==='area'?t('area'):t('person'))+'</th>'+head+'</tr></thead><tbody>'+body+'</tbody></table></div>';
}

/* Woche auf dem Handy: Tage untereinander statt Tabelle */
function narrow(){try{return !!(w.matchMedia&&w.matchMedia('(max-width: 760px)').matches)}catch(_){return false}}
function weekListHtml(days,inWeek,rows,today){
  return '<div class="rc1810-daylist">'+days.map(function(k){
    var o=nonWork(k),cell=inWeek.filter(function(x){return taskDay(x)===k});
    var head='<h3 class="rc1810-dayh'+(k===today?' is-today':'')+(o?' is-off':'')+'">'+esc(fmt(k))+(o?' · '+esc(o.label):(k===today?' · '+esc(t('today')):''))+'</h3>';
    var groups=rows.map(function(r){
      var list=cell.filter(function(x){return rowKey(x)===r}).sort(sortTasks);if(!list.length)return '';
      var imp=list.filter(function(x){return !isRoutine(x)}),rout=list.filter(function(x){return isRoutine(x)&&!isCancelled(x)});
      var ck=r+'|'+k,isOpen=!!ui.open[ck],dn=rout.filter(isDone).length;
      return '<div class="rc1810-daygroup"><span class="rc1810-who" data-i18n-ignore>'+esc(r)+'</span>'+imp.map(function(x){return taskBtn(x,{meta:areaOf(x)===t('noArea')?'':areaOf(x)})}).join('')+
        (rout.length?'<div class="rc1810-routine"><button type="button" class="rc1810-rtoggle" data-rc1810-toggle="'+esc(ck)+'" aria-expanded="'+isOpen+'">'+(isOpen?'▾':'▸')+' '+esc(t('routine'))+' '+dn+'/'+rout.length+'<span class="rc1810-progress"><i style="width:'+Math.round(dn/rout.length*100)+'%"></i></span></button>'+(isOpen?'<div class="rc1810-rlist">'+rout.map(function(x){return taskBtn(x)}).join('')+'</div>':'')+'</div>':'')+'</div>';
    }).join('');
    return '<section class="rc1810-day'+(o?' is-off':'')+'">'+head+(groups||'<p class="rc1810-offtxt">'+esc(t('noTasks'))+'</p>')+'</section>';
  }).join('')+'</div>';
}

/* Monat */
function monthHtml(){
  var mo=monthOf(),first=mo.y+'-'+pad(mo.m)+'-01',start=mondayOf(first),today=todayKey(),cells='';
  var weeks=[];for(var i=0;i<6;i++)weeks.push(add(start,i*7));ensureWeeks(weeks);
  var v=visible(),byDay={};v.forEach(function(x){var d=taskDay(x);if(!d||isCancelled(x))return;(byDay[d]=byDay[d]||[]).push(x)});
  var k=start;
  for(var n=0;n<42;n++,k=add(k,1)){
    if(n===35&&k.slice(0,7)!==first.slice(0,7))break;
    var o=nonWork(k),list=(byDay[k]||[]),imp=list.filter(function(x){return !isRoutine(x)}).sort(sortTasks),rc=list.filter(isRoutine).length,inM=k.slice(0,7)===first.slice(0,7),wd=parse(k).getDay();
    cells+='<button type="button" class="rc1810-mday'+(inM?'':' is-out')+(o?' is-off':'')+(k===today?' is-today':'')+(wd===0||wd===6?' is-we':'')+'" data-rc1810-day="'+k+'"><span class="rc1810-n">'+parse(k).getDate()+'</span>'+(o?'<span class="rc1810-hl">'+esc(o.label)+'</span>':'')+
      imp.slice(0,3).map(function(x){return '<span class="rc1810-imp'+(isDone(x)?' is-done':'')+'">'+(prio(x)==='P0'?'● ':'')+esc(title(x))+'</span>'}).join('')+(imp.length>3?'<span class="rc1810-cnt">'+esc(t('more',{count:imp.length-3}))+'</span>':'')+(rc?'<span class="rc1810-cnt">'+esc(t('routineCount',{count:rc}))+'</span>':'')+'</button>';
  }
  return '<div class="rc1810-nav"><div class="rc1810-weeknav"><button type="button" class="rc1810-btn" data-rc1810-month="-1" aria-label="‹">‹</button><strong>'+esc(monthTitle(mo.y,mo.m))+'</strong><button type="button" class="rc1810-btn" data-rc1810-month="1" aria-label="›">›</button><button type="button" class="rc1810-btn" data-rc1810-month="0">'+esc(t('today'))+'</button></div></div>'+
    '<div class="rc1810-month">'+[1,2,3,4,5,6,0].map(function(i){return '<div class="rc1810-wd">'+esc(t('days')[i])+'</div>'}).join('')+cells+
    '<div class="rc1810-legend"><span><i class="rc1810-sw rc1810-sw-off"></i>'+esc(t('legendOff'))+'</span><span>'+esc(t('legendP0'))+'</span></div></div>';
}

/* Heute */
function todayHtml(){
  var today=todayKey();ensureWeeks([today]);
  var v=visible().filter(function(x){return !isCancelled(x)&&(taskDay(x)===today||isOverdue(x,today))});
  var groups={};v.forEach(function(x){(groups[ownerOf(x)]=groups[ownerOf(x)]||[]).push(x)});
  var names=Object.keys(groups).sort();
  if(!names.length)return '<p class="rc1810-empty">'+esc(t('nothingToday'))+'</p>';
  return '<div class="rc1810-today">'+names.map(function(p){
    var l=groups[p].sort(function(a,b){var da=taskDay(a),db=taskDay(b);return da!==db?(da<db?-1:1):sortTasks(a,b)});
    var imp=l.filter(function(x){return !isRoutine(x)}),rout=l.filter(function(x){return isRoutine(x)&&taskDay(x)===today}),late=l.filter(function(x){return isRoutine(x)&&taskDay(x)<today});
    var lk=p+'|late',lo=!!ui.open[lk];
    return '<section class="rc1810-tcol"><h3>'+esc(p)+'</h3>'+imp.map(function(x){var d=taskDay(x);return taskBtn(x,{meta:d<today?t('overdueSince',{date:fmt(d)}):(areaOf(x)===t('noArea')?'':areaOf(x))})}).join('')+
      (rout.length?'<div class="rc1810-routine"><div class="rc1810-hint">'+esc(t('routineDone',{done:rout.filter(isDone).length,total:rout.length}))+'</div>'+rout.map(function(x){return taskBtn(x)}).join('')+'</div>':'')+
      (late.length?'<div class="rc1810-routine"><button type="button" class="rc1810-rtoggle rc1810-late" data-rc1810-toggle="'+esc(lk)+'" aria-expanded="'+lo+'">'+(lo?'▾':'▸')+' '+esc(t('lateRoutine',{count:late.length}))+'</button>'+(lo?'<div class="rc1810-rlist">'+late.map(function(x){return taskBtn(x,{meta:fmt(taskDay(x))})}).join('')+'</div>':'')+'</div>':'')+'</section>';
  }).join('')+'</div>';
}

/* Details */
function panelHtml(){
  var x=ui.sel&&findTask(ui.sel);if(!x)return '';
  var h=x.rc1810Holiday,p=prio(x),st=isCancelled(x)?t('stCancelled'):isDone(x)?t('stDone'):t('stOpen'),ref=q(x.shipmentRef||x.ref||x.reference);
  var rows=[[t('due'),taskDay(x)?fmt(taskDay(x))+(q(x.time)?' · '+q(x.time):''):''],[t('owner'),ownerOf(x)],[t('priority'),p||t('normal')],[t('repeat'),isRoutine(x)?t('weekly'):t('once')],
    h&&h.action==='moved'?[t('movedFrom'),t('movedFromVal',{date:fmt(h.originalDate),label:h.label||''})]:null,[t('status'),st],
    q(x.customerName||x.customer)?[t('customer'),q(x.customerName||x.customer)]:null,ref?[t('ref'),ref]:null].filter(Boolean);
  return '<div class="rc1810-eyebrow">'+esc(areaOf(x))+'</div><h2>'+esc(title(x))+'</h2><dl>'+rows.map(function(r){return '<dt>'+esc(r[0])+'</dt><dd>'+(esc(r[1])||'–')+'</dd>'}).join('')+'</dl>'+
    (q(x.note||x.description)?'<p class="rc1810-note">'+esc(x.note||x.description)+'</p>':'')+
    '<div class="rc1810-actions">'+(canWrite()&&!isCancelled(x)?'<button type="button" class="rc1810-btn rc1810-primary" data-rc1810-check="'+esc(taskId(x))+'">'+esc(isDone(x)?t('reopen'):t('markDone'))+'</button><button type="button" class="rc1810-btn" data-rc1810-edit="'+esc(taskId(x))+'">'+esc(t('edit'))+'</button>':'')+
    (ref?'<button type="button" class="rc1810-btn" data-rc1810-ref="'+esc(ref)+'">'+esc(t('openShipment'))+'</button>':'')+
    '<button type="button" class="rc1810-btn" data-rc1810-close="1">'+esc(t('close'))+'</button></div>';
}

/* Dialog Betriebsferien */
function ruleShort(r){return t(r==='prev'?'ruleShortPrev':r==='next'?'ruleShortNext':'ruleShortSkip')}
function dialogHtml(){
  var c=cal(),info=c?c.calendar(state()):{closures:[],holidayRoutineRule:'prev'},rw=canWrite(),today=todayKey();
  var hol=c?c.holidaysBetween(today,add(today,120),state()).filter(function(h){return h.type==='holiday'}).slice(0,6):[];
  var list=info.closures.length?info.closures.map(function(x){return '<li><span><b>'+esc(x.label)+'</b><span class="rc1810-hint">'+esc(fmt(x.startDate))+' – '+esc(fmt(x.endDate))+' · '+esc(ruleShort(x.routineRule))+'</span></span>'+(rw?'<button type="button" class="rc1810-btn" data-rc1810-del="'+esc(x.id)+'">'+esc(t('dlgDelete'))+'</button>':'')+'</li>'}).join(''):'<li class="rc1810-hint">'+esc(t('dlgEmpty'))+'</li>';
  var radio=function(name,val,cur,label){return '<label><input type="radio" name="'+name+'" value="'+val+'"'+(cur===val?' checked':'')+(rw?'':' disabled')+'> '+esc(label)+'</label>'};
  return '<form method="dialog" class="rc1810-dlg-in" data-rc1810-form="1" novalidate><h2>'+esc(t('dlgTitle'))+'</h2><p class="rc1810-hint">'+esc(t('dlgHint'))+'</p>'+(rw?'':'<p class="rc1810-warnline">'+esc(t('readOnly'))+'</p>')+
    '<ul class="rc1810-closures">'+list+'</ul>'+
    (rw?'<fieldset class="rc1810-fs"><label>'+esc(t('dlgLabel'))+'<input id="rc1810CLabel" name="label" maxlength="60" value="'+esc(t('dlgLabelDefault'))+'"></label>'+
      '<div class="rc1810-two"><label>'+esc(t('dlgFrom'))+'<input id="rc1810CFrom" type="date" name="from" required></label><label>'+esc(t('dlgTo'))+'<input id="rc1810CTo" type="date" name="to" required></label></div>'+
      '<div class="rc1810-radios"><span class="rc1810-legendtxt">'+esc(t('dlgRule'))+'</span>'+radio('rule','skip','skip',t('ruleSkip'))+radio('rule','prev','skip',t('rulePrev'))+radio('rule','next','skip',t('ruleNext'))+'</div>'+
      '<p class="rc1810-error" role="alert" hidden></p></fieldset>':'')+
    '<div class="rc1810-radios rc1810-holrule"><span class="rc1810-legendtxt">'+esc(t('holidayRule'))+'</span>'+radio('holrule','prev',info.holidayRoutineRule,t('rulePrev'))+radio('holrule','next',info.holidayRoutineRule,t('ruleNext'))+radio('holrule','skip',info.holidayRoutineRule,t('ruleSkip'))+'</div>'+
    (hol.length?'<p class="rc1810-hint"><b>'+esc(t('upcoming'))+':</b> '+hol.map(function(h){return esc(fmt(h.date))+' '+esc(h.label)}).join(' · ')+'</p>':'')+
    '<div class="rc1810-actions rc1810-dlg-actions"><button type="button" class="rc1810-btn" data-rc1810-dlg-close="1">'+esc(t('close'))+'</button>'+(rw?'<button type="submit" class="rc1810-btn rc1810-primary">'+esc(t('dlgSave'))+'</button>':'')+'</div></form>';
}
function openDialog(){
  var d=w.document,dlg=d.getElementById('rc1810Closures');
  if(!dlg){dlg=d.createElement('dialog');dlg.id='rc1810Closures';dlg.className='rc1810-dlg';d.body.appendChild(dlg);bindDialog(dlg)}
  dlg.innerHTML=dialogHtml();
  try{if(!dlg.open)dlg.showModal()}catch(_){dlg.setAttribute('open','')}
}
function bindDialog(dlg){
  dlg.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('button');if(!b)return;
    if(b.hasAttribute('data-rc1810-dlg-close')){e.preventDefault();dlg.close();return}
    if(b.hasAttribute('data-rc1810-del')){e.preventDefault();try{cal().removeClosure(b.getAttribute('data-rc1810-del'));toast(t('dlgDeleted'))}catch(err){toast(err.message||t('saveFailed'))}dlg.innerHTML=dialogHtml();render(true)}
  });
  dlg.addEventListener('change',function(e){
    if(e.target&&e.target.name==='holrule'){try{cal().setHolidayRule(e.target.value);toast(t('dlgSaved'))}catch(err){toast(err.message||t('saveFailed'))}render(true)}
  });
  dlg.addEventListener('submit',function(e){
    e.preventDefault();var f=e.target,err=f.querySelector('.rc1810-error');
    var r=f.querySelector('[name=rule]:checked');
    var dv=function(el){if(!el)return '';var v=q(el.value),c=cal(),k=c&&c.dayKey?c.dayKey(v):'';return k||q(el.getAttribute('data-date-iso'))};
    try{cal().saveClosure({label:q(f.label&&f.label.value),startDate:dv(f.from),endDate:dv(f.to),routineRule:r?r.value:'skip'});toast(t('dlgSaved'));dlg.close();render(true)}
    catch(ex){if(err){err.hidden=false;err.textContent=ex.message||t('saveFailed')}}
  });
}

/* Rendern */
var lastHtml='';
function toast(msg){
  try{if(w.ExportHUBClean&&typeof w.ExportHUBClean.operationStatus==='function'){w.ExportHUBClean.operationStatus(msg,'ok');return}}catch(_){}
  ui.toast=msg;render(true);setTimeout(function(){ui.toast='';render(true)},2200);
}
function bodyHtml(){
  if(ui.tab==='liste')return '';
  var main=ui.tab==='heute'?todayHtml():ui.tab==='monat'?monthHtml():weekHtml(),panel=panelHtml();
  return '<div class="rc1810-main'+(panel?' has-panel':'')+'"><section class="rc1810-card" aria-live="polite">'+main+'</section>'+(panel?'<aside class="rc1810-card rc1810-panel">'+panel+'</aside>':'')+'</div>';
}
function render(force){
  var d=w.document;if(!d||!d.body)return;
  var root=d.getElementById('content'),board=d.getElementById(BOARD_ID);
  if(view()!=='tasks'||!root){if(board)board.remove();d.body.removeAttribute(TAB_ATTR);lastHtml='';return}
  if(!board){board=d.createElement('section');board.id=BOARD_ID;board.className='rc1810-board';board.setAttribute('data-rc1306-own-layout','1');bindBoard(board);lastHtml=''}
  if(board.parentNode!==root||root.firstChild!==board)root.insertBefore(board,root.firstChild);
  if(d.body.getAttribute(TAB_ATTR)!==ui.tab)d.body.setAttribute(TAB_ATTR,ui.tab);
  var html=headHtml()+bodyHtml()+(ui.toast?'<div class="rc1810-toast" role="status">'+esc(ui.toast)+'</div>':'');
  if(force||html!==lastHtml){board.innerHTML=html;lastHtml=html}
}
function safeRender(force){try{render(force)}catch(err){try{console.warn('RC1810 Aufgabenseite',err)}catch(_){}}}
var frame=0;
function schedule(){if(frame)return;var raf=w.requestAnimationFrame||function(fn){return setTimeout(fn,16)};frame=raf(function(){frame=0;safeRender(false)})}

async function toggleTask(id){
  if(!canWrite()){toast(t('noRights'));return}
  var x=findTask(id),rt=w.ExportHUBRC1014TaskRuntime;if(!x||isCancelled(x))return;
  if(!rt||typeof rt.setTaskStatus!=='function'){toast(t('saveFailed'));return}
  var to=isDone(x)?'open':'done';
  try{await rt.setTaskStatus(x,to,{state:state(),currentUser:currentUser()});toast(to==='done'?t('savedDone'):t('savedOpen'))}
  catch(err){toast(t('saveFailed'));try{console.error('RC1810 task save failed',err)}catch(_){}}
  finally{safeRender(true);try{var f=focus();if(f&&f.refresh)f.refresh()}catch(_){}}
}
function setTab(tab){if(TABS.indexOf(tab)<0)return;ui.tab=tab;remember();safeRender(true);if(tab==='liste'){try{var f=focus();if(f&&f.refresh)f.refresh()}catch(_){}}}
function bindBoard(board){
  board.addEventListener('click',function(e){
    var el=e.target&&e.target.closest?e.target:null;if(!el)return;var b;
    if((b=el.closest('[data-rc1810-check]'))){e.preventDefault();toggleTask(b.getAttribute('data-rc1810-check'));return}
    if((b=el.closest('[data-rc1810-open]'))){e.preventDefault();var id=b.getAttribute('data-rc1810-open');ui.sel=ui.sel===id?'':id;safeRender(true);return}
    if((b=el.closest('[data-rc1810-tab]'))){e.preventDefault();setTab(b.getAttribute('data-rc1810-tab'));return}
    if((b=el.closest('[data-rc1810-group]'))){ui.group=b.getAttribute('data-rc1810-group');remember();safeRender(true);return}
    if((b=el.closest('[data-rc1810-who]'))){ui.who=b.getAttribute('data-rc1810-who')==='mine'?'mine':'alle';remember();safeRender(true);return}
    if((b=el.closest('[data-rc1810-toggle]'))){var k=b.getAttribute('data-rc1810-toggle');ui.open[k]=!ui.open[k];safeRender(true);return}
    if((b=el.closest('[data-rc1810-expand-moved]'))){ui.tab='woche';ui.weekStart='';visible().forEach(function(x){if(x.rc1810Holiday&&x.rc1810Holiday.action==='moved')ui.open[rowKey(x)+'|'+taskDay(x)]=true});remember();safeRender(true);return}
    if((b=el.closest('[data-rc1810-week]'))){var n=Number(b.getAttribute('data-rc1810-week'));ui.weekStart=n?add(weekStart(),n):'';safeRender(true);return}
    if((b=el.closest('[data-rc1810-month]'))){var m=Number(b.getAttribute('data-rc1810-month')),mo=monthOf();if(!m)ui.month='';else{var dt=new Date(mo.y,mo.m-1+m,15);ui.month=dt.getFullYear()+'-'+pad(dt.getMonth()+1)}safeRender(true);return}
    if((b=el.closest('[data-rc1810-day]'))){ui.weekStart=mondayOf(b.getAttribute('data-rc1810-day'));ui.tab='woche';remember();safeRender(true);return}
    if((b=el.closest('[data-rc1810-close]'))){ui.sel='';safeRender(true);return}
    if((b=el.closest('[data-rc1810-edit]'))){var f=focus();if(f&&f.editTask)f.editTask(b.getAttribute('data-rc1810-edit'));return}
    if((b=el.closest('[data-rc1810-new]'))){var f2=focus();if(f2&&f2.openForm)f2.openForm();return}
    if((b=el.closest('[data-rc1810-route]'))){try{if(typeof w.setView==='function')w.setView(b.getAttribute('data-rc1810-route'))}catch(_){}return}
    if((b=el.closest('[data-rc1810-ref]'))){var r=b.getAttribute('data-rc1810-ref');try{if(w.ExportHUBShipmentView&&typeof w.ExportHUBShipmentView.open==='function')w.ExportHUBShipmentView.open(r,'tasks')}catch(_){}return}
    if((b=el.closest('[data-rc1810-closures]'))){openDialog();return}
  });
}
function install(){
  var d=w.document;if(!d)return;
  try{var mq=w.matchMedia&&w.matchMedia('(max-width: 760px)');if(mq&&mq.addEventListener)mq.addEventListener('change',function(){safeRender(true)})}catch(_){}
  ['exporthub:ready','exporthub:viewchange','exporthub:rendered','exporthub:sync','exporthub:tasks-updated','exporthub:language-changed','exporthub:state-loaded'].forEach(function(n){try{w.addEventListener(n,schedule)}catch(_){}});
  var watch=function(){var c=d.getElementById('content');if(!c||c.__rc1810Observed||typeof w.MutationObserver!=='function')return;c.__rc1810Observed=true;new w.MutationObserver(function(){var b=d.getElementById(BOARD_ID);if(view()==='tasks'&&(!b||c.firstChild!==b))schedule();else if(view()!=='tasks'&&b)schedule()}).observe(c,{childList:true})};
  var check=function(){watch();schedule()};
  if(typeof w.MutationObserver==='function'&&d.body)new w.MutationObserver(check).observe(d.body,{attributes:true,attributeFilter:['data-exporthub-view','data-current-view']});
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',check);else check();
}
w.ExportHUBTaskBoard1810=Object.freeze({version:VERSION,render:function(){safeRender(true)},setTab:setTab,openClosures:openDialog,_ui:ui,_texts:I18N});
install();
})(window);
