'use strict';

function failure(code, message, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status || 400;
  return error;
}

function positiveInt(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

/**
 * Creates an idempotent, versioned pickup credential registration.
 * A registered PIN cannot silently change. Rotation must be explicit and
 * must reference the current credential version.
 */
function prepareRegistration(existing, input, helpers) {
  const old = existing && typeof existing === 'object' ? existing : null;
  const hash = helpers && helpers.hash;
  const now = helpers && helpers.now;
  if (typeof hash !== 'function' || typeof now !== 'function') {
    throw failure('REGISTRATION_CONFIG', 'QR-Registrierung ist nicht vollständig konfiguriert.', 500);
  }

  const pinHash = hash(input.pin);
  const currentVersion = positiveInt(old && old.credentialVersion, old ? 1 : 0);
  const currentRevision = positiveInt(old && old.pinRevision, old ? 1 : 0);
  const alreadyConfirmed = Boolean(old && old.confirmedAt);
  const hasCredential = Boolean(old && old.pinHash);
  const samePin = hasCredential && old.pinHash === pinHash;
  const rotate = input.rotate === true;
  const expectedVersion = Number(input.expectedCredentialVersion || 0);

  if (alreadyConfirmed && hasCredential && !samePin) {
    throw failure('ALREADY_CONFIRMED', 'Die Abholung wurde bereits bestätigt; die PIN kann nicht mehr geändert werden.', 409);
  }

  if (hasCredential && !samePin) {
    if (!rotate) {
      throw failure('PIN_CONFLICT', 'Die sichtbare PIN stimmt nicht mit der bereits registrierten PIN überein.', 409);
    }
    if (!Number.isInteger(expectedVersion) || expectedVersion !== currentVersion) {
      throw failure('CREDENTIAL_VERSION_CONFLICT', 'Die QR-Zugangsdaten wurden zwischenzeitlich geändert. Bitte Status neu laden.', 409);
    }
  }

  const rotated = Boolean(hasCredential && !samePin);
  const idempotent = Boolean(hasCredential && samePin);
  const credentialVersion = rotated ? currentVersion + 1 : (currentVersion || 1);
  const pinRevision = rotated ? currentRevision + 1 : (currentRevision || 1);
  const stamp = now();
  const days = Math.min(365, Math.max(1, Number(input.expiresDays || 180)));
  const createdAt = old && old.createdAt || stamp;

  const record = Object.assign({}, old || {}, {
    token: input.token,
    shipmentId: String(input.shipmentId || ''),
    reference: String(input.reference || ''),
    customer: String(input.customer || ''),
    recipient: String(input.recipient || ''),
    pinHash: alreadyConfirmed && old ? old.pinHash : pinHash,
    pinLocked: true,
    credentialVersion,
    pinRevision,
    status: alreadyConfirmed ? 'confirmed' : 'open',
    createdAt,
    updatedAt: stamp,
    expiresAt: alreadyConfirmed && old ? old.expiresAt : new Date(Date.now() + days * 86400000).toISOString(),
    confirmedAt: old && old.confirmedAt || null,
    failedAttempts: old && old.failedAttempts || 0,
    lockedUntil: old && old.lockedUntil || null,
    podFiles: Array.isArray(old && old.podFiles) ? old.podFiles : []
  });

  return { record, idempotent, rotated, credentialVersion, pinRevision };
}

module.exports = { prepareRegistration };
