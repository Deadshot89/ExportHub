import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const builder=fs.readFileSync(new URL('../.github/rc1112/build-three-env.mjs',import.meta.url),'utf8');

test('RC1741: Menüprüfung zählt Zusatzknöpfe (Packmeldungen, Verpackungen) nicht als Fehler',()=>{
  assert.match(html,/var ADDON_BUTTONS='\[data-pack-notifications-nav\],\[data-rc1555-packaging-nav\]';/);
  const valid=html.slice(html.indexOf('function menuValid(nav){'),html.indexOf('\nfunction normalizeMenu(){'));
  assert.match(valid,/\.filter\(function\(b\)\{return !addonButton\(b\)\}\)/,'menuValid must ignore add-on buttons');
});

test('RC1741: normalizeMenu behält Zusatzknöpfe an ihrer Stelle statt sie zu entfernen',()=>{
  const start=html.indexOf('\nfunction normalizeMenu(){');
  const body=html.slice(start,html.indexOf('\nfunction buildMenu(){',start));
  assert.match(body,/var addons=Array\.prototype\.slice\.call\(nav\.querySelectorAll\(':scope>button'\)\)\.filter\(addonButton\)/);
  assert.match(body,/addons\.forEach\(function\(a\)\{[^}]*fragment\.insertBefore\(a\.node,a\.after\.nextSibling\)[^}]*\}\);nav\.replaceChildren\(fragment\)/);
});

test('RC1741: Build überträgt die kanonische Menüprüfung in Produktion, TESTSERVICE und Demo (nach RC1680)',()=>{
  const rc1741=builder.indexOf('// RC1741 Menü ohne Flackern');
  assert.ok(rc1741>builder.indexOf('// RC1680:'),'block must come after the RC1680 loop');
  const block=builder.slice(rc1741);
  assert.match(block,/for\(const file of \['index\.html','TESTVERSION\.html','demo\.html'\]\)/);
  assert.match(block,/RC1741 Menü-Zusatzknöpfe fehlen/);
});
