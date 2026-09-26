import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const shipmentSource=fs.readFileSync('assets/rc1071-shipment-history.js','utf8');
const auditSource=fs.readFileSync('assets/rc1081-audit-history.js','utf8');
const de=JSON.parse(fs.readFileSync('assets/i18n/de.json','utf8'));
const en=JSON.parse(fs.readFileSync('assets/i18n/en.json','utf8'));

function runtime(){
  let language='de';
  const shipment={
    id:'S1',ref:'ABC123',
    shipmentHistory:[
      {id:'OPEN',at:'2026-09-26T19:00:00.000Z',type:'document-open',label:'ABD – geöffnet',actor:{name:'Tobias'},details:{document:'ABD',fileName:'ABD_ABC123.pdf'}},
      {id:'PRINT',at:'2026-09-26T19:01:00.000Z',type:'print',label:'CMR – gedruckt',actor:{name:'Tobias'},details:{document:'CMR',fileName:'CMR_ABC123.pdf'}},
      {id:'MAIL',at:'2026-09-26T19:02:00.000Z',type:'mail-sent',label:'Versandanmeldung versendet',actor:{name:'Tobias'},details:{mailType:'Versandanmeldung',to:'e2e@example.invalid'}}
    ]
  };
  const state={view:'dashboard',currentShipment:shipment,shipments:[shipment],savedShipments:[],customers:[],tasks:[],palletAccount:[],auditLog:[],currentUser:{id:'U1',name:'Tobias'}};
  const document={body:null,readyState:'loading',addEventListener(){},getElementById(){return null},querySelector(){return null}};
  const i18n={
    language(){return language},
    t(key,vars,forcedLanguage){
      const lang=forcedLanguage||language;
      const dict=lang==='en'?en:de;
      let value=dict[key]||key;
      if(vars)for(const [name,v] of Object.entries(vars))value=value.replaceAll('{{'+name+'}}',String(v));
      return value;
    },
    formatDate(value,options){return new Intl.DateTimeFormat(language==='en'?'en-GB':'de-DE',options||{}).format(value)}
  };
  const window={
    ExportHUBI18n:i18n,
    __EXPORTHUB_GET_STATE__:()=>state,
    __EXPORTHUB_GET_CURRENT_USER__:()=>state.currentUser,
    ExportHUBClean:{state,queueSave(){return true},flushSave(){return Promise.resolve(true)}},
    addEventListener(){},document,console,setTimeout(){return 1}
  };
  const context={window,document,console,Date,Intl,Math,Map,Set,Array,Object,String,Number,Promise,JSON,URL,Blob,decodeURIComponent,
    setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},MutationObserver:undefined};
  vm.runInNewContext(shipmentSource,context,{filename:'rc1071-shipment-history.js'});
  vm.runInNewContext(auditSource,context,{filename:'rc1081-audit-history.js'});
  return{api:window.ExportHUBRC1081AuditHistory,setLanguage(value){language=value}};
}

test('RC1297 P0: globale History bewahrt konkrete Dokument- und Mailaktionen',()=>{
  const {api}=runtime();
  const labels=api.events().map(e=>api.actionTitle(e));
  assert.ok(labels.includes('ABD – geöffnet'));
  assert.ok(labels.includes('CMR – gedruckt'));
  assert.ok(labels.includes('Versandanmeldung versendet'));
  assert.equal(labels.includes('Dokument geöffnet'),false);
  assert.equal(labels.includes('Druck oder PDF-Ausgabe'),false);
});

test('RC1297 P0: globale History nutzt für konkrete Sendungsaktionen weiterhin die aktuelle Sprache',()=>{
  const {api,setLanguage}=runtime();
  setLanguage('en');
  const labels=api.events().map(e=>api.actionTitle(e));
  assert.ok(labels.includes('ABD – opened'));
  assert.ok(labels.includes('CMR – printed'));
  assert.ok(labels.includes('Shipping registration sent'));
});
