import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');

test('RC1544: integrierter Release-Builder liefert Guided-Workspace in allen drei Umgebungen aus',()=>{
  const builder=read('.github/rc1521/build-three-env.mjs');
  assert.match(builder,/rc1544-sop-guided-i18n\.json/);
  assert.match(builder,/rc1544-sop-guided-i18n\.js/);
  assert.match(builder,/rc1544-sop-guided-workspace\.js/);
  assert.match(builder,/rc1544-sop-guided-workspace\.css/);
  assert.match(builder,/exporthub-rc1544-sop-guided-i18n-data/);
  assert.match(builder,/exporthub-rc1544-sop-guided-workspace/);
  assert.match(builder,/exporthub-rc1544-sop-guided-workspace-style/);
});

test('RC1544: stabiler RC1112-Produktionsbuilder übernimmt Guided-Workspace additiv',()=>{
  const builder=read('.github/rc1112/build-three-env.mjs');
  assert.match(builder,/integrateGuidedWorkspace/,'RC1112 importiert Guided-Integration nicht');
  assert.match(builder,/integrateGuidedWorkspace\(ROOT,OUT\)/,'RC1112 ruft Guided-Integration nicht auf');
  const guidedAt=builder.indexOf('integrateGuidedWorkspace(ROOT,OUT)');
  const coverageAt=builder.indexOf('integrateCoverageAdmin(ROOT,OUT)');
  assert.ok(guidedAt>coverageAt,'Guided-Workspace muss nach den bestehenden SOPMaster-Overlays integriert werden');
});

test('RC1544: Browser-Release-Gate prüft den geführten Workspace auf Desktop und Mobile',()=>{
  const workflow=read('.github/workflows/sopmaster-release-candidate.yml');
  assert.match(workflow,/sopmaster-guided-workspace\.spec\.mjs/);
  assert.match(workflow,/--project=desktop/);
  assert.match(workflow,/--project=mobile-standard/);
});

test('RC1544: Bedienoberfläche ist in allen sechs ExportHUB-Sprachen vorbereitet',()=>{
  const translations=JSON.parse(read('assets/sop/rc1544-sop-guided-i18n.json'));
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
  for(const language of languages){
    assert.ok(translations[language],`${language}: Sprachsatz fehlt`);
    for(const key of keys)assert.equal(typeof translations[language][key],'string',`${language}: ${key} fehlt`);
  }
});

test('RC1544: produktive Guided-JavaScripts enthalten keine fest codierten deutschen UI-Fallbacks',()=>{
  const workspace=read('assets/sop/rc1544-sop-guided-workspace.js');
  const bridge=read('assets/sop/rc1544-sop-guided-i18n.js');
  for(const literal of ['Zurück','Weiter','Benötigte Informationen','Hinweis / Risiko','Bild für diesen Schritt noch nicht hinterlegt']){
    assert.equal(workspace.includes(literal),false,`Workspace enthält deutschen Fallback: ${literal}`);
    assert.equal(bridge.includes(literal),false,`i18n-Bridge enthält deutschen Fallback: ${literal}`);
  }
});
