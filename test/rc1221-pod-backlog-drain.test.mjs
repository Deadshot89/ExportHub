import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const api=fs.readFileSync('api/pod-backup-reconcile/index.js','utf8');
const workflow=fs.readFileSync('.github/workflows/rc1144-pod-backup-reconcile.yml','utf8');

test('RC1221: vollständige Nachholung deaktiviert den Altersfilter nur im OIDC-geschützten Reconcile',()=>{
  assert.match(api,/const drainAll = !reference && payload\.drainAll === true/);
  assert.match(api,/minAgeMs: reference \|\| drainAll \? 0 : 5 \* 60 \* 1000/);
  assert.match(api,/drainAll \}, result/);
  assert.match(api,/version:\s*'RC1221'/);
});

test('RC1221: Workflow fordert vollständiges Leeren des Backlogs an',()=>{
  assert.match(workflow,/drainAll:!reference/);
  assert.equal((workflow.match(/for batch in \$\(seq 1 10\); do/g)||[]).length,2);
  assert.match(workflow,/eligible:v\.eligible/);
  assert.match(workflow,/selected:v\.selected/);
  assert.match(workflow,/skippedRecent:v\.skippedRecent/);
});

test('RC1221: ein Reconcile gilt erst bei wirklich leerem Backlog als fertig',()=>{
  assert.equal((workflow.match(/eligible===0&&selected===0&&skipped===0/g)||[]).length,2);
  assert.equal((workflow.match(/if\(selected<=0\)process\.exit\(7\)/g)||[]).length,2);
  assert.match(workflow,/Backlog nach 10 Batches noch nicht vollständig geleert/);
  assert.match(workflow,/exit 8/);
});

test('RC1221: Pending oder Fehler bleiben harte Fehler',()=>{
  assert.match(workflow,/Number\(v\.errorCount\|\|0\)>0\|\|Number\(v\.pendingCount\|\|0\)>0\)process\.exit\(3\)/);
  assert.match(workflow,/Number\(v\.errorCount\|\|0\)>0\|\|Number\(v\.pendingCount\|\|0\)>0\)process\.exit\(4\)/);
});

test('RC1221: gezielter Referenznachweis bleibt unverändert streng',()=>{
  assert.match(workflow,/\['already-saved','saved-now'\]\.includes\(v\.target\.status\)/);
  assert.match(workflow,/process\.exit\(5\)/);
  assert.match(workflow,/process\.exit\(6\)/);
});

test('RC1221: Reconcile-API bleibt syntaktisch gültig',()=>{
  execFileSync(process.execPath,['--check','api/pod-backup-reconcile/index.js'],{stdio:'pipe'});
});
