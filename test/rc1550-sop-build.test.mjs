import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const integration=fs.readFileSync('.github/rc1550/integrate-sop-rebuild.mjs','utf8');
const builder=fs.readFileSync('.github/packmeldungen/build-three-env.mjs','utf8');

test('RC1550: Release-Integration kopiert und injiziert Katalog, UI und CSS',()=>{
  for(const asset of ['assets/sop/rc1550-sop-active-catalog.js','assets/sop/rc1550-sop-ui.js','assets/sop/rc1550-sop.css']) assert.match(integration,new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  for(const marker of ['exporthub-rc1550-sop-style','exporthub-rc1550-sop-active-catalog','exporthub-rc1550-sop-ui']) assert.match(integration,new RegExp(marker));
  assert.match(integration,/exporthub-rc1544-sop-guided-workspace/);
  assert.match(integration,/validateBundle/);
});

test('RC1550: produktiver Pack-Builder integriert SOP-Rebuild nach Guided Workspace',()=>{
  assert.match(builder,/integrateSopRebuild/);
  const guided=builder.indexOf('integrateGuidedWorkspace(root,out)');
  const rebuilt=builder.indexOf('integrateSopRebuild(root,out)');
  assert.ok(guided>=0&&rebuilt>guided,'RC1550 muss nach dem Guided Workspace injiziert werden');
});

test('RC1550: Script-Reihenfolge hält bestehende Wrapper aktiv und RC1550 autoritativ',()=>{
  assert.match(integration,/Guided-Workspace[^\n]*→[^\n]*RC1550|guided[^\n]*rc1550/i);
  assert.match(integration,/active-catalog[^\n]*sop-ui/i);
});
