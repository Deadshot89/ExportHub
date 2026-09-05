import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('assets/exporthub-environment-hub.js','utf8');

test('RC999 Environment Hub: Hauptansicht nutzt den vorhandenen Topbar-Slot statt eines Body-Overlays',()=>{
  assert.match(source,/getElementById\(['"]ehTopbarEnvironment['"]\)|querySelector\(['"]\.eh-topbar-environment['"]\)/i,'der vorhandene Topbar-Umgebungsbereich wird nicht als Mount-Ziel verwendet');
  assert.match(source,/(?:mount|slot)\.appendChild\(hub\)|(?:mount|slot)\.append\(hub\)/i,'der Hub wird nicht in den Topbar-Bereich eingehängt');
  assert.doesNotMatch(source,/#eh996-env-hub\s*\{[^}]*position\s*:\s*fixed/i,'der Environment Hub schwebt weiterhin über dem Seiteninhalt');
});

test('RC999 Environment Hub: Bereichsauswahl ist am Hub verankert und nicht am Browserfenster',()=>{
  assert.match(source,/#eh996-env-hub\s*\{[^}]*position\s*:\s*relative/i,'dem Hub fehlt der lokale Anker für die Bereichsauswahl');
  assert.match(source,/#eh996-env-panel\s*\{[^}]*position\s*:\s*absolute/i,'die Bereichsauswahl ist nicht lokal am Hub verankert');
  assert.doesNotMatch(source,/#eh996-env-panel\s*\{[^}]*position\s*:\s*fixed/i,'die Bereichsauswahl ist weiterhin viewport-fixiert');
});

test('RC999 Environment Hub: kompakte responsive Darstellung bleibt erhalten',()=>{
  assert.match(source,/@media\(max-width:640px\)[\s\S]*?#eh996-env-hub\s*\{[^}]*width\s*:\s*100%/i,'Smartphone-Darstellung nutzt den verfügbaren Topbar-Platz nicht');
  assert.match(source,/#eh996-env-switch\s*\{[^}]*background\s*:\s*#2563eb/i,'Bereich wechseln ist nicht mehr als primäre Aktion markiert');
  assert.match(source,/#eh996-app-open\s*\{[^}]*background\s*:/i,'ExportHUB App besitzt keine sekundäre Darstellung');
});
