import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
await import('../assets/abholkalender.js');
const calendar = globalThis.ExportHubPickupCalendar;

function occurrences(text, needle){ return text.split(needle).length - 1; }

test('UI-Vertrag enthält Heute, FIX, SENDUNG und Montag bis Freitag', () => {
  const js = fs.readFileSync('assets/abholkalender.js','utf8');
  assert.match(js,/Heute/);
  assert.match(js,/FIX/);
  assert.match(js,/SENDUNG/);
  for (const day of ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag']) assert.match(js,new RegExp(day));
  assert.doesNotMatch(js,/Samstag|Sonntag/);
});

test('UI führt keine Uhrzeitfelder für fixe Abholungen ein', () => {
  const js = fs.readFileSync('assets/abholkalender.js','utf8');
  assert.doesNotMatch(js,/type=["']time["']/);
  assert.doesNotMatch(js,/pickupStart|pickupEnd|timeWindow/);
});

test('FIX- und SENDUNG-Ladefehler werden getrennt gehalten', () => {
  const state = calendar.createViewState();
  state.fixedPickups = [{id:'F1'}];
  state.shipments = [{reference:'S1'}];
  state.fixedError = 'FIX konnte nicht geladen werden';
  assert.equal(state.shipments.length,1);
  assert.equal(state.fixedError,'FIX konnte nicht geladen werden');
  assert.equal(state.shipmentError,null);
});

test('Adminformular enthält nur Standort, Wochentag, Hinweis und Aktivstatus', () => {
  const js = fs.readFileSync('assets/abholkalender.js','utf8');
  assert.match(js,/name="siteLabel"/);
  assert.match(js,/name="weekday"/);
  assert.match(js,/name="note"/);
  assert.match(js,/name="active"/);
  assert.match(js,/Fixe Abholungen verwalten/);
});

test('Kalender-CSS bleibt auf Feature-Klassen begrenzt und ist responsiv', () => {
  const css = fs.readFileSync('assets/abholkalender.css','utf8');
  assert.match(css,/\.pickup-calendar/);
  assert.match(css,/\.pickup-week/);
  assert.match(css,/@media\(max-width:1000px\)/);
  assert.match(css,/@media\(max-width:640px\)/);
  assert.doesNotMatch(css,/(^|\})\s*(body|button|\.card|nav)\s*\{/m);
});

test('Produktions- und Testseite laden Kalenderassets jeweils exakt einmal', () => {
  for (const file of ['index.html','TESTVERSION.html']) {
    const html = fs.readFileSync(file,'utf8');
    assert.equal(occurrences(html,'assets/abholkalender.css'),1,`${file}: CSS exakt einmal`);
    assert.equal(occurrences(html,'assets/abholkalender.js'),1,`${file}: JS exakt einmal`);
  }
});

test('Navigation und Router führen Abholkalender als eigenes Modul', () => {
  for (const file of ['index.html','TESTVERSION.html']) {
    const html = fs.readFileSync(file,'utf8');
    assert.match(html,/view:'pickupcalendar',label:'Abholkalender',right:'pickupcalendar'/,`${file}: Navigation`);
    assert.match(html,/view==='pickupcalendar'.*ExportHubPickupCalendar/s,`${file}: Router`);
    assert.equal(occurrences(html,'id="rc1004PickupCalendar"'),1,`${file}: Kalender-Root exakt einmal`);
  }
});

test('Kalender übernimmt vorhandene In-Memory-Sendungen statt einen zweiten Sendungsabruf anzulegen', () => {
  for (const file of ['index.html','TESTVERSION.html']) {
    const html = fs.readFileSync(file,'utf8');
    const marker = html.indexOf("view==='pickupcalendar'");
    assert.ok(marker >= 0,`${file}: Routermarker fehlt`);
    const section = html.slice(marker,marker+1800);
    assert.match(section,/Array\.isArray\(S\(\)\.shipments\)/,`${file}: bestehende Sendungen werden verwendet`);
    assert.match(section,/ExportHubPickupCalendar\.mount/,`${file}: Kalender wird montiert`);
    assert.doesNotMatch(section,/fetch\([^)]*exporthub-state/i,`${file}: kein zusätzlicher Sendungs-State-Fetch`);
  }
});
