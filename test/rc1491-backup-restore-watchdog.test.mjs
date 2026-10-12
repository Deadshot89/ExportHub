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

function run({id,conclusion='success',event='workflow_run',runNumber=42,updatedAt='2026-10-11T17:00:00Z'}={}){
  return{
    id,
    status:'completed',
    conclusion,
    event,
    html_url:`https://github.example/actions/${id}`,
    run_number:runNumber,
    updated_at:updatedAt
  };
}

function harness({backup='success',restore='success',restoreJob=restore,backupRuns=null,restoreRuns=null,issue=null}={}){
  const calls={created:[],updated:[],comments:[],warnings:[],infos:[]};
  const workflowRuns={
    'rc1267-state-backup.yml':backupRuns||[run({id:1001,conclusion:backup})],
    'rc1137-state-compaction.yml':restoreRuns||[run({id:1002,conclusion:restore})]
  };
  const restoreJobByRunId=new Map(
    workflowRuns['rc1137-state-compaction.yml'].map(entry=>[
      entry.id,
      entry.conclusion==='skipped'?null:(entry.id===1002?restoreJob:'success')
    ])
  );
  const github={
    rest:{
      actions:{
        listWorkflowRuns:async({workflow_id,per_page,page=1})=>{
          const all=workflowRuns[workflow_id];
          const size=per_page||all.length;
          const start=(page-1)*size;
          return{data:{workflow_runs:all.slice(start,start+size)}};
        },
        listJobsForWorkflowRun:async({run_id})=>{
          const conclusion=restoreJobByRunId.get(run_id);
          return{data:{jobs:conclusion?[{
            name:'TESTSERVICE State kompaktieren',
            conclusion
          }]:[]}};
        }
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
  const runWorkflow=new AsyncFunction('github','context','core',workflowScript());
  await runWorkflow(h.github,{repo:{owner:'Deadshot89',repo:'ExportHub'}},h.core);
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
  assert.match(source,/per_page:100/);
  assert.match(source,/page<=10/);
  assert.match(source,/conclusion==='skipped'&&run\.event==='workflow_run'/);
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

test('RC1491: neutraler workflow_run-Skip verdrängt letzten relevanten Erfolg nicht',async()=>{
  const h=harness({
    backupRuns:[
      run({id:1101,conclusion:'skipped',event:'workflow_run',runNumber:44,updatedAt:'2026-10-12T08:11:23Z'}),
      run({id:1100,conclusion:'success',event:'schedule',runNumber:43,updatedAt:'2026-10-12T07:20:30Z'})
    ],
    restoreRuns:[
      run({id:1201,conclusion:'skipped',event:'workflow_run',runNumber:794,updatedAt:'2026-10-12T08:11:23Z'}),
      run({id:1200,conclusion:'success',event:'workflow_run',runNumber:793,updatedAt:'2026-10-12T07:20:34Z'})
    ],
    issue:{number:652,state:'open',title:'[OPS] State Backup/Restore Watchdog',body:'<!-- exporthub-ops:state-backup-restore-watchdog -->'}
  });
  await execute(h);
  assert.equal(h.calls.created.length,0);
  assert.ok(h.calls.updated.some(call=>call.issue_number===652&&call.state==='closed'),'neutraler Skip darf Recovery nicht blockieren');
  assert.equal(h.calls.comments.length,1);
  assert.match(h.calls.comments[0].body,/wieder gesund/);
});

test('RC1497: auch mehr als 100 neutrale Skips verdrängen den letzten relevanten Erfolg nicht',async()=>{
  const neutralSkips=Array.from({length:105},(_,index)=>run({
    id:2000+index,
    conclusion:'skipped',
    event:'workflow_run',
    runNumber:900-index
  }));
  const h=harness({
    backupRuns:[...neutralSkips,run({id:1999,conclusion:'success',event:'schedule',runNumber:794})],
    restore:'success',
    issue:{number:652,state:'open',title:'[OPS] State Backup/Restore Watchdog',body:'<!-- exporthub-ops:state-backup-restore-watchdog -->'}
  });
  await execute(h);
  assert.equal(h.calls.created.length,0);
  assert.ok(h.calls.updated.some(call=>call.issue_number===652&&call.state==='closed'),'paginierte Suche muss den relevanten Erfolg auf Folgeseiten finden');
});

test('RC1497: geplanter Skip bleibt ein Betriebsfehler',async()=>{
  const h=harness({
    backupRuns:[run({id:1301,conclusion:'skipped',event:'schedule',runNumber:45})],
    restore:'success'
  });
  await execute(h);
  assert.equal(h.calls.created.length,1,'ein geplanter Skip darf nicht stillschweigend ignoriert werden');
  assert.match(h.calls.created[0].body,/conclusion=skipped/);
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
  for(const marker of ['Betriebsfehler','automatisch','wiederhergestellt','keine Backup-Inhalte','neutraler workflow_run-Skip']){
    assert.ok(source.includes(marker),marker+' fehlt im Backup-Runbook');
  }
});
