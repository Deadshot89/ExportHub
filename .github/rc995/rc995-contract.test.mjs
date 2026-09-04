import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const exists = (p) => fs.existsSync(p);

const production = read('production-version.js');
const pickupInit = read('api/pickup-init/index.js');
const pickupStatus = read('api/pickup-status/index.js');
const pickupConfirm = read('api/pickup-confirm-v2/index.js');
const customerAvis = read('api/customer-avis/index.js');
const merge = read('api/shared/merge.js');
const testversion = read('TESTVERSION.html');

// RC995 selbst darf Produktion niemals freigeben. Spätere, separat geprüfte
// Release-Center-Versionen dürfen den Produktionsmarker regulär weiterheben.
test('production marker is never released as RC995 itself', () => {
  const m = production.match(/PRODUCTION_VERSION_PROBE__\s*=\s*['"]RC(\d+)['"]/);
  assert.ok(m, 'Produktionsmarker fehlt');
  const version = Number(m[1]);
  assert.ok(version >= 990, `Produktionsmarker RC${version} ist älter als RC990`);
  assert.notEqual(version, 995, 'RC995 darf Produktion nicht selbst freigeben');
});

test('shared public-access store exists and stores only derived token identities', () => {
  assert.equal(exists('api/shared/public-access-store.js'), true, 'RC995 public-access store is missing');
  const access = read('api/shared/public-access-store.js');
  assert.match(access, /crypto\.randomBytes/);
  assert.match(access, /tokenHash|hashToken/);
  assert.match(access, /testservice/);
  assert.match(access, /consume|usedAt/);
  assert.match(access, /failedAttempts|lockedUntil/);
  assert.doesNotMatch(access, /record\.token\s*=\s*token/);
});

test('pickup APIs resolve access through RC995 public-access store', () => {
  assert.match(pickupInit, /public-access-store/);
  assert.match(pickupInit, /issue/);
  assert.match(pickupStatus, /public-access-store/);
  assert.match(pickupConfirm, /public-access-store/);
  assert.match(pickupConfirm, /consume|usedAt/);
  assert.match(pickupConfirm, /findByPin/);
});

test('customer avis no longer resolves raw token from team-state shipment fields', () => {
  assert.match(customerAvis, /public-access-store/);
  assert.doesNotMatch(customerAvis, /function avisToken\s*\(/);
  assert.doesNotMatch(customerAvis, /customerAvisToken\|\|sh\.avisToken/);
  assert.match(customerAvis, /authorize/);
  assert.match(customerAvis, /session/);
});

test('team-state sanitizer strips legacy public link secrets', () => {
  assert.match(merge, /customerAvisToken/);
  assert.match(merge, /pickupToken|qrToken/);
  assert.match(merge, /delete/);
});

test('TESTSERVICE build is RC995 and contains print-only QR / PDF exclusion contract', () => {
  assert.match(testversion, /version:'RC995'/);
  assert.match(testversion, /exporthub-rc995-public-access/);
  assert.match(testversion, /exporthub-rc995-print-qr/);
  assert.match(testversion, /data-rc995-print-qr/);
  assert.match(testversion, /rc995PdfMode|RC995_PDF_NO_QR/);
});

test('customer confirmation is explicitly isolated to customer avis', () => {
  assert.match(testversion, /RC995_CUSTOMER_CONFIRMATION_AVIS_ONLY/);
  assert.doesNotMatch(testversion, /data-rc995-customer-confirm-main/);
});
