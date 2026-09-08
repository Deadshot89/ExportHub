import test from 'node:test';
import assert from 'node:assert/strict';
await import('../assets/abholkalender.js');
const calendar = globalThis.ExportHubPickupCalendar;

test('Wochenmodell enthält genau Montag bis Freitag', () => {
  const model = calendar.buildCalendarModel({today:new Date(2026,8,8,12),fixedPickups:[],shipments:[]});
  assert.deepEqual(model.days.map(d=>d.label),['Montag','Dienstag','Mittwoch','Donnerstag','Freitag']);
  assert.deepEqual(model.days.map(d=>d.weekday),[1,2,3,4,5]);
});

test('Heute enthält FIX und SENDUNG getrennt', () => {
  const model = calendar.buildCalendarModel({
    today:new Date(2026,8,8,12),
    fixedPickups:[{id:'F1',siteLabel:'Standort A',weekday:2,active:true}],
    shipments:[{id:'S1',reference:'ABC123',customer:'Standort A',plannedPickupDate:'2026-09-08'}]
  });
  assert.equal(model.today.regular,true);
  assert.equal(model.today.fixed.length,1);
  assert.equal(model.today.shipments.length,1);
  assert.equal(model.today.fixed[0].id,'F1');
  assert.equal(model.today.shipments[0].reference,'ABC123');
});

test('gleichnamige FIX- und SENDUNG-Daten werden nicht automatisch verknüpft', () => {
  const model = calendar.buildCalendarModel({
    today:new Date(2026,8,8,12),
    fixedPickups:[{id:'F1',siteLabel:'Standort A',weekday:2,active:true}],
    shipments:[{id:'S1',reference:'ABC123',customer:'Standort A',plannedPickupDate:'2026-09-08'}]
  });
  const tue = model.days.find(d=>d.weekday===2);
  assert.equal(tue.fixed.length,1);
  assert.equal(tue.shipments.length,1);
  assert.equal(tue.fixed[0].shipmentId,undefined);
  assert.equal(tue.shipments[0].fixedPickupId,undefined);
});

test('Teilabholung zeigt Gesamt, abgeholt und offen', () => {
  const state = calendar.shipmentColliState({expectedColliCount:10,collectedPickupCollis:4,remainingPickupCollis:6,status:'partial'});
  assert.deepEqual(state,{expected:10,collected:4,remaining:6,partial:true,complete:false});
});

test('Sendung ohne geplanten Abholtag wird nicht künstlich eingeordnet', () => {
  const model = calendar.buildCalendarModel({today:new Date(2026,8,8,12),fixedPickups:[],shipments:[{reference:'NO-DATE',actualPickupDate:'2026-09-08'}]});
  assert.equal(model.days.flatMap(d=>d.shipments).length,0);
});

test('Wochenende erzeugt keine Samstag- oder Sonntagsspalte', () => {
  const model = calendar.buildCalendarModel({today:new Date(2026,8,12,12),fixedPickups:[],shipments:[]});
  assert.equal(model.today.regular,false);
  assert.equal(model.today.weekday,null);
  assert.equal(model.days.length,5);
  assert.deepEqual(model.days.map(d=>d.label),['Montag','Dienstag','Mittwoch','Donnerstag','Freitag']);
});
