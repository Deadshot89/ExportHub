import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(){
  const source=fs.readFileSync('assets/pack-notification-shipment.js','utf8');
  const root={};
  vm.runInContext(source,vm.createContext({window:root,globalThis:root,console,Date,Intl,setTimeout,clearTimeout}),{filename:'pack-notification-shipment.js'});
  return root.ExportHUBPackShipment;
}
function state(){return{packNotifications:[{id:'pn-1',reference:'PK-1',customer:'BSH',deliveryNoteReference:'LS1',packageType:'Europalette',packageCount:2,totalWeight:600,packages:[{packageNo:1,length:120,width:80,height:140,unit:'cm'},{packageNo:2,length:120,width:80,height:130,unit:'cm'}],documents:[{id:'d1',name:'LS1.pdf',storage:'blob',blobName:'rc1059/production/aa/'+('a'.repeat(64)),mimeType:'application/pdf',size:12}],status:'in_review'}],tasks:[{id:'task:pack:pn-1',sourceType:'pack_notification',sourceId:'pn-1',sourceRef:'PK-1'}],shipments:[]};}

test('shipment prefill preserves pack origin, dimensions, weight and document references',()=>{
  const api=load(),s=state(),n=s.packNotifications[0];
  const prefill=api.shipmentPrefill(n);
  assert.equal(prefill.packNotificationId,'pn-1');
  assert.equal(prefill.packNotificationRef,'PK-1');
  assert.equal(prefill.customerName,'BSH');
  assert.equal(prefill.totalWeight,600);
  assert.equal(prefill.rows.length,2);
  assert.equal(prefill.rows[0].l,120);
  assert.equal(prefill.deliveryFiles.length,1);
  assert.equal(prefill.deliveryFiles[0].blobName,n.documents[0].blobName);
  assert.equal(prefill.deliveryFiles[0].customerVisible,false);
});

test('existing shipment linked to pack notification is found and prevents duplicate creation',()=>{
  const api=load(),s=state();
  s.shipments.push({id:'sh-1',ref:'ABC123',packNotificationId:'pn-1'});
  s.packNotifications[0].shipmentId='sh-1';
  assert.equal(api.findShipmentForNotification(s,s.packNotifications[0]).id,'sh-1');
});

test('linkShipment writes bidirectional relation and marks notification shipment_created',()=>{
  const api=load(),s=state(),shipment={id:'sh-1',ref:'ABC123',deliveryFiles:[]};s.shipments.push(shipment);
  api.linkShipment(s,s.packNotifications[0],shipment,'2026-10-08T11:00:00.000Z');
  assert.equal(s.packNotifications[0].shipmentId,'sh-1');
  assert.equal(s.packNotifications[0].status,'shipment_created');
  assert.equal(shipment.packNotificationId,'pn-1');
  assert.equal(shipment.packNotificationRef,'PK-1');
  assert.equal(shipment.deliveryFiles.length,1);
  assert.equal(shipment.deliveryFiles[0].blobName,s.packNotifications[0].documents[0].blobName);
});
