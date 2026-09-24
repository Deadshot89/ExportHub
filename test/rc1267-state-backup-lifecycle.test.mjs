import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const API='api/state-maintenance/index.js';
const WF='.github/workflows/rc1267-state-backup-lifecycle.yml';

test('RC1267: Lifecycle-Workflow läuft täglich und unterstützt manuelle Ausführung',()=>{
  const source=fs.readFileSync(WF,'utf8');
  assert.match(source,/cron:\s*'17 2 \* \* \*'/);
  assert.match(source,/workflow_dispatch:/);
  assert.match(source,/backup daily/);
  assert.match(source,/backup monthly/);
  assert.match(source,/backup yearly/);
  assert.match(source,/day.*01/s);
  assert.match(source,/month.*01/s);
});

test('RC1267: Produktion und TESTSERVICE erhalten getrennte verifizierte Snapshots',()=>{
  const source=fs.readFileSync(WF,'utf8');
  assert.match(source,/environment:\s*testservice/);
  assert.match(source,/environment:\s*production/);
  assert.match(source,/backupReadBackVerified!==true/);
  assert.match(source,/sha256/);
  assert.match(source,/backupBlob/);
});

test('RC1267: State-Maintenance erlaubt nur expliziten Backup-Workflow und sichere Tiers',()=>{
  const source=fs.readFileSync(API,'utf8');
  assert.match(source,/BACKUP_WORKFLOW='rc1267-state-backup-lifecycle\.yml'/);
  assert.match(source,/eventName==='schedule'\|\|eventName==='workflow_dispatch'/);
  assert.match(source,/action==='backup-snapshot'/);
  assert.match(source,/\['daily','monthly','yearly'\]/);
  assert.match(source,/conditions:\{ifNoneMatch:'\*'\}/);
  assert.match(source,/BACKUP_VERIFY_FAILED/);
});

test('RC1267: geplante Sicherung liest jedes Backup vollständig zurück und prüft SHA-256',()=>{
  const source=fs.readFileSync(API,'utf8');
  const start=source.indexOf('async function createLifecycleBackup');
  const end=source.indexOf('async function runRestoreDrill',start);
  const block=source.slice(start,end);
  assert.match(block,/readBack=await readBuffer\(blob\)/);
  assert.match(block,/readBackHash=crypto\.createHash\('sha256'\)/);
  assert.match(block,/readBack\.buffer\.length!==bytes/);
  assert.match(block,/readBackHash!==hash/);
  assert.match(block,/backupReadBackVerified:true/);
});

test('RC1267: täglicher TESTSERVICE-Job führt weiterhin einen echten Restore-Drill aus',()=>{
  const source=fs.readFileSync(WF,'utf8');
  assert.match(source,/TARGET_ENV.*testservice/s);
  assert.match(source,/restore-drill/);
  assert.match(source,/shipmentReferencesVerified!==true/);
  assert.match(source,/restoreDrill!==true/);
});

test('RC1267: geänderte Serverdatei bleibt syntaktisch gültig',()=>{
  execFileSync(process.execPath,['--check',API],{stdio:'pipe'});
});
