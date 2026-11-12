import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {injectPackAbdOwnership} from '../.github/packmeldungen/build-three-env.mjs';

const original=fs.readFileSync('TESTVERSION.html','utf8');
const patched=injectPackAbdOwnership(original,'TESTVERSION.html');
const match=patched.match(/<script id="rc626-shipping-inspections-abd-controller"[^>]*>([\s\S]*?)<\/script>/);
assert.ok(match,'real lazy ABD editor must be present');
const testedLegacy=match[1].replace(
  'window.ExportHUBRC626=Object.freeze(',
  'window.__RC1382_TEST__={saveAbdInternal:saveAbdInternal};window.ExportHUBRC626=Object.freeze('
);

function setup(options={}){
  const state={
    customers:[],
    shipments:[{id:'SHIP-OTHER',ref:'Z9Z9Z9',customerName:'Foreign shipment'}],
    packNotifications:[{id:'PN-1',reference:'PACK-01',status:'in_review',customer:'Acme',
      customerAccount:'10001',packageCount:1,totalWeight:5}],
    abdRequests:[],
    abdDraft:{
      source:'manual',ref:'A1B2C3',language:'de',customerName:'Acme',customerNumber:'10001',
      packNotificationId:'PN-1',packNotificationRef:'PACK-01',linkedShipmentId:'',
      rows:[{id:'PACK-R1',type:'Karton',count:'1',weight:'5'}],deliveryNotes:'DNC1234567',
      invoiceFiles:[],abdFiles:[],country:'',status:'Entwurf'
    }
  };
  const alerts=[],writes=[],location={href:''},actions={};
  const clean={
    queueSave(reason){writes.push('queue:'+reason);return Promise.resolve(true)},
    flushSave(reason){writes.push('flush:'+reason);return Promise.resolve(options.saveOk!==false)}
  };
  const document={
    readyState:'loading',body:null,
    addEventListener(){},querySelector(){return null},querySelectorAll(){return []},
    getElementById(){return null}
  };
  const root={
    document,location,ExportHUBClean:clean,
    __EXPORTHUB_GET_STATE__:()=>state,
    addEventListener(){},setTimeout(){return 1},MutationObserver:undefined,
    alert(message){alerts.push(String(message))},
    __EXPORTHUB_TEST_NO_MAILTO__:options.preventMail===true
  };
  const context=vm.createContext({window:root,globalThis:root,document,console,Date,Math,
    Intl,structuredClone,Promise,Number,String,Array,Object,Error,setTimeout:()=>1});
  vm.runInContext(fs.readFileSync('assets/i18n/pack-notification.js','utf8'),context);
  vm.runInContext(fs.readFileSync('assets/pack-notification-abd.js','utf8'),context);
  vm.runInContext(testedLegacy,context);
  return {state,alerts,writes,location,root,actions,save:root.__RC1382_TEST__.saveAbdInternal};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('real legacy Pack ABD save stores ownership but does not attach to any shipment',async()=>{
  const ctx=setup();
  const result=ctx.save(false);
  assert.ok(result);
  assert.equal(result.packNotificationId,'PN-1');
  assert.equal(result.packNotificationRef,'PACK-01');
  assert.equal(result.linkedShipmentId,'');
  assert.equal(ctx.state.packNotifications[0].abdRequestId,undefined,'only ABD collection is modified, Pack tasks stay unchanged');
  assert.equal(ctx.state.shipments[0].abdRequestId,undefined);
  assert.equal(ctx.alerts.length,0,'no success alert before Azure ack');
  await tick();
  assert.equal(ctx.root.ExportHUBPackAbd.saveStatusText(),ctx.root.ExportHUBPackI18n.t('pack.internal.abdSaved'));
  assert.ok(ctx.writes.some(x=>x.startsWith('flush:')));
  assert.equal(ctx.state.abdRequests.length,1);
});

test('Pack ABD save never claims success if Azure flush fails; retries reuse same ID',async()=>{
  const ctx=setup({saveOk:false});
  const item=ctx.save(true);
  assert.ok(item);
  await tick();
  assert.equal(ctx.root.ExportHUBPackAbd.saveStatusText(),ctx.root.ExportHUBPackI18n.t('pack.internal.abdSaveUnconfirmed'));
  assert.ok(ctx.alerts.some(x=>x.includes('nicht bestätigt')));
  assert.ok(ctx.alerts.every(x=>!x.includes('wurde gespeichert')));
  assert.equal(ctx.state.abdRequests.length,1);
  assert.equal(ctx.save(false).id,item.id,'retry must not generate a second ABD');
  await tick();
  assert.equal(ctx.state.abdRequests.length,1);
});

test('Pack ABD opens Outlook only after verified save and never on unconfirmed save',async()=>{
  const ok=setup();
  let release;
  ok.root.ExportHUBClean.flushSave=()=>new Promise(resolve=>{release=resolve});
  const a=ok.save(false,'Angefragt');
  assert.ok(a);
  assert.equal(ok.location.href,'');
  await tick();
  assert.equal(ok.location.href,'');
  assert.equal(ok.root.ExportHUBPackAbd.saveStatusText(),ok.root.ExportHUBPackI18n.t('pack.internal.abdSaving'));
  release(true);
  await tick();
  assert.match(ok.location.href,/^mailto:/);
  assert.match(ok.location.href,/subject=/);
  const failed=setup({saveOk:false});
  failed.save(false,'Angefragt');
  await tick();
  assert.equal(failed.location.href,'','no mail on unconfirmed Azure persistence');
});

test('Pack ABD rejects a REF belonging to an existing shipment, without modifying shipment',async()=>{
  const ctx=setup();
  ctx.state.shipments[0].ref='A1B2C3';
  assert.equal(ctx.save(false),null);
  assert.equal(ctx.state.abdRequests.length,0);
  assert.equal(ctx.state.packNotifications[0].abdRequestId,undefined);
  assert.equal(ctx.state.shipments[0].abdRequestId,undefined);
});

test('foreign Pack ownership and cancelled Pack records reject saves before modifying state',async()=>{
  for(const mode of ['foreign','cancelled']){
    const ctx=setup();
    if(mode==='foreign')ctx.state.abdDraft.packNotificationRef='PACK-OTHER';
    else ctx.state.packNotifications[0].status='cancelled';
    assert.equal(ctx.save(false),null);
    assert.equal(ctx.state.abdRequests.length,0);
    assert.equal(ctx.state.shipments[0].abdRequestId,undefined);
  }
});


test('RC2004: stale server ACK never marks Pack ABD saved or opens Outlook',async()=>{
  const ctx=setup();
  ctx.root.ExportHUBClean.runtime={
    changeGeneration:3,lastSavedGeneration:3,lastServerSaveAckGeneration:1
  };
  const item=ctx.save(false,'Angefragt');
  assert.ok(item);
  await tick();
  assert.equal(ctx.root.ExportHUBPackAbd.saveStatusText(),ctx.root.ExportHUBPackI18n.t('pack.internal.abdSaveUnconfirmed'));
  assert.equal(ctx.location.href,'','A stale server ACK must never trigger the mail application');
  assert.ok(ctx.alerts.some(x=>x.includes('nicht bestätigt')));
  assert.equal(ctx.state.abdRequests.length,1,'Unconfirmed drafts retain their ID for safe retry');
});

test('RC2004: matching server ACK confirms Pack ABD and only then opens Outlook',async()=>{
  const ctx=setup();
  ctx.root.ExportHUBClean.runtime={
    changeGeneration:3,lastSavedGeneration:3,lastServerSaveAckGeneration:3
  };
  assert.ok(ctx.save(false,'Angefragt'));
  await tick();
  assert.equal(ctx.root.ExportHUBPackAbd.saveStatusText(),ctx.root.ExportHUBPackI18n.t('pack.internal.abdSaved'));
  assert.match(ctx.location.href,/^mailto:/);
});

test('RC2004: locally saved generation never overrides a failed flush without server ACK',async()=>{
  const ctx=setup({saveOk:false});
  ctx.root.ExportHUBClean.runtime={changeGeneration:3,lastSavedGeneration:3};
  assert.ok(ctx.save(false,'Angefragt'));
  await tick();
  assert.equal(ctx.root.ExportHUBPackAbd.saveStatusText(),ctx.root.ExportHUBPackI18n.t('pack.internal.abdSaveUnconfirmed'));
  assert.equal(ctx.location.href,'');
});


function createReadbackScenario(options={}){
  const ctx=setup();
  ctx.root.__EXPORTHUB_DATA_ENVIRONMENT__='testservice';
  ctx.root.ExportHUBClean.runtime={
    authToken:options.authToken===undefined?'SYNTHETIC-TEST-TOKEN':options.authToken,
    dataEnvironment:'testservice',
    changeGeneration:3,lastSavedGeneration:3,lastServerSaveAckGeneration:1
  };
  const calls=[];
  ctx.root.fetch=async(url,request)=>{
    calls.push({url,request});
    if(options.networkError)throw new Error('SYNTHETIC_NETWORK_FAILURE');
    const body=typeof options.body==='function'?options.body(ctx):options.body;
    return{status:options.httpStatus||200,ok:options.httpStatus===undefined||options.httpStatus===200,
      json:async()=>body||{ok:true,environment:'testservice',state:structuredClone(ctx.state)}};
  };
  return{...ctx,calls};
}

test('RC1499: stale generation ACK needs independent same-origin Azure readback for exact Pack ABD',async()=>{
  const ctx=createReadbackScenario();
  const item=ctx.save(false,'Angefragt');
  assert.ok(item);
  await tick();
  assert.equal(ctx.root.ExportHUBPackAbd.saveStatusText(),
    ctx.root.ExportHUBPackI18n.t('pack.internal.abdSaved'));
  assert.equal(ctx.calls.length,1);
  assert.equal(ctx.calls[0].url,'/api/exporthub-state?mode=read&full=1');
  assert.equal(ctx.calls[0].request.method,'GET');
  assert.equal(ctx.calls[0].request.cache,'no-store');
  assert.equal(ctx.calls[0].request.credentials,'same-origin');
  assert.equal(ctx.calls[0].request.headers['X-ExportHUB-Environment'],'testservice');
  assert.equal(ctx.calls[0].request.headers.Authorization,'Bearer SYNTHETIC-TEST-TOKEN');
  assert.match(ctx.location.href,/^mailto:/);
});

test('RC1499: readback refuses wrong environment, ownership, REF, rows, status or server errors',async()=>{
  const mismatches=[
    {name:'wrong-environment',body:ctx=>({ok:true,environment:'production',state:structuredClone(ctx.state)})},
    {name:'wrong-ownership',body:ctx=>{const state=structuredClone(ctx.state);state.abdRequests[0].packNotificationId='OTHER';return{ok:true,environment:'testservice',state};}},
    {name:'wrong-ref',body:ctx=>{const state=structuredClone(ctx.state);state.abdRequests[0].ref='WRONG';return{ok:true,environment:'testservice',state};}},
    {name:'wrong-rows',body:ctx=>{const state=structuredClone(ctx.state);state.abdRequests[0].rows[0].weight='999';return{ok:true,environment:'testservice',state};}},
    {name:'wrong-status',body:ctx=>{const state=structuredClone(ctx.state);state.abdRequests[0].status='OTHER';return{ok:true,environment:'testservice',state};}},
    {name:'duplicate-owner',body:ctx=>{const state=structuredClone(ctx.state);state.abdRequests.push(structuredClone(state.abdRequests[0]));return{ok:true,environment:'testservice',state};}},
    {name:'http-503',httpStatus:503},
    {name:'network-error',networkError:true}
  ];
  for(const scenario of mismatches){
    const ctx=createReadbackScenario(scenario);
    const item=ctx.save(false,'Angefragt');
    assert.ok(item,scenario.name);
    await tick();
    assert.equal(ctx.root.ExportHUBPackAbd.saveStatusText(),
      ctx.root.ExportHUBPackI18n.t('pack.internal.abdSaveUnconfirmed'),scenario.name);
    assert.equal(ctx.location.href,'',scenario.name+' must not open Outlook');
    assert.equal(ctx.state.abdRequests.length,1,scenario.name+' must preserve draft for retry');
  }
});

test('RC1499: no authenticated token never substitutes local data or a forged server response',async()=>{
  const ctx=createReadbackScenario({authToken:''});
  assert.ok(ctx.save(false,'Angefragt'));
  await tick();
  assert.equal(ctx.calls.length,0,'No network read without session token');
  assert.equal(ctx.root.ExportHUBPackAbd.saveStatusText(),
    ctx.root.ExportHUBPackI18n.t('pack.internal.abdSaveUnconfirmed'));
  assert.equal(ctx.location.href,'');
});

test('RC1499: matching generation ACK does not incur an unnecessary full Azure state read',async()=>{
  const ctx=createReadbackScenario();
  ctx.root.ExportHUBClean.runtime.lastServerSaveAckGeneration=3;
  assert.ok(ctx.save(false,'Angefragt'));
  await tick();
  assert.equal(ctx.calls.length,0);
  assert.equal(ctx.root.ExportHUBPackAbd.saveStatusText(),
    ctx.root.ExportHUBPackI18n.t('pack.internal.abdSaved'));
});
