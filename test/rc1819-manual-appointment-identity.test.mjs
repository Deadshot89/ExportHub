import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const UI='assets/rc1014-shipment-overview.js';
const API='api/customer-avis/index.js';

function ui(state){
 const root={__EXPORTHUB_GET_STATE__:()=>state};
 root.globalThis=root;
 vm.runInNewContext(fs.readFileSync(UI,'utf8'),root,{filename:UI});
 return root.ExportHUBRC1014ShipmentOverview;
}
function backendMatch(state){
 const source=fs.readFileSync(API,'utf8');
 const start=source.indexOf('function manualAppointmentCopies(');
 const end=source.indexOf('function prefBool(',start);
 assert.ok(start>0&&end>start,'manual-appointment strict lookup source is present');
 const text=v=>String(v==null?'':v).trim();
 const context={text,upper:v=>text(v).toUpperCase(),
   shipmentCopies:s=>s.shipments,stamp:()=>0,error:(code,message,status)=>Object.assign(new Error(message),{code,status})};
 return vm.runInNewContext(source.slice(start,end)+'\n({manualAppointmentCopies,findManualAppointmentShipment})',context);
}

test('P0 planned appointment: Danfoss detail wins over stale Neff currentShipment',()=>{
 const dan={id:'DAN-01',reference:'DANFOSS',customerName:'Danfoss'};
 const neff={id:'NEFF-02',reference:'NEFF01',customerName:'Neff'};
 const state={shipmentViewId:'DANFOSS',shipments:[neff,dan],currentShipment:neff,shipment:neff};
 const runtime=ui(state);
 assert.equal(runtime.viewShipment(state).customerName,'Danfoss');
 state.shipmentViewId='NEFF-02';
 assert.equal(runtime.viewShipment(state).customerName,'Neff');
 state.shipmentViewId='UNKNOWN';
 assert.equal(runtime.viewShipment(state),null,'no stale fallback to previous customer');
});

test('P0 planned appointment: reused technical ID cannot select arbitrary customer',()=>{
 const dan={id:'REUSED',reference:'DANFOSS'};
 const neff={id:'REUSED',reference:'NEFF01'};
 const state={shipmentViewId:'REUSED',shipments:[neff,dan],currentShipment:neff};
 const runtime=ui(state);
 assert.equal(runtime.viewShipment(state),null,'duplicate technical IDs are ambiguous');
 state.shipmentViewRef='DANFOSS';
 assert.equal(runtime.viewShipment(state).reference,'DANFOSS');
});

test('P0 manual appointment API: Danfoss request never updates Neff with same technical ID',()=>{
 const {manualAppointmentCopies,findManualAppointmentShipment}=backendMatch({});
 const dan={id:'REUSED',reference:'DANFOSS'};
 const neff={id:'REUSED',reference:'NEFF01'};
 const state={shipments:[neff,dan]};
 const found=Array.from(manualAppointmentCopies(state,'REUSED','DANFOSS'));
 assert.equal(found.length,1);
 assert.equal(found[0].reference,'DANFOSS');
 assert.equal(findManualAppointmentShipment(state,'REUSED','DANFOSS').reference,'DANFOSS');
 assert.equal(manualAppointmentCopies(state,'WRONG-ID','DANFOSS').length,0);
 assert.equal(manualAppointmentCopies(state,'REUSED','').length,0);
});

test('P0 manual appointment API: REF-only collision fails closed',()=>{
 const {manualAppointmentCopies}=backendMatch({});
 assert.throws(()=>manualAppointmentCopies({shipments:[
 {id:'A',reference:'DANFOSS'},{id:'B',reference:'DANFOSS'}]},'DANFOSS','DANFOSS'),/Mehrere Sendungen/);
});

test('P0 appointment panel resets dirty fields and invalidates delayed Neff availability',()=>{
 const source=fs.readFileSync(UI,'utf8');
 assert.match(source,/panel\.dataset\.rc1370ShipmentIdentity!==identity/);
 assert.match(source,/panel\.dataset\.rc1370Dirty='';/);
 assert.match(source,/panel\.dataset\.rc1370AvailabilityDate='';/);
 assert.match(source,/panel\.dataset\.rc1370RequestSequence!==requestSeq/);
 assert.match(source,/manualPickupIdentity\(viewShipment\(state\(\)\)\)!==requestIdentity/);
 const api=fs.readFileSync(API,'utf8');
 assert.match(api,/target=findManualAppointmentShipment\(state,subjectId,reference\)/);
 assert.match(api,/manualAppointmentCopies\(state,sid\(target\),reference\)\.forEach/);
});

test('P0 slot capacity: reused technical ID must not exclude Neff',()=>{
 const slots=require('../api/shared/customer-avis-slots.js');
 const neff={id:'REUSED',reference:'NEFF01',customerAvisPickupDate:'2026-11-06',customerAvisPickupTimeFrom:'08:30',customerAvisPickupTimeTo:'10:30'};
 const result=slots.availabilityForDate([neff],'2026-11-06',{subjectId:'REUSED',reference:'DANFOSS'});
 const chosen=result.slots.find(s=>s.from==='08:30'&&s.to==='10:30');
 assert.ok(chosen,'08:30 slot exists');
 assert.equal(chosen.bookedPeak,1,'Neff counts as another shipment');
});
