'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const { Readable } = require('node:stream');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '../..');

function err(code, message, status = 400) {
  const e = new Error(message || code);
  e.code = code;
  e.status = status;
  e.statusCode = status;
  return e;
}

function json(status, body, headers = {}) {
  return {
    status,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers),
    body: JSON.stringify(body),
  };
}

function bodyOf(res) {
  if (!res) return {};
  if (Buffer.isBuffer(res.body)) return res.body;
  if (typeof res.body === 'string') return JSON.parse(res.body || '{}');
  return res.body || {};
}

function context() {
  return { res: null, log: { error() {}, warn() {}, info() {} } };
}

function loadWithMocks(relativeFile, mocks) {
  const absolute = path.resolve(ROOT, relativeFile);
  const originalLoad = Module._load;
  Module._load = function(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) return mocks[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  delete require.cache[require.resolve(absolute)];
  try {
    return require(absolute);
  } finally {
    Module._load = originalLoad;
  }
}

function makeAzureMemory() {
  const blobs = new Map();
  let serial = 1;

  function notFound() {
    const e = new Error('Blob not found');
    e.statusCode = 404;
    e.code = 'BlobNotFound';
    return e;
  }

  function conflict() {
    const e = new Error('Condition not met');
    e.statusCode = 412;
    e.code = 'ConditionNotMet';
    return e;
  }

  function getBlockBlobClient(name) {
    return {
      name,
      async download() {
        const item = blobs.get(name);
        if (!item) throw notFound();
        return {
          readableStreamBody: Readable.from([item.data]),
          etag: item.etag,
          contentType: item.contentType || 'application/json; charset=utf-8',
        };
      },
      async upload(raw, _length, options = {}) {
        const current = blobs.get(name);
        const conditions = options.conditions || {};
        if (conditions.ifMatch && (!current || current.etag !== conditions.ifMatch)) throw conflict();
        if (conditions.ifNoneMatch === '*' && current) throw conflict();
        const data = Buffer.isBuffer(raw) ? Buffer.from(raw) : Buffer.from(String(raw));
        const etag = `\"e${serial++}\"`;
        blobs.set(name, {
          data,
          etag,
          contentType: options.blobHTTPHeaders && options.blobHTTPHeaders.blobContentType,
        });
        return { etag };
      },
    };
  }

  const container = {
    async createIfNotExists() {},
    getBlockBlobClient,
    getBlobClient: getBlockBlobClient,
  };

  const BlobServiceClient = {
    fromConnectionString() {
      return { getContainerClient() { return container; } };
    },
  };

  return {
    BlobServiceClient,
    blobs,
    seed(name, value, contentType = 'application/json; charset=utf-8') {
      const data = Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));
      blobs.set(name, { data, etag: `\"e${serial++}\"`, contentType });
    },
    readJson(name) {
      const item = blobs.get(name);
      if (!item) return null;
      return JSON.parse(item.data.toString('utf8'));
    },
  };
}

function makePickupFixture() {
  let used = false;
  let lockedUntil = null;
  let failures = 0;
  let record = {
    schemaVersion: 2,
    registrationVersion: 'RC995',
    environment: 'testservice',
    reference: 'ABC123',
    shipmentId: 'S1',
    expectedColliCount: 3,
    colliCount: 3,
    carrierName: 'Test Spedition GmbH',
    address: 'Musterstraße 1, 41334 Nettetal',
    rows: [{ type: 'Euro Palette', count: 3, weight: 300 }],
    status: 'open',
    confirmedAt: null,
    podFiles: [],
  };

  const access = {
    error: err,
    async resolve(_req, kind, token, options = {}) {
      assert.equal(kind, 'pickup');
      assert.equal(token, 'a'.repeat(48));
      if (lockedUntil && Date.now() < Date.parse(lockedUntil)) throw err('ACCESS_LOCKED', 'gesperrt', 429);
      if (used && !options.allowUsed) throw err('ACCESS_USED', 'bereits verwendet', 410);
      return { environment: 'testservice', tokenHash: 'pickup-hash', record: { usedAt: used ? new Date().toISOString() : null } };
    },
    async registerFailure() {
      failures += 1;
      if (failures >= 5) lockedUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      return { failedAttempts: failures, lockedUntil };
    },
    async consume() {
      if (used) throw err('ACCESS_USED', 'bereits verwendet', 410);
      used = true;
      return { usedAt: new Date().toISOString() };
    },
  };

  const pins = {
    text(v) { return String(v == null ? '' : v).trim(); },
    validPin(v) { return /^\d{4}$/.test(String(v || '')); },
    error: err,
    async findByPin(pin) {
      return pin === '2468' ? { id: 'loader-1', name: 'Test Verlader', active: true } : null;
    },
  };

  const store = {
    json,
    body(req) { return req && req.body && typeof req.body === 'object' ? req.body : {}; },
    err,
    now() { return new Date().toISOString(); },
    clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); },
    sanitizeText(v, max = 500) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max); },
    first(src, keys) {
      for (const key of keys) {
        const value = src && src[key];
        if (value !== undefined && value !== null && value !== '') return value;
      }
      return '';
    },
    expectedCollis(r) { return Math.max(0, Math.round(Number(r && (r.expectedColliCount || r.colliCount || 0)) || 0)); },
    expired() { return false; },
    hash(v) { return crypto.createHash('sha256').update(String(v || '')).digest('hex'); },
    realPodFiles(r) { return Array.isArray(r && r.podFiles) ? r.podFiles : []; },
    async saveDriverSignature() {
      return {
        signatureBlobName: 'signatures/S1.jpg',
        signatureType: 'image/jpeg',
        signatureSize: 4,
        signatureStoredAt: new Date().toISOString(),
      };
    },
    async getRecord() {
      return {
        record,
        clients: {
          pods: {
            getBlobClient() { return { name: 'signatures/S1.jpg' }; },
          },
        },
      };
    },
    async mutateRecord(_hash, _environment, fn) {
      record = await fn(record, {});
      return record;
    },
    async updateTeam() {},
    publicRecord(r, token) {
      return {
        token,
        reference: r.reference,
        shipmentId: r.shipmentId,
        address: r.address,
        expectedColliCount: r.expectedColliCount,
        colliCount: r.colliCount,
        confirmedAt: r.confirmedAt,
        status: r.status,
      };
    },
    async readBuffer() {
      return { buffer: Buffer.from([1, 2, 3, 4]), contentType: 'image/jpeg' };
    },
  };

  return {
    access,
    pins,
    store,
    token: 'a'.repeat(48),
    get record() { return record; },
    get used() { return used; },
    get failures() { return failures; },
    unlock() { lockedUntil = null; failures = 0; },
  };
}

test('RC995 public-access store: Token bleibt serverseitig, ist einmalig und sperrt Fehlversuche', async () => {
  const azure = makeAzureMemory();
  const oldEnv = {
    storage: process.env.EXPORTHUB_STORAGE_CONNECTION_STRING,
    secret: process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET,
  };
  process.env.EXPORTHUB_STORAGE_CONNECTION_STRING = 'UseDevelopmentStorage=true';
  process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET = 'rc995-test-secret-not-production';

  const access = loadWithMocks('api/shared/public-access-store.js', {
    '@azure/storage-blob': { BlobServiceClient: azure.BlobServiceClient },
  });

  try {
    const req = { headers: { 'x-exporthub-environment': 'testservice', host: 'example-testservice.azurestaticapps.net' } };
    const issued = await access.issue(req, 'pickup', { subjectId: 'S1', shipmentId: 'S1', reference: 'ABC123', snapshot: { address: 'Empfängerweg 7' } }, 3600000, { environment: 'testservice' });
    assert.match(issued.token, /^[a-f0-9]{48}$/);
    assert.equal(issued.record.token, undefined);
    assert.ok(issued.tokenHash);

    const rawStored = [...azure.blobs.values()].map(x => x.data.toString('utf8')).join('\n');
    assert.equal(rawStored.includes(issued.token), false, 'Roh-Token darf nicht im Blob-Speicher stehen');

    const resolved = await access.resolve(req, 'pickup', issued.token, { allowUsed: false }, { environment: 'testservice' });
    assert.equal(resolved.record.reference, 'ABC123');

    await access.consume('testservice', 'pickup', issued.tokenHash, { reason: 'pickup-confirmed' });
    await assert.rejects(
      () => access.resolve(req, 'pickup', issued.token, { allowUsed: false }, { environment: 'testservice' }),
      e => e && e.code === 'ACCESS_USED' && e.status === 410,
    );
    const usedAllowed = await access.resolve(req, 'pickup', issued.token, { allowUsed: true }, { environment: 'testservice' });
    assert.ok(usedAllowed.record.usedAt);

    const lockCandidate = await access.issue(req, 'avis', { subjectId: 'S2', shipmentId: 'S2', reference: 'DEF456' }, 3600000, { environment: 'testservice' });
    for (let i = 0; i < access.MAX_FAILED_ATTEMPTS; i += 1) {
      await access.registerFailure('testservice', 'avis', lockCandidate.tokenHash, 'reference');
    }
    await assert.rejects(
      () => access.resolve(req, 'avis', lockCandidate.token, { allowUsed: false }, { environment: 'testservice' }),
      e => e && e.code === 'ACCESS_LOCKED' && e.status === 429,
    );
  } finally {
    if (oldEnv.storage === undefined) delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
    else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING = oldEnv.storage;
    if (oldEnv.secret === undefined) delete process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET;
    else process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET = oldEnv.secret;
  }
});

test('RC995 Pickup-Bedienfluss: Status -> PIN -> Abholung -> Zweitnutzung gesperrt -> POD', async () => {
  const f = makePickupFixture();
  const status = loadWithMocks('api/pickup-status/index.js', {
    '../shared/public-access-store': f.access,
    '../shared/pickup-store': f.store,
  });
  const confirm = loadWithMocks('api/pickup-confirm-v2/index.js', {
    '../shared/public-access-store': f.access,
    '../shared/loader-pin-store': f.pins,
    '../shared/pickup-store': f.store,
  });
  const pod = loadWithMocks('api/pickup-pod/index.js', {
    '../shared/public-access-store': f.access,
    '../shared/pickup-store': f.store,
  });

  let ctx = context();
  await status(ctx, { method: 'GET', query: { token: f.token, environment: 'testservice' } });
  assert.equal(ctx.res.status, 200);
  assert.equal(bodyOf(ctx.res).expectedColliCount, 3);
  assert.equal(bodyOf(ctx.res).address, 'Musterstraße 1, 41334 Nettetal');

  ctx = context();
  await pod(ctx, { method: 'GET', query: { token: f.token, environment: 'testservice', signature: '1' } });
  assert.equal(ctx.res.status, 409);
  assert.equal(bodyOf(ctx.res).code, 'PICKUP_NOT_CONFIRMED');

  ctx = context();
  await confirm(ctx, {
    method: 'POST',
    body: {
      token: f.token,
      environment: 'testservice',
      reference: 'ABC123',
      pin: '1111',
      carrierName: 'Test Spedition GmbH',
      licensePlate: 'VIE-RC995',
      enteredColliCount: 3,
      driverSignature: 'data:image/jpeg;base64,AQIDBA==',
    },
  });
  assert.equal(ctx.res.status, 401);
  assert.equal(bodyOf(ctx.res).code, 'INVALID_PIN');
  assert.equal(f.failures, 1);

  ctx = context();
  await confirm(ctx, {
    method: 'POST',
    body: {
      token: f.token,
      environment: 'testservice',
      reference: 'ABC123',
      pin: '2468',
      carrierName: 'Test Spedition GmbH',
      licensePlate: 'VIE-RC995',
      enteredColliCount: 2,
      driverSignature: 'data:image/jpeg;base64,AQIDBA==',
    },
  });
  assert.equal(ctx.res.status, 409);
  assert.equal(bodyOf(ctx.res).code, 'COLLI_MISMATCH');
  assert.equal(f.used, false);

  ctx = context();
  await confirm(ctx, {
    method: 'POST',
    body: {
      token: f.token,
      environment: 'testservice',
      reference: 'ABC123',
      pin: '2468',
      carrierName: 'Test Spedition GmbH',
      licensePlate: 'VIE-RC995',
      enteredColliCount: 3,
      driverName: 'Max Mustermann',
      driverSignature: 'data:image/jpeg;base64,AQIDBA==',
    },
  });
  assert.equal(ctx.res.status, 200);
  const confirmed = bodyOf(ctx.res);
  assert.equal(confirmed.pickedUp, true);
  assert.equal(confirmed.shipmentStatus, 'Abgeholt');
  assert.equal(confirmed.oneTimeConsumed, true);
  assert.equal(confirmed.loaderName, 'Test Verlader');
  assert.match(confirmed.uploadKey, /^[a-f0-9]{64}$/);
  assert.ok(f.record.confirmedAt);
  assert.equal(f.record.enteredColliCount, 3);
  assert.equal(f.used, true);

  ctx = context();
  await status(ctx, { method: 'GET', query: { token: f.token, environment: 'testservice' } });
  assert.equal(ctx.res.status, 410);
  assert.equal(bodyOf(ctx.res).code, 'ACCESS_USED');

  ctx = context();
  await confirm(ctx, {
    method: 'POST',
    body: {
      token: f.token,
      environment: 'testservice',
      reference: 'ABC123',
      pin: '2468',
      carrierName: 'Test Spedition GmbH',
      licensePlate: 'VIE-RC995',
      enteredColliCount: 3,
      driverSignature: 'data:image/jpeg;base64,AQIDBA==',
    },
  });
  assert.equal(ctx.res.status, 410);
  assert.equal(bodyOf(ctx.res).code, 'ACCESS_USED');

  ctx = context();
  await pod(ctx, { method: 'GET', query: { token: f.token, environment: 'testservice', signature: '1' } });
  assert.equal(ctx.res.status, 200);
  assert.equal(ctx.res.headers['Content-Type'], 'image/jpeg');
  assert.ok(Buffer.isBuffer(ctx.res.body));
});

test('RC995 Pickup-PIN: fünf Fehlversuche sperren den Einmal-Link vorübergehend', async () => {
  const f = makePickupFixture();
  const confirm = loadWithMocks('api/pickup-confirm-v2/index.js', {
    '../shared/public-access-store': f.access,
    '../shared/loader-pin-store': f.pins,
    '../shared/pickup-store': f.store,
  });

  for (let i = 1; i <= 5; i += 1) {
    const ctx = context();
    await confirm(ctx, {
      method: 'POST',
      body: {
        token: f.token,
        environment: 'testservice',
        reference: 'ABC123',
        pin: '1111',
        carrierName: 'Test Spedition GmbH',
        licensePlate: 'VIE-RC995',
        enteredColliCount: 3,
        driverSignature: 'data:image/jpeg;base64,AQIDBA==',
      },
    });
    if (i < 5) assert.equal(ctx.res.status, 401);
    else {
      assert.equal(ctx.res.status, 429);
      assert.equal(bodyOf(ctx.res).code, 'ACCESS_LOCKED');
    }
  }

  const ctx = context();
  await confirm(ctx, {
    method: 'POST',
    body: {
      token: f.token,
      environment: 'testservice',
      reference: 'ABC123',
      pin: '2468',
      carrierName: 'Test Spedition GmbH',
      licensePlate: 'VIE-RC995',
      enteredColliCount: 3,
      driverSignature: 'data:image/jpeg;base64,AQIDBA==',
    },
  });
  assert.equal(ctx.res.status, 429);
  assert.equal(bodyOf(ctx.res).code, 'ACCESS_LOCKED');
});

test('RC995 Kunden-Avis: Einmal-Link -> Session -> Bestätigung nur dort -> nach Abholung geschlossen', async () => {
  const azure = makeAzureMemory();
  const teamBlob = 'testservice/team-state.json';
  azure.seed(teamBlob, {
    schemaVersion: 3,
    revision: 1,
    state: {
      shipments: [{
        id: 'S1',
        reference: 'ABC123',
        customerName: 'Musterkunde GmbH',
        customerNumber: '10001',
        recipientName: 'Musterkunde Lager',
        recipientAddress: 'Empfängerweg 7, 40210 Düsseldorf',
        status: 'Erstellt',
        rows: [{ type: 'Euro Palette', count: 2, weight: 200, ldm: 0.4 }],
        deliveryFiles: [{ id: 'ls1', name: 'LS_ABC123.pdf', mimeType: 'application/pdf', data: 'data:application/pdf;base64,JVBERi0xLjQK' }],
        podFiles: [{ id: 'pod1', name: 'POD_ABC123.pdf', mimeType: 'application/pdf', data: 'data:application/pdf;base64,JVBERi0xLjQK' }],
        customerAvisEnabled: false,
        avisEnabled: false,
      }],
    },
  });

  let avisUsed = false;
  const token = 'b'.repeat(48);
  const record = { kind: 'avis', environment: 'testservice', tokenHash: 'avis-hash', subjectId: 'S1', shipmentId: 'S1', reference: 'ABC123' };
  const access = {
    json,
    body(req) { return req && req.body && typeof req.body === 'object' ? req.body : {}; },
    environment() { return 'testservice'; },
    async issue() { avisUsed = false; return { token, expiresAt: '2026-09-11T12:00:00.000Z' }; },
    async resolve(_req, kind, raw) {
      assert.equal(kind, 'avis');
      if (raw !== token) throw err('ACCESS_INVALID', 'ungültig', 410);
      if (avisUsed) throw err('ACCESS_USED', 'bereits verwendet', 410);
      return { environment: 'testservice', tokenHash: 'avis-hash', record };
    },
    async registerFailure() { return { failedAttempts: 1, lockedUntil: null }; },
    async clearFailures() {},
    async consume() { avisUsed = true; return Object.assign({}, record, { usedAt: new Date().toISOString() }); },
    issueSession() { return { session: 'session-rc995', expiresAt: '2026-09-04T13:00:00.000Z' }; },
    async resolveSession(session, kind) {
      if (session !== 'session-rc995' || kind !== 'avis') throw err('SESSION_INVALID', 'session', 401);
      return { environment: 'testservice', tokenHash: 'avis-hash', record };
    },
    async revokeSubject() { avisUsed = true; return { ok: true }; },
  };
  const auth = {
    async validateSession() { return { user: { name: 'RC995 Tester', role: 'admin' } }; },
    hasAnyEditRight() { return true; },
    error: err,
  };

  const oldStorage = process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
  process.env.EXPORTHUB_STORAGE_CONNECTION_STRING = 'UseDevelopmentStorage=true';
  const avis = loadWithMocks('api/customer-avis/index.js', {
    '@azure/storage-blob': { BlobServiceClient: azure.BlobServiceClient },
    '../shared/public-access-store': access,
    '../shared/auth-store': auth,
  });

  try {
    let ctx = context();
    await avis(ctx, { method: 'POST', body: { action: 'issue', shipmentId: 'S1', reference: 'ABC123', environment: 'testservice' } });
    assert.equal(ctx.res.status, 200);
    const issued = bodyOf(ctx.res);
    assert.equal(issued.oneTime, true);
    assert.equal(issued.token, token);
    assert.equal(issued.url, '/customer-avis.html?token=' + token);
    let team = azure.readJson(teamBlob);
    assert.equal(team.state.shipments[0].customerAvisEnabled, true);
    assert.equal(team.state.shipments[0].customerAvisSecurityVersion, 995);

    ctx = context();
    await avis(ctx, { method: 'POST', body: { action: 'authorize', token, reference: 'ABC123', environment: 'testservice' } });
    assert.equal(ctx.res.status, 200);
    const authorized = bodyOf(ctx.res);
    assert.equal(authorized.rawLinkConsumed, true);
    assert.equal(authorized.session, 'session-rc995');
    assert.equal(authorized.recipientAddress, 'Empfängerweg 7, 40210 Düsseldorf');

    ctx = context();
    await avis(ctx, { method: 'POST', body: { action: 'authorize', token, reference: 'ABC123', environment: 'testservice' } });
    assert.equal(ctx.res.status, 410);
    assert.equal(bodyOf(ctx.res).code, 'ACCESS_USED');

    ctx = context();
    await avis(ctx, {
      method: 'POST',
      body: {
        action: 'appointment',
        session: 'session-rc995',
        pickupDate: '2026-09-07',
        timeFrom: '10:00',
        timeTo: '12:00',
        plate: 'D-RC995',
        shipmentNumber: 'SP-995-001',
        note: 'Tor 2',
      },
    });
    assert.equal(ctx.res.status, 200);
    team = azure.readJson(teamBlob);
    assert.equal(team.state.shipments[0].customerConfirmed, true);
    assert.equal(team.state.shipments[0].customerConfirmedVia, 'customer-avis');
    assert.equal(team.state.shipments[0].plannedPickupDate, '2026-09-07');
    assert.equal(team.state.shipments[0].customerAvisShipmentNumber, 'SP-995-001');

    team.state.shipments[0].actualPickupAt = '2026-09-07T10:32:15.000Z';
    team.state.shipments[0].status = 'Abgeholt';
    azure.seed(teamBlob, team);

    ctx = context();
    await avis(ctx, { method: 'GET', query: { session: 'session-rc995' }, body: {} });
    assert.equal(ctx.res.status, 200);
    const closed = bodyOf(ctx.res);
    assert.equal(closed.closed, true);
    assert.equal(closed.status, 'Abgeholt');
    assert.deepEqual(closed.documents, []);
    assert.equal(closed.pod.documents.length, 1);
    assert.equal(closed.pod.documents[0].id, 'pod1');

    ctx = context();
    await avis(ctx, {
      method: 'POST',
      body: {
        action: 'appointment',
        session: 'session-rc995',
        pickupDate: '2026-09-08',
        shipmentNumber: 'SP-995-002',
      },
    });
    assert.equal(ctx.res.status, 410);
    assert.equal(bodyOf(ctx.res).code, 'AVIS_CLOSED');

    ctx = context();
    await avis(ctx, { method: 'GET', query: { action: 'document', id: 'ls1', session: 'session-rc995' }, body: {} });
    assert.equal(ctx.res.status, 410);
    assert.equal(bodyOf(ctx.res).code, 'AVIS_CLOSED');
  } finally {
    if (oldStorage === undefined) delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
    else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING = oldStorage;
  }
});

test('RC995 Druckvertrag: QR nur als erster Druck-QR und PDF ohne QR', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(path.resolve(ROOT, 'TESTVERSION.html'), 'utf8');
  assert.match(html, /version:'RC995'/);
  assert.match(html, /data-rc995-print-qr=\\?['\"]?pickup/);
  assert.match(html, /data-rc995-print-first/);
  assert.match(html, /RC995_PDF_NO_QR\s*=\s*true/);
  assert.match(html, /html:not\(\[data-rc995-pdf=\"1\"\]\)/);
  assert.match(html, /list\[0\]\.setAttribute\('data-rc995-print-first','1'\)/);
  assert.doesNotMatch(html, /data-rc995-customer-confirm-main/);
});
