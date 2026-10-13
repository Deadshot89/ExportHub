import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../api/taskplanner-v2-rehearsal-state/index.js',import.meta.url),'utf8');
const config=JSON.parse(fs.readFileSync(new URL('../api/taskplanner-v2-rehearsal-state/function.json',import.meta.url),'utf8'));

test('TaskPlanner V2 rehearsal endpoint is TESTSERVICE-only and branch/workflow locked',()=>{
  assert.match(source,/REF='refs\/heads\/taskplannerpro\/v2-task10'/);
  assert.match(source,/WORKFLOW='taskplanner-v2-rehearsal\.yml'/);
  assert.match(source,/AUDIENCE='exporthub-taskplanner-v2-rehearsal'/);
  assert.match(source,/requested!==['"]testservice['"]/);
  assert.ok(source.includes("!/-testservice\\./.test(host)"));
  assert.match(source,/claims\.repository!==REPO\|\|claims\.ref!==REF/);
  assert.match(source,/claims\.event_name\)!==['"]push['"]/);
});

test('TaskPlanner V2 rehearsal endpoint is read-only and exports task state only',()=>{
  assert.doesNotMatch(source,/\.upload\(/);
  assert.doesNotMatch(source,/writeJson|uploadJson|mutateTeam|mutateAuth/);
  for(const field of ['tasks','taskSeries','taskTemplates','taskCalendar','taskSettings','taskArchive','taskMigrationMeta'])assert.match(source,new RegExp(field));
  assert.doesNotMatch(source,/users\s*:/);
  assert.doesNotMatch(source,/shipments\s*:/);
});

test('TaskPlanner V2 rehearsal endpoint accepts POST/OPTIONS only',()=>{
  const trigger=config.bindings.find(item=>item.type==='httpTrigger');
  assert.deepEqual(trigger.methods,['post','options']);
  assert.equal(trigger.route,'taskplanner-v2-rehearsal-state');
});
