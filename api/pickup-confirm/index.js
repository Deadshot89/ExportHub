'use strict';

const crypto = require('crypto');
const store = require('../shared/pickup-store');

function parseDataUrl(dataUrl) {
  // Konvertiert data:image/png;base64,XXXX → Buffer
  const m = String(dataUrl || '').match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
  if (!m) return null;
  try { return { bytes: Buffer.from(m[2], 'base64'), contentType: 'image/' + (m[1].toLowerCase() === 'jpg' ? 'jpeg' : m[1].toLowerCase()) }; }
  catch (_) { return null; }
}

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: { 'Cache-Control': 'no-store' }, body: '' };
    return;
  }
  if (req.method !== 'POST') {
    context.res = store.json(405, { ok: false, code: 'METHOD_NOT_ALLOWED' }, { Allow: 'POST, OPTIONS' });
    return;
  }
  try {
    const b = store.body(req);
    const token = String(b.token || '').toLowerCase();
    const pin = String(b.pin || '');
    const returned = Math.max(0, Math.round(Number(b.palletReturned || 0)));
    const signatureData = b.signature || b.signatureData || b.signatureDataUrl || b.driverSignature || null;

    if (!/^\d{4}$/.test(pin)) throw store.err('INVALID_PIN', 'Bitte die vierstellige PIN eingeben.', 400);
    if (!Number.isFinite(returned) || returned < 0) throw store.err('INVALID_PALLET_RETURN', 'Die Rückgabemenge ist ungültig.', 400);
    if (!store.validToken(token)) throw store.err('INVALID_TOKEN', 'Ungültiges QR-Token.', 400);

    const activePin = await store.globalPin();
    let signatureBlobName = '';

    const rec = await store.mutateRecord(token, async function (r) {
      if (store.expired(r) && !r.confirmedAt) throw store.err('EXPIRED', 'QR-Code ist abgelaufen.', 410);
      if (r.confirmedAt) throw store.err('ALREADY_CONFIRMED', 'Abholung wurde bereits bestätigt.', 409);
      if (r.lockedUntil && Date.now() < Date.parse(r.lockedUntil)) throw store.err('LOCKED', 'Zu viele falsche Eingaben.', 423);

      if (!store.safeEqualHex(store.hash(activePin), store.hash(pin))) {
        r.failedAttempts = Number(r.failedAttempts || 0) + 1;
        r.updatedAt = store.now();
        if (r.failedAttempts >= 5) r.lockedUntil = new Date(Date.now() + 15 * 60000).toISOString();
        const e = store.err(r.failedAttempts >= 5 ? 'LOCKED' : 'INVALID_PIN',
          r.failedAttempts >= 5 ? 'Zu viele falsche Eingaben.' : 'PIN ist nicht korrekt.',
          r.failedAttempts >= 5 ? 423 : 401);
        e.recordToSave = r;
        throw e;
      }

      const iso = store.now();

      // Unterschrift als Blob speichern, falls vorhanden
      if (signatureData) {
        const parsed = parseDataUrl(signatureData);
        if (parsed) {
          signatureBlobName = store.signatureBlobName(token);
          await store.uploadBytes(signatureBlobName, parsed.bytes, parsed.contentType);
          r.signatureBlobName = signatureBlobName;
          r.signatureContentType = parsed.contentType;
          r.signatureUploadedAt = iso;
        }
      }

      r.status = 'confirmed';
      r.confirmedAt = iso;
      r.updatedAt = iso;
      r.failedAttempts = 0;
      r.lockedUntil = null;
      r.palletReturned = returned;
      return r;
    }).catch(async function (e) {
      if (e.recordToSave) {
        try { await store.mutateRecord(token, async () => e.recordToSave); } catch (_) {}
      }
      throw e;
    });

    const scanPod = await store.createConfirmationPod(rec);

    try { await store.updateTeam(rec, [scanPod]); } catch (e) { context.log.error('Team state update failed', e); }

    context.res = store.json(200, Object.assign(store.publicRecord(rec), {
      ok: true,
      status: 'confirmed',
      confirmedAt: rec.confirmedAt,
      signatureStored: !!signatureBlobName,
      signatureBlobName: signatureBlobName || null,
      podCount: Array.isArray(rec.podFiles) ? rec.podFiles.filter(function (x) { return x.kind !== 'scan-confirmation'; }).length : 0,
      scanConfirmation: true,
      palletOut: Math.max(0, Number(rec.palletOut || 0)),
      palletReturned: Math.max(0, Number(rec.palletReturned || 0))
    }));
  } catch (e) {
    context.log.error('pickup-confirm error', e && e.code, e && e.message);
    context.res = store.json(e.status || 500, {
      ok: false,
      code: e.code || 'SERVER_ERROR',
      message: e.message || 'Bestätigung fehlgeschlagen.'
    });
  }
};
