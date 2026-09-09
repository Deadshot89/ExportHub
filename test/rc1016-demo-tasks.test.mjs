import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

const source=()=>fs.readFileSync('assets/rc1016-demo-task-seed.js','utf8');

test('RC1016 Demo-Aufgaben verwenden gültige Gruppen Prioritäten Status und Benutzer-ID',()=>{
  const team={state:{tasks:[
    {id:'A',title:'Abholtag DEMO01',linkedShipmentRef:'DEMO01',priority:'Hoch',status:'Offen',assignedTo:'Demo Administrator'},
    {id:'B',title:'ABD für DEMO03 prüfen',linkedShipmentRef:'DEMO03',priority:'Hoch',status:'Offen',assignedTo:'Demo Administrator'},
    {id:'C',title:'Ladeliste DEMO02 vorbereiten',linkedShipmentRef:'DEMO02',priority:'Normal',status:'Offen',assignedTo:'Demo Administrator'}
  ]}};
  const sandbox={globalThis:null,window:null};
  sandbox.globalThis=sandbox;
  sandbox.window=sandbox;
  sandbox.__EXPORTHUB_DEMO_MODE__=true;
  sandbox.__EXPORTHUB_DEMO_USER__={id:'DEMO-USER-1',name:'Demo Administrator'};
  sandbox.__EXPORTHUB_DEMO_STATE__=team;
  vm.runInNewContext(source(),sandbox,{filename:'rc1016-demo-task-seed.js'});
  const tasks=team.state.tasks;
  assert.equal(tasks.length,3);
  assert.deepEqual(Array.from(tasks,t=>t.status),['open','open','open']);
  assert.deepEqual(Array.from(tasks,t=>t.priority),['P1','P0','P3']);
  assert.deepEqual(Array.from(tasks,t=>t.group),['Kunde angemeldet','Offene ABDs','Offene Sendungen']);
  assert.ok(tasks.every(t=>t.originalAssignee==='DEMO-USER-1'&&t.effectiveAssignee==='DEMO-USER-1'));
  assert.ok(tasks.every(t=>t.environment==='demo'&&t.sourceRef.startsWith('DEMO')));
});

test('RC1016 Demo-Build lädt den Task-Seed nach Demo-Bootstrap und Bridge',()=>{
  execFileSync(process.execPath,['.github/rc1016/build-three-env.mjs'],{stdio:'pipe'});
  const html=fs.readFileSync('dist-rc1016/demo.html','utf8');
  const bootstrap=html.indexOf('exporthub-rc1013-demo-bootstrap');
  const bridge=html.indexOf('exporthub-rc1016-demo-bridge');
  const seed=html.indexOf('exporthub-rc1016-demo-task-seed');
  assert.ok(bootstrap>=0&&bridge>bootstrap&&seed>bridge,'Demo-Task-Seed muss vor dem App-Start nach Bootstrap und Bridge geladen werden.');
  assert.match(html,/assets\/rc1016-demo-task-seed\.js\?v=1016/);
});
