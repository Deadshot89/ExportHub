import test from 'node:test';
import assert from 'node:assert/strict';
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

function shipment(){return{
  id:'S1',ref:'ABC123',customerName:'Beispielkunde',
  rows:[{id:'r1',type:'Euro Palette',count:2,weight:400,ldm:.8},{id:'r2',type:'Euro Palette',count:1,weight:200,ldm:.4}],
  subShipments:[
    {subShipmentId:'S1-TRUCK-1',sequence:1,total:2,label:'Sendung 1 von 2',rows:[{id:'r1',type:'Euro Palette',count:2,weight:400,ldm:.8}]},
    {subShipmentId:'S1-TRUCK-2',sequence:2,total:2,label:'Sendung 2 von 2',rows:[{id:'r2',type:'Euro Palette',count:1,weight:200,ldm:.4}]}
  ]
}}

function initFixture(){
  const issues=[],writes=[];
  const access={async issue(_req,kind,payload){assert.equal(kind,'pickup');issues.push(clone(payload));const truck=String(payload.subjectId).endsWith('TRUCK-1')?'1':String(payload.subjectId).endsWith('TRUCK-2')?'2':'0';return{environment:'testservice',tokenHash:(truck||'0').repeat(64),token:('token-'+truck+'-').padEnd(48,truck||'0'),expiresAt:'2026-09-23T12:00:00.000Z'}}};
  const store={
    json,err,clone,
    body(req){return req&&req.body&&typeof req.body==='object'?req.body:{}},
    sanitizeText(v){return String(v||'').trim()},
    expectedCollis(src){return (Array.isArray(src&&src.rows)?src.rows:[]).reduce((n,r)=>n+Math.max(0,Math.round(Number(r&&r.count)||0)),0)},
    async clients(){return{records:{}}},
    recordBlob(_records,key,environment){return{key,environment}},
    async writeJson(blob,record){writes.push({blob,record:clone(record)})},
    now(){return'2026-09-09T12:00:00.000Z'},
    publicRecord(r,token){return{shipmentId:r.shipmentId,reference:r.reference,subShipmentId:r.subShipmentId||'',subShipmentSequence:Number(r.subShipmentSequence||0),subShipmentTotal:Number(r.subShipmentTotal||0),subShipmentLabel:r.subShipmentLabel||'',expectedColliCount:r.expectedColliCount,rows:clone(r.rows),token}}
  };
  const auth={async validateSession(){return{user:{name:'Tester'}}},hasAnyEditRight(){return true},error:err};
  const handler=loadWithMocks('api/pickup-init/index.js',{'../shared/public-access-store':access,'../shared/pickup-store':store,'../shared/fast-auth-store':auth});
  return{handler,issues,writes};
}

async function initTruck(fixture,subShipmentId){
  const context={res:null,log:{error(){}}};
  await fixture.handler(context,{method:'POST',body:{shipment:shipment(),subShipmentId,expiresDays:14}});
  return{context,body:bodyOf(context.res)};
}

test('RC1017 Pickup: LKW 2 erhält nur seine eigenen Colli und Metadaten',async()=>{
  const f=initFixture(),result=await initTruck(f,'S1-TRUCK-2');
  assert.equal(result.context.res.status,200);
  assert.equal(result.body.subShipmentId,'S1-TRUCK-2');
  assert.equal(result.body.subShipmentSequence,2);
  assert.equal(result.body.subShipmentTotal,2);
  assert.equal(result.body.subShipmentLabel,'Sendung 2 von 2');
  assert.equal(result.body.expectedColliCount,1);
  assert.deepEqual(result.body.rows,[{id:'r2',type:'Euro Palette',count:1,weight:200,ldm:.4}]);
  assert.equal(f.issues[0].subjectId,'S1::S1-TRUCK-2');
  assert.equal(f.issues[0].snapshot.expectedColliCount,1);
  assert.deepEqual(f.issues[0].snapshot.rows,result.body.rows);
  assert.equal(f.writes[0].record.subShipmentId,'S1-TRUCK-2');
});

test('RC1017 Pickup: zwei LKW derselben Hauptsendung erhalten getrennte Public-Access-Identitäten',async()=>{
  const f=initFixture(),one=await initTruck(f,'S1-TRUCK-1'),two=await initTruck(f,'S1-TRUCK-2');
  assert.equal(one.context.res.status,200);
  assert.equal(two.context.res.status,200);
  assert.notEqual(one.body.token,two.body.token);
  assert.notEqual(f.issues[0].subjectId,f.issues[1].subjectId);
  assert.equal(f.issues[0].subjectId,'S1::S1-TRUCK-1');
  assert.equal(f.issues[1].subjectId,'S1::S1-TRUCK-2');
});

test('RC1017 Pickup: unbekannte Teilsendung fällt niemals auf die komplette Hauptsendung zurück',async()=>{
  const f=initFixture(),result=await initTruck(f,'S1-TRUCK-99');
  assert.equal(result.context.res.status,409);
  assert.equal(result.body.code,'SUBSHIPMENT_NOT_FOUND');
  assert.equal(f.issues.length,0);
  assert.equal(f.writes.length,0);
});

test('RC1017 Pickup: Ein-LKW-/Legacy-Aufruf ohne subShipmentId bleibt unverändert kompatibel',async()=>{
  const f=initFixture(),result=await initTruck(f,'');
  assert.equal(result.context.res.status,200);
  assert.equal(result.body.subShipmentId,'');
  assert.equal(result.body.expectedColliCount,3);
  assert.equal(f.issues[0].subjectId,'S1');
});

test('RC1017 Pickup: publicRecord gibt Teilsendungsmetadaten ohne neuen Statuspfad aus',()=>{
  const store=loadWithMocks('api/shared/pickup-store.js',{'@azure/storage-blob':{BlobServiceClient:{fromConnectionString(){throw new Error('storage darf in diesem Test nicht benutzt werden')}}}});
  const out=store.publicRecord({shipmentId:'S1',reference:'ABC123',subShipmentId:'S1-TRUCK-2',subShipmentSequence:2,subShipmentTotal:2,subShipmentLabel:'Sendung 2 von 2',rows:[{id:'r2',count:1}],expectedColliCount:1,status:'open',podFiles:[]},'x'.repeat(48));
  assert.equal(out.subShipmentId,'S1-TRUCK-2');
  assert.equal(out.subShipmentSequence,2);
  assert.equal(out.subShipmentTotal,2);
  assert.equal(out.subShipmentLabel,'Sendung 2 von 2');
  assert.equal(out.expectedColliCount,1);
});
