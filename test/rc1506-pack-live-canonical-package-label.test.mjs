import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadCatalog(){
  const source=fs.readFileSync('assets/packaging-catalog.js','utf8');
  const root={};
  vm.runInContext(source,vm.createContext({window:root,globalThis:root,Object,String,Array,Map,Set}),{filename:'packaging-catalog.js'});
  return root.ExportHubPackagingCatalog;
}

test('RC1552/RC1506: legacy Euro-pallet alias canonicalizes without an independent production list',()=>{
  const catalog=loadCatalog();
  assert.equal(catalog.canonicalLabel('Europalette'),'Euro Palette');
  assert.equal(catalog.canonicalLabel('Euro-Palette'),'Euro Palette');

  const helper=fs.readFileSync('e2e/helpers/pack-notification-live.mjs','utf8');
  assert.match(helper,/selectOption\(\{label:'Euro Palette'\}\)/,'RC1499 live helper must select the canonical visible catalog label');
  assert.doesNotMatch(helper,/selectOption\(\{label:'Europalette'\}\)/,'stale alias must not be used as a visible select label');
});
