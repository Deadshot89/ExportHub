import crypto from 'node:crypto';

const TOKEN_RE = /^[a-f0-9]{48}$/i;
const PIN_RE = /^\d{6}$/;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const UPLOAD_MS = 60 * 60 * 1000;
const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function clean(value, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

function safeFileName(value) {
  return clean(value, 180).replace(/[^a-zA-Z0-9._-]+/g, '_') || 'pod.jpg';
}

function publicStatus(entity) {
  const podFiles = JSON.parse(entity.podFilesJson || '[]').map((file) => ({
    id: file.id,
    name: file.name,
    type: file.type,
    size: file.size,
    uploadedAt: file.uploadedAt,
    url: `/api/pickup-pod-file?token=${encodeURIComponent(entity.rowKey)}&file=${encodeURIComponent(file.id)}`
  }));
  return {
    token: entity.rowKey,
    status: entity.status,
    reference: entity.reference,
    customer: entity.customer,
    recipient: entity.recipient,
    confirmedAt: entity.confirmedAt || null,
    createdAt: entity.createdAt,
    expiresAt: entity.expiresAt,
    podFiles
  };
}

export function createPickupService({ repository, blobs, now = () => new Date() }) {
  async function init(input) {
    const token = clean(input.token, 80);
    const pin = clean(input.pin, 20);
    if (!TOKEN_RE.test(token) || !PIN_RE.test(pin)) {
      return { status: 400, body: { error: 'Token oder PIN ist ungültig.' } };
    }
    const existing = await repository.get(token);
    if (existing) {
      if (clean(existing.shipmentId) !== clean(input.shipmentId)) {
        return { status: 409, body: { error: 'Token ist bereits vergeben.' } };
      }
      return { status: 200, body: publicStatus(existing) };
    }
    const created = now();
    const expiresDays = Math.min(365, Math.max(1, Number(input.expiresDays) || 180));
    const entity = {
      partitionKey: 'pickup',
      rowKey: token,
      shipmentId: clean(input.shipmentId, 120),
      reference: clean(input.reference, 80),
      customer: clean(input.customer, 240),
      recipient: clean(input.recipient, 240),
      pinHash: sha256(`${token}:${pin}`),
      status: 'open',
      attempts: 0,
      createdAt: created.toISOString(),
      expiresAt: new Date(created.getTime() + expiresDays * 86400000).toISOString(),
      podFilesJson: '[]'
    };
    await repository.insert(entity);
    return { status: 201, body: publicStatus(entity) };
  }

  async function status(token) {
    if (!TOKEN_RE.test(clean(token, 80))) return { status: 404, body: { error: 'Nicht gefunden.' } };
    const entity = await repository.get(token);
    if (!entity) return { status: 404, body: { error: 'Nicht gefunden.' } };
    return { status: 200, body: publicStatus(entity) };
  }

  async function confirm(input) {
    const token = clean(input.token, 80);
    const pin = clean(input.pin, 20);
    if (!TOKEN_RE.test(token) || !PIN_RE.test(pin)) return { status: 400, body: { error: 'Ungültige Eingabe.' } };
    const entity = await repository.get(token);
    if (!entity) return { status: 404, body: { error: 'Nicht gefunden.' } };
    const current = now();
    if (entity.confirmedAt || entity.status === 'confirmed') {
      return { status: 409, body: { error: 'Bereits verwendet.', confirmedAt: entity.confirmedAt } };
    }
    if (new Date(entity.expiresAt).getTime() < current.getTime()) {
      return { status: 410, body: { error: 'QR-Code ist abgelaufen.' } };
    }
    if (entity.lockedUntil && new Date(entity.lockedUntil).getTime() > current.getTime()) {
      return { status: 423, body: { error: 'PIN vorübergehend gesperrt.', lockedUntil: entity.lockedUntil } };
    }
    if (entity.lockedUntil && new Date(entity.lockedUntil).getTime() <= current.getTime()) {
      entity.attempts = 0;
      entity.lockedUntil = '';
    }
    if (sha256(`${token}:${pin}`) !== entity.pinHash) {
      entity.attempts = Number(entity.attempts || 0) + 1;
      if (entity.attempts >= MAX_ATTEMPTS) entity.lockedUntil = new Date(current.getTime() + LOCK_MS).toISOString();
      await repository.update(entity);
      return entity.lockedUntil
        ? { status: 423, body: { error: 'Zu viele falsche Eingaben.', lockedUntil: entity.lockedUntil } }
        : { status: 401, body: { error: 'PIN ist nicht korrekt.', attemptsRemaining: MAX_ATTEMPTS - entity.attempts } };
    }
    const uploadKey = crypto.randomBytes(32).toString('hex');
    entity.status = 'confirmed';
    entity.confirmedAt = current.toISOString();
    entity.attempts = 0;
    entity.lockedUntil = '';
    entity.uploadKeyHash = sha256(`${token}:${uploadKey}`);
    entity.uploadUntil = new Date(current.getTime() + UPLOAD_MS).toISOString();
    try {
      await repository.update(entity);
    } catch (error) {
      if (error?.statusCode === 412 || error?.status === 412) {
        const latest = await repository.get(token);
        if (latest?.confirmedAt || latest?.status === 'confirmed') {
          return { status: 409, body: { error: 'Bereits verwendet.', confirmedAt: latest.confirmedAt } };
        }
      }
      throw error;
    }
    return { status: 200, body: { ...publicStatus(entity), uploadKey, uploadUntil: entity.uploadUntil } };
  }

  async function upload(input) {
    const token = clean(input.token, 80);
    const uploadKey = clean(input.uploadKey, 128);
    const images = Array.isArray(input.images) ? input.images.slice(0, MAX_IMAGES) : [];
    if (!TOKEN_RE.test(token) || !uploadKey || !images.length) return { status: 400, body: { error: 'Ungültiger Upload.' } };
    const entity = await repository.get(token);
    if (!entity || entity.status !== 'confirmed') return { status: 404, body: { error: 'Nicht gefunden.' } };
    const current = now();
    if (!entity.uploadUntil || new Date(entity.uploadUntil).getTime() < current.getTime() || sha256(`${token}:${uploadKey}`) !== entity.uploadKeyHash) {
      return { status: 401, body: { error: 'Upload-Sitzung ist ungültig oder abgelaufen.' } };
    }
    let total = 0;
    const decoded = images.map((image) => {
      const type = clean(image.type, 100);
      if (!/^image\/(jpeg|png|webp)$/i.test(type)) throw Object.assign(new Error('Nur Bilddateien sind erlaubt.'), { status: 415 });
      const buffer = Buffer.from(clean(image.dataBase64, 8_000_000), 'base64');
      if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw Object.assign(new Error('Bild ist zu groß.'), { status: 413 });
      total += buffer.length;
      return { buffer, type, name: safeFileName(image.name) };
    });
    if (total > MAX_TOTAL_BYTES) return { status: 413, body: { error: 'Gesamtgröße der Bilder ist zu groß.' } };
    const files = JSON.parse(entity.podFilesJson || '[]');
    for (const image of decoded) {
      const id = crypto.randomBytes(12).toString('hex');
      const blobName = `${token}/${id}-${image.name}`;
      await blobs.put(blobName, image.buffer, image.type);
      files.push({ id, blobName, name: image.name, type: image.type, size: image.buffer.length, uploadedAt: current.toISOString() });
    }
    entity.podFilesJson = JSON.stringify(files);
    entity.podStatus = 'POD vorhanden';
    await repository.update(entity);
    return { status: 200, body: publicStatus(entity) };
  }

  async function podFile(token, fileId) {
    const entity = await repository.get(clean(token, 80));
    if (!entity || entity.status !== 'confirmed') return { status: 404, body: { error: 'Nicht gefunden.' } };
    const file = JSON.parse(entity.podFilesJson || '[]').find((item) => item.id === clean(fileId, 80));
    if (!file) return { status: 404, body: { error: 'Nicht gefunden.' } };
    const result = await blobs.get(file.blobName);
    return { status: 200, body: result.data, headers: { 'Content-Type': file.type, 'Cache-Control': 'private, max-age=300', 'Content-Disposition': `inline; filename="${safeFileName(file.name)}"` } };
  }

  return { init, status, confirm, upload, podFile };
}

export class MemoryRepository {
  constructor() { this.items = new Map(); }
  async get(token) { const value = this.items.get(token); return value ? structuredClone(value) : null; }
  async insert(entity) { if (this.items.has(entity.rowKey)) throw new Error('exists'); this.items.set(entity.rowKey, structuredClone(entity)); }
  async update(entity) { this.items.set(entity.rowKey, structuredClone(entity)); }
}

export class MemoryBlobStore {
  constructor() { this.items = new Map(); }
  async put(name, data, type) { this.items.set(name, { data: Buffer.from(data), type }); }
  async get(name) { const item = this.items.get(name); if (!item) throw new Error('not found'); return item; }
}
