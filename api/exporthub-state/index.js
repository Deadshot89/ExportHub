'use strict';

const { BlobServiceClient } = require('@azure/storage-blob');
const {
  mergeState,
  mergeUsers,
  sanitizeState,
  pruneTombstones,
  clone
} = require('../shared/merge');
const { applyUserPolicy, countAdmins } = require('../shared/user-policy');

const CONTAINER_NAME = process.env.EXPORTHUB_STORAGE_CONTAINER || 'exporthub-data';
const BLOB_NAME = process.env.EXPORTHUB_STORAGE_BLOB || 'team-state.json';
const MAX_RETRIES = 6;

function json(status, body, headers = {}) {
  return {
    status,
    headers: Object.assign({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }, headers),
    body: JSON.stringify(body)
  };
}

function decodePrincipal(req) {
  try {
    const header = req.headers && (req.headers['x-ms-client-principal'] || req.headers['X-MS-CLIENT-PRINCIPAL']);
    if (!header) return null;
    return JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
  } catch (_) {
    return null;
  }
}

function displayName(principal) {
  if (!principal) return 'Unbekannt';
  return principal.userDetails || principal.userId || 'Microsoft-Benutzer';
}

function storageConnectionString() {
  return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage || '';
}

async function blobClient() {
  const connectionString = storageConnectionString();
  if (!connectionString) {
    const error = new Error('Azure-Speicher ist nicht konfiguriert. App-Einstellung EXPORTHUB_STORAGE_CONNECTION_STRING fehlt.');
    error.code = 'STORAGE_NOT_CONFIGURED';
    throw error;
  }
  const service = BlobServiceClient.fromConnectionString(connectionString);
  const container = service.getContainerClient(CONTAINER_NAME);
  await container.createIfNotExists();
  return container.getBlockBlobClient(BLOB_NAME);
}

async function downloadJson(blob) {
  try {
    const response = await blob.download(0);
    const chunks = [];
    for await (const chunk of response.readableStreamBody) chunks.push(Buffer.from(chunk));
    const text = Buffer.concat(chunks).toString('utf8');
    return {
      value: text ? JSON.parse(text) : null,
      etag: response.etag || null
    };
  } catch (error) {
    if (error && error.statusCode === 404) return { value: null, etag: null };
    throw error;
  }
}

async function uploadJson(blob, value, etag) {
  const body = JSON.stringify(value);
  const conditions = etag ? { ifMatch: etag } : { ifNoneMatch: '*' };
  return blob.upload(body, Buffer.byteLength(body), {
    blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' },
    metadata: {
      schema: String(value.schemaVersion || 3),
      revision: String(value.revision || 0),
      updatedepoch: String(Date.parse(value.updatedAt || '') || Date.now()),
      clientversion: String(value.clientVersion || '').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 80)
    },
    conditions
  });
}

async function metadataOnly(blob) {
  try {
    const properties = await blob.getProperties();
    const metadata = properties.metadata || {};
    if (metadata.revision !== undefined) {
      return {
        schemaVersion: Number(metadata.schema || 3),
        revision: Number(metadata.revision || 0),
        updatedAt: metadata.updatedepoch ? new Date(Number(metadata.updatedepoch)).toISOString() : (properties.lastModified || null),
        clientVersion: metadata.clientversion || null
      };
    }
    const stored = await downloadJson(blob);
    const value = stored.value || emptyDocument();
    try {
      await blob.setMetadata({
        schema: String(value.schemaVersion || 3),
        revision: String(value.revision || 0),
        updatedepoch: String(Date.parse(value.updatedAt || '') || Date.now()),
        clientversion: String(value.clientVersion || '').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 80)
      });
    } catch (_) {}
    return { schemaVersion: Number(value.schemaVersion || 3), revision: Number(value.revision || 0), updatedAt: value.updatedAt || null, clientVersion: value.clientVersion || null };
  } catch (error) {
    if (error && error.statusCode === 404) return { schemaVersion: 3, revision: 0, updatedAt: null, clientVersion: null };
    throw error;
  }
}


function emptyDocument() {
  return {
    schemaVersion: 3,
    revision: 0,
    updatedAt: null,
    updatedBy: null,
    state: {},
    users: []
  };
}

function normalizeIncoming(body) {
  let payload = body && typeof body === 'object' ? body : {};
  if (typeof body === 'string') {
    try { payload = JSON.parse(body); } catch (_) { payload = {}; }
  }
  return {
    clientVersion: String(payload.clientVersion || ''),
    baseRevision: Number(payload.baseRevision || 0),
    deviceId: String(payload.deviceId || ''),
    reason: String(payload.reason || 'save'),
    state: sanitizeState(payload.state || {}),
    users: Array.isArray(payload.users) ? clone(payload.users) : []
  };
}

async function saveMerged(blob, incoming, actor) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const currentDownload = await downloadJson(blob);
    const current = currentDownload.value || emptyDocument();
    const mergedState = pruneTombstones(mergeState(current.state || {}, incoming.state || {}));
    const mergedUsers = mergeUsers(current.users || [], incoming.users || [], mergedState._teamSyncMeta || {});
    if (countAdmins(current.users || []) > 0 && countAdmins(mergedUsers) === 0) {
      const error = new Error('Der letzte Administrator kann nicht gelöscht oder herabgestuft werden.');
      error.code = 'LAST_ADMIN_PROTECTED';
      error.statusCode = 409;
      throw error;
    }
    mergedState.users = clone(mergedUsers);
    const next = applyUserPolicy({
      schemaVersion: 3,
      revision: Number(current.revision || 0) + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: actor,
      updatedByDevice: incoming.deviceId || null,
      clientVersion: incoming.clientVersion || null,
      state: mergedState,
      users: mergedUsers
    });
    try {
      await uploadJson(blob, next, currentDownload.etag);
      next.concurrentMerge = Number(incoming.baseRevision || 0) !== Number(current.revision || 0);
      next.baseRevision = Number(incoming.baseRevision || 0);
      return next;
    } catch (error) {
      if (error && error.statusCode === 412 && attempt < MAX_RETRIES - 1) continue;
      throw error;
    }
  }
  throw new Error('Der Teamstand konnte nach mehreren Konfliktversuchen nicht gespeichert werden.');
}

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: { 'Cache-Control': 'no-store' }, body: '' };
    return;
  }

  const principal = decodePrincipal(req);
  const allowAnonymous = process.env.EXPORTHUB_ALLOW_ANONYMOUS === 'true' || process.env.AZURE_FUNCTIONS_ENVIRONMENT === 'Development';
  if (!principal && !allowAnonymous) {
    context.res = json(401, { ok: false, code: 'AUTH_REQUIRED', message: 'Microsoft-Anmeldung erforderlich.' });
    return;
  }

  try {
    const blob = await blobClient();
    if (req.method === 'GET') {
      const mode = req.query ? String(req.query.mode || '').toLowerCase() : '';
      const metaRequested = req.query && (String(req.query.meta || '') === '1' || mode === 'meta');
      if (metaRequested) {
        const meta = await metadataOnly(blob);
        context.res = json(200, Object.assign({ ok: true, metaOnly: true }, meta));
        return;
      }
      const stored = await downloadJson(blob);
      const document = applyUserPolicy(stored.value || emptyDocument());
      if (mode === 'login' || mode === 'users') {
        context.res = json(200, {
          ok: true,
          loginOnly: true,
          schemaVersion: Number(document.schemaVersion || 3),
          revision: Number(document.revision || 0),
          updatedAt: document.updatedAt || null,
          users: Array.isArray(document.users) ? document.users : []
        });
        return;
      }
      context.res = json(200, Object.assign({ ok: true }, document));
      return;
    }

    if (req.method === 'POST') {
      const incoming = normalizeIncoming(req.body);
      const saved = await saveMerged(blob, incoming, displayName(principal));
      const ackOnly = req.query && (String(req.query.ack || '') === '1' || String(req.query.mode || '').toLowerCase() === 'ack');
      if (ackOnly) {
        const body = {
          ok: true,
          ackOnly: true,
          schemaVersion: Number(saved.schemaVersion || 3),
          revision: Number(saved.revision || 0),
          updatedAt: saved.updatedAt || null,
          updatedBy: saved.updatedBy || null,
          concurrentMerge: saved.concurrentMerge === true
        };
        if (saved.concurrentMerge === true) {
          body.state = saved.state;
          body.users = saved.users;
        }
        context.res = json(200, body);
        return;
      }
      context.res = json(200, Object.assign({ ok: true }, saved));
      return;
    }

    context.res = json(405, { ok: false, code: 'METHOD_NOT_ALLOWED' }, { Allow: 'GET, POST, OPTIONS' });
  } catch (error) {
    context.log.error('ExportHUB state API error', error);
    const status = error && error.code === 'STORAGE_NOT_CONFIGURED' ? 503 : (error && error.statusCode ? error.statusCode : 500);
    context.res = json(status, {
      ok: false,
      code: error && error.code ? error.code : 'SERVER_ERROR',
      message: error && error.message ? error.message : 'Unbekannter Speicherfehler.'
    });
  }
};
