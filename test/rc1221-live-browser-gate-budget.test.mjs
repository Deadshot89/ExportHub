import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const nav=fs.readFileSync('e2e/specs/navigation.spec.mjs','utf8');
const notifications=fs.readFileSync('e2e/specs/notifications.spec.mjs','utf8');
const shipment=fs.readFileSync('e2e/specs/shipment-create.spec.mjs','utf8');
const helper=fs.readFileSync('e2e/helpers/exporthub-browser.mjs','utf8');
const config=fs.readFileSync('playwright.config.mjs','utf8');

test('RC1221: Live-Navigation bekommt mehr Zeit ohne fachliche Views zu reduzieren',()=>{
  assert.match(nav,/EXPORTHUB_E2E_LIVE==='1'\)test\.setTimeout\(240_000\)/);
  for(const marker of ["customerfolder","shipment","notifications","shipmentoverview","shippingcosts","academy"]){
    assert.ok(nav.includes("'"+marker+"'"),marker+' fehlt');
  }
});

test('RC1221: mutierende Sendungserstellung bleibt vollständig und erhält nur mehr Live-Zeit',()=>{
  assert.match(shipment,/test\.setTimeout\(240_000\)/);
  for(const marker of ['#shipmentCustomerSearch','#index289LocationSelect','#rc363SaveShipment','exporthub:shipment-saved','mode=read&full=1']){
    assert.ok(shipment.includes(marker),marker+' fehlt');
  }
});

test('RC1221: Benachrichtigungsgate bleibt fachlich unverändert und bekommt nur Live-Zeit',()=>{
  assert.match(notifications,/EXPORTHUB_E2E_LIVE==='1'\)test\.setTimeout\(120_000\)/);
  assert.match(notifications,/Ghost-Aufgabe/);
  assert.match(notifications,/Gerenderte Aufgabenmenge weicht vom Zähler ab/);
  assert.match(notifications,/Doppelte fachlich identische Benachrichtigungen/);
});

test('RC1221: längere Helper-Wartezeiten gelten ausschließlich live',()=>{
  assert.match(helper,/EXPORTHUB_E2E_LIVE==='1'\?20_000:10_000/);
  assert.match(helper,/EXPORTHUB_E2E_LIVE==='1'\?12_000:7000/);
  assert.match(helper,/EXPORTHUB_E2E_LIVE==='1'\?10_000:5000/);
});

test('RC1221: Gate bleibt streng ohne Retries und mit allen fünf Viewports',()=>{
  assert.match(config,/retries\s*:\s*0/);
  for(const [w,h] of [[360,800],[390,844],[768,1024],[1366,768],[1920,1080]]){
    assert.match(config,new RegExp('width\\s*:\\s*'+w+'[\\s\\S]{0,100}height\\s*:\\s*'+h));
  }
});

test('RC1221: geänderte E2E-Dateien sind syntaktisch gültig',()=>{
  for(const file of [
    'e2e/helpers/exporthub-browser.mjs',
    'e2e/specs/navigation.spec.mjs',
    'e2e/specs/notifications.spec.mjs',
    'e2e/specs/shipment-create.spec.mjs'
  ])execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
});
