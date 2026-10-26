import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const fixturePath='api/e2e-test-fixture/index.js';
const mainWorkflowPath='.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';
const productionWorkflowPath='.github/workflows/exporthub-production-release.yml';
const packSpecPath='e2e/specs/pack-notification.spec.mjs';
const publicSmokePath='e2e/specs/public-smoke.spec.mjs';
const helperPath='e2e/helpers/pack-notification-live.mjs';

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
  assert.match(fixture,/_e2ePackStationToken\s*:\s*pack\.packStationToken/,'temporärer Token wird nicht ausschließlich an den E2E-Client übergeben');
  assert.doesNotMatch(fixture,/station\s*:\s*\{[\s\S]{0,500}\btoken\s*:\s*packStationToken/,'roher Packtisch-Token darf nicht im Team-State gespeichert werden');
});

test('RC1513/RC1520: TESTSERVICE-Fixture behält Root-Token und nutzt das User-Feld im Browser-Gate',()=>{
  const fixture=read(fixturePath),workflow=read(mainWorkflowPath);
  const gate=stepBlock(workflow,'RC1124 TESTSERVICE Browser Gate','RC1124 TESTSERVICE Browser-Artefakte');
  assert.match(gate,/v\.user\s*&&\s*v\.user\._e2ePackStationToken/,'Browser-Gate muss den Token aus prepared.user lesen');
  assert.match(fixture,/runId,_e2ePackStationToken\s*:\s*pack\.packStationToken,token:adminSession\.token/,'Fixture muss den Root-Token als Kompatibilitätsfeld weiterliefern');
  assert.match(fixture,/const e2eAdminUser=Object\.assign\(\{\},publicUser\(user,false\),\{_e2ePackStationToken:pack\.packStationToken\}\)/,'Fixture muss den User-Token bereitstellen');
});

test('RC1499: Fixture-Cleanup entfernt Packstation, Sessions, Entwürfe, Packmeldungen und projizierte Aufgaben',()=>{
  const fixture=read(fixturePath);
  assert.match(fixture,/function removePackRunRecords\(/);
  for(const key of ['packStations','packSessions','packDrafts','packNotifications','tasks'])assert.match(fixture,new RegExp(`filter\\('${key}'`),`${key} fehlt im Pack-Cleanup`);
  assert.match(fixture,/sourceType\)==='pack_notification'/,'Packmeldungs-Aufgaben werden nicht gezielt bereinigt');
  assert.match(fixture,/removePackRunRecords\(team\.state,runId\)/,'Pack-Cleanup wird beim Fixture-Cleanup nicht ausgeführt');
});

test('RC1499: Prepare bereinigt auch verwaiste Pack-Daten eines abgebrochenen früheren E2E-Laufs',()=>{
  const fixture=read(fixturePath);
  assert.match(fixture,/function removeStalePackRecords\(/,'stale Pack-Recovery fehlt');
  assert.match(fixture,/removeStalePackRecords\(team\.state\)/,'stale Pack-Recovery wird vor neuer Fixture nicht ausgeführt');
  assert.match(fixture,/purgedStaleRecords:stalePack\.removed\+staleState\.removed/,'Recovery-Zähler berücksichtigt verknüpfte Pack-Daten nicht');
});

test('RC1505/RC1499: echter Packmeldungsfluss läuft im mutierenden TESTSERVICE-Gate und ist Voraussetzung für Production-Promotion',()=>{
  const workflow=read(mainWorkflowPath),production=read(productionWorkflowPath),publicSmoke=read(publicSmokePath),helper=read(helperPath);
  const gate=stepBlock(workflow,'RC1124 TESTSERVICE Browser Gate','RC1124 TESTSERVICE Browser-Artefakte');
  assert.match(gate,/e2e\/specs\/public-smoke\.spec\.mjs/,'Pflicht-Smoke fehlt im mutierenden TESTSERVICE-Gate');
  assert.match(gate,/export EXPORTHUB_E2E_MUTATION=['"]1['"]/,'TESTSERVICE-Gate ist nicht mutierend aktiviert');
  assert.match(gate,/EXPORTHUB_E2E_PACK_STATION_TOKEN/,'temporärer Packtisch-Token wird dem TESTSERVICE-Browsergate nicht übergeben');
  assert.doesNotMatch(workflow,/Deploy ExportHUB production/,'Main-Verifikation darf Production nicht deployen');
  const verify=production.indexOf('RC1505 Erfolgreiche Main Verification für Release-SHA verlangen');
  const prodDeploy=production.indexOf('Deploy ExportHUB production');
  assert.ok(verify>=0&&prodDeploy>verify,'Production-Promotion muss erfolgreichen Main-Verification-Lauf für denselben SHA voraussetzen');
  assert.match(publicSmoke,/RC1499: echter QR-Packmeldungsfluss/,'Packmeldungs-Livefall ist nicht Teil des Pflicht-Smokes');
  assert.match(publicSmoke,/EXPORTHUB_E2E_LIVE/);
  assert.match(publicSmoke,/EXPORTHUB_E2E_MUTATION/);
  assert.match(publicSmoke,/runPackNotificationLiveFlow/);
  assert.match(helper,/_e2ePackStationToken/,'Live-Helper liest den temporären Fixture-Token nicht');
  assert.match(helper,/Promise\.all\(/,'zwei parallele Packer werden nicht gleichzeitig geprüft');
  assert.match(helper,/packSaveDraft/,'Entwurfsspeicherung fehlt im Livefluss');
  assert.match(helper,/packSubmit/,'finales Übermitteln fehlt im Livefluss');
  assert.match(helper,/data-pack-action="shipment"/,'Sendungs-Handoff fehlt im Livefluss');
});

test('RC1520: TESTSERVICE-Gate liest den Packtisch-Token aus dem Fixture-Uservertrag',()=>{
  const workflow=read(mainWorkflowPath);
  const gate=stepBlock(workflow,'RC1124 TESTSERVICE Browser Gate','RC1124 TESTSERVICE Browser-Artefakte');
  assert.match(gate,/v\.user\s*&&\s*v\.user\._e2ePackStationToken/,'Workflow liest den Packtisch-Token nicht aus prepared.user._e2ePackStationToken');
});

test('RC1507: Pack-Live-Gate prüft den Ablauf ohne lokalisierte Anzeige-Texte',()=>{
  const helper=read(helperPath);
  assert.doesNotMatch(helper,/locator\('#packValidationHint'\)\)\.toContainText\(/,'Speicherprüfung darf nicht von übersetztem Hinweistext abhängen');
  assert.doesNotMatch(helper,/locator\('#packFormMode'\)\)\.toContainText\(/,'Entwurfsmodus darf nicht über übersetzten Modustext erkannt werden');
  assert.doesNotMatch(helper,/expect\(card\)\.toContainText\(['"]Anzahl Paletten['"]\)/,'Entwurfskarte darf nicht über deutsches Label geprüft werden');
  assert.match(helper,/locator\('#packCustomer'\)\)\.toHaveValue/,'Entwurf muss semantisch über gespeicherte Kundendaten verifiziert werden');
  assert.match(helper,/locator\('#packPackageCount'\)\)\.toHaveValue/,'Entwurf muss semantisch über gespeicherte Packstückzahl verifiziert werden');
});

test('RC1505/RC1499: Production bleibt read-only; RC1499 überspringt dort automatisch',()=>{
  const workflow=read(productionWorkflowPath);
  const smoke=stepBlock(workflow,'RC1124 Produktion Read-only Browser Smoke','RC1124 Produktion Browser-Artefakte');
  assert.match(smoke,/public-smoke\.spec\.mjs/);
  assert.doesNotMatch(smoke,/EXPORTHUB_E2E_MUTATION/);
  assert.doesNotMatch(smoke,/EXPORTHUB_E2E_PACK_STATION_TOKEN/);
});

test('RC1499: manueller Pack-E2E und Pflicht-Smoke verwenden denselben Live-Helper',()=>{
  const packSpec=read(packSpecPath),publicSmoke=read(publicSmokePath);
  assert.match(packSpec,/pack-notification-live\.mjs/);
  assert.match(packSpec,/runPackNotificationLiveFlow/);
  assert.match(publicSmoke,/pack-notification-live\.mjs/);
});

test('RC1670: TESTSERVICE gate verifies persisted shipment PDF bytes after a real save and reload',()=>{
  const helper=read(helperPath);
  assert.match(helper,/locator\('#rc363SaveShipment'\)\.click\(\)/,'real shipment save click missing');
  assert.match(helper,/page\.reload\(/,'real browser reload missing');
  assert.match(helper,/mode=read&full=1/,'authenticated team-state reread missing');
  assert.match(helper,/viewer\.fetchBytes\(doc\)/,'real Blob PDF content read missing');
  assert.match(helper,/persisted\.signature\)\.toBe\('%PDF-'\)/,'PDF binary signature must be asserted');
  assert.match(helper,/packNotificationId===notificationId/,'saved shipment must belong to originating pack');
  assert.match(helper,/persisted\.blobName\)\.toBe\(originalPdf\.blobName\)/,'persisted Blob identity must equal original pack PDF');
  assert.match(helper,/persisted\.avisVisible\)\.toBe\(false\)/,'private pack PDF must not be exposed to customer Avis');
  const smoke=read(publicSmokePath),spec=read(packSpecPath);
  assert.match(smoke,/test\.setTimeout\(300_000\)/);
  assert.match(spec,/test\.setTimeout\(300_000\)/);
});

test('RC1676: Pack-to-shipment live test finds the accessible reference and still validates a saved six-digit readonly REF',()=>{
  const helper=read(helperPath);
  assert.match(helper,/getByLabel\(\/Sendungsreferenz\\s\*\\\/\\s\*Referenznummer\/i\)/,
    'Live Pack handoff must use the semantic reference label used by the main shipment E2E');
  assert.match(helper,/refField=await labeledRef\.count\(\)\?labeledRef:/,
    'Only fall back to the legacy selector when no accessible reference label exists');
  assert.match(helper,/expect\(refField\)\.toBeVisible/,
    'Reference must still be genuinely visible');
  assert.match(helper,/expect\(refField\)\.toHaveAttribute\('readonly',''\)/,
    'A generated reference must remain readonly');
  assert.match(helper,/expect\(refField\)\.toHaveAttribute\('aria-readonly','true'\)/,
    'A generated reference must remain semantically readonly');
  assert.match(helper,/expect\(shipmentRef\)\.toMatch\(\/\^\[A-Z0-9\]\{6\}\$\/\)/,
    'Reference must retain its actual six-character validation');
  assert.match(helper,/persisted\.signature\)\.toBe\('%PDF-'\)/,
    'The true PDF readback gate must not be weakened');
});

test('RC1499: geänderte E2E-Dateien bleiben syntaktisch gültig',()=>{
  for(const path of [fixturePath,packSpecPath,publicSmokePath,helperPath])execFileSync(process.execPath,['--check',path],{stdio:'pipe'});
});