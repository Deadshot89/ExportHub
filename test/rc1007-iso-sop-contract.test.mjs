import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('SOP-Katalog ist auf RC1008 und reine ExportHUB-System-SOPs umgestellt',async()=>{
  await import('../assets/sop/rc1007-sop-catalog.js');
  const catalog=globalThis.ExportHubIsoSopCatalog;
  assert.equal(catalog.version,'RC1008');
  assert.equal(catalog.systemOnly,true);
  assert.equal(catalog.documents.length,75);
  assert.ok(catalog.documents.every(doc=>/^SOP-EH-\d{3}$/.test(doc.number)));
});

test('ISO-SOPs bleiben vom alten customSops-Bestand getrennt',()=>{
  const merge=read('api/shared/merge.js');
  assert.match(merge,/isoSops:\s*\['id',\s*'number'/);
  const ui=read('assets/sop/rc1007-sop-ui.js');
  assert.doesNotMatch(ui,/customSops\b/);
});

test('SOP-Modul ist in Produktion und TESTVERSION eingebunden',()=>{
  for(const file of ['index.html','TESTVERSION.html']){
    const src=read(file);
    assert.match(src,/assets\/sop\/rc1007-sop-catalog\.js/);
    assert.match(src,/assets\/sop\/rc1007-sop-ui\.js/);
    assert.match(src,/assets\/sop\/rc1007-sop\.css/);
  }
});
