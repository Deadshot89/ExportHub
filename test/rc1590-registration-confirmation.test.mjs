import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=path=>fs.readFileSync(path,'utf8');
const de=JSON.parse(read('assets/i18n/de.json'));
function setup(options={}){
  const shipment={id:'SHIP-ESP',ref:'SPA019',customerId:'C-ES',
    customerName:'Essentra Spanien',shipmentHistory:[]};
  const state={view:'shipment',shipments:[shipment],savedShipments:[shipment],
    currentShipment:shipment,currentUser:{id:'T',name:'Tobias'},
    tasks:[{id:'managed:spanien:2026-10-19',managedBy:'RC1152',managedKey:'spanien',
      title:'Essentra Spanien anmelden',status:'open',
      occurrenceKey:'2026-10-19',dueAt:'2026-10-19',sourceType:'manual'}]};
  const calls=[],uiEvents=[],docListeners={};
  const document={readyState:'loading',body:null,
    addEventListener(name,fn){docListeners[name]=fn},
    getElementById(){return null},querySelector(){return null}};
  const root={console,Date,Intl,Math,Map,Set,Array,Object,String,Number,Promise,
    document,MutationObserver:undefined,
    setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},
    __EXPORTHUB_GET_STATE__:()=>state,__EXPORTHUB_GET_CURRENT_USER__:()=>state.currentUser,
    addEventListener(){},dispatchEvent(e){uiEvents.push(e)},
    CustomEvent:class{constructor(type,props){this.type=type;this.detail=props.detail}},
    ExportHUBI18n:{language(){return 'de'},t(key,vars){
      let value=de[key]||key;
      for(const [k,v] of Object.entries(vars||{}))value=value.replaceAll('{{'+k+'}}',String(v));
      return value;
    }},
    ExportHUBClean:{state,
      queueSave(reason){calls.push(['queue',reason]);return true},
      flushSave(reason){calls.push(['flush',reason]);return Promise.resolve(options.saveOk!==false)}
    }
  };
  root.window=root;root.globalThis=root;
  for(const path of ['assets/taskplanner-v2-core.js','assets/taskplanner-v2-workflow.js',
    'assets/rc1071-shipment-history.js'])
    vm.runInNewContext(read(path),root,{filename:path});
  const api=root.ExportHUBShipmentHistory1071;
  return {api,root,state,shipment,calls,uiEvents,docListeners};
}
function openedMail(api,shipment){
  return api.append(shipment,{type:'mail-sent',label:'Versandanmeldung versendet',
    details:{reference:shipment.ref,mailType:'Versandanmeldung',to:'sample@example.invalid'}},
    {persist:false});
}
test('RC1590: opening Outlook mail draft does not complete Spain task',()=>{
  const x=setup();openedMail(x.api,x.shipment);
  const task=x.state.tasks[0];
  assert.equal(task.status,'open');
  assert.equal(x.root.ExportHUBTaskWorkflowV2.shipmentRegisteredFromSave({detail:{
    azureSaved:true,shipment:x.shipment
  }}),null);
  assert.equal(x.api.events(x.shipment).some(x=>x.type==='registration-confirmed'),false);
});

test('RC1590: explicit confirmation commits history and task in one verified Azure save',async()=>{
  const x=setup();const opened=openedMail(x.api,x.shipment);
  assert.ok(opened.id);
  const success=await x.api.confirmRegistrationMail(x.shipment);
  assert.equal(success,true);
  assert.deepEqual(x.calls.map(c=>c[0]),['queue','flush']);
  assert.equal(x.state.tasks[0].status,'done');
  assert.equal(x.state.tasks[0].completionMode,'automatic');
  const confirmed=x.api.events(x.shipment).filter(e=>e.type==='registration-confirmed');
  assert.equal(confirmed.length,1);
  assert.equal(confirmed[0].details.emailHistoryId,opened.id);
  assert.equal(x.state.tasks[0].history.at(-1).eventId,'shipment.registered:SHIP-ESP:'+confirmed[0].id);
  assert.equal(x.uiEvents.filter(e=>e.type==='exporthub:tasks-updated').length,1);
  assert.equal(await x.api.confirmRegistrationMail(x.shipment),true);
  assert.equal(x.api.events(x.shipment).filter(e=>e.type==='registration-confirmed').length,1);
  assert.equal(x.calls.length,2);
});

test('RC1590: rejected Azure save restores task and removes unpersisted confirmation',async()=>{
  const x=setup({saveOk:false});const opened=openedMail(x.api,x.shipment);
  assert.equal(await x.api.confirmRegistrationMail(x.shipment),false);
  assert.equal(x.state.tasks[0].status,'open');
  assert.equal(x.api.events(x.shipment).filter(e=>e.type==='registration-confirmed').length,0);
  assert.equal(x.api.events(x.shipment).filter(e=>e.id===opened.id).length,1);
  assert.equal(x.uiEvents.filter(e=>e.type==='exporthub:tasks-updated').length,0);
  assert.deepEqual(x.calls.map(c=>c[0]),['queue','flush']);
});

test('RC1590: confirmation without opened registration mail cannot alter tasks',async()=>{
  const x=setup();
  assert.equal(await x.api.confirmRegistrationMail(x.shipment),false);
  assert.equal(x.state.tasks[0].status,'open');
  assert.equal(x.calls.length,0);
});

test('RC1590: click handler only responds to explicit user confirmation control',async()=>{
  const x=setup();openedMail(x.api,x.shipment);
  assert.equal(typeof x.docListeners.click,'function');
  let stopped=0;
  const control={matches:selector=>selector==='[data-rc1590-confirm-registration]',closest(){return this}};
  x.docListeners.click({target:control,preventDefault(){stopped++}});
  await Promise.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();
  assert.equal(stopped,1);
  assert.equal(x.calls.some(c=>c[0]==='queue'),true);
});

test('RC1590: translations are complete and identical across six language packs',()=>{
  for(const lang of ['de','en','pl','es','fr','it']){
    const rows=JSON.parse(read('assets/i18n/'+lang+'.json'));
    for(const key of ['shipmentHistory.action.registrationConfirmed','shipmentHistory.registration.help',
      'shipmentHistory.registration.confirmed','shipmentHistory.registration.confirmButton',
      'shipmentHistory.registration.saving','shipmentHistory.registration.success',
      'shipmentHistory.registration.noTask','shipmentHistory.registration.failed',
      'shipmentHistory.registration.storageUnavailable']){
      assert.equal(typeof rows[key],'string',lang+' missing '+key);
      assert.ok(rows[key].trim().length>0,lang+' empty '+key);
    }
  }
});