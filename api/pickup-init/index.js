'use strict';
const store = require('../shared/pickup-store');

function clearPickupProof(record) {
  const clean = Object.assign({}, record || {});
  [
    'confirmedAt', 'pickedUpAt', 'pickupConfirmedAt', 'completedAt',
    'driverName', 'licensePlate', 'loaderName', 'returnedEuroPallets',
    'signatureBlobName', 'signatureContentType', 'signatureSize',
    'podCloudBackupStatus', 'podCloudBackupAt', 'podCloudBackupFileName',
    'podCloudBackupWebUrl', 'podCloudBackupDriveItemId', 'podCloudBackupHash',
    'podCloudBackupError'
  ].forEach(key => { delete clean[key]; });
  clean.disabled = false;
  return clean;
}

module.exports = async function (context, req) {
  try {
    const body = req.body || {};
    const token = store.text(body.token || (req.query && req.query.token));
    if (!store.validToken(token)) {
      context.res = store.error(400, 'INVALID_TOKEN', 'Ungültiger QR-Code.');
      return;
    }

    const existing = await store.readRecord(token);
    const resetRequested = body.resetPickup === true || body.reactivate === true;
    const requestedReference = store.text(body.reference || body.shipmentRef);

    if (resetRequested) {
      if (!existing) {
        context.res = store.error(404, 'PICKUP_NOT_FOUND', 'Der QR-Code ist serverseitig nicht registriert.');
        return;
      }
      if (!store.text(body.resetReason)) {
        context.res = store.error(400, 'RESET_REASON_REQUIRED', 'Für das Zurücksetzen ist ein Grund erforderlich.');
        return;
      }
      if (store.text(existing.reference) && requestedReference && store.text(existing.reference) !== requestedReference) {
        context.res = store.error(409, 'REFERENCE_MISMATCH', 'QR-Code und Sendungsreferenz stimmen nicht überein.');
        return;
      }
      await store.deleteSignature(existing);
    }

    const timestamp = store.now();
    const base = resetRequested ? clearPickupProof(existing) : (existing || {});
    const record = Object.assign({}, base, {
      token,
      reference: store.text(body.reference || body.shipmentRef || (base && base.reference)),
      shipmentId: store.text(body.shipmentId || (base && base.shipmentId)),
      customer: store.text(body.customerName || body.customer || body.recipientCustomerName || (base && base.customer)),
      recipient: store.text(body.recipient || body.recipientName || (base && base.recipient)),
      address: store.text(body.recipientAddress || body.deliveryAddress || body.shipToAddress || body.address || (base && base.address)),
      locationName: store.text(body.locationName || (base && base.locationName)),
      palletOut: Math.max(0, Number(body.palletOut || body.euroPallets || (base && base.palletOut) || 0) || 0),
      disabled: resetRequested ? false : Boolean(body.disabled === true || body.active === false || (base && base.disabled)),
      createdAt: (base && base.createdAt) || timestamp,
      updatedAt: timestamp,
      expiresAt: (base && base.expiresAt) || new Date(Date.now() + 180 * 86400000).toISOString(),
      registrationVersion: 'RC487'
    });

    if (resetRequested) {
      record.resetAt = timestamp;
      record.resetReason = store.text(body.resetReason);
      record.resetBy = store.text(body.resetBy || body.userName || body.user || body.username);
    }

    await store.writeRecord(token, record);
    context.res = store.json(200, Object.assign({
      registered: true,
      reset: resetRequested,
      reactivated: resetRequested
    }, store.publicRecord(record)));
  } catch (err) {
    context.log.error('pickup-init', err);
    context.res = store.error(err.statusCode || 500, err.code || 'INIT_FAILED', err.message || 'QR-Code konnte nicht registriert werden.');
  }
};
