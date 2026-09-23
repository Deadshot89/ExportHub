'use strict';

const crypto=require('crypto');

function asBuffer(value){
 if(Buffer.isBuffer(value))return value;
 if(value instanceof Uint8Array)return Buffer.from(value);
 return Buffer.from(String(value==null?'':value),'utf8');
}
function sha256(value){return crypto.createHash('sha256').update(asBuffer(value)).digest('hex')}
function parseJson(value){
 try{return JSON.parse(asBuffer(value).toString('utf8'))}
 catch(_){const e=new Error('Wiederhergestellte State-Datei ist kein gültiges JSON.');e.code='RESTORE_JSON_INVALID';throw e}
}
function shipmentReferences(doc){
 const state=doc&&typeof doc==='object'&&doc.state&&typeof doc.state==='object'?doc.state:{},refs=new Set();
 for(const key of ['shipments','savedShipments']){
  const list=Array.isArray(state[key])?state[key]:[];
  for(const sh of list){
   if(!sh||typeof sh!=='object')continue;
   const ref=String(sh.ref||sh.reference||sh.referenceNumber||sh.shipmentReference||'').trim().toUpperCase();
   if(/^[A-Z0-9]{6}$/.test(ref))refs.add(ref);
  }
 }
 return Array.from(refs).sort();
}
function verifyStateRestore(sourceValue,restoredValue){
 const source=asBuffer(sourceValue),restored=asBuffer(restoredValue),sourceHash=sha256(source),restoredHash=sha256(restored);
 if(source.length!==restored.length||sourceHash!==restoredHash){
  const e=new Error('Wiederhergestellte State-Datei stimmt nicht bytegenau mit dem Backup überein.');e.code='RESTORE_HASH_MISMATCH';throw e
 }
 const sourceDoc=parseJson(source),restoredDoc=parseJson(restored);
 const sourceRefs=shipmentReferences(sourceDoc),restoredRefs=shipmentReferences(restoredDoc);
 if(JSON.stringify(sourceRefs)!==JSON.stringify(restoredRefs)){
  const e=new Error('Sendungsreferenzen konnten nach der Wiederherstellung nicht identisch zugeordnet werden.');e.code='RESTORE_SHIPMENT_MISMATCH';throw e
 }
 const sourceRevision=Number(sourceDoc&&sourceDoc.revision||0),restoredRevision=Number(restoredDoc&&restoredDoc.revision||0);
 if(sourceRevision!==restoredRevision){
  const e=new Error('Revision der wiederhergestellten State-Datei stimmt nicht mit dem Backup überein.');e.code='RESTORE_REVISION_MISMATCH';throw e
 }
 return{verified:true,bytes:restored.length,sha256:restoredHash,revision:restoredRevision,shipmentReferenceCount:restoredRefs.length,shipmentReferencesVerified:true};
}

module.exports={sha256,shipmentReferences,verifyStateRestore};
