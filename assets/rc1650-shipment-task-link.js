/* ExportHUB360 RC1650 – tasks follow shipments by customer number.
   A task that carries a customer number (Aufgabenansicht → "Kundennummer") is marked done as soon as a shipment
   for that customer number is created in the task's week, on the task's day or later (never a task still ahead),
   and for a task created by hand only by a shipment created on or after the day the task was created. Weekly plan tasks hand their customer number on to the
   next week's instance of the same series. Data stays in state.tasks; the server merges the changed fields. */
(function(w){
'use strict';
if(!w||w.__EXPORTHUB_RC1650_SHIPMENT_TASKS__)return;
w.__EXPORTHUB_RC1650_SHIPMENT_TASKS__=true;

var VERSION='RC1650';
var SOURCE='shipment:RC1650';
var LOOKBACK_DAYS=28;
var WEEKDAYS=['sonntag','montag','dienstag','mittwoch','donnerstag','freitag','samstag'];

function q(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function low(v){return q(v).toLowerCase()}
function arr(v){return Array.isArray(v)?v:[]}

/* customer numbers: several per field (comma, semicolon or line break), compared without spaces, case and leading zeros */
function numberKey(v){var s=low(v).replace(/\s+/g,'');if(/^\d+$/.test(s))s=s.replace(/^0+(?=\d)/,'');return s}
function customerNumbers(value){
  var out=[];
  (Array.isArray(value)?value:[value]).forEach(function(v){String(v==null?'':v).split(/[,;\n]+/).forEach(function(part){var k=numberKey(part);if(k&&out.indexOf(k)<0)out.push(k)})});
  return out
}
function taskCustomerNumbers(task){return customerNumbers(task&&(task.customerNumber||task.linkedAccount||task.customerAccount||task.account))}
function shipmentCustomerNumbers(sh,customers){
  if(!sh||typeof sh!=='object')return[];
  var raw=[sh.customerAccount,sh.customerNumber,sh.customerNo,sh.kundennummer,sh.account,sh.customerId];
  var c=sh.customer&&typeof sh.customer==='object'?sh.customer:null;
  if(c)raw.push(c.customerNumber,c.account,c.accountNumber);
  var id=low(sh.customerId);
  if(id)arr(customers).forEach(function(x){if(x&&low(x.id)===id)raw.push(x.customerNumber,x.account,x.accountNumber)});
  return customerNumbers(raw.filter(function(v){return q(v)}))
}

/* dates */
function pad(n){return String(n).padStart(2,'0')}
function dayKey(d){return d?d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()):''}
function atNoon(d){var x=new Date(d);x.setHours(12,0,0,0);return x}
function mondayOf(d){var x=atNoon(d),n=x.getDay()||7;x.setDate(x.getDate()-n+1);return x}
function isoWeekMonday(key){var m=q(key).match(/^(\d{4})-W(\d{1,2})$/);if(!m)return null;var mon=mondayOf(new Date(Number(m[1]),0,4,12));mon.setDate(mon.getDate()+(Number(m[2])-1)*7);return mon}
function parseDate(v){
  var s=q(v);if(!s)return null;
  var m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(m)return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12);
  m=s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);if(m)return new Date(Number(m[3]),Number(m[2])-1,Number(m[1]),12);
  if(/^\d{4}-\d{2}-\d{2}T/.test(s)){var d=new Date(s);if(!isNaN(d.getTime()))return atNoon(d)}
  return null
}
function taskDate(task){
  var keys=['dueAt','dueDate','plannedDate','plannedAt','date','targetDate','deadline'];
  for(var i=0;i<keys.length;i++){var d=parseDate(task&&task[keys[i]]);if(d)return d}
  var idx=WEEKDAYS.indexOf(low(task&&(task.day||task.originalDay||task.weekday)));
  if(idx<0)return null;
  var base=isoWeekMonday(task.weekKey||task.createdForWeek)||parseDate(task.sourceWeekStart);
  if(!base)return null;
  var x=new Date(base);x.setDate(x.getDate()+((idx||7)-1));return x
}
function shipmentCreated(sh){return parseDate(sh&&(sh.createdAt||sh.created||sh.createdOn))}

/* tasks */
function taskId(task){return q(task&&(task.id||task.taskId||task.uuid))}
function isDone(task){return !!(task&&(task.done===true||task.completed===true))||/^(erledigt|done|abgeschlossen|completed|archiviert|storniert|cancelled|canceled)$/i.test(q(task&&task.status))}
function isTemplate(task){return !!(task&&(task.isTemplate||task.template||task.recurringTemplate||task.repeatTemplate||task.isRecurringTemplate))}
function autoDone(task){return !(task&&task.autoDoneOnShipment===false)}
function seriesOf(task){return low(task&&(task.recurringSeriesId||task.weeklySeriesId||task.seriesId))}
function usedShipments(task){return arr(task&&task.doneByShipments).map(low).filter(Boolean)}
function shipmentKey(sh){return low(sh&&(sh.id||sh.shipmentId||sh.ref||sh.reference))}
function shipmentRef(sh){return q(sh&&(sh.ref||sh.reference||sh.shipmentRef||sh.referenceNumber||sh.id))}
function shipmentCounts(sh){
  if(!sh||typeof sh!=='object'||!shipmentKey(sh))return false;
  if(sh.deleted===true||sh.isDeleted===true||sh.__rc560Fresh===true&&!q(sh.createdAt))return false;
  return !/storniert|cancel+ed|gelöscht|deleted/i.test(q(sh.status||sh.processStatus||sh.shipmentStatus))
}

/* weekly series: the customer number set last on any instance applies to all open instances of that series,
   so next week's pick task already knows its customer */
function inheritSeries(tasks){
  var latest={},changed=[];
  tasks.forEach(function(t){
    var sid=seriesOf(t),at=q(t&&t.customerNumberSetAt);if(!sid||!at)return;
    if(!latest[sid]||at>q(latest[sid].customerNumberSetAt))latest[sid]=t
  });
  tasks.forEach(function(t){
    var sid=seriesOf(t),src=latest[sid];if(!src||src===t||isDone(t))return;
    if(q(t.customerNumberSetAt)>=q(src.customerNumberSetAt))return;
    var no=q(src.customerNumber||src.linkedAccount);
    t.customerNumber=no;t.linkedAccount=no;
    if(q(src.customerName)&&!q(t.customerName)){t.customerName=src.customerName;t.linkedCustomer=src.customerName}
    t.autoDoneOnShipment=src.autoDoneOnShipment!==false;
    t.customerNumberSetAt=src.customerNumberSetAt;
    changed.push(taskId(t))
  });
  return changed
}

/* one shipment completes one task: the task of the same day first, then the latest overdue one of that week;
   a task later in the week stays open (Tuesday's shipment never closes Friday's task, Tobias 2026-10-24) */
function pickTask(candidates,created){
  var c=dayKey(created),same=[],before=[];
  candidates.forEach(function(row){var k=row.key;if(k===c)same.push(row);else if(k<c)before.push(row)});
  if(same.length)return same[0];
  if(before.length)return before.sort(function(a,b){return a.key<b.key?1:-1})[0];
  return null
}

function reconcile(state,options){
  var opts=options||{},now=opts.now&&typeof opts.now.getTime==='function'?new Date(opts.now.getTime()):new Date(),actor=q(opts.actor);
  var s=state&&typeof state==='object'?state:{},tasks=arr(s.tasks),customers=arr(s.customers);
  var result={inherited:inheritSeries(tasks),completed:[]};
  var floor=atNoon(now);floor.setDate(floor.getDate()-LOOKBACK_DAYS);var floorKey=dayKey(floor);
  var used={};tasks.forEach(function(t){usedShipments(t).forEach(function(k){used[k]=1})});
  var open=[];
  tasks.forEach(function(t){
    if(!t||isTemplate(t)||isDone(t)||!autoDone(t))return;
    var nos=taskCustomerNumbers(t);if(!nos.length)return;
    var d=taskDate(t),key=d?dayKey(d):'';
    if(key&&key<floorKey)return;
    var created=parseDate(t.createdAt);
    // weekly plan instances are generated for the whole week and count from its start
    var generated=!!(seriesOf(t)||q(t.weekKey)||q(t.createdForWeek)||q(t.sourceWeekStart));
    open.push({task:t,nos:nos,key:key,week:d?dayKey(mondayOf(d)):'',since:created?dayKey(created):'',sinceMs:Date.parse(q(t.createdAt))||0,generated:generated})
  });
  if(!open.length)return result;
  var shipments=arr(s.shipments).filter(shipmentCounts).map(function(sh){var c=shipmentCreated(sh);return c?{sh:sh,created:c,createdMs:Date.parse(q(sh.createdAt||sh.created||sh.createdOn))||0,key:shipmentKey(sh)}:null})
    .filter(function(x){return x&&!used[x.key]&&dayKey(x.created)>=floorKey})
    .sort(function(a,b){return a.created-b.created});
  var taken={};
  shipments.forEach(function(x){
    var nos=shipmentCustomerNumbers(x.sh,customers);if(!nos.length)return;
    var week=dayKey(mondayOf(x.created)),c=dayKey(x.created);
    var candidates=open.filter(function(row){
      if(taken[taskId(row.task)])return false;
      if(!row.nos.some(function(n){return nos.indexOf(n)>=0}))return false;
      // a shipment older than the task never closes it; weekly plan instances count from the week's start (2026-10-24)
      if((!row.generated||!row.week)&&(row.sinceMs&&x.createdMs?row.sinceMs>x.createdMs:row.since&&row.since>c))return false;
      return row.week?row.week===week&&row.key<=c:true
    });
    if(!candidates.length)return;
    var hit=pickTask(candidates.map(function(row){return row.key?row:Object.assign({},row,{key:c})}),x.created);
    if(!hit)return;
    var t=hit.task,ref=shipmentRef(x.sh),at=new Date().toISOString();
    taken[taskId(t)]=1;used[x.key]=1;
    t.status='done';t.done=true;t.completed=true;t.completedAt=at;t.doneAt=at;
    t.completedBy=actor||ref;t.doneBy=t.completedBy;t.completionSource=SOURCE;
    t.doneByShipmentRef=ref;t.doneByShipments=usedShipments(t).concat([x.key]).slice(-20);
    t.updatedAt=at;
    result.completed.push({taskId:taskId(t),shipmentRef:ref})
  });
  return result
}

/* runtime */
function state(){try{if(typeof w.__EXPORTHUB_GET_STATE__==='function'){var s=w.__EXPORTHUB_GET_STATE__();if(s&&typeof s==='object')return s}}catch(_){}return null}
function currentUser(){try{if(typeof w.__EXPORTHUB_GET_CURRENT_USER__==='function'){var u=w.__EXPORTHUB_GET_CURRENT_USER__();if(u)return u}}catch(_){}var s=state()||{};return s.currentUser||{}}
function canWrite(){try{return typeof w.canWrite!=='function'||w.canWrite('tasks')!==false}catch(_){return true}}
var running=false,timer=0;
function run(){
  timer=0;var s=state();if(!s||running||!canWrite())return null;
  running=true;
  try{
    var u=currentUser(),res=reconcile(s,{actor:q(u.name||u.displayName||u.user)});
    if(res.completed.length||res.inherited.length){
      try{if(w.ExportHUBClean&&typeof w.ExportHUBClean.queueSave==='function')w.ExportHUBClean.queueSave('RC1650 Aufgaben mit Sendungen abgeglichen');else if(typeof w.save==='function')w.save()}catch(err){try{console.warn('RC1650 save',err)}catch(_){}}
      try{w.dispatchEvent(new CustomEvent('exporthub:tasks-updated',{detail:{reason:'RC1650 shipment',source:SOURCE,completed:res.completed,inherited:res.inherited}}))}catch(_){}
    }
    return res
  }catch(err){try{console.warn('RC1650 tasks',err)}catch(_){}return null}
  finally{running=false}
}
function schedule(e){if(e&&e.detail&&e.detail.source===SOURCE)return;if(timer)return;timer=setTimeout(run,400)}
function install(){
  if(typeof w.addEventListener!=='function')return;
  ['exporthub:ready','exporthub:sync','exporthub:state-loaded','exporthub:shipment-saved','exporthub:newshipment','exporthub:tasks-updated'].forEach(function(n){try{w.addEventListener(n,schedule)}catch(_){}});
  setTimeout(run,2500)
}

w.ExportHUBShipmentTaskLink1650=Object.freeze({version:VERSION,customerNumbers:customerNumbers,taskCustomerNumbers:taskCustomerNumbers,shipmentCustomerNumbers:shipmentCustomerNumbers,taskDate:taskDate,reconcile:reconcile,run:run});
install();
})(typeof window!=='undefined'?window:globalThis);
