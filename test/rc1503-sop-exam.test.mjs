import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/sop/rc1501-sop-tour-validator.js');
await import('../assets/sop/rc1503-sop-exam.js').catch(()=>{});
const exam=globalThis.ExportHubSopExam;

function sop(overrides={}){
  return {
    number:'SOP-EXAM-001',title:'Prüfprozess',version:'2.0',
    steps:[
      {id:'s1',order:1,instruction:'Ersten Schritt ausführen',expectedAction:'click',target:{stableKey:'step-one'},checks:[],exam:{relevant:true,weight:1,allowHint:false}},
      {id:'s2',order:2,instruction:'Zweiten Schritt ausführen',expectedAction:'change',target:{stableKey:'step-two'},checks:[{type:'state',path:'workflow.ready',equals:true}],exam:{relevant:true,weight:2,allowHint:false}},
      {id:'info',order:3,instruction:'Nur Info',expectedAction:'click',target:{stableKey:'info'},checks:[],exam:{relevant:false,weight:1,allowHint:false}}
    ],
    examConfig:{finalChecks:[{type:'state',path:'workflow.done',equals:true}]},
    ...overrides
  };
}
function start(current=sop()){
  assert.ok(exam,'ExportHubSopExam fehlt');
  return exam.start({sop:current,userId:'USER-1'});
}
function doS1(){return exam.recordAction({action:'click',stableKey:'step-one',context:{state:{workflow:{ready:false}}}});}
function doS2(){return exam.recordAction({action:'change',stableKey:'step-two',context:{state:{workflow:{ready:true}}}});}
function finish(done=true){return exam.finish({state:{workflow:{done}}});}

test('Exam API ist vorhanden',()=>{
  assert.ok(exam,'ExportHubSopExam fehlt');
  for(const name of ['start','recordAction','requestHelp','finish'])assert.equal(typeof exam[name],'function',`${name} fehlt`);
});

test('saubere Durchführung besteht mit korrekten Schritten und Abschlusszustand',()=>{
  const session=start();
  assert.equal(session.status,'active');
  assert.deepEqual(session.requiredSteps,['s1','s2']);
  assert.equal(doS1().ok,true);
  assert.equal(doS2().ok,true);
  const result=finish(true);
  assert.equal(result.passed,true);
  assert.deepEqual(result.correctSteps,['s1','s2']);
  assert.deepEqual(result.errors,[]);
  assert.deepEqual(result.skippedSteps,[]);
  assert.equal(result.helpCount,0);
  assert.equal(result.finalStateOk,true);
});

test('falsche Aktion wird als Fehler protokolliert und führt nicht weiter',()=>{
  start();
  const wrong=exam.recordAction({action:'input',stableKey:'wrong-target',context:{state:{}}});
  assert.equal(wrong.ok,false);
  assert.equal(wrong.reason,'WRONG_ACTION');
  assert.deepEqual(exam.current().correctSteps,[]);
  doS1();
  doS2();
  const result=finish(true);
  assert.equal(result.passed,false);
  assert.ok(result.errors.some(item=>item.type==='WRONG_ACTION'));
});

test('ausgelassener Pflichtschritt wird beim Abschluss ausgewiesen',()=>{
  start();
  doS1();
  const result=finish(true);
  assert.equal(result.passed,false);
  assert.deepEqual(result.correctSteps,['s1']);
  assert.deepEqual(result.skippedSteps,['s2']);
});

test('Pflichtschritt in falscher Reihenfolge wird erkannt und nicht vorgezogen',()=>{
  start();
  const result=doS2();
  assert.equal(result.ok,false);
  assert.equal(result.reason,'OUT_OF_ORDER');
  assert.deepEqual(exam.current().correctSteps,[]);
  doS1();
  doS2();
  const final=finish(true);
  assert.equal(final.passed,false);
  assert.ok(final.errors.some(item=>item.type==='OUT_OF_ORDER'&&item.stepId==='s2'));
});

test('fehlgeschlagene Schrittprüfung zählt nicht als korrekter Schritt',()=>{
  start();
  doS1();
  const failed=exam.recordAction({action:'change',stableKey:'step-two',context:{state:{workflow:{ready:false}}}});
  assert.equal(failed.ok,false);
  assert.equal(failed.reason,'STEP_CHECK_FAILED');
  assert.deepEqual(exam.current().correctSteps,['s1']);
  const result=finish(true);
  assert.equal(result.passed,false);
  assert.deepEqual(result.skippedSteps,['s2']);
  assert.ok(result.errors.some(item=>item.type==='STEP_CHECK_FAILED'&&item.stepId==='s2'));
});

test('fehlender Abschlusszustand verhindert Bestehen trotz korrekter Schritte',()=>{
  start();
  doS1();
  doS2();
  const result=finish(false);
  assert.equal(result.passed,false);
  assert.equal(result.finalStateOk,false);
  assert.ok(result.errors.some(item=>item.type==='FINAL_STATE_FAILED'));
});

test('Hilfen werden gezählt, beeinflussen aber ohne eigene Fachregel nicht automatisch das Bestehen',()=>{
  const one=sop({steps:[{id:'only',order:1,expectedAction:'click',target:{stableKey:'only'},checks:[],exam:{relevant:true,weight:1,allowHint:false}}],examConfig:{finalChecks:[]}});
  start(one);
  exam.requestHelp();
  exam.requestHelp();
  exam.recordAction({action:'click',stableKey:'only',context:{state:{}}});
  const result=exam.finish({state:{}});
  assert.equal(result.helpCount,2);
  assert.equal(result.passed,true);
});

test('nicht prüfungsrelevante und explizit optionale Schritte werden nicht als ausgelassen bewertet',()=>{
  const current=sop({steps:[
    {id:'required',order:1,expectedAction:'click',target:{stableKey:'required'},checks:[],exam:{relevant:true}},
    {id:'optional',order:2,expectedAction:'click',target:{stableKey:'optional'},checks:[],exam:{relevant:true,required:false}},
    {id:'info',order:3,expectedAction:'click',target:{stableKey:'info'},checks:[],exam:{relevant:false}}
  ],examConfig:{finalChecks:[]}});
  start(current);
  exam.recordAction({action:'click',stableKey:'required',context:{state:{}}});
  const result=exam.finish({state:{}});
  assert.equal(result.passed,true);
  assert.deepEqual(result.skippedSteps,[]);
  assert.deepEqual(result.correctSteps,['required']);
});

test('lange Bearbeitungszeit wird protokolliert, ist aber kein Standard-Bestehenskriterium',()=>{
  const oldNow=Date.now;
  const values=[1_000,1_000+7*24*60*60*1000];
  Date.now=()=>values.shift()??values[values.length-1]??1_000;
  try{
    const one=sop({steps:[{id:'only',order:1,expectedAction:'click',target:{stableKey:'only'},checks:[],exam:{relevant:true}}],examConfig:{finalChecks:[]}});
    start(one);
    exam.recordAction({action:'click',stableKey:'only',context:{state:{}}});
    const result=exam.finish({state:{}});
    assert.equal(result.passed,true);
    assert.equal(result.durationMs,7*24*60*60*1000);
  }finally{Date.now=oldNow;}
});
