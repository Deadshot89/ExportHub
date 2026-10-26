import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';

const build = fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

function emittedLoader(){
  const start = build.indexOf('`async function loadReferenceDocs(sh,fallback){');
  assert.ok(start >= 0, 'Generated shipment documents loader is missing');
  const end = build.indexOf('\n`', start + 1);
  assert.ok(end > start, 'Generated shipment documents loader is not closed');
  return build.slice(start + 1,end);
}

function harness(response){
  const first={id:'SHIP-9WX5K6',ref:'9WX5K6',files:[]};
  const current={view:'shipmentview',shipmentViewId:first.id,shipments:[first]};
  let resolveRequest;
  const resolvers=[];
  const panels=[];
  const context={
    rcShipmentDocumentRequestSeq:0,
    state:()=>current,
    find:id=>current.shipments.find(s=>s.id===id || s.ref===id),
    refOf:s=>String(s?.ref||'').toUpperCase(),
    idOf:s=>s?.id||'',
    low:v=>String(v||'').toLowerCase(),
    arr:x=>Array.isArray(x)?x:[],
    shipmentAssociatedDocs:(sh,prior)=>(prior||[]).concat(sh?.files||[]),
    referenceList:(ref,force)=>{assert.equal(ref,'9WX5K6');assert.equal(force,true,'Shipment view must refresh the live REF folder instead of using cached empty results');return new Promise(resolve=>{resolveRequest=resolve;resolvers.push(resolve)})},
    liveDoc:(f,ref)=>({...f,reference:ref,source:'referenceFolder'}),
    mergeReferenceDocs:(live,fallback)=>live.concat(fallback),
    setDocsPanel:(docs,source,error)=>panels.push({docs,source,error}),
    console:{warn(){}}
  };
  vm.runInNewContext(emittedLoader(),context,{filename:'generated-shipment-document-loader.js'});
  return {first,current,panels,run:()=>context.loadReferenceDocs(first,[]),resolve:()=>resolveRequest(response),resolveAt:(index,payload=response)=>resolvers[index](payload)};
}

test('RC1632: documentation loader includes a syntax-valid active release transform',()=>{
  const check=spawnSync(process.execPath,['--check','.github/rc1112/build-three-env.mjs'],{encoding:'utf8'});
  assert.equal(check.status,0,check.stderr||check.stdout);
  assert.doesNotThrow(()=>new Function(emittedLoader()));
});

test('RC1632: documents uploaded while the REF folder is loading are rendered from current shipment state',async()=>{
  const h=harness({ok:true,available:true,files:[]});
  const pending=h.run();
  h.current.shipments=[{id:h.first.id,ref:h.first.ref,files:[{name:'SIDE250071804.pdf',url:'/api/exporthub-document?blob=saved'}]}];
  h.resolve();
  await pending;
  assert.equal(h.panels.length,1);
  assert.deepEqual(Array.from(h.panels[0].docs,d=>d.name),['SIDE250071804.pdf']);
  assert.equal(h.panels[0].source,'fallback');
  assert.equal(h.panels[0].error,false);
});

test('RC1632: missing REF folder is distinguished from an empty but reachable folder',async()=>{
  const h=harness({ok:true,available:true,folderMissing:true,files:[]});
  const pending=h.run();h.resolve();await pending;
  assert.equal(h.panels[0].source,'missingFolder');
  assert.match(build,/Ref-Ordner über die konfigurierte Microsoft-Verbindung nicht gefunden/);
  assert.match(build,/Der konfigurierte Ref-Ordner konnte nicht gefunden werden/);
});

test('RC1632: if Graph is unavailable, preserve currently saved shipment attachments',async()=>{
  const h=harness({ok:true,available:false,files:[]});
  const pending=h.run();
  h.current.shipments=[{id:h.first.id,ref:h.first.ref,files:[{name:'ABD_9WX5K6.pdf',url:'/api/exporthub-document?blob=abd'}]}];
  h.resolve();await pending;
  assert.deepEqual(Array.from(h.panels[0].docs,d=>d.name),['ABD_9WX5K6.pdf']);
  assert.equal(h.panels[0].error,true);
});

test('RC1632: completion of an old REF request cannot overwrite another shipment view',async()=>{
  const h=harness({ok:true,available:true,files:[]});
  const pending=h.run();
  h.current.shipmentViewId='OTHER';h.current.shipments=[{id:'OTHER',ref:'OTHER1'}];
  h.resolve();await pending;
  assert.equal(h.panels.length,0);
});

test('P0: refreshed shipment with a new internal ID but the same REF still displays attachments',async()=>{
  const h=harness({ok:true,available:true,files:[]});
  const pending=h.run();
  h.current.shipmentViewId='CURRENT-NEW-ID';
  h.current.shipments=[{id:'CURRENT-NEW-ID',ref:'9WX5K6',files:[{name:'CMR_9WX5K6.pdf',url:'/api/exporthub-document?blob=cmr'}]}];
  h.resolve();await pending;
  assert.deepEqual(Array.from(h.panels[0].docs,d=>d.name),['CMR_9WX5K6.pdf']);
  assert.equal(h.panels[0].error,false);
});

test('P0: older REF folder response cannot overwrite a newer response for the same shipment',async()=>{
  const h=harness({ok:true,available:true,files:[]});
  const old=h.run();
  const latest=h.run();
  h.resolveAt(1,{ok:true,available:true,files:[{id:'LATEST',name:'LATEST.pdf'}]});
  await latest;
  h.resolveAt(0,{ok:true,available:true,files:[{id:'STALE',name:'STALE.pdf'}]});
  await old;
  assert.equal(h.panels.length,1);
  assert.deepEqual(Array.from(h.panels[0].docs,d=>d.name),['LATEST.pdf']);
});
