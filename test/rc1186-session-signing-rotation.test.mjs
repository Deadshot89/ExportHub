import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function rc1186Load(request, parent, isMain) {
  if (request === '@azure/storage-blob') {
    return {
      BlobServiceClient: {
        fromConnectionString() {
          throw new Error('RC1186 test must not access Azure Storage');
        }
      }
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const authStore = require('../api/shared/auth-store.js');
Module._load = originalLoad;

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

function sampleSession(overrides = {}) {
  return {
    id: 'SES-RC1186',
    userId: 'USR-RC1186',
    username: 'rc1186.user',
    displayName: 'RC1186 User',
    deviceId: 'rc1186-device',
    createdAt: new Date(Date.now() - 1000).toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    authVersion: 1,
    mustChange: false,
    ...overrides
  };
}

test('RC1186: gespeicherte Legacy-Session bleibt nach Aktivierung des dedizierten Signing-Secrets gültig', () => {
  const env = snapshotEnv();
  try {
    delete process.env.EXPORTHUB_AUTH_SIGNING_SECRET;
    delete process.env.EXPORTHUB_SESSION_SECRET;
    delete process.env.AzureWebJobsStorage;
    process.env.EXPORTHUB_STORAGE_CONNECTION_STRING = 'rc1186-legacy-storage-secret';

    const session = sampleSession();
    const legacyToken = authStore.createSignedSessionToken(session);
    const tokenHash = crypto.createHash('sha256').update(legacyToken).digest('hex');

    process.env.EXPORTHUB_AUTH_SIGNING_SECRET = 'rc1186-dedicated-signing-secret';

    assert.equal(authStore.verifySignedSessionToken(legacyToken), null);
    const resolved = authStore.resolveSession(legacyToken, {
      sessions: [{ ...session, tokenHash }]
    });

    assert.equal(resolved.source, 'blob');
    assert.equal(resolved.session.id, 'SES-RC1186');
    assert.equal(resolved.session.userId, 'USR-RC1186');
  } finally {
    restoreEnv(env);
  }
});

test('RC1186: alter Storage-Schlüssel legitimiert nach Aktivierung des dedizierten Secrets keinen Signed-Fallback mehr', () => {
  const env = snapshotEnv();
  try {
    delete process.env.EXPORTHUB_AUTH_SIGNING_SECRET;
    delete process.env.EXPORTHUB_SESSION_SECRET;
    delete process.env.AzureWebJobsStorage;
    process.env.EXPORTHUB_STORAGE_CONNECTION_STRING = 'rc1186-legacy-storage-secret';

    const legacyToken = authStore.createSignedSessionToken(sampleSession());

    process.env.EXPORTHUB_AUTH_SIGNING_SECRET = 'rc1186-dedicated-signing-secret';

    assert.equal(authStore.verifySignedSessionToken(legacyToken), null);
    assert.deepEqual(authStore.resolveSession(legacyToken, { sessions: [] }), {
      session: null,
      source: 'none'
    });
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
