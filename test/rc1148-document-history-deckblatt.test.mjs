import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const history=fs.readFileSync('assets/rc1071-shipment-history.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

test('RC1148: Dokument-History trennt Öffnen und Drucken und speichert den konkreten Dateinamen',()=>{
  assert.match(history,/type:'document-open'/,'eigener History-Typ für Dokument öffnen fehlt');
  assert.match(history,/label:doc+' – geöffnet'/,'eindeutiger Öffnen-Eintrag fehlt');
  assert.match(history,/label:doc+' – gedruckt'/,'eindeutiger Druck-Eintrag fehlt');
  assert.match(history,/fileName:file/,'konkreter Dateiname wird nicht gespeichert');
  assert.match(history,/actor:actorFrom\(currentUser\(\)\)/,'aktueller Benutzer muss protokolliert werden');
  assert.match(history,/documentActionFileName/,'Dateiname muss aus Button\/Link\/Dokumentkontext ermittelt werden');
});

test('RC1148: Deckblatt-Hochsichtbarkeitsregel wird als gültige geschlossene CSS-Regel gebaut',()=>{
  assert.match(build,/return '\.rc352-cover\{\+'?/, 'Deckblatt-Regel muss explizit wieder zusammengesetzt werden');
  assert.match(build,/return '\.rc352-cover\{'\+next\+'\}'/,'schließende CSS-Klammer der Deckblatt-Regel fehlt');
  assert.match(build,/background:linear-gradient\(180deg,#1d4ed8 0,#60a5fa 66mm,#dbeafe 66mm,#eff6ff 100%\)/,'farbige Deckblattfläche fehlt');
  assert.match(build,/background:#facc15/,'gelbes Referenzfeld fehlt');
});
