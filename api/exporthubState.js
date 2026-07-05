
const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');

const CONTAINER = process.env.EXPORTHUB_CONTAINER || 'exporthub-teamdata';
const STATE_BLOB = process.env.EXPORTHUB_STATE_BLOB || 'exporthub-state.json';

function json(body, status = 200) {
  return {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate, max-age=0'
    },
    body: JSON.stringify(body)
  };
}

function getConnectionString() {
  const conn = process.env.EXPORTHUB_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage;
  if (!conn) throw new Error('Storage connection string missing. Set EXPORTHUB_STORAGE_CONNECTION_STRING in Azure Static Web App configuration.');
  return conn;
}

async function blobClient() {
  const service = BlobServiceClient.fromConnectionString(getConnectionString());
  const container = service.getContainerClient(CONTAINER);
  await container.createIfNotExists();
  return container.getBlockBlobClient(STATE_BLOB);
}

async function readState() {
  const blob = await blobClient();
  const exists = await blob.exists();
  if (!exists) return null;
  const downloaded = await blob.downloadToBuffer();
  const text = downloaded.toString('utf8');
  if (!text.trim()) return null;
  return JSON.parse(text);
}

function safePrincipal(request) {
  try {
    const raw = request.headers.get('x-ms-client-principal');
    if (!raw) return null;
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  } catch (_) {
    return null;
  }
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Body must be JSON object.');
  if (!payload.state || typeof payload.state !== 'object') throw new Error('Payload.state missing.');
  if (payload.users && !Array.isArray(payload.users)) throw new Error('Payload.users must be array.');
}

app.http('exporthubHealth', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'exporthub/health',
  handler: async (request, context) => {
    const principal = safePrincipal(request);
    return json({ ok: true, app: 'ExportHUB RC177 API', user: principal && principal.userDetails ? principal.userDetails : null, time: new Date().toISOString() });
  }
});

app.http('exporthubState', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'exporthub/state',
  handler: async (request, context) => {
    try {
      const principal = safePrincipal(request);

      if (request.method === 'GET') {
        const current = await readState();
        if (!current) return json({ empty: true, state: null, users: [], revision: 0, savedAt: null });
        return json(current);
      }

      const payload = await request.json();
      validatePayload(payload);
      const current = await readState();
      const revision = Number(current && current.revision ? current.revision : 0) + 1;
      const now = new Date().toISOString();
      const toSave = {
        build: 'RC177 Teamdaten API',
        revision,
        savedAt: now,
        savedBy: payload.user || (principal && principal.userDetails) || 'unknown',
        sourceClient: payload.clientId || '',
        state: payload.state,
        users: Array.isArray(payload.users) ? payload.users : []
      };
      const blob = await blobClient();
      await blob.upload(JSON.stringify(toSave), Buffer.byteLength(JSON.stringify(toSave)), {
        blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' }
      });
      return json({ ok: true, revision, savedAt: now, savedBy: toSave.savedBy });
    } catch (err) {
      context.error(err);
      return json({ ok: false, error: err.message || String(err) }, 500);
    }
  }
});

app.http('exporthubBackup', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'exporthub/backup',
  handler: async (request, context) => {
    try {
      const current = await readState();
      if (!current) return json({ empty: true }, 404);
      return {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'content-disposition': 'attachment; filename="ExportHUB_RC177_Teamdaten_Backup.json"',
          'cache-control': 'no-store'
        },
        body: JSON.stringify(current, null, 2)
      };
    } catch (err) {
      context.error(err);
      return json({ ok: false, error: err.message || String(err) }, 500);
    }
  }
});
