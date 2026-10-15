import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

test('Training Center contains no hardcoded German UI candidates in the strict i18n audit',()=>{
  const output=execFileSync(process.execPath,['scripts/i18n-audit.mjs','--json','--scope=assets/training-center'],{encoding:'utf8'});
  const audit=JSON.parse(output);
  assert.equal(audit.scope,'assets/training-center');
  assert.ok(audit.scannedFiles>0,'Training-Center-Scope muss produktive Dateien prüfen');
  const offenders=audit.hardcodedGermanUi||[];
  assert.deepEqual(offenders,[],`Training-Center-i18n muss vollständig über Übersetzungsschlüssel laufen. Gefunden: ${offenders.map((entry)=>`${entry.file}:${entry.line} ${entry.literal}`).join(' | ')}`);
});
