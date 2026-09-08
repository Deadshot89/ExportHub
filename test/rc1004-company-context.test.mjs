import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const ctx = require('../api/shared/company-context.js');
const policy = require('../api/shared/user-policy.js');

test('Firmenkontext nutzt die am Benutzer gebundene Firma', () => {
  const out = ctx.resolveCompanyContext({ headers: {} }, { companyId: 'ESSENTRA', role: 'Benutzer' });
  assert.equal(out.companyKey, 'essentra');
});

test('Benutzer darf keine andere Firma per Header auswählen', () => {
  assert.throws(
    () => ctx.resolveCompanyContext({ headers: { 'x-exporthub-company-id': 'KONTUR' } }, { companyId: 'ESSENTRA', role: 'Benutzer' }),
    e => e && e.code === 'COMPANY_FORBIDDEN' && e.statusCode === 403
  );
});

test('Legacy-Benutzer ohne Firmenfeld bleiben im isolierten Legacy-Kontext', () => {
  const out = ctx.resolveCompanyContext({ headers: {} }, { id: 'USER-1', role: 'Benutzer' });
  assert.equal(out.companyKey, 'legacy-default');
});

test('Legacy-Benutzer ohne Firmenfeld kann keine Firma per Header erfinden', () => {
  assert.throws(
    () => ctx.resolveCompanyContext({ headers: { 'x-exporthub-company-id': 'ESSENTRA' } }, { id: 'USER-1', role: 'Benutzer' }),
    e => e && e.code === 'COMPANY_FORBIDDEN' && e.statusCode === 403
  );
});

test('pickupcalendar ist für Mitarbeiter lesbar und für Admins administrierbar', () => {
  const employee = policy.normalizeUser({ user: 'Mitarbeiter', role: 'Benutzer' }, 0);
  const admin = policy.normalizeUser({ user: 'Admin', role: 'admin' }, 0);
  assert.equal(employee.rights.pickupcalendar.level, 'view');
  assert.equal(employee.rights.pickupcalendar.edit, false);
  assert.equal(admin.rights.pickupcalendar.level, 'admin');
  assert.equal(admin.rights.pickupcalendar.edit, true);
});
