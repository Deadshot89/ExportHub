import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const API='api/e2e-test-fixture/index.js';
const FN='api/e2e-test-fixture/function.json';
const SPEC='e2e/specs/testservice-mutation.spec.mjs';
const HELPER='e2e/helpers/exporthub-browser.mjs';
const WF='.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';

test('RC1139: sicherer E2E-Fixture-Endpunkt ist vorhanden und nur GitHub OIDC darf ihn aufrufen',()=>{
  for(const file of [API,FN])assert.ok(fs.existsSync(file),file+' fehlt');
  const source=fs.readFileSync(API,'utf8');
  assert.match(source,/exporthub-e2e-fixture/,'dedizierte OIDC-Audience fehlt');
  assert.match(source,/token\.actions\.githubusercontent\.com/,'GitHub-OIDC-Prüfung fehlt');
  assert.match(source,/azure-static-web-apps-wonderful-forest-0f315e310\.yml/,'Workflow-Bindung fehlt');
  assert.match(source,/refs\/heads\/main/,'Main-Bindung fehlt');
  assert.match(source,/E2E_FIXTURE_FORBIDDEN/,'fail-closed Autorisierung fehlt');
});

test('RC1139: Fixture ist hart auf TESTSERVICE und E2E-Präfix begrenzt',()=>{
  const source=fs.readFileSync(API,'utf8');
  assert.match(source,/TESTSERVICE_ONLY/,'Produktionssperre fehlt');
  assert.match(source,/ashy-grass-065b7b803-testservice\.westeurope\.6\.azurestaticapps\.net/,'exakter TESTSERVICE-Host fehlt');
  assert.match(source,/E2E-/,'E2E-Präfix fehlt');
  assert.match(source,/action\s*===?\s*['"]prepare['"]/,'Prepare fehlt');
  assert.match(source,/action\s*===?\s*['"]cleanup['"]/,'Cleanup fehlt');
  assert.doesNotMatch(source,/wonderful-forest-0f315e310\.7\.azurestaticapps\.net/,'Produktionshost darf nicht freigeschaltet werden');
});

test('RC1139: Prepare erstellt nicht-admin Testbenutzer mit Bearbeitungsrechten und signierter Kurzzeitsitzung',()=>{
  const source=fs.readFileSync(API,'utf8');
  assert.match(source,/globalAdmin\s*:\s*false/,'E2E-Benutzer darf kein Global Admin sein');
  assert.match(source,/functionAdmin\s*:\s*false/,'E2E-Benutzer darf kein Funktionsadmin sein');
  assert.match(source,/edit\s*:\s*true/,'Bearbeitungsrecht fehlt');
  assert.match(source,/createSignedSessionToken/,'signierte Sitzung muss vorhandenen Auth-Mechanismus verwenden');
  assert.match(source,/60\s*\*\s*60\s*\*\s*1000|3600000/,'Sitzung muss kurzlebig sein');
  assert.match(source,/ifMatch|etag/,'ETag-Schutz fehlt');
});

test('RC1139: Cleanup entfernt ausschließlich Datensätze des eigenen E2E-Runs',()=>{
  const source=fs.readFileSync(API,'utf8');
  assert.match(source,/_e2eRunId/,'Run-Markierung fehlt');
  assert.match(source,/runId/,'Run-ID fehlt');
  assert.match(source,/shipments/);
  assert.match(source,/savedShipments/);
  assert.match(source,/users/);
  assert.match(source,/CONCURRENT_UPDATE/,'Cleanup muss bei Konflikt fail-closed sein');
});

test('RC1139: Browser-Helfer kann eine echte E2E-Sitzung vor App-Start installieren',()=>{
  const source=fs.readFileSync(HELPER,'utf8');
  assert.match(source,/installE2ESession/,'Session-Helper fehlt');
  assert.match(source,/EXPORTHUB_E2E_SESSION_TOKEN/,'Token-Env fehlt');
  assert.match(source,/EXPORTHUB_E2E_USER_B64/,'Benutzer-Env fehlt');
  assert.match(source,/exporthub_rc301_tab_session/,'echter ExportHUB-Session-Key fehlt');
  assert.match(source,/addInitScript/,'Sitzung muss vor dem App-Code installiert werden');
});

test('RC1139: mutierender Browser-Test schreibt echten TESTSERVICE-State, lädt neu und prüft Persistenz',()=>{
  assert.ok(fs.existsSync(SPEC),SPEC+' fehlt');
  const source=fs.readFileSync(SPEC,'utf8');
  assert.match(source,/EXPORTHUB_E2E_MUTATION/,'Mutation-Gate fehlt');
  assert.match(source,/installE2ESession/,'echte Sitzung wird nicht installiert');
  assert.match(source,/\/api\/exporthub-auth/,'Session wird nicht gegen Auth-API verifiziert');
  assert.match(source,/\/api\/exporthub-state\?mode=save&ack=1/,'echter State-Save fehlt');
  assert.match(source,/_e2eRunId/,'Testsendung ist nicht run-spezifisch markiert');
  assert.match(source,/page\.reload/,'F5/Reload-Nachweis fehlt');
  assert.match(source,/shipmentoverview/,'UI-Nachweis in Sendungsübersicht fehlt');
});

test('RC1139: TESTSERVICE Release-Gate fordert OIDC an, nutzt echte App statt Demo und räumt immer auf',()=>{
  const source=fs.readFileSync(WF,'utf8');
  assert.match(source,/id-token:\s*write/,'Workflow darf keine OIDC-ID anfordern');
  const gate=source.indexOf('- name: RC1124 TESTSERVICE Browser Gate');
  const prod=source.indexOf('- name: Deploy ExportHUB production');
  assert.ok(gate>=0&&prod>gate,'TESTSERVICE-Gate muss weiter vor Produktion liegen');
  const block=source.slice(gate,prod);
  assert.match(block,/audience=exporthub-e2e-fixture/,'Fixture-OIDC fehlt');
  assert.match(block,/\/api\/e2e-test-fixture/,'Fixture-Aufruf fehlt');
  assert.match(block,/EXPORTHUB_E2E_ENTRY:\s*\//,'echte App muss getestet werden');
  assert.doesNotMatch(block,/EXPORTHUB_E2E_ENTRY:\s*\/demo\.html/,'mutierender Test darf nicht auf Demo laufen');
  assert.match(block,/testservice-mutation\.spec\.mjs/,'Mutation-Spec fehlt');
  assert.match(block,/trap .*cleanup|cleanup.*trap/s,'Cleanup muss auch bei Testfehler laufen');
  assert.match(block,/::add-mask::/,'Sessiontoken muss in GitHub-Logs maskiert werden');
});
