'use strict';

const crypto = require('crypto');
const accessStore = require('../shared/public-access-store');
const store = require('../shared/pickup-store');
const podArchive = require('../shared/pod-archive');

function text(v) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
}
function json(status, body) {
  return store.json(status, body);
}
function decodePdf(value) {
  const raw = String(value || '').replace(/\s+/g, '');
  if (!raw) return null;
  let pdf;
  try { pdf = Buffer.from(raw, 'base64'); } catch (_) { throw store.err('PDF_INVALID', 'POD-PDF ist ungültig.', 400); }
  if (pdf.length < 1000 || pdf.slice(0, 5).toString('ascii') !== '%PDF-') throw store.err('PDF_INVALID', 'Nur ein vollständiges PDF kann gesichert werden.', 400);
  if (pdf.length > 20 * 1024 * 1024) throw store.err('PDF_TOO_LARGE', 'POD-PDF ist größer als 20 MB.', 413);
  return pdf;
}

module.exports = async function(context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' }, body: '' };
    return;
  }
  if (req.method !== 'POST') {
    context.res = json(405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Nur POST ist erlaubt.' });
    return;
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const rawToken = text(body.token);
    const resolved = await accessStore.resolve(req, 'pickup', rawToken, { allowUsed: true }, body);
    const accessKey = resolved.resourceKey || resolved.tokenHash;
    let got = await store.getRecord(accessKey, resolved.environment);
    let record = got.record || {};

    const complete = typeof store.pickupComplete === 'function' ? store.pickupComplete(record) : !!record.confirmedAt;
    if (!complete || !record.confirmedAt) throw store.err('PICKUP_NOT_CONFIRMED', 'Die Abholung ist serverseitig noch nicht bestätigt.', 409);
    if (!record.signatureBlobName) throw store.err('SIGNATURE_NOT_FOUND', 'Es ist keine echte Fahrerunterschrift für die POD-Sicherung gespeichert.', 409);

    const reference = text(body.reference).toUpperCase();
    if (reference && text(record.reference).toUpperCase() && reference !== text(record.reference).toUpperCase()) {
      throw store.err('REFERENCE_MISMATCH', 'Referenz stimmt nicht mit dem bestätigten Abholdatensatz überein.', 409);
    }

    const suppliedPdf = decodePdf(body.pdfBase64);
    let result;
    if (suppliedPdf) {
      const fileName = text(body.fileName) || podArchive.fileNameFor(record);
      result = await podArchive.saveSuppliedPod(accessKey, resolved.environment, record, suppliedPdf, fileName);
      record = result.record || record;
    } else {
      const existing = podArchive.automaticPod(record);
      result = existing
        ? await podArchive.retryArchiveBackup(accessKey, resolved.environment)
        : await podArchive.ensureAutomaticPod(accessKey, resolved.environment, { copyToDrive: true });
      record = result.record || record;
    }

    try { await store.updateTeam(record, [], rawToken); } catch (error) {
      context.log && context.log.error && context.log.error('RC1114 POD team state update failed', error && error.code, error && error.message);
    }

    const backup = record.podBackup || result.backup || {};
    context.res = json(200, {
      ok: true,
      saved: backup.status === 'saved',
      azureSaved: backup.azureSaved === true,
      archiveSaved: backup.archiveSaved === true,
      driveSaved: backup.driveSaved === true,
      status: backup.status || 'unknown',
      savedAt: backup.archiveSavedAt || backup.driveSavedAt || backup.azureSavedAt || store.now(),
      fileName: backup.fileName || result.file && result.file.name || podArchive.fileNameFor(record),
      webUrl: backup.webUrl || '',
      driveItemId: backup.driveItemId || '',
      hash: backup.hash || result.file && result.file.hash || '',
      attempts: Math.max(0, Number(backup.attempts) || 0),
      lastError: backup.lastError || '',
      version: 'RC1220'
    });
  } catch (error) {
    context.log && context.log.error && context.log.error('pod-backup RC1114', error && error.code, error && error.message);
    context.res = json(error.status || error.statusCode || 500, {
      ok: false,
      code: error.code || 'SERVER_ERROR',
      message: error.message || 'POD-Sicherung ist fehlgeschlagen.'
    });
  }
};
