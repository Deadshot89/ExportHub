import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(){
  const source=fs.readFileSync('assets/pack-notification-avis.js','utf8');
  const root={};
  vm.runInContext(source,vm.createContext({window:root,globalThis:root,console,Date,Intl,setTimeout,clearTimeout}),{filename:'pack-notification-avis.js'});
  return root.ExportHUBPackAvis;
}
function shipment(){return{id:'sh-1',ref:'ABC123',packNotificationId:'pn-1',deliveryFiles:[
  {id:'d1',name:'LS1.pdf',source:'pack_notification',blobName:'rc1059/production/aa/'+('a'.repeat(64)),customerVisible:false,customerAvisVisible:false},
  {id:'d2',name:'LS2.pdf',source:'pack_notification',blobName:'rc1059/production/bb/'+('b'.repeat(64)),customerVisible:false,customerAvisVisible:false},
  {id:'other',name:'Other.pdf',source:'manual',customerAvisVisible:true}
]};}

test('pack documents are private by default for existing AVIS contract',()=>{
  const sh=shipment();
  for(const doc of sh.deliveryFiles.filter(d=>d.source==='pack_notification'))assert.equal(doc.customerAvisVisible,false);
  const customerAvis=fs.readFileSync('api/customer-avis/index.js','utf8');
  assert.match(customerAvis,/customerAvisVisible===false/);
});

test('setVisibility toggles only selected pack delivery note',()=>{
  const api=load(),sh=shipment();
  assert.equal(api.setVisibility(sh,'d1',true,'2026-10-08T11:30:00.000Z'),true);
  assert.equal(sh.deliveryFiles[0].customerAvisVisible,true);
  assert.equal(sh.deliveryFiles[0].customerVisible,true);
  assert.equal(sh.deliveryFiles[1].customerAvisVisible,false);
  assert.equal(sh.deliveryFiles[0].customerAvisVisibilityUpdatedAt,'2026-10-08T11:30:00.000Z');
});

test('publicPackDocuments returns only explicitly released pack documents',()=>{
  const api=load(),sh=shipment();
  api.setVisibility(sh,'d2',true,'2026-10-08T11:30:00.000Z');
  assert.deepEqual(api.publicPackDocuments(sh).map(x=>x.id),['d2']);
});

test('AVIS adapter renders a shipment panel only for pack-linked shipments',()=>{
  const source=fs.readFileSync('assets/pack-notification-avis.js','utf8');
  assert.match(source,/renderPanel/);
  assert.match(source,/packNotificationId/);
  assert.match(source,/customerAvisVisible/);
  assert.match(source,/Für AVIS freigeben|Auf AVIS sichtbar/);
});
