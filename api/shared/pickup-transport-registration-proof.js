'use strict';

// RC1876: prove a concrete registered main shipment from persisted server data.
// This module has no HTTP route, mutation, fallback name matching or token output.
// Its caller must authenticate/authorize access to the company and source data.
const rules=require('./pickup-transport-association-rules');
function text(v){return String(v==null?'':v).trim()}
function fail(code,message){const e=new Error(message);e.code=code;e.status=409;throw e}
function verify({environment,companyKey,pickupDate,pickupTargetId,subject,pickupRecord,shipments,fixedTargets}={}){
 const env=text(environment),company=rules.key(companyKey),day=rules.date(pickupDate),target=text(pickupTargetId);
 if(!['production','testservice'].includes(env)||!company||!day||!target)
   fail('TRANSPORT_SCOPE_INVALID','Invalid transport verification scope');
 if(!subject)fail('TRANSPORT_NOT_REGISTERED','No issued pickup registration for main shipment');
 if(subject.environment!==env||!text(subject.subjectId)||!text(subject.shipmentId)||subject.subjectId!==subject.shipmentId)
   fail('TRANSPORT_SUBJECT_MISMATCH','Pickup subject is not a main shipment');
 const id=text(subject.shipmentId),reference=text(subject.reference).toUpperCase(),resourceKey=text(subject.resourceKey);
 if(!reference||!/^[a-f0-9]{64}$/i.test(resourceKey))
   fail('TRANSPORT_REGISTRATION_INVALID','Pickup registration has no matching storage identity');
 if(!pickupRecord||pickupRecord.environment!==env||text(pickupRecord.accessKey)!==resourceKey||
   text(pickupRecord.shipmentId)!==id||text(pickupRecord.reference).toUpperCase()!==reference||
   text(pickupRecord.subShipmentId))
   fail('TRANSPORT_PICKUP_MISMATCH','Stored pickup record does not match its parent registration');
 if(rules.isCancelled(pickupRecord)||rules.isComplete(pickupRecord)||
   pickupRecord.complete===true||/^(?:confirmed|abgeholt|completed)$/.test(text(pickupRecord.status).toLowerCase()))
   fail('TRANSPORT_PICKUP_LOCKED','Pickup has been cancelled or completed');
 const fixed=(Array.isArray(fixedTargets)?fixedTargets:[]).filter(t=>text(t&&t.id)===target&&t.active!==false);
 if(fixed.length!==1)fail('TRANSPORT_FIX_UNVERIFIED','Fixed pickup target is missing or ambiguous');
 if(Number(fixed[0].weekday)!==(new Date(day+'T12:00:00Z').getUTCDay()||7))
   fail('TRANSPORT_FIX_WRONG_DAY','Fixed pickup target does not belong to the planned weekday');
 const candidates=Array.isArray(shipments)?shipments:[];
 const matches=candidates.filter(sh=>text(sh&&(sh.shipmentId||sh.id))===id);
 if(!matches.length)fail('TRANSPORT_SHIPMENT_NOT_FOUND','Main shipment not found in saved team state');
 // Multiple copies in shipments/savedShipments are safe only when every
 // authoritative identifying field is identical. Never pick one arbitrarily.
 const signatures=new Set(matches.map(sh=>JSON.stringify([
   text(sh.reference||sh.ref||sh.shipmentRef).toUpperCase(),
   rules.key(sh.companyKey||sh.companyId),
   rules.date(text(sh.plannedPickupDate||sh.pickupDate||sh.pickdate).slice(0,10)),
   text(sh.pickupTargetId),rules.key(sh.pickupTargetCompanyKey||company),
   !!rules.isCancelled(sh),!!rules.isComplete(sh)
 ])));
 if(signatures.size!==1)fail('TRANSPORT_SHIPMENT_AMBIGUOUS','Inconsistent shipment copies');
 const sh=matches[0],shRef=text(sh.reference||sh.ref||sh.shipmentRef).toUpperCase();
 if(shRef!==reference||rules.key(sh.companyKey||sh.companyId)!==company)
   fail('TRANSPORT_SHIPMENT_MISMATCH','Main shipment reference or company differs');
 if(rules.date(text(sh.plannedPickupDate||sh.pickupDate||sh.pickdate).slice(0,10))!==day)
   fail('TRANSPORT_DATE_MISMATCH','Main shipment pickup day differs');
 if(rules.isCancelled(sh)||rules.isComplete(sh))
   fail('TRANSPORT_SHIPMENT_LOCKED','Main shipment is cancelled or collected');
 if(text(sh.pickupTargetId)!==target||rules.key(sh.pickupTargetCompanyKey||company)!==company)
   fail('TRANSPORT_FIX_BINDING_MISSING','No explicit persisted main shipment to FIX binding');
 return {id,shipmentId:id,primaryShipmentId:id,reference,pickupTargetId:target,
   companyKey:company,environment:env,pickupDate:day,registered:true};
}
// Read ONLY from trusted server APIs, never from submitted browser snapshots.
// No ledger write occurs; unverified registration fails closed.
async function inspect({environment,companyKey,pickupDate,pickupTargetId,shipmentId,team,
  accessStore,pickupStore,fixedStore}={}){
 const env=text(environment),id=text(shipmentId);
 if(!id||!accessStore||!pickupStore||!fixedStore||!team)
   fail('TRANSPORT_EVIDENCE_MISSING','Authoritative transport sources unavailable');
 const subject=await accessStore.inspectPickupSubject(env,id);
 if(!subject)fail('TRANSPORT_NOT_REGISTERED','Main pickup has not been registered');
 const [pickup,fixedTargets]=await Promise.all([
   pickupStore.getRecord(subject.resourceKey,env),fixedStore.list(env,companyKey)
 ]);
 const state=team&&team.state||{};
 const shipments=[...(Array.isArray(state.shipments)?state.shipments:[]),
   ...(Array.isArray(state.savedShipments)?state.savedShipments:[])];
 return verify({environment:env,companyKey,pickupDate,pickupTargetId,subject,
   pickupRecord:pickup&&pickup.record,shipments,fixedTargets});
}
module.exports={verify,inspect};
