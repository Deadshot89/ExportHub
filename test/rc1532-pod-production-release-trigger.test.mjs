import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW = '.github/workflows/rc1144-pod-backup-reconcile.yml';
const PRODUCTION_RELEASE = 'ExportHUB Production Release';
const OLD_MAIN_RELEASE = 'ExportHUB RC1112 Drei-Umgebungen Deploy';

const workflow = fs.readFileSync(WORKFLOW, 'utf8');

test('RC1532: POD-Reconcile folgt dem echten Production Release', () => {
  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, new RegExp(PRODUCTION_RELEASE));
  assert.doesNotMatch(workflow, new RegExp(OLD_MAIN_RELEASE));
  assert.match(workflow, /types:\s*\n\s*- completed/);
  assert.match(workflow, /branches:\s*\n\s*- main/);
});

test('RC1532: zeitgesteuerte POD-Nachholung bleibt unverändert aktiv', () => {
  assert.match(workflow, /cron:\s*['"]7,22,37,52 \* \* \* \*['"]/);
  assert.match(workflow, /cron:\s*['"]17 2 \* \* \*['"]/);
});
