import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {mergeShipmentProtected,mergeCollection}=require('../api/shared/merge.js');

const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const first=builder.indexOf('function patchRc1617AbdUploadFailureFeedback(');
const last=builder.indexOf('function patchRc1602OfficialPod(',first);
assert.ok(first>=0 && last>first,'RC1617 and RC1619 builders must be present');
const patchers=vm.runInNewContext(builder.slice(first,last)+'\n({first:patchRc1617AbdUploadFailureFeedback,second:patchRc1619AbdFailClosedRollback})');
function built(){
 const source=fs.readFileSync('index.html','utf8');
 return patchers.second(patchers.first(source,'index.html'),'index.html');
}
function compileSnapshot(){
 const html=built();
 const start=html.indexOf('function rc1619CaptureAbdState(sh,fileId){');
 const end=html.indexOf('function overrideUploads(){',start);
 assert.ok(start>0 && end>start,'RC1619 fail-closed helper is built before central uploader');
 const code=html.slice(start,end);
 const s={shipments:[],savedShipments:[],abdRequests:[]};
 const context={
   S:()=>s,
   shipmentId:x=>String(x&&x.id||''),
   shipmentRef:x=>String(x&&x.ref||''),
   L:x=>String(x||'').toLowerCase(),
   Q:x=>String(x==null?'':x).trim(),
   abdRequestsForShipment:()=>s.abdRequests,
   recalculateShipmentStatus:x=>{x.status=x.abdDone===true?'Bereit':'Wartet auf ABD'}
 };
 vm.runInNewContext(code,context);
 return {s,save:context.rc1619CaptureAbdState,html};
}
test('RC1619: Azure failure rolls back both shipment and ABD request to previous gate state',()=>{
 const {s,save,html}=compileSnapshot();
 const oldFile={id:'ABD-OLD',name:'old.pdf',status:'active'};
 const shipment={id:'SHIP-9Z7L82',ref:'9Z7L82',abdRequired:true,abdDone:false,abdStatus:'Wartet auf ABD',status:'Wartet auf ABD',abdFiles:[oldFile],updatedAt:'before'};
 const request={id:'REQ-9Z7L82',ref:'9Z7L82',status:'Angefragt',done:false,abdFiles:[],updatedAt:'before'};
 s.shipments.push(shipment);s.abdRequests.push(request);
 const undo=save(shipment,'ABD-NEW');
 shipment.abdStatus='Abgeschlossen';shipment.abdDone=true;shipment.abdCompleted=true;
 shipment.abdFiles[0].status='replaced';shipment.abdFiles.push({id:'ABD-NEW',status:'active'});
 shipment.documentHistory=[{id:'ABD-OLD',status:'replaced'}];
 shipment.status='Bereit';shipment.updatedAt='after';
 request.abdFiles.push({id:'ABD-NEW',status:'active'});request.done=true;request.status='Abgeschlossen';request.updatedAt='after';
 undo();
 assert.equal(shipment.abdStatus,'Wartet auf ABD');
 assert.equal(shipment.abdDone,false);
 assert.equal(shipment.abdCompleted,undefined);
 assert.equal(shipment.status,'Wartet auf ABD');
 assert.equal(shipment.abdFiles.length,1);
 assert.equal(shipment.abdFiles[0].status,'active');
 assert.equal(shipment.documentHistory,undefined);
 assert.equal(shipment.updatedAt,'before');
 assert.equal(request.status,'Angefragt');
 assert.equal(request.done,false);
 assert.equal(request.abdFiles.length,0);
 assert.equal(request.updatedAt,'before');
 const code=html.slice(html.indexOf('window.rc524UploadFile=function'),html.indexOf('window.rc524DeleteFile='));
 assert.match(code,/abdRollback=rc1619CaptureAbdState\(sh,item.id\);applyAbdDocumentDurably\(sh,item\)/);
 assert.match(code,/if\(!ok\)\{if\(kind==='abd'\)\{if\(abdRollback\)\{abdRollback\(\);abdRollback=null\}/);
 assert.match(code,/\.catch\(function\(e\)\{if\(key==='abdFiles'\)\{if\(abdRollback\)\{abdRollback\(\);abdRollback=null\}/);
});
test('RC1619: rollback preserves already confirmed old ABD when replacement upload fails',()=>{
 const {s,save}=compileSnapshot();
 const sh={id:'SHIP-9Z7L82',ref:'9Z7L82',abdRequired:true,abdDone:true,abdStatus:'Abgeschlossen',abdFiles:[{id:'ABD-OLD',status:'active'}]};
 s.shipments.push(sh);
 const undo=save(sh,'ABD-NEW');
 sh.abdFiles[0].status='replaced';sh.abdFiles.push({id:'ABD-NEW',status:'active'});
 undo();
 assert.equal(sh.abdDone,true);
 assert.equal(sh.abdStatus,'Abgeschlossen');
 assert.deepEqual(Array.from(sh.abdFiles, f=>f.id),['ABD-OLD']);
 assert.equal(sh.abdFiles[0].status,'active');
});
test('RC1619: saved-only copy untouched by upload is not overwritten on rollback',()=>{
 const {s,save}=compileSnapshot();
 const live={id:'SHIP-9Z7L82',ref:'9Z7L82',abdDone:false,abdStatus:'Wartet auf ABD',abdFiles:[]};
 const saved={id:'SHIP-9Z7L82',ref:'9Z7L82',abdDone:false,abdStatus:'Wartet auf ABD',abdFiles:[]};
 s.shipments.push(live);s.savedShipments.push(saved);
 const undo=save(live,'ABD-NEW');
 live.abdDone=true;live.abdStatus='Abgeschlossen';live.abdFiles.push({id:'ABD-NEW'});
 saved.updatedAt='concurrent-change';
 undo();
 assert.equal(live.abdDone,false);
 assert.equal(live.abdStatus,'Wartet auf ABD');
 assert.equal(saved.updatedAt,'concurrent-change');
});
test('RC1619: patcher rejects changed anchors instead of silently releasing an unsafe uploader',()=>{
 const fixture='window.rc524UploadFile=function(input,key){return false;} window.rc524DeleteFile=';
 assert.throws(()=>patchers.second(fixture,'index.html'),/RC1619 Upload-Anker/);
});

test('RC1620: rollback restores ABD request completion even if it never received the new PDF ID',()=>{
 const {s,save}=compileSnapshot();
 const shipment={id:'SHIP-9Z7L82',ref:'9Z7L82',status:'Wartet auf ABD',abdDone:false,abdStatus:'Wartet auf ABD',abdFiles:[]};
 const request={id:'REQ-9Z7L82',ref:'9Z7L82',status:'Angefragt',abdStatus:'Offen',done:false,abdDone:false,abdFiles:[{id:'OLD-ABD'}],updatedAt:'before'};
 s.shipments.push(shipment);
 s.abdRequests.push(request);
 const undo=save(shipment,'NEW-ABD');
 shipment.abdFiles.push({id:'NEW-ABD'});
 shipment.abdDone=true;shipment.abdStatus='Abgeschlossen';shipment.status='Bereit zur Abholung';
 // Actual ABD request completion can be status-only, with no matching new file.
 request.done=true;request.abdDone=true;request.status='Abgeschlossen';request.abdStatus='Abgeschlossen';request.completedAt='2026-10-22T10:00:00Z';request.updatedAt='after';
 undo();
 assert.equal(shipment.status,'Wartet auf ABD');
 assert.equal(shipment.abdDone,false);
 assert.equal(shipment.abdFiles.length,0);
 assert.equal(request.done,false);
 assert.equal(request.abdDone,false);
 assert.equal(request.status,'Angefragt');
 assert.equal(request.abdStatus,'Offen');
 assert.equal(request.completedAt,undefined);
 assert.equal(request.updatedAt,'before');
 assert.deepEqual(Array.from(request.abdFiles,x=>x.id),['OLD-ABD']);
});

test('RC1620: unrelated ABD request metadata and other shipments survive failed upload',()=>{
 const {s,save}=compileSnapshot();
 const shipments=['9Z7L82','AB1234','CD5678','EF9012'].map(ref=>({
  id:'SHIP-'+ref,ref,abdDone:false,abdStatus:'Wartet auf ABD',status:'Wartet auf ABD',abdFiles:[]
 }));
 const requests=shipments.map(sh=>({id:'REQ-'+sh.ref,ref:sh.ref,done:false,status:'Angefragt',abdFiles:[],updatedAt:'before'}));
 s.shipments.push(...shipments);s.abdRequests.push(...requests);
 const undo=save(shipments[0],'NEW-ABD');
 shipments[0].abdFiles.push({id:'NEW-ABD'});shipments[0].abdDone=true;shipments[0].status='Bereit';
 requests[0].done=true;requests[0].status='Abgeschlossen';
 requests[1].updatedAt='independent-save';
 undo();
 assert.equal(requests[0].done,false);
 assert.equal(requests[0].status,'Angefragt');
 assert.equal(requests[1].updatedAt,'independent-save');
 assert.equal(shipments[0].status,'Wartet auf ABD');
 for(let i=1;i<4;i++){
  assert.equal(shipments[i].status,'Wartet auf ABD');
  assert.equal(shipments[i].abdFiles.length,0);
  assert.equal(requests[i].done,false);
 }
});

test('RC1620: concurrent Azure save keeps both old and new ABD documents',()=>{
 const old={id:'ABD-OLD',name:'Old ABD.pdf',storage:'blob',blobName:'rc1059/production/aa/'+('a'.repeat(64)),sha256:'a'.repeat(64)};
 const added={id:'ABD-NEW',name:'New ABD.pdf',storage:'blob',blobName:'rc1059/production/bb/'+('b'.repeat(64)),sha256:'b'.repeat(64)};
 const server={id:'SHIP-9Z7L82',ref:'9Z7L82',updatedAt:'2026-10-22T11:05:00Z',status:'Wartet auf ABD',abdFiles:[old]};
 const client={id:'SHIP-9Z7L82',ref:'9Z7L82',updatedAt:'2026-10-22T11:04:00Z',status:'Wartet auf ABD',abdFiles:[old,added]};
 const merged=mergeShipmentProtected(server,client);
 assert.deepEqual(merged.abdFiles.map(x=>x.id),['ABD-OLD','ABD-NEW']);
 assert.deepEqual(merged.abdFiles.map(x=>x.blobName),[old.blobName,added.blobName]);
 assert.equal(merged.status,'Wartet auf ABD','no false customs release based on only document metadata');
});

test('RC1620: a newer stale client must not erase older valid ABD documents',()=>{
 const server={id:'SHIP-9Z7L82',ref:'9Z7L82',updatedAt:'2026-10-22T10:00:00Z',
  abdFiles:[{id:'ABD-OLD',storage:'blob',blobName:'rc1059/production/aa/old'},{id:'ABD-SECOND',storage:'blob',blobName:'rc1059/production/bb/second'}]};
 const client={...server,updatedAt:'2026-10-22T10:30:00Z',abdFiles:[{id:'ABD-SECOND',storage:'blob',blobName:'rc1059/production/bb/second'}]};
 const merged=mergeShipmentProtected(server,client);
 assert.deepEqual(merged.abdFiles.map(x=>x.id),['ABD-OLD','ABD-SECOND']);
});

test('RC1620: duplicate ABD ID does not lose its verified Azure document reference',()=>{
 const server={id:'SHIP-9Z7L82',ref:'9Z7L82',updatedAt:'2026-10-22T10:00:00Z',
  abdFiles:[{id:'ABD-OLD',name:'old.pdf',storage:'blob',blobName:'rc1059/production/aa/valid',sha256:'a'.repeat(64)}]};
 const client={id:'SHIP-9Z7L82',ref:'9Z7L82',updatedAt:'2026-10-22T10:30:00Z',
  abdFiles:[{id:'ABD-OLD',name:'old.pdf',data:'data:application/pdf;base64,JVBERi0xLjQ=',status:'active'}]};
 const merged=mergeShipmentProtected(server,client);
 assert.equal(merged.abdFiles.length,1);
 assert.equal(merged.abdFiles[0].storage,'blob');
 assert.equal(merged.abdFiles[0].blobName,'rc1059/production/aa/valid');
 assert.equal(Object.hasOwn(merged.abdFiles[0],'data'),false);
 assert.equal(merged.abdFiles[0].status,'active');
});

test('RC1621: concurrent ABD request saves retain confirmed old and new PDFs',()=>{
 const old={id:'ABD-OLD',name:'older.pdf',storage:'blob',blobName:'rc1059/production/aa/'+('a'.repeat(64))};
 const newer={id:'ABD-NEW',name:'newer.pdf',storage:'blob',blobName:'rc1059/production/bb/'+('b'.repeat(64))};
 const server=[{id:'REQ-9Z7L82',ref:'9Z7L82',updatedAt:'2026-10-22T11:20:00Z',
  status:'Angefragt',done:false,abdFiles:[old]}];
 const client=[{id:'REQ-9Z7L82',ref:'9Z7L82',updatedAt:'2026-10-22T11:19:00Z',
  status:'Abgeschlossen',done:true,abdFiles:[old,newer]}];
 const result=mergeCollection('abdRequests',server,client,new Map());
 assert.equal(result.length,1);
 assert.deepEqual(result[0].abdFiles.map(f=>f.id),['ABD-OLD','ABD-NEW']);
 assert.equal(result[0].done,false,'new PDF metadata must not falsely complete ABD status');
 assert.equal(result[0].status,'Angefragt');
});

test('RC1621: newer request cannot discard existing ABD PDF',()=>{
 const server=[{id:'REQ-9Z7L82',ref:'9Z7L82',updatedAt:'2026-10-22T10:00:00Z',
  status:'Angefragt',abdFiles:[{id:'A',storage:'blob',blobName:'rc1059/production/aa/valid'}]}];
 const client=[{id:'REQ-9Z7L82',ref:'9Z7L82',updatedAt:'2026-10-22T11:00:00Z',
  status:'Angefragt',abdFiles:[]}];
 const result=mergeCollection('abdRequests',server,client,new Map());
 assert.deepEqual(result[0].abdFiles.map(f=>f.id),['A']);
});

test('RC1621: four separate ABD requests stay independent on overlapping saves',()=>{
 const refs=['9Z7L82','AB1234','CD5678','EF9012'];
 const server=refs.map(ref=>({id:'REQ-'+ref,ref,status:'Angefragt',updatedAt:'2026-10-22T10:00:00Z',
  abdFiles:[{id:'old-'+ref}]}));
 const incoming=refs.map(ref=>({id:'REQ-'+ref,ref,status:'Angefragt',updatedAt:'2026-10-22T10:01:00Z',
  abdFiles:ref==='9Z7L82'?[{id:'new-'+ref}]:[]}));
 const result=mergeCollection('abdRequests',server,incoming,new Map());
 assert.equal(result.length,4);
 assert.deepEqual(result.find(x=>x.ref==='9Z7L82').abdFiles.map(x=>x.id),['old-9Z7L82','new-9Z7L82']);
 refs.slice(1).forEach(ref=>assert.deepEqual(result.find(x=>x.ref===ref).abdFiles.map(x=>x.id),['old-'+ref]));
});
