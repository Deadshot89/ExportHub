'use strict';

// RC1876 – Pure, server-side rules for proposed grouped-pickup associations.
// Source arrays are immutable evidence from an authenticated server caller.
// A proposal cannot change shipment, pickup, document or task state.

function text(value){ return String(value == null ? '' : value).trim(); }
function key(value){return text(value).toLowerCase().normalize('NFKD').replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)}
function date(value){
  const s=text(value);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return '';
  const d=new Date(s+'T12:00:00Z');
  return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s?s:'';
}
function normNumbers(value){
  const out=[];
  for(const part of text(value).split(/[,;\n]+/)){
    let num=part.trim().toLowerCase().replace(/\s+/g,'');
    if(/^\d+$/.test(num))num=num.replace(/^0+(?=\d)/,'');
    if(num&&!out.includes(num))out.push(num);
  }
  return out;
}
function taskNumbers(task){
  const t=task&&typeof task==='object'?task:{};
  if(Object.prototype.hasOwnProperty.call(t,'customerNumber'))return normNumbers(t.customerNumber);
  return normNumbers(t.linkedAccount||t.customerAccount||'');
}
function shipmentNumbers(sh){
  const x=sh&&typeof sh==='object'?sh:{},nested=x.customer&&typeof x.customer==='object'?x.customer:{};
  const out=[];
  for(const v of [x.customerAccount,x.customerNumber,x.customerNo,x.kundennummer,x.account,x.customerId,nested.customerNumber,nested.account]){
    if(v==null||typeof v==='object')continue;
    for(const n of normNumbers(v))if(!out.includes(n))out.push(n);
  }
  return out;
}
function ref(sh){return text(sh&&(sh.reference||sh.ref||sh.shipmentRef||sh.id)).toUpperCase()}
function shipmentStatus(sh){
  const x=sh&&typeof sh==='object'?sh:{};
  return ['pickupStatus','shipmentStatus','processStatus','status'].map(k=>text(x[k]).toLowerCase());
}
function isCancelled(sh){return shipmentStatus(sh).some(s=>/^(?:storniert|cancelled|canceled|gelöscht|deleted)$/.test(s))}
function isComplete(sh){
  const x=sh&&typeof sh==='object'?sh:{};
  if(shipmentStatus(x).some(s=>/^(?:abgeholt|picked up|completed|abgeschlossen|archiviert|archived|pod vorhanden|pod available)$/.test(s)))return true;
  if(['pickedUpAt','pickupConfirmedAt','qrPickupConfirmedAt','pickupCompletedAt','actualPickupAt','actualPickupDate','collectedAt','podServerVerifiedAt'].some(k=>!!text(x[k])))return true;
  const expected=Number(x.expectedColliCount||x.totalCollis||x.totalColli||x.colliCount)||0;
  const remaining=x.remainingPickupCollis??x.pickupRemainingColliCount;
  return expected>0&&remaining!==undefined&&remaining!==null&&Number(remaining)===0;
}
function taskForDate(task,pickupDate){
  const x=task&&typeof task==='object'?task:{};
  if(x.cancelledAt||x.canceledAt||/^(?:cancelled|canceled|storniert|deleted|gelöscht)$/i.test(text(x.status)))return false;
  const exact=text(x.plannedDate||x.dueDate||x.date||x.targetDate||x.dueAt).slice(0,10);
  if(exact)return exact===pickupDate;
  const day=new Date(pickupDate+'T12:00:00Z').getUTCDay();
  if(Array.isArray(x.weekdays)&&x.weekdays.length)return x.weekdays.map(Number).includes(day===0?7:day);
  const weekdayName=['sonntag','montag','dienstag','mittwoch','donnerstag','freitag','samstag'][day];
  return !!(x.recurrence==='weekly'||x.seriesId||x.isTemplate||x.masterTaskRC848)&&
    (text(x.day||x.originalDay||x.weekday).toLowerCase()===weekdayName||Number(x.weekday)===day);
}
function companyOf(record){return key(record&&(record.companyKey||record.companyId))}
function shipmentDate(sh){const x=sh&&typeof sh==='object'?sh:{};return date(text(x.plannedPickupDate||x.pickupDate||x.pickdate).slice(0,10))}
function conflict(code,ref,detail){return {code,ref:text(ref),detail:text(detail)}}

function propose({companyKey,environment,pickupDate,transports,tasks,shipments,existingLinks}={}){
  const company=key(companyKey),day=date(pickupDate),env=text(environment);
  if(!company||!day||!['production','testservice'].includes(env))throw Object.assign(new Error('Invalid association scope'),{code:'ASSOCIATION_SCOPE_INVALID',status:400});
  const actualTransports=Array.isArray(transports)?transports:[],actualTasks=Array.isArray(tasks)?tasks:[],actualShipments=Array.isArray(shipments)?shipments:[];
  const links=Array.isArray(existingLinks)?existingLinks:[];
  const active=actualTransports.filter(t=>t&&text(t.id||t.transportId)&&text(t.pickupTargetId)&&companyOf(t)===company&&date(t.pickupDate||t.plannedPickupDate)===day&&t.registered===true&&!isCancelled(t));
  const eligibleTasks=actualTasks.filter(t=>t&&text(t.pickupTargetId)&&key(t.pickupTargetCompanyKey)===company&&taskForDate(t,day));
  const byAccount=new Map(),byFixed=new Map();
  for(const task of eligibleTasks){
    const id=text(task.pickupTargetId);
    if(!byFixed.has(id))byFixed.set(id,new Set());
    for(const number of taskNumbers(task)){
      byFixed.get(id).add(number);
      if(!byAccount.has(number))byAccount.set(number,new Set());
      byAccount.get(number).add(id);
    }
  }
  const proposals=[],conflicts=[],seenRefs=new Map(),validIds=new Set(active.map(t=>text(t.id||t.transportId)));
  const transportByFixed=new Map();
  for(const t of active){const fid=text(t.pickupTargetId);if(!transportByFixed.has(fid))transportByFixed.set(fid,[]);transportByFixed.get(fid).push(t)}
  const shipmentByRef=new Map();
  for(const s of actualShipments){
    const r=ref(s);if(!r)continue;
    if(shipmentByRef.has(r)){conflicts.push(conflict('SHIPMENT_REF_AMBIGUOUS',r,'Duplicate shipment identifier'));shipmentByRef.set(r,null)}
    else shipmentByRef.set(r,s);
  }
  for(const [r,sh] of shipmentByRef){
    if(!sh||isCancelled(sh)||isComplete(sh))continue;
    if(companyOf(sh)!==company||shipmentDate(sh)!==day)continue;
    const numbers=shipmentNumbers(sh);if(!numbers.length)continue;
    const eligible=active.filter(t=>{
      const fid=text(t.pickupTargetId),mapped=byFixed.get(fid);
      return mapped&&numbers.some(n=>mapped.has(n));
    });
    const matches=eligible.map(t=>text(t.id||t.transportId));
    const matchingOwners=new Set(numbers.flatMap(n=>Array.from(byAccount.get(n)||[])));
    if(matchingOwners.size>1||new Set(matches).size>1){conflicts.push(conflict('TRANSPORT_ASSIGNMENT_AMBIGUOUS',r,matches.join(',')));continue}
    if(matches.length!==1)continue;
    const existing=links.filter(l=>text(l.ref).toUpperCase()===r&&l.active!==false);
    if(existing.length>1){conflicts.push(conflict('MULTIPLE_EXISTING_LINKS',r,'More than one active link'));continue}
    const t=eligible[0],transportId=matches[0];
    if(existing.length){
      const old=existing[0];
      if(text(old.transportId)!==transportId||text(old.pickupDate)!==day){
        conflicts.push(conflict(old.mode==='manual'?'MANUAL_OVERRIDE_PROTECTED':'EXISTING_LINK_CONFLICT',r,text(old.transportId)));
      }
      continue;
    }
    if(seenRefs.has(r)&&seenRefs.get(r)!==transportId){conflicts.push(conflict('DUPLICATE_TRANSPORT',r,transportId));continue}
    seenRefs.set(r,transportId);
    if(!validIds.has(transportId))continue;
    proposals.push({ref:r,transportId,pickupDate:day,fixId:text(t.pickupTargetId),customerNumbers:numbers.filter(n=>(byFixed.get(text(t.pickupTargetId))||new Set()).has(n)),mode:'automatic'});
  }
  return {companyKey:company,environment:env,pickupDate:day,proposals,conflicts};
}
module.exports={key,date,normNumbers,taskNumbers,shipmentNumbers,ref,isCancelled,isComplete,taskForDate,propose};
