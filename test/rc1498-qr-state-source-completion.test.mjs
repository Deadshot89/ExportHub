import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

function build(){
  execFileSync(process.execPath,['scripts/rc1462-pretest.mjs'],{stdio:'pipe'});
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
}

function runtimeBlock(html){
  const start=html.indexOf('function states()');
  const end=html.indexOf('function completeRow',start);
  assert.ok(start>=0&&end>start,'QR states()/persisted()-Runtime fehlt');
  return html.slice(start,end);
}

function contextFor(windowObject,shipment){
  const context={
    window:windowObject,
    sh:shipment,
    result:false,
    q(value){return String(value==null?'':value).replace(/\s+/g,' ').trim();},
    arr(value){return Array.isArray(value)?value:[];},
    obj(value){return !!value&&typeof value==='object'&&!Array.isArray(value);}
  };
  context.window.window=context.window;
  context.structuredClone=value=>JSON.parse(JSON.stringify(value));
  return context;
}

function evaluatePersisted(source,windowObject,shipment){
  const context=contextFor(windowObject,shipment);
  vm.runInNewContext(`${source}\nresult=persisted(sh);`,context);
  return context.result===true;
}

function ppr6uc(){
  return {
    id:'DRAFT-LEGACY-PPR6UC',
    ref:'PPR6UC',
    reference:'PPR6UC',
    customerName:'ESSENTRA COMPONENTS SAS',
    status:'Erstellt',
    processStatus:'Erstellt',
    rows:[{type:'Palette',count:18}]
  };
}

let builtSource='';
function source(){
  if(!builtSource){
    build();
    builtSource=runtimeBlock(fs.readFileSync('dist-rc1112/index.html','utf8'));
  }
  return builtSource;
}

test('RC1498 RED: QR-Persistenz muss dieselbe ExportHUBClean.state-Quelle wie die Sendungsübersicht akzeptieren',()=>{
  const shipment=ppr6uc();
  const state={shipments:[shipment],savedShipments:[]};
  const win={ExportHUBClean:{state}};
  assert.equal(
    evaluatePersisted(source(),win,shipment),
    true,
    'PPR6UC ist in der von der Sendungsübersicht verwendeten ExportHUBClean.state gespeichert, darf aber vom QR-Gate nicht als ungespeichert abgewiesen werden'
  );
});

test('RC1498 RED: QR-Persistenz muss appState als zweiten echten Übersichts-Fallback akzeptieren',()=>{
  const shipment=ppr6uc();
  const state={shipments:[shipment],savedShipments:[]};
  const win={appState:state};
  assert.equal(evaluatePersisted(source(),win,shipment),true);
});

test('RC1498 RED: serverseitig geführte Shared-Sendungen zählen als gespeicherte Sendungen',()=>{
  for(const collection of ['salesSharedShipments','sharedShipments']){
    const shipment=ppr6uc();
    const state={shipments:[],savedShipments:[],[collection]:[shipment]};
    const win={__EXPORTHUB_GET_STATE__:()=>state};
    assert.equal(
      evaluatePersisted(source(),win,shipment),
      true,
      `${collection} ist eine persistierte Sendungssammlung und darf die QR-Aktivierung nicht blockieren`
    );
  }
});

test('RC1498 Guard: ein nur aktiver lokaler Draft ohne Listeneintrag bleibt gesperrt',()=>{
  const shipment=ppr6uc();
  const state={shipment,shipments:[],savedShipments:[],salesSharedShipments:[],sharedShipments:[]};
  const win={__EXPORTHUB_GET_STATE__:()=>state,ExportHUBClean:{state},appState:state};
  assert.equal(evaluatePersisted(source(),win,shipment),false);
});
