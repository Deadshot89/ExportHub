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
    arr(value){return Array.isArray(value)?value:[];}
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

const ppr6uc=()=>({
  id:'DRAFT-LEGACY-PPR6UC',
  ref:'PPR6UC',
  reference:'PPR6UC',
  customerName:'ESSENTRA COMPONENTS SAS',
  status:'Erstellt',
  processStatus:'Erstellt',
  rows:[{type:'Palette',count:18}]
});

test('RC1496: ein kanonisch gespeicherter Alt-Datensatz darf trotz alter DRAFT-ID nicht als ungespeichert gelten',()=>{
  build();
  const html=fs.readFileSync('dist-rc1112/index.html','utf8');
  const source=runtimeBlock(html);
  const shipment=ppr6uc();
  const state={shipments:[shipment],savedShipments:[]};
  const win={__EXPORTHUB_GET_STATE__:()=>state};
  assert.equal(
    evaluatePersisted(source,win,shipment),
    true,
    'Die kanonische Persistenz in state.shipments muss stärker wiegen als eine historische DRAFT-ID'
  );
});

test('RC1496: QR-Persistenz muss dieselbe ExportHUBClean.state-Quelle wie die Sendungsübersicht sehen',()=>{
  build();
  const html=fs.readFileSync('dist-rc1112/index.html','utf8');
  const source=runtimeBlock(html);
  const shipment={...ppr6uc(),id:'LEGACY-PPR6UC'};
  const state={shipments:[shipment],savedShipments:[]};
  const win={ExportHUBClean:{state}};
  assert.equal(
    evaluatePersisted(source,win,shipment),
    true,
    'Eine in ExportHUBClean.state.shipments sichtbare Sendung darf der QR-Controller nicht als ungespeichert ablehnen'
  );
});

test('RC1496 Guard: ein nur lokaler DRAFT ohne kanonischen Listeneintrag bleibt gesperrt',()=>{
  build();
  const html=fs.readFileSync('dist-rc1112/index.html','utf8');
  const source=runtimeBlock(html);
  const shipment=ppr6uc();
  const state={shipments:[],savedShipments:[]};
  const win={__EXPORTHUB_GET_STATE__:()=>state};
  assert.equal(evaluatePersisted(source,win,shipment),false);
});
