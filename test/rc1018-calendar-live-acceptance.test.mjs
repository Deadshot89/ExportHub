import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflowPath='.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';
const flow=fs.readFileSync(workflowPath,'utf8');
const probe=fs.readFileSync('production-version.js','utf8');
const match=probe.match(/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC(\d+)'/);
assert.ok(match,'Autoritativer Produktions-RC fehlt');
const rc=Number(match[1]);

test('RC1018 Kalenderbasis wird im aktuellen gemeinsamen Release in allen drei Umgebungen geprüft',()=>{
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    assert.match(flow,new RegExp(`assets/abholkalender\\.js\\?v=1012[^\\n]*dist-rc${rc}/${file.replace('.','\\.')}`));
    assert.match(flow,new RegExp(`assets/rc1012-abholkalender-runtime\\.js\\?v=1012[^\\n]*dist-rc${rc}/${file.replace('.','\\.')}`));
  }
  assert.match(flow,new RegExp(`test -s dist-rc${rc}\\/assets\\/abholkalender\\.js`));
  assert.match(flow,new RegExp(`test -s dist-rc${rc}\\/assets\\/rc1012-abholkalender-runtime\\.js`));
});

test('Aktuelle Liveprüfung lädt die Kalenderassets aus Produktion und TESTSERVICE',()=>{
  assert.match(flow,new RegExp(`\\$prod\\/assets\\/abholkalender\\.js\\?rc${rc}=`));
  assert.match(flow,new RegExp(`\\$testservice\\/assets\\/abholkalender\\.js\\?rc${rc}=`));
  assert.match(flow,new RegExp(`\\$prod\\/assets\\/rc1012-abholkalender-runtime\\.js\\?rc${rc}=`));
  assert.match(flow,new RegExp(`\\$testservice\\/assets\\/rc1012-abholkalender-runtime\\.js\\?rc${rc}=`));
  assert.match(flow,/calendarScalarText/);
  assert.match(flow,/companyId/);
});
