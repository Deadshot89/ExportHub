import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const archive=fs.readFileSync('api/shared/pod-archive.js','utf8');
const api=fs.readFileSync('api/pod-backup-reconcile/index.js','utf8');
const workflow=fs.readFileSync('.github/workflows/rc1144-pod-backup-reconcile.yml','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

test('RC1168: gezielter POD-Nachweis unterscheidet gefunden, bereit und bereits gespeichert',()=>{
  assert.match(archive,/referenceMatched/);
  assert.match(archive,/referencePodReady/);
  assert.match(archive,/alreadySavedCount/);
  for(const status of ['not-found','pod-not-ready','error','pending','saved-now','already-saved','incomplete']){
    assert.match(archive,new RegExp("'"+status+"'"),status+' fehlt');
  }
  assert.match(archive,/matchedCount:\s*referenceMatched/);
  assert.match(archive,/podReadyCount:\s*referencePodReady/);
  assert.match(archive,/savedNowCount:\s*saved\.length/);
});

test('RC1168: bereits gesicherter Ziel-POD wird nicht erneut hochgeladen',()=>{
  const already=archive.indexOf('if (backup.driveSaved === true)');
  const candidate=archive.indexOf('candidates.push({',already);
  assert.ok(already>0&&candidate>already,'driveSaved muss vor Kandidatenaufnahme geprüft werden');
  assert.match(archive,/alreadySaved\.push/);
});

test('RC1168: Workflow-Dispatch akzeptiert Referenz und Zielumgebung',()=>{
  assert.match(workflow,/workflow_dispatch:\s*\n\s*inputs:/);
  assert.match(workflow,/reference:\s*\n\s*description:/);
  assert.match(workflow,/environment:\s*\n[\s\S]*default:\s*production/);
  assert.match(workflow,/TARGET_REFERENCE:/);
  assert.match(workflow,/reference:String\(process\.env\.TARGET_REFERENCE\|\|''\)\.trim\(\)\.toUpperCase\(\)/);
});

test('RC1168: gezielter Workflow akzeptiert nur bestätigten M365-Sicherungsstatus als Erfolg',()=>{
  assert.match(workflow,/\['already-saved','saved-now'\]\.includes\(v\.target\.status\)/);
  assert.match(workflow,/process\.exit\(5\)/);
  assert.match(workflow,/process\.exit\(6\)/);
  assert.match(workflow,/matchedCount:v\.target\.matchedCount/);
  assert.match(workflow,/podReadyCount:v\.target\.podReadyCount/);
});

test('RC1168: Diagnose bleibt frei von Graph-Secrets und Zielbenutzer',()=>{
  assert.doesNotMatch(workflow,/targetUser:v\.targetUser/);
  assert.doesNotMatch(workflow,/clientSecret:v\.clientSecret/);
  assert.doesNotMatch(workflow,/access_token/);
  assert.doesNotMatch(workflow,/driveItemId:v\./);
  assert.doesNotMatch(workflow,/webUrl:v\./);
});

test('RC1168: API und Build enthalten den gezielten Nachweis',()=>{
  execFileSync(process.execPath,['--check','api/pod-backup-reconcile/index.js'],{stdio:'pipe'});
  execFileSync(process.execPath,['--check','api/shared/pod-archive.js'],{stdio:'pipe'});
  assert.match(api,/version:\s*'RC1168'/);
  assert.match(api,/reference:\s*reference\s*\|\|\s*null/);
  assert.match(build,/podTargetedProof:'RC1168 targeted reference proof/);
});
