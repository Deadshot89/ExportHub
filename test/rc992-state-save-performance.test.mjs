import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {mergeState}=require('../api/shared/merge.js');

test('RC992: Release-Center-Punkt bleibt als historischer Bestandsschutz sichtbar',()=>{
  const html=fs.readFileSync('TESTVERSION.html','utf8');
  assert.match(html,/RC992 reduziert beim Azure-State-Speichern unnötige Tiefkopien unveränderter State-Bereiche und Datensätze\./);
});

test('RC992: kleine Delta-Änderung kopiert unveränderte große Sammlungen nicht tief',()=>{
  let deepReads=0;
  const expensivePayload={};
  Object.defineProperty(expensivePayload,'documentBody',{
    enumerable:true,
    get(){deepReads++;return 'x'.repeat(1024)}
  });

  const unchangedShipments=[{
    id:'S1',
    ref:'ABC123',
    updatedAt:'2026-09-03T10:00:00.000Z',
    deliveryFiles:[{id:'D1',name:'LS.pdf',payload:expensivePayload}]
  }];
  const server={
    shipments:unchangedShipments,
    tasks:[{id:'T1',title:'Test',status:'offen',updatedAt:'2026-09-03T10:00:00.000Z'}],
    customers:[{id:'C1',account:'100',name:'Kunde A',updatedAt:'2026-09-03T10:00:00.000Z'}],
    _teamSyncMeta:{fields:{},tombstones:[]}
  };
  const incoming={
    tasks:[{id:'T1',status:'erledigt',done:true,updatedAt:'2026-09-03T11:00:00.000Z'}],
    _teamSyncMeta:{fields:{},tombstones:[]}
  };

  const merged=mergeState(server,incoming);

  assert.equal(deepReads,0,'Unveränderte Sendungen wurden beim Merge unnötig tief gelesen/kopiert');
  assert.strictEqual(merged.shipments,unchangedShipments,'Unveränderte Sammlung soll strukturell wiederverwendet werden');
  assert.equal(merged.tasks[0].done,true);
  assert.equal(merged.tasks[0].status,'erledigt');
});

test('RC992: geänderte Sendung kopiert andere unveränderte Sendungen derselben Sammlung nicht tief',()=>{
  let deepReads=0;
  const expensivePayload={};
  Object.defineProperty(expensivePayload,'documentBody',{
    enumerable:true,
    get(){deepReads++;return 'x'.repeat(1024)}
  });

  const unchanged={
    id:'S2',
    ref:'DEF456',
    updatedAt:'2026-09-03T10:00:00.000Z',
    deliveryFiles:[{id:'D2',name:'POD.pdf',payload:expensivePayload}]
  };
  const server={
    shipments:[
      {id:'S1',ref:'ABC123',status:'Erstellt',updatedAt:'2026-09-03T10:00:00.000Z'},
      unchanged
    ],
    _teamSyncMeta:{fields:{},tombstones:[]}
  };
  const incoming={
    shipments:[{id:'S1',ref:'ABC123',status:'Bereit zur Abholung',updatedAt:'2026-09-03T11:00:00.000Z'}],
    _teamSyncMeta:{fields:{},tombstones:[]}
  };

  const merged=mergeState(server,incoming);
  const unchangedAfter=merged.shipments.find(item=>item.ref==='DEF456');

  assert.equal(deepReads,0,'Nicht geänderte Sendung innerhalb der Sammlung wurde tief kopiert');
  assert.strictEqual(unchangedAfter,unchanged,'Nicht geänderter Datensatz soll strukturell wiederverwendet werden');
  assert.equal(merged.shipments.find(item=>item.ref==='ABC123').status,'Bereit zur Abholung');
});
