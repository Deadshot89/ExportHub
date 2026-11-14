import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const FAST='api/shared/fast-auth-store.js';
const HELPER='e2e/helpers/exporthub-browser.mjs';

test('RC1146: signierte TESTSERVICE-E2E-Sitzungen nutzen denselben sicheren ETag-Fast-Path',()=>{
  const source=fs.readFileSync(FAST,'utf8');
  assert.ok(source.includes('verifySignedSessionToken(token)'),'Fast-Auth muss den signierten Sitzungskontext prüfen');
  assert.ok(source.includes('E2E-USER-'),'Fast-Auth darf den Sonderpfad nur für den E2E-Benutzer verwenden');
  assert.ok(source.includes('e2e\\\\.'),'Fast-Auth muss den E2E-Benutzernamen eingrenzen');
  assert.ok(source.includes('const signedTestserviceE2E=isSignedTestserviceE2E(token)'));
  assert.ok(source.includes('const testserviceRequest=signedTestserviceE2E ||'),'Signierte E2E-Token müssen als TESTSERVICE-Request behandelt werden');
  assert.ok(source.includes('const c=(isolated||signedTestserviceE2E)?await testserviceClients():await clients()'),'Signierte E2E-Token müssen den stabilen TESTSERVICE-Blob-Client verwenden');
  assert.ok(source.includes('readSessionDocuments(c,testserviceRequest)'),'Signierte E2E-Token müssen die ETag-verifizierte Team-Lesephase nutzen');
  assert.ok(source.includes("if(signedTestserviceE2E&&typeof auth.testserviceClients!=='function')return auth.validateSession"),'Nur bei fehlender Fast-Path-Unterstützung darf Core-Auth übernehmen');
});
test('RC1146: Live-E2E installiert zusätzlich den echten HttpOnly API-Session-Cookie',()=>{
  const source=fs.readFileSync(HELPER,'utf8');
  assert.match(source,/addCookies\s*\(/,'Playwright muss den API-Session-Cookie setzen');
  assert.match(source,/name\s*:\s*['"]eh_session['"]/,'echter ExportHUB Session-Cookie fehlt');
  assert.match(source,/httpOnly\s*:\s*true/,'E2E-Cookie muss wie Produktion HttpOnly sein');
  assert.match(source,/sameSite\s*:\s*['"]Strict['"]/,'E2E-Cookie muss SameSite=Strict verwenden');
  assert.match(source,/EXPORTHUB_E2E_LIVE/,'Cookie darf nur im echten Live-E2E-Pfad installiert werden');
  assert.match(source,/EXPORTHUB_E2E_BASE_URL/,'Cookie-Ziel muss aus der aktiven Live-Basis-URL abgeleitet werden');
});
