import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const api=fs.readFileSync('api/customer-avis/index.js','utf8');
const portal=fs.readFileSync('customer-avis.html','utf8');
const closureMail=require('../api/shared/avis-mail-html.js');
const avisSlots=require('../api/shared/customer-avis-slots.js');

const closure={
 enabled:true,startDate:'2026-12-21',endDate:'2027-01-01',
 lastPickupDate:'2026-12-18',lastPickupTime:'14:30',reopenDate:'2027-01-04',leadDays:21
};
const sh={id:'SHIP1',reference:'ABC123'};
const state={shipments:[sh],settings:{closureNotices:[closure]}};

function loadAvailability(){
 const from=api.indexOf('function publicClosureFields(notice){');
 const to=api.indexOf("function publicShipment(sh,session,state,language='de'){",from);
 assert.ok(from>=0&&to>from,'closure implementation must precede publicShipment');
 const code=api.slice(from,to)+'\nmodule.exports={availabilityWithClosure,publicClosureNotices};';
 class FixedDate extends Date{
  constructor(...args){super(...(args.length?args:['2026-12-14T12:00:00Z']))}
  static now(){return Date.parse('2026-12-14T12:00:00Z')}
 }
 const box={module:{exports:{}},avisSlots,closureMail,shipmentCopies:s=>s.shipments,
  sid:s=>s.id,sref:s=>s.reference,Date:FixedDate};
 vm.runInNewContext(code,box,{filename:'customer-avis-close-dates.js'});
 return box.module.exports;
}

test('Issue #1328: customer and manual availability return no pickup slots on a valid closure date',()=>{
 const {availabilityWithClosure}=loadAvailability();
 const closed=availabilityWithClosure(state,sh,'2026-12-24');
 const weekend=availabilityWithClosure(state,sh,'2027-01-02');
 assert.equal(weekend.closed,true,'collection must remain closed until reopening');
 assert.equal(weekend.slots.length,0);
 assert.equal(closed.closed,true);
 assert.equal(closed.date,'2026-12-24');
 assert.equal(closed.slots.length,0);
 assert.equal(closed.closure.reopenDate,'2027-01-04');
 assert.equal(closed.closure.lastPickupTime,'14:30');

 const before=availabilityWithClosure(state,sh,'2026-12-18');
 const after=availabilityWithClosure(state,sh,'2027-01-04');
 assert.equal(before.slots.length,avisSlots.SLOT_DEFINITIONS.length);
 assert.equal(after.slots.length,avisSlots.SLOT_DEFINITIONS.length);
 assert.notEqual(before.closed,true);
});

test('Issue #1328: only active approved closure details are exposed to authorized AVIS sessions',()=>{
 const {publicClosureNotices}=loadAvailability();
 const result=publicClosureNotices(state);
 assert.equal(result.length,1);
 assert.equal(result[0].startDate,'2026-12-21');
 assert.equal(result[0].reopenDate,'2027-01-04');
 assert.equal(result[0].leadDays,undefined);
 assert.equal(result[0].enabled,undefined);
 assert.equal(publicClosureNotices({settings:{closureNotices:[{...closure,enabled:false}]}}).length,0);
});

test('Issue #1328: customer and manual booking reject closure before a slot write',()=>{
 const first=api.indexOf('async function saveAppointment(');
 const second=api.indexOf('async function saveManualAppointment(',first);
 const end=api.indexOf('function sessionFromRequest(',second);
 assert.ok(first>0&&second>first&&end>second);
 for(const fn of [api.slice(first,second),api.slice(second,end)]){
  const guard=fn.indexOf('closureMail.closureForPickupSlot(state,checked.date,checked.from,checked.to)');
  const slot=fn.indexOf('avisSlots.slotState');
  const apply=fn.indexOf('applyAppointment(')>=0?fn.indexOf('applyAppointment('):fn.indexOf('applyManualAppointment(');
  assert.ok(guard>=0&&slot>guard&&apply>slot,'booking must reject closed date before capacity check and writing');
  assert.match(fn,/PICKUP_BUSINESS_CLOSED/);
 }
 assert.match(api,/if\(postAction==='availability'\)[\s\S]*?availability:availabilityWithClosure\(state,sh,date\)/);
 assert.match(api,/if\(action==='manual-availability'\)[\s\S]*?availability:availabilityWithClosure\(state,target,date\)/);
});

test('Issue #1328: external AVIS page shows the notice in six languages and hides closed days',()=>{
 assert.match(portal,/portalClosureBanner\(data\.closureNotices,false\)/);
 assert.match(portal,/if\(availability\.closed\)return portalClosureBanner\(\[availability\.closure\],true\)/);
 assert.match(portal,/err&&err\.code==='PICKUP_BUSINESS_CLOSED'/);
 assert.match(portal,/rc1328-portal-closure/);
 for(const name of ['de','en','pl','es','fr','it']){
  assert.match(portal,new RegExp('\\b'+name+':\\{title:'));
 }
});


test('Issue #1328: internal manual pickup shows localized closed-day warnings and disables selection',()=>{
 const manual=fs.readFileSync('assets/rc1014-shipment-overview.js','utf8');
 assert.match(manual,/if\(availability\.closed===true\)\{/);
 assert.match(manual,/panel\.dataset\.rc1328ClosureBlocked='1'/);
 assert.match(manual,/setManualPickupStatus\(panel,tr\('closureMail\.bookingClosed'\),'error'\)/);
 assert.match(manual,/if\(panel\.dataset\.rc1328ClosureBlocked==='1'\)/);
 assert.match(manual,/e\.code==='PICKUP_BUSINESS_CLOSED'/);
 assert.match(manual,/option\.disabled=slot\.closedForPickup===true\|\|/,'existing selected slots beyond the final cutoff must remain disabled');
 for(const language of ['de','en','pl','es','fr','it']){
  const dict=JSON.parse(fs.readFileSync('assets/i18n/'+language+'.json','utf8'));
  assert.ok(dict['closureMail.bookingClosed']?.length>25,language+' needs booking warning');
  for(const placeholder of ['{{last}}','{{time}}','{{reopen}}'])assert.ok(dict['closureMail.pickupWarning']?.includes(placeholder),language+' warning must state actual collection cutoff');
 }
});


test('Issue #1328: final pickup day retains early windows and blocks those crossing the deadline',()=>{
 const {availabilityWithClosure}=loadAvailability();
 const available=availabilityWithClosure(state,sh,'2026-12-18');
 const early=available.slots.find(slot=>slot.to==='14:30');
 const late=available.slots.find(slot=>slot.to==='16:00');
 assert.equal(early?.available,true);
 assert.equal(late?.available,false);
 assert.equal(late?.closedForPickup,true);
 assert.equal(late?.remaining,0);
 assert.notEqual(available.closed,true);
});


test('Issue #1328: rejected customer and internal bookings do not check slots, write state or add history',async()=>{
 const start=api.indexOf('async function saveAppointment('),middle=api.indexOf('async function saveManualAppointment(',start),end=api.indexOf('function sessionFromRequest(',middle);
 assert.ok(start>=0&&middle>start&&end>middle);
 const checks={slots:0,writes:0,appointments:0,reads:0};
 const original=structuredClone(state);
 const sandbox={
  MAX_RETRIES:1,closureMail,
  async readTeam(){checks.reads++;return{value:{state:original},etag:'etag-1'}},
  obj:v=>Boolean(v&&typeof v==='object'&&!Array.isArray(v)),
  findShipment:()=>original.shipments[0],
  findManualAppointmentShipment:()=>original.shipments[0],
  dateTimeOf:()=>'',sid:v=>v.id,sref:v=>v.reference,
  validateAppointment:p=>({date:p.pickupDate,from:p.timeFrom,to:p.timeTo}),
  sanitizeManualAppointment:p=>({date:p.pickupDate,from:p.timeFrom,to:p.timeTo,carrier:'Carrier',shipmentNumber:'N1'}),
  error:(code,message,status)=>Object.assign(new Error(message),{code,status}),
  avisSlots:{slotState(){checks.slots++;throw Error('No slot lookup before closure guard')}},
  applyAppointment(){checks.appointments++;throw Error('Must not modify history')},
  applyManualAppointment(){checks.appointments++;throw Error('Must not modify history')},
  async writeTeam(){checks.writes++;throw Error('Must not persist')},
  text:v=>String(v==null?'':v),Date
 };
 vm.runInNewContext(api.slice(start,middle)+'\nthis.saveCustomer=saveAppointment;',sandbox);
 vm.runInNewContext(api.slice(middle,end)+'\nthis.saveInternal=saveManualAppointment;',sandbox);
 const input={pickupDate:'2026-12-19',timeFrom:'08:30',timeTo:'10:30'};
 const late={pickupDate:'2026-12-18',timeFrom:'14:00',timeTo:'16:00'};
 for(const payload of [input,late]){
  await assert.rejects(
   ()=>sandbox.saveCustomer({}, {record:{subjectId:sh.id,reference:sh.reference}},'session',payload),
   err=>err.code==='PICKUP_BUSINESS_CLOSED'&&err.status===409
  );
  await assert.rejects(
   ()=>sandbox.saveInternal({},sh.id,sh.reference,payload,'Dispatcher'),
   err=>err.code==='PICKUP_BUSINESS_CLOSED'&&err.status===409
  );
 }
 assert.deepEqual(checks,{slots:0,writes:0,appointments:0,reads:4});
 assert.deepEqual(original,state,'denied bookings must leave shipment state unchanged');
});
