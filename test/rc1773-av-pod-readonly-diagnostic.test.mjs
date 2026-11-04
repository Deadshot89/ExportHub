import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pod = fs.readFileSync(new URL('../.github/workflows/rc1144-pod-backup-reconcile.yml', import.meta.url), 'utf8');
const av = fs.readFileSync(new URL('../.github/workflows/av-check.yml', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../api/pod-backup-reconcile/index.js', import.meta.url), 'utf8');
const occurrences=(source,needle)=>source.split(needle).length-1;
const avEvent="github.event_name == 'workflow_run' && github.event.workflow_run.name == 'ExportHUB AV-Prüfung' && github.event.workflow_run.conclusion == 'failure'";
const avSkip="github.event_name != 'workflow_run' || github.event.workflow_run.name != 'ExportHUB AV-Prüfung'";

test('RC1773: AV-failure triggers a Graph target diagnostic in both environments',()=>{
  assert.match(pod,/workflows:\s*\n\s*- ExportHUB Production Release\s*\n[^\n]*\n[^\n]*\n\s*- ExportHUB AV-Prüfung/);
  assert.equal(occurrences(pod,avEvent),2,'one diagnostic per environment');
  assert.equal(occurrences(pod,"github.event.workflow_run.conclusion == 'failure'"),4,
    'job-level and step-level conditions must prohibit success-only AV triggers');
  assert.match(pod,/github\.event_name == 'schedule'/);
  assert.match(pod,/inputs\.graphTargetDiagnostic == true/);
  assert.match(api,/if \(payload\.graphTargetDiagnostic === true\)/);
  assert.ok(api.indexOf('if (payload.graphTargetDiagnostic === true)') <
    api.indexOf('podArchive.reconcilePendingBackups('),'diagnostics must return before any reconciliation');
});

test('RC1773: AV-triggered POD jobs can never enter mutating reconciliation',()=>{
  const start=pod.indexOf('  testservice:');
  const mid=pod.indexOf('  production:');
  const end=pod.indexOf('  pod_integrity_audit:');
  assert.ok(start>0&&mid>start&&end>mid);
  const sections=[pod.slice(start,mid),pod.slice(mid,end)];
  for(const section of sections){
    assert.match(section,/github\.event\.workflow_run\.name != 'ExportHUB AV-Prüfung' \|\| github\.event\.workflow_run\.conclusion == 'failure'/);
    assert.equal(occurrences(section,avEvent),1,'AV failed -> diagnostic only');
    assert.equal(occurrences(section,avSkip),2,'both job guard and reconciliation step must block AV-only events');
    assert.match(section,/graphTargetDiagnostic[\\"]*:[\\"]*true/);
  }
  assert.match(pod,/pod_integrity_audit:\s*\n[\s\S]*?if: \$\{\{ false \}\}/);
});

test('RC1773: AV Actions logs show only error codes and counts, not shipment refs',()=>{
  assert.match(av,/const errorCodes=\{\}/);
  assert.match(av,/errorCodes\[code\]=\(errorCodes\[code\]\|\|0\)\+1/);
  assert.match(av,/errorCount:v\.errorCount,errorCodes/);
  assert.doesNotMatch(av,/console\.error\([^\n]*errors:v\.errors/);
  assert.doesNotMatch(av,/console\.error\([^\n]*reference:/);
  assert.doesNotMatch(av,/console\.error\([^\n]*message:v\.message/);
});
