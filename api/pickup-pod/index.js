'use strict';
const store = require('../shared/pickup-store');

module.exports = async function (context, req) {
  try {
    const token = store.text(req.query && req.query.token);
    if (!store.validToken(token)) {
      context.res = store.error(400, 'INVALID_TOKEN', 'Ungültiger QR-Code.');
      return;
    }
    const record = await store.readRecord(token);
    if (!record) {
      context.res = store.error(404, 'NOT_FOUND', 'Dieser QR-Code ist nicht registriert.');
      return;
    }
    const signature = await store.readSignature(record);
    if (!signature || !signature.buffer || signature.buffer.length < 100) {
      context.res = store.error(404, 'SIGNATURE_NOT_FOUND', 'Für diese Abholung wurde keine gültige Unterschrift gespeichert.');
      return;
    }

    // Die HTML-Anwendung erzeugt aus dieser Unterschrift die vollständige unterschriebene Ladeliste als PDF.
    context.res = {
      status: 200,
      isRaw: true,
      headers: {
        'Content-Type': signature.contentType,
        'Content-Length': String(signature.buffer.length),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Disposition': `inline; filename="Unterschrift_${(record.reference || token).replace(/[^A-Za-z0-9_-]/g, '_')}.jpg"`
      },
      body: signature.buffer
    };
  } catch (err) {
    context.log.error('pickup-pod', err);
    context.res = store.error(500, 'POD_FAILED', err.message || 'POD konnte nicht geladen werden.');
  }
};
