import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WATCHDOG='.github/workflows/rc1491-state-backup-restore-watchdog.yml';
const RUNBOOK='docs/rc1267-state-backup-lifecycle.md';

function workflowScript(){
  const source=fs.readFileSync(WATCHDOG,'utf8');
  const marker='          script: |\n';
  const start=source.indexOf(marker);
  assert.notEqual(start,-1,'github-script Block fehlt');
  return source.slice(start+marker.length).split('\n').map(line=>line.startsWith('            ')?line.slice(12):line).join('\n');
}

function harness({backup='success',restore='success',restoreJob=restore,issue=null}={}){
  const calls={created:[],updated:[],comments:[],warnings:[],infos:[]};
  const conclusions={
    'rc1267-state-backup.yml':backup,
    'rc1137-state-compaction.yml':restore
  };
  const runIds={
    'rc1267-state-backup.yml':1001,
    'rc1137-state-compaction.yml':1002
  };
  const github={
    rest:{
      actions:{
        listWorkflowRuns:async({workflow_id})=>({data:{workflow_runs:[{
          id:runIds[workflow_id],
          conclusion:conclusions[workflow_id],
          html_url:`https://github.example/actions/${workflow_id}`,
          run_number:42,
          updated_at:'2026-10-11T17:00:00Z'
        }]}}),
        listJobsForWorkflowRun:async({run_id})=>({data:{jobs:run_id===1002?[{
          name:'TESTSERVICE State kompaktieren',
          conclusion:restoreJob
        }]:[]}})
      },
      issues:{
        listForRepo:async()=>({data:issue?[issue]:[]}),
        create:async payload=>{
          calls.created.push(payload);
          return{data:{number:77,state:'open',title:payload.title,body:payload.body}};
        },
        update:async payload=>{calls.updated.push(payload);return{data:{...issue,...payload}};},
        createComment:async payload=>{calls.comments.push(payload);return{data:{id:calls.comments.length}};}
      }
    },
    paginate:async(fn,args)=>(await fn(args)).data
  };
  const core={
    warning:message=>calls.warnings.push(message),
    info:message=>calls.infos.push(message)
  };
  return{github,core,calls};
}

async function execute(h){
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  const run=new AsyncFunction('github','context','core',workflowScript());
  await run(h.github,{repo:{owner:'Deadshot89',repo:'ExportHub'}},h.core);
}

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

test('RC1491: neuer Betriebsfehler erstellt genau ein Watchdog-Issue',async()=>{
  const h=harness({backup:'failure',restore:'success'});
  await execute(h);
  assert.equal(h.calls.created.length,1);
  assert.equal(h.calls.updated.length,0);
  assert.equal(h.calls.comments.length,0);
  assert.equal(h.calls.created[0].title,'[OPS] State Backup/Restore Watchdog');
  assert.match(h.calls.created[0].body,/RC1267 State Backup Lifecycle/);
  assert.match(h.calls.created[0].body,/conclusion=failure/);
});

test('RC1491: wiederholter Betriebsfehler aktualisiert bestehendes Issue statt Duplikat',async()=>{
  const h=harness({
    backup:'failure',
    restore:'success',
    issue:{number:55,state:'open',title:'[OPS] State Backup/Restore Watchdog',body:'<!-- exporthub-ops:state-backup-restore-watchdog -->'}
  });
  await execute(h);
  assert.equal(h.calls.created.length,0);
  assert.equal(h.calls.updated.length,1);
  assert.equal(h.calls.updated[0].issue_number,55);
  assert.notEqual(h.calls.updated[0].state,'closed');
  assert.equal(h.calls.comments.length,1);
});

test('RC1491: erneuter Fehler öffnet ein bereits geschlossenes Watchdog-Issue wieder',async()=>{
  const h=harness({
    backup:'success',
    restore:'cancelled',
    issue:{number:55,state:'closed',title:'[OPS] State Backup/Restore Watchdog',body:'<!-- exporthub-ops:state-backup-restore-watchdog -->'}
  });
  await execute(h);
  assert.equal(h.calls.created.length,0);
  assert.ok(h.calls.updated.some(call=>call.issue_number===55&&call.state==='open'));
  assert.equal(h.calls.comments.length,1);
});

test('RC1491: reiner PRODUCTION-Fehler in RC1137 markiert Restore-Drill nicht als gestört',async()=>{
  const h=harness({backup:'success',restore:'failure',restoreJob:'success'});
  await execute(h);
  assert.equal(h.calls.created.length,0);
  assert.ok(h.calls.infos.some(message=>message.includes('Beide überwachten Workflows sind gesund')));
});

test('RC1491: Recovery schließt Issue nur wenn Backup und Restore-Drill erfolgreich sind',async()=>{
  const h=harness({
    backup:'success',
    restore:'success',
    restoreJob:'success',
    issue:{number:55,state:'open',title:'[OPS] State Backup/Restore Watchdog',body:'<!-- exporthub-ops:state-backup-restore-watchdog -->'}
  });
  await execute(h);
  assert.equal(h.calls.created.length,0);
  assert.ok(h.calls.updated.some(call=>call.issue_number===55&&call.state==='closed'));
  assert.equal(h.calls.comments.length,1);
  assert.match(h.calls.comments[0].body,/wieder gesund/);
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
