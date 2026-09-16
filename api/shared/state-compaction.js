'use strict';

const SHIPMENT_COLLECTIONS=['shipments','savedShipments'];
const DOCUMENT_COLLECTIONS=['shipments','savedShipments','abdRequests'];
const CUSTOMER_SNAPSHOT_FIELDS=['customer','customerData','selectedCustomer'];
const LEGACY_DOCUMENT_FIELDS=['rc313Docs','rc312Docs','rc311Docs','rc256Docs','rc254Docs','rc247Docs'];

function clone(value){
 if(value===undefined)return undefined;
 return JSON.parse(JSON.stringify(value));
}
function fingerprint(value){
 try{return JSON.stringify(value)}catch(_){return null}
}
function dedupeExactFields(item,fields){
 if(!item||typeof item!=='object'||Array.isArray(item))return item;
 const seen=new Map();
 for(const key of fields){
  if(!Object.prototype.hasOwnProperty.call(item,key))continue;
  const fp=fingerprint(item[key]);
  if(fp===null)continue;
  if(seen.has(fp)){delete item[key];continue}
  seen.set(fp,key);
 }
 return item;
}
function compactCollection(list,options){
 if(!Array.isArray(list))return list;
 return list.map(raw=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return raw;
  const item=clone(raw);
  if(options&&options.customerSnapshots)dedupeExactFields(item,CUSTOMER_SNAPSHOT_FIELDS);
  if(options&&options.legacyDocuments)dedupeExactFields(item,LEGACY_DOCUMENT_FIELDS);
  return item;
 });
}
function compactStateForStorage(state){
 const out=clone(state&&typeof state==='object'&&!Array.isArray(state)?state:{});
 for(const key of SHIPMENT_COLLECTIONS){
  if(Array.isArray(out[key]))out[key]=compactCollection(out[key],{customerSnapshots:true,legacyDocuments:true});
 }
 if(Array.isArray(out.abdRequests))out.abdRequests=compactCollection(out.abdRequests,{legacyDocuments:true});
 return out;
}

module.exports={
 compactStateForStorage,
 dedupeExactFields,
 CUSTOMER_SNAPSHOT_FIELDS,
 LEGACY_DOCUMENT_FIELDS
};
