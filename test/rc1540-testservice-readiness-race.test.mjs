import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const helper=fs.readFileSync('e2e/helpers/exporthub-browser.mjs','utf8');
const recoverySource=fs.readFileSync('assets/rc1067-startup-recovery.js','utf8');

function recoveryRuntime({view='',text='',interactive=false}={}){
  const content={textContent:text};
  const body={
    textContent:text,
    getAttribute(name){return name==='data-exporthub-view'?view:'';},
    appendChild(){}
  };
  const document={
    readyState:'complete',
    body,
    getElementById(id){return id==='content'?content:null;},
    querySelector(){return interactive?{}:null;},
    createElement(){return {style:{},remove(){}};}
  };
  const root={
    document,
    location:{hostname:'example.test',pathname:'/'},
    sessionStorage:{length:0,getItem(){return null;},key(){return null;}},
    setTimeout(){return 1;},
    clearTimeout(){},
    addEventListener(){},
    fetch:async()=>({ok:true,json:async()=>({})})
  };
  if(interactive)root.setView=()=>{};
  vm.runInNewContext(recoverySource,{window:root,AbortController});
  return root.ExportHUBRC1067StartupRecovery;
}

test('RC1540: Live-waitReady wartet bis der bekannte Startup-Ladezustand beendet ist',()=>{
  const start=helper.indexOf('export async function waitReady(page)');
  const end=helper.indexOf('function responsiveViewport',start);
  assert.ok(start>=0&&end>start,'waitReady-Block fehlt');
  const block=helper.slice(start,end);
  assert.match(block,/process\.env\.EXPORTHUB_E2E_LIVE==='1'/);
  assert.match(block,/ExportHUBRC1067StartupRecovery/,'kanonische Startup-Ladeerkennung wird nicht verwendet');
  assert.match(block,/typeof recovery\.isBroken==='function'/,'Live-Gate muss die Recovery-Zustandsbewertung verwenden');
});

test('RC1541: echter 11-Prozent-Startup bleibt gebrochen',()=>{
  const recovery=recoveryRuntime({
    text:'ExportHUB wird geladen · 11 %',
    view:'',
    interactive:false
  });
  assert.equal(typeof recovery.isBroken,'function');
  assert.equal(recovery.isBroken(),true);
});

test('RC1541: bedienbare Runtime ist trotz stale Startup-Text nicht gebrochen',()=>{
  const recovery=recoveryRuntime({
    text:'Dashboard · Sendungsübersicht · ExportHUB wird geladen · 11 %',
    view:'dashboard',
    interactive:true
  });
  assert.equal(typeof recovery.isBroken,'function');
  assert.equal(recovery.loading(),true,'Fixture muss den stale Ladehinweis wirklich erkennen');
  assert.equal(recovery.isBroken(),false);
});