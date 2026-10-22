import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

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
 const start=html.indexOf('function rc1619CaptureAbdState(sh){');
 const end=html.indexOf('function overrideUploads(){',start);
 assert.ok(start>0 && end>start,'RC1619 fail-closed helper is built before central uploader');
 const code=html.slice(start,end);
 const s={shipments:[],savedShipments:[],abdRequests:[]};
 const context={
   S:()=>s,
   shipmentId:x=>String(x&&x.id||''),
   shipmentRef:x=>String(x&&x.ref||''),
   L:x=>String(x||'').toLowerCase(),
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
 const undo=save(shipment);
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
 assert.match(code,/abdRollback=rc1619CaptureAbdState\(sh\);applyAbdDocumentDurably\(sh,item\)/);
 assert.match(code,/if\(!ok\)\{if\(kind==='abd'\)\{if\(abdRollback\)\{abdRollback\(\);abdRollback=null\}/);
 assert.match(code,/\.catch\(function\(e\)\{if\(key==='abdFiles'\)\{if\(abdRollback\)\{abdRollback\(\);abdRollback=null\}/);
});
test('RC1619: rollback preserves already confirmed old ABD when replacement upload fails',()=>{
 const {s,save}=compileSnapshot();
 const sh={id:'SHIP-9Z7L82',ref:'9Z7L82',abdRequired:true,abdDone:true,abdStatus:'Abgeschlossen',abdFiles:[{id:'ABD-OLD',status:'active'}]};
 s.shipments.push(sh);
 const undo=save(sh);
 sh.abdFiles[0].status='replaced';sh.abdFiles.push({id:'ABD-NEW',status:'active'});
 undo();
 assert.equal(sh.abdDone,true);
 assert.equal(sh.abdStatus,'Abgeschlossen');
 assert.deepEqual(Array.from(sh.abdFiles, f=>f.id),['ABD-OLD']);
 assert.equal(sh.abdFiles[0].status,'active');
});
test('RC1619: patcher rejects changed anchors instead of silently releasing an unsafe uploader',()=>{
 const fixture='window.rc524UploadFile=function(input,key){return false;} window.rc524DeleteFile=';
 assert.throws(()=>patchers.second(fixture,'index.html'),/RC1619 Upload-Anker/);
});
