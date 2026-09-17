import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const navigation=fs.readFileSync('e2e/specs/navigation.spec.mjs','utf8');
const notifications=fs.readFileSync('e2e/specs/notifications.spec.mjs','utf8');
const helper=fs.readFileSync('e2e/helpers/exporthub-browser.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');

function assertLiveSessionBeforeNavigation(source,label){
  assert.match(source,/installE2ESession/label.replace?.('','')||undefined);
}

test('RC1145: interne Browser-Specs installieren Live-E2E-Session vor dem ersten Seitenaufruf',()=>{
  for(const [label,source] of [['Navigation',navigation],['Benachrichtigungen',notifications]]){
    assert.match(source,/installE2ESession/,`${label}: Session-Helper fehlt`);
    const beforeEach=source.indexOf('test.beforeEach');
    const install=source.indexOf('installE2ESession(page)',beforeEach);
    const firstGoto=source.indexOf('page.goto(appEntry()');
    assert.ok(beforeEach>=0,`${label}: zentraler beforeEach fehlt`);
    assert.ok(install>beforeEach,`${label}: Session wird im beforeEach nicht installiert`);
    assert.ok(install<firstGoto,`${label}: Session muss vor dem ersten page.goto installiert werden`);
    assert.match(source,/EXPORTHUB_E2E_LIVE\s*===\s*['"]1['"]/,`${label}: lokale Demo darf keine Live-Session verlangen`);
  }
});

test('RC1145: Workflow stellt dem Live-Browser-Gate weiterhin Sessiondaten bereit',()=>{
  assert.match(workflow,/export EXPORTHUB_E2E_SESSION_TOKEN=/);
  assert.match(workflow,/export EXPORTHUB_E2E_USER_B64=/);
  assert.match(workflow,/export EXPORTHUB_E2E_RUN_ID=/);
  assert.match(helper,/sessionStorage\.setItem\('exporthub_rc301_tab_session'/);
});
