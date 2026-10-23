import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Validate the actual assembled production HTML, not a mock implementation.
const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const start=builder.indexOf('function patchRc1624AbdUploadCrossCollection(');
const end=builder.indexOf('function patchRc1602OfficialPod(',start);
assert.ok(start>=0&&end>start,'RC1624 builder is wired');
const patch=vm.runInNewContext(builder.slice(start,end)+'\npatchRc1624AbdUploadCrossCollection');
const canonical=fs.readFileSync('index.html','utf8');
const html=patch(canonical,'index.html');

function runRuntime(seed){
  const fstart=html.indexOf('function shipmentDocumentCopies(sh){');
  const fend=html.indexOf('async function verifyAbdUploadAfterAzure(',fstart);
  assert.ok(fstart>=0&&fend>fstart,'RC1624 functions in built HTML');
  const context={
    S:()=>seed,
    shipmentId:x=>String(x?.id||''),
    shipmentRef:x=>String(x?.ref||''),
    A:x=>Array.isArray(x)?x:[],
    L:x=>String(x||'').toLowerCase(),
    Q:x=>String(x??'').trim(),
    clone:x=>structuredClone(x),
    documentHistory:x=>x.documentHistory||(x.documentHistory=[]),
    recalculateShipmentStatus:x=>{x.status=x.abdDone?'Bereit zur Abholung':'Wartet auf ABD'},
    Date,Promise,window:{},console
  };
  vm.runInNewContext(html.slice(fstart,fend),context);
  return context;
}

test('RC1624: existing savedShipment is updated together with live shipment and its ABD request',()=>{
  const live={id:'SHIP-9Z7L82',ref:'9Z7L82',abdRequired:true,abdDone:false,abdStatus:'Wartet auf ABD'};
  const saved={id:'SHIP-9Z7L82',ref:'9Z7L82',abdRequired:true,abdDone:false,abdStatus:'Wartet auf ABD'};
  const req={id:'REQ-9Z7L82',ref:'9Z7L82',linkedShipmentId:live.id,status:'Angefragt',abdFiles:[]};
  const unrelated={id:'SHIP-X',ref:'OTHER1',abdDone:false,abdStatus:'Wartet auf ABD'};
  const state={shipments:[live,unrelated],savedShipments:[saved],abdRequests:[req]};
  const env=runRuntime(state);
  env.applyAbdDocumentDurably(live,{id:'ABD-NEW',name:'test.pdf',data:'data:application/pdf;base64,JVBERi0xLjQK'});
  for(const sh of [live,saved]){
    assert.equal(sh.abdDone,true);
    assert.equal(sh.abdStatus,'Abgeschlossen');
    assert.equal(sh.abdFiles.length,1);
    assert.equal(sh.abdFiles[0].id,'ABD-NEW');
  }
  assert.equal(req.done,true);
  assert.equal(req.abdFiles[0].id,'ABD-NEW');
  assert.equal(unrelated.abdFiles,undefined,'other shipment must not receive ABD');
});

test('RC1624: conflicting IDs and references are never cross-updated',()=>{
  const sh={id:'SHIP-9Z7L82',ref:'9Z7L82'};
  const conflictId={id:'SHIP-9Z7L82',ref:'OTHER1'};
  const conflictRef={id:'SHIP-OTHER',ref:'9Z7L82'};
  const exact={id:'SHIP-9Z7L82',ref:'9Z7L82'};
  const s={shipments:[sh],savedShipments:[conflictId,conflictRef,exact],abdRequests:[]};
  const c=runRuntime(s);
  c.applyAbdDocumentDurably(sh,{id:'ABD-NEW'});
  assert.equal(exact.abdDone,true);
  assert.equal(conflictId.abdFiles,undefined);
  assert.equal(conflictRef.abdFiles,undefined);
});

test('RC1624: RC1626 bounded Azure save is applied first and not replaced',()=>{
  assert.match(builder,/html=patchRc1626AbdUploadBoundedSave\(html,file\);\s*html=patchRc1624AbdUploadCrossCollection\(html,file\);/);
  assert.match(builder,/clean\.flushSave\(reason,\{force:true,userInitiated:true\}\)/);
  assert.ok(!builder.slice(start,end).includes('flushBefore'),'outdated RC1624 string-replacement must not be restored');
});

test('RC1624: shared and saved copies match only the same shipment',()=>{
  const original={id:'SHIP-A',ref:'ABC123',abdDone:false};
  const saved={id:'SHIP-A',ref:'ABC123',abdDone:false};
  const shared={id:'SHIP-A',ref:'ABC123',abdDone:false};
  const mismatched={id:'SHIP-B',ref:'ABC123',abdDone:false};
  const s={shipments:[original],savedShipments:[saved],sharedShipments:[shared,mismatched],abdRequests:[]};
  const c=runRuntime(s);
  c.applyAbdDocumentDurably(original,{id:'ABD-TEST'});
  assert.equal(saved.abdDone,true);
  assert.equal(shared.abdDone,true);
  assert.equal(mismatched.abdDone,false);
  assert.equal(mismatched.abdFiles,undefined);
});

test('RC1624: no silent rewrite of unrelated or absent shipping records',()=>{
  const isolated={id:'SHIP-ONLY',ref:'ONLY01',abdDone:false};
  const s={shipments:[isolated],savedShipments:[],abdRequests:[]};
  const c=runRuntime(s);
  c.applyAbdDocumentDurably(isolated,{id:'ABD-ONLY'});
  assert.equal(isolated.abdDone,true);
  assert.equal(isolated.abdFiles.length,1);
});
