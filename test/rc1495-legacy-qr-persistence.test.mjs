import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

function build(){
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
}

function persistedSource(html){
  const start=html.indexOf('function persisted(sh)');
  const end=html.indexOf('function completeRow',start);
  assert.ok(start>=0&&end>start,'QR persisted()-Runtime fehlt');
  return html.slice(start,end);
}

function evaluatePersisted(source,shipment,state){
  const context={
    sh:shipment,
    state,
    sid(value){return String(value&&(value.id||value.shipmentId||value._id)||'').trim();},
    sref(value){return String(value&&(value.ref||value.reference||value.shipmentRef||value.referenceNumber)||'').trim().toUpperCase();},
    states(){return [state];},
    arr(value){return Array.isArray(value)?value:[];}
  };
  vm.runInNewContext(`${source}\nresult=persisted(sh);`,context);
  return context.result===true;
}

test('RC1495: serverseitig gespeicherte Altdaten-Sendung darf QR auch ohne technische ID aktivieren',()=>{
  build();
  const html=fs.readFileSync('dist-rc1112/index.html','utf8');
  const source=persistedSource(html);

  const legacy={
    ref:'PPR6UC',
    reference:'PPR6UC',
    customerName:'ESSENTRA COMPONENTS SAS',
    status:'Erstellt',
    rows:[{type:'Palette',count:18}]
  };
  const legacyState={shipments:[legacy],savedShipments:[]};
  assert.equal(
    evaluatePersisted(source,legacy,legacyState),
    true,
    'Eine bereits in shipments gespeicherte Sendung mit gültiger 6-stelliger Referenz darf nicht nur wegen fehlender Legacy-ID als ungespeichert gelten'
  );

  const savedLegacy={ref:'ABC123',customerName:'Legacy Kunde'};
  assert.equal(
    evaluatePersisted(source,savedLegacy,{shipments:[],savedShipments:[savedLegacy]}),
    true,
    'Auch savedShipments-Altdaten ohne technische ID müssen als persistiert gelten'
  );

  const unsaved={ref:'ABC123',customerName:'Nicht gespeichert'};
  assert.equal(
    evaluatePersisted(source,unsaved,{shipments:[],savedShipments:[]}),
    false,
    'Ein Objekt mit Referenz allein darf ohne gespeicherten State-Eintrag nicht als persistiert gelten'
  );

  const draft={id:'DRAFT-4711',ref:'ABC123',customerName:'Entwurf'};
  assert.equal(
    evaluatePersisted(source,draft,{shipments:[draft],savedShipments:[]}),
    false,
    'DRAFT-IDs bleiben trotz State-Eintrag fail-closed'
  );
});
