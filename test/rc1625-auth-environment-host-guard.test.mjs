import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync('api/shared/auth-store.js', 'utf8');
const start = source.indexOf('function environmentFromRequest(req) {');
const end = source.indexOf('async function clientsForEnvironment(', start);
assert.ok(start >= 0 && end > start, 'Canonical auth environment router missing');
const guard = runInNewContext(source.slice(start, end) + '\nenvironmentFromRequest', {
  lower: v => String(v == null ? '' : v).trim().toLowerCase(),
  error: (code, message, status) => Object.assign(new Error(message), { code, status }),
  URL,
});
const request = (host, environment, forwarded) => ({
  headers: {
    host,
    ...(environment ? { 'x-exporthub-environment': environment } : {}),
    ...(forwarded ? { 'x-forwarded-host': forwarded } : {}),
  },
});
const rejectsMismatch = (req) => assert.throws(
  () => guard(req),
  e => e?.code === 'ENVIRONMENT_MISMATCH' && e?.status === 409,
);

test('RC1625: production custom domains reject TESTSERVICE header before storage is selected', () => {
  for (const host of ['exporthub360.de', 'www.exporthub360.de', 'exporthub360.com', 'www.exporthub360.com', 'www.exporthub360.de:443']) {
    assert.equal(guard(request(host, 'production')), 'production');
    assert.equal(guard(request(host)), 'production');
    rejectsMismatch(request(host, 'testservice'));
  }
});

test('RC1625: production Azure deployment refuses TESTSERVICE header', () => {
  const host = 'wonderful-forest-0f315e310.7.azurestaticapps.net';
  assert.equal(guard(request(host)), 'production');
  rejectsMismatch(request(host, 'testservice'));
});

test('RC1625: real Azure TESTSERVICE deployment refuses PRODUCTION header', () => {
  const host = 'ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net';
  assert.equal(guard(request(host)), 'testservice');
  assert.equal(guard(request(host, 'testservice')), 'testservice');
  rejectsMismatch(request(host, 'production'));
  rejectsMismatch(request(host, 'demo'));
});

test('RC1625: forwarded origin is examined and comma-separated hosts cannot bypass protection', () => {
  const host = '127.0.0.1';
  assert.equal(guard(request(host, 'production', 'www.exporthub360.com, proxy.internal')), 'production');
  rejectsMismatch(request(host, 'testservice', 'www.exporthub360.de, proxy.internal'));
});

test('RC1625: unknown local host keeps test harness routing backward compatible', () => {
  assert.equal(guard(request('localhost:7071', 'testservice')), 'testservice');
  assert.equal(guard(request('localhost:7071', 'production')), 'production');
  assert.equal(guard(request('localhost:7071')), 'production');
});

test('RC1625: arbitrary third-party host with "-testservice" is not an authoritative Azure host', () => {
  assert.equal(guard(request('example-testservice.evil.invalid')), 'production');
});

test('RC1625: protected runtime invokes canonical guard before choosing team Blob', () => {
  assert.match(source, /return mutateTeamForEnvironment\(environmentFromRequest\(req\), mutator\)/);
  assert.match(source, /return lower\(environment\) === 'testservice' \? testserviceClients\(\) : clients\(\)/);
  assert.match(source, /const c = await clientsForEnvironment\(environment\);/);
});
