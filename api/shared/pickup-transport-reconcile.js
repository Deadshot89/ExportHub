'use strict';

// RC1878 – server-only, opt-in reconciliation of REF children under a verified
// registered main transport. All evidence comes from the authenticated server.
// Never updates shipment/POD/QR/task records, only the separate audited ledger.
const rule=require('./pickup-transport-association-rules');
function text(v){return String(v==null?'':v).trim()}
function error(code,status=409){const e=new Error(code);e.code=code;e.status=status;return e}
function fingerprint(sh){
 return JSON.stringify([
  text(sh&&sh.id||sh&&sh.shipmentId),
  rule.ref(sh),
  rule.key(sh&&(sh.companyKey||sh.companyId)),
  text(sh&&(sh.plannedPickupDate||sh.pickupDate||sh.pickdate)).slice(0,10),
  rule.shipmentNumbers(sh).slice().sort(),
  rule.isCancelled(sh),rule.isComplete(sh)
 ]);
}
function shipmentsFromState(state){
 const arr=[...(Array.isArray(state&&state.shipments)?state.shipments:[]),
   ...(Array.isArray(state&&state.savedShipments)?state.savedShipments:[])];
 if(arr.length>30000)throw error('RECONCILE_TOO_MANY_SHIPMENTS',413);
 const unique=new Map(),ambiguous=[];
 for(const row of arr){
  if(!row||typeof row!=='object')continue;
  const ref=rule.ref(row),id=text(row.id||row.shipmentId);
  if(!ref||!id){ambiguous.push(row);continue}
  const k=ref+'|'+id,signature=fingerprint(row);
  if(!unique.has(k)){unique.set(k,{row,signature})}
  else if(unique.get(k).signature!==signature)ambiguous.push(row);
 }
 return [...Array.from(unique.values()).map(x=>x.row),...ambiguous];
}
async function reconcile({
 environment,companyKey,pickupDate,team,actor,
 bindingStore,linkStore,registrationProof,accessStore,pickupStore,fixedStore
}={}){
 const env=text(environment),company=rule.key(companyKey),day=rule.date(pickupDate);
 if(!['testservice','production'].includes(env)||!company||!day||!team||!actor||
    !bindingStore||!linkStore||!registrationProof||!accessStore||!pickupStore||!fixedStore)
   throw error('RECONCILE_SCOPE_INVALID',400);
 const snapshot=team&&team.state||{},tasks=Array.isArray(snapshot.tasks)?snapshot.tasks:[],
   shipments=shipmentsFromState(snapshot);
 const bound=await bindingStore.read({environment:env,companyKey:company});
 const targets=(Array.isArray(bound.bindings)?bound.bindings:[])
   .filter(b=>b&&b.active===true&&b.pickupDate===day);
 if(targets.length>50)throw error('RECONCILE_TOO_MANY_TRANSPORTS',413);
 const transports=[],rejected=[];
 for(const b of targets){
  try{
   const verified=await registrationProof.inspect({
    environment:env,companyKey:company,pickupDate:day,pickupTargetId:b.pickupTargetId,
    shipmentId:b.shipmentId,team,accessStore,pickupStore,fixedStore,bindingStore
   });
   if(verified.id!==b.shipmentId||verified.reference!==b.reference)
    throw error('RECONCILE_TRANSPORT_MISMATCH');
   transports.push(verified);
  }catch(e){
   if(/^TRANSPORT_|^PICKUP_|^RECONCILE_TRANSPORT_MISMATCH$/.test(String(e&&e.code||''))){
    rejected.push({shipmentId:b.shipmentId,code:e.code});
    continue;
   }
   throw e;
  }
 }
 if(!transports.length)return {pickupDate:day,verifiedTransports:0,added:[],conflicts:rejected,
   changed:false};
 const prior=await linkStore.read({environment:env,companyKey:company});
 const result=await linkStore.applyAutomatic({
  environment:env,companyKey:company,pickupDate:day,
  expectedRevision:prior.revision,actor,transports,tasks,shipments
 });
 return {pickupDate:day,verifiedTransports:transports.length,
   revision:result.revision,added:result.added||[],changed:(result.added||[]).length>0,
   conflicts:[...rejected,...(result.conflicts||[])]};
}
module.exports={fingerprint,shipmentsFromState,reconcile};
