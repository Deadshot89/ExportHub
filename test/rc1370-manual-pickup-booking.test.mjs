import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ui=fs.readFileSync('assets/rc1014-shipment-overview.js','utf8');
const css=fs.readFileSync('assets/rc1014-shipment-overview.css','utf8');
const api=fs.readFileSync('api/customer-avis/index.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const flow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');

test('RC1370: Sendungsansicht bietet die manuelle Abholbuchung mit den geforderten Feldern',()=>{
  for(const marker of [
    'manualPickup.title',
    'data-rc1370-date',
    'data-rc1370-slot',
    'data-rc1370-carrier',
    'data-rc1370-shipment-number',
    'data-rc1370-plate',
    "manualPickupApi('manual-appointment'"
  ]) assert.ok(ui.includes(marker),marker+' fehlt');
  assert.match(css,/body\[data-exporthub-view="shipmentview"\] \.rc1370-manual-pickup/);
  assert.match(ui,/function inShipmentDetailView\(/);
  assert.match(ui,/rc786ReferenceFilesCard/);
  const manualEnhancer=ui.slice(ui.indexOf('function enhanceManualPickupBooking'),ui.indexOf('function enhanceShipmentDetailedView'));
  assert.doesNotMatch(manualEnhancer,/rc363BlockShipment/,'Manuelle Abholbuchung darf nicht in Sendung erstellen eingebaut werden');
});

test('RC1370: manuelle Buchung verwendet dieselbe Slot-Kapazität wie der Kunden-AVIS',()=>{
  for(const marker of [
    "action==='manual-availability'",
    "action==='manual-appointment'",
    'avisSlots.slotState',
    'PICKUP_SLOT_FULL',
    'sanitizeManualAppointment',
    "pickupAppointmentSource:'manual'",
    "team.clientVersion='RC1370'"
  ]) assert.ok(api.includes(marker),marker+' fehlt');
  const manual=api.slice(api.indexOf('function applyManualAppointment'),api.indexOf('async function setAvisFlags'));
  assert.doesNotMatch(manual,/status\s*[:=]\s*['"]Abgeholt['"]/,'Terminbuchung darf den Abholstatus nicht vorzeitig auf Abgeholt setzen');
});

test('RC1370: manuelle Buchung schreibt Spedition und separate Sendungsnummer in kanonische Felder',()=>{
  const manual=api.slice(api.indexOf('function applyManualAppointment'),api.indexOf('async function setAvisFlags'));
  for(const marker of ['manualPickupCarrierName','pickupCarrierName','speditionName','manualPickupShipmentNumber','pickupShipmentNumber','carrierShipmentNumber']){
    assert.ok(manual.includes(marker),marker+' fehlt in der Persistierung');
  }
});

test('RC1370: UI liest bestehende manuelle Buchungsdaten wieder ein',()=>{
  const context={console,setTimeout(fn){fn();return 1},clearTimeout(){},ExportHUBI18n:{t:key=>key}};
  context.globalThis=context;
  vm.runInNewContext(ui,context,{filename:'rc1014-shipment-overview.js'});
  const meta=context.ExportHUBRC1014ShipmentOverview.manualPickupMeta({
    plannedPickupDate:'2026-10-06',
    customerAvisPickupTimeFrom:'10:00',
    customerAvisPickupTimeTo:'12:00',
    manualPickupCarrierName:'Test Spedition',
    manualPickupShipmentNumber:'SHIP-4711',
    customerAvisPickupPlate:'KLE-AB 123'
  });
  assert.equal(meta.date,'2026-10-06');
  assert.equal(meta.timeFrom,'10:00');
  assert.equal(meta.timeTo,'12:00');
  assert.equal(meta.carrier,'Test Spedition');
  assert.equal(meta.shipmentNumber,'SHIP-4711');
  assert.equal(meta.plate,'KLE-AB 123');
});

test('RC1370: Produktionsbuild erzwingt den neuen Cache-Key',()=>{
  for(const source of [build,flow]){
    assert.match(source,/rc1014-shipment-overview\.js\?v=1370/);
    assert.match(source,/rc1014-shipment-overview\.css\?v=1370/);
  }
});


test('RC1370: manuelle Abholbuchung ist in allen sechs Produktsprachen vollständig hinterlegt',()=>{
  const languages=['de','en','pl','es','fr','it'];
  const required=[
    'manualPickup.title','manualPickup.help','manualPickup.badge','manualPickup.date','manualPickup.timeSlot',
    'manualPickup.selectDateFirst','manualPickup.loadingSlots','manualPickup.selectSlot','manualPickup.slotRemaining',
    'manualPickup.carrier','manualPickup.shipmentNumber','manualPickup.plate','manualPickup.save',
    'manualPickup.shipmentMissing','manualPickup.alreadyPicked','manualPickup.dateRequired','manualPickup.slotRequired',
    'manualPickup.carrierRequired','manualPickup.shipmentNumberRequired','manualPickup.saving','manualPickup.saved',
    'manualPickup.failed','manualPickup.booked','manualPickup.bookedBy'
  ];
  for(const lang of languages){
    const dict=JSON.parse(fs.readFileSync('assets/i18n/'+lang+'.json','utf8'));
    for(const key of required)assert.ok(String(dict[key]||'').trim(),lang+' fehlt '+key);
  }
});
