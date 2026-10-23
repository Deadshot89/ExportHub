import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const catalog=JSON.parse(fs.readFileSync('assets/training-center/catalog/employee-sops.json','utf8'));
test('RC1645: five distinct employee SOPs are available across all six languages',()=>{
 assert.deepEqual(catalog.languages,['de','en','pl','es','fr','it']);
 const ids=['customers-create','customers-edit','abd-manual','pickup-qr-reopen','documents-reprint'];
 for(const lang of catalog.languages){
  assert.deepEqual(catalog.sops[lang].map(x=>x.id),ids,lang);
  for(const item of catalog.sops[lang]){
   assert.equal(item.steps.length,5,item.id+' '+lang);
   assert.ok(item.title.length>8);
   assert.ok(item.steps.every((s,i)=>s.order===i+1&&s.stepId&&s.instruction.length>30));
  }
 }
});
test('RC1645: no screenshot or existing UI selector is falsely marked verified',()=>{
 for(const lang of catalog.languages)for(const sop of catalog.sops[lang])for(const step of sop.steps){
  assert.equal(step.uiTargetVerified,false);
  assert.equal(step.screenshotVerified,false);
  assert.ok(!('screenshotUrl' in step));
  assert.ok(!('targetSelector' in step));
 }
 assert.equal(catalog.status,'requires-live-ui-review');
});
test('RC1645: reprinting and QR reopen must not inadvertently issue a new shipping action',()=>{
 for(const lang of catalog.languages){
  const list=catalog.sops[lang];
  for(const id of ['pickup-qr-reopen','documents-reprint']){
    const sop=list.find(p=>p.id===id);
    assert.ok(sop&&sop.steps.length>0);
  }
 }
 const de=catalog.sops.de;
 assert.match(de.find(x=>x.id==='pickup-qr-reopen').steps.at(-1).instruction,/keinen neuen QR-Code/);
 assert.match(de.find(x=>x.id==='documents-reprint').steps.at(-1).instruction,/doppelte Druckaufträge/);
});
test('RC1645: existing shipping UI and build scripts remain untouched by the editorial SOP catalog',()=>{
 const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
 assert.ok(!builder.includes('employee-sops.json'));
});
