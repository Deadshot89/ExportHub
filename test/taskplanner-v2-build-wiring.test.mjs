import test from 'node:test';
import assert from 'node:assert/strict';
import {patchBuilderSource} from '../scripts/taskplanner-v2-pretest.mjs';

test('Builder-Hotfix lädt Styles, Core, Recurrence, Planner, Projections, Runtime-Bridge, Workflow, UI und Planner-UI in stabiler Reihenfolge',()=>{
  const sample=`
html=html.replace(/assets\\/rc1014-task-runtime\\.js\\?v=(?:1016|1359)/g,'assets/rc1014-task-runtime.js?v=1359');
if(!html.includes('assets/rc1014-task-runtime.js?v=1359'))throw new Error('runtime');
for(const rel of [
  'assets/rc1014-task-runtime.js',
  'assets/rc1014-task-ui.css',
]){}`;
  const out=patchBuilderSource(sample);
  assert.match(out,/taskplanner-v2\.css\?v=2000/);
  assert.match(out,/taskplanner-v2-core\.js\?v=2000/);
  assert.match(out,/taskplanner-v2-recurrence\.js\?v=2000/);
  assert.match(out,/taskplanner-v2-planner\.js\?v=2000/);
  assert.match(out,/taskplanner-v2-projections\.js\?v=2000/);
  assert.match(out,/taskplanner-v2-runtime-bridge\.js\?v=2000/);
  assert.match(out,/taskplanner-v2-workflow\.js\?v=2000/);
  assert.match(out,/taskplanner-v2-ui\.js\?v=2000/);
  assert.match(out,/taskplanner-v2-planner-ui\.js\?v=2000/);
  const styleAt=out.indexOf('taskplanner-v2.css?v=2000');
  const coreAt=out.indexOf('taskplanner-v2-core.js?v=2000');
  const recurrenceAt=out.indexOf('taskplanner-v2-recurrence.js?v=2000');
  const plannerAt=out.indexOf('taskplanner-v2-planner.js?v=2000');
  const projectionsAt=out.indexOf('taskplanner-v2-projections.js?v=2000');
  const lifecycleAt=out.indexOf('+taskLifecycleMatch[0]',plannerAt);
  assert.ok(styleAt>=0&&coreAt>styleAt&&recurrenceAt>coreAt&&plannerAt>recurrenceAt&&projectionsAt>plannerAt&&lifecycleAt>projectionsAt);
  assert.match(out,/taskRuntimeMatch\[0\]\+'\\n<script id="exporthub-taskplanner-v2-runtime-bridge"/);
  const runtimeAt=out.indexOf('taskplanner-v2-runtime-bridge.js?v=2000');
  const workflowAt=out.indexOf('taskplanner-v2-workflow.js?v=2000',runtimeAt);
  const uiAt=out.indexOf('taskplanner-v2-ui.js?v=2000',workflowAt);
  const plannerUiAt=out.indexOf('taskplanner-v2-planner-ui.js?v=2000',uiAt);
  assert.ok(runtimeAt>=0&&workflowAt>runtimeAt&&uiAt>workflowAt&&plannerUiAt>uiAt,'Workflow muss nach Runtime-Bridge und vor UI geladen werden');
  for(const rel of ['core.js','recurrence.js','planner.js','projections.js','runtime-bridge.js','workflow.js','ui.js','planner-ui.js'])assert.match(out,new RegExp("'assets/taskplanner-v2-"+rel.replace('.','\\.')+"'"));
  assert.match(out,/'assets\/taskplanner-v2\.css'/);
  assert.equal(patchBuilderSource(out),out,'Patch muss idempotent sein');
});
