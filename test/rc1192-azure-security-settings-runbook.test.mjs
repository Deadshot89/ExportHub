import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const FILE='docs/runbooks/azure-security-app-settings.md';
const source=fs.readFileSync(FILE,'utf8');

test('RC1192: Runbook deckt beide verbleibenden Azure-Sicherheitssettings ab',()=>{
  for(const marker of [
    'EXPORTHUB_CUSTOMER_PORTAL_KEY',
    'EXPORTHUB_AUTH_SIGNING_SECRET',
    'ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net',
    'wonderful-forest-0f315e310.7.azurestaticapps.net',
    'CUSTOMER_PORTAL_NOT_CONFIGURED',
    'signingSecretConfigured=true',
    'RC1170 TESTSERVICE Kundenportal-Verschlüsselung prüfen',
    'RC1170 PRODUCTION Kundenportal-Verschlüsselung prüfen',
    'RC1050 Storage Probe'
  ]) assert.ok(source.includes(marker),marker+' fehlt im RC1192-Runbook');
});

test('RC1192: Portalweg und getrennte Umgebungen sind eindeutig dokumentiert',()=>{
  assert.match(source,/Settings.*Environment variables/s);
  assert.match(source,/TESTSERVICE[\s\S]*EXPORTHUB_CUSTOMER_PORTAL_KEY/);
  assert.match(source,/PRODUCTION[\s\S]*EXPORTHUB_CUSTOMER_PORTAL_KEY/);
  assert.match(source,/anderen.*separat erzeugten Wert/i);
  assert.match(source,/Apply[\s\S]*erneut.*Apply/i);
});

test('RC1192: Runbook schützt vor Secret-Wiederverwendung und Repository-Leak',()=>{
  assert.match(source,/niemals denselben Kundenportal-Key/i);
  assert.match(source,/Kundenportal-Key und Auth-Signing-Secret niemals wiederverwenden/i);
  assert.match(source,/Kein echter Secret-Wert darf in GitHub/i);
  assert.match(source,/nicht den Secret-Wert in Logs ausgeben|nie der Wert selbst/i);
  assert.doesNotMatch(source,/EXPORTHUB_CUSTOMER_PORTAL_KEY\s*=\s*[A-Za-z0-9+/_-]{32,}/);
  assert.doesNotMatch(source,/EXPORTHUB_AUTH_SIGNING_SECRET\s*=\s*[A-Za-z0-9+/_-]{32,}/);
});

test('RC1192: Signing-Migration und sicherer Rollback sind dokumentiert',()=>{
  assert.match(source,/RC1186 ist für diese Migration ausgelegt/);
  assert.match(source,/Storage-Key wird danach nicht mehr als Signed-Fallback akzeptiert/);
  assert.match(source,/mit erneuter Anmeldung einzelner Benutzer rechnen/i);
  assert.match(source,/EXPORTHUB_STORAGE_CONNECTION_STRING.*nicht ändern/);
});

test('RC1192: Kundenportal-Key wird nicht als gefahrlos rotierbar beschrieben',()=>{
  assert.match(source,/bereits zum Verschlüsseln produktiver Zugangsdaten verwendeter Kundenportal-Key darf nicht leichtfertig ersetzt oder gelöscht werden/i);
  assert.match(source,/vorhandene verschlüsselte Datensätze sonst nicht mehr entschlüsselt werden können/i);
});

test('RC1192: Runbook und Testdatei bleiben syntaktisch bzw. strukturell lesbar',()=>{
  assert.ok(source.startsWith('# ExportHUB – Azure Security App Settings Runbook'));
  execFileSync(process.execPath,['--check','test/rc1192-azure-security-settings-runbook.test.mjs'],{stdio:'pipe'});
});
