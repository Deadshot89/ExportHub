import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const helper=fs.readFileSync('e2e/helpers/exporthub-browser.mjs','utf8');
const recoverySource=fs.readFileSync('assets/rc1067-startup-recovery.js','utf8');

function recoveryRuntime({view='',text='',interactive=false,adminSession=false,inlinePayloadCount=0}={}){
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
  const sessionValue=adminSession?JSON.stringify({token:'rc1541-test-token',user:{role:'admin'}}):null;
  const redirects=[];
  const root={
    document,
    location:{
      hostname:'example.test',
      pathname:'/',
      replace(url){redirects.push(url);}
    },
    sessionStorage:{
      length:adminSession?1:0,
      getItem(key){return key==='exporthub_rc301_tab_session'?sessionValue:null;},
      key(index){return adminSession&&index===0?'exporthub_rc301_tab_session':null;}
    },
    setTimeout(){return 1;},
    clearTimeout(){},
    addEventListener(){},
    fetch:async()=>({
      ok:true,
      json:async()=>({stateDiagnostics:{inlinePayloadCount}})
    })
  };
  if(interactive)root.setView=()=>{};
  vm.runInNewContext(recoverySource,{window:root,AbortController});
  return {recovery:root.ExportHUBRC1067StartupRecovery,root,redirects};
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
  const {recovery}=recoveryRuntime({
    text:'ExportHUB wird geladen · 11 %',
    view:'',
    interactive:false
  });
  assert.equal(typeof recovery.isBroken,'function');
  assert.equal(recovery.isBroken(),true);
});

test('RC1541: bedienbare Runtime ist trotz stale Startup-Text nicht gebrochen',()=>{
  const {recovery}=recoveryRuntime({
    text:'Dashboard · Sendungsübersicht · ExportHUB wird geladen · 11 %',
    view:'dashboard',
    interactive:true
  });
  assert.equal(typeof recovery.isBroken,'function');
  assert.equal(recovery.loading(),true,'Fixture muss den stale Ladehinweis wirklich erkennen');
  assert.equal(recovery.isBroken(),false);
});

test('RC1541: Recovery-Check leitet benutzbare Runtime mit stale Ladehinweis nicht um',async()=>{
  const {recovery,redirects}=recoveryRuntime({
    text:'Dashboard · Sendungsübersicht · ExportHUB wird geladen · 11 %',
    view:'dashboard',
    interactive:true,
    adminSession:true,
    inlinePayloadCount:3
  });
  assert.equal(recovery.isBroken(),false);
  await recovery.check();
  assert.deepEqual(redirects,[],'benutzbare Runtime darf nicht zur Migration-Recovery umgeleitet werden');
});

test('RC1541: Recovery-Check leitet echten gebrochenen Startup weiterhin um',async()=>{
  const {recovery,redirects}=recoveryRuntime({
    text:'ExportHUB wird geladen · 11 %',
    view:'',
    interactive:false,
    adminSession:true,
    inlinePayloadCount:3
  });
  assert.equal(recovery.isBroken(),true);
  await recovery.check();
  assert.equal(redirects.length,1,'echter gebrochener Startup muss weiterhin die Recovery starten');
  assert.match(redirects[0],/^\/migration-recovery\.html\?/);
});