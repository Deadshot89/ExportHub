import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadCatalog(){
  const source=fs.readFileSync('assets/packaging-catalog.js','utf8');
  const root={};
  vm.runInContext(source,vm.createContext({window:root,globalThis:root,Object,String,Array}),{filename:'packaging-catalog.js'});
  return root.ExportHubPackagingCatalog;
}

test('RC1504: RC1499 live flow selects the canonical Euro pallet label from the shared packaging catalog',()=>{
  const catalog=loadCatalog();
  const euro=catalog.get('Europalette');
  assert.ok(euro,'Europalette alias must resolve in the shared packaging catalog');
  assert.equal(euro.label,'Euro Palette');

  const helper=fs.readFileSync('e2e/helpers/pack-notification-live.mjs','utf8');
  assert.match(helper,/selectOption\(\{label:'Euro Palette'\}\)/,'RC1499 live helper must select the canonical visible catalog label');
  assert.doesNotMatch(helper,/selectOption\(\{label:'Europalette'\}\)/,'stale alias must not be used as a visible select label');
});
