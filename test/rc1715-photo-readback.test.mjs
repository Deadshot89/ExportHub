import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const Module=require('node:module');
const source=require.resolve('../api/container-document/index.js');
const oldPhoto={id:'container-loaded',kind:'loaded',blobName:'production/ABC123/old.jpg',uploadedAt:'2026-10-27T10:00:00Z'};
const newPhoto={...oldPhoto,blobName:'production/ABC123/new.jpg',uploadedAt:'2026-10-28T10:00:00Z'};
function setup(shipments,savedShipments){
 const mocks={
  '../shared/fast-auth-store':{
   async validateSession(){return {user:{rights:{shipmentoverview:{read:true}}},team:{state:{shipments,savedShipments}}}},
   isAdmin(){return false},
   error(code,message,status){const e=new Error(message);e.code=code;e.status=status;return e}
  },
  '../shared/pickup-store':{json(status,body){return{status,body}}},
  '../shared/container-document-store':{async readPhoto(p){return{buffer:Buffer.from(p.blobName),contentType:'image/jpeg'}}},
  '../shared/i18n':{t(_req,key){return key}}
 };
 const before=Module._load;
 Module._load=function(req,parent,isMain){if(Object.hasOwn(mocks,req))return mocks[req];return before.call(this,req,parent,isMain)};
 delete require.cache[source];
 try{return require(source)}finally{Module._load=before;delete require.cache[source]}
}
test('P2: preview serves newest stored photo, not stale shipments copy',async()=>{
 const handler=setup([{id:'S1',reference:'ABC123',containerPhotos:[oldPhoto]}],[{id:'S1',reference:'ABC123',containerPhotos:[newPhoto]}]);
 const c={log:{error(){}},res:null};
 await handler(c,{method:'GET',query:{reference:'ABC123',shipmentId:'S1',file:'container-loaded'}});
 assert.equal(c.res.status,200);
 assert.equal(c.res.body.toString(),newPhoto.blobName);
});
test('P2: reference collision cannot expose another shipment photo',async()=>{
 const handler=setup([{id:'S1',reference:'ABC123',containerPhotos:[]}],[{id:'S2',reference:'ABC123',containerPhotos:[newPhoto]}]);
 const c={log:{error(){}},res:null};
 await handler(c,{method:'GET',query:{reference:'ABC123',shipmentId:'S1',file:'container-loaded'}});
 assert.equal(c.res.status,404);
 assert.equal(c.res.body.code,'CONTAINER_PHOTO_NOT_FOUND');
});
