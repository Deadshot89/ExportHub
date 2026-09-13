import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime=fs.readFileSync('assets/rc1077-customer-labels.js','utf8');
const build=fs.readFileSync('.github/rc1048/build-three-env.mjs','utf8');

test('RC1077: Kundenansichten heißen Standorte statt Firma',()=>{
  assert.match(runtime,/q\(el\.textContent\)!=='Firma'/);
  assert.match(runtime,/el\.textContent='Standorte'/);
  assert.match(runtime,/data-rc1077-renamed/);
  assert.match(runtime,/v==='customers'/);
  assert.match(runtime,/v==='customerfolder'/);
});

test('RC1077: Formulare und andere Ansichten werden nicht pauschal umbenannt',()=>{
  assert.match(runtime,/closest\('form,label'\)/);
  assert.match(runtime,/if\(!active\)return false/);
  assert.doesNotMatch(runtime,/replaceAll\(['"]Firma['"],['"]Standorte['"]\)/);
});

test('RC1077: Kundenüberschriften dürfen nicht mehr abgeschnitten werden',()=>{
  assert.match(runtime,/white-space:normal!important/);
  assert.match(runtime,/overflow:visible!important/);
  assert.match(runtime,/text-overflow:clip!important/);
  assert.match(runtime,/max-height:none!important/);
  assert.match(runtime,/data-rc1077-customer-view/);
});

test('RC1077: finaler Drei-Umgebungen-Build lädt den Kundenlayout-Fix überall',()=>{
  assert.match(build,/RC1077_CUSTOMER_LABELS_TAG/);
  assert.match(build,/assets\/rc1077-customer-labels\.js\?v=1077/);
  assert.match(build,/html=injectBeforeHeadClose\(html,RC1077_CUSTOMER_LABELS_TAG,RC1077_CUSTOMER_LABELS_ID\)/);
  assert.match(build,/assets\/rc1077-customer-labels\.js/);
  assert.match(build,/customerLabels:\{version:'RC1077'/);
});
