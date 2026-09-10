import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const jsSource = fs.readFileSync('assets/abholkalender.js','utf8');
const runtimeSource = fs.readFileSync('assets/rc1012-abholkalender-runtime.js','utf8');
const sandbox = { module:{exports:{}}, exports:{}, globalThis:{} };
vm.runInNewContext(jsSource,sandbox,{filename:'assets/abholkalender.js'});
const calendar = sandbox.module.exports;

test('Abholkalender bietet einen Wochenplan-Druck direkt aus der Seite an', () => {
  assert.match(jsSource,/data-pickup-action="print-week"/);
  assert.match(jsSource,/Wochenplan drucken/);
});

test('Druckansicht enthält exakt Montag bis Freitag und nur kompakte Abholdaten', () => {
  assert.equal(typeof calendar.renderPrintWeek,'function');
  const model = calendar.buildCalendarModel({
    today:new Date(2026,8,10,12,0,0),
    fixedPickups:[{id:'f1',siteLabel:'Frankreich',weekday:1,active:true,note:'Nicht drucken'}],
    shipments:[{
      id:'s1',reference:'ABC123',customerName:'O’Hare Components',carrierName:'Spedition X',
      status:'Bereit zur Abholung',plannedPickupDate:'2026-09-10',totalColli:7
    }]
  });
  const html = calendar.renderPrintWeek(model);
  for (const day of ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag']) assert.match(html,new RegExp(`>${day}<`));
  assert.doesNotMatch(html,/Samstag|Sonntag|Spedition X|Nicht drucken|Bereit zur Abholung|Gesamt:|Noch offen:/);
  assert.match(html,/Frankreich/);
  assert.match(html,/O’Hare Components/);
  assert.match(html,/Ref:\s*ABC123/);
  assert.match(html,/Anzahl:\s*7/);
});

test('Druck wird in ein eigenständiges Dokument umgeleitet statt die ExportHUB-Webseite zu drucken', () => {
  assert.match(runtimeSource,/nativePrint/);
  assert.match(runtimeSource,/pickup-print-active/);
  assert.match(runtimeSource,/createElement\(['"]iframe['"]\)/);
  assert.match(runtimeSource,/printWindow\.print\(/);
  assert.match(runtimeSource,/<!doctype html>/i);
});

test('Eigenständiges Druckdokument definiert A4 quer und fünf Wochentage', () => {
  assert.match(runtimeSource,/@page\s*\{[^}]*size:\s*A4\s+landscape/i);
  assert.match(runtimeSource,/grid-template-columns:\s*repeat\(5/i);
});
