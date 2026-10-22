import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Readable} from 'node:stream';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {
  backupPlan,
  backupPath,
  retentionPolicy,
  createVerifiedSnapshot
}=require('../api/shared/state-backup-lifecycle.js');

const API='api/state-maintenance/index.js';
const WF='.github/workflows/rc1267-state-backup.yml';
const RUNBOOK='docs/rc1267-state-backup-lifecycle.md';

class MemoryBlob{
  constructor(container,name){this.container=container;this.name=name}
  async upload(data,bytes,options={}){
    const buffer=Buffer.isBuffer(data)?Buffer.from(data):Buffer.from(String(data),'utf8');
    assert.equal(buffer.length,bytes);
    if(options.conditions&&options.conditions.ifNoneMatch==='*'&&this.container.rows.has(this.name)){
      const e=new Error('exists');e.statusCode=412;throw e;
    }
    const etag='"etag-'+(this.container.rows.size+1)+'"';
    this.container.rows.set(this.name,{buffer,metadata:{...(options.metadata||{})},etag});
    return{etag};
  }
  async getProperties(){
    const row=this.container.rows.get(this.name);
    if(!row){const e=new Error('missing');e.statusCode=404;throw e}
    return{etag:row.etag,metadata:{...row.metadata}};
  }
  async download(){
    const row=this.container.rows.get(this.name);
    if(!row){const e=new Error('missing');e.statusCode=404;throw e}
    let buffer=Buffer.from(row.buffer);
    if(this.container.tamperRead&&buffer.length)buffer[0]^=1;
    return{etag:row.etag,readableStreamBody:Readable.from([buffer])};
  }
}
class MemoryContainer{
  constructor({tamperRead=false}={}){this.rows=new Map();this.tamperRead=tamperRead}
  getBlockBlobClient(name){return new MemoryBlob(this,name)}
  async *listBlobsFlat(options={}){
    this.listCalls=(this.listCalls||0)+1;
    if(this.listFails)throw Object.assign(new Error('not authorized'),{statusCode:403});
    for(const [name,row] of this.rows){
      if(options.prefix&&name.startsWith(options.prefix)){
        yield{name,metadata:options.includeMetadata?{...row.metadata}:{},deleted:false};
      }
    }
  }
}

test('RC1267: Backupplan erzeugt täglich sowie Monats- und Jahressnapshot zum Periodenbeginn',()=>{
  assert.deepEqual(backupPlan('2026-09-24T01:17:00.000Z'),['daily']);
  assert.deepEqual(backupPlan('2026-10-01T01:17:00.000Z'),['daily','monthly']);
  assert.deepEqual(backupPlan('2027-01-01T01:17:00.000Z'),['daily','monthly','yearly']);
});

test('RC1267: Produktions- und TESTSERVICE-Backups sind räumlich und zeitlich getrennt',()=>{
  const at='2026-09-24T01:17:03.456Z';
  assert.equal(backupPath('production','daily',at),'state-backups/daily/2026/09/24/team-state-20260924T011703456Z.json');
  assert.equal(backupPath('testservice','monthly',at),'testservice/state-backups/monthly/2026/09/team-state-20260924T011703456Z.json');
  assert.equal(backupPath('production','yearly',at),'state-backups/yearly/2026/team-state-20260924T011703456Z.json');
});

test('RC1267: Retention ist als Mindestaufbewahrung ohne automatisches Löschen definiert',()=>{
  assert.deepEqual(retentionPolicy('daily'),{tier:'daily',minimumRetentionDays:35,automaticDeletion:false,policy:'minimum-35-days-no-automatic-deletion'});
  assert.deepEqual(retentionPolicy('monthly'),{tier:'monthly',minimumRetentionDays:730,automaticDeletion:false,policy:'minimum-730-days-no-automatic-deletion'});
  assert.deepEqual(retentionPolicy('yearly'),{tier:'yearly',minimumRetentionDays:2555,automaticDeletion:false,policy:'minimum-2555-days-no-automatic-deletion'});
  const core=fs.readFileSync('api/shared/state-backup-lifecycle.js','utf8');
  assert.doesNotMatch(core,/deleteIfExists|\.delete\s*\(/,'RC1267 darf Backups nicht automatisch löschen');
});

test('RC1267: Snapshot wird hochgeladen, per SHA-256 zurückgelesen und verifiziert',async()=>{
  const container=new MemoryContainer(),current={schemaVersion:3,revision:42,state:{shipments:[{id:'S1',reference:'ABC123'}]}};
  const result=await createVerifiedSnapshot(container,{environment:'production',tier:'daily',current,at:'2026-09-24T01:17:03.456Z'});
  assert.equal(result.ok,true);
  assert.equal(result.scheduledBackup,true);
  assert.equal(result.backupVerified,true);
  assert.equal(result.backupReadBackVerified,true);
  assert.match(result.sha256,/^[a-f0-9]{64}$/);
  assert.equal(result.bytes,Buffer.byteLength(JSON.stringify(current)));
  assert.equal(container.rows.size,1);
  const stored=container.rows.get(result.backupBlob);
  assert.equal(stored.metadata.sha256,result.sha256);
  assert.equal(stored.metadata.minimumretentiondays,'35');
  assert.equal(stored.metadata.automaticdeletion,'false');
});

test('RC1267: beschädigter Backup-Readback schlägt fail-closed fehl',async()=>{
  const container=new MemoryContainer({tamperRead:true});
  await assert.rejects(
    ()=>createVerifiedSnapshot(container,{environment:'testservice',tier:'daily',current:{revision:1,state:{}},at:'2026-09-24T01:17:03.456Z'}),
    e=>e&&e.code==='BACKUP_VERIFY_FAILED'
  );
});


test('RC1624: identisches TESTSERVICE Daily am selben UTC-Tag verwendet verifizierte vorhandene Kopie',async()=>{
  const container=new MemoryContainer(),current={revision:7,state:{shipments:[{ref:'TEST01'}]}};
  const initial=await createVerifiedSnapshot(container,{environment:'testservice',tier:'daily',current,at:'2026-10-22T01:17:00.000Z'});
  const repeat=await createVerifiedSnapshot(container,{environment:'testservice',tier:'daily',current,at:'2026-10-22T14:45:00.000Z'});
  assert.equal(initial.reusedVerifiedExisting,undefined);
  assert.equal(repeat.reusedVerifiedExisting,true);
  assert.equal(repeat.skippedUpload,true);
  assert.equal(repeat.backupBlob,initial.backupBlob);
  assert.equal(repeat.backupVerified,true);
  assert.equal(repeat.backupReadBackVerified,true);
  assert.equal(repeat.sha256,initial.sha256);
  assert.equal(container.rows.size,1,'kein zweiter Upload/keine neue Blob-Version');
  assert.ok(container.listCalls>=2,'Metadaten werden immer direkt in Azure geprüft');
});

test('RC1624: geänderter TESTSERVICE Daily-State erzeugt zusätzliche vollständige Sicherung',async()=>{
  const container=new MemoryContainer();
  const before=await createVerifiedSnapshot(container,{environment:'testservice',tier:'daily',current:{revision:7},at:'2026-10-22T01:17:00.000Z'});
  const after=await createVerifiedSnapshot(container,{environment:'testservice',tier:'daily',current:{revision:8},at:'2026-10-22T12:00:00.000Z'});
  assert.equal(container.rows.size,2);
  assert.notEqual(after.sha256,before.sha256);
  assert.equal(after.reusedVerifiedExisting,undefined);
});

test('RC1624: Wiederverwendung niemals über UTC-Tagesgrenze, Monats- oder Produktivbackups',async()=>{
  const rows=[
    {environment:'testservice',tier:'daily',dates:['2026-10-21T23:59:00.000Z','2026-10-22T00:01:00.000Z']},
    {environment:'testservice',tier:'monthly',dates:['2026-10-01T01:00:00.000Z','2026-10-01T15:00:00.000Z']},
    {environment:'production',tier:'daily',dates:['2026-10-22T01:00:00.000Z','2026-10-22T15:00:00.000Z']}
  ];
  for(const run of rows){
    const container=new MemoryContainer();
    for(const at of run.dates){
      const result=await createVerifiedSnapshot(container,{environment:run.environment,tier:run.tier,current:{revision:7},at});
      assert.equal(result.reusedVerifiedExisting,undefined);
    }
    assert.equal(container.rows.size,2,run.environment+' '+run.tier+' darf nicht wiederverwenden');
  }
});

test('RC1624: vorhandener beschädigter Blob führt fail-closed zu BACKUP_VERIFY_FAILED statt stiller Wiederverwendung',async()=>{
  const container=new MemoryContainer();
  await createVerifiedSnapshot(container,{environment:'testservice',tier:'daily',current:{revision:7},at:'2026-10-22T01:00:00.000Z'});
  container.tamperRead=true;
  await assert.rejects(
    ()=>createVerifiedSnapshot(container,{environment:'testservice',tier:'daily',current:{revision:7},at:'2026-10-22T04:00:00.000Z'}),
    e=>e&&e.code==='BACKUP_VERIFY_FAILED'
  );
  assert.equal(container.rows.size,1);
});

test('RC1624: fehlende List-Berechtigung erhält alten sicheren Schreib- und Readback-Weg',async()=>{
  const container=new MemoryContainer();
  await createVerifiedSnapshot(container,{environment:'testservice',tier:'daily',current:{revision:7},at:'2026-10-22T01:00:00.000Z'});
  container.listFails=true;
  const result=await createVerifiedSnapshot(container,{environment:'testservice',tier:'daily',current:{revision:7},at:'2026-10-22T04:00:00.000Z'});
  assert.equal(result.backupReadBackVerified,true);
  assert.equal(result.reusedVerifiedExisting,undefined);
  assert.equal(container.rows.size,2);
});


test('RC1267: Wartungs-API erlaubt Backups nur für den eng gebundenen Backup-Workflow',()=>{
  const source=fs.readFileSync(API,'utf8');
  assert.match(source,/require\('\.\.\/shared\/state-backup-lifecycle'\)/);
  assert.match(source,/BACKUP_WORKFLOW='rc1267-state-backup\.yml'/);
  assert.match(source,/\['workflow_run','schedule','workflow_dispatch'\]\.includes\(eventName\)/);
  assert.match(source,/action==='scheduled-backup'/);
  assert.match(source,/createVerifiedSnapshot\(container,/);
  assert.match(source,/GLOBAL_ADMIN_OR_WORKFLOW_REQUIRED/);
});

test('RC1505/RC1267: Workflow läuft täglich, manuell oder nach echtem Production-Release',()=>{
  const source=fs.readFileSync(WF,'utf8');
  assert.match(source,/cron:\s*'17 1 \* \* \*'/);
  assert.match(source,/workflow_run:/);
  assert.match(source,/ExportHUB Production Release/);
  assert.doesNotMatch(source,/ExportHUB RC1112 Drei-Umgebungen Deploy/);
  assert.match(source,/workflow_dispatch:/);
  assert.match(source,/github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(source,/tiers=\(daily\)/);
  assert.match(source,/tiers\+=\(monthly\)/);
  assert.match(source,/tiers\+=\(yearly\)/);
  assert.match(source,/scheduled-backup/);
  assert.match(source,/backupReadBackVerified/);
  assert.match(source,/minimumRetentionDays/);
  assert.match(source,/production/);
  assert.match(source,/testservice/);
});

test('RC1268: Workflow baut den scheduled-backup Request als gültiges JSON statt durch Shell-Quoting zu beschädigen',()=>{
  const source=fs.readFileSync(WF,'utf8');
  assert.match(source,/JSON\.stringify\(\{action:"scheduled-backup",environment:process\.argv\[1\],tier:process\.argv\[2\]\}\)/);
  assert.match(source,/--data "\$payload"/);
  assert.doesNotMatch(source,/-d "\{"action":"scheduled-backup"/,'ungültiges Shell-Quoting aus dem fehlgeschlagenen Live-Lauf darf nicht zurückkehren');
});

test('RC1267: Runbook dokumentiert Zeitplan, Retention und Restore-Nachweis',()=>{
  const source=fs.readFileSync(RUNBOOK,'utf8');
  for(const marker of ['täglich','35 Tage','monatlich','730 Tage','jährlich','2555 Tage','Restore-Drill','SHA-256','keine automatische Löschung']){
    assert.ok(source.includes(marker),marker+' fehlt im Backup-Runbook');
  }
});
