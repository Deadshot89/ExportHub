import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

const historySource=fs.readFileSync('assets/rc1081-audit-history.js','utf8');
const notesSource=fs.readFileSync('assets/rc1177-release-notes.js','utf8');
const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const deploy=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');

function historyApi(){
  const shipment={
    id:'S1',ref:'NKJK7S',
    shipmentHistory:[
      {id:'A',at:'2026-09-18T14:21:12.000Z',type:'event',label:'Sendung erfasst',actor:{name:'Sikandar'}},
      {id:'B',at:'2026-09-18T14:21:12.300Z',type:'created',label:'Sendung erstellt',actor:{name:'Sikandar'},details:{reference:'NKJK7S'}},
      {id:'C',at:'2026-09-18T14:21:12.500Z',type:'work-start',label:'Arbeit an Sendung gestartet',actor:{name:'Sikandar'},details:{reference:'NKJK7S'}},
      {id:'D',at:'2026-09-18T14:21:14.000Z',type:'avis',label:'Lieferavis aktiviert',actor:{name:'Sikandar'}},
      {id:'E',at:'2026-09-18T14:21:14.100Z',type:'avis',label:'Lieferavis erstellt/aktiviert',actor:{name:'ExportHUB'}},
      {id:'F',at:'2026-09-18T14:21:14.200Z',type:'avis',label:'Lieferavis erstellt/aktiviert',actor:{name:'Sikandar'},details:{reference:'NKJK7S'}},
      {id:'G',at:'2026-09-18T14:22:05.000Z',type:'registration',label:'Versandanmeldung gestartet',actor:{name:'Sikandar'},details:{reference:'NKJK7S',action:'Sendung speichern'}}
    ]
  };
  const state={view:'dashboard',shipments:[shipment],savedShipments:[],customers:[],tasks:[],palletAccount:[],auditLog:[]};
  const document={
    readyState:'loading',
    addEventListener(){},
    getElementById(){return null},
    querySelector(){return null},
    body:null
  };
  const window={
    document,
    __EXPORTHUB_GET_STATE__:()=>state,
    addEventListener(){},
    setTimeout(){return 1}
  };
  vm.runInNewContext(historySource,{window,document,console,Intl,Date,Map,Set,Array,Object,String,Number,JSON,Math,URL,Blob,Promise,setTimeout(){return 1}}, {filename:'rc1081-audit-history.js'});
  return window.ExportHUBRC1081AuditHistory;
}

test('RC1177: fachlich doppelte Sendungserstellung erscheint genau einmal',()=>{
  const api=historyApi(),events=api.events();
  const created=events.filter(e=>api.actionTitle(e)==='Sendung erstellt');
  assert.equal(created.length,1);
  assert.equal(created[0].actor.name,'Sikandar');
  assert.equal(created[0].details.reference,'NKJK7S');
  assert.equal(events.some(e=>api.actionTitle(e)==='Sendung erfasst'),false);
});

test('RC1177: mehrfache Lieferavis-Aktivierung wird zu einer Benutzeraktion zusammengeführt',()=>{
  const api=historyApi(),events=api.events();
  const avis=events.filter(e=>api.actionTitle(e)==='Lieferavis erstellt/aktiviert');
  assert.equal(avis.length,1);
  assert.equal(avis[0].actor.name,'Sikandar');
  assert.equal(avis[0].details.reference,'NKJK7S');
});

test('RC1177: unabhängige fachliche Ereignisse bleiben erhalten',()=>{
  const api=historyApi(),labels=api.events().map(e=>api.actionTitle(e));
  assert.ok(labels.includes('Arbeit an Sendung gestartet'));
  assert.ok(labels.includes('Versandanmeldung gestartet'));
});

test('RC1177: Update-Ansicht enthält aktuelle Änderungshinweise statt RC1002-Altstand',()=>{
  for(const marker of ['RC1177 bereinigt die zentrale Historie','RC1176 stabilisiert die Standortauswahl','RC1174 stellt die Fehlerdiagnose-Benachrichtigungen','RC1166 ergänzt in der Sendungsübersicht die Avis-Erinnerung','RC1220 stellt die verpflichtende POD-Zweitsicherung auf Azure-Primärspeicher plus separates Azure-Archiv um']){
    assert.ok(notesSource.includes(marker),marker+' fehlt');
  }
  assert.match(notesSource,/rc524ReleaseTitle/);
  assert.match(notesSource,/Aktueller ExportHUB-Stand/);
  assert.match(notesSource,/data-rc1177-release-notes/);
  assert.doesNotMatch(notesSource,/POD-Sicherungsstatus in der Sendungsübersicht für Azure und Microsoft 365/);
});

test('RC1177: Historie und Release Notes werden in alle drei Umgebungen gebaut und cache-frisch geladen',()=>{
  assert.match(builder,/rc1081-audit-history\.js\?v=1177/);
  assert.match(builder,/exporthub-rc1177-release-notes/);
  assert.match(builder,/assets\/rc1177-release-notes\.js\?v=\$\{VISIBLE_NUMBER\}/);
  assert.doesNotMatch(builder,/assets\/rc1177-release-notes\.js\?v=1231/);
  assert.doesNotMatch(builder,/assets\/rc1177-release-notes\.js\?v=1177/);
  assert.match(builder,/'assets\/rc1177-release-notes\.js'/);
  assert.match(deploy,/rc1081-audit-history\.js\?v=1177/);
  assert.doesNotMatch(deploy,/rc1081-audit-history\.js\?v=1163/);
});

test('RC1177: geänderte JavaScript-Dateien bleiben syntaktisch gültig',()=>{
  for(const file of ['assets/rc1081-audit-history.js','assets/rc1177-release-notes.js','.github/rc1112/build-three-env.mjs']){
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  }
});
