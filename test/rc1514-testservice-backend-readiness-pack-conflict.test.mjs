import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflowPath='.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';
const packApiPath='api/pack-notification/index.js';
const workflow=fs.readFileSync(workflowPath,'utf8');
const packApi=fs.readFileSync(packApiPath,'utf8');

function stepBlock(source,name,nextName){
  const start=source.indexOf(`- name: ${name}`);
  const end=source.indexOf(`- name: ${nextName}`,start+1);
  assert.ok(start>=0,`${name} fehlt`);
  assert.ok(end>start,`${nextName} fehlt hinter ${name}`);
  return source.slice(start,end);
}

test('RC1514: TESTSERVICE-State-Backend ist vor dem Browser-Gate nachweislich gesund',()=>{
  const deploy=workflow.indexOf('- name: Deploy ExportHUB TESTSERVICE');
  const health=workflow.indexOf('- name: RC1514 TESTSERVICE State-Backend bereit');
  const browser=workflow.indexOf('- name: RC1124 TESTSERVICE Browser Gate');
  assert.ok(deploy>=0,'TESTSERVICE-Deploy fehlt');
  assert.ok(health>deploy,'State-Backend-Readiness muss nach dem TESTSERVICE-Deploy laufen');
  assert.ok(browser>health,'State-Backend-Readiness muss vor dem Browser-Gate laufen');
  const block=stepBlock(workflow,'RC1514 TESTSERVICE State-Backend bereit','RC1124 TESTSERVICE Browser Gate');
  assert.match(block,/\/api\/exporthub-state\?mode=health/,'Readiness muss die echte State-Health-Route prüfen');
  assert.match(block,/http_code/,'Readiness muss den HTTP-Status auswerten');
  assert.match(block,/v\.ok===true/,'Readiness muss den JSON-Health-Status auswerten');
  assert.match(block,/sleep 5/,'Readiness muss Backend-Kaltstart begrenzt abwarten');
  assert.match(block,/exit 1/,'Readiness muss bei dauerhaft krankem Backend fail-closed bleiben');
});

test('RC1514: Pack-Draft-Saves behandeln Azure 409/412 mit begrenztem Backoff statt rohem 412',()=>{
  assert.match(packApi,/const MAX_RETRIES=12;/,'Pack-State muss dieselbe robuste Retry-Tiefe wie exporthub-state verwenden');
  assert.match(packApi,/const CONFLICT_BACKOFF_BASE_MS=12;/,'Pack-State braucht einen definierten Konflikt-Backoff');
  assert.match(packApi,/function sleep\(ms\)/,'Pack-State braucht einen asynchronen Retry-Delay');
  assert.match(packApi,/function isStorageWriteConflict\(e\)/,'409/412-Erkennung muss zentral und lesbar sein');
  const start=packApi.indexOf('function defaultMutateState()');
  const end=packApi.indexOf('function validateSessionForStation',start);
  assert.ok(start>=0&&end>start,'defaultMutateState-Block fehlt');
  const mutate=packApi.slice(start,end);
  assert.match(mutate,/if\(isStorageWriteConflict\(e\)\)/,'Blob-Konflikte müssen explizit behandelt werden');
  assert.match(mutate,/attempt<MAX_RETRIES-1\)\{await sleep/,'Konflikte müssen vor dem Retry gebremst werden');
  assert.match(mutate,/Math\.min\(250,CONFLICT_BACKOFF_BASE_MS\*Math\.pow\(2,Math\.min\(attempt,4\)\)\)/,'Backoff muss begrenzt exponentiell sein');
  assert.match(mutate,/throw error\('PACK_CONCURRENT_UPDATE'/,'ausgeschöpfte Konflikte dürfen keinen rohen Azure-412 ausgeben');
});
