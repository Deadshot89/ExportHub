import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const FAST='api/shared/fast-auth-store.js';
const HELPER='e2e/helpers/exporthub-browser.mjs';

test('RC1146: Fast-Auth delegiert signierte TESTSERVICE-E2E-Sitzungen an den umgebungsgebundenen Core-Auth-Pfad',()=>{
  const source=fs.readFileSync(FAST,'utf8');
  assert.match(source,/verifySignedSessionToken\(token\)/,'Fast-Auth muss den signierten Sitzungskontext prüfen');
  assert.match(source,/environment[\s\S]{0,180}testservice/i,'Fast-Auth muss TESTSERVICE aus dem signierten Token erkennen');
  assert.match(source,/E2E-USER-/,'Fast-Auth darf den Sonderpfad nur für den E2E-Benutzer verwenden');
  assert.match(source,/e2e\\\./i,'Fast-Auth darf den Sonderpfad nur für den E2E-Benutzernamen verwenden');
  assert.match(source,/testservice[\s\S]{0,500}auth\.validateSession\(req\s*,\s*options\)/i,'Signierte TESTSERVICE-E2E-Sitzungen müssen an Core-Auth delegiert werden');
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
