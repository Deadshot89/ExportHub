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
    context.res = store.json(200, store.publicRecord(record));
  } catch (err) {
    context.log.error('pickup-status', err);
    context.res = store.error(500, 'STATUS_FAILED', err.message || 'Status konnte nicht geladen werden.');
  }
};
