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

function harness(){
  const team={schemaVersion:3,revision:1,state:{shipments:[]}};
  let teamReads=0;
  const blob={
    async download(){teamReads++;return{readableStreamBody:Readable.from([Buffer.from(JSON.stringify(team))]),etag:'"team-1"'}},
    async upload(){throw new Error('issue fast path must not write team state')}
  };
  const azure={BlobServiceClient:{fromConnectionString(){return{getContainerClient(){return{getBlockBlobClient(){return blob}}}}}}};
  const snapshot={id:'DRAFT-1053',shipmentId:'DRAFT-1053',reference:'ZXCV12',ref:'ZXCV12',customerName:'Testkunde',selectedLocationId:'LOC-1',status:'Entwurf'};
  const access={
    body(req){return req.body||{}},
    json(status,body,headers={}){return{status,headers,body:JSON.stringify(body)}},
    environment(){return'testservice'},
    async issue(req,type,record){return{token:'token-1053',expiresAt:'2026-09-12T12:00:00.000Z',record}},
    async revokeSubject(){return{ok:true}}
  };
  const auth={
    TEAM_CONTAINER:'exporthub-data',
    TEAM_BLOB:'team-state.json',
    async validateSession(){return{user:{name:'Tester',rights:{shipment:{edit:true}}}}},
    hasAnyEditRight(){return true},
    error(code,message,status){const e=new Error(message);e.code=code;e.status=status;return e}
  };
  const handler=loadCommonJs('api/customer-avis/index.js',{'@azure/storage-blob':azure,'../shared/public-access-store':access,'../shared/fast-auth-store':auth});
  return{handler,snapshot,get teamReads(){return teamReads}};
}

test('RC1053: Lieferavis-Link aus sicherem Snapshot benötigt keinen Team-State-Read',async()=>{
  const oldStorage=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
  process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
  try{
    const h=harness(),context={log:{error(){}},res:null};
    await h.handler(context,{method:'POST',headers:{},body:{action:'issue',shipmentId:'DRAFT-1053',reference:'ZXCV12',environment:'testservice',shipmentSnapshot:h.snapshot}});
    assert.equal(context.res.status,200);
    const body=JSON.parse(context.res.body);
    assert.equal(body.issued,true);
    assert.equal(body.reference,'ZXCV12');
    assert.equal(h.teamReads,0,'Bei gültigem sicheren Snapshot darf der große Team-State nicht geladen werden.');
    assert.equal(body.timing.teamReadMs,0);
  }finally{
    if(oldStorage===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=oldStorage;
  }
});
