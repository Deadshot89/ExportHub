import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {DIRECT_RIGHTS}=require('../api/shared/state-write-guard.js');

test('alle TaskPlanner-V2-State-Keys bleiben im tasks-Rechtemodul',()=>{
  for(const key of ['tasks','taskSeries','taskTemplates','taskCalendar','taskSettings','taskArchive','taskMigrationMeta']){
    assert.deepEqual(DIRECT_RIGHTS[key],['tasks'],`${key} muss tasks-Recht verwenden`);
  }
});
