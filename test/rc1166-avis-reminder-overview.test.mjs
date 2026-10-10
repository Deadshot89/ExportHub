import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

const runtime=fs.readFileSync('assets/rc1166-avis-reminder-overview.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

function load(state={}){
  const document={
    readyState:'loading',
    addEventListener(){},
    getElementById(){return null},
    querySelectorAll(){return[]},
    createElement(){return{setAttribute(){},appendChild(){},addEventListener(){},remove(){},style:{}}},
    body:{getAttribute(){return''},appendChild(){}},
    head:{appendChild(){}},
    documentElement:{appendChild(){}}
  };
  const sandbox={
    document,
    location:{href:'https://example.test/'},
    setTimeout(){return 1},
    addEventListener(){},
    __EXPORTHUB_GET_STATE__(){return state},
    ExportHUBCustomerAvis706:{link(sh){return sh&&sh.testAvisLink||''}},
    console:{warn(){}},
    URL
  };
  sandbox.window=sandbox;
  vm.runInNewContext(runtime,sandbox,{filename:'rc1166-avis-reminder-overview.js'});
  return sandbox.ExportHUBRC1166AvisReminder;
}

function observerHarness(){
  const timers=[];
  let observerCallback=null;
  const content={id:'content',nodeType:1};
  const document={
    readyState:'complete',
    addEventListener(){},
    getElementById(id){return id==='content'?content:null},
    querySelectorAll(){return[]},
    createElement(){return{setAttribute(){},appendChild(){},addEventListener(){},remove(){},style:{}}},
    body:{getAttribute(name){return name==='data-exporthub-view'?'shipmentoverview':''},appendChild(){}},
    head:{appendChild(){}},
    documentElement:{appendChild(){}}
  };
  class MutationObserver{
    constructor(callback){observerCallback=callback}
    observe(){}
    disconnect(){}
  }
  const sandbox={
    document,
    location:{href:'https://example.test/'},
    MutationObserver,
    setTimeout(fn){timers.push(fn);return timers.length},
    addEventListener(){},
    __EXPORTHUB_GET_STATE__(){return{shipments:[]}},
    ExportHUBCustomerAvis706:{link(){return''}},
    console:{warn(){}},
    URL
  };
  sandbox.window=sandbox;
  vm.runInNewContext(runtime,sandbox,{filename:'rc1166-avis-reminder-overview.js'});
  return{timers,content,callback(records){assert.equal(typeof observerCallback,'function');observerCallback(records)}};
}

test('RC1434: Outlook-Runtime ist syntaktisch gültig',()=>{
  execFileSync(process.execPath,['--check','assets/rc1166-avis-reminder-overview.js'],{stdio:'pipe'});
});

test('RC1166: sichere Avis-Links werden nur vor Abholung und nicht für Ausnahmekunden angeboten',()=>{
  const api=load();
  assert.equal(api.avisLink({reference:'ABC123',customerName:'Testkunde',testAvisLink:'https://example.test/customer-avis.html?token=abc'}),'https://www.exporthub360.de/avis/abc');
  assert.equal(api.avisLink({reference:'ABC123',customerName:'BMP',testAvisLink:'https://example.test/customer-avis.html?token=abc'}),'');
  assert.equal(api.avisLink({reference:'ABC123',customerName:'Böllhof',testAvisLink:'https://example.test/customer-avis.html?token=abc'}),'');
  assert.equal(api.avisLink({reference:'ABC123',status:'Abgeholt',testAvisLink:'https://example.test/customer-avis.html?token=abc'}),'');
});


test('RC1400: gespeicherter alter .com-Avis-Link wird in der Oberfläche zwingend auf .de normalisiert',()=>{
  const api=load();
  const sh={reference:'ABC123',customerName:'Testkunde',customerAvisUrl:'https://exporthub360.com/avis/legacy-token'};
  assert.equal(api.avisLink(sh),'https://www.exporthub360.de/avis/legacy-token');
});
test('RC1166: Kunde und Spedition erhalten getrennte hinterlegte Empfänger',()=>{
  const state={customers:[{
    id:'C1',name:'Testkunde',customerEmail:'kunde@example.com',carrierEmail:'sped@example.com',
    ccContacts:[{name:'Einkauf',email:'einkauf@example.com'}],
    carrierContacts:[{name:'Disposition',email:'dispo@example.com'}],
    contactDirectory:[
      {name:'Kundenkontakt',email:'kontakt@example.com',role:'cc'},
      {name:'Frachtkontakt',email:'fracht@example.com',role:'carrier'},
      {name:'Interner Sales',email:'sales@example.com',role:'sales'}
    ]
  }]};
  const api=load(state),sh={customerId:'C1',customerEmail:'sendung@example.com',carrierEmail:'sendung-sped@example.com'};
  const customer=api.shipmentContacts(sh,'customer').map(x=>x.email);
  const carrier=api.shipmentContacts(sh,'carrier').map(x=>x.email);
  for(const e of ['kunde@example.com','einkauf@example.com','kontakt@example.com','sendung@example.com'])assert.ok(customer.includes(e),e+' fehlt bei Kunde');
  assert.equal(customer.includes('sales@example.com'),false);
  for(const e of ['sped@example.com','dispo@example.com','fracht@example.com','sendung-sped@example.com'])assert.ok(carrier.includes(e),e+' fehlt bei Spedition');
});

test('RC1267: sechs Sprachen sowie Kunde und Spedition haben eigene Erinnerungsmails',()=>{
  const api=load(),sh={reference:'ABC123'},url='https://example.test/customer-avis.html?token=abc';
  assert.match(api.subject(sh,'customer','de'),/Erinnerung – Lieferavis ABC123/);
  assert.match(api.subject(sh,'carrier','de'),/Lieferavis Abholung ABC123/);
  assert.match(api.subject(sh,'customer','en'),/Reminder – shipment notice ABC123/);
  assert.match(api.body(sh,'carrier','de',url),/Abholdatum/);
  assert.match(api.body(sh,'carrier','en',url),/pickup date/i);
  assert.match(api.body(sh,'customer','en',url),/lang=en/);
  assert.match(api.subject(sh,'customer','pl'),/Przypomnienie/);
  assert.match(api.subject(sh,'customer','es'),/Recordatorio/);
  assert.match(api.subject(sh,'customer','fr'),/Rappel/);
  assert.match(api.subject(sh,'customer','it'),/Promemoria/);
  for(const lang of ['de','en','pl','es','fr','it'])assert.match(api.body(sh,'customer',lang,url),new RegExp('lang='+lang));
});

test('RC1166: Übersicht zeigt einen blauen Aktionsbutton und eine Empfängerauswahl',()=>{
  assert.match(runtime,/avisReminder\.button/);
  assert.match(runtime,/rc1166-reminder-btn/);
  assert.match(runtime,/background:#2563eb/);
  assert.match(runtime,/avisReminder\.targetGroup/);
  assert.match(runtime,/avisReminder\.customer/);
  assert.match(runtime,/avisReminder\.carrier/);
  assert.match(runtime,/>Deutsch</);
  assert.match(runtime,/>English</);
  assert.match(runtime,/data-recipient/);
});

test('RC1166: Drei-Umgebungen-Build übernimmt die neue Runtime und bestehende Schutzstände',()=>{
  assert.match(build,/exporthub-rc1166-avis-reminder/);
  assert.match(build,/assets\/rc1166-avis-reminder-overview\.js\?v=20261005-outlook/);
  assert.match(build,/'assets\/rc1166-avis-reminder-overview\.js'/);
  assert.match(build,/avisReminderOverview:'RC1434/);
  assert.match(build,/avis-reminder-mail\/index\.js/);
  assert.match(build,/shared\/graph-mail\.js/);
  assert.match(build,/podBackupStatusUi:'RC1220/);
  assert.match(build,/podGraphReadiness:'RC1220/);
  assert.match(build,/avisAppointmentRevisionHistory:'RC1163/);
  assert.match(build,/border:3mm solid #111827/);
});


test('RC1292: Holenstein wird aus der Avis-Erinnerungs-Empfängerliste entfernt',()=>{
  const state={customers:[{
    id:'P1',name:'Plica',carrierEmail:'dispo@holenstein.de',
    carrierContacts:[{name:'Disposition | Holenstein GmbH',email:'dispo@holenstein.de'},{name:'Andere Spedition',email:'other@example.com'}]
  }]};
  const api=load(state),sh={customerId:'P1',customerName:'Plica',carrierMail:'dispo@holenstein.de'};
  const carrier=api.shipmentContacts(sh,'carrier').map(x=>x.email);
  assert.equal(carrier.includes('dispo@holenstein.de'),false);
  assert.equal(carrier.includes('other@example.com'),true);
  assert.equal(api.recipientExcluded('dispo@holenstein.de'),true);
  assert.equal(api.recipientExcluded('OTHER@example.com'),false);
});

test('RC1292: direkter Reminder-Versand an Holenstein wird bereits im Frontend geblockt',async()=>{
  const api=load(),sh={reference:'ABC123'};
  await assert.rejects(
    ()=>api.sendReminder(sh,'dispo@holenstein.de','carrier','de','https://example.test/customer-avis.html?token=abc'),
    e=>e&&e.code==='AVIS_RECIPIENT_EXCLUDED'
  );
});


test('RC1358: Sendungsübersicht injiziert Avis-Erinnerung auch nach späteren Karten-Renders stabil',()=>{
  assert.match(runtime,/function overviewCards\(shipments\)/);
  assert.match(runtime,/#content article/);
  assert.match(runtime,/#content \.card/);
  assert.match(runtime,/MutationObserver/);
  assert.match(runtime,/observer\.observe\(root,\{childList:true,subtree:true\}\)/);
  assert.match(runtime,/exporthub:rc1027-avis-ready/);
  assert.match(runtime,/exporthub:design-changed/);
  assert.match(runtime,/version:'RC1358'/);
  assert.match(runtime,/if\(q\(btn\.textContent\)!==q\(label\)\)btn\.textContent=label/,'Bestehende Buttons dürfen den MutationObserver nicht durch unnötige Text-DOM-Writes triggern');
});

test('RC1480: fachfremde DOM-Mutation außerhalb einer Sendungskarte startet keinen neuen Reminder-Scan',()=>{
  const h=observerHarness(),before=h.timers.length;
  const unrelated={nodeType:1,id:'unrelated-status',matches(){return false},querySelector(){return null},closest(){return null}};
  h.callback([{type:'childList',target:h.content,addedNodes:[unrelated],removedNodes:[]}]);
  assert.equal(h.timers.length-before,0,'unrelated overview DOM churn must not queue a full RC1166 reminder scan');
});

test('RC1480: neu eingefügte Sendungskarte bleibt für den Reminder-Observer relevant',()=>{
  const h=observerHarness(),before=h.timers.length;
  const card={nodeType:1,className:'shipment-card',matches(selector){return selector.includes('.shipment-card')},querySelector(){return null},closest(){return null}};
  h.callback([{type:'childList',target:h.content,addedNodes:[card],removedNodes:[]}]);
  assert.equal(h.timers.length-before,1,'new shipment cards must still queue the RC1166 reminder scan');
});


test('RC1358: Erstversand und Reminder haben fachlich getrennte Beschriftungen',()=>{
  assert.match(runtime,/avisReminder\.initialButton/);
  assert.match(runtime,/avisReminder\.initialFooter/);
  assert.match(runtime,/avisReminder\.waitingUntil/);
  assert.match(runtime,/avisReminder\.pickupRecorded/);
});

test('RC1358: Erstversand ist sofort manuell möglich; Reminder erst nach drei Arbeitstagen ohne Abholtag',()=>{
  const api=load();
  let gate=api.reminderGate({reference:'ABC123'},'2026-09-28T10:00:00.000Z');
  assert.equal(gate.mode,'initial');
  assert.equal(gate.enabled,true);

  gate=api.reminderGate({reference:'ABC123',avisFirstMailSentAt:'2026-09-28T10:00:00.000Z'},'2026-10-01T09:59:59.000Z');
  assert.equal(gate.mode,'reminder');
  assert.equal(gate.enabled,false);
  assert.equal(gate.reason,'waiting');

  gate=api.reminderGate({reference:'ABC123',avisFirstMailSentAt:'2026-09-28T10:00:00.000Z'},'2026-10-01T10:00:00.000Z');
  assert.equal(gate.enabled,true);
  assert.equal(gate.reason,'ready');

  gate=api.reminderGate({reference:'ABC123',avisFirstMailSentAt:'2026-09-25T10:00:00.000Z'},'2026-09-30T10:00:00.000Z');
  assert.equal(gate.enabled,true,'Wochenende darf nicht als Arbeitstag zählen');

  gate=api.reminderGate({reference:'ABC123',avisFirstMailSentAt:'2026-09-28T10:00:00.000Z',customerAvisPickupDate:'2026-10-02'},'2026-10-05T10:00:00.000Z');
  assert.equal(gate.enabled,false);
  assert.equal(gate.reason,'pickup-date');
});
