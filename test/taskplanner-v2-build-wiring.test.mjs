import test from 'node:test';
import assert from 'node:assert/strict';
import {patchBuilderSource} from '../scripts/taskplanner-v2-pretest.mjs';

test('Builder-Hotfix lädt Core und Recurrence vor RC1014 Lifecycle und kopiert beide Assets',()=>{
  const sample=`
html=html.replace(/assets\\/rc1014-task-runtime\\.js\\?v=(?:1016|1359)/g,'assets/rc1014-task-runtime.js?v=1359');
if(!html.includes('assets/rc1014-task-runtime.js?v=1359'))throw new Error('runtime');
for(const rel of [
  'assets/rc1014-task-runtime.js',
  'assets/rc1014-task-ui.css',
]){}`;
  const out=patchBuilderSource(sample);
  assert.match(out,/taskplanner-v2-core\.js\?v=2000/);
  assert.match(out,/taskplanner-v2-recurrence\.js\?v=2000/);
  const coreAt=out.indexOf('taskplanner-v2-core.js?v=2000');
  const recurrenceAt=out.indexOf('taskplanner-v2-recurrence.js?v=2000');
  const lifecycleAt=out.indexOf('+taskLifecycleMatch[0]',recurrenceAt);
  assert.ok(coreAt>=0&&recurrenceAt>coreAt&&lifecycleAt>recurrenceAt);
  assert.match(out,/'assets\/taskplanner-v2-core\.js'/);
  assert.match(out,/'assets\/taskplanner-v2-recurrence\.js'/);
  assert.equal(patchBuilderSource(out),out,'Patch muss idempotent sein');
});
