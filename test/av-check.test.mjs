import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const av=require('../api/shared/av-check.js');
const api=require('../api/av-check/index.js');

const NOW=new Date('2026-10-19T08:00:00.000Z');

function shipment(over={}){
  return Object.assign({id:'S1',ref:'ABC123',customer:{name:'BSH Hausgeräte',owner:'Tobias'},abdRequired:true,status:'Abgeholt',pickupStatus:'abgeholt',actualPickupDate:'2026-10-13',pickedUpAt:'2026-10-13T09:00:00.000Z'},over);
}
function state(...shipments){return{shipments,tasks:[]}}
function avTasks(s){return s.tasks.filter(av.isAvTask)}
function handler(s,files,extra={}){
  let saved=null;
  const h=api.createHandler(Object.assign({
    authorize:async()=>true,graphConfigured:()=>true,now:()=>NOW,
    readState:async()=>JSON.parse(JSON.stringify(s)),
    mutateState:async(env,mutator)=>{const r=mutator(s);saved=s;return r},
    listFiles:async ref=>{if(files[ref] instanceof Error)throw files[ref];return files[ref]||[]}
  },extra));
  return{run:payload=>h({method:'POST',headers:{},body:Object.assign({environment:'testservice',minAgeMinutes:0},payload||{})}),saved:()=>saved};
}

test('AV-Dateiname: Anfang "AV" ohne Rücksicht auf Groß-/Kleinschreibung',()=>{
  for(const n of ['AV_ABC123.pdf','av 123.pdf','Av-Ausgangsvermerk.PDF','AVABC123.pdf'])assert.equal(av.isAvFileName(n),true,n);
  for(const n of ['ABD_ABC123.pdf','Rechnung AV.pdf','CMR.pdf',''])assert.equal(av.isAvFileName(n),false,n);
});

test('Fälligkeit: 5 Kalendertage nach Abholung',()=>{
  assert.equal(av.dueDay('2026-10-14'),'2026-10-19');
  assert.equal(av.dueDay('2026-10-30'),'2026-11-04');
});

test('Kandidaten: nur vollständig abgeholte ABD-Sendungen ab Tag 5',()=>{
  const s=state(
    shipment(),
    shipment({id:'S2',ref:'NOTDUE',actualPickupDate:'2026-10-15',pickedUpAt:'2026-10-15T09:00:00Z'}),
    shipment({id:'S3',ref:'NOABD1',abdRequired:false}),
    shipment({id:'S4',ref:'PARTIA',status:'Teilweise abgeholt',pickupStatus:'teilweise abgeholt',pickupPartial:true,actualPickupDate:'',pickedUpAt:''}),
    shipment({id:'S5',ref:'OPEN01',status:'Bereit',pickupStatus:'',actualPickupDate:'',pickedUpAt:''}),
    shipment({id:'S6',ref:'HASAV1',avPresent:true}),
    shipment({id:'S7',ref:'OLD001',actualPickupDate:'2025-01-02',pickedUpAt:'2025-01-02T09:00:00Z'}),
    shipment({id:'S8',ref:'ABDFIL',abdRequired:undefined,abdFiles:[{id:'f1',name:'ABD.pdf'}]})
  );
  assert.deepEqual(av.candidates(s,NOW).map(c=>c.reference).sort(),['ABC123','ABDFIL']);
});

test('fehlendes AV erzeugt genau eine Aufgabe pro REF',async()=>{
  const s=state(shipment()),h=handler(s,{ABC123:[{name:'ABD_ABC123.pdf'},{name:'CMR.pdf'}]});
  const first=await h.run();
  assert.equal(first.status,200);
  assert.equal(first.body.createdTasks,1);
  const tasks=avTasks(s);
  assert.equal(tasks.length,1);
  assert.equal(tasks[0].title,'Ausgangsvermerk nicht vorhanden · ABC123 · BSH Hausgeräte');
  assert.equal(tasks[0].status,'offen');
  assert.equal(tasks[0].linkedShipmentRef,'ABC123');
  assert.equal(tasks[0].linkedShipmentId,'S1');
  assert.match(tasks[0].note,/ABD/,'Aufgabe soll in der Gruppe "Offene ABDs" landen');
  const second=await h.run();
  assert.equal(second.body.createdTasks,0);
  assert.equal(avTasks(s).length,1);
});

test('vorhandenes AV schließt die Aufgabe automatisch und beendet die Prüfung',async()=>{
  const s=state(shipment()),files={ABC123:[]},h=handler(s,files);
  await h.run();
  assert.equal(avTasks(s)[0].status,'offen');
  files.ABC123=[{name:'av_ABC123.pdf'}];
  const r=await h.run();
  assert.equal(r.body.closedTasks,1);
  const t=avTasks(s)[0];
  assert.equal(t.status,'erledigt');
  assert.equal(t.done,true);
  assert.equal(t.autoCompletedByAvCheck,true);
  assert.equal(s.shipments[0].avPresent,true);
  assert.equal(s.shipments[0].avDocumentName,'av_ABC123.pdf');
  assert.deepEqual(av.candidates(s,NOW),[]);
});

test('AV schon vor Fälligkeit vorhanden: keine Aufgabe',async()=>{
  const s=state(shipment()),h=handler(s,{ABC123:[{name:'AV ABC123.pdf'}]});
  const r=await h.run();
  assert.equal(r.body.present,1);
  assert.equal(avTasks(s).length,0);
});

test('Ordner nicht lesbar: keine Aufgabe, Fehler wird gemeldet',async()=>{
  const s=state(shipment()),h=handler(s,{ABC123:Object.assign(new Error('x'),{code:'GRAPH_REFERENCE_FOLDER_LIST_FAILED'})});
  const r=await h.run();
  assert.equal(r.body.ok,false);
  assert.equal(r.body.errorCount,1);
  assert.equal(avTasks(s).length,0);
});

test('ohne Graph-Konfiguration werden keine Aufgaben angelegt',async()=>{
  const s=state(shipment()),h=handler(s,{},{graphConfigured:()=>false});
  const r=await h.run();
  assert.equal(r.body.graphConfigured,false);
  assert.equal(avTasks(s).length,0);
});

test('nur der signierte Workflow darf prüfen',async()=>{
  const h=handler(state(shipment()),{},{authorize:async()=>false});
  const r=await h.run();
  assert.equal(r.status,403);
});

test('Batches arbeiten reihum: zuletzt geprüfte REFs kommen zuletzt',async()=>{
  const s=state(shipment(),shipment({id:'S2',ref:'XYZ789'}));
  const h=handler(s,{});
  const first=await h.run({limit:1,minAgeMinutes:60});
  assert.equal(first.body.checked,1);
  assert.equal(first.body.remaining,1);
  const second=await h.run({limit:1,minAgeMinutes:60});
  assert.equal(second.body.checked,1);
  assert.equal(second.body.remaining,0);
  assert.equal(avTasks(s).length,2);
});

test('Workflow ruft /api/av-check mit eigener OIDC-Audience auf',()=>{
  const wf=fs.readFileSync('.github/workflows/av-check.yml','utf8'),src=fs.readFileSync('api/av-check/index.js','utf8');
  assert.match(wf,/audience=exporthub-av-check/);
  assert.match(wf,/\/api\/av-check/);
  assert.match(src,/OIDC_AUDIENCE = 'exporthub-av-check'/);
  assert.match(src,/WORKFLOW = 'av-check\.yml'/);
});

const refFiles=require('../api/reference-files/index.js');
const PDF=Buffer.from('%PDF-1.7\n%test\n').toString('base64');

test('AV-Upload: Dateiname bekommt AV-Präfix, damit die Prüfung ihn erkennt',()=>{
  const plain=refFiles.avUploadFile('ABC123',{fileName:'Ausgangsvermerk.pdf',data:PDF});
  assert.equal(plain.name,'AV_ABC123_Ausgangsvermerk.pdf');
  assert.equal(plain.mimeType,'application/pdf');
  assert.equal(av.isAvFileName(plain.name),true);
  assert.equal(refFiles.avUploadFile('ABC123',{fileName:'av 4711.pdf',data:'data:application/pdf;base64,'+PDF}).name,'av 4711.pdf');
});

test('AV-Upload: nur echte PDF/JPG/PNG',()=>{
  assert.throws(()=>refFiles.avUploadFile('ABC123',{fileName:'AV.exe',data:PDF}),/PDF, JPG oder PNG/);
  assert.throws(()=>refFiles.avUploadFile('ABC123',{fileName:'AV.pdf',data:Buffer.from('nope').toString('base64')}),/Dateityp/);
  assert.throws(()=>refFiles.avUploadFile('ABC123',{fileName:'AV.pdf',data:''}),/leer/);
});

test('AV-Upload ist in den Build und die Sendungsansicht eingebunden',()=>{
  const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8'),asset=fs.readFileSync('assets/av-upload.js','utf8');
  assert.match(build,/assets\/i18n\/av-upload\.js\?v=1/);
  assert.match(build,/assets\/av-upload\.js\?v=1/);
  assert.match(asset,/#rc786ReferenceFilesCard \.rc786-doc-head-actions/);
  assert.match(asset,/action:'upload-av'/);
  const i18n=fs.readFileSync('assets/i18n/av-upload.js','utf8');
  for(const l of ['de','en','pl','es','fr','it'])assert.match(i18n,new RegExp('\\n '+l+':\\{idle:'));
});

test('Workflow überspringt Umgebungen, in denen /api/av-check noch fehlt',()=>{
  const wf=fs.readFileSync('.github/workflows/av-check.yml','utf8');
  assert.match(wf,/if \[ "\$http_code" = "404" \]; then[\s\S]{0,300}exit 0/);
});
