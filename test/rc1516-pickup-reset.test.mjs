import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);
const Module=require('node:module');
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v))}
function json(status,body,headers={}){return{status,headers,body:JSON.stringify(body)}}
function err(code,message,status=400){const e=new Error(message||code);e.code=code;e.status=status;e.statusCode=status;return e}
function bodyOf(res){return JSON.parse(String(res&&res.body||'{}'))}
function loadWithMocks(relativeFile,mocks){const absolute=path.resolve(ROOT,relativeFile),original=Module._load;Module._load=function(request,parent,isMain){if(Object.prototype.hasOwnProperty.call(mocks,request))return mocks[request];return original.call(this,request,parent,isMain)};delete require.cache[require.resolve(absolute)];try{return require(absolute)}finally{Module._load=original}}

function fixture(){
  let pickup={
    accessKey:'a'.repeat(64),environment:'production',shipmentId:'S22',reference:'22MJ87',rows:[{id:'r1',count:2}],expectedColliCount:2,
    status:'confirmed',complete:true,confirmedAt:'2026-10-13T11:30:00.000Z',collectedPickupCollis:2,pickupCollectedColliCount:2,remainingPickupCollis:0,pickupRemainingColliCount:0,
    driverName:'Falscher Fahrer',licensePlate:'XX-QR 87',loaderName:'Verlader',loaderId:'L1',signatureBlobName:'signature.png',signatureStoredAt:'2026-10-13T11:30:00.000Z',
    pickupHistory:[{id:'pickup-1',sequence:1,type:'complete',confirmedAt:'2026-10-13T11:30:00.000Z',colliCount:2,collectedAfter:2,remainingAfter:0,complete:true,driverName:'Falscher Fahrer',licensePlate:'XX-QR 87',loaderName:'Verlader',loaderId:'L1',signatureBlobName:'signature.png'}],
    podFiles:[{id:'pod-1',name:'POD_22MJ87.pdf'}]
  };
  let team={schemaVersion:3,revision:5,state:{shipments:[{
    id:'S22',shipmentId:'S22',reference:'22MJ87',ref:'22MJ87',status:'Abgeholt',processStatus:'Abgeholt',readyForPickup:false,
    pickupHistory:clone(pickup.pickupHistory),podFiles:clone(pickup.podFiles),collectedPickupCollis:2,pickupCollectedColliCount:2,remainingPickupCollis:0,pickupRemainingColliCount:0,
    pickupDriverName:'Falscher Fahrer',driverName:'Falscher Fahrer',pickupLicensePlate:'XX-QR 87',licensePlate:'XX-QR 87',loaderName:'Verlader',pickedUpAt:'2026-10-13T11:30:00.000Z',pickupConfirmedAt:'2026-10-13T11:30:00.000Z',qrPickupConfirmedAt:'2026-10-13T11:30:00.000Z',pickupStatus:'abgeholt',pickupQrUsed:true,pickupQrUsedAt:'2026-10-13T11:30:00.000Z',qrPickupConfirmed:true,podAvailable:true,podConfirmed:true
  }],tasks:[{id:'TASK-22',area:'Abholtag',linkedShipmentId:'S22',linkedShipmentRef:'22MJ87',status:'erledigt',done:true,doneAt:'2026-10-13T11:30:00.000Z',completedAt:'2026-10-13T11:30:00.000Z',_syncDeviceId:'qr-pickup'}]},users:[]};
  const access={async issue(){return{token:'b'.repeat(48),tokenHash:'a'.repeat(64),resourceKey:'a'.repeat(64),environment:'production',expiresAt:'2026-10-27T00:00:00.000Z',reused:true}}};
  const auth={async validateSession(){return{user:{name:'Tobias',id:'U1'}}},hasAnyEditRight(){return true},error:err};
  const store={
    json,err,body(req){return req&&req.body&&typeof req.body==='object'?req.body:{}},sanitizeText(v,max=180){return String(v||'').trim().slice(0,max)},addressFromSource(){return''},transportModeOf(){return''},containerDocumentationRequired(){return false},abdPresent(){return false},
    expectedCollis(src){return (Array.isArray(src&&src.rows)?src.rows:[]).reduce((n,r)=>n+Math.max(0,Math.round(Number(r&&r.count)||0)),0)},pickupHistory(r){return Array.isArray(r&&r.pickupHistory)?r.pickupHistory:[]},pickupComplete(r){return r&&r.complete===true},clone,
    async resolveShipmentAddress(){return''},async resolveShipmentContainerConfig(){return{transportMode:'',containerDocumentationRequired:false}},async resolveShipmentAbdConfig(){return{abdPresent:false}},
    async getRecord(){return{record:clone(pickup)}},async mutateRecord(_key,_env,fn){pickup=await fn(clone(pickup));return clone(pickup)},
    async clients(){return{records:{},team:{getBlockBlobClient(){return{}}},environment:'production'}},recordBlob(){return{}},teamBlobName(){return'team-state.json'},
    async readJson(){return{value:clone(team),etag:'"team-1"'}},async writeJson(_blob,value){team=clone(value);return{etag:'"team-2"'}},
    now(){return'2026-10-13T12:10:00.000Z'},async writeJsonUnused(){},
    publicRecord(record,token){return Object.assign({token},clone(record))}
  };
  const handler=loadWithMocks('api/pickup-init/index.js',{'../shared/public-access-store':access,'../shared/pickup-store':store,'../shared/fast-auth-store':auth});
  return{handler,getPickup:()=>clone(pickup),getTeam:()=>clone(team)};
}

test('RC1516 P0: resetPickup macht einen irrtuemlich bestaetigten QR-Scan wieder vollstaendig offen',async()=>{
  const f=fixture(),context={res:null,log:{error(){}}};
  await f.handler(context,{method:'POST',body:{shipment:{id:'S22',reference:'22MJ87',rows:[{id:'r1',count:2}]},resetPickup:true,reactivate:true,resetReason:'Falscher QR-Code'}});
  assert.equal(context.res.status,200);
  const response=bodyOf(context.res),pickup=f.getPickup(),doc=f.getTeam(),shipment=doc.state.shipments[0],task=doc.state.tasks[0];

  assert.equal(response.status,'open');
  assert.equal(pickup.status,'open');
  assert.equal(pickup.complete,false);
  assert.equal(pickup.confirmedAt,null);
  assert.deepEqual(pickup.pickupHistory,[]);
  assert.equal(pickup.pickupCollectedColliCount,0);
  assert.equal(pickup.pickupRemainingColliCount,2);
  assert.ok(Array.isArray(pickup.pickupResetHistory)&&pickup.pickupResetHistory.length===1,'Fehlscan muss als Auditspur erhalten bleiben');

  assert.equal(shipment.status,'Bereit zur Abholung');
  assert.equal(shipment.processStatus,'Bereit zur Abholung');
  assert.equal(shipment.pickupQrUsed,false);
  assert.equal(shipment.qrPickupConfirmed,false);
  assert.equal(shipment.pickupConfirmedAt,'');
  assert.deepEqual(shipment.pickupHistory,[]);
  assert.equal(shipment.pickupCollectedColliCount,0);
  assert.equal(shipment.pickupRemainingColliCount,2);
  assert.equal(shipment.readyForPickup,true);

  assert.equal(task.done,false);
  assert.equal(task.status,'offen');
});
