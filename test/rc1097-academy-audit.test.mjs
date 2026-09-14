import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('TESTVERSION.html','utf8');

test('RC1097: Academy bietet die drei verbindlichen Berufsbereiche',()=>{
  assert.match(html,/Fachkraft für Lagerlogistik/);
  assert.match(html,/Industriekaufmann\/-frau/);
  assert.match(html,/Groß- & Einzelhandel/);
  assert.match(html,/ihkProfessionTabsHtml/);
  assert.match(html,/industriekaufmann/);
  assert.match(html,/handel/);
});

test('RC1097: Prüfungen bleiben bei 50 Fragen und 100 Punkten',()=>{
  assert.match(html,/Fragen je Prüfung<\/span><strong>50<\/strong>/);
  assert.match(html,/Punkte<\/span><strong>100<\/strong>/);
  assert.match(html,/Prüfungszeit<\/span><strong>60 Min\.<\/strong>/);
  assert.match(html,/50-Fragen-Prüfung|50 Fragen/);
  assert.match(html,/exakt 100 Gesamtpunkte|100 Gesamtpunkte|100 Punkte/);
});

test('RC1097: Nachbesprechung und persönliche Ergebnisgrenzen bleiben erhalten',()=>{
  assert.match(html,/>Nachbesprechung<\/button>/);
  assert.match(html,/eigene falschen Antworten|eigenen falschen Antworten/);
  assert.match(html,/gewählter Antwort|gewählte Antwort/);
  assert.match(html,/richtiger Antwort|richtige Antwort/);
  assert.match(html,/Begründung/);
});

test('RC1097: Prüfungsverwaltung und Admin-Auswertung bleiben auf Funktionsadmin Prüfungen oder Global Admin begrenzt',()=>{
  assert.match(html,/Funktionsadmin Prüfungen \/ Global Admin/);
  assert.match(html,/Admin-Auswertung und Prüfungen verwalten/);
  assert.match(html,/Auswertung ist nur für den Funktionsadmin Prüfungen sichtbar/);
});

test('RC1097: Datenschutz bleibt als eigener geschützter Bereich sichtbar',()=>{
  assert.match(html,/label:'Datenschutz',right:'privacy'/);
  assert.match(html,/Datenschutz &amp; personenbezogene Daten/);
  assert.match(html,/Datenminimierung/);
});
