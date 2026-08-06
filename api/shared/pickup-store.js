'use strict';

const { BlobServiceClient } = require('@azure/storage-blob');

const DEFAULT_CONTAINER = 'exporthub-pickup';
const DEFAULT_PINS = Object.freeze({
  '4466': 'Daniel Ollmann',
  '2050': 'Tobias',
  '2258': 'Amer',
  '7530': 'Franjo'
});

function text(value) {
  return String(value == null ? '' : value).trim();
}

function now() {
  return new Date().toISOString();
}

function validToken(value) {
  return /^[A-Za-z0-9_-]{6,128}$/.test(text(value));
}

function json(status, body, headers) {
  return {
    status,
    headers: Object.assign({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    }, headers || {}),
    body
  };
}

function error(status, code, message, extra) {
  return json(status, Object.assign({ ok: false, code, message }, extra || {}));
}

function connectionString() {
  const value = text(process.env.EXPORTHUB_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage);
  if (!value) throw new Error('Azure Storage ist nicht konfiguriert.');
  return value;
}

let containerPromise;
async function container() {
  if (!containerPromise) {
    const service = BlobServiceClient.fromConnectionString(connectionString());
    const client = service.getContainerClient(text(process.env.EXPORTHUB_PICKUP_CONTAINER) || DEFAULT_CONTAINER);
    containerPromise = client.createIfNotExists().then(() => client);
  }
  return containerPromise;
}

function recordName(token) {
  return `records/${token}.json`;
}

function signatureName(token, extension) {
  return `signatures/${token}.${extension || 'jpg'}`;
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function readRecord(token) {
  if (!validToken(token)) return null;
  const c = await container();
  const blob = c.getBlockBlobClient(recordName(token));
  try {
    const response = await blob.download(0);
    const buffer = await streamToBuffer(response.readableStreamBody);
    return JSON.parse(buffer.toString('utf8'));
  } catch (err) {
    if (err && (err.statusCode === 404 || err.code === 'BlobNotFound')) return null;
    throw err;
  }
}

async function writeRecord(token, record) {
  if (!validToken(token)) throw new Error('Ungültiger QR-Token.');
  const c = await container();
  const blob = c.getBlockBlobClient(recordName(token));
  const payload = Buffer.from(JSON.stringify(record), 'utf8');
  await blob.uploadData(payload, {
    blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8', blobCacheControl: 'no-store' }
  });
  return record;
}

function parsePins() {
  const configured = text(process.env.EXPORTHUB_LOADER_PINS);
  if (!configured) return Object.assign({}, DEFAULT_PINS);
  try {
    const parsed = JSON.parse(configured);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const result = {};
      Object.keys(parsed).forEach(pin => {
        if (/^\d{4}$/.test(pin) && text(parsed[pin])) result[pin] = text(parsed[pin]);
      });
      return Object.keys(result).length ? result : Object.assign({}, DEFAULT_PINS);
    }
  } catch (_) {}
  const result = {};
  configured.split(/[;,\n]+/).forEach(item => {
    const match = item.trim().match(/^(\d{4})\s*[:=]\s*(.+)$/);
    if (match) result[match[1]] = text(match[2]);
  });
  return Object.keys(result).length ? result : Object.assign({}, DEFAULT_PINS);
}

function loaderForPin(value) {
  const pin = text(value).replace(/\D/g, '').slice(0, 4);
  if (!/^\d{4}$/.test(pin)) return null;
  const pins = parsePins();
  return pins[pin] ? { pin, name: pins[pin] } : null;
}

function decodeSignature(dataUrl) {
  const value = text(dataUrl);
  const match = value.match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) throw Object.assign(new Error('Die digitale Unterschrift fehlt oder ist ungültig.'), { statusCode: 400, code: 'INVALID_SIGNATURE' });
  const type = match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase();
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (buffer.length < 100) throw Object.assign(new Error('Die digitale Unterschrift ist leer.'), { statusCode: 400, code: 'EMPTY_SIGNATURE' });
  if (buffer.length > 2_500_000) throw Object.assign(new Error('Die digitale Unterschrift ist zu groß.'), { statusCode: 413, code: 'SIGNATURE_TOO_LARGE' });
  return { buffer, contentType: `image/${type}`, extension: type === 'jpeg' ? 'jpg' : type };
}

async function saveSignature(token, signature) {
  const c = await container();
  const name = signatureName(token, signature.extension);
  const blob = c.getBlockBlobClient(name);
  await blob.uploadData(signature.buffer, {
    blobHTTPHeaders: { blobContentType: signature.contentType, blobCacheControl: 'no-store' }
  });
  return { blobName: name, contentType: signature.contentType, size: signature.buffer.length };
}

async function readSignature(record) {
  if (!record || !text(record.signatureBlobName)) return null;
  const c = await container();
  const blob = c.getBlockBlobClient(text(record.signatureBlobName));
  try {
    const response = await blob.download(0);
    return {
      buffer: await streamToBuffer(response.readableStreamBody),
      contentType: text(response.contentType || record.signatureContentType) || 'image/jpeg'
    };
  } catch (err) {
    if (err && (err.statusCode === 404 || err.code === 'BlobNotFound')) return null;
    throw err;
  }
}

function publicRecord(record) {
  if (!record) return null;
  const confirmed = Boolean(record.confirmedAt);
  const signatureAvailable = Boolean(record.signatureBlobName);
  return {
    ok: true,
    token: record.token,
    status: record.disabled ? 'disabled' : confirmed ? 'confirmed' : 'open',
    disabled: Boolean(record.disabled),
    used: confirmed,
    confirmed,
    confirmedAt: record.confirmedAt || null,
    pickupConfirmedAt: record.confirmedAt || null,
    pickedUpAt: record.confirmedAt || null,
    reference: record.reference || '',
    shipmentRef: record.reference || '',
    shipmentId: record.shipmentId || '',
    customer: record.customer || '',
    customerName: record.customer || '',
    recipientCustomerName: record.customer || '',
    recipient: record.recipient || '',
    address: record.address || '',
    recipientAddress: record.address || '',
    deliveryAddress: record.address || '',
    locationName: record.locationName || '',
    palletOut: Number(record.palletOut || 0),
    returnedEuroPallets: Number(record.returnedEuroPallets || 0),
    driverName: record.driverName || '',
    pickupDriverName: record.driverName || '',
    licensePlate: record.licensePlate || '',
    vehicleLicensePlate: record.licensePlate || '',
    kennzeichen: record.licensePlate || '',
    loaderName: record.loaderName || '',
    loadedBy: record.loaderName || '',
    loader: record.loaderName || '',
    verlader: record.loaderName || '',
    signatureAvailable,
    driverSignatureAvailable: signatureAvailable,
    driverSignatureUrl: signatureAvailable ? `/api/pickup-pod?token=${encodeURIComponent(record.token)}&signature=1` : '',
    pickupSignatureUrl: signatureAvailable ? `/api/pickup-pod?token=${encodeURIComponent(record.token)}&signature=1` : '',
    podType: signatureAvailable ? 'signed-loadlist' : '',
    podStatus: signatureAvailable ? 'POD vorhanden' : confirmed ? 'Unterschrift fehlt' : 'POD fehlt',
    podCount: signatureAvailable ? 1 : 0,
    podCloudBackupStatus: record.podCloudBackupStatus || '',
    podCloudBackupAt: record.podCloudBackupAt || null,
    podCloudSavedAt: record.podCloudBackupAt || null,
    podCloudBackupFileName: record.podCloudBackupFileName || '',
    podCloudBackupWebUrl: record.podCloudBackupWebUrl || '',
    podCloudBackupDriveItemId: record.podCloudBackupDriveItemId || '',
    podCloudBackupHash: record.podCloudBackupHash || '',
    podCloudBackupError: record.podCloudBackupError || '',
    podFiles: signatureAvailable ? [{
      id: `QR-POD-${record.token}`,
      name: `POD_${record.reference || record.token}_unterschrieben.pdf`,
      kind: 'signed-loadlist',
      source: 'qr-pickup',
      url: `/api/pickup-pod?token=${encodeURIComponent(record.token)}`,
      signatureUrl: `/api/pickup-pod?token=${encodeURIComponent(record.token)}&signature=1`,
      added: record.confirmedAt || ''
    }] : []
  };
}

module.exports = {
  text,
  now,
  validToken,
  json,
  error,
  readRecord,
  writeRecord,
  loaderForPin,
  decodeSignature,
  saveSignature,
  readSignature,
  publicRecord
};
