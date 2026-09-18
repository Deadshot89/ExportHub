import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const API='api/exporthub-release/index.js';
const WF='.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';

test('RC1153: Release-Center kann den frisch deployten TESTSERVICE per GitHub OIDC als aktive Testversion übernehmen',()=>{
  const api=fs.readFileSync(API,'utf8');
  const wf=fs.readFileSync(WF,'utf8');

  assert.match(api,/exporthub-release-activate-test/,'dedizierte OIDC-Audience für Release-Aktivierung fehlt');
  assert.match(api,/activate-deployed-test/,'serverseitige Aktivierungsaktion fehlt');
  assert.match(api,/claims\.repository/,'GitHub Repository-Claim muss geprüft werden');
  assert.match(api,/claims\.ref\s*!==\s*['"]refs\/heads\/main['"]/,'nur main darf Testversion aktivieren');
  assert.match(api,/TESTVERSION\.html/,'Aktivierung muss den tatsächlich deployten TESTSERVICE prüfen');
  assert.match(api,/detectVersion\(/,'Version des deployten HTML muss serverseitig validiert werden');
  assert.match(api,/m\.test\s*=\s*v/,'Manifest muss auf die deployte RC gesetzt werden');

  const deployPos=wf.indexOf('Deploy ExportHUB TESTSERVICE');
  const activatePos=wf.indexOf('Release-Center aktive Testversion auf deployten Stand setzen');
  const browserPos=wf.indexOf('RC1124 TESTSERVICE Browser Gate');
  assert.ok(deployPos>=0,'TESTSERVICE-Deploy fehlt');
  assert.ok(activatePos>deployPos,'Release-Center-Aktivierung muss nach dem TESTSERVICE-Deploy laufen');
  assert.ok(browserPos>activatePos,'Live-Browser-Gate muss erst nach der Manifest-Aktivierung laufen');
  assert.match(wf,/audience=exporthub-release-activate-test/,'Workflow fordert kein passendes OIDC-Token an');
  assert.match(wf,/action=activate-deployed-test/,'Workflow ruft die Aktivierungsaktion nicht auf');
  assert.match(wf,/"version":"RC1112"/,'Workflow übergibt die erwartete Testversion nicht');
});
