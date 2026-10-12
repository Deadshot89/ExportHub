import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const fixturePath='api/e2e-test-fixture/index.js';
const workflowPath='.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';
const specPath='e2e/specs/pack-notification.spec.mjs';

function read(path){return fs.readFileSync(path,'utf8')}

function stepBlock(workflow,name,nextName){
  const start=workflow.indexOf(`- name: ${name}`);
  assert.ok(start>=0,`${name} fehlt`);
  const end=nextName?workflow.indexOf(`- name: ${nextName}`,start+1):-1;
  return workflow.slice(start,end>start?end:undefined);
}

test('RC1499: TESTSERVICE-Fixture erzeugt pro Release einen nur gehasht gespeicherten Packtisch-Token',()=>{
  const fixture=read(fixturePath);
  assert.match(fixture,/require\(['"]\.\.\/shared\/pack-notification-store['"]\)/,'Pack-Store wird im E2E-Fixture nicht verwendet');
  assert.match(fixture,/packStationToken\s*=\s*['"]E2E-PACK-['"]\s*\+\s*crypto\./,'temporärer Packtisch-Token fehlt');
  assert.match(fixture,/team\.state\.packStations\s*=\s*Array\.isArray\(team\.state\.packStations\)/,'Packstationen werden im TESTSERVICE-Fixture nicht vorbereitet');
  assert.match(fixture,/tokenHash\s*:\s*packStore\.hashStationToken\(packStationToken\)/,'Packtisch-Token wird nicht gehasht gespeichert');
  assert.match(fixture,/_e2eRunId\s*:\s*runId/,'temporäre Packstation ist nicht dem E2E-Run zugeordnet');
  assert.match(fixture,/packStationToken\s*[:,]\s*packStationToken/,'Prepare-Antwort liefert den temporären Packtisch-Token nicht');
  assert.doesNotMatch(fixture,/packStations[\s\S]{0,500}\btoken\s*:\s*packStationToken/,'roher Packtisch-Token darf nicht im Team-State gespeichert werden');
});

test('RC1499: Packmeldungs-E2E läuft im bestehenden mutierenden TESTSERVICE-Gate vor Production',()=>{
  const workflow=read(workflowPath);
  const gate=stepBlock(workflow,'RC1124 TESTSERVICE Browser Gate','RC1124 TESTSERVICE Browser-Artefakte');
  const production=workflow.indexOf('- name: Deploy ExportHUB production');
  const gateStart=workflow.indexOf('- name: RC1124 TESTSERVICE Browser Gate');
  assert.ok(production>gateStart,'Production muss nach dem TESTSERVICE Browser Gate liegen');
  assert.match(gate,/pack_station_token=.*packStationToken/,'Workflow liest den temporären Packtisch-Token nicht aus dem Fixture');
  assert.match(gate,/::add-mask::\$pack_station_token/,'Packtisch-Token wird in Actions-Logs nicht maskiert');
  assert.match(gate,/export EXPORTHUB_E2E_PACK_STATION_TOKEN="\$pack_station_token"/,'Packtisch-Token wird nicht an Playwright übergeben');
  assert.match(gate,/e2e\/specs\/pack-notification\.spec\.mjs/,'Packmeldungs-E2E fehlt im mutierenden TESTSERVICE-Gate');
  assert.match(gate,/export EXPORTHUB_E2E_MUTATION=['"]1['"]/,'Packmeldungs-E2E muss im mutierenden TESTSERVICE-Gate laufen');
});

test('RC1499: Production bleibt read-only und führt keinen Packmeldungs-Mutationstest aus',()=>{
  const workflow=read(workflowPath);
  const smoke=stepBlock(workflow,'RC1124 Produktion Read-only Browser Smoke','RC1124 Produktion Browser-Artefakte');
  assert.doesNotMatch(smoke,/pack-notification\.spec\.mjs/);
  assert.doesNotMatch(smoke,/EXPORTHUB_E2E_MUTATION/);
  assert.doesNotMatch(smoke,/EXPORTHUB_E2E_PACK_STATION_TOKEN/);
});

test('RC1499: E2E-Fixture und Packmeldungs-Spec bleiben syntaktisch gültig',()=>{
  execFileSync(process.execPath,['--check',fixturePath],{stdio:'pipe'});
  execFileSync(process.execPath,['--check',specPath],{stdio:'pipe'});
});
