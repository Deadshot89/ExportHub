'use strict';
const store = require('../shared/pickup-store');

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

    let rec = null;
    if (token && store.validToken(token)) {
      const c = await store.clients();
      const blob = c.recordBlob(c.records, token);
      const stored = await store.readJson(blob, {});
      rec = stored.value || null;
    } else if (ref) {
      // Suche per Referenz über Team-Status nicht möglich ohne Auth → 404
      rec = null;
    }
    if (!rec) throw store.err('NOT_FOUND', 'Kein ABD-Eintrag für dieses Token gefunden.', 404);

    context.res = store.json(200, {
      ok: true,
      token: store.q(rec.token),
      reference: store.q(rec.reference || rec.ref),
      status: store.q(rec.status || 'open'),
      confirmedAt: rec.confirmedAt || null,
      customer: store.q(rec.customer || rec.customerName),
      recipient: store.q(rec.recipient),
      palletOut: Math.max(0, Number(rec.palletOut || 0)),
      palletReturned: Math.max(0, Number(rec.palletReturned || 0)),
      hasSignature: !!(rec.signatureBlobName),
      signatureBlobName: rec.signatureBlobName || null,
      driverSignature: rec.signatureBlobName ? ('pod:' + rec.signatureBlobName) : null,
      pickupSignature: rec.signatureBlobName ? ('pod:' + rec.signatureBlobName) : null,
      podFiles: Array.isArray(rec.podFiles) ? rec.podFiles : []
    });
  } catch (e) {
    context.log.error('pickup-status error', e && e.code, e && e.message);
    context.res = store.json(e.status || 500, {
      ok: false,
      code: e.code || 'SERVER_ERROR',
      message: e.message || 'Status konnte nicht geladen werden.'
    });
  }
};
