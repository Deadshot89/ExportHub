import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let environment='production';
let assigned='';
const examStarts=[];
const SOP={number:'SOP-EH-060',title:'ABD Prozess',version:'2.0',steps:[{id:'s1',exam:{relevant:true}}]};

globalThis.__EXPORTHUB_GET_STATE__=()=>({
  _exporthubEnvironment:{name:environment},
  currentUser:{id:'USER-42',name:'Demo Prüfer'},
  isoSops:[]
});
globalThis.ExportHubIsoSopCatalog={documents:[SOP],get(number){return number===SOP.number?SOP:null;}};
globalThis.ExportHubSopExam={
  start(options){examStarts.push(options);return{mode:'exam',status:'active',sopNumber:options.sop.number,userId:options.userId};},
  current(){return null;}
};
globalThis.location={href:'https://exporthub360.com/index.html',assign(url){assigned=url;}};

await import('../assets/sop/rc1501-sop-tour-runtime.js');
const runtime=globalThis.ExportHubSopTourRuntime;

test('Exam Runtime API ist vorhanden und erzeugt einen expliziten Demo-Link',()=>{
  assert.ok(runtime,'ExportHubSopTourRuntime fehlt');
  assert.equal(typeof runtime.startExamByNumber,'function');
  assert.equal(typeof runtime.demoExamUrl,'function');
  assert.match(runtime.demoExamUrl('SOP-EH-060'),/^\/demo\.html\?sopExam=SOP-EH-060$/);
});

test('Prüfungsstart außerhalb Demo routet fail-closed und startet keine Exam-Session',()=>{
  environment='production';
  assigned='';
  examStarts.length=0;
  const result=runtime.startExamByNumber('SOP-EH-060');
  assert.equal(result.ok,false);
  assert.equal(result.reason,'EXAM_DEMO_ONLY');
  assert.equal(examStarts.length,0);
  assert.equal(assigned,'/demo.html?sopExam=SOP-EH-060');
});

test('Demo-Prüfung startet effektive SOP mit dem echten aktuellen Benutzer',()=>{
  environment='demo';
  assigned='';
  examStarts.length=0;
  const result=runtime.startExamByNumber('SOP-EH-060',{navigate:false});
  assert.equal(result.status,'active');
  assert.equal(result.mode,'exam');
  assert.equal(examStarts.length,1);
  assert.equal(examStarts[0].sop,SOP);
  assert.equal(examStarts[0].userId,'USER-42');
  assert.equal(assigned,'');
});

test('Demo-Prüfung ohne Benutzer-ID schlägt fail-closed fehl',()=>{
  const original=globalThis.__EXPORTHUB_GET_STATE__;
  globalThis.__EXPORTHUB_GET_STATE__=()=>({_exporthubEnvironment:{name:'demo'},currentUser:{},activeUser:{},isoSops:[]});
  examStarts.length=0;
  try{
    const result=runtime.startExamByNumber('SOP-EH-060',{navigate:false});
    assert.equal(result.ok,false);
    assert.equal(result.reason,'EXAM_USER_REQUIRED');
    assert.equal(examStarts.length,0);
  }finally{globalThis.__EXPORTHUB_GET_STATE__=original;}
});

test('RC1503 Build kopiert Exam Engine und CSS und lädt Engine vor Tour-Runtime',async()=>{
  const builder=await import('../.github/rc1503/build-three-env.mjs');
  assert.ok(builder.RC1503_TRAINING_ASSETS.includes('assets/sop/rc1503-sop-exam.js'));
  assert.ok(builder.RC1503_TRAINING_ASSETS.includes('assets/sop/rc1503-sop-exam.css'));

  const root=fs.mkdtempSync(path.join(os.tmpdir(),'rc1503-exam-root-'));
  const out=path.join(root,'dist-rc1112');
  fs.mkdirSync(path.join(root,'assets/sop'),{recursive:true});
  fs.mkdirSync(out,{recursive:true});
  for(const rel of builder.RC1503_TRAINING_ASSETS){
    const target=path.join(root,rel);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,`/* ${rel} */\n`);
  }
  const shell='<!doctype html><html><head></head><body><script id="exporthub-rc1501-sop-tour-runtime" defer src="/assets/sop/rc1501-sop-tour-runtime.js"></script></body></html>';
  for(const file of ['index.html','TESTVERSION.html','demo.html'])fs.writeFileSync(path.join(out,file),shell);

  const manifest=builder.integrateTraining(root,out);
  const html=fs.readFileSync(path.join(out,'demo.html'),'utf8');
  assert.match(html,/id="exporthub-rc1503-sop-exam"/);
  assert.match(html,/id="exporthub-rc1503-sop-exam-style"/);
  assert.ok(html.indexOf('id="exporthub-rc1503-sop-exam"')<html.indexOf('id="exporthub-rc1501-sop-tour-runtime"'),'Exam Engine muss vor Tour-Runtime geladen werden');
  assert.ok(manifest.assets.includes('assets/sop/rc1503-sop-exam.js'));
  assert.equal(manifest.examEnvironment,'demo-only');
});
