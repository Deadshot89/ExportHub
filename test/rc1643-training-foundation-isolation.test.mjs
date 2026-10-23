import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const sanitizer=require('../api/shared/training-center.js');

test('RC1643: native training data rejects demo shipment, customer, ABD and document persistence',()=>{
 const actual=sanitizer.sanitizeTrainingCenterPatch({
  version:1,
  standardProcesses:[{id:'shipment-registration'}],
  learningProgress:[{userId:'U1',trainingId:'first-shipment',completed:true,progressPercent:101,
   shipment:{id:'DEMO-1'},documents:[{id:'DEMO-DOC'}],abdRequests:[{id:'DEMO-ABD'}]}],
  shipments:[{id:'DEMO-1'}],customers:[{id:'DEMO-CUST'}],tasks:[{id:'DEMO-TASK'}],
  abdRequests:[{id:'DEMO-ABD'}],documents:[{id:'DEMO-DOC'}]
 });
 assert.deepEqual(Object.keys(actual).sort(),['learningProgress','standardProcesses','version'].sort());
 assert.equal(actual.learningProgress[0].progressPercent,100);
 for(const field of ['shipments','customers','tasks','abdRequests','documents'])assert.ok(!(field in actual));
 const text=JSON.stringify(actual);
 for(const phrase of ['DEMO-1','DEMO-CUST','DEMO-ABD','DEMO-DOC','DEMO-TASK'])assert.ok(!text.includes(phrase),phrase);
});

test('RC1643: installed foundation must not replace production SOP, tour, QR, ABD or save builders',()=>{
 const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
 for(const token of ['integrateTour(ROOT,OUT)','integrateEditor(ROOT,OUT)','integrateTraining(ROOT,OUT)',
   'integrateCoverageAdmin(ROOT,OUT)','integrateAbdProforma(ROOT,OUT)'])
  assert.ok(builder.includes(token),token+' remains required');
 assert.ok(!builder.includes('ExportHubTrainingCenterRuntime'),'new UI is not routed until future migration is verified');
 assert.ok(!builder.includes('replaceLegacySopRendererInBuild'),'no old SOP replacement in foundation');
});

test('RC1643: frontend and backend allow only explicit progress fields and independent center namespace',()=>{
 const model=fs.readFileSync('assets/training-center/model.js','utf8');
 const store=fs.readFileSync('assets/training-center/store.js','utf8');
 const state=fs.readFileSync('assets/training-center/training-state.js','utf8');
 const guard=fs.readFileSync('assets/training-center/training-write-guard.js','utf8');
 assert.match(store,/source\.sopTrainingCenter/);
 assert.match(store,/nextState\.sopTrainingCenter=/);
 assert.match(state,/let active=null/);
 assert.doesNotMatch(state,/localStorage|sessionStorage|fetch\(/);
 assert.match(guard,/TRAINING_PRODUCTIVE_WRITE_BLOCKED/);
 assert.doesNotMatch(guard,/fetch\(|localStorage|sessionStorage/);
 assert.match(model,/normalizeLearningProgress/);
});
