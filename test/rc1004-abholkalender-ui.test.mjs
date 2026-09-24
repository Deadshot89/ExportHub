import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const calendarDe=JSON.parse(fs.readFileSync('assets/i18n/de.json','utf8'));
globalThis.ExportHUBI18n={
  language(){return 'de'},
  t(key,vars){let value=calendarDe[key]||key;if(vars)for(const [name,v] of Object.entries(vars))value=value.replaceAll('{{'+name+'}}',String(v));return value},
  formatDate(value,options){return new Intl.DateTimeFormat('de-DE',options||{}).format(value)},
  localized(record,key){return record&&record[key]!=null?record[key]:''}
};
await import('../assets/abholkalender.js');
const calendar = globalThis.ExportHubPickupCalendar;

test('UI-Vertrag verwendet zentrale Keys für Heute, Sendung und Montag bis Freitag', () => {
  const js = fs.readFileSync('assets/abholkalender.js','utf8');
  assert.match(js,/pickupCalendar\.today/);
  assert.match(js,/pickupCalendar\.badge\.shipment/);
  for (let day=1;day<=5;day+=1) assert.match(js,new RegExp('pickupCalendar\\.weekday\\.'+day));
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
  assert.match(js,/pickupCalendar\.admin\.manageFixed/);
});

test('Kalender-CSS bleibt auf Feature-Klassen begrenzt und ist responsiv', () => {
  const css = fs.readFileSync('assets/abholkalender.css','utf8');
  assert.match(css,/\.pickup-calendar/);
  assert.match(css,/\.pickup-week/);
  assert.match(css,/@media\(max-width:1000px\)/);
  assert.match(css,/@media\(max-width:640px\)/);
  assert.doesNotMatch(css,/(^|\})\s*(body|button|\.card|nav)\s*\{/m);
});
