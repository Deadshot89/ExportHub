import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const helper=fs.readFileSync('e2e/helpers/exporthub-browser.mjs','utf8');
const spec=fs.readFileSync('e2e/specs/shipment-create.spec.mjs','utf8');

test('RC1181: globaler Browser-Guard bleibt streng und quittiert ERR_ABORTED nicht automatisch',()=>{
  assert.match(helper,/page\.on\('requestfailed'/);
  assert.match(helper,/state\.requestFailures\.push/);
  assert.match(helper,/expect\(payload\.requestFailures,'Fehlgeschlagene Browser-Requests'\)\.toEqual\(\[\]\)/);
  const listenerStart=helper.indexOf("page.on('requestfailed'");
  const listenerEnd=helper.indexOf("page.on('response'",listenerStart);
  const listener=helper.slice(listenerStart,listenerEnd);
  assert.doesNotMatch(listener,/ERR_ABORTED/);
  assert.doesNotMatch(listener,/exporthub-state/);
});

test('RC1181: Quittierung ist ausschließlich auf POST state save ack=1 + net::ERR_ABORTED begrenzt',()=>{
  assert.match(helper,/function acknowledgeConfirmedStateSaveNavigationAbort/);
  assert.match(helper,/\^POST\\s\+/);
  assert.match(helper,/net::ERR_ABORTED\$/);
  assert.match(helper,/\\\/api\\\/exporthub-state\\\?/);
  assert.match(helper,/params\.get\('mode'\)==='save'/);
  assert.match(helper,/params\.get\('ack'\)==='1'/);
});

test('RC1181: Quittierung erfolgt erst nach direktem Server-Persistenznachweis',()=>{
  const serverRead=spec.indexOf("fetch('/api/exporthub-state?mode=read&full=1'");
  const persistedRows=spec.indexOf('expect(persisted.found?.rows?.length).toBeGreaterThan(0)');
  const acknowledge=spec.indexOf('acknowledgeConfirmedStateSaveNavigationAbort(runtime)');
  const clean=spec.indexOf('assertRuntimeClean(runtime,testInfo)');
  assert.ok(serverRead>=0);
  assert.ok(persistedRows>serverRead);
  assert.ok(acknowledge>persistedRows);
  assert.ok(clean>acknowledge);
  assert.match(spec,/confirmedNavigationSaveAborts[\s\S]*toBeLessThanOrEqual\(1\)/);
});

test('RC1181: keine anderen Request- oder HTTP-Fehler werden aus dem Gate entfernt',()=>{
  assert.doesNotMatch(helper,/httpErrors\s*=\s*.*filter/);
  assert.doesNotMatch(helper,/consoleErrors\s*=\s*.*filter/);
  assert.doesNotMatch(helper,/pageErrors\s*=\s*.*filter/);
});

test('RC1181: geänderte E2E-Dateien sind syntaktisch gültig',()=>{
  for(const file of ['e2e/helpers/exporthub-browser.mjs','e2e/specs/shipment-create.spec.mjs']){
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  }
});
