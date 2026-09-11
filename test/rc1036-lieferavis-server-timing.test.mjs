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

test('RC1036: Lieferavis-Issue liefert getrennte Serverlaufzeiten fuer Azure-Engpassanalyse',async()=>{
  const oldStorage=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
  process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
  const team={schemaVersion:3,revision:1,state:{shipments:[{id:'SHIP-1036',reference:'ABC123',ref:'ABC123',customerName:'Testkunde',selectedLocationId:'LOC-1',status:'Entwurf'}]}};
  const blob={
    async download(){return{readableStreamBody:Readable.from([Buffer.from(JSON.stringify(team))]),etag:'"team-1"'}},
    async upload(){return{etag:'"team-2"'}}
  };
  const azure={BlobServiceClient:{fromConnectionString(){return{getContainerClient(){return{async createIfNotExists(){},getBlockBlobClient(){return blob}}}}}}};
  const access={
    body(req){return req.body||{}},
    json(status,body,headers={}){return{status,headers,body:JSON.stringify(body)}},
    environment(){return'production'},
    async issue(){return{token:'a'.repeat(48),expiresAt:null}}
  };
  const auth={async validateSession(){return{user:{name:'Tester',rights:{shipment:{edit:true}}}}},hasAnyEditRight(){return true},error(code,message,status){const e=new Error(message);e.code=code;e.status=status;return e}};
  try{
    const handler=loadCommonJs('api/customer-avis/index.js',{'@azure/storage-blob':azure,'../shared/public-access-store':access,'../shared/fast-auth-store':auth});
    const context={log:{error(){}},res:null};
    await handler(context,{method:'POST',headers:{},body:{action:'issue',shipmentId:'SHIP-1036',reference:'ABC123',environment:'production'}});
    assert.equal(context.res.status,200);
    const response=JSON.parse(context.res.body);
    assert.equal(response.version,'RC1036');
    assert.ok(response.timing&&typeof response.timing==='object','Issue-Antwort muss Timingdaten enthalten.');
    for(const key of ['authMs','teamBlobMs','teamReadMs','flagWriteMs','tokenIssueMs','totalMs']){
      assert.equal(typeof response.timing[key],'number',`${key} muss numerisch sein.`);
      assert.ok(response.timing[key]>=0,`${key} darf nicht negativ sein.`);
    }
    assert.ok(response.timing.totalMs>=response.timing.teamReadMs,'Gesamtzeit muss mindestens den Team-Read enthalten.');
    const serverTiming=String(context.res.headers&&context.res.headers['Server-Timing']||'');
    for(const metric of ['auth','team-blob','team-read','flag-write','token-issue','total'])assert.match(serverTiming,new RegExp(`${metric};dur=\\d`),`Server-Timing muss ${metric} enthalten.`);
  }finally{
    if(oldStorage===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=oldStorage;
  }
});
