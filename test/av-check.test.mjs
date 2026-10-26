import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const av=require('../api/shared/av-check.js');
const api=require('../api/av-check/index.js');

const NOW=new Date('2026-10-19T08:00:00.000Z');

function shipment(over={}){
  return Object.assign({id:'S1',ref:'ABC123',customer:{name:'BSH Hausgeräte',owner:'Tobias'},abdRequired:true,abdFiles:[{id:'abd1',name:'ABD_ABC123.pdf'}],status:'Abgeholt',pickupStatus:'abgeholt',actualPickupDate:'2026-10-13',pickedUpAt:'2026-10-13T09:00:00.000Z'},over);
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
  for(const n of ['ABD_ABC123.pdf','Rechnung AV.pdf','AVIS_ABC123.pdf','Avis123.pdf','CMR.pdf',''])assert.equal(av.isAvFileName(n),false,n);
});

test('RC1666: AV ab erstellt vorhandenem ABD sofort fällig, ohne Abhol-Wartefrist',()=>{
  assert.equal(av.AV_DUE_DAYS,0);
  assert.equal(av.dueDay('2026-10-14'),'2026-10-14');
  assert.equal(av.dueDay('2026-10-30'),'2026-10-30');
});

test('RC1666: Kandidaten enthalten alle historischen und offenen Sendungen mit realem ABD',()=>{
  const s=state(
    shipment(),
    shipment({id:'S2',ref:'NOTDUE',actualPickupDate:'2026-10-15'}),
    shipment({id:'S3',ref:'NOABD1',abdRequired:true,abdFiles:[]}),
    shipment({id:'S4',ref:'PARTIA',status:'Teilweise abgeholt',pickupPartial:true,actualPickupDate:''}),
    shipment({id:'S5',ref:'OPEN01',status:'Bereit',actualPickupDate:''}),
    shipment({id:'S6',ref:'HASAV1',avPresent:true}),
    shipment({id:'S7',ref:'OLD001',actualPickupDate:'2025-01-02'}),
    shipment({id:'S8',ref:'ABDFIL',abdRequired:undefined,abdFiles:[{name:'ABD.pdf'}]})
  );
  s.savedShipments=[shipment({id:'S9',ref:'SAVED1',actualPickupDate:''})];
  s.archivedShipments=[shipment({id:'S10',ref:'ARCH01',actualPickupDate:'2022-01-01'})];
  s.sharedShipments=[shipment({id:'S11',ref:'SAVED1',actualPickupDate:''})]; // kein doppelter REF
  assert.deepEqual(av.candidates(s,NOW).map(c=>c.reference).sort(),
    ['ABC123','NOTDUE','PARTIA','OPEN01','HASAV1','OLD001','ABDFIL','SAVED1','ARCH01'].sort());
  assert.equal(av.candidates(s,NOW).some(c=>c.reference==='NOABD1'),false,'ABD-Pflicht allein ist kein erstelltes ABD');
  assert.equal(av.AV_LOOKBACK_DAYS,0,'historische Sendungen dürfen nicht abgeschnitten werden');
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
  assert.deepEqual(av.candidates(s,NOW).map(c=>c.reference),['ABC123'],'vorhandene AVs werden bei Folgeläufen erneut geprüft');
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
  assert.equal(r.status,503,'Graph-Ausfall darf nicht als erfolgreicher Check erscheinen');
  assert.equal(r.body.ok,false);
  assert.equal(r.body.code,'GRAPH_NOT_CONFIGURED');
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

test('RC1666: mehrere ABD erfordern entsprechend mehrere AVs, aber eine Aufgabe je REF',async()=>{
  const sh=shipment({abdFiles:[{name:'ABD-1.pdf'},{name:'ABD-2.pdf'}]});
  const s=state(sh),files={ABC123:[{name:'AV_1.pdf'}]},h=handler(s,files);
  const first=await h.run();
  assert.equal(first.status,200);
  assert.equal(first.body.createdTasks,1);
  assert.equal(s.tasks[0].avRequiredCount,2);
  assert.equal(s.tasks[0].avFoundCount,1);
  assert.equal(s.tasks[0].avMissingCount,1);
  await h.run();
  assert.equal(avTasks(s).length,1,'erneuter Check darf keine doppelte Aufgabe erzeugen');
  files.ABC123.push({name:'AV_2.pdf'});
  const resolved=await h.run();
  assert.equal(resolved.body.closedTasks,1);
  assert.equal(s.tasks[0].status,'erledigt');
  files.ABC123.pop();
  const reopened=await h.run();
  assert.equal(reopened.body.createdTasks,0,'erneutes Öffnen ist keine neue Aufgabe');
  assert.equal(reopened.body.reopenedTasks,1,'eine entfernte AV-Datei muss die bestehende Aufgabe wieder öffnen');
  assert.equal(avTasks(s).length,1);
  assert.equal(s.tasks[0].status,'offen');
});

test('RC1666: Rückwirkende Sendung aus savedShipments erhält Aufgabe samt stabiler REF',async()=>{
  const s={shipments:[],savedShipments:[shipment({id:'S-ARCH',ref:'HIST01',actualPickupDate:''})],tasks:[]};
  const h=handler(s,{HIST01:[]});
  const r=await h.run();
  assert.equal(r.status,200);
  assert.equal(r.body.createdTasks,1);
  assert.equal(s.tasks[0].linkedShipmentRef,'HIST01');
  assert.equal(s.tasks[0].linkedShipmentId,'S-ARCH');
  assert.equal(s.savedShipments[0].avPresent,false);
});

test('RC1666: auch erstelltes ABD in verknüpfter Anfrage löst eine AV-Aufgabe aus',async()=>{
  const sh=shipment({abdFiles:[],abdRequired:false,actualPickupDate:''});
  const s=state(sh);s.abdRequests=[{id:'ABD-REQ-1',linkedShipmentId:'S1',reference:'ABC123',abdFiles:[{name:'ABD-REQ-1.pdf'}]}];
  assert.equal(av.shipmentHasAbd(s,sh),true);
  const r=await handler(s,{ABC123:[]}).run();
  assert.equal(r.body.createdTasks,1);
});

test('RC1666: recycelte technische ID darf ABD einer anderen REF nicht zuordnen',()=>{
  const sh=shipment({ref:'RIGHT1',id:'REUSED',abdFiles:[],abdRequired:false});
  const s=state(sh);
  s.abdRequests=[{id:'REQ-1',linkedShipmentId:'REUSED',reference:'WRONG1',abdFiles:[{name:'ABD.pdf'}]}];
  assert.equal(av.shipmentHasAbd(s,sh),false);
  assert.deepEqual(av.candidates(s,NOW),[]);
  s.abdRequests.push({id:'REQ-2',linkedShipmentId:'OLD-ID',reference:'RIGHT1',abdFiles:[{name:'ABD.pdf'}]});
  assert.equal(av.shipmentHasAbd(s,sh),true,'REF-Zuordnung ist stärker als recycelte ID');
});

test('RC1666: Lieferavis im REF-Ordner schließt die AV-Aufgabe nicht',async()=>{
  const s=state(shipment());
  const r=await handler(s,{ABC123:[{name:'AVIS_ABC123.pdf'},{name:'ABD_ABC123.pdf'}]}).run();
  assert.equal(r.body.missing,1);
  assert.equal(r.body.createdTasks,1);
  assert.equal(s.tasks[0].status,'offen');
});

test('RC1666: defekter oder zukünftiger AV-Prüfzeitstempel verhindert nicht den historischen Backfill',async()=>{
  for(const stamp of ['kaputtes-datum','2099-01-01T00:00:00.000Z']){
    const s=state(shipment({avCheckedAt:stamp}));
    const r=await handler(s,{ABC123:[]}).run({minAgeMinutes:60});
    assert.equal(r.body.checked,1,stamp);
    assert.equal(r.body.createdTasks,1,stamp);
  }
});

test('RC1666: mehrere ABD-Dateien über aktive und archivierte REF-Kopien erfordern mehrere AVs',async()=>{
  const s=state(shipment({abdFiles:[{name:'ABD_1.pdf'}]}));
  s.archivedShipments=[shipment({id:'S-OLD',ref:'ABC123',abdFiles:[{name:'ABD_2.pdf'}]})];
  assert.equal(av.candidates(s,NOW).length,1,'nur ein Kandidat pro REF');
  assert.equal(av.requiredAvCount(s,s.shipments[0]),2,'ABD-Evidenz muss über alle Kopien vereinigt werden');
  const files={ABC123:[{name:'AV_1.pdf'}]},h=handler(s,files);
  const first=await h.run();
  assert.equal(first.body.createdTasks,1);
  assert.equal(s.tasks[0].avRequiredCount,2);
  assert.equal(s.tasks[0].avMissingCount,1);
  files.ABC123.push({name:'AV_2.pdf'});
  const complete=await h.run();
  assert.equal(complete.body.closedTasks,1);
  assert.equal(s.shipments[0].avPresent,true);
  assert.equal(s.archivedShipments[0].avPresent,true);
});

test('RC1666: dieselbe ABD-Datei in mehreren REF-Kopien darf nicht doppelt gezählt werden',async()=>{
  const s=state(shipment({abdFiles:[{id:'FILE1',name:'ABD_1.pdf'}]}));
  s.savedShipments=[shipment({id:'S-COPY',ref:'ABC123',abdFiles:[{id:'FILE2',name:'ABD_1.pdf'}]})];
  assert.equal(av.requiredAvCount(s,s.shipments[0]),1);
  const r=await handler(s,{ABC123:[{name:'AV_1.pdf'}]}).run();
  assert.equal(r.body.present,1);
  assert.equal(avTasks(s).length,0);
});

test('RC1666: historischer Backfill baut den REF-Index nicht pro Sendung neu',()=>{
  const list=Array.from({length:40},(_,i)=>shipment({
    id:'IDX-'+i,ref:'B'+String(i).padStart(5,'0'),abdFiles:[{name:'ABD_'+i+'.pdf'}]
  }));
  let reads=0;
  const s={tasks:[],get shipments(){reads++;return list}};
  const selected=av.candidates(s,NOW);
  assert.equal(selected.length,40);
  assert.equal(reads,1,'der komplette Sendungsbestand darf nur einmal indexiert werden');
  assert.equal(selected[0].requiredAvCount,1);
  assert.equal(selected[39].requiredAvCount,1);
});

test('RC1666: Ergebnisprüfung verwendet dieselben REF-Kopien ohne erneute Vollindizierung',()=>{
  const list=[shipment({abdFiles:[{name:'ABD_A.pdf'}]})];
  let reads=0;
  const s={tasks:[],get shipments(){reads++;return list}};
  const result=av.applyResult(s,'ABC123',{avFiles:[{name:'AV_A.pdf'}]},NOW);
  assert.equal(result.status,'present');
  assert.equal(reads,1,'die AV-Statusänderung indexiert den Bestand nur einmal');
});

test('RC1666: historische archive-Collection und shipmentRef werden auf fehlendes AV geprüft',async()=>{
  const old=shipment({id:'LEGACY-1',ref:undefined,reference:undefined,shipmentRef:'OLD777',actualPickupDate:'2022-01-01'});
  const s={shipments:[],archive:[old],tasks:[]};
  assert.deepEqual(av.candidates(s,NOW).map(x=>x.reference),['OLD777']);
  const result=await handler(s,{OLD777:[]}).run();
  assert.equal(result.body.createdTasks,1);
  assert.equal(s.tasks[0].linkedShipmentRef,'OLD777');
  assert.equal(s.archive[0].avPresent,false);
});

test('RC1666: gültige historische REF gewinnt gegen nichtkanonische Referenzangaben',async()=>{
  const old=shipment({id:'LEGACY-2',ref:'INVALID-REF',referenceNumber:'HIS123',abdFiles:[{name:'ABD_HIS123.pdf'}]});
  const s={archive:[old],tasks:[]};
  assert.deepEqual(av.candidates(s,NOW).map(x=>x.reference),['HIS123']);
  const result=await handler(s,{HIS123:[{name:'AV_HIS123.pdf'}]}).run();
  assert.equal(result.body.present,1);
  assert.equal(s.archive[0].avPresent,true);
});

test('RC1666: fehlerhafte REF-Dateiliste erzeugt keine falsche AV-Aufgabe',async()=>{
  const s=state(shipment());
  const r=await handler(s,{ABC123:{value:[{name:'AV_ABC123.pdf'}]}}).run();
  assert.equal(r.body.ok,false);
  assert.equal(r.body.errorCount,1);
  assert.equal(r.body.errors[0].code,'GRAPH_REFERENCE_FOLDER_LIST_INVALID');
  assert.equal(avTasks(s).length,0);
});

function graphFolderListingFixture(kind){
  // Run with an isolated process: mock Graph token/file responses without
  // leaking the fake global fetch or credentials into concurrent test suites.
  const script = [
    "const folder=require('./api/shared/reference-folder-upload.js');",
    "const mode=process.argv[1];let pages=0;",
    "global.fetch=async url=>{",
    " if(String(url).includes('login.microsoftonline.com'))return {ok:true,json:async()=>({access_token:'fixture',expires_in:3600})};",
    " pages++;",
    " if(mode==='invalid')return {ok:true,json:async()=>({unexpected:true})};",
    " if(mode==='nested'||mode==='nestedError'){",
    "  const child=String(url).includes('/drive/items/');",
    "  const data=child?(mode==='nestedError'?{broken:true}:{value:[{id:'nestedAV',name:'AV_ABC123.pdf',file:{mimeType:'application/pdf'}}]}):{value:[{id:'rootABD',name:'ABD_ABC123.pdf',file:{}},{id:'sub',name:'Dokumente',folder:{}}]};",
    "  return {ok:true,json:async()=>data};",
    " }",
    " const pageCount=mode==='truncated'?7:6;",
    " const data={value:[{id:'file'+pages,name:'AV_'+pages+'.pdf',file:{mimeType:'application/pdf'}}]};",
    " if(pages<pageCount)data['@odata.nextLink']='https://graph.microsoft.com/v1.0/next?page='+pages;",
    " return {ok:true,json:async()=>data};",
    "};",
    "folder.listFiles('ABC123').then(files=>console.log(JSON.stringify({ok:true,count:files.length,...(mode==='nested'?{names:files.map(x=>x.name)}:{})}))).catch(e=>console.log(JSON.stringify({ok:false,code:e.code})));"
  ].join('\n');
  const res=spawnSync(process.execPath,['-e',script,kind],{
    cwd:process.cwd(),encoding:'utf8',
    env:{...process.env,EXPORTHUB_GRAPH_TENANT_ID:'fixture',EXPORTHUB_GRAPH_CLIENT_ID:'fixture',EXPORTHUB_GRAPH_CLIENT_SECRET:'fixture'}
  });
  assert.equal(res.status,0,res.stderr);
  return JSON.parse(res.stdout.trim());
}

test('RC1666: Graph REF-Dateiliste mit ungültiger Antwort darf keine AV-Entscheidung erzeugen',()=>{
  assert.deepEqual(graphFolderListingFixture('invalid'),{ok:false,code:'GRAPH_REFERENCE_FOLDER_LIST_INVALID'});
});

test('RC1666: mehr als sechs Graph-Dateiseiten dürfen nicht stillschweigend abgeschnitten werden',()=>{
  assert.deepEqual(graphFolderListingFixture('truncated'),{ok:false,code:'GRAPH_REFERENCE_FOLDER_LIST_TRUNCATED'});
});

test('RC1666: vollständige Graph-Dateiliste über sechs Seiten wird korrekt gelesen',()=>{
  assert.deepEqual(graphFolderListingFixture('complete'),{ok:true,count:6});
});

test('RC1666: AV in einem REF-Unterordner wird trotz ABD im Hauptordner gefunden',()=>{
  assert.deepEqual(graphFolderListingFixture('nested'),{
    ok:true,count:2,names:['ABD_ABC123.pdf','AV_ABC123.pdf']
  });
});

test('RC1666: ungültige Graph-Antwort aus einem Unterordner darf keinen AV-Fehlalarm erzeugen',()=>{
  assert.deepEqual(graphFolderListingFixture('nestedError'),{
    ok:false,code:'GRAPH_REFERENCE_FOLDER_LIST_INVALID'
  });
});
