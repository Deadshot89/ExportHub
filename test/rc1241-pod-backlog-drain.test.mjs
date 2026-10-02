import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const api=fs.readFileSync('api/pod-backup-reconcile/index.js','utf8');
const workflow=fs.readFileSync('.github/workflows/rc1144-pod-backup-reconcile.yml','utf8');

test('RC1241: vollständige Nachholung deaktiviert den Altersfilter nur im signierten Drain-Modus',()=>{
  assert.match(api,/const drainAll = !reference && payload\.drainAll === true/);
  assert.match(api,/minAgeMs: reference \|\| drainAll \? 0 : 5 \* 60 \* 1000/);
  assert.match(api,/reference: reference \|\| null, drainAll/);
  assert.match(api,/version: 'RC1241'/);
});

test('RC1241: TESTSERVICE und Produktion fordern vollständiges Leeren des Backlogs an',()=>{
  assert.equal((workflow.match(/for batch in \$\(seq 1 50\); do/g)||[]).length,2);
  assert.equal((workflow.match(/drainAll:!reference/g)||[]).length,2);
  assert.equal((workflow.match(/scanPageSize:10/g)||[]).length,2);
  assert.equal((workflow.match(/const requiredDone=eligible===0&&selected===0&&skipped===0&&!v\.nextContinuationToken&&!v\.pageWorkDeferred/g)||[]).length,2);
  assert.equal((workflow.match(/if\(requiredDone\)\{process\.stdout\.write\('done'\);return\}/g)||[]).length,2);
  assert.equal((workflow.match(/if\(selected<=0&&!v\.nextContinuationToken&&!v\.pageWorkDeferred\)process\.exit\(7\)/g)||[]).length,2);
  assert.equal((workflow.match(/continuation_token=/g)||[]).length>=2,true);
  assert.equal((workflow.match(/pageWorkDeferred:v\.pageWorkDeferred/g)||[]).length,2);
});

test('RC1241: Pending und Fehler bleiben in beiden Umgebungen harte Fehler',()=>{
  assert.match(workflow,/Number\(v\.errorCount\|\|0\)>0\|\|Number\(v\.pendingCount\|\|0\)>0\)process\.exit\(3\)/);
  assert.match(workflow,/Number\(v\.errorCount\|\|0\)>0\|\|Number\(v\.pendingCount\|\|0\)>0\)process\.exit\(4\)/);
  assert.equal((workflow.match(/Backlog nach 50 Batches noch nicht vollständig geleert/g)||[]).length,2);
  assert.equal((workflow.match(/exit 8/g)||[]).length,2);
});

test('RC1241: gezielter Referenznachweis bleibt streng und Drain verändert keine Produktlogik',()=>{
  assert.equal((workflow.match(/\['already-saved','saved-now'\]\.includes\(v\.target\.status\)/g)||[]).length,2);
  assert.match(api,/const reference = text\(payload\.reference\)\.toUpperCase\(\)/);
  assert.doesNotMatch(api,/TEAM_BLOB|shipments\s*=|customers\s*=/);
});

test('RC1241: geänderte Reconcile-Dateien sind syntaktisch gültig',()=>{
  execFileSync(process.execPath,['--check','api/pod-backup-reconcile/index.js'],{stdio:'pipe'});
});


test('RC1416: optionale Microsoft-365-Backfills blockieren einen leeren verpflichtenden Azure-Backlog nicht',()=>{
  assert.equal((workflow.match(/driveBackfillSelected:v\.driveBackfillSelected/g)||[]).length,2);
  assert.equal((workflow.match(/drivePendingCount:v\.drivePendingCount/g)||[]).length,2);
  assert.equal((workflow.match(/const requiredDone=eligible===0&&selected===0&&skipped===0&&!v\.nextContinuationToken&&!v\.pageWorkDeferred/g)||[]).length,2);
  assert.doesNotMatch(workflow,/requiredDone[^\n]*driveBackfill/);
  assert.doesNotMatch(workflow,/requiredDone[^\n]*scanComplete/);
});
