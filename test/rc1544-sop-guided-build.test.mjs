import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');

test('RC1544: integrierter Release-Builder liefert Guided-Workspace in allen drei Umgebungen aus',()=>{
  const builder=read('.github/rc1521/build-three-env.mjs');
  assert.match(builder,/rc1544-sop-guided-workspace\.js/);
  assert.match(builder,/rc1544-sop-guided-workspace\.css/);
  assert.match(builder,/exporthub-rc1544-sop-guided-workspace/);
  assert.match(builder,/exporthub-rc1544-sop-guided-workspace-style/);
});

test('RC1544: Browser-Release-Gate prüft den geführten Workspace auf Desktop und Mobile',()=>{
  const workflow=read('.github/workflows/sopmaster-release-candidate.yml');
  assert.match(workflow,/sopmaster-guided-workspace\.spec\.mjs/);
  assert.match(workflow,/--project=desktop/);
  assert.match(workflow,/--project=mobile-standard/);
});

test('RC1544: Bedienoberfläche ist in allen sechs ExportHUB-Sprachen vorbereitet',async()=>{
  await import('../assets/sop/rc1544-sop-guided-workspace.js');
  const translations=globalThis.ExportHubSopGuidedWorkspace&&globalThis.ExportHubSopGuidedWorkspace.translations;
  const languages=['de','en','pl','es','fr','it'];
  const keys=[
    'sop.guided.catalog',
    'sop.guided.back',
    'sop.guided.complete',
    'sop.guided.next',
    'sop.guided.required',
    'sop.guided.missingImage',
    'sop.guided.requiredInfo',
    'sop.guided.risk'
  ];
  assert.ok(translations,'lokales RC1544 Sprachwörterbuch fehlt');
  for(const language of languages){
    assert.ok(translations[language],`${language}: Sprachsatz fehlt`);
    for(const key of keys)assert.equal(typeof translations[language][key],'string',`${language}: ${key} fehlt`);
  }
});
