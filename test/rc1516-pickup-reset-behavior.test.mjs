import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url),Module=require('node:module');
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const clone=v=>JSON.parse(JSON.stringify(v));
const json=(status,body)=>({status,body:JSON.stringify(body)});
function load(file,mocks){const abs=path.resolve(ROOT,file),original=Module._load;Module._load=(request,parent,isMain)=>Object.prototype.hasOwnProperty.call(mocks,request)?mocks[request]:original.call(Module,request,parent,isMain);delete require.cache[require.resolve(abs)];try{return require(abs)}finally{Module._load=original}}

test('RC1516 P0: bestaetigter Fehlscan wird serverseitig wieder open',async()=>{
 let record={accessKey:'a'.repeat(64),environment:'production',shipmentId:'S22',reference:'22MJ87',rows:[{count:2}],expectedColliCount:2,status:'confirmed',complete:true,confirmedAt:'2026-10-13T11:30:00Z',pickupHistory:[{sequence:1,confirmedAt:'2026-10-13T11:30:00Z',colliCount:2,complete:true}],pickupCollectedColliCount:2,collectedPickupCollis:2,pickupRemainingColliCount:0,remainingPickupCollis:0,driverName:'Fahrer',licensePlate:'XX-QR 87',loaderName:'Verlader',carrierName:'Falsche Spedition',speditionName:'Falsche Spedition',sealNumber:'WRONG-SEAL',containerPhotos:[{kind:'loaded'},{kind:'number'},{kind:'sealed'}],containerDocumentationUpdatedAt:'2026-10-13T11:29:00Z',signatureBlobName:'sig.png',customsDocumentsSignatureBlobName:'customs-sig.png',podFiles:[{id:'pod'}],podUpdatedAt:'2026-10-13T11:31:00Z',automaticPodBlobName:'old-pod.pdf',automaticPodHash:'oldhash',uploadKeyHash:'hash',confirmationVersion:'RC1455'};
 const access={async issue(){return{token:'b'.repeat(48),resourceKey:'a'.repeat(64),tokenHash:'a'.repeat(64),environment:'production',expiresAt:'2026-10-27T00:00:00Z',reused:true}}};
 const auth={async validateSession(){return{user:{name:'Admin'}}},hasAnyEditRight(){return true},error(code,message,status){const e=new Error(message);e.code=code;e.status=status;return e}};
 const store={json,body:req=>req.body,sanitizeText:(v,n=180)=>String(v||'').slice(0,n),expectedCollis:s=>(s.rows||[]).reduce((n,r)=>n+Number(r.count||0),0),clone,addressFromSource:()=>'',transportModeOf:()=>'',containerDocumentationRequired:()=>false,abdPresent:()=>false,async resolveShipmentAddress(){return''},async resolveShipmentContainerConfig(){return{}},async resolveShipmentAbdConfig(){return{}},async clients(){return{records:{}}},recordBlob(){return{}},async getRecord(){return{record:clone(record)}},async mutateRecord(_k,_e,fn){record=fn(clone(record));return clone(record)},pickupHistory:r=>r.pickupHistory||[],pickupComplete:r=>r.complete===true,now:()=> '2026-10-13T12:10:00Z',publicRecord:(r,token)=>Object.assign({token},clone(r)),err(code,message,status){const e=new Error(message);e.code=code;e.status=status;return e}};
 const handler=load('api/pickup-init/index.js',{'../shared/public-access-store':access,'../shared/pickup-store':store,'../shared/fast-auth-store':auth});
 const context={log:{error(){}},res:null};
 await handler(context,{method:'POST',body:{shipment:{id:'S22',reference:'22MJ87',rows:[{count:2}]},resetPickup:true,resetReason:'Falscher QR-Code'}});
 assert.equal(context.res.status,200);
 assert.equal(record.status,'open');
 assert.equal(record.complete,false);
 assert.equal(record.confirmedAt,null);
 assert.deepEqual(record.pickupHistory,[]);
 assert.equal(record.pickupCollectedColliCount,0);
 assert.equal(record.pickupRemainingColliCount,2);
 assert.equal(record.pickupSequence,1);
 assert.equal(record.driverName,'');
 assert.equal(record.licensePlate,'');
 assert.equal(record.carrierName,'');
 assert.equal(record.speditionName,'');
 assert.equal(record.sealNumber,'');
 assert.deepEqual(record.containerPhotos,[]);
 assert.equal(record.signatureBlobName,'');
 assert.equal(record.customsDocumentsSignatureBlobName,'');
 assert.deepEqual(record.podFiles,[]);
 assert.equal(record.automaticPodBlobName,'');
 assert.equal(record.uploadKeyHash,'');
 assert.equal(record.confirmationVersion,'');
 assert.equal(record.pickupResetHistory.at(-1).reason,'Falscher QR-Code');
 assert.equal(record.pickupResetHistory.at(-1).previousPickupSequence,1);
});
