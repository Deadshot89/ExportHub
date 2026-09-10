import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
await import('../assets/abholkalender.js');
const calendar = globalThis.ExportHubPickupCalendar;
const seed = require('../api/shared/rc1014-fixed-pickup-seed.js');

function renderShipment(shipment){
  const state = calendar.createViewState();
  state.shipments = [shipment];
  const root = { innerHTML: '' };
  calendar.render(root,state,new Date('2026-09-09T12:00:00+02:00'));
  return root.innerHTML;
}

function loadRuntime(state){
  const source = fs.readFileSync('assets/rc1012-abholkalender-runtime.js','utf8');
  const calls = [];
  const root = {};
  const window = {
    __EXPORTHUB_GET_STATE__: () => state,
    location: { hostname: 'example.azurestaticapps.net', pathname: '/index.html' },
    document: { getElementById: () => root },
    canRead: () => true,
    ExportHubPickupCalendar: { mount: (element,options) => { calls.push({element,options}); return {}; } }
  };
  const context = vm.createContext({window,globalThis:window});
  vm.runInContext(source,context,{filename:'assets/rc1012-abholkalender-runtime.js'});
  return {window,calls,root};
}

test('Kalender zeigt bei einem Kundenobjekt den echten Kundennamen statt object Object', () => {
  const html = renderShipment({
    reference:'AVCSYB',
    customer:{id:'C100',name:'Beispiel Kunde GmbH'},
    carrierName:'UniServe',
    status:'Bereit zur Abholung',
    plannedPickupDate:'2026-09-10',
    totalColli:9
  });
  assert.match(html,/Kunde:\s*<strong>Beispiel Kunde GmbH<\/strong>/);
  assert.doesNotMatch(html,/\[object Object\]/);
});

test('Kalender bevorzugt expliziten customerName auch wenn customer ein Objekt ist', () => {
  const html = renderShipment({
    reference:'ABC123',
    customerName:'Expliziter Kundenname',
    customer:{name:'Alter Objektname'},
    plannedPickupDate:'2026-09-09',
    totalColli:1
  });
  assert.match(html,/Expliziter Kundenname/);
  assert.doesNotMatch(html,/Alter Objektname|\[object Object\]/);
});

test('Kalender-Runtime gibt den aktiven Firmenkontext an die FIX-API-Komponente weiter', () => {
  const direct = loadRuntime({companyId:'ESSENTRA',shipments:[]});
  assert.equal(direct.window.pickupcalendar(),true);
  assert.equal(direct.calls[0].options.companyId,'ESSENTRA');

  const current = loadRuntime({currentCompanyId:'ESSENTRA',shipments:[]});
  current.window.pickupcalendar();
  assert.equal(current.calls[0].options.companyId,'ESSENTRA');

  const user = loadRuntime({currentUser:{companyId:'ESSENTRA'},shipments:[]});
  user.window.pickupcalendar();
  assert.equal(user.calls[0].options.companyId,'ESSENTRA');
});

test('Essentra FIX-Startbestand enthält die freigegebenen Abholkunden ohne NEFF', () => {
  assert.deepEqual(
    seed.defaultsForCompany('ESSENTRA').map(({siteLabel,weekday})=>({siteLabel,weekday})),
    [
      {siteLabel:'Frankreich',weekday:1},
      {siteLabel:'Italien',weekday:1},
      {siteLabel:'O’Hare',weekday:1},
      {siteLabel:'Esysco',weekday:1},
      {siteLabel:'Gaggenau',weekday:1},
      {siteLabel:'Barcelona',weekday:1},
      {siteLabel:'Madrid',weekday:1},
      {siteLabel:'UK',weekday:1},
      {siteLabel:'Faurecia',weekday:2},
      {siteLabel:'Adolf Würth',weekday:2},
      {siteLabel:'Gorenje Slovenien',weekday:2},
      {siteLabel:'UK',weekday:2},
      {siteLabel:'BMP',weekday:3},
      {siteLabel:'BSH Hausgeräte',weekday:3},
      {siteLabel:'Contitech',weekday:3},
      {siteLabel:'UK',weekday:3},
      {siteLabel:'Adolf Würth',weekday:4},
      {siteLabel:'Madrid',weekday:4},
      {siteLabel:'Barcelona',weekday:4},
      {siteLabel:'Polen',weekday:4},
      {siteLabel:'UK',weekday:4},
      {siteLabel:'China',weekday:4},
      {siteLabel:'Indien',weekday:4},
      {siteLabel:'Australien',weekday:4},
      {siteLabel:'Singapur',weekday:4},
      {siteLabel:'Shenzhen HK',weekday:4},
      {siteLabel:'Thailand',weekday:4},
      {siteLabel:'Schweden',weekday:5},
      {siteLabel:'UK',weekday:5}
    ]
  );
});
