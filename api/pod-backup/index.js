'use strict';

const crypto = require('crypto');
const store = require('../shared/pickup-store');
const graph = require('../shared/graph-drive');

function canonicalReference(value) {
  return store.text(value).toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 48);
}

function decodePdf(value) {
  const raw = store.text(value).replace(/^data:application\/pdf;base64,/i, '').replace(/\s/g, '');
  if (!raw || !/^[A-Za-z0-9+/=]+$/.test(raw)) throw Object.assign(new Error('POD-PDF fehlt oder ist ungültig.'), { statusCode: 400, code: 'INVALID_PDF' });
  const buffer = Buffer.from(raw, 'base64');
  if (buffer.length < 1000 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') throw Object.assign(new Error('Die übertragene Datei ist keine gültige PDF.'), { statusCode: 400, code: 'INVALID_PDF' });
  if (buffer.length > 20 * 1024 * 1024) throw Object.assign(new Error('Das POD-PDF ist größer als 20 MB.'), { statusCode: 413, code: 'PDF_TOO_LARGE' });
  return buffer;
}

function defaultFileName(record, requested) {
  const ref = canonicalReference(record.reference || record.shipmentId || 'Sendung') || 'Sendung';
  const day = store.text(record.confirmedAt || store.now()).slice(0, 10) || new Date().toISOString().slice(0, 10);
  const wanted = graph.safeFileName(requested);
  if (/\.pdf$/i.test(wanted) && wanted.toUpperCase().includes(ref)) return wanted;
  return `${day}_${ref}_POD_Ladeliste_mit_Unterschrift.pdf`;
}

module.exports = async function (context, req) {
  let token = '';
  try {
    const body = req.body || {};
    token = store.text(body.token || req.query && req.query.token);
    if (!store.validToken(token)) {
      context.res = store.error(400, 'INVALID_TOKEN', 'Ungültiger QR-Code.');
      return;
    }
    const record = await store.readRecord(token);
    if (!record) {
      context.res = store.error(404, 'NOT_FOUND', 'Dieser QR-Code ist nicht registriert.');
      return;
    }
    if (!record.confirmedAt || !record.signatureBlobName) {
      context.res = store.error(409, 'POD_NOT_READY', 'Für diese Sendung liegt noch kein bestätigter POD mit Unterschrift vor.');
      return;
    }
    if ((req.method || 'GET').toUpperCase() === 'GET') {
      context.res = store.json(200, {
        ok: true,
        saved: record.podCloudBackupStatus === 'saved',
        status: record.podCloudBackupStatus || 'pending',
        savedAt: record.podCloudBackupAt || null,
        fileName: record.podCloudBackupFileName || '',
        webUrl: record.podCloudBackupWebUrl || '',
        driveItemId: record.podCloudBackupDriveItemId || '',
        error: record.podCloudBackupError || ''
      });
      return;
    }
    const requestedRef = canonicalReference(body.reference || body.shipmentRef);
    const storedRef = canonicalReference(record.reference || record.shipmentId);
    if (requestedRef && storedRef && requestedRef !== storedRef) {
      context.res = store.error(409, 'REFERENCE_MISMATCH', 'Die POD-Datei gehört nicht zur registrierten Sendungsreferenz.');
      return;
    }
    const pdf = decodePdf(body.pdfBase64 || body.pdfData || body.data);
    const hash = crypto.createHash('sha256').update(pdf).digest('hex');
    const fileName = defaultFileName(record, body.fileName || body.filename);
    if (record.podCloudBackupStatus === 'saved' && record.podCloudBackupHash === hash && record.podCloudBackupFileName === fileName) {
      context.res = store.json(200, {
        ok: true,
        saved: true,
        alreadySaved: true,
        savedAt: record.podCloudBackupAt,
        fileName: record.podCloudBackupFileName,
        webUrl: record.podCloudBackupWebUrl || '',
        driveItemId: record.podCloudBackupDriveItemId || '',
        hash
      });
      return;
    }
    const uploaded = await graph.uploadPdf(pdf, fileName);
    const savedAt = store.now();
    const updated = Object.assign({}, record, {
      podCloudBackupStatus: 'saved',
      podCloudBackupAt: savedAt,
      podCloudBackupFileName: uploaded.name || fileName,
      podCloudBackupWebUrl: uploaded.webUrl || '',
      podCloudBackupDriveItemId: uploaded.id || '',
      podCloudBackupHash: hash,
      podCloudBackupSize: uploaded.size || pdf.length,
      podCloudBackupError: '',
      podCloudBackupVersion: 'RC479',
      updatedAt: savedAt
    });
    await store.writeRecord(token, updated);
    context.res = store.json(200, {
      ok: true,
      saved: true,
      savedAt,
      fileName: updated.podCloudBackupFileName,
      webUrl: updated.podCloudBackupWebUrl,
      driveItemId: updated.podCloudBackupDriveItemId,
      hash,
      size: updated.podCloudBackupSize
    });
  } catch (err) {
    context.log.error('pod-backup', err);
    if (store.validToken(token)) {
      try {
        const record = await store.readRecord(token);
        if (record) await store.writeRecord(token, Object.assign({}, record, {
          podCloudBackupStatus: 'error',
          podCloudBackupError: store.text(err.message || err),
          podCloudBackupLastAttemptAt: store.now(),
          updatedAt: store.now()
        }));
      } catch (_) {}
    }
    context.res = store.error(err.statusCode || 500, err.code || 'POD_BACKUP_FAILED', err.message || 'POD konnte nicht in SharePoint gesichert werden.');
  }
};
