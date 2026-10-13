import test from 'node:test';
import assert from 'node:assert/strict';
import {patchExporthubStateSource} from '../scripts/taskplanner-v2-api-pretest.mjs';

test('Task-Migrationsbackup ist admin-only und read-back-verifiziert',()=>{
  const sample=`'use strict';\nconst { isAdmin } = require('../shared/user-policy');\nfunction json(){}\nmodule.exports=async function(context,req){\n const current=await validateSession(req,payload,c),blob=c.team;\n if(mode==='diagnostics-read'){ return; }\n}`;
  const out=patchExporthubStateSource(sample);
  assert.match(out,/state-backup-lifecycle/);
  assert.match(out,/mode==='task-migration-backup'/);
  assert.match(out,/req\.method!=='POST'/);
  assert.match(out,/!isAdmin\(current\.user\)/);
  assert.match(out,/createVerifiedSnapshot\(c\.container/);
  assert.match(out,/backupVerified/);
  assert.match(out,/backupReadBackVerified/);
  assert.equal(patchExporthubStateSource(out),out,'API-Patch muss idempotent sein');
});
