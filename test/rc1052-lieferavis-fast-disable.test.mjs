import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
  let teamWrites=0,revoked=0;
  const blob={
    async download(){return{readableStreamBody:Readable.from([Buffer.from(JSON.stringify(team))]),etag:'"team-1"'}},
    async upload(){teamWrites++;return{etag:'"team-2"'}}
  };
  const azure={BlobServiceClient:{fromConnectionString(){return{getContainerClient(){return{getBlockBlobClient(){return blob}}}}}}};
  const snapshot={id:'DRAFT-1052',shipmentId:'DRAFT-1052',reference:'ABC123',ref:'ABC123',customerName:'Testkunde',selectedLocationId:'LOC-1',status:'Entwurf'};
  const access={
    body(req){return req.body||{}},
    json(status,body,headers={}){return{status,headers,body:JSON.stringify(body)}},
    environment(){return'production'},
    async revokeSubject(){revoked++;return{ok:true}},
    async resolve(){return{environment:'production',tokenHash:'hash',record:{subjectId:'DRAFT-1052',shipmentId:'DRAFT-1052',reference:'ABC123',snapshot}}},
    async clearFailures(){return{subjectId:'DRAFT-1052',shipmentId:'DRAFT-1052',reference:'ABC123',snapshot}},
    issueSession(){return{session:'session-1052',expiresAt:'2026-09-12T12:00:00.000Z'}}
  };
  const auth={async validateSession(){return{user:{name:'Tester',rights:{shipment:{edit:true}}}}},hasAnyEditRight(){return true},error(code,message,status){const e=new Error(message);e.code=code;e.status=status;return e}};
  const handler=loadCommonJs('api/customer-avis/index.js',{'@azure/storage-blob':azure,'../shared/public-access-store':access,'../shared/fast-auth-store':auth});
  return{handler,access,snapshot,get teamWrites(){return teamWrites},get revoked(){return revoked}};
}

test('RC1052: Client wartet vor Deaktivierung auf eine laufende Link-Erstellung und nutzt den Fast-Disable-Pfad',()=>{
  const src=fs.readFileSync('assets/rc1027-lieferavis-immediate.js','utf8');
  assert.match(src,/if\(earlyPending\)\{try\{await earlyPending\}/);
  assert.match(src,/async function disableDraftAvis\(/);
  assert.match(src,/action:'disable'[\s\S]*shipmentSnapshot:avisDraftSnapshot\(sh\)/);
  assert.match(src,/toggle:coordinatedToggle/);
});

test('RC1052: ein noch nicht im Team-State gespeicherter Avis kann ohne HTTP 500 deaktiviert werden',async()=>{
  const oldStorage=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
  process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
  try{
    const h=harness(),context={log:{error(){}},res:null};
    await h.handler(context,{method:'POST',headers:{},body:{action:'disable',shipmentId:'DRAFT-1052',reference:'ABC123',environment:'production',shipmentSnapshot:h.snapshot}});
    assert.equal(context.res.status,200);
    const body=JSON.parse(context.res.body);
    assert.equal(body.disabled,true);
    assert.equal(h.revoked,1);
    assert.equal(h.teamWrites,0,'Ein reiner Draft besitzt noch keinen Team-State, der beim Deaktivieren geschrieben werden müsste.');
  }finally{
    if(oldStorage===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=oldStorage;
  }
});

test('RC1052: ein aktiver Avis-Link kann einen noch ungespeicherten Draft aus dem sicheren Snapshot anzeigen',async()=>{
  const oldStorage=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
  process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
  try{
    const h=harness(),context={log:{error(){}},res:null};
    await h.handler(context,{method:'POST',headers:{},body:{action:'authorize',token:'a'.repeat(48),reference:'ABC123',environment:'production'}});
    assert.equal(context.res.status,200);
    const body=JSON.parse(context.res.body);
    assert.equal(body.reference,'ABC123');
    assert.equal(body.customerName,'Testkunde');
    assert.equal(body.session,'session-1052');
  }finally{
    if(oldStorage===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=oldStorage;
  }
});
