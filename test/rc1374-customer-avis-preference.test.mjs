import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const RUNTIME=fs.readFileSync('assets/rc1092-customer-mail-contacts.js','utf8');
const DE=JSON.parse(fs.readFileSync('assets/i18n/de.json','utf8'));

function load(customers,selectedId){
  const state={view:'shipment',customers,currentCustomerId:selectedId||'',selectedCustomerId:selectedId||''};
  const saves=[],events=[];
  const document={
    readyState:'complete',
    documentElement:{},
    getElementById(){return null},
    querySelector(){return null},
    querySelectorAll(){return[]},
    addEventListener(){}
  };
  const window={
    document,
    __EXPORTHUB_GET_STATE__:()=>state,
    ExportHUBClean:{
      state,
      queueSave(reason){saves.push(['queue',reason]);return true},
      flushSave(reason,opt){saves.push(['flush',reason,opt]);return Promise.resolve(true)}
    },
    setTimeout(fn){fn();return 1},
    addEventListener(){},
    dispatchEvent(event){events.push(event);return true},
    console
  };
  const context=vm.createContext({
    window,document,console,Date,JSON,Array,Object,String,Number,Promise,RegExp,
    CustomEvent:function CustomEvent(type,opt){this.type=type;this.detail=opt&&opt.detail}
  });
  vm.runInContext(RUNTIME,context,{filename:'assets/rc1092-customer-mail-contacts.js'});
  return{api:window.ExportHUBCustomerAvisPreference1374,contacts:window.ExportHUBRC1092CustomerContacts,state,saves,events};
}

test('RC1374: Kundenordner enthält die selbst steuerbare AVIS-Auswahl',()=>{
  assert.match(RUNTIME,/data-rc1374-avis-preference-select/);
  assert.match(RUNTIME,/customerAvisPreference\.label/);
  assert.match(RUNTIME,/customerAvisLinkEnabled/);
  assert.equal(DE['customerAvisPreference.label'],'AVIS-Link erwünscht');
  assert.equal(DE['customerAvisPreference.yes'],'Ja');
  assert.equal(DE['customerAvisPreference.no'],'Nein');
});

test('RC1374: bekannte Nein-Kunden starten sicher ohne AVIS, normale Kunden mit Ja',()=>{
  const customers=[
    {id:'3019100629',name:'Adolf Würth GmbH & Co. KG'},
    {id:'VZ',name:'V-Zug',customerEmail:'v-zug@lebert.com'},
    {id:'N1',name:'Normaler Kunde'}
  ];
  const {api}=load(customers,'N1');
  assert.ok(api&&api.version==='RC1374');
  assert.equal(api.forShipment({customerId:'3019100629',customerName:'Adolf Würth GmbH & Co. KG'}).allowed,false);
  assert.equal(api.forShipment({customerId:'VZ',customerName:'V-Zug'}).allowed,false);
  assert.equal(api.forShipment({customerId:'N1',customerName:'Normaler Kunde'}).allowed,true);
});

test('RC1374: explizites Ja oder Nein im Kundenordner überschreibt den Standard',()=>{
  const customers=[
    {id:'3019100629',name:'Adolf Würth GmbH & Co. KG',customerAvisLinkEnabled:true},
    {id:'N1',name:'Normaler Kunde',customerAvisLinkEnabled:false}
  ];
  const {api}=load(customers,'3019100629');
  assert.equal(api.forShipment({customerId:'3019100629',customerName:'Adolf Würth GmbH & Co. KG'}).allowed,true);
  assert.equal(api.forShipment({customerId:'N1',customerName:'Normaler Kunde'}).allowed,false);
});

test('RC1374: Änderung wird bestätigt gespeichert und als Ereignis veröffentlicht',async()=>{
  const customer={id:'3019100629',name:'Adolf Würth GmbH & Co. KG'};
  const env=load([customer],'3019100629');
  assert.equal(env.api.allowed(customer),false);
  assert.equal(await env.api.set(true),true);
  assert.equal(customer.customerAvisLinkEnabled,true);
  assert.equal(customer.avisLinkEnabled,true);
  assert.equal(env.api.allowed(customer),true);
  assert.equal(env.saves.filter(x=>x[0]==='flush').length,1);
  assert.ok(env.events.some(e=>e.type==='exporthub:customer-avis-preference-updated'&&e.detail&&e.detail.enabled===true));
});

test('RC1374: alle vier geänderten Browser-Runtimes erhalten einen neuen Cache-Key',()=>{
  const rc1013=fs.readFileSync('.github/rc1013/build-three-env.mjs','utf8');
  const rc1018=fs.readFileSync('.github/rc1018/fix-mail-wording.mjs','utf8');
  const rc1048=fs.readFileSync('.github/rc1048/build-three-env.mjs','utf8');
  const rc1112=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
  const deploy=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');
  assert.match(rc1013,/rc1015-lieferavis-mail-flow\.js\?v=1374/);
  assert.match(rc1018,/rc1027-lieferavis-immediate\.js\?v=1374/);
  assert.match(rc1048,/rc1092-customer-mail-contacts\.js\?v=1374/);
  assert.match(rc1112,/rc1166-avis-reminder-overview\.js\?v=1374/);
  assert.match(deploy,/rc1015-lieferavis-mail-flow\.js\?v=1374/);
  assert.match(deploy,/rc1027-lieferavis-immediate\.js\?v=1374/);
  assert.match(deploy,/rc1092-customer-mail-contacts\.js\?v=1374/);
});
