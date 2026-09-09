import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);
const Module=require('node:module');
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function json(status,body,headers={}){return{status,headers,body:JSON.stringify(body)}}
function err(code,message,status=400){const e=new Error(message||code);e.code=code;e.status=status;e.statusCode=status;return e}
function bodyOf(res){return JSON.parse(String(res&&res.body||'{}'))}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v))}
function loadWithMocks(relativeFile,mocks){const absolute=path.resolve(ROOT,relativeFile),original=Module._load;Module._load=function(request,parent,isMain){if(Object.prototype.hasOwnProperty.call(mocks,request))return mocks[request];return original.call(this,request,parent,isMain)};delete require.cache[require.resolve(absolute)];try{return require(absolute)}finally{Module._load=original}}

function fixture(){
  const issued=[];const written=[];
  const access={async issue(_req,kind,payload,_ttl){assert.equal(kind,'pickup');issued.push(payload);const n=issued.length;return{token:String(n).repeat(48),tokenHash:String(n).repeat(64),environment:'testservice',expiresAt:'2026-09-20T00:00:00.000Z'}}};
  const auth={async validateSession(){return{user:{name:'Tester'}}},hasAnyEditRight(){return true},error:err};
  const store={
    json,err,body(req){return req&&req.body&&typeof req.body==='object'?req.body:{}},sanitizeText(v,max=180){return String(v||'').trim().slice(0,max)},
    expectedCollis(src){return (Array.isArray(src&&src.rows)?src.rows:[]).reduce((n,r)=>n+Math.max(0,Math.round(Number(r&&r.count)||0)),0)},
    clone(v){return v==null?v:JSON.parse(JSON.stringify(v))},async clients(){return{records:{},environment:'testservice'}},recordBlob(_records,key){return{key}},
    now(){return'2026-09-09T17:20:00.000Z'},async writeJson(_blob,value){written.push(JSON.parse(JSON.stringify(value)))},
    publicRecord(record,token){return Object.assign({token},JSON.parse(JSON.stringify(record)))}
  };
  return{handler:loadWithMocks('api/pickup-init/index.js',{'../shared/public-access-store':access,'../shared/pickup-store':store,'../shared/fast-auth-store':auth}),issued,written};
}

async function init(handler,subShipmentId,sequence,total,rows){
  const context={res:null,log:{error(){}}};
  await handler(context,{method:'POST',body:{shipment:{id:'S1',reference:'ABC123',customerName:'Kunde GmbH',carrierName:'Carrier',subShipmentId,subShipmentSequence:sequence,subShipmentTotal:total,rows}}});
  assert.equal(context.res.status,200);
  return bodyOf(context.res);
}

test('RC1017: Pickup-Init registriert gefilterten QR-Kontext je Teilsendung',async()=>{
  const f=fixture();
  const body=await init(f.handler,'S1-TRUCK-2',2,2,[{id:'r1',count:1}]);
  assert.equal(f.issued[0].subjectId,'S1::S1-TRUCK-2');
  assert.equal(body.subShipmentId,'S1-TRUCK-2');
  assert.equal(body.subShipmentSequence,2);
  assert.equal(body.subShipmentTotal,2);
  assert.equal(body.subShipmentLabel,'Sendung 2 von 2');
  assert.equal(body.expectedColliCount,1);
  assert.deepEqual(body.rows,[{id:'r1',count:1}]);
});

test('RC1017: zwei LKW-Teilsendungen erhalten unterschiedliche Pickup-Subjects und Tokens',async()=>{
  const f=fixture();
  const one=await init(f.handler,'S1-TRUCK-1',1,2,[{id:'r1',count:2}]);
  const two=await init(f.handler,'S1-TRUCK-2',2,2,[{id:'r1',count:1}]);
  assert.equal(f.issued[0].subjectId,'S1::S1-TRUCK-1');
  assert.equal(f.issued[1].subjectId,'S1::S1-TRUCK-2');
  assert.notEqual(one.token,two.token);
  assert.notEqual(f.written[0].accessKey,f.written[1].accessKey);
});

test('RC1017: Ein-LKW-Pickup ohne subShipmentId bleibt rückwärtskompatibel',async()=>{
  const f=fixture();
  const body=await init(f.handler,'',0,0,[{id:'r1',count:3}]);
  assert.equal(f.issued[0].subjectId,'S1');
  assert.equal(body.expectedColliCount,3);
  assert.equal(body.subShipmentId||'','');
});

test('RC1017: publicRecord veröffentlicht Teilsendungsmetadaten ohne Raw-Token-Feld im Team-State',()=>{
  const src=fs.readFileSync('api/shared/pickup-store.js','utf8');
  assert.match(src,/subShipmentId\s*:\s*r\.subShipmentId\s*\|\|\s*''/);
  assert.match(src,/subShipmentSequence\s*:\s*Number\(r\.subShipmentSequence/);
  assert.match(src,/subShipmentTotal\s*:\s*Number\(r\.subShipmentTotal/);
  assert.match(src,/subShipmentLabel\s*:\s*r\.subShipmentLabel\s*\|\|\s*''/);
});

function teamFixture(){
  let document={schemaVersion:3,revision:7,state:{shipments:[{id:'S1',shipmentId:'S1',ref:'ABC123',reference:'ABC123',status:'Bereit zur Abholung',processStatus:'Bereit zur Abholung',subShipments:[
    {subShipmentId:'S1-TRUCK-1',sequence:1,total:2,label:'Sendung 1 von 2',status:'open',locked:false,rows:[{id:'r1',count:2}]},
    {subShipmentId:'S1-TRUCK-2',sequence:2,total:2,label:'Sendung 2 von 2',status:'open',locked:false,rows:[{id:'r1',count:1}]}
  ]}],tasks:[]},users:[]};
  let etag='"etag-1"',revision=1;
  const blob={
    async download(){const raw=Buffer.from(JSON.stringify(document));return{readableStreamBody:(async function*(){yield raw})(),etag,contentType:'application/json'}},
    async upload(raw){document=JSON.parse(String(raw));revision++;etag='"etag-'+revision+'"';return{etag}},
    async uploadData(){return{etag}}
  };
  const container={async createIfNotExists(){return{}},getBlockBlobClient(){return blob}};
  const service={getContainerClient(){return container}};
  const previous=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
  process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
  const store=loadWithMocks('api/shared/pickup-store.js',{'@azure/storage-blob':{BlobServiceClient:{fromConnectionString(){return service}}}});
  return{store,getDocument(){return clone(document)},restore(){if(previous===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=previous}};
}

function completedSubPickup(subShipmentId,sequence,count,confirmedAt){
  return{environment:'production',shipmentId:'S1',reference:'ABC123',subShipmentId,subShipmentSequence:sequence,subShipmentTotal:2,subShipmentLabel:`Sendung ${sequence} von 2`,rows:[{id:'r1',count}],expectedColliCount:count,status:'confirmed',complete:true,confirmedAt,lastPartialPickupAt:confirmedAt,collectedPickupCollis:count,pickupCollectedColliCount:count,remainingPickupCollis:0,pickupRemainingColliCount:0,carrierName:'Carrier',pickupHistory:[{id:'pickup-1',sequence:1,type:'complete',confirmedAt,colliCount:count,collectedAfter:count,remainingAfter:0,complete:true,driverName:'Fahrer',licensePlate:'KK-AA 1',loaderName:'Verlader',loaderId:'L1',carrierName:'Carrier',signatureBlobName:`sig-${sequence}.png`}],signatureBlobName:`sig-${sequence}.png`,podFiles:[]};
}

test('RC1017: erster LKW schließt nur seine Teilsendung und nicht die Hauptsendung ab',async()=>{
  const f=teamFixture();
  try{
    await f.store.updateTeam(completedSubPickup('S1-TRUCK-1',1,2,'2026-09-09T17:35:00.000Z'),[],'');
    const sh=f.getDocument().state.shipments[0];
    assert.equal(sh.subShipments[0].status,'confirmed');
    assert.equal(sh.subShipments[0].locked,true);
    assert.equal(sh.subShipments[0].pickupHistory.length,1);
    assert.equal(sh.subShipments[1].status,'open');
    assert.equal(sh.multiTruckLocked,true);
    assert.equal(sh.status,'Teilweise abgeholt');
    assert.notEqual(sh.status,'Abgeholt');
  }finally{f.restore()}
});

test('RC1017: Hauptsendung wird erst nach Bestätigung aller LKW als abgeholt aggregiert',async()=>{
  const f=teamFixture();
  try{
    await f.store.updateTeam(completedSubPickup('S1-TRUCK-1',1,2,'2026-09-09T17:35:00.000Z'),[],'');
    await f.store.updateTeam(completedSubPickup('S1-TRUCK-2',2,1,'2026-09-09T17:40:00.000Z'),[],'');
    const sh=f.getDocument().state.shipments[0];
    assert.equal(sh.subShipments.every(x=>x.status==='confirmed'),true);
    assert.equal(sh.subShipments.every(x=>x.locked===true),true);
    assert.equal(sh.status,'Abgeholt');
    assert.equal(sh.processStatus,'Abgeholt');
  }finally{f.restore()}
});
