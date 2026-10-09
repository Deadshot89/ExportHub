import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(){
  const source=fs.readFileSync('assets/packaging-catalog.js','utf8');
  const root={};
  vm.runInContext(source,vm.createContext({window:root,globalThis:root,Object,String,Array}),{filename:'packaging-catalog.js'});
  return root.ExportHubPackagingCatalog;
}

test('shared packaging catalog exposes canonical ExportHUB pallet dimensions without invented height',()=>{
  const catalog=load();
  for(const [name,length,width] of [
    ['Düsseldorfer Palette',80,60],
    ['Kunststoffpalette',122,116],
    ['Industrie Palette',120,100],
    ['Palettengestell',120,90],
    ['Euro Palette',120,80],
    ['Einwegpalette',120,80]
  ]){
    const item=catalog.get(name);
    assert.ok(item,`${name} fehlt`);
    assert.equal(item.length,length);
    assert.equal(item.width,width);
    assert.equal(item.height,null,`${name}: unbekannte Höhe darf nicht erfunden werden`);
  }
});

test('shared packaging catalog resolves aliases used by existing shipment UI',()=>{
  const catalog=load();
  assert.equal(catalog.get('Europalette').label,'Euro Palette');
  assert.equal(catalog.get('Euro-Palette').label,'Euro Palette');
  assert.equal(catalog.get('Industriepalette').label,'Industrie Palette');
  assert.equal(catalog.get('Dusseldorfer Palette').label,'Düsseldorfer Palette');
  assert.equal(catalog.get('Kunststoff Palette').label,'Kunststoffpalette');
});

test('shared packaging catalog list returns safe copies and unknown packaging returns null',()=>{
  const catalog=load();
  const list=catalog.list();
  assert.ok(Array.isArray(list));
  assert.ok(list.some(item=>item.label==='Euro Palette'));
  list[0].label='MUTATED';
  assert.notEqual(catalog.list()[0].label,'MUTATED');
  assert.equal(catalog.get('Unbekannte Spezialkiste'),null);
});
