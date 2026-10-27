import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/rc1063-abd-blob-viewer-compat.js','utf8');
const blob=(name,suffix)=>({
  name,
  storage:'blob',
  blobName:'rc1059/production/ab/'+suffix.repeat(64)
});

function documents(state){
  const win={
    __EXPORTHUB_GET_STATE__:()=>state,
    __EXPORTHUB_RC776_VIEW_DOCS__:[],
    ExportHUBDocumentBlob1059:{
      isBlobDocument:file=>file?.storage==='blob'&&/^rc1059\/production\/[a-f0-9]{2}\/[a-f0-9]{64}$/.test(file.blobName||''),
      legacyUrl:()=>''
    }
  };
  vm.runInNewContext(runtime,{window:win,console,Set});
  return Array.from(win.ExportHUBDocumentActions1151.documents(),doc=>({
    name:doc.name,blobName:doc.file?.blobName,sourceField:doc.sourceField
  }));
}

test('P0 RC1682: open shipment view uses actual selected shipment, never stale unsaved draft',()=>{
  const desired={id:'S-REAL',ref:'9WX5K6',deliveryFiles:[blob('SIDE_9WX5K6.pdf','1')]};
  const stale={id:'S-DRAFT',ref:'WRONG1',deliveryFiles:[blob('FOREIGN.pdf','2')]};
  const state={view:'shipmentview',shipmentViewId:'S-REAL',shipment:stale,shipments:[desired]};
  assert.deepEqual(documents(state).map(d=>d.name),['SIDE_9WX5K6.pdf']);
});

test('P0 RC1682: reused technical ID across two REFs fails closed without authoritative reference',()=>{
  const state={view:'shipmentview',shipmentViewId:'REUSED',shipments:[
    {id:'REUSED',ref:'9WX5K6',deliveryFiles:[blob('RIGHT.pdf','3')]},
    {id:'REUSED',ref:'OTHER1',deliveryFiles:[blob('FOREIGN.pdf','4')]}
  ]};
  assert.deepEqual(documents(state),[]);
});

test('P0 RC1682: authoritative selected REF disambiguates recycled shipment IDs',()=>{
  const state={view:'shipmentview',shipmentViewId:'REUSED',selectedShipmentRef:'9WX5K6',shipments:[
    {id:'REUSED',ref:'OTHER1',deliveryFiles:[blob('FOREIGN.pdf','5')]},
    {id:'REUSED',ref:'9WX5K6',deliveryFiles:[blob('SIDE_9WX5K6.pdf','6')]}
  ]};
  assert.deepEqual(documents(state).map(d=>d.name),['SIDE_9WX5K6.pdf']);
});

test('P0 RC1682: missing selected REF never silently substitutes previous shipment attachments',()=>{
  const state={view:'shipmentview',shipmentViewId:'MISSING-ID',selectedShipmentRef:'9WX5K6',
    shipment:{id:'STALE',ref:'OTHER1',deliveryFiles:[blob('FOREIGN.pdf','7')]},
    shipments:[{id:'STALE',ref:'OTHER1',deliveryFiles:[blob('FOREIGN.pdf','7')]}]};
  assert.deepEqual(documents(state),[]);
});

test('P0 RC1682: archive exact REF remains discoverable after shipment was archived',()=>{
  const state={view:'shipmentview',shipmentViewId:'ARCHIVED-ID',
    shipment:{id:'EDITOR',ref:'OTHER1',deliveryFiles:[blob('FOREIGN.pdf','8')]},
    archivedShipments:[{id:'ARCHIVED-ID',ref:'9WX5K6',deliveryFiles:[blob('SIDE_9WX5K6.pdf','9')]}]};
  assert.deepEqual(documents(state).map(d=>d.name),['SIDE_9WX5K6.pdf']);
});


test('P0 RC1682: stale selectedShipmentRef cannot override an opened different ID',()=>{
  const state={view:'shipmentview',shipmentViewId:'CURRENT',selectedShipmentRef:'9WX5K6',
    shipments:[
      {id:'CURRENT',ref:'OTHER1',deliveryFiles:[blob('CURRENT.pdf','a')]},
      {id:'OLD',ref:'9WX5K6',deliveryFiles:[blob('OLD_SECRET.pdf','b')]}
    ]};
  assert.deepEqual(documents(state),[],'conflicting ID and REF must never expose documents');
});

test('P0 RC1682: refreshed technical ID can still recover same stable selected REF',()=>{
  const state={view:'shipmentview',shipmentViewId:'OLD-ID',selectedShipmentRef:'9WX5K6',
    shipments:[{id:'NEW-ID',ref:'9WX5K6',deliveryFiles:[blob('SIDE_9WX5K6.pdf','c')]}]};
  assert.deepEqual(documents(state).map(x=>x.name),['SIDE_9WX5K6.pdf']);
});
