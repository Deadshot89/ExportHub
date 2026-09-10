import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

// RC1021 RED-Vertrag: Druck erfolgt aus dem bestehenden Abholkalender.
const require = createRequire(import.meta.url);
const calendar = require('../assets/abholkalender.js');

test('Abholkalender bietet einen Wochenplan-Druck direkt aus der Seite an', () => {
  const js = fs.readFileSync('assets/abholkalender.js','utf8');
  assert.match(js,/data-pickup-action="print-week"/);
  assert.match(js,/Wochenplan drucken/);
  assert.match(js,/\.print\(\)/);
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

test('Druck-CSS erzwingt eine einzelne A4-Seite im Querformat und blendet Weboberfläche aus', () => {
  const css = fs.readFileSync('assets/abholkalender.css','utf8');
  assert.match(css,/@page\s*\{[^}]*size:\s*A4\s+landscape/i);
  assert.match(css,/@media\s+print/i);
  assert.match(css,/\.pickup-print-sheet/);
  assert.match(css,/visibility:\s*hidden|display:\s*none/i);
  assert.match(css,/grid-template-columns:\s*repeat\(5/i);
});
