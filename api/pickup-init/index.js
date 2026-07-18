'use strict';
const store = require('../shared/pickup-store');
const registration = require('../shared/pickup-registration');

module.exports = async function (context, req) {
  if (req.method !== 'POST') {
    context.res = store.json(405, { ok: false, code: 'METHOD_NOT_ALLOWED' }, { Allow: 'POST' });
    return;
  }
  if (!store.principal(req) && process.env.AZURE_FUNCTIONS_ENVIRONMENT !== 'Development') {
    context.res = store.json(401, { ok: false, code: 'AUTH_REQUIRED', message: 'Microsoft-Anmeldung erforderlich.' });
    return;
  }

  try {
    const body = store.body(req);
    const token = String(body.token || '').toLowerCase();
    const pin = String(body.pin || '');
    if (!store.validToken(token)) throw store.err('INVALID_TOKEN', 'Ungültiges QR-Token.', 400);
    if (!/^\d{6}$/.test(pin)) throw store.err('INVALID_PIN', 'PIN-Initialisierung ist ungültig.', 400);

    const clients = await store.clients();
    const blob = store.recordBlob(clients.records, token);
    let result = null;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const old = await store.readJson(blob);
      result = registration.prepareRegistration(old.value, {
        token,
        pin,
        shipmentId: body.shipmentId,
        reference: body.reference,
        customer: body.customer,
        recipient: body.recipient,
        expiresDays: body.expiresDays,
        rotate: body.rotate === true,
        expectedCredentialVersion: body.expectedCredentialVersion
      }, { hash: store.hash, now: store.now });

      try {
        await store.writeJson(blob, result.record, old.etag);
        break;
      } catch (error) {
        if (error && error.statusCode === 412 && attempt < 5) continue;
        throw error;
      }
    }

    context.res = store.json(200, Object.assign(store.publicRecord(result.record), {
      registered: true,
      idempotent: result.idempotent,
      rotated: result.rotated,
      credentialVersion: result.credentialVersion,
      pinRevision: result.pinRevision,
      version: 'RC534',
      updatedBy: store.actor(req)
    }));
  } catch (error) {
    context.log.error(error);
    context.res = store.json(error.status || 500, {
      ok: false,
      code: error.code || 'SERVER_ERROR',
      message: error.message || 'Initialisierung fehlgeschlagen.'
    });
  }
};
