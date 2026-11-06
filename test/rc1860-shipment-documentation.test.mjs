import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const apiRequire=createRequire(new URL('../api/package.json',import.meta.url));
const doc=require('../api/shipment-documentation/index.js');
const refFiles=require('../api/reference-files/index.js');
const b64=bytes=>Buffer.from(bytes).toString('base64');

test('Sendungsdokumentation: REF muss genau 6 Zeichen haben',()=>{
 assert.equal(doc.reference(' abc123 '),'ABC123');
 for(const invalid of ['','AB12','ABC1234','A-B123','../../x','ABC 23'])assert.throws(()=>doc.reference(invalid));
});
test('Sendungsdokumentation: Felder sauber normalisiert',()=>{
 const x=doc.normalizeFields({shipmentNumber:' 123 ',customer:' Kunde ',dispatchDate:'2026-11-06',colli:' 6 ',weightKg:'125,500',contents:'Fragile Teile'});
 assert.equal(x.shipmentNumber,'123');
 assert.equal(x.customer,'Kunde');
 assert.equal(x.colli,'6');
 assert.equal(x.weightKg,'125.500');
 assert.equal(x.contents,'Fragile Teile');
 assert.equal(x.dispatchDate,'2026-11-06');
});
test('Sendungsdokumentation: ungueltige Werte werden nicht als Versandnachweis gespeichert',()=>{
 for(const x of [{colli:'-2'},{colli:'2.5'},{weightKg:'NaN'},{weightKg:'-5'},{dispatchDate:'morgen'}])assert.throws(()=>doc.normalizeFields(x));
 assert.throws(()=>doc.normalizeFields(null));
 assert.throws(()=>doc.normalizeFields({customer:'X'.repeat(201)}),e=>e.code==='FIELD_TOO_LONG');
 assert.throws(()=>doc.normalizeFields({contents:'A'.repeat(3001)}),e=>e.code==='FIELD_TOO_LONG');
});
test('Kundenbeschwerden sind revisioniert und nur mit Login erreichbar',()=>{
 const api=fs.readFileSync('api/shipment-documentation/index.js','utf8');
 assert.match(api,/await auth\.validateSession\(req\)/);
 assert.match(api,/auth\.environmentFromRequest\(req\)/);
 assert.match(api,/expected!==existing\.record\.revision/);
 assert.match(api,/ifMatch:etag/);
 assert.match(api,/ifNoneMatch:'\*'/);
 assert.match(api,/action==='complaint'/);
 assert.match(api,/action==='complaint-status'/);
 assert.match(api,/history\.push\(event\)/);
 assert.match(api,/WRITE_READBACK_MISMATCH/);
 assert.match(api,/const proof=await read\(blob,record\.reference\)/);
 assert.match(api,/testservice\/shipment-documentation/);
 assert.match(api,/Content-Type.*application\/json/);
});
test('Nur Benutzer mit Sendungs- oder Dokumentrechten dürfen Belege öffnen oder verändern',()=>{
 const sh={state:{shipments:[{ref:'ABC123',customerName:'Fiktiv'}]}};
 const editor={role:'Export',rights:{shipment:{level:'edit',read:true,edit:true}}};
 const viewer={role:'Export',rights:{shipmentoverview:{level:'view',read:true,edit:false}}};
 const stranger={role:'Export',rights:{shipment:{level:'none'}}};
 assert.doesNotThrow(()=>doc.assertShipmentAccess(editor,sh,'ABC123','GET'));
 assert.doesNotThrow(()=>doc.assertShipmentAccess(editor,sh,'ABC123','POST'));
 assert.doesNotThrow(()=>doc.assertShipmentAccess(viewer,sh,'ABC123','GET'));
 assert.throws(()=>doc.assertShipmentAccess(viewer,sh,'ABC123','POST'),e=>e.code==='DOCUMENTATION_READ_ONLY'&&e.status===403);
 assert.throws(()=>doc.assertShipmentAccess(stranger,sh,'ABC123','GET'),e=>e.code==='DOCUMENTATION_FORBIDDEN'&&e.status===403);
 assert.throws(()=>doc.assertShipmentAccess(editor,sh,'ZZ9999','POST'),e=>e.code==='SHIPMENT_NOT_FOUND'&&e.status===404);
 assert.throws(()=>doc.assertShipmentAccess(editor,{state:{}},'ABC123','GET'),e=>e.code==='SHIPMENT_NOT_FOUND'&&e.status===404);
});
test('Archivierte Sendungen bleiben fuer die Versanddokumentation erreichbar',()=>{
 const team={state:{archivedShipments:[{reference:'ABC123'}]}};
 const user={role:'Export',rights:{shipment:{read:true,edit:true}}};
 assert.doesNotThrow(()=>doc.assertShipmentAccess(user,team,'ABC123','POST'));
});
test('Kalenderdaten werden auch bei Formalfehlern abgelehnt',()=>{
 assert.throws(()=>doc.normalizeFields({dispatchDate:'2026-02-30'}),e=>e.code==='INVALID_DATE');
 assert.throws(()=>doc.normalizeFields({dispatchDate:'2026-11-32'}),e=>e.code==='INVALID_DATE');
});

test('Fotos und Lieferscheine werden im bestehenden REF-Ordner gesichert und Lieferscheine umbenannt',()=>{
 const image=b64([0xff,0xd8,0xff,0xe0,0x00]);
 const photo=refFiles.documentUploadFile('ABC123',{kind:'sonstiges',fileName:'Versandfoto_Karton.jpg',data:image},new Date('2026-11-06T13:30:00Z'));
 const note=refFiles.documentUploadFile('ABC123',{kind:'lieferschein',fileName:'LS_4711.pdf',data:b64('%PDF-1.7\n')},new Date('2026-11-06T13:30:00Z'));
 assert.equal(photo.name,'Dokument_ABC123_20261106-133000_Versandfoto_Karton.jpg');
 assert.equal(note.name,'Lieferschein_ABC123_20261106-133000_LS_4711.pdf');
});
test('RC1860 ist in Haupt-Build und Sendungsansicht eingebunden',()=>{
 const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
 const ui=fs.readFileSync('assets/rc1860-shipment-documentation.js','utf8');
 const azure=JSON.parse(fs.readFileSync('api/shipment-documentation/function.json','utf8'));
 assert.match(build,/rc1860-shipment-documentation\.js\?v=1860/);
 assert.match(build,/'assets\/rc1860-shipment-documentation\.js'/);
 assert.match(ui,/getElementById\('rc786ReferenceFilesCard'\)/);
 assert.match(ui,/action:'complaint'/);
 assert.match(ui,/action:'save'/);
 assert.match(ui,/runtime\.upload\(ref,prepared,type==='photo'\?'sonstiges':'lieferschein'\)/);
 assert.match(ui,/filenameForProof\(f,type,i\)/);
 assert.match(ui,/if\(!isCurrent\(box,ref\)\)return/);
 assert.match(build,/assets\/i18n\/rc1860-shipment-documentation\.js\?v=1860/);
 assert.equal(azure.bindings[0].type,'httpTrigger');
 assert.deepEqual(azure.bindings[0].methods,['get','post','options']);
});


test('API: Auth-geschuetztes Speichern, erneutes Lesen und Kundenbeschwerde mit Azure-Readback',async t=>{
 const {Readable}=await import('node:stream');
 const {BlobServiceClient}=apiRequire('@azure/storage-blob');
 const auth=require('../api/shared/auth-store.js');
 const previous=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
 const previousIso=process.env.EXPORTHUB_TEST_AUTH_ISOLATION;
 process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
 delete process.env.EXPORTHUB_TEST_AUTH_ISOLATION;
 t.after(()=>{
  if(previous===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
  else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=previous;
  if(previousIso===undefined)delete process.env.EXPORTHUB_TEST_AUTH_ISOLATION;
  else process.env.EXPORTHUB_TEST_AUTH_ISOLATION=previousIso;
 });
 const stored=new Map(),paths=[],user={role:'Export',name:'Lagerteam',rights:{shipment:{level:'edit',read:true,edit:true}}};
 t.mock.method(auth,'validateSession',async()=>({user,session:{environment:'production'},team:{state:{shipments:[{ref:'ABC123'}]}}}));
 t.mock.method(auth,'environmentFromRequest',()=> 'production');
 t.mock.method(auth,'loginStorageEnvironment',()=> 'production');
 t.mock.method(BlobServiceClient,'fromConnectionString',()=>({
  getContainerClient:()=>({
   getBlockBlobClient:(key)=>{
    paths.push(key);
    return{
     async download(){
      const saved=stored.get(key);
      if(!saved){const e=new Error('Missing');e.statusCode=404;throw e}
      return{etag:saved.etag,readableStreamBody:Readable.from([saved.data])};
     },
     async uploadData(bytes,options){
      const current=stored.get(key),conditions=options&&options.conditions||{};
      if((conditions.ifNoneMatch==='*'&&current)||(conditions.ifMatch&&(!current||current.etag!==conditions.ifMatch))){
       const e=new Error('Conflict');e.statusCode=412;throw e;
      }
      const data=Buffer.from(bytes),etag='"etag'+(current?current.rev+1:1)+'"';
      stored.set(key,{data,etag,rev:current?current.rev+1:1});
      return{etag};
     }
    };
   }
  })
 }));
 async function call(method,input){
  const req={method,query:method==='GET'?input:undefined,body:method==='POST'?input:undefined,headers:{}};
  const ctx={};
  await doc(ctx,req);
  return{status:ctx.res.status,data:JSON.parse(ctx.res.body)};
 }
 const first=await call('GET',{reference:'ABC123'});
 assert.equal(first.status,200);
 assert.equal(first.data.record.revision,0);
 const saved=await call('POST',{reference:'ABC123',action:'save',expectedRevision:0,fields:{
  shipmentNumber:'SHP-2026',customer:'Musterkunde',dispatchDate:'2026-11-06',colli:'5',weightKg:'120.5',
  packaging:'Palette',contents:'5 Kartons',loadSecuring:'Stretchfolie'
 }});
 assert.equal(saved.status,200);
 assert.equal(saved.data.record.revision,1);
 assert.equal(saved.data.record.fields.packaging,'Palette');
 const readAgain=await call('GET',{reference:'ABC123'});
 assert.equal(readAgain.data.record.fields.contents,'5 Kartons');
 assert.equal(readAgain.data.record.history[0].changes.customer.after,'Musterkunde');
 const complaint=await call('POST',{reference:'ABC123',action:'complaint',expectedRevision:1,reportedDate:'2026-11-06',text:'Karton beschaedigt'});
 assert.equal(complaint.status,200);
 assert.equal(complaint.data.record.complaints.length,1);
 assert.equal(complaint.data.record.complaints[0].state,'offen');
 const stale=await call('POST',{reference:'ABC123',action:'save',expectedRevision:0,fields:{contents:'Ueberschreiben'}});
 assert.equal(stale.status,409);
 assert.equal((await call('GET',{reference:'ABC123'})).data.record.fields.contents,'5 Kartons');
 assert.deepEqual([...new Set(paths)],['shipment-documentation/ABC123.json']);
});

test('TESTSERVICE kann keine Produktionssendung als eigene Dokumentation freigeben',async t=>{
 const {BlobServiceClient}=apiRequire('@azure/storage-blob');
 const auth=require('../api/shared/auth-store.js');
 const previous=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
 const previousIso=process.env.EXPORTHUB_TEST_AUTH_ISOLATION;
 process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
 delete process.env.EXPORTHUB_TEST_AUTH_ISOLATION;
 t.after(()=>{
  if(previous===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
  else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=previous;
  if(previousIso===undefined)delete process.env.EXPORTHUB_TEST_AUTH_ISOLATION;
  else process.env.EXPORTHUB_TEST_AUTH_ISOLATION=previousIso;
 });
 const user={role:'Export',rights:{shipment:{read:true,edit:true}}};
 t.mock.method(auth,'validateSession',async()=>({user,session:{environment:'testservice'},team:{state:{shipments:[{ref:'ABC123'}]}}}));
 t.mock.method(auth,'environmentFromRequest',()=> 'testservice');
 t.mock.method(auth,'loginStorageEnvironment',()=> 'production');
 t.mock.method(auth,'clientsForEnvironment',async()=>({team:{}}));
 t.mock.method(auth,'readJson',async()=>({value:{state:{shipments:[{ref:'XYZ987'}]}}}));
 let requestedPath='';
 t.mock.method(BlobServiceClient,'fromConnectionString',()=>({
  getContainerClient:()=>({getBlockBlobClient:(path)=>{
   requestedPath=path;
   return{async download(){const e=new Error('Not found');e.statusCode=404;throw e}};
  }})
 }));
 async function get(reference){
  const ctx={};await doc(ctx,{method:'GET',query:{reference},headers:{}});
  return{status:ctx.res.status,data:JSON.parse(ctx.res.body)};
 }
 assert.equal((await get('ABC123')).status,404);
 assert.equal((await get('XYZ987')).status,200);
 assert.equal(requestedPath,'testservice/shipment-documentation/XYZ987.json');
});
