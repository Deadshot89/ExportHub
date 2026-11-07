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
});
test('RC1903: Build bindet eigene Navigation und API getrennt vom Sendungsprozess ein',()=>{
 const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
 const ui=fs.readFileSync('assets/shipment-evidence.js','utf8');
 const conf=JSON.parse(fs.readFileSync('api/shipment-evidence/function.json','utf8'));
 assert.match(builder,/exporthub-rc1903-shipment-evidence/);
 assert.match(builder,/'assets\/shipment-evidence\.js'/);
 assert.match(builder,/'assets\/shipment-evidence\.css'/);
 assert.match(ui,/data-exporthub-evidence-nav/);
 assert.match(ui,/replaceChildren\(app\)/);
 assert.match(ui,/data-exporthub-view','shipmentevidence'/);
 assert.match(ui,/action:'file'/);
 // Editing the form before uploading must save the draft on the same document.
 assert.match(ui,/action:'save',id:originalId,expectedRevision:state\.record\.revision,fields:draft/);
 assert.match(ui,/expectedId&&expectedId!==originalId/);
 assert.match(ui,/node\.classList\.add\('active'\)/);
 assert.equal(conf.bindings[0].route,'shipment-evidence');
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
