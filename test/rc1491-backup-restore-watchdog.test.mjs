import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WATCHDOG='.github/workflows/rc1491-state-backup-restore-watchdog.yml';
const RUNBOOK='docs/rc1267-state-backup-lifecycle.md';

test('RC1491: Backup- und Restore-Betriebsfehler werden GitHub-intern idempotent eskaliert',()=>{
  assert.ok(fs.existsSync(WATCHDOG),'RC1491 Watchdog-Workflow fehlt');
  const source=fs.readFileSync(WATCHDOG,'utf8');

  assert.match(source,/workflow_run:/);
  assert.match(source,/RC1267 State Backup Lifecycle/);
  assert.match(source,/RC1137 State Compaction/);
  assert.match(source,/actions:\s*read/);
  assert.match(source,/issues:\s*write/);
  assert.match(source,/rc1267-state-backup\.yml/);
  assert.match(source,/rc1137-state-compaction\.yml/);
  assert.match(source,/listWorkflowRuns/);
  assert.match(source,/\[OPS\] State Backup\/Restore Watchdog/);
  assert.match(source,/exporthub-ops:state-backup-restore-watchdog/);
  assert.match(source,/listForRepo/);
  assert.match(source,/createComment/);
  assert.match(source,/state:\s*['"]open['"]/);
  assert.match(source,/state:\s*['"]closed['"]/);
});

test('RC1491: Watchdog schließt erst wenn beide überwachten Workflows gesund sind',()=>{
  const source=fs.readFileSync(WATCHDOG,'utf8');
  assert.match(source,/every\(item\s*=>\s*item\.healthy\)/);
  assert.match(source,/run\.conclusion\s*===\s*['"]success['"]/);
});

test('RC1491: Betriebs-Issue enthält nur Statusmetadaten, keine Backup-Nutzdaten',()=>{
  const source=fs.readFileSync(WATCHDOG,'utf8');
  assert.doesNotMatch(source,/backupBlob|backupReadBack|sha256|shipmentReference/i);
  assert.match(source,/html_url/);
  assert.match(source,/conclusion/);
});

test('RC1491: Runbook dokumentiert Fehlereskalation und Recovery',()=>{
  const source=fs.readFileSync(RUNBOOK,'utf8');
  for(const marker of ['Betriebsfehler','automatisch','wiederhergestellt','keine Backup-Inhalte']){
    assert.ok(source.includes(marker),marker+' fehlt im Backup-Runbook');
  }
});
