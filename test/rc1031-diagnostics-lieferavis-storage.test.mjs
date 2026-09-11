import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import Module,{createRequire} from 'node:module';
import path from 'node:path';
import {Readable} from 'node:stream';

const require=createRequire(import.meta.url);

function conflict(){const e=new Error('Condition not met');e.statusCode=412;e.code='ConditionNotMet';return e}
function notFound(){const e=new Error('Blob not found');e.statusCode=404;e.code='BlobNotFound';return e}

function loadCommonJs(relative,mocks){
  const absolute=path.resolve(relative),original=Module._load;
  Module._load=function(request,parent,isMain){if(Object.prototype.hasOwnProperty.call(mocks,request))return mocks[request];return original.call(this,request,parent,isMain)};
  delete require.cache[require.resolve(absolute)];
  try{return require(absolute)}finally{Module._load=original}
}

test('RC1031: Public-Access-Store initialisiert Azure-Container einmal und liest den Subject-Index beim Issue nur einmal',async()=>{
  const oldStorage=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING,oldSecret=process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET;
  process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
  process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET='rc1031-public-access-test';
  const blobs=new Map();let etag=1,containerCreates=0,subjectReads=0;
  function client(name){return{name,
    async download(){if(name.includes('/subjects/'))subjectReads++;const x=blobs.get(name);if(!x)throw notFound();return{readableStreamBody:Readable.from([x.raw]),etag:x.etag}},
    async upload(raw,_len,opt={}){const current=blobs.get(name),conditions=opt.conditions||{};if(conditions.ifMatch&&(!current||current.etag!==conditions.ifMatch))throw conflict();if(conditions.ifNoneMatch==='*'&&current)throw conflict();const next={raw:Buffer.from(String(raw)),etag:'\"e'+etag+++'\"'};blobs.set(name,next);return{etag:next.etag}}
  }}
  const container={async createIfNotExists(){containerCreates++},getBlockBlobClient:client};
  const azure={BlobServiceClient:{fromConnectionString(){return{getContainerClient(){return container}}}}};
  try{
    const access=loadCommonJs('api/shared/public-access-store.js',{'@azure/storage-blob':azure});
    const req={headers:{'x-exporthub-environment':'production',host:'wonderful-forest-0f315e310.azurestaticapps.net'}};
    const issued=await access.issue(req,'avis',{subjectId:'SHIP-1031',shipmentId:'SHIP-1031',reference:'ABC123'},null,{environment:'production'});
    assert.equal(subjectReads,1,'Issue darf denselben Subject-Index nicht zweimal lesen.');
    await access.resolve(req,'avis',issued.token,{allowUsed:true},{environment:'production'});
    assert.equal(containerCreates,0,'RC1051: Der vorab bereitgestellte Public-Access-Container darf im Hotpath keinen createIfNotExists-Control-Plane-Aufruf mehr ausführen.');
  }finally{
    if(oldStorage===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=oldStorage;
    if(oldSecret===undefined)delete process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET;else process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET=oldSecret;
  }
});

test('RC1052: customer-avis issue erzeugt den Link ohne grossen Team-State-Write',async()=>{
  const oldStorage=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
  let teamReads=0,teamWrites=0,issueStarted=false;
  const team={schemaVersion:3,revision:12,state:{shipments:[{id:'SHIP-1031',reference:'ABC123',customerName:'Testkunde',selectedLocationId:'LOC-1',customerAvisEnabled:false,avisEnabled:false,status:'Entwurf'}]}};
  const blob={name:'team-state.json',async download(){teamReads++;return{readableStreamBody:Readable.from([Buffer.from(JSON.stringify(team))]),etag:'"team-1"'}},async upload(){teamWrites++;return{etag:'"team-2"'}}};
  const container={async createIfNotExists(){},getBlockBlobClient(){return blob}};
  const azure={BlobServiceClient:{fromConnectionString(){return{getContainerClient(){return container}}}}};
  const access={
    body(req){return req.body||{}},
    json(status,body,headers={}){return{status,headers,body:JSON.stringify(body)}},
    environment(){return'production'},
    async issue(_req,_kind,meta){issueStarted=true;assert.equal(meta.reference,'ABC123');assert.equal(meta.snapshot.customerName,'Testkunde');return{token:'a'.repeat(48),expiresAt:null}}
  };
  const auth={async validateSession(){return{user:{name:'Tester',rights:{shipment:{edit:true}}}}},hasAnyEditRight(){return true},error(code,message,status){const e=new Error(message);e.code=code;e.status=status;return e}};
  try{
    const handler=loadCommonJs('api/customer-avis/index.js',{'@azure/storage-blob':azure,'../shared/public-access-store':access,'../shared/fast-auth-store':auth});
    const context={log:{error(){}},res:null};
    await handler(context,{method:'POST',headers:{},body:{action:'issue',shipmentId:'SHIP-1031',reference:'ABC123',environment:'production'}});
    assert.equal(context.res.status,200);
    assert.equal(issueStarted,true,'Sicherer Avis-Token muss ausgestellt werden.');
    assert.equal(teamReads,1,'Der Team-State darf nur zum Auffinden der Sendung gelesen werden.');
    assert.equal(teamWrites,0,'Die normale Link-Erstellung darf den grossen Team-State nicht mehr neu hochladen.');
    const response=JSON.parse(context.res.body);
    assert.equal(response.timing.flagWriteMs,0);
    assert.match(response.url,/customer-avis\.html\?token=/);
  }finally{if(oldStorage===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=oldStorage}
});

test('RC1052: ungespeicherter Avis-Entwurf wird als kleiner Snapshot ausgegeben statt Team-State zu schreiben',async()=>{
  const oldStorage=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
  let teamWrites=0,capturedSnapshot=null;
  const team={schemaVersion:3,revision:12,state:{shipments:[]}};
  const blob={async download(){return{readableStreamBody:Readable.from([Buffer.from(JSON.stringify(team))]),etag:'"team-1"'}},async upload(){teamWrites++;return{etag:'"team-2"'}}};
  const azure={BlobServiceClient:{fromConnectionString(){return{getContainerClient(){return{getBlockBlobClient(){return blob}}}}}}};
  const access={
    body(req){return req.body||{}},
    json(status,body,headers={}){return{status,headers,body:JSON.stringify(body)}},
    environment(){return'production'},
    async issue(_req,_kind,meta){capturedSnapshot=meta.snapshot;return{token:'b'.repeat(48),expiresAt:null}}
  };
  const auth={async validateSession(){return{user:{name:'Tester',rights:{shipment:{edit:true}}}}},hasAnyEditRight(){return true},error(code,message,status){const e=new Error(message);e.code=code;e.status=status;return e}};
  try{
    const handler=loadCommonJs('api/customer-avis/index.js',{'@azure/storage-blob':azure,'../shared/public-access-store':access,'../shared/fast-auth-store':auth});
    const context={log:{error(){}},res:null};
    await handler(context,{method:'POST',headers:{},body:{action:'issue',shipmentId:'DRAFT-1',reference:'ABC123',environment:'production',shipmentSnapshot:{id:'DRAFT-1',reference:'ABC123',customerName:'Testkunde',selectedLocationId:'LOC-1',status:'Entwurf'}}});
    assert.equal(context.res.status,200);
    assert.equal(teamWrites,0);
    assert.equal(capturedSnapshot.customerName,'Testkunde');
    assert.equal(capturedSnapshot.selectedLocationId,'LOC-1');
    assert.equal(capturedSnapshot.reference,'ABC123');
  }finally{if(oldStorage===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=oldStorage}
});

test('RC1031: ein bereits ausgestellter Lieferavis-Link bleibt bei State-Refresh lokal verfügbar und wird nicht erneut ausgestellt',async()=>{
  const source=fs.readFileSync('assets/rc1027-lieferavis-immediate.js','utf8');
  const shipment={reference:'ABC123',ref:'ABC123',customerName:'Testkunde',status:'Entwurf',customerAvisEnabled:true,avisEnabled:true,customerAvisToken:'server-token'};
  let toggles=0;
  const refInput={id:'shipmentReference',name:'reference',value:'ABC123',closest(){return{textContent:'Sendungsreferenz'}},getAttribute(){return''}};
  const customerInput={id:'customerName',name:'customer',value:'Testkunde',closest(){return{textContent:'Kunde'}},getAttribute(){return''}};
  const document={readyState:'complete',querySelectorAll(sel){return sel==='#content input'?[refInput,customerInput]:[]},getElementById(){return null},addEventListener(){}};
  const link='https://example.test/customer-avis.html?token='+('a'.repeat(48))+'&environment=production';
  const base={link(sh){return sh&&sh.customerAvisToken?link:''},async toggle(on){toggles++;if(on){shipment.customerAvisToken='server-token';shipment.customerAvisEnabled=true}return true},injectMailBody(_sh,_t,b){return b}};
  const store=new Map();
  const window={document,ExportHUBCustomerAvis706:base,ExportHUBClean:{state:{shipment,currentShipment:shipment,shipments:[shipment]}},addEventListener(){},dispatchEvent(){return true},console,sessionStorage:{getItem(k){return store.get(k)||null},setItem(k,v){store.set(k,String(v))},removeItem(k){store.delete(k)}}};
  const context=vm.createContext({window,document,console,URL,Date,Math,Uint8Array,crypto:{getRandomValues(a){return a}},location:{href:'https://wonderful-forest-0f315e310.azurestaticapps.net/TESTVERSION.html',hostname:'wonderful-forest-0f315e310.azurestaticapps.net',host:'wonderful-forest-0f315e310.azurestaticapps.net'},sessionStorage:window.sessionStorage,setTimeout(fn){fn();return 1},requestAnimationFrame(fn){fn();return 1},Event:function(type){this.type=type},CustomEvent:function(type,opt){this.type=type;this.detail=opt&&opt.detail}});
  vm.runInContext(source,context,{filename:'assets/rc1027-lieferavis-immediate.js'});
  const api=window.ExportHUBCustomerAvis706,rc=window.ExportHUBRC1027Lieferavis;
  assert.equal(api.link(shipment),link,'Ausgestellter Link muss zunächst lesbar sein.');
  delete shipment.customerAvisToken;
  assert.equal(api.link(shipment),link,'Ein State-Refresh ohne Cloud-Token darf den bereits ausgestellten Link nicht aus der Oberfläche entfernen.');
  assert.equal(await rc.ensureCustomerAvis('state-refresh'),true);
  assert.equal(toggles,0,'Ein vorhandener lokal gesicherter Link darf nicht unnötig neu ausgestellt werden.');
});
