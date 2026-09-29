import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const spec=fs.readFileSync('e2e/specs/testservice-mutation.spec.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');

test('RC1346 P1: RC1255 erwartet den aktuellen sicheren TESTSERVICE-Avis-Link',()=>{
  assert.match(spec,/ashy-grass-065b7b803-testservice\\.westeurope\\.6\\.azurestaticapps\\.net\\\/customer-avis\\.html\\\?token=/);
  assert.doesNotMatch(spec,/expect\(issued\.url\)\.toMatch\(\/\^https:\\\/\\\/exporthub360\\\.com\\\/avis/);
});

test('RC1346 P1: nur der eindeutig erkannte Graph Mail.Send Blocker wird als P2 übersprungen',()=>{
  assert.match(spec,/knownMailSendBlocker=mailResponse\.status\(\)===503&&String\(mailDiagnostic&&mailDiagnostic\.code\|\|''\)==='GRAPH_MAIL_PERMISSION_MISSING'/);
  assert.match(spec,/test\.skip\(true,'RC1255 P2: Microsoft Graph Application Permission Mail\.Send fehlt/);
});

test('RC1346 P1: Release-Workflow schluckt keine beliebigen RC1255-Fehler mehr',()=>{
  const start=workflow.indexOf("npx playwright test e2e/specs/testservice-mutation.spec.mjs --project=laptop --grep 'RC1255 P2:'");
  assert.ok(start>=0,'RC1255 Playwright-Aufruf fehlt');
  const window=workflow.slice(Math.max(0,start-400),start+500);
  assert.doesNotMatch(window,/rc1255_mail_status|set \+e|Der echte TESTSERVICE-Mailversand ist blockiert/);
});
