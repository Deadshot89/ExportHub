import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeUser, defaultRights, normalizeRights } = require('../api/shared/user-policy.js');

test('normal users have no customer portal rights by default', () => {
  const user = normalizeUser({ user: 'Normal User', rights: {} }, 0);
  assert.equal(user.rights.customerPortal.use, false);
  assert.equal(user.rights.customerPortal.manage, false);
});

test('customer portal use can be granted without manage', () => {
  const rights = normalizeRights({ customerPortal: { use: true } }, false);
  assert.equal(rights.customerPortal.use, true);
  assert.equal(rights.customerPortal.manage, false);
});

test('customer portal manage always implies use', () => {
  const rights = normalizeRights({ customerPortal: { manage: true } }, false);
  assert.equal(rights.customerPortal.manage, true);
  assert.equal(rights.customerPortal.use, true);
});

test('global admins receive both customer portal rights', () => {
  const defaults = defaultRights(true);
  assert.equal(defaults.customerPortal.use, true);
  assert.equal(defaults.customerPortal.manage, true);

  const user = normalizeUser({ user: 'Admin', globalAdmin: true }, 0);
  assert.equal(user.rights.customerPortal.use, true);
  assert.equal(user.rights.customerPortal.manage, true);
});
