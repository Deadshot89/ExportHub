import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const shipmentSource=fs.readFileSync('assets/rc1071-shipment-history.js','utf8');
const auditSource=fs.readFileSync('assets/rc1081-audit-history.js','utf8');
const de=JSON.parse(fs.readFileSync('assets/i18n/de.json','utf8'));

function runtime(){
  const shipment={id:'S1',ref:'ABC123',shipmentHistory:[
    {id:'ST',at:'2026-10-19T10:00:00.000Z',type:'status',label:'Status geändert',actor:{name:'Sabine Müller'},details:{from:'Vorbereitet',to:'Abgeholt',reference:'ABC123'}},
    {id:'MAIL',at:'2026-10-18T09:00:00.000Z',type:'mail-sent',label:'Versandanmeldung versendet',actor:{name:'Tobias'},details:{mailType:'Versandanmeldung',to:'dispo@example.invalid'}}
  ]};
  const task={id:'M848:fr-z-mini:2026-W43',title:'MiniBag report',assignee:'Tobias',status:'offen',createdAt:'2026-10-17T08:00:00.000Z'};
  const state={view:'dashboard',shipments:[shipment],savedShipments:[],customers:[],tasks:[task],palletAccount:[],auditLog:[],currentUser:{id:'U1',name:'Tobias'}};
  const document={body:null,readyState:'loading',addEventListener(){},getElementById(){return null},querySelector(){return null}};
  const i18n={language(){return'de'},t(key,vars){let v=de[key]||key;if(vars)for(const [n,x] of Object.entries(vars))v=v.replaceAll('{{'+n+'}}',String(x));return v},formatDate(value,options){return new Intl.DateTimeFormat('de-DE',options||{}).format(value)}};
  const window={ExportHUBI18n:i18n,__EXPORTHUB_GET_STATE__:()=>state,addEventListener(){},document,console,setTimeout(){return 1},clearTimeout(){}};
  const context={window,document,console,Date,Intl,Math,Map,Set,WeakMap,Array,Object,String,Number,Promise,JSON,URL,RegExp,setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},MutationObserver:undefined};
  vm.runInNewContext(shipmentSource,context);
  vm.runInNewContext(auditSource,context);
  return window.ExportHUBRC1081AuditHistory;
}
const ids=(api,query)=>[...api.events().filter(e=>api.matches(e,query)).map(e=>e.id)].sort();

test('Historie-Suche: Feldnamen aus den Rohdaten erzeugen keine Scheintreffer',()=>{
  const api=runtime();
  // "mailType" ist ein JSON-Schlüssel der Mail-Details, aber kein sichtbarer Wert
  assert.deepEqual(ids(api,'mailType'),[]);
});

test('Historie-Suche: mehrere Wörter werden unabhängig von der Reihenfolge gefunden',()=>{
  const api=runtime();
  assert.deepEqual(ids(api,'abgeholt sabine'),['ST']);
  assert.deepEqual(ids(api,'versandanmeldung tobias'),['MAIL']);
});

test('Historie-Suche: Umlaute und ae/oe/ue-Schreibweise finden denselben Eintrag',()=>{
  const api=runtime();
  assert.deepEqual(ids(api,'Müller'),['ST']);
  assert.deepEqual(ids(api,'mueller'),['ST']);
});

test('Historie-Suche: Datum mit vierstelligem Jahr und ISO-Datum',()=>{
  const api=runtime();
  assert.ok(ids(api,'19.10.2026').includes('ST'));
  assert.ok(ids(api,'2026-10-18').includes('MAIL'));
});

test('Historie-Details: technische IDs werden markiert und Aktionen eingeordnet',()=>{
  const api=runtime();
  const taskEvent=api.events().find(e=>e.type==='task');
  const parts=api.detailParts(taskEvent);
  assert.ok(parts.some(p=>p.key==='task'&&p.technical));
  assert.equal(api.actionKind(taskEvent),'create');
  assert.equal(api.actionKind(api.events().find(e=>e.id==='ST')),'change');
});

test('Historie-Suche: Eingabe baut nur die Trefferliste neu auf und behält den Fokus',()=>{
  assert.match(auditSource,/SEARCH_TIMER=w\.setTimeout\(updateResults,120\)/);
  assert.match(auditSource,/function restoreFocus\(root,snap\)/);
  assert.doesNotMatch(auditSource,/addEventListener\('input',function\(\)\{FILTER\.query=this\.value;render\(\)\}\)/);
});
