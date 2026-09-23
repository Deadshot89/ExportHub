import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const CORE='api/shared/state-maintenance.js';
const API='api/state-maintenance/index.js';
const FN='api/state-maintenance/function.json';
const WF='.github/workflows/rc1137-state-compaction.yml';

test('RC1137: Wartungskern existiert und berechnet eine verlustfreie Vorschau',()=>{
  assert.ok(fs.existsSync(CORE),'state-maintenance core fehlt');
  const {previewCompaction}=require('../api/shared/state-maintenance.js');
  const customer={id:'C1',name:'Kunde'};
  const docs=[{id:'D1',content:'ALT'}];
  const team={schemaVersion:3,revision:9,updatedAt:'2026-09-01T00:00:00.000Z',state:{shipments:[{id:'S1',customer,customerData:{...customer},selectedCustomer:{...customer},rc313Docs:docs,rc312Docs:JSON.parse(JSON.stringify(docs))}]},users:[{id:'U1',name:'Admin'}]};
  const before=JSON.parse(JSON.stringify(team));
  const p=previewCompaction(team);
  assert.deepEqual(team,before,'Vorschau darf Eingangsdaten nicht verändern');
  assert.equal(p.changed,true);
  assert.ok(p.beforeBytes>p.afterBytes,'Vorschau muss echte Einsparung messen');
  assert.equal(p.savedBytes,p.beforeBytes-p.afterBytes);
  assert.deepEqual(p.compacted.state.shipments[0].customer,customer);
  assert.equal('customerData' in p.compacted.state.shipments[0],false);
  assert.equal('selectedCustomer' in p.compacted.state.shipments[0],false);
  assert.deepEqual(p.compacted.state.shipments[0].rc313Docs,docs);
  assert.equal('rc312Docs' in p.compacted.state.shipments[0],false);
  assert.deepEqual(p.compacted.users,team.users);
});

test('RC1137: Apply-Dokument erhöht Revision und protokolliert Größen/Backup ohne Nutzdaten zu erfinden',()=>{
  assert.ok(fs.existsSync(CORE),'state-maintenance core fehlt');
  const {previewCompaction,buildAppliedDocument}=require('../api/shared/state-maintenance.js');
  const team={schemaVersion:3,revision:12,state:{shipments:[{id:'S1',customer:{id:'C'},customerData:{id:'C'}}]},users:[{id:'U1'}]};
  const p=previewCompaction(team);
  const next=buildAppliedDocument(team,p,{backupBlob:'testservice/recovery-backups/backup.json',actor:'RC1137 Workflow',at:'2026-09-16T15:00:00.000Z'});
  assert.equal(next.revision,13);
  assert.equal(next.updatedBy,'RC1137 Workflow');
  assert.equal(next.clientVersion,'RC1137-state-compaction');
  assert.equal(next.stateCompactionAudit.backupBlob,'testservice/recovery-backups/backup.json');
  assert.equal(next.stateCompactionAudit.beforeBytes,p.beforeBytes);
  assert.equal(next.stateCompactionAudit.afterBytes,p.afterBytes);
  assert.equal(next.stateCompactionAudit.savedBytes,p.savedBytes);
  assert.deepEqual(next.users,team.users);
});

test('RC1137: API ist OIDC-geschützt, erstellt vor Apply ein Backup und schreibt mit ETag-Schutz',()=>{
  for(const file of [API,FN])assert.ok(fs.existsSync(file),file+' fehlt');
  const source=fs.readFileSync(API,'utf8');
  assert.match(source,/exporthub-state-compaction/,'dedizierte OIDC audience fehlt');
  assert.match(source,/rc1137-state-compaction\.yml/,'Workflow-Bindung fehlt');
  assert.match(source,/workflow_run/,'nur freigegebener Workflow-Event fehlt');
  assert.match(source,/GLOBAL_ADMIN_OR_WORKFLOW_REQUIRED/,'harte Autorisierung fehlt');
  assert.match(source,/recovery-backups/,'Backup-Pfad fehlt');
  assert.match(source,/ifMatch|etag/,'ETag-Konfliktschutz fehlt');
  assert.match(source,/action\s*===?\s*['"]preview['"]/,'Preview-Aktion fehlt');
  assert.match(source,/action\s*===?\s*['"]apply['"]/,'Apply-Aktion fehlt');
});

test('RC1137: Workflow läuft erst nach erfolgreichem Deploy, TESTSERVICE vollständig vor Produktion',()=>{
  assert.ok(fs.existsSync(WF),'RC1137 Workflow fehlt');
  const source=fs.readFileSync(WF,'utf8');
  assert.match(source,/workflow_run:/);
  assert.match(source,/ExportHUB RC1112 Drei-Umgebungen Deploy/);
  assert.match(source,/id-token:\s*write/);
  assert.match(source,/conclusion\s*==\s*['"]success['"]/);
  const testPos=source.indexOf('TESTSERVICE');
  const prodPos=source.indexOf('PRODUCTION');
  assert.ok(testPos>=0&&prodPos>testPos,'TESTSERVICE muss vor Produktion stehen');
  assert.match(source,/preview/);
  assert.match(source,/apply/);
  assert.match(source,/teamStateBytes/,'Live-Größenprüfung fehlt');
});


test('RC1234: Backup-Verifikation liest das Backup nach Upload vollständig zurück',()=>{
  const source=fs.readFileSync(API,'utf8');
  const start=source.indexOf('async function createVerifiedBackup');
  const end=source.indexOf('module.exports=',start);
  assert.ok(start>=0&&end>start,'Backup-Funktion fehlt');
  const block=source.slice(start,end);
  assert.match(block,/getProperties\(/,'Backup muss per Blob-Eigenschaften verifiziert werden');
  assert.match(block,/readBuffer\(blob\)/,'RC1234 verlangt einen vollständigen Backup-Readback vor erfolgreicher Verifikation');
  assert.match(block,/metadata.*sha256|sha256.*metadata/s,'SHA256-Metadatenprüfung fehlt');
});
