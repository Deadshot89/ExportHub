import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const API='api/exporthub-release/index.js';
const WF='.github/workflows/rc1153-testservice-sync.yml';

test('RC1154: deployte Testversion wird über den eindeutigen Environment-Buildmarker erkannt',()=>{
  const api=fs.readFileSync(API,'utf8');
  assert.match(api,/function detectDeployedVersion\(html\)/,'dedizierte Deploy-Versionserkennung fehlt');
  assert.match(api,/ExportHUB\\s\+\(RC\\d\+\)\\s\+environment=/,'Environment-Buildmarker wird nicht bevorzugt');
  assert.match(api,/detected=detectDeployedVersion\(html\)/,'Aktivierung nutzt noch die unspezifische historische Versionserkennung');
});

test('RC1154: Änderung an der Release-API startet den unabhängigen TESTSERVICE-Sync erneut',()=>{
  const wf=fs.readFileSync(WF,'utf8');
  assert.match(wf,/api\/exporthub-release\/index\.js/,'Release-API ist kein Trigger des TESTSERVICE-Syncs');
  assert.match(wf,/Deploy nur TESTSERVICE/);
  assert.doesNotMatch(wf,/Deploy ExportHUB production/);
});
