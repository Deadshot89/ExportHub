import test from 'node:test';
import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
import path from 'node:path';
import {Readable} from 'node:stream';

const require=createRequire(import.meta.url);
function loadCommonJs(relative,mocks){
  const absolute=path.resolve(relative),original=Module._load;
  Module._load=function(request,parent,isMain){if(Object.prototype.hasOwnProperty.call(mocks,request))return mocks[request];return original.call(this,request,parent,isMain)};
  delete require.cache[require.resolve(absolute)];
  try{return require(absolute)}finally{Module._load=original}
}
function bodyOf(res){return typeof res.body==='string'?JSON.parse(res.body||'{}'):(res.body||{})}
function ctx(){return{log:{error(){}},res:null}}

test('RC1062: Abholtermin speichert mit genau einem Team-State-Read',async()=>{
  const oldStorage=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
  process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
  try{
    const shipment={id:'S-RC1062',shipmentId:'S-RC1062',reference:'R1062A',ref:'R1062A',status:'Erstellt',customerName:'Testkunde',selectedLocationId:'LOC-1'};
    let team={schemaVersion:3,revision:1,state:{shipments:[shipment]}},downloads=0,uploads=0,issuedRecord=null,sessionRecord=null;
    const blob={
      async download(){downloads++;return{readableStreamBody:Readable.from([Buffer.from(JSON.stringify(team))]),etag:'\"team-1\"'}},
      async upload(raw){uploads++;team=JSON.parse(String(raw));return{etag:'\"team-2\"'}}
    };
    const azure={BlobServiceClient:{fromConnectionString(){return{getContainerClient(){return{getBlockBlobClient(){return blob}}}}}}};
    const access={
      body(req){return req.body||{}},
      json(status,body,headers={}){return{status,headers,body:JSON.stringify(body)}},
      environment(_req,payload){return payload&&payload.environment||'testservice'},
      async issue(_req,type,record){assert.equal(type,'avis');issuedRecord=record;return{token:'a'.repeat(48),expiresAt:null,record}},
      async resolve(_req,type,token){assert.equal(type,'avis');assert.equal(token,'a'.repeat(48));return{environment:'testservice',record:issuedRecord,tokenHash:'hash'}},
      async clearFailures(_env,_type,_hash){return{environment:'testservice',record:issuedRecord,tokenHash:'hash'}},
      issueSession(info){sessionRecord=info.record;return{session:'session-rc1062',expiresAt:'2026-09-12T12:00:00.000Z'}},
      async resolveSession(session,type){assert.equal(session,'session-rc1062');assert.equal(type,'avis');return{environment:'testservice',record:sessionRecord}},
      async registerFailure(){return{failedAttempts:1,lockedUntil:null}},
      async revokeSubject(){return{ok:true}}
    };
    const auth={
      TEAM_CONTAINER:'exporthub-data',TEAM_BLOB:'team-state.json',
      async validateSession(){return{user:{name:'Tester',rights:{shipment:{edit:true}}}}},
      hasAnyEditRight(){return true},
      error(code,message,status){const e=new Error(message);e.code=code;e.status=status;return e}
    };
    const handler=loadCommonJs('api/customer-avis/index.js',{'@azure/storage-blob':azure,'../shared/public-access-store':access,'../shared/fast-auth-store':auth});

    let c=ctx();
    await handler(c,{method:'POST',headers:{host:'probe-testservice.azurestaticapps.net'},body:{action:'issue',shipmentId:shipment.id,reference:shipment.ref,environment:'testservice',shipmentSnapshot:shipment}});
    assert.equal(c.res.status,200);
    const issued=bodyOf(c.res);

    c=ctx();
    await handler(c,{method:'POST',headers:{},body:{action:'authorize',token:issued.token,reference:shipment.ref,environment:'testservice'}});
    assert.equal(c.res.status,200);
    const authorized=bodyOf(c.res);

    downloads=0;uploads=0;
    c=ctx();
    await handler(c,{method:'POST',headers:{'x-exporthub-avis-session':authorized.session},body:{action:'appointment',session:authorized.session,pickupDate:'2026-09-15',timeFrom:'10:00',timeTo:'12:00',plate:'TEST-1'}});
    assert.equal(c.res.status,200);
    assert.equal(downloads,1,'Abholtermin darf den vollständigen Team-State nur einmal laden.');
    assert.equal(uploads,1,'Abholtermin muss den aktualisierten Team-State genau einmal speichern.');
  }finally{
    if(oldStorage===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=oldStorage;
  }
});
