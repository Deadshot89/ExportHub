import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {isExportHubLiveReady} from '../e2e/helpers/exporthub-browser.mjs';

const helper=fs.readFileSync('e2e/helpers/exporthub-browser.mjs','utf8');

function runtimeContext({loading=false,view='',text='',interactive=false,marker=false}={}){
  const attrs={'data-exporthub-view':view};
  const content={innerText:text,textContent:text};
  const body={
    innerText:text,
    textContent:text,
    getAttribute(name){return attrs[name]||'';}
  };
  const document={
    body,
    getElementById(id){return id==='content'?content:null;},
    querySelector(){return interactive?{}:null;}
  };
  const root={
    document,
    __EXPORTHUB_READY__:marker?{ready:true}:undefined,
    ExportHUBRC1067StartupRecovery:{loading(){return loading;}}
  };
  if(interactive)root.setView=()=>{};
  return {root,document};
}

test('RC1540: Live-waitReady wartet bis der bekannte Startup-Ladezustand beendet ist',()=>{
  const start=helper.indexOf('export async function waitReady(page)');
  const end=helper.indexOf('function responsiveViewport',start);
  assert.ok(start>=0&&end>start,'waitReady-Block fehlt');
  const block=helper.slice(start,end);
  assert.match(block,/process\.env\.EXPORTHUB_E2E_LIVE==='1'/);
  assert.match(block,/ExportHUBRC1067StartupRecovery|isExportHubLiveReady/,'kanonische Startup-Ladeerkennung wird nicht verwendet');
});

test('RC1541: echter frueher Startup-Zustand bleibt NICHT READY',()=>{
  const ctx=runtimeContext({
    loading:true,
    text:'ExportHUB wird geladen · 11 %',
    view:'',
    interactive:false,
    marker:false
  });
  assert.equal(isExportHubLiveReady(ctx),false);
});

test('RC1541: bedienbare Runtime ist trotz stale Startup-Text READY',()=>{
  const ctx=runtimeContext({
    loading:true,
    text:'Dashboard · Sendungsübersicht · ExportHUB wird geladen · 11 %',
    view:'dashboard',
    interactive:true,
    marker:false
  });
  assert.equal(isExportHubLiveReady(ctx),true);
});

test('RC1541: Ready-Marker ohne benutzbare Runtime ueberstimmt aktiven Startup nicht',()=>{
  const ctx=runtimeContext({
    loading:true,
    text:'ExportHUB wird geladen · 11 %',
    view:'',
    interactive:false,
    marker:true
  });
  assert.equal(isExportHubLiveReady(ctx),false);
});