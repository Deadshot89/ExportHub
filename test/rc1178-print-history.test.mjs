import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

const source=fs.readFileSync('assets/rc1071-shipment-history.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

function setup(){
  const docEvents=new Map(),winEvents=new Map();
  const sh={id:'S1178',reference:'P1178A',status:'Erstellt',shipmentHistory:[]};
  const state={view:'shipment',shipment:sh,currentShipment:sh,shipments:[sh],currentUser:{id:'U1',name:'Sikandar',role:'Benutzer'}};
  const document={
    body:null,head:null,documentElement:{},readyState:'complete',
    addEventListener(name,fn){docEvents.set(name,fn)},
    getElementById(){return null},querySelector(){return null},querySelectorAll(){return[]}
  };
  const window={
    document,console,
    __EXPORTHUB_GET_STATE__:()=>state,
    __EXPORTHUB_GET_CURRENT_USER__:()=>state.currentUser,
    addEventListener(name,fn){winEvents.set(name,fn)}
  };
  const context={window,document,console,Date,Intl,Math,Map,Set,Array,Object,String,Number,Promise,MutationObserver:undefined,
    setTimeout(fn){fn();return 1},clearTimeout(){},setInterval(){return 1}};
  vm.runInNewContext(source,context,{filename:'rc1071-shipment-history.js'});
  return {window,docEvents,winEvents,sh,api:window.ExportHUBShipmentHistory1071};
}
function element(text){
  return {
    textContent:text,
    getAttribute(name){if(name==='title'||name==='data-action'||name==='href')return'';return''},
    closest(){return this}
  };
}

test('RC1178: Bubble-Druckpfad protokolliert Gesamtdruck auch wenn der Capture-Click nicht genutzt wird',()=>{
  const {api,sh}=setup();
  const el=element('Gesamtdruck');
  assert.equal(api.printBubble({target:el}),true);
  const events=api.events(sh).filter(e=>e.type==='print');
  assert.equal(events.length,1);
  assert.equal(events[0].label,'Gesamtdruck – gedruckt');
  assert.equal(events[0].actor.name,'Sikandar');
  assert.equal(events[0].details.document,'Gesamtdruck');
  assert.equal(events[0].details.fileName,'Gesamtdruck_P1178A.pdf');
});

test('RC1178: Capture- und Bubble-Erkennung erzeugen zusammen nur einen Druckeintrag',()=>{
  const {api,sh}=setup();
  const el=element('CMR drucken');
  assert.equal(api.printFromElement(el),true);
  assert.equal(api.printBubble({target:el}),true);
  const events=api.events(sh).filter(e=>e.type==='print');
  assert.equal(events.length,1);
  assert.equal(events[0].label,'CMR – gedruckt');
});

test('RC1178: explizites document-action print wird unterstützt und mit Klickpfad dedupliziert',()=>{
  const {api,sh,winEvents}=setup();
  const ev=winEvents.get('exporthub:document-action');
  assert.equal(typeof ev,'function');
  ev({detail:{action:'print',document:'Lieferschein',fileName:'LS_P1178A.pdf'}});
  const events=api.events(sh).filter(e=>e.type==='print');
  assert.equal(events.length,1);
  assert.equal(events[0].label,'Lieferschein – gedruckt');
  assert.equal(events[0].details.fileName,'LS_P1178A.pdf');
});

test('RC1178: Druck-History wird cache-sicher in allen drei Umgebungen ausgeliefert',()=>{
  assert.match(build,/rc1071-shipment-history\.js\?v=1178/);
  assert.match(build,/RC1178 Druck-History Cache-Key/);
});

test('RC1178: geänderte Dateien bleiben syntaktisch gültig',()=>{
  for(const file of ['assets/rc1071-shipment-history.js','.github/rc1112/build-three-env.mjs']){
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  }
});
