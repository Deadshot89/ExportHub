'use strict';

const {
  mergeState,
  sanitizeState,
  pruneTombstones,
  clone
} = require('../shared/merge');
const auth = require('../shared/auth-store');

const MAX_RETRIES = 6;

function normalizeIncoming(body) {
  let payload = body && typeof body === 'object' ? body : {};
  if (typeof body === 'string') {
    try { payload = JSON.parse(body); } catch (_) { payload = {}; }
  }
  const state = sanitizeState(payload.state || {});
  delete state.users;
  return {
    clientVersion: String(payload.clientVersion || ''),
    baseRevision: Number(payload.baseRevision || 0),
    deviceId: String(payload.deviceId || ''),
    reason: String(payload.reason || 'save'),
    state
  };
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
    const stored = await auth.readJson(blob, auth.emptyTeam());
    const value = auth.applyUserPolicy(stored.value || auth.emptyTeam());
    return { schemaVersion: Number(value.schemaVersion || 3), revision: Number(value.revision || 0), updatedAt: value.updatedAt || null, clientVersion: value.clientVersion || null };
  } catch (error) {
    if (error && error.statusCode === 404) return { schemaVersion: 3, revision: 0, updatedAt: null, clientVersion: null };
    throw error;
  }
}

async function uploadTeam(blob, value, etag) {
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

async function saveMerged(blob, incoming, sessionUser) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const currentDownload = await auth.readJson(blob, auth.emptyTeam());
    const current = auth.applyUserPolicy(currentDownload.value || auth.emptyTeam());
    const mergedState = pruneTombstones(mergeState(current.state || {}, incoming.state || {}));
    delete mergedState.users;
    mergedState.users = auth.publicUsers(current.users || [], false);
    const next = {
      schemaVersion: 3,
      revision: Number(current.revision || 0) + 1,
      updatedAt: auth.now(),
      updatedBy: auth.text(sessionUser.name || sessionUser.user),
      updatedByUserId: auth.text(sessionUser.id),
      updatedByDevice: incoming.deviceId || null,
      clientVersion: incoming.clientVersion || null,
      state: mergedState,
      users: current.users || [],
      authBootstrap: current.authBootstrap && typeof current.authBootstrap === 'object'
        ? auth.clone(current.authBootstrap)
        : undefined
    };
    try {
      await uploadTeam(blob, next, currentDownload.etag);
      next.concurrentMerge = Number(incoming.baseRevision || 0) !== Number(current.revision || 0);
      next.baseRevision = Number(incoming.baseRevision || 0);
      return next;
    } catch (error) {
      if (error && error.statusCode === 412 && attempt < MAX_RETRIES - 1) continue;
      throw error;
    }
  }
  throw auth.error('CONCURRENT_UPDATE', 'Der Teamstand konnte nach mehreren Konfliktversuchen nicht gespeichert werden.', 409);
}

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: { 'Cache-Control': 'no-store' }, body: '' };
    return;
  }

  try {
    const payload = auth.body(req);
    // Azure Static Web Apps may remove custom authentication headers on proxied
    // function calls. The same-origin state endpoint therefore accepts the opaque
    // ExportHUB session token in the JSON body as a secure fallback as well.
    if (payload.sessionToken && !auth.bearer(req)) {
      req.headers = Object.assign({}, req.headers || {}, { 'x-exporthub-token': auth.text(payload.sessionToken) });
    }
    const currentSession = await auth.validateSession(req);
    const c = await auth.clients();
    const blob = c.team;
    const queryMode = req.query ? String(req.query.mode || '').toLowerCase() : '';
    const bodyMode = String(payload.action || payload.mode || '').toLowerCase();
    const mode = queryMode || bodyMode;

    if (req.method === 'GET' || (req.method === 'POST' && (mode === 'read' || mode === 'meta'))) {
      const metaRequested = mode === 'meta' || (req.query && String(req.query.meta || '') === '1');
      if (metaRequested) {
        const meta = await metadataOnly(blob);
        context.res = auth.json(200, Object.assign({ ok: true, metaOnly: true }, meta));
        return;
      }
      const stored = await auth.readJson(blob, auth.emptyTeam());
      const document = auth.applyUserPolicy(stored.value || auth.emptyTeam());
      const clientDocument = auth.sanitizeDocumentForClient(document, auth.isAdmin(currentSession.user));
      context.res = auth.json(200, Object.assign({ ok: true }, clientDocument));
      return;
    }

    if (req.method === 'POST') {
      if (mode && mode !== 'save') throw auth.error('UNKNOWN_STATE_ACTION', 'Unbekannte Teamdatenaktion.', 400);
      if (!auth.hasAnyEditRight(currentSession.user)) throw auth.error('WRITE_FORBIDDEN', 'Für Änderungen fehlen Bearbeitungsrechte.', 403);
      const incoming = normalizeIncoming(payload);
      const saved = await saveMerged(blob, incoming, currentSession.user);
      const clientSaved = auth.sanitizeDocumentForClient(saved, auth.isAdmin(currentSession.user));
      const ackOnly = req.query && (String(req.query.ack || '') === '1' || String(req.query.mode || '').toLowerCase() === 'ack' || String(req.query.mode || '').toLowerCase() === 'save');
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
          body.state = clientSaved.state;
          body.users = clientSaved.users;
        }
        context.res = auth.json(200, body);
        return;
      }
      context.res = auth.json(200, Object.assign({ ok: true }, clientSaved));
      return;
    }

    context.res = auth.json(405, { ok: false, code: 'METHOD_NOT_ALLOWED' }, { Allow: 'GET, POST, OPTIONS' });
  } catch (error) {
    context.log.error('ExportHUB state API error', error && error.code, error && error.message);
    context.res = auth.json(error && error.status ? error.status : 500, {
      ok: false,
      code: error && error.code ? error.code : 'SERVER_ERROR',
      message: error && error.message ? error.message : 'Unbekannter Speicherfehler.'
    });
  }
};
