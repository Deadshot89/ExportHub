import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const ROOT=process.cwd();
const AUDIT=path.join(ROOT,'scripts/taskplanner-v2-migration-audit.mjs');
const PRETEST=path.join(ROOT,'scripts/rc1462-pretest.mjs');
const BUILDER=path.join(ROOT,'.github/rc1112/build-three-env.mjs');
const RELEASE_MARKER=path.join(ROOT,'release-version.json');

function runNode(args,options={}){
  return spawnSync(process.execPath,args,{cwd:ROOT,encoding:'utf8',...options});
}

function sampleState(){
  return {
    tasks:[
      {id:'open-1',title:'Open',status:'open',customerId:'C1',shipmentId:'SH1',priority:'P2',dueDate:'2026-10-15'},
      {id:'done-1',title:'Done',status:'done',customerId:'C1',shipmentRef:'REF1',priority:'P1',completedAt:'2026-10-10T10:00:00+02:00'},
      {id:'series-1',title:'Series',status:'open',seriesId:'SER1',customerId:'C2',priority:'P2',dueDate:'2026-10-16'}
    ],
    taskSeries:[{id:'SER1',rule:{type:'weekly'}}],
    taskArchive:[]
  };
}

test('Migrationsaudit liefert deterministische Vorher/Nachher-Zahlen und fail-closed safe flag',async()=>{
  assert.ok(fs.existsSync(AUDIT),'scripts/taskplanner-v2-migration-audit.mjs muss für den Release-Gate existieren');
  const mod=await import(pathToFileURL(AUDIT).href+'?t='+Date.now());
  assert.equal(typeof mod.auditState,'function');
  const first=mod.auditState(sampleState(),{now:'2026-10-13T12:00:00+02:00'});
  const second=mod.auditState(sampleState(),{now:'2026-10-13T12:00:00+02:00'});
  assert.deepEqual(first,second,'Audit muss bei identischer Eingabe deterministisch sein');
  assert.equal(first.safe,true);
  assert.deepEqual(first.before,{tasks:3,active:2,done:1,series:1,customerLinks:3,shipmentLinks:2});
  assert.deepEqual(first.after,{tasks:3,active:2,done:1,series:1,customerLinks:3,shipmentLinks:2});
  assert.deepEqual(first.collisions,[]);
  assert.deepEqual(first.unresolvedRelationships,[]);
});

test('Migrationsaudit CLI beendet unsichere Identitätskollision mit Exitcode ungleich 0',()=>{
  assert.ok(fs.existsSync(AUDIT),'Migrationsaudit-Script fehlt');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taskplanner-v2-audit-'));
  try{
    const safeFile=path.join(dir,'safe.json');
    const unsafeFile=path.join(dir,'unsafe.json');
    fs.writeFileSync(safeFile,JSON.stringify(sampleState()));
    fs.writeFileSync(unsafeFile,JSON.stringify({tasks:[
      {id:'dup',title:'A',status:'open',customerId:'C1',shipmentId:'SH1'},
      {id:'dup',title:'B',status:'open',customerId:'C1',shipmentId:'SH2'}
    ]}));
    const safe=runNode([AUDIT,safeFile,'--now','2026-10-13T12:00:00+02:00']);
    assert.equal(safe.status,0,safe.stderr||safe.stdout);
    const parsed=JSON.parse(safe.stdout.trim());
    assert.equal(parsed.safe,true);
    const unsafe=runNode([AUDIT,unsafeFile,'--now','2026-10-13T12:00:00+02:00']);
    assert.notEqual(unsafe.status,0,'unsichere Migration darf Release nicht freigeben');
    const unsafeReport=JSON.parse(unsafe.stdout.trim());
    assert.equal(unsafeReport.safe,false);
    assert.ok(unsafeReport.collisions.length>0);
  }finally{
    fs.rmSync(dir,{recursive:true,force:true});
  }
});

test('RC1462 Pretest bleibt idempotent und verändert den sichtbaren Produktionsmarker nicht',()=>{
  const beforeMarker=fs.readFileSync(RELEASE_MARKER,'utf8');
  const first=runNode([PRETEST]);
  assert.equal(first.status,0,first.stderr||first.stdout);
  const afterFirstBuilder=fs.readFileSync(BUILDER,'utf8');
  const second=runNode([PRETEST]);
  assert.equal(second.status,0,second.stderr||second.stdout);
  const afterSecondBuilder=fs.readFileSync(BUILDER,'utf8');
  assert.equal(afterSecondBuilder,afterFirstBuilder,'Pretest muss nach erstem Prepare idempotent sein');
  assert.equal(fs.readFileSync(RELEASE_MARKER,'utf8'),beforeMarker,'sichtbarer Produktionsmarker darf durch TaskPlanner-Pretest nicht geändert werden');
});

test('Release-Builder führt alle drei Umgebungen und erforderlichen V2/Public-Link-Artefakte ohne temporäre Shipping-Muster',()=>{
  const source=fs.readFileSync(BUILDER,'utf8');
  assert.match(source,/environments:\{production:'index\.html',testservice:'TESTVERSION\.html',demo:'demo\.html'\}/);
  for(const rel of [
    'assets/taskplanner-v2-core.js','assets/taskplanner-v2-recurrence.js','assets/taskplanner-v2-planner.js',
    'assets/taskplanner-v2-projections.js','assets/taskplanner-v2-runtime-bridge.js','assets/taskplanner-v2-workflow.js',
    'assets/taskplanner-v2-ui.js','assets/taskplanner-v2-projection-ui.js','assets/taskplanner-v2-planner-ui.js',
    'assets/taskplanner-v2.css','assets/taskplanner-v2-projections.css','assets/task-public-read.js'
  ])assert.ok(source.includes(`'${rel}'`),`Builder muss ${rel} ausliefern`);
  assert.ok(source.includes("path.join(OUT,'task.html')"),'öffentliche Read-only-Seite muss gebaut werden');
  for(const required of ['api/task-public/index.js','api/task-public/function.json','task.html','assets/task-public-read.js'])assert.ok(fs.existsSync(path.join(ROOT,required)),`${required} fehlt`);
  assert.doesNotMatch(source,/taskplanner[^'"\n]*\.map['"]/i,'TaskPlanner Source-Maps dürfen nicht als Release-Artefakt verdrahtet sein');
  assert.doesNotMatch(source,/taskplanner[^'"\n]*(fixture|tmp|temp)[^'"\n]*['"]/i,'temporäre TaskPlanner-Fixtures dürfen nicht ausgeliefert werden');
});
