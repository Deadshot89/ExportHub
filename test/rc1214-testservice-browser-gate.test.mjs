import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const helper=fs.readFileSync('e2e/helpers/exporthub-browser.mjs','utf8');
const navigation=fs.readFileSync('e2e/specs/navigation.spec.mjs','utf8');
const mutation=fs.readFileSync('e2e/specs/testservice-mutation.spec.mjs','utf8');

test('RC1214: fehlgeschlagener sichtbarer Navigationsklick lässt den vorhandenen sicheren Fallback zu',()=>{
  assert.match(helper,/const clicked=await item\.click\(\{timeout:7000\}\)\.then\(\(\)=>true\)\.catch\(\(\)=>false\);/);
  assert.match(helper,/if\(!clicked\)return false;/);
  assert.match(mutation,/openExportHubView\(page,'history',[\s\S]*allowProgrammaticFallback:true/);
});

test('RC1214: nur GET pickup-status ERR_ABORTED wird für den Navigationstest quittierbar',()=>{
  const start=helper.indexOf('export function acknowledgePickupStatusNavigationAbort');
  const end=helper.indexOf('export function acknowledgeConfirmedStateSaveNavigationAbort',start);
  assert.ok(start>=0&&end>start);
  const block=helper.slice(start,end);
  assert.match(block,/\^GET\\s\+/);
  assert.match(block,/\\\/api\\\/pickup-status\\\?/);
  assert.match(block,/net::ERR_ABORTED\$/);
  assert.doesNotMatch(block,/POST/);
  assert.doesNotMatch(block,/exporthub-state/);
});

test('RC1214: globaler Browser-Guard bleibt unverändert streng',()=>{
  const start=helper.indexOf("page.on('requestfailed'");
  const end=helper.indexOf("page.on('response'",start);
  const listener=helper.slice(start,end);
  assert.match(listener,/state\.requestFailures\.push/);
  assert.doesNotMatch(listener,/ERR_ABORTED/);
  assert.doesNotMatch(listener,/pickup-status/);
});

test('RC1214: Navigation akzeptiert höchstens einen gezielten Pickup-Abbruch',()=>{
  assert.match(navigation,/acknowledgePickupStatusNavigationAbort\(runtime\)/);
  assert.match(navigation,/pickupNavigationAborts[\s\S]*toBeLessThanOrEqual\(1\)/);
});

test('RC1218: nur ein abgebrochener POST-State-Read darf nach bestätigter Persistenz quittiert werden',()=>{
  const start=helper.indexOf('export function acknowledgeReadStateNavigationAbort');
  const end=helper.indexOf('export function acknowledgeConfirmedStateSaveNavigationAbort',start);
  assert.ok(start>=0&&end>start);
  const block=helper.slice(start,end);
  assert.match(block,/\^POST\\s\+/);
  assert.match(block,/\\\/api\\\/exporthub-state\\\?/);
  assert.match(block,/params\.get\('mode'\)!=='read'/);
  assert.match(block,/net::ERR_ABORTED\$/);
  assert.doesNotMatch(block,/mode'\)==='save'/);
});

test('RC1218: Mutation-Gate quittiert State-Read erst nach direktem History-Persistenznachweis und höchstens einmal',()=>{
  const persisted=mutation.indexOf("expect(historyPersisted.status).toBe(200)");
  const settle=mutation.lastIndexOf('await settleStateSave(page,{timeout:25_000});');
  const acknowledge=mutation.indexOf('acknowledgeReadStateNavigationAbort(runtime)');
  const clean=mutation.indexOf('assertRuntimeClean(runtime,testInfo)');
  assert.ok(persisted>=0&&settle>persisted&&acknowledge>settle&&clean>acknowledge);
  assert.match(mutation,/readNavigationAborts[\s\S]*toBeLessThanOrEqual\(1\)/);
});

test('RC1214: geänderte E2E-Dateien sind syntaktisch gültig',()=>{
  for(const file of ['e2e/helpers/exporthub-browser.mjs','e2e/specs/navigation.spec.mjs','e2e/specs/testservice-mutation.spec.mjs']){
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  }
});


test('RC1215: mutierender TESTSERVICE-Live-Test hat ausreichend Zeit für mehrere bestätigte Azure-Saves',()=>{
  assert.match(mutation,/test\.setTimeout\(180_000\);/);
  assert.doesNotMatch(mutation,/test\.setTimeout\(90_000\);/);
});
