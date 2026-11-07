import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync('assets/rc1901-neue-sendungsansicht.js','utf8');
const css=fs.readFileSync('assets/rc1901-neue-sendungsansicht.css','utf8');
const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const langs=['de','en','fr','it','es','pl'];

test('RC1901: neue Sendungsansicht greift nur im Design "Neu"',()=>{
  assert.match(js,/getAttribute\('data-eh-layout'\)!=='top'/);
  assert.match(js,/classList\.contains\('rc776-shipment-view'\)/);
  assert.match(css,/^#rc1901Shipment\{display:none\}/m);
  assert.match(css,/html\[data-eh-layout="top"\]\[data-rc1901-view="shipment"\] #rc1901Shipment\{display:block\}/);
});

test('RC1901: Abläufe bleiben die alten (keine eigene Logik, alte Ansicht bleibt im DOM)',()=>{
  assert.doesNotMatch(js,/fetch\(|XMLHttpRequest|localStorage|sessionStorage/);
  assert.match(js,/el\.click\(\)/);
  assert.match(js,/if\(el&&!el\.disabled\)/);
  assert.doesNotMatch(js,/content\(\)\.remove|content\.remove\(|innerHTML\s*=\s*''/);
  assert.match(css,/#content\.rc776-shipment-view\{\s*position:fixed!important;left:-10000px!important/);
  assert.doesNotMatch(css,/#content[^{]*\{[^}]*display:none/);
});

test('RC1901: Bereiche mit eigener Logik werden umgehängt, nicht nachgebaut',()=>{
  for(const id of ['rc786ReferenceFilesCard','rc845AvisReadHost','rc1071ShipmentHistory'])assert.ok(js.includes("'#"+id+"'"),id);
  // RC1860 erwartet die Versanddokumentation direkt hinter der Dateikarte
  assert.match(js,/adopt\(root,'docs',proof,files\)/);
  // doppelte IDs werden entfernt, bevor andere Module danach suchen
  assert.match(js,/querySelectorAll\('#'\+el\.id\)/);
});

test('RC1901: eigene Behälter lösen keine falschen Historien-Einträge aus',()=>{
  // RC1071 wertet den Text des nächsten section/.card-Behälters aus ("…speichern" => "Sendung manuell gespeichert")
  assert.doesNotMatch(js,/createElement\('section'\)|<section[\s>]/);
  assert.doesNotMatch(js,/class="(?:[^"]*\s)?(card|panel|field)(?:\s|")/);
});

test('RC1901: Texte kommen aus den Sprachdateien',()=>{
  const keys=[...js.matchAll(/'(rc1901\.[A-Za-z]+)'/g)].map(m=>m[1]);
  assert.ok(keys.length>=10);
  for(const lang of langs){
    const dict=JSON.parse(fs.readFileSync(`assets/i18n/${lang}.json`,'utf8'));
    for(const k of keys)assert.ok(dict[k],`${lang}: ${k}`);
  }
  assert.match(js,/data-i18n-ignore/);
});

test('RC1901: Builder bindet Skript und Stylesheet ein',()=>{
  assert.match(builder,/rc1901-neue-sendungsansicht\.css\?v=1901/);
  assert.match(builder,/rc1901-neue-sendungsansicht\.js\?v=1901/);
  assert.match(builder,/'assets\/rc1901-neue-sendungsansicht\.js'/);
  assert.match(builder,/RC1901 neue Sendungsansicht fehlt/);
});
