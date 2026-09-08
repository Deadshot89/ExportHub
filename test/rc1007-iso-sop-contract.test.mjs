import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('RC1007 besitzt genau 33 neue ISO-SOPs',()=>{
  const src=read('assets/sop/rc1007-sop-catalog.js');
  const numbers=[...src.matchAll(/number:\s*['"](SOP-(?:QM|SYS|LOG|WH|ORG)-\d{3})['"]/g)].map(m=>m[1]);
  assert.equal(numbers.length,33);
  assert.equal(new Set(numbers).size,33);
});

test('RC1007 trennt neue ISO-SOPs vom alten customSops-Bestand',()=>{
  const merge=read('api/shared/merge.js');
  assert.match(merge,/isoSops:\s*\['id',\s*'number'/);
  const ui=read('assets/sop/rc1007-sop-ui.js');
  assert.doesNotMatch(ui,/customSops\b/);
});

test('RC1007 ist in Produktion und TESTVERSION eingebunden',()=>{
  for(const file of ['index.html','TESTVERSION.html']){
    const src=read(file);
    assert.match(src,/assets\/sop\/rc1007-sop-catalog\.js/);
    assert.match(src,/assets\/sop\/rc1007-sop-ui\.js/);
    assert.match(src,/assets\/sop\/rc1007-sop\.css/);
  }
});
