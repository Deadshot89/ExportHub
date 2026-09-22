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

test('RC1207: Runtime ist syntaktisch gültig und nutzt direkten authentifizierten Versand',()=>{
  execFileSync(process.execPath,['--check','assets/rc1166-avis-reminder-overview.js'],{stdio:'pipe'});
  assert.match(runtime,/fetch\('\/api\/avis-reminder-mail'/);
  assert.match(runtime,/X-ExportHUB-Token/);
  assert.match(runtime,/X-ExportHUB-Session/);
  assert.match(runtime,/["']Authorization["']:'Bearer '\+t/);
  assert.doesNotMatch(runtime,/function\s+mailto\s*\(|href\s*=\s*['\"]?mailto:|\.href\s*=\s*mailto/i);
  assert.match(runtime,/Erinnerungsmail senden/);
  assert.match(runtime,/Erinnerungsmail erfolgreich an/);
  assert.match(runtime,/Sendungshistorie protokolliert/);
});

test('RC1166: sichere Avis-Links werden nur vor Abholung und nicht für Ausnahmekunden angeboten',()=>{
  const api=load();
  assert.equal(api.avisLink({reference:'ABC123',customerName:'Testkunde',testAvisLink:'https://example.test/customer-avis.html?token=abc'}),'https://example.test/customer-avis.html?token=abc');
  assert.equal(api.avisLink({reference:'ABC123',customerName:'BMP',testAvisLink:'https://example.test/customer-avis.html?token=abc'}),'');
  assert.equal(api.avisLink({reference:'ABC123',customerName:'Böllhof',testAvisLink:'https://example.test/customer-avis.html?token=abc'}),'');
  assert.equal(api.avisLink({reference:'ABC123',status:'Abgeholt',testAvisLink:'https://example.test/customer-avis.html?token=abc'}),'');
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

test('RC1166: Deutsch und Englisch sowie Kunde und Spedition haben eigene Erinnerungsmails',()=>{
  const api=load(),sh={reference:'ABC123'},url='https://example.test/customer-avis.html?token=abc';
  assert.match(api.subject(sh,'customer','de'),/Erinnerung – Lieferavis ABC123/);
  assert.match(api.subject(sh,'carrier','de'),/Lieferavis Abholung ABC123/);
  assert.match(api.subject(sh,'customer','en'),/Reminder – shipment notice ABC123/);
  assert.match(api.body(sh,'carrier','de',url),/Abholdatum/);
  assert.match(api.body(sh,'carrier','en',url),/pickup date/i);
  assert.match(api.body(sh,'customer','en',url),/lang=en/);
});

test('RC1207: Direktversand übergibt nur strukturierte Felder an den Mail-Endpunkt',()=>{
  assert.match(runtime,/shipmentId:idOf\(sh\)/);
  assert.match(runtime,/reference:refOf\(sh\)/);
  assert.match(runtime,/recipient:q\(email\)/);
  assert.match(runtime,/target:target==='carrier'\?'carrier':'customer'/);
  assert.match(runtime,/language:lang==='en'\?'en':'de'/);
  assert.match(runtime,/avisUrl:url/);
  assert.doesNotMatch(runtime,/function\s+mailto\s*\(|href\s*=\s*['\"]?mailto:|\.href\s*=\s*mailto/i);
});

test('RC1166: Übersicht zeigt einen blauen Aktionsbutton und eine Empfängerauswahl',()=>{
  assert.match(runtime,/Avis-Erinnerung senden/);
  assert.match(runtime,/rc1166-reminder-btn/);
  assert.match(runtime,/background:#2563eb/);
  assert.match(runtime,/Empfängergruppe/);
  assert.match(runtime,/>Kunde</);
  assert.match(runtime,/>Spedition</);
  assert.match(runtime,/>Deutsch</);
  assert.match(runtime,/>English</);
  assert.match(runtime,/data-recipient/);
});

test('RC1166: Drei-Umgebungen-Build übernimmt die neue Runtime und bestehende Schutzstände',()=>{
  assert.match(build,/exporthub-rc1166-avis-reminder/);
  assert.match(build,/assets\/rc1166-avis-reminder-overview\.js\?v=1207/);
  assert.match(build,/'assets\/rc1166-avis-reminder-overview\.js'/);
  assert.match(build,/avisReminderOverview:'RC1207/);
  assert.match(build,/avis-reminder-mail\/index\.js/);
  assert.match(build,/shared\/graph-mail\.js/);
  assert.match(build,/podBackupStatusUi:'RC1220/);
  assert.match(build,/podGraphReadiness:'RC1220/);
  assert.match(build,/avisAppointmentRevisionHistory:'RC1163/);
  assert.match(build,/border:3mm solid #111827/);
});
