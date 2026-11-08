import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync('assets/rc1902-neue-sendungsmaske.js','utf8');
const css=fs.readFileSync('assets/rc1902-neue-sendungsmaske.css','utf8');
const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const langs=['de','en','fr','it','es','pl'];

test('RC1902: neue Steuerleiste greift nur im Design "Neu" und nur in der Sendungsmaske',()=>{
  assert.match(js,/hasAttribute\('data-eh-newui'\)/);
  assert.match(js,/getElementById\('rc363FixedShipmentLayout'\)/);
  assert.match(js,/getAttribute\('data-exporthub-rendered-view'\)==='shipment'/);
  assert.match(css,/^#rc1902ShipmentForm\{display:none\}/m);
  assert.match(css,/html\[data-eh-newui\]\[data-rc1902-view="form"\] #rc1902ShipmentForm\{display:block\}/);
});

test('RC1902: Speichern und Ausgabe laufen über die bestehenden Knöpfe',()=>{
  assert.doesNotMatch(js,/fetch\(|XMLHttpRequest|localStorage|sessionStorage/);
  assert.match(js,/getElementById\('rc363SaveShipment'\)/);
  assert.match(js,/getElementById\('rc363OpenDocuments'\)/);
  assert.match(js,/if\(proxyBtn&&!proxyBtn\.disabled\)\{proxyBtn\.click\(\)/);
  // die Maske bleibt sichtbar und an ihrem Platz
  assert.doesNotMatch(js,/appendChild\(\w*block|insertBefore\(\w*block/i);
  assert.doesNotMatch(css,/#rc363FixedShipmentLayout[^{]*\{[^}]*display:none/);
});

test('RC1902: Klicks auf die Leiste erzeugen keine zusätzlichen Historien-Einträge',()=>{
  assert.match(js,/window\.addEventListener\('click',onClick,true\)/);
  assert.match(js,/ev\.stopPropagation\(\)/);
  assert.doesNotMatch(js,/createElement\('section'\)|<section[\s>]/);
  assert.doesNotMatch(js,/class="(?:[^"]*\s)?(card|panel|field)(?:\s|")/);
});

test('RC1902: Texte kommen aus den Sprachdateien',()=>{
  const keys=[...js.matchAll(/'(rc1902\.[A-Za-z]+)'/g)].map(m=>m[1]);
  assert.ok(keys.length>=6);
  for(const lang of langs){
    const dict=JSON.parse(fs.readFileSync(`assets/i18n/${lang}.json`,'utf8'));
    for(const k of keys)assert.ok(dict[k],`${lang}: ${k}`);
  }
  assert.match(js,/data-i18n-ignore/);
});

test('RC1902: Builder bindet Skript und Stylesheet ein',()=>{
  assert.match(builder,/rc1902-neue-sendungsmaske\.css\?v=1930/);
  assert.match(builder,/rc1902-neue-sendungsmaske\.js\?v=1932/);
  assert.match(builder,/'assets\/rc1902-neue-sendungsmaske\.js'/);
  assert.match(builder,/RC1902 neue Sendungsmaske fehlt/);
});
