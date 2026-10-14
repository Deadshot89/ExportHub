import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

function audit(){
  const output=execFileSync(process.execPath,['scripts/i18n-audit.mjs','--json'],{encoding:'utf8'});
  return JSON.parse(output);
}

test('RC1523 SOPMaster hinterlässt keine hardcodierten deutschen UI-Texte im strikten i18n-Audit',()=>{
  const report=audit();
  const findings=(report.hardcodedGermanUi||[]).filter(item=>
    item.file==='assets/exporthub-demo-bootstrap.js'||String(item.file||'').startsWith('assets/sop/')
  );
  assert.deepEqual(findings,[],`SOPMaster/i18n Release-Blocker: ${findings.map(item=>`${item.file}:${item.line} ${item.literal}`).join(' | ')}`);
});
