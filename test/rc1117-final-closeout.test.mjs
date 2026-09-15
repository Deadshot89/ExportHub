import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const read=p=>fs.readFileSync(p,'utf8');

test('RC1117: neue Lieferavis-Links sind einmalig, bestehende QR-Codes bleiben wiederverwendbar',()=>{
  const avis=read('api/customer-avis/index.js');
  const access=read('api/shared/public-access-store.js');
  const pickupInit=read('api/pickup-init/index.js');
  const pickupStatus=read('api/pickup-status/index.js');
  assert.match(avis,/singleUse:true/);
  assert.match(avis,/allowUsed:false/);
  assert.match(avis,/access\.consume\(resolved\.environment,'avis'/);
  assert.match(avis,/rawLinkConsumed=true/);
  assert.match(avis,/oneTime:true/);
  assert.match(access,/singleUse:meta\.singleUse===true/);
  assert.match(access,/record\.kind==='pickup'\|\|\(record\.kind==='avis'&&record\.singleUse!==true\)/);
  assert.match(pickupInit,/oneTime:false/);
  assert.match(pickupStatus,/oneTime:false/);
});

test('RC1117: Kunden-Avis behält die Einmal-Sitzung auf demselben Browser und den 3-Tage-Nachlauf',()=>{
  const page=read('customer-avis.html');
  assert.match(page,/function sessionKey\(\)/);
  assert.match(page,/localStorage\.setItem\(sessionKey\(\)/);
  assert.match(page,/function loadStoredSession\(\)/);
  assert.match(page,/Einmaliger persönlicher Avis-Link/);
  assert.match(page,/Link bereits verwendet/);
  assert.match(page,/bis einschließlich drei Tage nach der Abholung/);
  assert.match(page,/if\(loadStoredSession\(\)\)/);
});

test('RC1117: BSH Mittwoch 13:00 wird auf unberührte System-Seeds nachgezogen, manuelle Änderung bleibt geschützt',()=>{
  const seed=require('../api/shared/rc1014-fixed-pickup-seed.js');
  assert.equal(seed.SEED_VERSION,10);
  const bsh=seed.defaultsForCompany('essentra').find(x=>x.id==='FIX-RC1024-ESSENTRA-BSH-MI');
  assert.ok(bsh);
  assert.equal(bsh.weekday,3);
  assert.equal(bsh.note,'Fixzeit 13:00');

  const stamp='2026-09-15T13:30:00.000Z';
  const untouched=[{id:bsh.id,siteLabel:'BSH Hausgeräte',weekday:3,note:'',active:true,createdBy:'System RC1014',updatedBy:'System RC1014'}];
  const healed=seed.mergeMissing(untouched,'essentra',stamp).find(x=>x.id===bsh.id);
  assert.equal(healed.note,'Fixzeit 13:00');
  assert.equal(healed.updatedAt,stamp);

  const manual=[{id:bsh.id,siteLabel:'BSH Hausgeräte',weekday:3,note:'Eigene Vorgabe',active:true,createdBy:'System RC1014',updatedBy:'Admin'}];
  const protectedItem=seed.mergeMissing(manual,'essentra',stamp).find(x=>x.id===bsh.id);
  assert.equal(protectedItem.note,'Eigene Vorgabe');
});

function countryApi(){
  const source=read('assets/rc1117-country-completion.js');
  const window={addEventListener(){},setTimeout(){return 0},clearTimeout(){},console};
  const document={readyState:'loading',addEventListener(){}};
  const context={window,document,console,Set,Array,Date};
  vm.runInNewContext(source,context,{filename:'rc1117-country-completion.js'});
  assert.ok(window.ExportHUBRC1117CountryCompletion);
  return window.ExportHUBRC1117CountryCompletion;
}

test('RC1117: Länder werden nur aus eindeutigen vorhandenen Kunden-/Standortdaten ergänzt',()=>{
  const api=countryApi();
  const customer={
    name:'Testkunde',
    address:'Werkstraße 1, 41334 Nettetal, Deutschland',
    locations:[
      {id:'L1',address:'Havenstraat 10, Rotterdam, Netherlands'},
      {id:'L2',address:'Industriestraße 2, 41334 Nettetal, Deutschland'},
      {id:'L3',address:'Unbekannte Straße 5'}
    ]
  };
  const r=api.enrichCustomer(customer);
  assert.equal(customer.country,'Deutschland');
  assert.equal(customer.countryCode,'DE');
  assert.equal(customer.locations[0].country,'Niederlande');
  assert.equal(customer.locations[0].countryCode,'NL');
  assert.equal(customer.locations[1].countryCode,'DE');
  assert.equal(customer.locations[2].country,undefined);
  assert.ok(r.changed>=3);
  assert.ok(r.unresolved>=1);
});

test('RC1117: Länder-Runtime wird in Produktion, TESTSERVICE und Demo ausgeliefert',()=>{
  const build=read('.github/rc1112/build-three-env.mjs');
  assert.match(build,/assets\/rc1117-country-completion\.js\?v=1117/);
  assert.match(build,/fs\.copyFileSync\(rc1117CountrySrc,rc1117CountryOut\)/);
  assert.match(build,/finalCloseout:'RC1117 one-time avis \+ country completion \+ BSH fixed time'/);
});

test('RC1117: bereits abgeschlossene Restpunkte bleiben im finalen Vertrag vorhanden',()=>{
  assert.match(read('.github/rc1048/build-three-env.mjs'),/deckblattContrast:\{version:'RC1111'/);
  assert.match(read('test/rc1097-academy-audit.test.mjs'),/50 Fragen und 100 Punkten/);
  assert.match(read('test/rc1065-chat-closeout.test.mjs'),/Wochenplan bleibt A4 Mo-Fr/);
  assert.match(read('assets/rc1075-loader-pin-admin.js'),/__EXPORTHUB_RC1075_LOADER_PIN_ADMIN__/);
  assert.match(read('assets/rc1113-stowplan-persist.js'),/Ladeanweisung/);
  assert.match(read('assets/rc1114-shipping-neutral.js'),/Paletten \/ Maut/);
  assert.match(read('api/shared/pod-archive.js'),/automatic-pod/);
  assert.match(read('assets/rc1115-iso-audit.js'),/Technischer Kontrollstatus/);
});

test('RC1117: vollautomatische ChatGPT-Fehlerbehebung bleibt ausdrücklich deaktiviert',()=>{
  const build=read('.github/rc1048/build-three-env.mjs');
  const diag=read('assets/rc1013-diagnostics.js');
  assert.match(build,/diagnosticsAutofix:\{[^}]*enabledByDefault:false/s);
  assert.match(build,/noExternalAiRequestsWhenDisabled:true/);
  assert.match(diag,/autofix/i);
});
