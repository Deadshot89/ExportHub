import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const authStore = require('../api/shared/auth-store.js');

const ENV_KEYS = [
  'EXPORTHUB_AUTH_SIGNING_SECRET',
  'EXPORTHUB_SESSION_SECRET',
  'EXPORTHUB_STORAGE_CONNECTION_STRING',
  'AzureWebJobsStorage'
];

function snapshotEnv() {
  return Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot) {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
}

function sampleSession() {
  return {
    id: 'SES-RC1186',
    userId: 'USR-RC1186',
    username: 'rc1186.user',
    deviceId: 'rc1186-device',
    createdAt: new Date(Date.now() - 1000).toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    authVersion: 1,
    mustChange: false
  };
}

test('RC1186: bestehende Storage-Fallback-Session bleibt nach Aktivierung des dedizierten Signing-Secrets gültig', () => {
  const env = snapshotEnv();
  try {
    delete process.env.EXPORTHUB_AUTH_SIGNING_SECRET;
    delete process.env.EXPORTHUB_SESSION_SECRET;
    delete process.env.AzureWebJobsStorage;
    process.env.EXPORTHUB_STORAGE_CONNECTION_STRING = 'rc1186-legacy-storage-secret';

    const legacyToken = authStore.createSignedSessionToken(sampleSession());
    assert.ok(authStore.verifySignedSessionToken(legacyToken));

    process.env.EXPORTHUB_AUTH_SIGNING_SECRET = 'rc1186-dedicated-signing-secret';
    const verified = authStore.verifySignedSessionToken(legacyToken);

    assert.equal(verified?.sid, 'SES-RC1186');
    assert.equal(verified?.uid, 'USR-RC1186');
  } finally {
    restoreEnv(env);
  }
});

test('RC1186: neue Sessions werden bei vorhandener Konfiguration mit dem dedizierten Signing-Secret signiert', () => {
  const env = snapshotEnv();
  try {
    delete process.env.EXPORTHUB_SESSION_SECRET;
    delete process.env.AzureWebJobsStorage;
    process.env.EXPORTHUB_STORAGE_CONNECTION_STRING = 'rc1186-legacy-storage-secret';
    process.env.EXPORTHUB_AUTH_SIGNING_SECRET = 'rc1186-dedicated-signing-secret';

    const token = authStore.createSignedSessionToken(sampleSession());
    assert.ok(authStore.verifySignedSessionToken(token));

    delete process.env.EXPORTHUB_AUTH_SIGNING_SECRET;
    assert.equal(authStore.verifySignedSessionToken(token), null);
  } finally {
    restoreEnv(env);
  }
});
