import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync('assets/rc1900-neue-sendungsuebersicht.js','utf8');
const css=fs.readFileSync('assets/rc1900-neue-sendungsuebersicht.css','utf8');
const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

test('RC1900: neue Sendungsübersicht greift nur im Design "Neu"',()=>{
  assert.match(js,/hasAttribute\('data-eh-newui'\)/);
  assert.match(js,/classList\.contains\('rc524-overview-view'\)/);
  assert.match(css,/^#rc1900Overview\{display:none\}/m);
  assert.match(css,/html\[data-eh-newui\]\[data-rc1900-view="overview"\] #rc1900Overview\{display:block\}/);
});

test('RC1900: Abläufe bleiben die alten (Aktionen werden an die bestehende Übersicht weitergereicht)',()=>{
  // keine eigene Geschäftslogik, keine eigenen Speicher- oder Netzwerkzugriffe
  assert.doesNotMatch(js,/fetch\(|XMLHttpRequest|localStorage|sessionStorage|rc524DeleteShipment|rc542ManualPickup/);
  assert.match(js,/el\.click\(\)/);
  assert.match(js,/inp\.click\(\)/);
  assert.match(js,/dispatchEvent\(new Event\('input'/);
  assert.match(js,/dispatchEvent\(new Event\('change'/);
  // alte Ansicht bleibt im DOM, nur unsichtbar
  assert.doesNotMatch(js,/getElementById\('content'\)\.remove|content\.remove\(|innerHTML\s*=\s*''/);
  assert.match(css,/#content\.rc524-overview-view\{\s*position:fixed!important;left:-10000px!important/);
  assert.doesNotMatch(css,/#content[^{]*\{[^}]*display:none/);
});

test('RC1900: Rechte und Filter der alten Übersicht gelten weiter',()=>{
  assert.match(js,/el\.hidden\|\|el\.getAttribute\('aria-hidden'\)==='true'/);
  assert.match(js,/st!=='none'/);
  assert.match(js,/el\.disabled/);
  assert.match(js,/data-rc1900-classic/);
});

test('RC1900: Builder bindet Skript und Stylesheet ein',()=>{
  assert.match(builder,/rc1900-neue-sendungsuebersicht\.css\?v=1930/);
  assert.match(builder,/rc1900-neue-sendungsuebersicht\.js\?v=1930/);
  assert.match(builder,/'assets\/rc1900-neue-sendungsuebersicht\.js'/);
  assert.match(builder,/RC1900 neue Sendungsübersicht fehlt/);
});
