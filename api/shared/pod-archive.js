'use strict';

const crypto = require('crypto');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const store = require('./pickup-store');
const graphDrive = require('./graph-drive');

function text(value) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}
function safeFilePart(value) {
  return (text(value) || 'Sendung').replace(/[\\/:*?"<>|#%]/g, '_').replace(/\s+/g, '_').slice(0, 90);
}
function automaticPod(record) {
  return (Array.isArray(record && record.podFiles) ? record.podFiles : []).find(file => String(file && file.kind || '').toLowerCase() === 'automatic-pod') || null;
}
function fileNameFor(record) {
  const ref = safeFilePart(record && record.reference);
  const seq = Math.max(0, Math.round(Number(record && record.subShipmentSequence) || 0));
  const total = Math.max(0, Math.round(Number(record && record.subShipmentTotal) || 0));
  const suffix = seq && total ? '_Teil_' + seq + '-von-' + total : '';
  return 'POD_' + ref + suffix + '_Abliefernachweis.pdf';
}
function wrap(value, max) {
  const words = text(value).split(' ').filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? current + ' ' + word : word;
    if (next.length > max && current) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines.length ? lines : ['-'];
}
function formatDate(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return text(value) || '-';
  try {
    return date.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'medium', timeStyle: 'medium' });
  } catch (_) {
    return date.toISOString();
  }
}
async function createPodPdf(record, signatureBuffer, signatureType) {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595.28, 841.89]);
  let y = 800;
  const left = 48;
  const width = 499;

  function newPage() {
    page = pdf.addPage([595.28, 841.89]);
    y = 800;
  }
  function ensure(space) {
    if (y - space < 54) newPage();
  }
  function line(label, value) {
    const lines = wrap(value, 72);
    ensure(18 + Math.max(0, lines.length - 1) * 13);
    page.drawText(label, { x: left, y, size: 10, font: bold });
    page.drawText(lines[0], { x: left + 135, y, size: 10, font: normal });
    for (let i = 1; i < lines.length; i++) {
      y -= 13;
      page.drawText(lines[i], { x: left + 135, y, size: 10, font: normal });
    }
    y -= 18;
  }
  function heading(value) {
    ensure(28);
    y -= 4;
    page.drawText(value, { x: left, y, size: 12, font: bold });
    y -= 20;
  }

  page.drawText('ExportHUB - Abliefernachweis (POD)', { x: left, y, size: 19, font: bold });
  y -= 28;
  page.drawText('Automatisch nach digital bestaetigter Abholung erzeugt', { x: left, y, size: 9, font: normal });
  y -= 28;

  line('Referenz', record.reference || '-');
  if (record.subShipmentLabel) line('Teilsendung', record.subShipmentLabel);
  line('Kunde', record.customer || '-');
  line('Empfaenger', record.recipient || '-');
  line('Lieferadresse', record.address || '-');
  line('Spedition', record.carrierName || record.speditionName || record.carrier || record.spedition || '-');

  heading('Abholung');
  const history = typeof store.pickupHistory === 'function' ? store.pickupHistory(record) : (Array.isArray(record.pickupHistory) ? record.pickupHistory : []);
  const last = history.length ? history[history.length - 1] : {};
  line('Zeitpunkt', formatDate(record.confirmedAt || last.confirmedAt));
  line('Fahrer', last.driverName || record.driverName || '-');
  line('Kennzeichen', last.licensePlate || record.licensePlate || '-');
  line('Verlader', last.loaderName || record.loaderName || record.loadedBy || '-');
  line('Colli gesamt', String(typeof store.expectedCollis === 'function' ? store.expectedCollis(record) : (record.expectedColliCount || record.colliCount || '-')));
  line('Colli abgeholt', String(typeof store.pickupCollectedColliCount === 'function' ? store.pickupCollectedColliCount(record) : (record.pickupCollectedColliCount || record.collectedPickupCollis || '-')));

  const rows = Array.isArray(record.rows) ? record.rows : [];
  if (rows.length) {
    heading('Packstuecke');
    for (let i = 0; i < Math.min(rows.length, 40); i++) {
      const row = rows[i] || {};
      const packaging = text(row.type || row.packaging || row.verpackung || row.packageType || row.packagingType) || 'Colli';
      const count = row.count != null ? row.count : (row.quantity != null ? row.quantity : (row.qty != null ? row.qty : ''));
      const weight = row.weight != null ? row.weight : (row.kg != null ? row.kg : '');
      line((i + 1) + '.', packaging + (count !== '' ? ' - Anzahl ' + count : '') + (weight !== '' ? ' - ' + weight + ' kg' : ''));
    }
    if (rows.length > 40) line('Hinweis', 'Weitere ' + (rows.length - 40) + ' Positionen sind im ExportHUB-Datensatz dokumentiert.');
  }

  heading('Fahrerunterschrift');
  ensure(180);
  let image = null;
  try {
    if (/png/i.test(signatureType || '')) image = await pdf.embedPng(signatureBuffer);
    else image = await pdf.embedJpg(signatureBuffer);
  } catch (_) {
    image = null;
  }
  if (image) {
    const dims = image.scale(1);
    const maxW = width;
    const maxH = 150;
    const scale = Math.min(maxW / dims.width, maxH / dims.height, 1);
    page.drawRectangle({ x: left, y: y - maxH + 8, width: maxW, height: maxH, borderWidth: 1 });
    page.drawImage(image, { x: left + 8, y: y - Math.min(maxH - 16, dims.height * scale), width: dims.width * scale, height: dims.height * scale });
    y -= maxH + 10;
  } else {
    page.drawText('Unterschrift ist im geschuetzten ExportHUB-POD-Speicher hinterlegt.', { x: left, y, size: 10, font: normal });
    y -= 22;
  }

  ensure(55);
  page.drawText('Nachweis-ID: ' + text(record.accessKey || '').slice(0, 20), { x: left, y, size: 8, font: normal });
  y -= 12;
  page.drawText('Erzeugt: ' + formatDate(new Date().toISOString()), { x: left, y, size: 8, font: normal });
  y -= 12;
  page.drawText('Quelle: ExportHUB QR-Abholung', { x: left, y, size: 8, font: normal });

  return Buffer.from(await pdf.save());
}
async function readAutomaticPodBuffer(accessKey, environment, record) {
  const file = automaticPod(record);
  if (!file || !text(file.blobName || file.storageBlobName)) return null;
  const got = await store.getRecord(accessKey, environment);
  const blob = got.clients.pods.getBlobClient(text(file.blobName || file.storageBlobName));
  const read = await store.readBuffer(blob);
  return { buffer: read.buffer, file, record: got.record, clients: got.clients };
}
async function persistBackupState(accessKey, environment, patch, podFile) {
  return store.mutateRecord(accessKey, environment, function(record) {
    const files = Array.isArray(record.podFiles) ? record.podFiles.slice() : [];
    if (podFile) {
      const filtered = files.filter(file => String(file && file.kind || '').toLowerCase() !== 'automatic-pod');
      filtered.push(podFile);
      record.podFiles = filtered;
      record.podUpdatedAt = podFile.uploadedAt || store.now();
      record.automaticPodBlobName = podFile.blobName;
      record.automaticPodHash = podFile.hash;
    }
    record.podBackup = Object.assign({}, record.podBackup || {}, patch || {});
    record.updatedAt = store.now();
    return record;
  });
}
async function saveAzurePod(accessKey, environment, record, pdf) {
  const got = await store.getRecord(accessKey, environment);
  const name = fileNameFor(record);
  const hash = crypto.createHash('sha256').update(pdf).digest('hex');
  const blobName = store.podPrefix(environment, accessKey) + '/automatic/' + safeFilePart(name);
  const blob = got.clients.pods.getBlockBlobClient(blobName);
  await blob.uploadData(pdf, {
    blobHTTPHeaders: { blobContentType: 'application/pdf', blobCacheControl: 'no-store' },
    metadata: {
      accesshash: String(accessKey),
      reference: String(record.reference || ''),
      kind: 'automatic-pod',
      sha256: hash
    }
  });
  const uploadedAt = store.now();
  const file = {
    id: 'automatic-pod-' + hash.slice(0, 16),
    kind: 'automatic-pod',
    name,
    type: 'application/pdf',
    size: pdf.length,
    uploadedAt,
    blobName,
    storageBlobName: blobName,
    storage: 'azure',
    hash,
    source: 'pickup-confirm-v2'
  };
  const next = await persistBackupState(accessKey, environment, {
    status: 'azure-saved',
    azureSaved: true,
    azureSavedAt: uploadedAt,
    lastAttemptAt: uploadedAt,
    fileName: name,
    hash,
    lastError: ''
  }, file);
  return { record: next, file, hash, pdf };
}
async function copyToDrive(accessKey, environment, record, pdf, file) {
  const attemptAt = store.now();
  try {
    const result = await graphDrive.uploadPdf(pdf, file && file.name || fileNameFor(record));
    const next = await persistBackupState(accessKey, environment, {
      status: 'saved',
      azureSaved: true,
      driveSaved: true,
      driveSavedAt: store.now(),
      lastAttemptAt: attemptAt,
      attempts: Math.max(0, Number(record && record.podBackup && record.podBackup.attempts) || 0) + 1,
      driveItemId: result.id || '',
      webUrl: result.webUrl || '',
      fileName: result.name || (file && file.name) || fileNameFor(record),
      lastError: ''
    });
    return { ok: true, record: next, drive: result };
  } catch (error) {
    const next = await persistBackupState(accessKey, environment, {
      status: 'pending',
      azureSaved: true,
      driveSaved: false,
      lastAttemptAt: attemptAt,
      attempts: Math.max(0, Number(record && record.podBackup && record.podBackup.attempts) || 0) + 1,
      lastError: text(error && (error.code ? error.code + ': ' : '') + (error && error.message || 'Microsoft-365-Sicherung fehlgeschlagen')).slice(0, 500)
    });
    return { ok: false, record: next, error };
  }
}
async function ensureAutomaticPod(accessKey, environment, options) {
  options = Object.assign({ copyToDrive: true }, options || {});
  accessKey = text(accessKey).toLowerCase();
  environment = store.normalizeEnvironment(environment);
  let got = await store.getRecord(accessKey, environment);
  let record = got.record || {};
  const complete = typeof store.pickupComplete === 'function' ? store.pickupComplete(record) : !!record.confirmedAt;
  if (!complete || !record.confirmedAt) throw store.err('PICKUP_NOT_CONFIRMED', 'Die Abholung ist noch nicht vollstaendig bestaetigt.', 409);
  if (!record.signatureBlobName) throw store.err('SIGNATURE_NOT_FOUND', 'Fahrerunterschrift fuer den POD fehlt.', 409);

  let pdf = null;
  let file = automaticPod(record);
  if (file) {
    try {
      const existing = await readAutomaticPodBuffer(accessKey, environment, record);
      if (existing && existing.buffer && existing.buffer.length) pdf = existing.buffer;
    } catch (_) {
      pdf = null;
    }
  }
  if (!pdf) {
    const signatureBlob = got.clients.pods.getBlobClient(record.signatureBlobName);
    const signature = await store.readBuffer(signatureBlob);
    pdf = await createPodPdf(record, signature.buffer, record.signatureType || signature.contentType);
    const saved = await saveAzurePod(accessKey, environment, record, pdf);
    record = saved.record;
    file = saved.file;
  }
  if (!file) file = automaticPod(record);
  if (!options.copyToDrive) return { ok: true, record, file, pdf, backup: record.podBackup || {} };

  const drive = await copyToDrive(accessKey, environment, record, pdf, file);
  return {
    ok: true,
    record: drive.record || record,
    file,
    pdf,
    backup: (drive.record || record).podBackup || {},
    driveSaved: drive.ok === true,
    driveError: drive.ok ? null : drive.error
  };
}
async function retryDriveBackup(accessKey, environment) {
  const got = await store.getRecord(accessKey, environment);
  const record = got.record || {};
  const existing = await readAutomaticPodBuffer(accessKey, environment, record);
  if (!existing) return ensureAutomaticPod(accessKey, environment, { copyToDrive: true });
  const result = await copyToDrive(accessKey, environment, record, existing.buffer, existing.file);
  return { ok: true, record: result.record || record, file: existing.file, backup: (result.record || record).podBackup || {}, driveSaved: result.ok === true, driveError: result.ok ? null : result.error };
}

module.exports = {
  automaticPod,
  fileNameFor,
  createPodPdf,
  ensureAutomaticPod,
  retryDriveBackup
};
