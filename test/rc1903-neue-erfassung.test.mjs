import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync('assets/rc1903-neue-erfassung.js','utf8');
const css=fs.readFileSync('assets/rc1903-neue-erfassung.css','utf8');
const bar=fs.readFileSync('assets/rc1902-neue-sendungsmaske.js','utf8');
const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const langs=['de','en','fr','it','es','pl'];

test('RC1903: neue Erfassung greift nur im Design "Neu" und nur in der Sendungsmaske',()=>{
  assert.match(js,/getAttribute\('data-eh-layout'\)!=='top'/);
  assert.match(js,/getElementById\('rc363FixedShipmentLayout'\)/);
  assert.match(js,/getAttribute\('data-exporthub-rendered-view'\)==='shipment'/);
  assert.match(css,/^#rc1903Capture\{display:none\}/m);
});

test('RC1903: bisherige Maske bleibt gerendert und ist die einzige Datenquelle',()=>{
  // außerhalb des Bildschirms, nie display:none (Prüfungen und Messungen laufen weiter)
  assert.match(css,/data-rc1903-view="capture"\] #rc363FixedShipmentLayout#rc363FixedShipmentLayout\{position:fixed!important;left:-30000px/);
  assert.doesNotMatch(css,/#rc363FixedShipmentLayout[^{]*\{[^}]*display:none/);
  assert.doesNotMatch(js,/fetch\(|XMLHttpRequest|localStorage|sessionStorage/);
  // Eingaben gehen auf das bestehende Feld, Knöpfe lösen den bestehenden Knopf aus
  assert.match(js,/old\.value=t\.value/);
  assert.match(js,/fire\(old,ev\.type\)/);
  assert.match(js,/old\.click\(\)/);
  // bestehende Elemente werden nicht verschoben
  assert.doesNotMatch(js,/appendChild\(old|insertBefore\(old|\.append\(old/);
});

test('RC1903: Mailtext wird nicht gespiegelt (bestehende Logik übernimmt nur echte Eingaben)',()=>{
  assert.match(js,/data-rc1903-classic-focus/);
  assert.doesNotMatch(js,/field\(el,'rc1903-span2'\);\s*\n\s*\}\);\s*\n\s*var att/);
});

test('RC1903: Klicks und Eingaben in der neuen Erfassung erzeugen keine zusätzlichen Historien-Einträge',()=>{
  assert.match(js,/window\.addEventListener\('click',onClick,true\)/);
  assert.match(js,/window\.addEventListener\('input',forward,true\)/);
  assert.match(js,/ev\.stopPropagation\(\)/);
  assert.doesNotMatch(js,/createElement\('section'\)|<section[\s>]/);
  assert.doesNotMatch(js,/class="(?:[^"]*\s)?(card|panel|field)(?:\s|")/);
});

test('RC1903: Schrittnavigation der Steuerleiste springt zu den neuen Abschnitten',()=>{
  assert.match(js,/section:function\(id\)/);
  assert.match(bar,/rc1903NeueErfassung/);
});

test('RC1903: Texte kommen aus den Sprachdateien',()=>{
  const keys=[...new Set([...js.matchAll(/'(rc1903\.[A-Za-z]+)'/g)].map(m=>m[1]))];
  assert.ok(keys.length>=15);
  for(const lang of langs){
    const dict=JSON.parse(fs.readFileSync(`assets/i18n/${lang}.json`,'utf8'));
    for(const k of keys)assert.ok(dict[k],`${lang}: ${k}`);
  }
  assert.match(js,/data-i18n-ignore/);
});

test('RC1903: Builder bindet Skript und Stylesheet ein',()=>{
  assert.match(builder,/rc1903-neue-erfassung\.css\?v=1903/);
  assert.match(builder,/rc1903-neue-erfassung\.js\?v=1903/);
  assert.match(builder,/'assets\/rc1903-neue-erfassung\.js'/);
  assert.match(builder,/RC1903 neue Erfassung fehlt/);
});
