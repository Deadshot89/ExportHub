import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../assets/abholkalender.js');
const calendar = globalThis.ExportHubPickupCalendar;

test('RC1011: Wochenansicht kann exakt eine Woche vor und zurück verschoben werden', () => {
  const next = calendar.buildCalendarModel({
    today:new Date(2026,8,8,12),
    weekOffset:1,
    fixedPickups:[{id:'F-WED',siteLabel:'Fix Mittwoch',weekday:3,active:true}],
    shipments:[{id:'S-NEXT',reference:'NX1011',plannedPickupDate:'2026-09-16'}]
  });
  assert.equal(next.weekOffset,1);
  assert.equal(calendar.dateKeyLocal(next.days[0].date),'2026-09-14');
  assert.equal(calendar.dateKeyLocal(next.days[4].date),'2026-09-18');
  assert.equal(next.days[2].fixed.length,1,'FIX muss sich auch in der Folgewoche am Wochentag wiederholen');
  assert.equal(next.days[2].shipments[0].reference,'NX1011');

  const previous = calendar.buildCalendarModel({today:new Date(2026,8,8,12),weekOffset:-1,fixedPickups:[],shipments:[]});
  assert.equal(calendar.dateKeyLocal(previous.days[0].date),'2026-08-31');
  assert.equal(calendar.dateKeyLocal(previous.days[4].date),'2026-09-04');
});

test('RC1011: Heute bleibt beim Blättern der echte heutige Tag', () => {
  const model = calendar.buildCalendarModel({
    today:new Date(2026,8,8,12),
    weekOffset:1,
    fixedPickups:[{id:'F-TODAY',siteLabel:'Heute fix',weekday:2,active:true}],
    shipments:[{reference:'TODAY1',plannedPickupDate:'2026-09-08'}]
  });
  assert.equal(model.today.regular,true);
  assert.equal(model.today.dateKey,'2026-09-08');
  assert.equal(model.today.fixed.length,1);
  assert.equal(model.today.shipments.length,1);
});

test('RC1011: View-State und Oberfläche besitzen vollständige Wochennavigation', () => {
  const state = calendar.createViewState();
  assert.equal(state.weekOffset,0);
  const js = fs.readFileSync('assets/abholkalender.js','utf8');
  const css = fs.readFileSync('assets/abholkalender.css','utf8');
  for (const action of ['week-prev','week-current','week-next']) assert.match(js,new RegExp(`data-pickup-action=["']${action}["']`));
  for (const label of ['Vorherige Woche','Aktuelle Woche','Nächste Woche']) assert.match(js,new RegExp(label));
  assert.match(js,/pickup-week-label/);
  assert.match(css,/\.pickup-week-toolbar/);
});

test('RC1011: SENDUNG-Karte bietet direkten Öffnen-Weg über stabile Identität', () => {
  assert.equal(typeof calendar.shipmentIdentity,'function');
  assert.equal(calendar.shipmentIdentity({id:'S-1',reference:'ABC123'}),'S-1');
  assert.equal(calendar.shipmentIdentity({reference:'ABC123'}),'ABC123');
  let opened = null;
  assert.equal(calendar.triggerOpenShipment({id:'S-2',reference:'DEF456'},{onOpenShipment:shipment=>{opened=shipment;}}),true);
  assert.equal(opened.id,'S-2');

  const js = fs.readFileSync('assets/abholkalender.js','utf8');
  assert.match(js,/data-pickup-action=["']open-shipment["']/);
  assert.match(js,/Sendung öffnen/);
  assert.match(js,/onOpenShipment/);
});

test('RC1011: Kalender nutzt die echte ExportHUB-openShipment-Runtime', () => {
  const js = fs.readFileSync('assets/abholkalender.js','utf8');
  assert.match(js,/root\.openShipment/);
  for (const file of ['index.html','TESTVERSION.html']) {
    const html = fs.readFileSync(file,'utf8');
    assert.match(html,/function\s+openShipment\s*\(/,`${file} stellt openShipment nicht bereit`);
  }
});
