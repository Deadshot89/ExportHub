'use strict';
const store = require('../shared/pickup-store');

module.exports = async function (context, req) {
  try {
    const body = req.body || {};
    const token = store.text(body.token || (req.query && req.query.token));
    if (!store.validToken(token)) {
      context.res = store.error(400, 'INVALID_TOKEN', 'Ungültiger QR-Code.');
      return;
    }

    const record = await store.readRecord(token);
    if (!record) {
      context.res = store.error(404, 'NOT_FOUND', 'Dieser QR-Code ist nicht registriert.');
      return;
    }
    if (record.disabled) {
      context.res = store.error(410, 'DISABLED', 'Dieser QR-Code ist gesperrt oder die Sendung wurde storniert.');
      return;
    }

    // Idempotent: Eine bereits vollständig gespeicherte Bestätigung wird als Erfolg zurückgegeben.
    if (record.confirmedAt && record.signatureBlobName) {
      context.res = store.json(200, Object.assign({ alreadyConfirmed: true }, store.publicRecord(record)));
      return;
    }

    const loader = store.loaderForPin(body.loaderPin || body.pin);
    if (!loader) {
      context.res = store.error(403, 'INVALID_LOADER_PIN', 'Der Verlader-PIN ist nicht freigegeben.');
      return;
    }

    const signature = store.decodeSignature(body.signatureDataUrl || body.driverSignature || body.pickupSignature || body.signature);
    const savedSignature = await store.saveSignature(token, signature);
    const timestamp = store.now();
    const confirmed = Object.assign({}, record, {
      confirmedAt: record.confirmedAt || timestamp,
      updatedAt: timestamp,
      status: 'confirmed',
      driverName: store.text(body.driverName || body.pickupDriverName),
      licensePlate: store.text(body.licensePlate || body.vehicleLicensePlate || body.kennzeichen).toUpperCase(),
      loaderName: loader.name,
      returnedEuroPallets: Math.max(0, Math.round(Number(body.returnedEuroPallets || body.returnPallets || 0) || 0)),
      signatureBlobName: savedSignature.blobName,
      signatureContentType: savedSignature.contentType,
      signatureSize: savedSignature.size,
      podType: 'signed-loadlist',
      podCloudBackupStatus: record.podCloudBackupStatus === 'saved' ? 'saved' : 'pending',
      podCloudBackupRequestedAt: timestamp,
      confirmationVersion: 'RC479'
    });

    await store.writeRecord(token, confirmed);
    context.res = store.json(200, Object.assign({ confirmed: true }, store.publicRecord(confirmed)));
  } catch (err) {
    context.log.error('pickup-confirm', err);
    context.res = store.error(err.statusCode || 500, err.code || 'CONFIRM_FAILED', err.message || 'Abholung konnte nicht bestätigt werden.');
  }
};
