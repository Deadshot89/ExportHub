import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// The runtime is embedded in the generated, deployed page rather than a
// standalone asset. Test that exact output, not an unrelated mock resolver.
function openBuiltLookup(){
  const html=fs.readFileSync('dist-rc1112/index.html','utf8');
  const start=html.indexOf('function allShipments(){var list=[];roots()');
  assert.ok(start>=0,'RC1726 source must be present in the deployed production candidate');
  const end=html.indexOf('function rows(sh){',start);
  assert.ok(end>start,'RC1726 lookup function boundary');
  assert.match(html,/s\.shipmentViewId=refOf\(sh\)\|\|idOf\(sh\)/,
    'the stable REF, not a recycled technical ID, is the canonical view key');
  const state={
    shipments:[{id:'REUSED-TECH',ref:'OTHER1',customerName:'Wrong customer'}],
    savedShipments:[{id:'S-6',ref:'SAVE66'}],
    archivedShipments:[{id:'REUSED-TECH',ref:'ZVYH89',customerName:'Gebr. Kraan Rondkart. BV',abdFiles:[]}],
    archive:[{id:'H-2',shipmentRef:'HIS222'}],
    shipmentArchive:[{id:'H-3',referenceNumber:'HIS333'}],
    sharedShipments:[{id:'S-4',ref:'SHAR44'}],
    salesSharedShipments:[{id:'S-5',ref:'SALE55'}]
  };
  const context={
    roots:()=>[state],q:v=>String(v==null?'':v).trim(),arr:v=>Array.isArray(v)?v:[],
    obj:v=>!!v&&typeof v==='object'&&!Array.isArray(v),
    idOf:sh=>String(sh&&(sh.id||sh.shipmentId||sh._syncId)||'').trim(),
    refOf:sh=>String(sh&&(sh.ref||sh.reference||sh.shipmentRef||sh.referenceNumber)||'').trim().toUpperCase(),
    score:sh=>(sh&&sh.customerName?30:0)+(sh&&sh.abdFiles?.length||0)
  };
  vm.createContext(context);
  vm.runInContext(html.slice(start,end),context,{filename:'deployed-shipment-lookup.js'});
  return context;
}

test('RC1726: task REF opens historical shipment even when not in active or saved lists',()=>{
  const runtime=openBuiltLookup();
  assert.equal(runtime.find('ZVYH89').customerName,'Gebr. Kraan Rondkart. BV');
  assert.equal(runtime.find('ZVYH89').ref,'ZVYH89');
});

test('RC1726: all shared and archived collections are searched by REF',()=>{
  const runtime=openBuiltLookup();
  for(const ref of ['HIS222','HIS333','SHAR44','SALE55','SAVE66','ZVYH89'])
    assert.equal(runtime.find(ref).shipmentRef||runtime.find(ref).referenceNumber||runtime.find(ref).ref,ref);
  assert.equal(runtime.savedShipments().length,7);
});

test('RC1726: recycled technical ID cannot open a different REF',()=>{
  const runtime=openBuiltLookup();
  assert.equal(runtime.find('REUSED-TECH'),null,
    'ambiguous IDs from different references must fail closed');
  assert.equal(runtime.find({ref:'ZVYH89',id:'REUSED-TECH'}).ref,'ZVYH89');
});

test('RC1726: missing reference never opens another shipment',()=>{
  const runtime=openBuiltLookup();
  assert.equal(runtime.find('NOT999'),null);
  assert.equal(runtime.find(''),null);
});

function taskRuntime(){
  const script=fs.readFileSync('assets/rc1014-task-runtime.js','utf8');
  const root={document:null,addEventListener(){},dispatchEvent(){},
    setTimeout(){return 1;},clearTimeout(){},
    location:{hostname:'exporthub360.com',pathname:'/'}
  };
  vm.runInNewContext(script,{globalThis:root,console,Date,Intl,CustomEvent:function(){}});
  return root.ExportHUBRC1014TaskRuntime;
}

test('RC1726: task detail opens archived REF even if linkedShipmentId has been recycled',()=>{
  const task={sourceType:'av_missing',linkedShipmentRef:'ZVYH89',linkedShipmentId:'REUSED-TECH'};
  const runtime=taskRuntime();
  const ctx={state:{shipments:[{id:'REUSED-TECH',ref:'OTHER1'}],
    archivedShipments:[{id:'REUSED-TECH',ref:'ZVYH89'}]}};
  assert.equal(runtime.linkedShipmentTarget(task,ctx),'ZVYH89');
});

test('RC1726: task detail preserves a valid REF when only the task remains in current state',()=>{
  const runtime=taskRuntime();
  assert.equal(runtime.linkedShipmentTarget({sourceType:'av_missing',sourceRef:'ZVYH89'},
    {state:{shipments:[],savedShipments:[]}}),'ZVYH89');
});
