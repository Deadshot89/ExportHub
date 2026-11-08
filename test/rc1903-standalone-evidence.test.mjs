import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {Readable} from 'node:stream';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const apiRequire=createRequire(new URL('../api/package.json',import.meta.url));
const doc=require('../api/shipment-evidence/index.js');
const {BlobServiceClient}=apiRequire('@azure/storage-blob');
const auth=require('../api/shared/auth-store.js');
function jpeg(){return Buffer.from([0xff,0xd8,0xff,0xe0,0x12,0x34]).toString('base64')}
const valid={customer:'Fremdkunde',shipmentNumber:'EXT-2026-123',dispatchDate:'2026-11-07',colli:'3',weightKg:'27,500',shippingMethod:'Kurier',contents:'3 Kartons'};
test('RC1903: alle sechs Sprachen haben dieselben Formular- und Upload-Schluessel',()=>{
 const context={window:{}};
 vm.runInNewContext(fs.readFileSync('assets/i18n/shipment-evidence.js','utf8'),context);
 const packs=context.window.ExportHUBEvidenceI18n;
 const reference=Object.keys(packs.de).sort();
 for(const lang of ['de','en','fr','it','es','pl']){
  assert.deepEqual(Object.keys(packs[lang]).sort(),reference,'Uebersetzung unvollstaendig: '+lang);
  for(const key of reference)assert.ok(String(packs[lang][key]).trim(),lang+': '+key);
 }
});
test('RC1903: Externe Versandnachweise verlangen keine vorhandene ExportHUB-REF',()=>{
 const normalized=doc.fields(valid);
 assert.equal(normalized.customer,'Fremdkunde');
 assert.equal(normalized.weightKg,'27.500');
 assert.equal(normalized.exporthubRef,'');
 assert.throws(()=>doc.fields({...valid,dispatchDate:'2026-02-30'}),e=>e.code==='BAD_DATE');
 assert.throws(()=>doc.fields({...valid,colli:'-1'}),e=>e.code==='BAD_COLLI');
 assert.throws(()=>doc.fields({...valid,weightKg:'-2'}),e=>e.code==='BAD_WEIGHT');
 assert.throws(()=>doc.fields({...valid,customer:''}),e=>e.code==='REQUIRED_FIELDS');
});
test('RC1903: Dateiupload akzeptiert nur echte PDF/JPG/PNG-Signaturen',()=>{
 const f=doc.rawFile({kind:'foto',fileName:'Packtisch.jpg',base64:jpeg()},'DOK-20261107-ABCDEF12');
 assert.match(f.storedName,/^Versandfoto_DOK-20261107-ABCDEF12_/);
 assert.equal(f.kind,'foto');
 assert.throws(()=>doc.rawFile({kind:'foto',fileName:'f.jpg',base64:Buffer.from('not image').toString('base64')},'DOK-20261107-ABCDEF12'),e=>e.code==='FILE_SIGNATURE');
 assert.throws(()=>doc.rawFile({kind:'foto',fileName:'f.svg',base64:jpeg()},'DOK-20261107-ABCDEF12'),e=>e.code==='BAD_EXTENSION');
 assert.throws(()=>doc.id('../ABC123'),e=>e.code==='BAD_ID');
 assert.throws(()=>doc.rawFile({kind:'foto',fileName:'f.jpg',base64:null},'DOK-20261107-ABCDEF12'),e=>e.code==='BAD_FILE');
 const oversized='A'.repeat(20*1024*1024+4);
 assert.throws(()=>doc.rawFile({kind:'foto',fileName:'f.jpg',base64:oversized},'DOK-20261107-ABCDEF12'),e=>e.code==='MAX_FILE');
});
test('RC1903: unberechtigte und nur leseberechtigte Nutzer duerfen nicht schreiben',async t=>{
 const user={role:'Mitarbeiter',rights:{}};
 t.mock.method(auth,'validateSession',async()=>({user,session:{environment:'production'}}));
 async function call(payload){const ctx={};await doc(ctx,{method:'POST',body:payload,headers:{}});return ctx.res}
 const denied=await call({action:'create',fields:valid});
 assert.equal(denied.status,403,denied.body);
 assert.equal(JSON.parse(denied.body).code,'FORBIDDEN');
 user.rights.documents={level:'view',read:true};
 const readOnly=await call({action:'create',fields:valid});
 assert.equal(readOnly.status,403,readOnly.body);
 assert.equal(JSON.parse(readOnly.body).code,'READ_ONLY');
});
test('RC1903: Build bindet eigene Navigation und API getrennt vom Sendungsprozess ein',()=>{
 const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
 const ui=fs.readFileSync('assets/shipment-evidence.js','utf8');
 const conf=JSON.parse(fs.readFileSync('api/shipment-evidence/function.json','utf8'));
 assert.match(builder,/exporthub-rc1903-shipment-evidence/);
 assert.match(builder,/'assets\/shipment-evidence\.js'/);
 assert.match(builder,/'assets\/shipment-evidence\.css'/);
 assert.ok(builder.includes("'assets/shipment-evidence-guest.js'"));
 const guest=fs.readFileSync('assets/shipment-evidence-guest.js','utf8');
 assert.doesNotThrow(()=>new Function(guest),'Public form JavaScript must be parsable before browser tests');
 assert.doesNotMatch(guest,/ensureLoginEntry|data-eh1903-guest-open/);
 assert.match(guest,/eh1903-guest-root/);
 assert.match(guest,/STORAGE='exporthub-shipment-evidence-own-v2'/);
 assert.ok(fs.readFileSync('assets/sendungsdokumentation.html','utf8').includes('id="eh1903-guest-root"'));
 assert.match(guest,/guestIntro/);
 assert.match(guest,/public-submit/);
 assert.doesNotMatch(guest,/public-save/);
 const prod=JSON.parse(fs.readFileSync('staticwebapp.config.json','utf8'));
 const testservice=JSON.parse(fs.readFileSync('staticwebapp.testservice.config.json','utf8'));
 for(const cfg of [prod,testservice]){
  const route=cfg.routes.find(v=>v.route==='/sendungsdokumentation');
  assert.equal(route?.rewrite,'/assets/sendungsdokumentation.html');
  assert.deepEqual(route.allowedRoles,['anonymous']);
  assert.equal(route.headers['Referrer-Policy'],'no-referrer');
 }
 assert.match(guest,/public-create/);
 assert.match(guest,/public-upload/);
 assert.match(ui,/data-exporthub-evidence-nav/);
 assert.match(ui,/replaceChildren\(app\)/);
 assert.match(ui,/data-exporthub-view','shipmentevidence'/);
 assert.match(ui,/action:'file'/);
 // Editing the form before uploading must save the draft on the same document.
 assert.match(ui,/action:'save',id:originalId,expectedRevision:state\.record\.revision,fields:draft/);
 assert.match(ui,/expectedId&&expectedId!==originalId/);
 assert.match(ui,/node\.classList\.add\('active'\)/);
 assert.match(ui,/async function scanAll\(\)/);
 assert.match(ui,/const ok=await loadList\(false\)/);
 assert.match(ui,/state\.searchRun\+\+/);
 assert.equal(conf.bindings[0].route,'shipment-evidence');
});
test('RC1903: TESTSERVICE-Dokumentationen landen nur unter getrenntem Test-Prefix',async t=>{
 const previous={storage:process.env.EXPORTHUB_STORAGE_CONNECTION_STRING,isolation:process.env.EXPORTHUB_TEST_AUTH_ISOLATION};
 process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
 delete process.env.EXPORTHUB_TEST_AUTH_ISOLATION;
 t.after(()=>{
  if(previous.storage===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
  else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=previous.storage;
  if(previous.isolation===undefined)delete process.env.EXPORTHUB_TEST_AUTH_ISOLATION;
  else process.env.EXPORTHUB_TEST_AUTH_ISOLATION=previous.isolation;
 });
 const used=[],stored=new Map();
 const user={role:'Export',rights:{documents:{level:'edit',read:true,edit:true}}};
 t.mock.method(auth,'validateSession',async()=>({user,session:{environment:'production'}}));
 t.mock.method(auth,'environmentFromRequest',()=> 'testservice');
 t.mock.method(auth,'loginStorageEnvironment',()=> 'production');
 t.mock.method(BlobServiceClient,'fromConnectionString',()=>({
  getContainerClient:(container)=>({
   getBlockBlobClient:(name)=>{
    used.push({container,name});
    return{
     async uploadData(bytes){stored.set(name,Buffer.from(bytes));return{etag:'"test-etag"'}},
     async download(){if(!stored.has(name))throw new Error('Unexpected missing record');return{etag:'"test-etag"',readableStreamBody:Readable.from([stored.get(name)])}}
    };
   }
  })
 }));
 const ctx={};
 await doc(ctx,{method:'POST',headers:{},body:{action:'create',fields:valid}});
 assert.equal(ctx.res.status,201,ctx.res.body);
 assert.ok(used.length>0);
 assert.ok(used.every(({container,name})=>container===auth.TEAM_CONTAINER&&name.startsWith('testservice/shipment-evidence/v1/records/')));
 assert.ok([...stored.keys()].every(name=>!name.startsWith('shipment-evidence/v1/records/')));
});
test('RC1903: Unabhängige Speicherung, Dateireadback, Beschwerde, ETag und GET ohne Sendungsbestand',async t=>{
 const oldConnection=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
 const oldIsolation=process.env.EXPORTHUB_TEST_AUTH_ISOLATION;
 process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
 delete process.env.EXPORTHUB_TEST_AUTH_ISOLATION;
 t.after(()=>{if(oldConnection===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=oldConnection;
   if(oldIsolation===undefined)delete process.env.EXPORTHUB_TEST_AUTH_ISOLATION;else process.env.EXPORTHUB_TEST_AUTH_ISOLATION=oldIsolation});
 const stored=new Map(),access=[];
 const user={role:'Export',rights:{shipment:{level:'edit',read:true,edit:true}}};
 t.mock.method(auth,'validateSession',async()=>({user,session:{environment:'production'},team:{state:{shipments:[]}}}));
 t.mock.method(auth,'environmentFromRequest',()=> 'production');
 t.mock.method(auth,'loginStorageEnvironment',()=> 'production');
 t.mock.method(BlobServiceClient,'fromConnectionString',()=>({
  getContainerClient:()=>({
   listBlobsFlat:({prefix})=>({byPage:()=>({next:async()=>({value:{segment:{blobItems:[...stored.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name}))},continuationToken:null}})})}),
   getBlockBlobClient:(key)=>{access.push(key);return{
    async download(){const item=stored.get(key);if(!item){const e=new Error('Missing');e.statusCode=404;throw e}return{etag:item.etag,readableStreamBody:Readable.from([item.bytes])}},
    async uploadData(bytes,opts){const existing=stored.get(key),conditions=opts&&opts.conditions||{};
     if(conditions.ifNoneMatch==='*'&&existing||conditions.ifMatch&&(!existing||conditions.ifMatch!==existing.etag)){const e=new Error('Conflict');e.statusCode=412;throw e}
     const rev=existing?existing.rev+1:1,etag='"etag-'+rev+'"';stored.set(key,{bytes:Buffer.from(bytes),rev,etag});return{etag}},
    async deleteIfExists(){stored.delete(key);return{}}
   }}
  })
 }));
 async function call(method,input){const ctx={},req={method,headers:{},query:method==='GET'?input:{},body:method==='POST'?input:undefined};await doc(ctx,req);return ctx.res}
 const created=await call('POST',{action:'create',fields:valid});
 assert.equal(created.status,201,created.body);
 const record=JSON.parse(created.body).record;
 assert.match(record.id,/^DOK-20261107-|^DOK-\d{8}-[A-F0-9]{8}$/);
 assert.equal(record.fields.customer,'Fremdkunde');
 const fetched=await call('GET',{action:'get',id:record.id});
 assert.equal(JSON.parse(fetched.body).record.fields.shipmentNumber,'EXT-2026-123');
 const upload=await call('POST',{action:'upload',id:record.id,expectedRevision:record.revision,kind:'foto',fileName:'Versand.jpg',base64:jpeg()});
 assert.equal(upload.status,200,upload.body);
 const uploaded=JSON.parse(upload.body).record;
 assert.equal(uploaded.files.length,1);
 const file=await call('GET',{action:'file',id:record.id,fileId:uploaded.files[0].id});
 assert.equal(file.status,200);
 assert.ok(Buffer.isBuffer(file.body));
 assert.equal(file.body.length,6);
 const pdfBytes=Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n');
 const delivery=await call('POST',{action:'upload',id:record.id,expectedRevision:uploaded.revision,kind:'lieferschein',fileName:'Original Lieferschein.pdf',base64:pdfBytes.toString('base64')});
 assert.equal(delivery.status,200,delivery.body);
 const afterDelivery=JSON.parse(delivery.body).record;
 const notes=afterDelivery.files.filter(f=>f.kind==='lieferschein');
 assert.equal(notes.length,1);
 assert.match(notes[0].name,/^Lieferschein_DOK-\d{8}-[A-F0-9]{8}_/);
 const readPdf=await call('GET',{action:'file',id:record.id,fileId:notes[0].id});
 assert.equal(readPdf.status,200);
 assert.ok(readPdf.body.equals(pdfBytes));
 const complaint=await call('POST',{action:'complaint',id:record.id,expectedRevision:afterDelivery.revision,text:'Beschädigter Karton',reportedDate:'2026-11-07'});
 assert.equal(complaint.status,200,complaint.body);
 const complaintRecord=JSON.parse(complaint.body).record;
 assert.equal(complaintRecord.complaints[0].state,'offen');
 const closed=await call('POST',{action:'complaint-status',id:record.id,expectedRevision:complaintRecord.revision,complaintId:complaintRecord.complaints[0].id,state:'abgeschlossen'});
 assert.equal(closed.status,200,closed.body);
 assert.equal(JSON.parse(closed.body).record.complaints[0].state,'abgeschlossen');
 const stale=await call('POST',{action:'save',id:record.id,expectedRevision:0,fields:valid});
 assert.equal(stale.status,409);
 const listed=await call('GET',{action:'list'});
 assert.equal(listed.status,200);
 assert.equal(JSON.parse(listed.body).records[0].id,record.id);
 assert.ok(access.some(k=>k.includes('/files/'+record.id+'/')));
 assert.ok(access.every(k=>k.startsWith('shipment-evidence/v1/')));
});


test('RC1903: ohne Login nur neue Sendung erfassen, zeitlich begrenzte eigene Fotos hochladen',async t=>{
 const oldStorage=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING,
       oldIsolation=process.env.EXPORTHUB_TEST_AUTH_ISOLATION,
       oldMetadataPath=process.env.EXPORTHUB_RELEASE_METADATA_PATH;
 const metadataDir=fs.mkdtempSync(path.join(os.tmpdir(),'exporthub-rc1903-'));
 const metadataPath=path.join(metadataDir,'release-metadata.json');
 process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
 delete process.env.EXPORTHUB_TEST_AUTH_ISOLATION;
 t.after(()=>{
  if(oldStorage===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=oldStorage;
  if(oldIsolation===undefined)delete process.env.EXPORTHUB_TEST_AUTH_ISOLATION;else process.env.EXPORTHUB_TEST_AUTH_ISOLATION=oldIsolation;
  if(oldMetadataPath===undefined)delete process.env.EXPORTHUB_RELEASE_METADATA_PATH;else process.env.EXPORTHUB_RELEASE_METADATA_PATH=oldMetadataPath;
  fs.rmSync(metadataDir,{recursive:true,force:true});
 });
 const store=new Map(),names=[],user={role:'Export',rights:{documents:{level:'edit',edit:true,read:true}}};
 const masterCustomers=[{id:'CUST-D1001',customerNumber:'D1001',account:'D1001',name:'Bestandskunde GmbH'}];
 t.mock.method(auth,'clientsForEnvironment',async()=>({team:{name:'team-state.json'}}));
 t.mock.method(auth,'readJson',async()=>({value:{state:{customers:masterCustomers}}}));
 t.mock.method(auth,'mutateTeamForEnvironment',async(environment,mutator)=>{
  const team={state:{customers:masterCustomers}};
  const result=await mutator(team);
  return{team,result};
 });
 let loggedIn=false;
 t.mock.method(auth,'validateSession',async()=>{
  if(!loggedIn){const e=new Error('Nicht angemeldet');e.code='SESSION_INVALID';e.status=401;throw e}
  return{user,session:{environment:'production'},team:{state:{shipments:[]}}}
 });
 t.mock.method(auth,'environmentFromRequest',(req)=>req?.headers?.['x-exporthub-environment']==='testservice'?'testservice':'production');
 t.mock.method(auth,'loginStorageEnvironment',()=> 'production');
 t.mock.method(BlobServiceClient,'fromConnectionString',()=>({
  getContainerClient:()=>({
   listBlobsFlat:({prefix})=>({byPage:()=>({next:async()=>({value:{segment:{blobItems:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name}))},continuationToken:null}})})}),
   getBlockBlobClient:(name)=>{
    names.push(name);
    return{
     async download(){const s=store.get(name);if(!s){const e=new Error('Missing');e.statusCode=404;throw e}return{etag:s.etag,readableStreamBody:Readable.from([s.bytes])}},
     async uploadData(bytes,opts){
      const old=store.get(name),cond=opts&&opts.conditions||{};
      if(cond.ifNoneMatch==='*'&&old||cond.ifMatch&&(!old||cond.ifMatch!==old.etag)){const e=new Error('Conflict');e.statusCode=412;throw e}
      const n=old?old.n+1:1,etag='"guest-'+n+'"';store.set(name,{bytes:Buffer.from(bytes),etag,n});return{etag}
     },
     async deleteIfExists(){store.delete(name)}
    }
   }
  })
 }));
 async function call(method,input={},token='',origin='https://www.exporthub360.de',extraHeaders={}){
  const headers={host:'www.exporthub360.de',...extraHeaders};
  if(origin)headers.origin=origin;
  if(token)headers['x-exporthub-evidence-token']=token;
  const ctx={};await doc(ctx,{method,headers,query:method==='GET'?input:{},body:method==='POST'?input:undefined});return ctx.res
 }
 const badOrigin=await call('POST',{action:'public-create',fields:valid},'','https://evil.example');
 assert.equal(badOrigin.status,403,badOrigin.body);
 const unknownCustomer=await call('POST',{action:'public-customer-lookup',customerNumber:'D9999'});
 assert.equal(unknownCustomer.status,404,unknownCustomer.body);
 const foundCustomer=await call('POST',{action:'public-customer-lookup',customerNumber:'D1001'});
 assert.equal(foundCustomer.status,200,foundCustomer.body);
 assert.deepEqual(JSON.parse(foundCustomer.body).customer,{id:'CUST-D1001',number:'D1001',name:'Bestandskunde GmbH'});
 assert.ok(!foundCustomer.body.includes('customers":['));
 // Azure Functions may expose its internal host instead of the public SWA host.
 // Accept only the exact TESTSERVICE Origin in the matching environment.
 const testHost='https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net';
 const azureProxyHeaders={host:'exporthub-functions.internal.azurewebsites.net'};
 const deployment={buildId:'a'.repeat(40),visibleRelease:'RC1903',technicalBuild:'RC1903-ci',
  builtAt:new Date().toISOString(),environment:'testservice'};
 fs.writeFileSync(metadataPath,JSON.stringify(deployment));
 process.env.EXPORTHUB_RELEASE_METADATA_PATH=metadataPath;
 const existingCustomer=await call('POST',{action:'public-create',fields:{...valid,shipmentNumber:'MASTER-123',
  customerMode:'existing',customerNumber:'D1001',customer:'Falscher Name'},website:''},'',testHost,azureProxyHeaders);
 assert.equal(existingCustomer.status,201,existingCustomer.body);
 assert.equal(JSON.parse(existingCustomer.body).record.fields.customer,'Bestandskunde GmbH');
 assert.equal(JSON.parse(existingCustomer.body).record.fields.customerId,'CUST-D1001');
 // This reproduces the browser request: NO X-ExportHUB-Environment client header.
 const pending=await call('POST',{action:'public-create',fields:{...valid,shipmentNumber:'NEW-CUST-001',
  customerMode:'pending',customerNumber:'NEW900',customer:'Neukunde GmbH'},website:''},'',testHost,azureProxyHeaders);
 assert.equal(pending.status,201,pending.body);
 const pendingRecord=JSON.parse(pending.body).record;
 loggedIn=true;
 const rejected=await call('POST',{action:'register-customer',id:pendingRecord.id,expectedRevision:pendingRecord.revision},'',testHost,azureProxyHeaders);
 assert.equal(rejected.status,403,rejected.body);
 assert.equal(JSON.parse(rejected.body).code,'CUSTOMER_WRITE_FORBIDDEN');
 user.rights.customers={level:'edit',read:true,edit:true};
 const adopted=await call('POST',{action:'register-customer',id:pendingRecord.id,expectedRevision:pendingRecord.revision},'',testHost,azureProxyHeaders);
 assert.equal(adopted.status,200,adopted.body);
 assert.equal(JSON.parse(adopted.body).record.fields.customerMode,'existing');
 assert.equal(masterCustomers.filter(x=>x.account==='NEW900').length,1);
 const duplicate=await call('POST',{action:'public-create',fields:{...valid,shipmentNumber:'NEW-CUST-002',
  customerMode:'pending',customerNumber:'D1001',customer:'Fake'},website:''},'',testHost,azureProxyHeaders);
 assert.equal(duplicate.status,409,duplicate.body);
 loggedIn=false;
 const viaProxy=await call('POST',{action:'public-create',fields:{...valid,shipmentNumber:'RC1903-AZURE-PROXY'},website:''},'',testHost,azureProxyHeaders);
 assert.equal(viaProxy.status,201,viaProxy.body);
 assert.ok([...store.keys()].some(name=>name.startsWith('testservice/shipment-evidence/v1/records/')));
 const proxied=JSON.parse(viaProxy.body);
 const proxiedGet=await call('GET',{action:'public-get',id:proxied.record.id},proxied.publicToken,testHost,azureProxyHeaders);
 assert.equal(proxiedGet.status,200,proxiedGet.body);
 const proxiedUpload=await call('POST',{action:'public-upload',id:proxied.record.id,expectedRevision:proxied.record.revision,
  kind:'foto',fileName:'Proxy-Upload.jpg',base64:jpeg()},proxied.publicToken,testHost,azureProxyHeaders);
 assert.equal(proxiedUpload.status,200,proxiedUpload.body);
 const uploadedProxyRecord=JSON.parse(proxiedUpload.body).record;
 const proxiedSubmit=await call('POST',{action:'public-submit',id:proxied.record.id,expectedRevision:uploadedProxyRecord.revision},
  proxied.publicToken,testHost,azureProxyHeaders);
 assert.equal(proxiedSubmit.status,200,proxiedSubmit.body);
 const lockedProxy=await call('POST',{action:'public-upload',id:proxied.record.id,
  expectedRevision:JSON.parse(proxiedSubmit.body).record.revision,
  kind:'foto',fileName:'After-Submit.jpg',base64:jpeg()},proxied.publicToken,testHost,azureProxyHeaders);
 assert.equal(lockedProxy.status,403,lockedProxy.body);
 assert.equal(JSON.parse(lockedProxy.body).code,'PUBLIC_READ_ONLY');
 const spoofedOrigin=await call('POST',{action:'public-create',fields:{...valid,shipmentNumber:'RC1903-SPOOF'},website:''},'','https://attacker.example',azureProxyHeaders);
 assert.equal(spoofedOrigin.status,403,spoofedOrigin.body);
 const otherSwa=await call('POST',{action:'public-create',fields:{...valid,shipmentNumber:'RC1903-OTHER-SWA'},website:''},'','https://different-tenant.azurestaticapps.net',azureProxyHeaders);
 assert.equal(otherSwa.status,403,otherSwa.body);
 // Spoofed client environment must never change verified server deployment identity.
 fs.writeFileSync(metadataPath,JSON.stringify({...deployment,environment:'production'}));
 const wrongEnvironment=await call('POST',{action:'public-create',fields:{...valid,shipmentNumber:'RC1903-PROD-ORIGIN'},website:''},'',testHost,{
  ...azureProxyHeaders,'x-exporthub-environment':'testservice'
 });
 assert.equal(wrongEnvironment.status,403,wrongEnvironment.body);
 assert.equal(JSON.parse(wrongEnvironment.body).code,'BAD_ORIGIN');
 // Missing trusted deployment metadata must also fail closed for internal hosts.
 fs.writeFileSync(metadataPath,JSON.stringify({environment:'testservice'}));
 const unverified=await call('POST',{action:'public-create',fields:{...valid,shipmentNumber:'RC1903-UNVERIFIED'},website:''},'',testHost,azureProxyHeaders);
 assert.equal(unverified.status,403,unverified.body);
 delete process.env.EXPORTHUB_RELEASE_METADATA_PATH;
 const created=await call('POST',{action:'public-create',fields:valid,website:''});
 assert.equal(created.status,201,created.body);
 const first=JSON.parse(created.body);
 assert.match(first.record.id,/^DOK-\d{8}-[A-F0-9]{8}$/);
 assert.match(first.publicToken,/^[A-Za-z0-9_-]{40,60}$/);
 assert.ok(!('publicAccess' in first.record));
 const docId=first.record.id;
 const privateStored=JSON.parse(store.get('shipment-evidence/v1/records/'+docId+'.json').bytes.toString());
 assert.notEqual(privateStored.publicAccess.hash,first.publicToken);
 const unauthorized=await call('GET',{action:'get',id:docId});
 assert.equal(unauthorized.status,401);
 const badToken=await call('GET',{action:'public-get',id:docId},'A'.repeat(43));
 assert.equal(badToken.status,403);
 const blobName='shipment-evidence/v1/records/'+docId+'.json';
 const beforeExpiry=store.get(blobName),expired=JSON.parse(beforeExpiry.bytes.toString());
 expired.publicAccess.expiresAt='2000-01-01T00:00:00.000Z';
 store.set(blobName,{...beforeExpiry,bytes:Buffer.from(JSON.stringify(expired))});
 const deniedExpired=await call('GET',{action:'public-get',id:docId},first.publicToken);
 assert.equal(deniedExpired.status,403);
 store.set(blobName,beforeExpiry);
 const own=await call('GET',{action:'public-get',id:docId},first.publicToken);
 assert.equal(own.status,200,own.body);
 const returned=JSON.parse(own.body).record;
 assert.ok(!('publicAccess' in returned));
 const deniedPublicEdit=await call('POST',{action:'public-save',id:docId,expectedRevision:returned.revision,fields:{...valid,contents:'Anders'}},first.publicToken);
 assert.equal(deniedPublicEdit.status,401,'Öffentliche Feldänderung wird nicht mehr angeboten');
 const uploaded=await call('POST',{action:'public-upload',id:docId,expectedRevision:returned.revision,kind:'foto',fileName:'Abfahrt.jpg',base64:jpeg()},first.publicToken);
 assert.equal(uploaded.status,200,uploaded.body);
 const uploadedRecord=JSON.parse(uploaded.body).record;
 const pic=uploadedRecord.files[0];
 const submitted=await call('POST',{action:'public-submit',id:docId,expectedRevision:uploadedRecord.revision},first.publicToken);
 assert.equal(submitted.status,200,submitted.body);
 assert.ok(JSON.parse(submitted.body).record.submittedAt);
 const afterSubmit=await call('POST',{action:'public-upload',id:docId,expectedRevision:JSON.parse(submitted.body).record.revision,kind:'foto',fileName:'Nachtrag.jpg',base64:jpeg()},first.publicToken);
 assert.equal(afterSubmit.status,403,afterSubmit.body);
 assert.equal(JSON.parse(afterSubmit.body).code,'PUBLIC_READ_ONLY');
 const file=await call('GET',{action:'public-file',id:docId,fileId:pic.id},first.publicToken);
 assert.equal(file.status,200);
 assert.ok(Buffer.isBuffer(file.body));
 const forbidden=await call('GET',{action:'public-file',id:docId,fileId:pic.id});
 assert.equal(forbidden.status,403);
 const complaint=await call('POST',{action:'complaint',id:docId,expectedRevision:JSON.parse(submitted.body).record.revision,text:'ohne Sitzung'},first.publicToken);
 assert.equal(complaint.status,401);
 loggedIn=true;
 const staff=await call('GET',{action:'get',id:docId});
 assert.equal(staff.status,200);
 assert.ok(!('publicAccess' in JSON.parse(staff.body).record));
 // Interne Beschwerden und Team-Dateien bleiben fuer den Gast unsichtbar.
 const staffRecord=JSON.parse(staff.body).record;
 const report=await call('POST',{action:'complaint',id:docId,expectedRevision:staffRecord.revision,text:'Interne Kundenbeschwerde'});
 assert.equal(report.status,200,report.body);
 const reported=JSON.parse(report.body).record;
 const pdfBytes=Buffer.from('%PDF-1.7\\n1 0 obj\\nendobj\\n');
 const teamFile=await call('POST',{action:'upload',id:docId,expectedRevision:reported.revision,kind:'lieferschein',fileName:'Intern.pdf',base64:pdfBytes.toString('base64')});
 assert.equal(teamFile.status,200,teamFile.body);
 const internalId=JSON.parse(teamFile.body).record.files.find(file=>file.uploadedBy!=='Gastformular').id;
 const scoped=await call('GET',{action:'public-get',id:docId},first.publicToken);
 assert.equal(scoped.status,200,scoped.body);
 const publicView=JSON.parse(scoped.body).record;
 assert.ok(!('complaints' in publicView));
 assert.ok(!('history' in publicView));
 assert.ok(!('updatedBy' in publicView));
 assert.equal(publicView.files.length,1);
 const forbiddenInternal=await call('GET',{action:'public-file',id:docId,fileId:internalId},first.publicToken);
 assert.equal(forbiddenInternal.status,404);
 const list=await call('GET',{action:'list'});
 assert.equal(list.status,200);
 assert.ok(!('publicAccess' in JSON.parse(list.body).records[0]));
 assert.ok(names.some(k=>k.includes('/public-rate/')));
 assert.ok(names.some(k=>k.includes('/files/'+docId+'/')));
 // Keine der IP-Header-Varianten darf eine weitere Neuanlage mit derselben
 // Kunden-/Sendungsnummer erlauben: max. drei pro Stunde (inklusive der ersten).
 for(let i=0;i<2;i++){
  const other=await call('POST',{action:'public-create',fields:valid,website:''},'','https://www.exporthub360.de',{
   'x-forwarded-for':'203.0.113.'+(i+1),
   'x-ms-client-ip':'198.51.100.'+(i+1),
   'x-azure-clientip':'192.0.2.'+(i+1)
  });
  assert.equal(other.status,201,other.body);
 }
 const blocked=await call('POST',{action:'public-create',fields:valid,website:''},'','https://www.exporthub360.de',{
  'x-forwarded-for':'203.0.113.250','x-ms-client-ip':'198.51.100.250','x-azure-clientip':'192.0.2.250'
 });
 assert.equal(blocked.status,429,blocked.body);
 assert.equal(JSON.parse(blocked.body).code,'PUBLIC_RATE_LIMIT');
 // Eine echte andere Sendungsnummer ist nicht durch die unbekannte Besucher-IP auf
 // vier Vorgänge pro Stunde beschränkt; es gilt die globale Limitierung.
 const nextShipment=await call('POST',{action:'public-create',fields:{...valid,shipmentNumber:'EXT-2026-OTHER'},website:''},'','https://www.exporthub360.de',{
  'x-azure-clientip':'203.0.113.99'
 });
 assert.equal(nextShipment.status,201,nextShipment.body);
 // Auch ein Angreifer mit beliebig vielen Sendungsnummern oder Headerwerten
 // kann das globale Stundenkontingent von 40 Erfassungen nicht ueberziehen.
 for(let i=0;i<36;i++){
  const made=await call('POST',{action:'public-create',fields:{...valid,shipmentNumber:'RC1903-GLOBAL-'+i},website:''},'','https://www.exporthub360.de',{
   'x-forwarded-for':'192.0.2.'+(i+1),'x-ms-client-ip':'198.51.100.'+(i+1)
  });
  assert.equal(made.status,201,'Neuanlage '+i+': '+made.body);
 }
 const globallyBlocked=await call('POST',{action:'public-create',fields:{...valid,shipmentNumber:'RC1903-GLOBAL-EXTRA'},website:''},'','https://www.exporthub360.de',{
  'x-ms-client-ip':'198.51.100.200'
 });
 assert.equal(globallyBlocked.status,429,globallyBlocked.body);
 assert.equal(JSON.parse(globallyBlocked.body).code,'PUBLIC_RATE_LIMIT');
 assert.ok([...store.keys()].some(key=>key.endsWith('/global.json')));
 assert.ok(![...store.keys()].some(key=>key.includes('/client-')||key.includes('/unidentified.json')));
 // Eine normale Mitarbeiterberechtigung reicht ausdrücklich NICHT zum Löschen.
 const nonAdminDelete=await call('POST',{action:'delete',id:docId,expectedRevision:JSON.parse(teamFile.body).record.revision});
 assert.equal(nonAdminDelete.status,403,nonAdminDelete.body);
 assert.equal(JSON.parse(nonAdminDelete.body).code,'ADMIN_REQUIRED');
 user.globalAdmin=true;
 const adminView=await call('GET',{action:'get',id:docId});
 assert.equal(JSON.parse(adminView.body).canDelete,true);
 const deleted=await call('POST',{action:'delete',id:docId,expectedRevision:JSON.parse(adminView.body).record.revision});
 assert.equal(deleted.status,200,deleted.body);
 const afterDelete=await call('GET',{action:'list'});
 assert.ok(!JSON.parse(afterDelete.body).records.some(x=>x.id===docId));
 assert.equal((await call('GET',{action:'get',id:docId})).status,404);
 assert.equal((await call('GET',{action:'public-get',id:docId},first.publicToken)).status,404);
 const retained=JSON.parse(store.get('shipment-evidence/v1/records/'+docId+'.json').bytes.toString());
 assert.ok(retained.deletedAt);
 assert.ok(retained.history.some(event=>event.action==='admin-delete'));
 assert.ok([...store.keys()].some(k=>k.includes('/files/'+docId+'/')));
});


test('RC1903: TESTSERVICE-Live-Smoke schreibt nur nach verifizierter Ziel-SHA',()=>{
 const live=fs.readFileSync('scripts/rc1903-testservice-guest-live.mjs','utf8');
 const workflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');
 assert.match(live,/ashy-grass-065b7b803-testservice\.westeurope\.6\.azurestaticapps\.net/);
 assert.match(live,/assert\.equal\(target\.hostname,HOST/);
 assert.match(live,/assert\.equal\(healthData\?\.deployment\?\.environment,'testservice'/);
 assert.match(live,/assert\.equal\(healthData\?\.deployment\?\.buildId,sha/);
 assert.ok(live.indexOf("assert.equal(healthData?.deployment?.buildId,sha")<live.indexOf("request('POST','public-create'"));
 assert.match(live,/bytesJpg/);
 assert.match(live,/bytesPdf/);
 assert.match(live,/GET','public-file'/);
 assert.match(live,/Incorrect token must not retrieve record/);
 assert.match(workflow,/RC1903 Sendungsdokumentation TESTSERVICE Live-Gate vor Production-Freigabe/);
 assert.match(workflow,/RC1903_EXPECTED_SHA:/);
 assert.match(workflow,/node scripts\/rc1903-testservice-guest-live\.mjs/);
 assert.ok(workflow.indexOf('RC1553 TESTSERVICE deployment identity prüfen')<workflow.indexOf('RC1903 Sendungsdokumentation TESTSERVICE Live-Gate'));
 assert.ok(workflow.indexOf('RC1903 Sendungsdokumentation TESTSERVICE Live-Gate')<workflow.indexOf('RC1810 Urgent Order TESTSERVICE'));
 assert.match(workflow,/git diff --name-only HEAD\^ HEAD/);
});
