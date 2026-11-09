import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('.github/workflows/rc1144-pod-backup-reconcile.yml','utf8');
const testservice=source.slice(source.indexOf('  testservice:'),source.indexOf('  production:'));
const production=source.slice(source.indexOf('  production:'),source.indexOf('  pod_integrity_audit:'));

function classifier(section,payload){
  const line=section.split('\n').find(line=>line.includes('graph_target_attempt_result="$(printf'));
  assert.ok(line,'workflow must use a three-state classifier');
  const match=line.match(/node -e "([^"]+)"\)"$/);
  assert.ok(match,'classifier must remain an auditable single inline node script');
  const events={},output=[];
  const process={stdin:{on(kind,fn){events[kind]=fn;return this;}},stdout:{write(value){output.push(String(value));}}};
  vm.runInNewContext(match[1],{process},{timeout:1000});
  events.data(JSON.stringify(payload));events.end();
  return output.join('');
}

for(const [name,section] of [['TESTSERVICE',testservice],['PRODUCTION',production]]){
  test('RC1951 '+name+': Graph BadRequest and generic pending are failed attempts',()=>{
    const badRequest={drivePending:[{error:'BadRequest: Microsoft Graph rejected the folder'}],drivePendingCount:1,driveSavedCount:0,driveBackfillSelected:1};
    const legacy={drivePending:[{error:'GRAPH_DIRECT_PATH_TARGET_FAILED: 404'}],drivePendingCount:1,driveSavedCount:0};
    const graphRequest={drivePending:[{error:'GRAPH_REQUEST_FAILED: 400'}],drivePendingCount:1,driveSavedCount:0};
    assert.equal(classifier(section,badRequest),'failed');
    assert.equal(classifier(section,legacy),'failed');
    assert.equal(classifier(section,graphRequest),'failed');
  });

  test('RC1951 '+name+': empty pages never reset Graph failure streak; success does',()=>{
    const failed={drivePending:[{error:'BadRequest: 400'}],drivePendingCount:1,driveSavedCount:0};
    const empty={drivePending:[],drivePendingCount:0,driveSavedCount:0,driveBackfillSelected:0};
    const saved={drivePending:[],drivePendingCount:0,driveSavedCount:1};
    const sequence=[failed,empty,failed,saved].map(v=>classifier(section,v));
    assert.deepEqual(sequence,['failed','none','failed','saved']);
    let streak=0;const states=[];
    for(const attempt of sequence){if(attempt==='failed')streak++;else if(attempt==='saved')streak=0;states.push(streak)}
    assert.deepEqual(states,[1,1,2,0]);
    assert.match(section,/if \[ "\$graph_target_attempt_result" = 'failed' \]; then/);
    assert.match(section,/elif \[ "\$graph_target_attempt_result" = 'saved' \]; then/);
    assert.match(section,/if \[ "\$graph_target_failure_streak" -ge 2 \] && \[ "\$suppress_drive_backfill" != '1' \] && \[ -z "\$TARGET_REFERENCE" \]; then/);
    assert.match(section,/if \[ "\$optional_drive_pending_batches" -gt 0 \]; then[\s\S]*?exit 10/);
  });
}
