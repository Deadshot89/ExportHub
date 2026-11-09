import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../assets/abholkalender.js';
// This package is ESM; the browser IIFE publishes its testable API on globalThis.
const cal=globalThis.ExportHubPickupCalendar;
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

test('RC1875: same REF is counted once and mixed transport stays partly open',()=>{
 const collected={...a,status:'Abgeholt',pickedUpAt:'2026-11-09T12:30:00Z',collectedPickupCollis:4,remainingPickupCollis:0};
 const duplicate={...collected,id:'another-blob-copy'};
 const status=model([pick],[collected,duplicate,b]).days[0].fixedStatus['FIX-UK'];
 assert.equal(status.shipments,2);
 assert.deepEqual(status.refs,['UK-A','UK-B']);
 assert.equal(status.total,7);
 assert.equal(status.collected,4);
 assert.equal(status.open,3);
 assert.equal(status.state,'partial','one picked-up REF must not mark all other open REF as complete');
 const root={innerHTML:''};
 const state={fixedPickups:fix,companyKey:'essentra',tasks:[pick],shipments:[collected,b],weekOffset:0,canEdit:false};
 cal.render(root,state,monday);
 assert.match(root.innerHTML,/data-pickup-shipment-key="UK-A"/);
 assert.match(root.innerHTML,/data-pickup-shipment-key="UK-B"/);
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

test('RC1875: clearing all Pick accounts never restores legacy FIX account',()=>{
 const cleared={...pick,customerNumber:'',linkedAccount:'',customerNumberSetAt:'2026-11-08T08:00:00Z'};
 const result=model([cleared],[a,b]).days[0].fixedStatus['FIX-UK'];
 assert.equal(result.fromTasks,true);
 assert.deepEqual(result.customerNumbers,[]);
 assert.deepEqual(result.refs,[]);
 assert.equal(result.shipments,0);
 assert.equal(result.legacyConflict,true);
});

test('RC1875: cleared canonical Pick account cannot resurrect stale linkedAccount',()=>{
 const cleared={...pick,customerNumber:'',linkedAccount:'00123',customerAccount:'00045'};
 const after=model([cleared],[a,b]).days[0].fixedStatus['FIX-UK'];
 assert.deepEqual(after.customerNumbers,[]);
 assert.deepEqual(after.refs,[]);
 const legacy={...pick};delete legacy.customerNumber;
 legacy.linkedAccount='00123';
 assert.deepEqual(cal.taskCustomerNumbers(legacy),['123'],'old tasks without canonical field still work');
});

test('RC1875: duplicate legacy FIX customer never creates two silent transport matches',()=>{
 const oldFix=[
  {id:'FIX-1',weekday:1,customerNumber:'123',active:true},
  {id:'FIX-2',weekday:1,customerNumber:'00123',active:true}
 ];
 const both=cal.buildCalendarModel({today:monday,companyKey:'essentra',fixedPickups:oldFix,tasks:[],shipments:[a]}).days[0].fixedStatus;
 assert.deepEqual(both['FIX-1'].refs,[]);
 assert.deepEqual(both['FIX-2'].refs,[]);
 assert.deepEqual(both['FIX-1'].conflicts,['123']);
 assert.deepEqual(both['FIX-2'].conflicts,['123']);
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

test('RC1875: cancelled tasks never create a FIX shipment link',()=>{
 const cancelled={...pick,status:'cancelled',cancelledAt:'2026-11-08T10:00:00Z'};
 const status=model([cancelled],[a,b]).days[0].fixedStatus['FIX-UK'];
 assert.deepEqual(status.refs,[]);
 assert.equal(status.fromTasks,false);
});

test('RC1875: wrong-environment FIX response and failed refresh cannot retain old REF links',async()=>{
 const source=fs.readFileSync('assets/abholkalender.js','utf8');
 const responses=[
  {ok:true,environment:'testservice',companyKey:'essentra',items:fix,canEdit:true},
  {ok:true,environment:'production',companyKey:'essentra',items:fix,canEdit:true},
  {ok:true,environment:'testservice',companyKey:'essentra',items:fix,canEdit:true},
  null
 ];
 const element={innerHTML:'',addEventListener(){},querySelector(selector){return selector==='.pickup-calendar'&&this.innerHTML.includes('pickup-calendar')?{}:null}};
 const context=vm.createContext({Date,Intl,Math,Number,String,Array,Object,JSON,Promise,console,
  fetch:async()=>{const next=responses.shift();if(!next)throw Error('FIX_NETWORK_UNREACHABLE');return{ok:true,status:200,json:async()=>next}}});
 vm.runInContext(source,context,{filename:'assets/abholkalender.js'});
 const view=context.ExportHubPickupCalendar.mount(element,{environment:'testservice',today:monday,tasks:[pick],shipments:[a]});
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(element.innerHTML,/data-pickup-shipment-key="UK-A"/);
 assert.equal(view.state.companyKey,'essentra');
 await view.refresh();
 assert.deepEqual(Array.from(view.state.fixedPickups),[]);
 assert.equal(view.state.companyKey,'');
 assert.equal(view.state.canEdit,false);
 assert.match(view.state.fixedError,/FIX_ENVIRONMENT_MISMATCH/);
 assert.doesNotMatch(element.innerHTML,/pickup-item pickup-item-fix/,'failed FIX refresh removes only unverified FIX links');
 assert.match(element.innerHTML,/pickup-item pickup-item-shipment/,'the standalone valid shipment remains visible');
 assert.match(element.innerHTML,/data-pickup-shipment-ref="UK-A"/,'standalone shipment stays independently openable');
 await view.refresh();
 assert.match(element.innerHTML,/data-pickup-shipment-key="UK-A"/);
 await view.refresh();
 assert.deepEqual(Array.from(view.state.fixedPickups),[]);
 assert.equal(view.state.companyKey,'');
 assert.equal(view.state.canEdit,false);
 assert.doesNotMatch(element.innerHTML,/pickup-item pickup-item-fix/,'failed FIX refresh removes only unverified FIX links');
 assert.match(element.innerHTML,/pickup-item pickup-item-shipment/,'the standalone valid shipment remains visible');
 assert.match(element.innerHTML,/data-pickup-shipment-ref="UK-A"/,'standalone shipment stays independently openable');
});

test('RC1875: late first FIX response cannot overwrite a newer successful refresh',async()=>{
 const source=fs.readFileSync('assets/abholkalender.js','utf8');
 const pending=[];
 const context=vm.createContext({Date,Intl,Math,Number,String,Array,Object,JSON,Promise,console,
   fetch:()=>new Promise(resolve=>pending.push(resolve))});
 vm.runInContext(source,context,{filename:'assets/abholkalender.js'});
 const root={innerHTML:'',addEventListener(){},querySelector(selector){return selector==='.pickup-calendar'&&this.innerHTML.includes('pickup-calendar')?{}:null}};
 const calendar=context.ExportHubPickupCalendar;
 const view=calendar.mount(root,{environment:'testservice',today:monday,tasks:[pick],shipments:[a]});
 assert.equal(pending.length,1);
 const newer=view.refresh();
 assert.equal(pending.length,2);
 pending[1]({ok:true,status:200,json:async()=>({ok:true,environment:'testservice',companyKey:'essentra',items:fix,canEdit:false})});
 await newer;
 assert.equal(view.state.fixedPickups.length,2);
 assert.equal(view.state.companyKey,'essentra');
 pending[0]({ok:true,status:200,json:async()=>({ok:true,environment:'testservice',companyKey:'legacy',items:[{id:'OLD',weekday:1,active:true}],canEdit:true})});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(view.state.fixedPickups.length,2);
 assert.equal(view.state.companyKey,'essentra');
 assert.equal(view.state.canEdit,false);
 assert.match(root.innerHTML,/data-pickup-shipment-key="/);
});

test('RC1875: opening FIX REF never selects another shipment with recycled ID',()=>{
 const source=fs.readFileSync('assets/abholkalender.js','utf8');
 let onClick=null;
 const opened=[];
 const context=vm.createContext({Date,Intl,Math,Number,String,Array,Object,JSON,Promise,console,
   fetch:()=>new Promise(()=>{})});
 vm.runInContext(source,context,{filename:'assets/abholkalender.js'});
 const root={innerHTML:'',addEventListener(name,handler){if(name==='click')onClick=handler},
   querySelector(selector){return selector==='.pickup-calendar'&&this.innerHTML.includes('pickup-calendar')?{}:null}};
 context.ExportHubPickupCalendar.mount(root,{
   environment:'testservice',today:monday,
   shipments:[{id:'RECYCLED',reference:'REF-A'},{id:'RECYCLED',reference:'REF-B'}],
   onOpenShipment:sh=>opened.push(sh.reference)
 });
 assert.equal(typeof onClick,'function');
 const click=(reference)=>onClick({target:{closest:()=>({getAttribute(name){return({
   'data-pickup-action':'open-shipment','data-pickup-shipment-key':'RECYCLED',
   'data-pickup-shipment-ref':reference
 })[name]??null}})}});
 click('REF-B');
 assert.deepEqual(opened,['REF-B']);
 click(null);
 assert.deepEqual(opened,['REF-B'],'ambiguous legacy ID is refused, not silently opened');
 assert.ok(context.ExportHubPickupCalendar.setShipments);
 assert.match(root.innerHTML,/pickup-error/);
});

test('RC1875: recurring Pick task mapping is deterministic by weekday and explicit target',()=>{
 const tueTask={...pick,id:'task-TUESDAY',weekdays:[2]};
 assert.equal(cal.taskOnPickupDay(pick,'2026-11-09',1),true);
 assert.equal(cal.taskOnPickupDay(pick,'2026-11-10',2),false);
 assert.equal(cal.taskOnPickupDay(tueTask,'2026-11-10',2),true);
 assert.equal(cal.taskOnPickupDay({...pick,dueDate:'2026-11-09'},'2026-11-16',1),false);
 assert.equal(cal.taskOnPickupDay({...pick,pickupTargetId:''},'2026-11-09',1),true);
});
