'use strict';
const CONFIG_BLOB='config/pickup-config.json';
const DEFAULT_PIN='2578';
function validPin(pin){return /^\d{4}$/.test(String(pin||''))}
async function getConfig(store,records){
  const blob=records.getBlockBlobClient(CONFIG_BLOB),got=await store.readJson(blob);
  if(got.value&&validPin(got.value.pin))return {blob,etag:got.etag,value:got.value};
  const stamp=store.now(),value={schemaVersion:1,pin:DEFAULT_PIN,revision:1,updatedAt:stamp,updatedBy:'Systemstandard'};
  try{await store.writeJson(blob,value,got.etag)}catch(e){if(!(e&&e.statusCode===412))throw e;const retry=await store.readJson(blob);return {blob,etag:retry.etag,value:retry.value}}
  return {blob,etag:null,value};
}
async function current(store){const c=await store.clients(),got=await getConfig(store,c.records);return {clients:c,blob:got.blob,etag:got.etag,value:got.value}}
async function setPin(store,pin,actor){
  if(!validPin(pin))throw store.err('INVALID_PIN','Die zentrale QR-PIN muss genau vier Ziffern haben.',400);
  for(let i=0;i<6;i++){
    const c=await store.clients(),got=await getConfig(store,c.records),stamp=store.now();
    const value={schemaVersion:1,pin:String(pin),revision:Number(got.value.revision||0)+1,updatedAt:stamp,updatedBy:String(actor||'Administrator')};
    try{await store.writeJson(got.blob,value,got.etag);return value}catch(e){if(e&&e.statusCode===412&&i<5)continue;throw e}
  }
  throw store.err('CONFLICT','Die PIN konnte wegen eines Speicherkonflikts nicht geändert werden.',409);
}
module.exports={CONFIG_BLOB,DEFAULT_PIN,validPin,current,setPin};
