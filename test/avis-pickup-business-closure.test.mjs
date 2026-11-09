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
 for(const language of ['de','en','pl','es','fr','it']){
  const dict=JSON.parse(fs.readFileSync('assets/i18n/'+language+'.json','utf8'));
  assert.ok(dict['closureMail.bookingClosed']?.length>25,language+' needs booking warning');
 }
});
