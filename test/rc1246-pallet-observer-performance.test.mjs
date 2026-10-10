import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

const source=fs.readFileSync('assets/rc1207-pallet-account-fix.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

function observerHarness(){
  const timers=[];
  let seq=0,observerCallback=null;
  const host={id:'content',nodeType:1};
  const document={
    readyState:'complete',
    addEventListener(){},
    getElementById(id){return id==='content'?host:null},
    querySelector(){return null},
    querySelectorAll(){return[]},
    createElement(){return{setAttribute(){},addEventListener(){},remove(){},classList:{toggle(){}}}},
    body:{nodeType:1}
  };
  class MutationObserver{
    constructor(callback){observerCallback=callback}
    observe(){}
    disconnect(){}
  }
  const state={view:'pallet',palletAccount:[]};
  const sandbox={
    document,
    MutationObserver,
    location:{hostname:'example.test',pathname:'/'},
    setTimeout(fn,ms=0){const row={id:++seq,fn,ms,cleared:false,ran:false};timers.push(row);return row.id},
    clearTimeout(id){const row=timers.find(x=>x.id===id);if(row)row.cleared=true},
    addEventListener(){},
    __EXPORTHUB_GET_STATE__(){return state},
    canAdmin(){return false},
    console:{error(){}}
  };
  sandbox.globalThis=sandbox;
  vm.runInNewContext(source,sandbox,{filename:'rc1207-pallet-account-fix.js'});
  function flushZero(){
    let row;
    while((row=timers.find(x=>!x.cleared&&!x.ran&&x.ms===0))){row.ran=true;row.fn()}
  }
  function pendingZero(){return timers.filter(x=>!x.cleared&&!x.ran&&x.ms===0).length}
  flushZero();
  return{host,pendingZero,callback(records){assert.equal(typeof observerCallback,'function');observerCallback(records)}};
}

test('RC1246: Palettenkonto-Ansicht wird über State oder echte Paletten-DOM-Elemente erkannt',()=>{
  assert.match(source,/function palletViewActive\(\)/);
  assert.match(source,/if\(view==='pallet'\)return true/);
  assert.match(source,/\.rc542-table,#rc542PalIn,#rc542PalOut,\[data-exporthub-rendered-view="pallet"\]/);
});

test('RC1246: Scheduler startet außerhalb des Palettenkontos keinen Tabellen-Scan-Timer',()=>{
  const start=source.indexOf('function scheduleEnhance(){');
  const end=source.indexOf('async function cleanupProductionDayOnce',start);
  assert.ok(start>=0&&end>start,'scheduleEnhance Block fehlt');
  const block=source.slice(start,end);
  assert.match(block,/installBookingGuard\(\)/);
  assert.match(block,/if\(!palletViewActive\(\)\)\{disconnectObserver\(\);return false\}/);
  assert.ok(block.indexOf('!palletViewActive()')<block.indexOf('setTimeout'),'View-Guard muss vor Timer liegen');
});

test('RC1418: MutationObserver ist nur lokal in aktiver Palettenansicht gebunden',()=>{
  assert.match(source,/function syncObserver\(\)/);
  assert.match(source,/observer\.observe\(host,\{childList:true,subtree:true\}\)/);
  assert.match(source,/if\(!palletViewActive\(\)\)\{disconnectObserver\(\);return false\}/);
  assert.doesNotMatch(source,/observe\(root\.document\.(?:body|documentElement)/);
});

test('RC1481: fachfremde Mutation im Paletten-Host startet keinen neuen Tabellen-Enhance-Scan',()=>{
  const h=observerHarness(),before=h.pendingZero();
  const unrelated={nodeType:1,matches(){return false},querySelector(){return null},closest(){return null}};
  h.callback([{type:'childList',target:h.host,addedNodes:[unrelated],removedNodes:[]}]);
  assert.equal(h.pendingZero()-before,0,'unrelated pallet-view DOM churn must not schedule enhanceAdminDeleteButtons');
});

test('RC1481: neue Tabellenzeile bleibt für den Paletten-Observer relevant',()=>{
  const h=observerHarness(),before=h.pendingZero();
  const table={nodeType:1,className:'rc542-table'};
  const target={nodeType:1,closest(selector){return selector.includes('.rc542-table')?table:null}};
  const row={nodeType:1,matches(selector){return /tbody|tr/.test(selector)},querySelector(){return null},closest(){return target}};
  h.callback([{type:'childList',target,addedNodes:[row],removedNodes:[]}]);
  assert.equal(h.pendingZero()-before,1,'new pallet rows must still schedule delete-button enhancement');
});

test('RC1481: eigener RC1207-Löschbutton löst keinen Observer-Selbsttrigger aus',()=>{
  const h=observerHarness(),before=h.pendingZero();
  const table={nodeType:1,className:'rc542-table'};
  const target={nodeType:1,closest(selector){return selector.includes('.rc542-table')?table:null}};
  const ownButton={nodeType:1,matches(selector){return selector.includes('[data-rc1207-delete-pallet]')},querySelector(){return null},closest(){return target}};
  h.callback([{type:'childList',target,addedNodes:[ownButton],removedNodes:[]}]);
  assert.equal(h.pendingZero()-before,0,'RC1207 must not reschedule itself after inserting its own delete button');
});

test('RC1246: Buchungs- und Admin-Funktionen bleiben erhalten',()=>{
  assert.match(source,/function installBookingGuard\(\)/);
  assert.match(source,/function syncDirectionUi\(\)/);
  assert.match(source,/function enhanceAdminDeleteButtons\(\)/);
  assert.match(source,/function deletePalletBooking\(id,options\)/);
  assert.match(source,/version:'RC1246'/);
});

test('RC1246: neue Runtime wird mit frischem Cache-Key ausgeliefert',()=>{
  assert.match(build,/assets\/rc1207-pallet-account-fix\.js\?v=1418/);
  assert.doesNotMatch(build,/assets\/rc1207-pallet-account-fix\.js\?v=1207/);
});

test('RC1246: Runtime bleibt syntaktisch gültig',()=>{
  execFileSync(process.execPath,['--check','assets/rc1207-pallet-account-fix.js'],{stdio:'pipe'});
});
