import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
 assert.match(guest,/data-eh1903-guest-open/);
 assert.match(guest,/guestOpen/);
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
 const oldStorage=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING,oldIsolation=process.env.EXPORTHUB_TEST_AUTH_ISOLATION;
 process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
 delete process.env.EXPORTHUB_TEST_AUTH_ISOLATION;
 t.after(()=>{
  if(oldStorage===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=oldStorage;
  if(oldIsolation===undefined)delete process.env.EXPORTHUB_TEST_AUTH_ISOLATION;else process.env.EXPORTHUB_TEST_AUTH_ISOLATION=oldIsolation;
 });
 const store=new Map(),names=[],user={role:'Export',rights:{documents:{level:'edit',edit:true,read:true}}};
 let loggedIn=false;
 t.mock.method(auth,'validateSession',async()=>{
  if(!loggedIn){const e=new Error('Nicht angemeldet');e.code='SESSION_INVALID';e.status=401;throw e}
  return{user,session:{environment:'production'},team:{state:{shipments:[]}}}
 });
 t.mock.method(auth,'environmentFromRequest',()=> 'production');
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
 const updated=await call('POST',{action:'public-save',id:docId,expectedRevision:returned.revision,fields:{...valid,contents:'1 Karton und Frachtpapiere'}},first.publicToken);
 assert.equal(updated.status,200,updated.body);
 const rev=JSON.parse(updated.body).record.revision;
 const uploaded=await call('POST',{action:'public-upload',id:docId,expectedRevision:rev,kind:'foto',fileName:'Abfahrt.jpg',base64:jpeg()},first.publicToken);
 assert.equal(uploaded.status,200,uploaded.body);
 const pic=JSON.parse(uploaded.body).record.files[0];
 const file=await call('GET',{action:'public-file',id:docId,fileId:pic.id},first.publicToken);
 assert.equal(file.status,200);
 assert.ok(Buffer.isBuffer(file.body));
 const forbidden=await call('GET',{action:'public-file',id:docId,fileId:pic.id});
 assert.equal(forbidden.status,403);
 const complaint=await call('POST',{action:'complaint',id:docId,expectedRevision:rev,text:'ohne Sitzung'},first.publicToken);
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
 // Gefaelschte X-Forwarded-For-Werte duerfen keine neuen Kontingente freischalten.
 for(let i=0;i<3;i++){
  const other=await call('POST',{action:'public-create',fields:valid,website:''},'','https://www.exporthub360.de',{'x-forwarded-for':'203.0.113.'+(i+1)});
  assert.equal(other.status,201,other.body);
 }
 const blocked=await call('POST',{action:'public-create',fields:valid,website:''},'','https://www.exporthub360.de',{'x-forwarded-for':'203.0.113.250'});
 assert.equal(blocked.status,429,blocked.body);
 assert.equal(JSON.parse(blocked.body).code,'PUBLIC_RATE_LIMIT');
});


test('RC1903: TESTSERVICE-Live-Smoke schreibt nur nach verifizierter Ziel-SHA',()=>{
 const live=fs.readFileSync('scripts/rc1903-testservice-guest-live.mjs','utf8');
 const workflow=fs.readFileSync('.github/workflows/rc1903-testservice-guest-live.yml','utf8');
 assert.match(live,/ashy-grass-065b7b803-testservice\.westeurope\.6\.azurestaticapps\.net/);
 assert.match(live,/assert\.equal\(target\.hostname,HOST/);
 assert.match(live,/assert\.equal\(healthData\?\.deployment\?\.environment,'testservice'/);
 assert.match(live,/assert\.equal\(healthData\?\.deployment\?\.buildId,sha/);
 assert.ok(live.indexOf("assert.equal(healthData?.deployment?.buildId,sha")<live.indexOf("request('POST','public-create'"));
 assert.match(live,/bytesJpg/);
 assert.match(live,/bytesPdf/);
 assert.match(live,/GET','public-file'/);
 assert.match(live,/Incorrect token must not retrieve record/);
 assert.match(workflow,/workflow_run:/);
 assert.match(workflow,/workflow_run\.conclusion == 'success'/);
 assert.match(workflow,/head_branch == 'main'/);
 assert.match(workflow,/RC1903_EXPECTED_SHA:/);
 assert.doesNotMatch(workflow,/\baction:\s*upload\b|\bproduction_release\b/);
});
