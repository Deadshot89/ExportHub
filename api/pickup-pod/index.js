'use strict';
const store = require('../shared/pickup-store');

async function findRecord(token, ref) {
  if (token && store.validToken(token)) {
    const c = await store.clients();
    const blob = c.recordBlob(c.records, token);
    const stored = await store.readJson(blob, {});
    return stored.value || null;
  }
  if (ref) {
    // Ref-basierte Suche ohne Auth nicht unterstützt → null
    return null;
  }
  return null;
}

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: { 'Cache-Control': 'no-store' }, body: '' };
    return;
  }
  if (req.method !== 'GET') {
    context.res = store.json(405, { ok: false, code: 'METHOD_NOT_ALLOWED' }, { Allow: 'GET, OPTIONS' });
    return;
  }
  try {
    const token = String((req.query && (req.query.token || req.query.t)) || '').toLowerCase();
    const ref = String((req.query && (req.query.ref || req.query.r)) || '');

    const rec = await findRecord(token, ref);
    if (!rec) throw store.err('NOT_FOUND', 'Kein POD für dieses Token gefunden.', 404);
    if (!rec.signatureBlobName) throw store.err('NO_SIGNATURE', 'Für diese Abholung ist noch keine Unterschrift gespeichert.', 404);

    // Unterschrift aus Storage laden
    const dl = await store.downloadBytes(rec.signatureBlobName);
    if (!dl) throw store.err('SIGNATURE_MISSING', 'Die Unterschrift konnte nicht geladen werden.', 410);

    const contentType = rec.signatureContentType || dl.contentType || 'image/png';
    context.res = {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
        'X-ExportHUB-POD': 'signed-loadlist',
        'X-Signature-Uploaded-At': rec.signatureUploadedAt || ''
      },
      body: dl.bytes
    };
  } catch (e) {
    context.log.error('pickup-pod error', e && e.code, e && e.message);
    // Für image-Anfragen JSON-Fehler zurückgeben
    context.res = store.json(e.status || 500, {
      ok: false,
      code: e.code || 'SERVER_ERROR',
      message: e.message || 'POD konnte nicht geladen werden.'
    });
  }
};
