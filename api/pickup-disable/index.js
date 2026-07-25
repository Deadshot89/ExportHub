'use strict';

const store = require('../shared/pickup-store');
const auth = require('../shared/auth-store');

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
    const session = await auth.validateSession(req);
    if (!auth.hasAnyEditRight(session.user)) {
      throw auth.error('WRITE_FORBIDDEN', 'Für das Deaktivieren fehlen Bearbeitungsrechte.', 403);
    }
    const b = store.body(req);
    const token = String(b.token || '').toLowerCase();
    if (!store.validToken(token)) {
      throw store.err('INVALID_TOKEN', 'Ungültiges QR-Token.', 400);
    }
    const reason = String(b.reason || 'manual').slice(0, 200);

    const rec = await store.mutateRecord(token, async function (r) {
      if (r.status === 'disabled') {
        throw store.err('ALREADY_DISABLED', 'QR-Code ist bereits deaktiviert.', 409);
      }
      r.status = 'disabled';
      r.disabledAt = store.now();
      r.disabledBy = session.user.name || session.user.user;
      r.disabledByUserId = session.user.id;
      r.disableReason = reason;
      r.updatedAt = store.now();
      return r;
    });

    context.res = store.json(200, Object.assign(store.publicRecord(rec), {
      disabled: true,
      disabledAt: rec.disabledAt,
      disabledBy: rec.disabledBy
    }));
  } catch (e) {
    context.log.error('pickup-disable error', e && e.code, e && e.message);
    context.res = store.json(e.status || 500, {
      ok: false,
      code: e.code || 'SERVER_ERROR',
      message: e.message || 'Deaktivieren fehlgeschlagen.'
    });
  }
};
