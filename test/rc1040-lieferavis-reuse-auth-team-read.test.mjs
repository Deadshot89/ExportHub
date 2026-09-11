import test from 'node:test';
import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
import path from 'node:path';
import {Readable} from 'node:stream';

const require=createRequire(import.meta.url);

function loadCommonJs(relative,mocks){
  const absolute=path.resolve(relative),original=Module._load;
  Module._load=function(request,parent,isMain){
    if(Object.prototype.hasOwnProperty.call(mocks,request))return mocks[request];
    return original.call(this,request,parent,isMain);
  };
  delete require.cache[require.resolve(absolute)];
  try{return require(absolute)}finally{Module._load=original}
}

function fixture(environment){
  const oldStorage=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
  process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
  const team={schemaVersion:3,revision:7,state:{shipments:[{id:'SHIP-1039',reference:'ABC123',ref:'ABC123',customerName:'Testkunde',selectedLocationId:'LOC-1',status:'Entwurf'}]},users:[{id:'U1',name:'Tester'}]};
  let customerAvisReads=0,uploads=0;
  const blob={
    name:environment==='testservice'?'testservice/team-state.json':'team-state.json',
    async download(){customerAvisReads++;return{readableStreamBody:Readable.from([Buffer.from(JSON.stringify(team))]),etag:'"team-7"'}},
    async upload(){uploads++;return{etag:'"team-8"'}}
  };
  const azure={BlobServiceClient:{fromConnectionString(){return{getContainerClient(){return{async createIfNotExists(){},getBlockBlobClient(){return blob}}}}}}};
  const access={
    body(req){return req.body||{}},
    json(status,body,headers={}){return{status,headers,body:JSON.stringify(body)}},
    environment(){return environment},
    async issue(){return{token:'a'.repeat(48),expiresAt:null}}
  };
  const auth={
    TEAM_CONTAINER:'exporthub-data',
    TEAM_BLOB:'team-state.json',
    async validateSession(){return{
      user:{id:'U1',name:'Tester',rights:{shipment:{edit:true}}},
      teamDoc:{value:team,etag:'"team-7"'}
    }},
    hasAnyEditRight(){return true},
    error(code,message,status){const e=new Error(message);e.code=code;e.status=status;return e}
  };
  const handler=loadCommonJs('api/customer-avis/index.js',{'@azure/storage-blob':azure,'../shared/public-access-store':access,'../shared/fast-auth-store':auth});
  return{
    oldStorage,handler,
    reads(){return customerAvisReads},
    uploads(){return uploads},
    restore(){if(oldStorage===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=oldStorage}
  };
}

test('RC1040: production issue reuses the authenticated team document instead of downloading team-state twice',async()=>{
  const fx=fixture('production');
  try{
    const context={log:{error(){}},res:null};
    await fx.handler(context,{method:'POST',headers:{},body:{action:'issue',shipmentId:'SHIP-1039',reference:'ABC123',environment:'production'}});
    assert.equal(context.res.status,200);
    assert.equal(fx.reads(),0,'Der bereits in fast-auth gelesene production team-state darf im Lieferavis nicht erneut heruntergeladen werden.');
    assert.equal(fx.uploads(),1,'Die Avis-Flags müssen weiterhin mit dem ETag des Auth-Team-Reads gespeichert werden.');
  }finally{fx.restore()}
});

test('RC1040: testservice keeps its separate team-state read and must not reuse the production auth document',async()=>{
  const fx=fixture('testservice');
  try{
    const context={log:{error(){}},res:null};
    await fx.handler(context,{method:'POST',headers:{},body:{action:'issue',shipmentId:'SHIP-1039',reference:'ABC123',environment:'testservice'}});
    assert.equal(context.res.status,200);
    assert.equal(fx.reads(),1,'TESTSERVICE nutzt einen getrennten Team-State und muss ihn weiterhin selbst lesen.');
    assert.equal(fx.uploads(),1);
  }finally{fx.restore()}
});
