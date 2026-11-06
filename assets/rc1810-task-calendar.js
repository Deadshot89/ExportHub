/* ExportHUB RC1810 – Betriebsferien und Feiertage im Aufgabenplaner.
   - Eigene freie Tage (Betriebsferien, Brückentage) liegen in state.taskCalendar.closures.
   - Routineaufgaben (Wochenplan RC848 und wöchentliche Serien aus der Aufgabenansicht), die auf einen
     gesetzlichen Feiertag (NRW) oder einen freien Tag fallen, werden innerhalb derselben Kalenderwoche
     vorgezogen, nachgeholt oder entfallen (Status "cancelled", Grund rc1810_holiday).
   - Jede Anpassung merkt sich den vorherigen Zustand in task.rc1810Holiday und wird zurückgenommen,
     sobald der Tag wieder ein Arbeitstag ist (z. B. Betriebsferien gelöscht).
   - Wochenenden werden nicht angefasst, Einzelaufgaben ebenfalls nicht. */
(function(root){
'use strict';
if(!root||root.ExportHUBTaskCalendar1810)return;

var VERSION='RC1810';
var CANCEL_REASON='rc1810_holiday';
var RULES=['prev','next','skip'];
var DAY_NAMES=['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
var DATE_FIELDS=['day','plannedDate','plannedAt','dueDate','dueAt','date'];

function q(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function low(v){return q(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')}
function arr(v){return Array.isArray(v)?v:[]}
function obj(v){return !!v&&typeof v==='object'&&!Array.isArray(v)}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v))}
function pad(n){return String(n).padStart(2,'0')}
function dayKey(v){
  if(v instanceof Date&&!isNaN(v))return v.getFullYear()+'-'+pad(v.getMonth()+1)+'-'+pad(v.getDate());
  var m=q(v).match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return m[1]+'-'+m[2]+'-'+m[3];
  var g=q(v).match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/);if(g)return g[3]+'-'+pad(g[2])+'-'+pad(g[1]);
  return '';
}
function utc(key){var p=key.split('-').map(Number);return new Date(Date.UTC(p[0],p[1]-1,p[2],12))}
function addDays(key,n){var d=utc(key);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function isoWeekday(key){return utc(key).getUTCDay()||7}
function mondayOf(key){return addDays(key,1-isoWeekday(key))}
function weekKeyOf(key){var d=utc(key),wd=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-wd);var y=d.getUTCFullYear(),ys=Date.UTC(y,0,1);return y+'-W'+pad(Math.ceil(((d-ys)/864e5+1)/7))}
function mondayOfWeekKey(w){var m=q(w).match(/^(\d{4})-W(\d{1,2})$/i);if(!m)return '';var jan4=dayKey(new Date(Date.UTC(Number(m[1]),0,4,12)).toISOString());return addDays(mondayOf(jan4),(Number(m[2])-1)*7)}

function state(){try{if(typeof root.__EXPORTHUB_GET_STATE__==='function'){var s=root.__EXPORTHUB_GET_STATE__();if(s&&typeof s==='object')return s}}catch(_){}return null}
function recurrence(){var r=root.ExportHUBTaskRecurrenceV2;return r&&typeof r.nonWorkReason==='function'?r:null}

/* ---- Kalender ---- */
function normalizeRule(v,fallback){v=low(v);return RULES.indexOf(v)>=0?v:fallback}
function normalizeClosure(raw){
  if(!obj(raw))return null;
  var start=dayKey(raw.startDate||raw.start||raw.from||raw.date),end=dayKey(raw.endDate||raw.end||raw.to||raw.date||start);
  if(!start||!end)return null;if(end<start){var x=start;start=end;end=x}
  return{id:q(raw.id)||('rc1810-'+start+'-'+end),label:q(raw.label||raw.name||raw.title)||'Betriebsferien',startDate:start,endDate:end,type:q(raw.type)||'company_holiday',routineRule:normalizeRule(raw.routineRule,'skip'),createdAt:q(raw.createdAt),createdBy:q(raw.createdBy)};
}
function calendarOf(s){
  var src=obj(s&&s.taskCalendar)?s.taskCalendar:{};
  return{closures:arr(src.closures).map(normalizeClosure).filter(Boolean).sort(function(a,b){return a.startDate.localeCompare(b.startDate)}),holidayRoutineRule:normalizeRule(src.holidayRoutineRule,'prev'),source:src};
}
function engineCalendar(cal){
  var r=recurrence();if(!r||typeof r.calendar!=='function')return null;
  return r.calendar({closures:cal.closures.map(function(c){return{startDate:c.startDate,endDate:c.endDate,type:c.type,label:c.label}})});
}
function closureFor(key,cal){return cal.closures.find(function(c){return key>=c.startDate&&key<=c.endDate})||null}
/* null = Arbeitstag. Sonst {type:'weekend'|'holiday'|'closure',label,closure} */
function nonWork(key,cal){
  key=dayKey(key);if(!key)return null;
  var wd=isoWeekday(key);if(wd===6||wd===7)return{type:'weekend',label:''};
  var c=closureFor(key,cal);
  var r=recurrence(),reason=null;
  if(r){try{reason=r.nonWorkReason(key,engineCalendar({closures:[]}))}catch(_){reason=null}}
  if(reason&&reason.type==='nrw_holiday')return{type:'holiday',label:q(reason.label),closure:c};
  if(c)return{type:'closure',label:c.label,closure:c};
  return null;
}
function isWorkday(key,cal){return !nonWork(key,cal)}
function ruleFor(info,cal){if(!info)return null;if(info.closure)return info.closure.routineRule;return info.type==='holiday'?cal.holidayRoutineRule:null}
function shiftInWeek(key,rule,cal){
  var monday=mondayOf(key),friday=addDays(monday,4),dirs=rule==='next'?[1,-1]:[-1,1];
  for(var i=0;i<dirs.length;i++){
    for(var d=addDays(key,dirs[i]);d>=monday&&d<=friday;d=addDays(d,dirs[i]))if(isWorkday(d,cal))return d;
  }
  return '';
}

/* ---- Routineaufgaben ---- */
function isRoutine(t){
  if(!obj(t))return false;
  if(t.masterTaskRC848===true||t.masterTaskRC846===true)return true;
  return /^rc1570-series:/.test(q(t.seriesId))&&!!q(t.occurrenceKey);
}
function plannedDayOf(t){
  var H=obj(t.rc1810Holiday)?t.rc1810Holiday:null;if(H&&dayKey(H.originalDate))return dayKey(H.originalDate);
  if(t.masterTaskRC848===true||t.masterTaskRC846===true){
    var o=dayKey(t.originalPlannedDate);if(o)return o;
    var mon=mondayOfWeekKey(t.weekKey||t.createdForWeek)||dayKey(t.sourceWeekStart),i=DAY_NAMES.map(low).indexOf(low(t.originalDay||t.day));
    return mon&&i>=1&&i<=5?addDays(mon,i-1):'';
  }
  return dayKey(t.originalOccurrenceDate)||dayKey(t.dueDate||t.dueAt||t.plannedDate||t.date);
}
function cancelledByUs(t){return low(t.status)==='cancelled'&&q(t.cancelReason)===CANCEL_REASON}
function userFinished(t){
  if(cancelledByUs(t))return false;
  var s=low(t.status);
  return t.done===true||t.completed===true||/^(erledigt|done|abgeschlossen|completed|archiviert|storniert|cancelled|canceled)$/.test(s);
}
function snapshot(t){var o={};DATE_FIELDS.concat(['status','done','completed','cancelReason','cancelledAt']).forEach(function(k){o[k]=Object.prototype.hasOwnProperty.call(t,k)?clone(t[k]):null});return o}
function restore(t){
  var H=t.rc1810Holiday;if(!obj(H))return;
  var prev=obj(H.prev)?H.prev:{};
  if(H.action==='moved'){DATE_FIELDS.forEach(function(k){if(prev[k]==null)delete t[k];else t[k]=prev[k]})}
  if(H.action==='skipped'&&cancelledByUs(t)){
    ['status','done','completed','cancelReason','cancelledAt'].forEach(function(k){if(prev[k]==null)delete t[k];else t[k]=prev[k]});
    if(low(t.status)==='cancelled'){t.status='offen';t.done=false;t.completed=false;delete t.cancelReason;delete t.cancelledAt}
  }
  delete t.rc1810Holiday;
}
function timeOf(v){var m=q(v).match(/T(\d{2}:\d{2})/);return m?m[1]:''}
function applyOne(t,desired,info,original,now){
  var prev=snapshot(t);
  t.rc1810Holiday={version:VERSION,action:desired.action,originalDate:original,targetDate:desired.date||'',reason:info.type,label:info.label||'',appliedAt:now,prev:prev};
  if(desired.action==='moved'){
    var target=desired.date,time=timeOf(t.dueAt);
    t.day=DAY_NAMES[isoWeekday(target)%7];t.plannedDate=target;t.dueDate=target;t.date=target;
    if(q(t.dueAt))t.dueAt=target+'T'+(time||'16:15')+':00';
    if(q(t.plannedAt))t.plannedAt=target+'T00:00:00';
  }else{
    t.status='cancelled';t.done=false;t.completed=false;t.cancelReason=CANCEL_REASON;t.cancelledAt=now;
  }
}
function same(a,b){if(!a&&!b)return true;if(!a||!b)return false;return a.action===b.action&&q(a.date||a.targetDate)===q(b.date||b.targetDate)}
/* Wendet Feiertage/Betriebsferien auf alle Routineaufgaben an. Gibt Anzahl geänderter Aufgaben zurück. */
function applyToTasks(s,opts){
  s=s||state();if(!s||!Array.isArray(s.tasks))return{changed:0,moved:0,skipped:0,restored:0};
  var cal=calendarOf(s),now=q(opts&&opts.now)||new Date().toISOString(),out={changed:0,moved:0,skipped:0,restored:0};
  s.tasks.forEach(function(t){
    if(!isRoutine(t))return;
    var current=obj(t.rc1810Holiday)?t.rc1810Holiday:null;
    if(!current&&userFinished(t))return;
    if(current&&current.action==='skipped'&&!cancelledByUs(t)){current.action='override';out.changed++;return}
    var original=plannedDayOf(t);if(!original)return;
    var info=nonWork(original,cal);if(info&&info.type==='weekend')info=null;
    /* von Hand wieder geöffnet: nicht erneut entfallen lassen, solange der Tag frei bleibt */
    if(current&&current.action==='override'){if(!info){delete t.rc1810Holiday;out.changed++}return}
    var desired=null;
    if(info){var rule=ruleFor(info,cal),target=rule==='skip'?'':shiftInWeek(original,rule,cal);desired=target?{action:'moved',date:target}:{action:'skipped'}}
    if(same(desired,current))return;
    if(current&&current.action==='moved'&&userFinished(t)&&!desired){delete t.rc1810Holiday;out.changed++;return}
    if(current){restore(t);if(!desired)out.restored++}
    if(desired&&!userFinished(t)){applyOne(t,desired,info,original,now);if(desired.action==='moved')out.moved++;else out.skipped++}
    out.changed++;
  });
  return out;
}

/* ---- Speichern ---- */
function canWrite(){try{return typeof root.canWrite!=='function'||root.canWrite('tasks')!==false}catch(_){return true}}
function currentUserName(){try{var u=typeof root.__EXPORTHUB_GET_CURRENT_USER__==='function'?root.__EXPORTHUB_GET_CURRENT_USER__():null;return q(u&&(u.name||u.displayName||u.user))}catch(_){return ''}}
function persist(reason){
  try{if(root.ExportHUBClean&&typeof root.ExportHUBClean.queueSave==='function')root.ExportHUBClean.queueSave(reason);else if(typeof root.save==='function')root.save(reason)}catch(err){try{console.warn('RC1810 Speichern',err)}catch(_){}}
  try{root.dispatchEvent(new CustomEvent('exporthub:tasks-updated',{detail:{reason:reason,source:VERSION}}))}catch(_){}
}
function writeCalendar(s,mutate){
  var src=obj(s.taskCalendar)?clone(s.taskCalendar):{};
  src.closures=arr(src.closures).map(normalizeClosure).filter(Boolean);
  mutate(src);src.updatedAt=new Date().toISOString();src.updatedBy=currentUserName();
  s.taskCalendar=src;
}
function saveClosure(raw){
  var s=state();if(!s)throw new Error('Kein Datenstand geladen');
  if(!canWrite())throw new Error('Keine Berechtigung für Aufgaben');
  var c=normalizeClosure(Object.assign({},raw,{id:q(raw&&raw.id)||('rc1810-'+Date.now().toString(36))}));
  if(!c)throw new Error('Bitte Von- und Bis-Datum angeben');
  if(utc(c.endDate)-utc(c.startDate)>120*864e5)throw new Error('Zeitraum ist länger als 120 Tage');
  c.createdAt=c.createdAt||new Date().toISOString();c.createdBy=c.createdBy||currentUserName();
  writeCalendar(s,function(src){src.closures=src.closures.filter(function(x){return x.id!==c.id});src.closures.push(c)});
  var r=applyToTasks(s);persist('Aufgaben: freie Tage gespeichert ('+c.label+')');return{closure:c,result:r};
}
function removeClosure(id){
  var s=state();if(!s)return null;if(!canWrite())throw new Error('Keine Berechtigung für Aufgaben');
  writeCalendar(s,function(src){src.closures=src.closures.filter(function(x){return x.id!==q(id)})});
  var r=applyToTasks(s);persist('Aufgaben: freie Tage entfernt');return r;
}
function setHolidayRule(rule){
  var s=state();if(!s)return null;if(!canWrite())throw new Error('Keine Berechtigung für Aufgaben');
  writeCalendar(s,function(src){src.holidayRoutineRule=normalizeRule(rule,'prev')});
  var r=applyToTasks(s);persist('Aufgaben: Feiertagsregel geändert');return r;
}
function holidaysBetween(start,end,s){
  var cal=calendarOf(s||state()||{}),out=[];start=dayKey(start);end=dayKey(end);if(!start||!end)return out;
  for(var d=start,i=0;d<=end&&i<400;d=addDays(d,1),i++){var n=nonWork(d,cal);if(n&&n.type!=='weekend')out.push({date:d,type:n.type,label:n.label})}
  return out;
}

/* ---- automatisch anwenden ---- */
var timer=0,running=false;
function run(){
  timer=0;if(running||!canWrite())return;var s=state();if(!s||!Array.isArray(s.tasks))return;
  running=true;
  try{var r=applyToTasks(s);if(r.changed)persist('Aufgaben an Feiertage/Betriebsferien angepasst')}
  catch(err){try{console.warn('RC1810 Feiertage',err)}catch(_){}}
  finally{setTimeout(function(){running=false},50)}
}
function schedule(){if(timer)return;timer=setTimeout(run,400)}
if(typeof root.addEventListener==='function'){
  ['exporthub:ready','exporthub:state-loaded','exporthub:sync','exporthub:tasks-updated'].forEach(function(n){try{root.addEventListener(n,function(e){if(e&&e.detail&&e.detail.source===VERSION)return;schedule()})}catch(_){}});
  try{setTimeout(schedule,2500)}catch(_){}
}

root.ExportHUBTaskCalendar1810=Object.freeze({
  version:VERSION,cancelReason:CANCEL_REASON,calendar:function(s){return calendarOf(s||state()||{})},
  nonWork:function(key,s){return nonWork(key,calendarOf(s||state()||{}))},isWorkday:function(key,s){return isWorkday(key,calendarOf(s||state()||{}))},
  holidaysBetween:holidaysBetween,isRoutine:isRoutine,plannedDayOf:plannedDayOf,applyToTasks:applyToTasks,
  saveClosure:saveClosure,removeClosure:removeClosure,setHolidayRule:setHolidayRule,run:run,
  _shiftInWeek:function(key,rule,s){return shiftInWeek(key,rule,calendarOf(s||{}))},weekKeyOf:weekKeyOf,mondayOf:mondayOf,addDays:addDays,dayKey:dayKey
});
})(typeof window!=='undefined'?window:globalThis);
