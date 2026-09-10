import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtimeSource = fs.readFileSync('assets/rc1012-abholkalender-runtime.js','utf8');
const rc1013BuilderSource = fs.readFileSync('.github/rc1013/build-three-env.mjs','utf8');

function loadRuntime(){
  const opened=[];
  const content={innerHTML:''};
  let mountOptions=null;
  const window={
    __EXPORTHUB_GET_STATE__:()=>({companyId:'essentra',shipments:[{id:'S-2',reference:'DEF456'}]}),
    document:{getElementById:id=>id==='content'?content:null},
    ExportHubPickupCalendar:{mount(_root,options){mountOptions=options;}},
    openShipment:value=>{opened.push(value);return true;},
    canRead:()=>true,
    location:{hostname:'exporthub.example',pathname:'/index.html'}
  };
  vm.runInNewContext(runtimeSource,{window,globalThis:window});
  assert.equal(typeof window.pickupcalendar,'function');
  assert.equal(window.pickupcalendar(),true);
  assert.ok(mountOptions);
  return {opened,mountOptions};
}

function loadRuntimeWithCanonicalShipmentView(){
  const opened=[];
  const content={innerHTML:''};
  let mountOptions=null;
  const window={
    __EXPORTHUB_GET_STATE__:()=>({companyId:'essentra',shipments:[{id:'S-2',reference:'DEF456'}]}),
    document:{getElementById:id=>id==='content'?content:null},
    ExportHubPickupCalendar:{mount(_root,options){mountOptions=options;}},
    ExportHUBShipmentView:{open(value,source){opened.push([value,source]);return false;}},
    canRead:()=>true,
    location:{hostname:'exporthub.example',pathname:'/index.html'}
  };
  vm.runInNewContext(runtimeSource,{window,globalThis:window});
  assert.equal(typeof window.pickupcalendar,'function');
  assert.equal(window.pickupcalendar(),true);
  assert.ok(mountOptions);
  return {opened,mountOptions};
}

test('RC1018: Kalender öffnet die bestehende Sendungsansicht über die Sendungsreferenz',()=>{
  const {opened,mountOptions}=loadRuntime();
  assert.equal(typeof mountOptions.onOpenShipment,'function');
  assert.equal(mountOptions.onOpenShipment({id:'S-2',reference:'DEF456'}),true);
  assert.deepEqual(opened,['DEF456']);
});

test('RC1018: Kalender fällt ohne Referenz auf die stabile Sendungs-ID zurück',()=>{
  const {opened,mountOptions}=loadRuntime();
  assert.equal(mountOptions.onOpenShipment({id:'S-ONLY'}),true);
  assert.deepEqual(opened,['S-ONLY']);
});

test('RC1030: Kalender öffnet über die echte kanonische ExportHUB-Sendungsansicht',()=>{
  const {opened,mountOptions}=loadRuntimeWithCanonicalShipmentView();
  assert.equal(typeof mountOptions.onOpenShipment,'function');
  mountOptions.onOpenShipment({id:'S-2',reference:'DEF456'});
  assert.deepEqual(opened,[['DEF456','pickupcalendar']]);
});

test('RC1030: aktiver Drei-Umgebungen-Build erzwingt eine frische Kalender-Runtime',()=>{
  assert.match(rc1013BuilderSource,/rc1012-abholkalender-runtime\.js\?v=1012&rc=1030/);
  assert.doesNotMatch(rc1013BuilderSource,/CALENDAR_RUNTIME='\/assets\/rc1012-abholkalender-runtime\.js\?v=1012';/);
});
