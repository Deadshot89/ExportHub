import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const cal=require('../assets/abholkalender.js');
const tasksSource=fs.readFileSync('assets/rc1570-tasks-focus.js','utf8');
const runtime=fs.readFileSync('assets/rc1012-abholkalender-runtime.js','utf8');
const dict=fs.readFileSync('assets/i18n/rc1570-tasks-focus.js','utf8');

const monday=new Date(2026,10,9,12),tuesday=new Date(2026,10,10,12);
const fix=[
 {id:'FIX-UK',siteLabel:'Essentra UK',weekday:1,customerNumber:'00999',active:true},
 {id:'FIX-FR',siteLabel:'France',weekday:1,customerNumber:'',active:true}
];
const pick={id:'task-UK',title:'Picken UK',pickupTargetId:'FIX-UK',pickupTargetCompanyKey:'essentra',customerNumber:'00123, 00045, 00067',recurrence:'weekly',weekdays:[1]};
const shipment=(ref,customerNumber,expectedColliCount,collectedPickupCollis=0)=>({
 id:ref,reference:ref,customerNumber,plannedPickupDate:'2026-11-09',
 status:'Bereit zur Abholung',expectedColliCount,collectedPickupCollis,
 remainingPickupCollis:expectedColliCount-collectedPickupCollis
});
const a=shipment('UK-A','123',4,1),b=shipment('UK-B','45',3);
const copy=x=>JSON.parse(JSON.stringify(x));
const model=(tasks,shipments,day=monday)=>cal.buildCalendarModel({today:day,companyKey:'essentra',fixedPickups:fix,tasks,shipments});

test('RC1875: linked Pick task is source of truth for FIX customer numbers and REF/Colli',()=>{
 const original=copy([a,b,pick]);
 const result=model([pick],[a,b]).days[0].fixedStatus['FIX-UK'];
 assert.equal(result.fromTasks,true);
 assert.deepEqual(result.customerNumbers,['123','45','67']);
 assert.deepEqual(result.refs,['UK-A','UK-B']);
 assert.equal(result.shipments,2);
 assert.deepEqual([result.total,result.collected,result.open],[7,1,6]);
 assert.equal(result.state,'partial');
 assert.equal(result.legacyConflict,true,'old FIX number is migration note only');
 assert.deepEqual(copy([a,b,pick]),original,'read-only planning must not alter tasks, QR, POD or shipment statuses');
});

test('RC1875: new shipment becomes visible; removed customer number never returns through stale FIX account',()=>{
 const later=shipment('UK-C','00067',2);
 const first=model([pick],[a,b,later]).days[0].fixedStatus['FIX-UK'];
 assert.deepEqual(first.refs,['UK-A','UK-B','UK-C']);
 const changed={...pick,customerNumber:'00045, 00067',customerNumberSetAt:'2026-11-07T10:00:00Z'};
 const next=model([changed],[a,b,later]).days[0].fixedStatus['FIX-UK'];
 assert.deepEqual(next.customerNumbers,['45','67']);
 assert.deepEqual(next.refs,['UK-B','UK-C']);
 assert.equal(next.shipments,2);
 assert.equal(next.total,5);
 assert.equal(next.legacyConflict,true);
});

test('RC1875: another weekday cannot receive same REF; canceled shipments never attach',()=>{
 const other=model([pick],[a,b],tuesday).today.fixedStatus['FIX-UK'];
 assert.equal(other,undefined,'Monday FIX is not rendered Tuesday');
 const canceled={...a,status:'Storniert'};
 const mon=model([pick],[canceled,b]).days[0].fixedStatus['FIX-UK'];
 assert.deepEqual(mon.refs,['UK-B']);
 const noTasks=model([],[a,b]).days[0].fixedStatus['FIX-UK'];
 assert.equal(noTasks.shipments,0,'unrelated legacy FIX customer 999 cannot auto-match UK');
});

test('RC1875: linked target never leaks across company contexts',()=>{
 const wrong=cal.buildCalendarModel({today:monday,companyKey:'another-company',fixedPickups:fix,tasks:[pick],shipments:[a,b]}).days[0].fixedStatus['FIX-UK'];
 assert.deepEqual(wrong.refs,[]);
 assert.equal(wrong.fromTasks,false);
 const absent=cal.buildCalendarModel({today:monday,fixedPickups:fix,tasks:[pick],shipments:[a,b]}).days[0].fixedStatus['FIX-UK'];
 assert.deepEqual(absent.refs,[]);
});

test('RC1875: ambiguous account assigned to two active FIX IDs is not silently linked',()=>{
 const competing={...pick,id:'task-FR',pickupTargetId:'FIX-FR',customerNumber:'45'};
 const result=model([pick,competing],[a,b]).days[0].fixedStatus;
 assert.deepEqual(result['FIX-UK'].conflicts,['45']);
 assert.deepEqual(result['FIX-UK'].refs,['UK-A']);
 assert.deepEqual(result['FIX-FR'].refs,[]);
 assert.equal(result['FIX-UK'].state,'conflict');
 assert.equal(result['FIX-FR'].state,'conflict');
});

test('RC1875: task editor persists stable target ID using canonical guarded task save',()=>{
 assert.match(tasksSource,/task\.pickupTargetId=q\(v\.pickupTargetId\)/);
 assert.match(tasksSource,/task\.pickupTargetCompanyKey=v\.pickupTargetId/);
 assert.match(tasksSource,/pickupTargetId:q\(f\.pickupTargetId&&f\.pickupTargetId\.value\)/);
 assert.match(tasksSource,/task\.customerNumber=v\.customerNo/);
 assert.match(tasksSource,/await persist\(isNew\?'RC1570 task created':'RC1570 task saved'/);
 assert.match(tasksSource,/var template=Object\.assign\(\{\},task\)/);
 assert.match(tasksSource,/fetch\('\/api\/fixed-pickups\?includeInactive=1'/);
 assert.match(tasksSource,/data\.environment!==env/);
 assert.match(tasksSource,/if\(forced==='demo'/);
 assert.match(runtime,/tasks: tasks\(\)/);
 assert.match(runtime,/calendar\.setTasks\(tasks\(\)\)/);
 assert.match(runtime,/exporthub:tasks-updated/);
 for(const key of ['fPickupTarget','fPickupNone','fPickupMissing','fPickupNeedsNumbers'])
  assert.equal((dict.match(new RegExp(key+':','g'))||[]).length,6,key+' must exist in every language');
});

test('RC1875: recurring Pick task mapping is deterministic by weekday and explicit target',()=>{
 const tueTask={...pick,id:'task-TUESDAY',weekdays:[2]};
 assert.equal(cal.taskOnPickupDay(pick,'2026-11-09',1),true);
 assert.equal(cal.taskOnPickupDay(pick,'2026-11-10',2),false);
 assert.equal(cal.taskOnPickupDay(tueTask,'2026-11-10',2),true);
 assert.equal(cal.taskOnPickupDay({...pick,dueDate:'2026-11-09'},'2026-11-16',1),false);
 assert.equal(cal.taskOnPickupDay({...pick,pickupTargetId:''},'2026-11-09',1),true);
});
