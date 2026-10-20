import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');

test('RC1544: integrierter Release-Builder liefert Guided-Workspace in allen drei Umgebungen aus',()=>{
  const builder=read('.github/packmeldungen/build-three-env.mjs');
  assert.match(builder,/integrateGuidedWorkspace/);
  const training=read('.github/training-center/build-three-env.mjs');
  assert.match(training,/removeRetiredSopTagsFromBuild/);
  assert.match(training,/fs\.rmSync\(path\.join\(out,'assets','sop'\)/);
  const integration=read('.github/rc1544/integrate-guided-workspace.mjs');
  assert.match(integration,/rc1544-sop-guided-i18n\.json/);
  assert.match(integration,/rc1544-sop-guided-i18n\.js/);
  assert.match(integration,/rc1544-sop-guided-workspace\.js/);
  assert.match(integration,/rc1544-sop-guided-workspace\.css/);
  assert.match(integration,/exporthub-rc1544-sop-guided-i18n-data/);
  assert.match(integration,/exporthub-rc1544-sop-guided-workspace/);
  assert.match(integration,/exporthub-rc1544-sop-guided-workspace-style/);
});

test('RC1544: finaler Pack-/Production-Builder integriert Guided-Workspace nach dem finalen Build-Schritt',()=>{
  const builder=read('.github/packmeldungen/build-three-env.mjs');
  assert.match(builder,/integrateGuidedWorkspace/,'Pack-/Production-Builder importiert Guided-Integration nicht');
  assert.match(builder,/integrateGuidedWorkspace\(root,out\)/,'Pack-/Production-Builder ruft Guided-Integration nicht auf');
  const guidedAt=builder.indexOf('integrateGuidedWorkspace(root,out)');
  const finalizeAt=builder.indexOf('finalizeAutoUpdate({root,out})');
  assert.ok(guidedAt>finalizeAt,'Guided-Workspace muss nach dem finalen Auto-Update in das fertige Production-Paket integriert werden');
});

test('RC1544: Browser-Release-Gate prüft den geführten Workspace auf Desktop und Mobile',()=>{
  const workflow=read('.github/workflows/sopmaster-release-candidate.yml');
  assert.match(workflow,/training-center-tour\.spec\.mjs/);
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
