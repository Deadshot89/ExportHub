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

    const existing = await store.readRecord(token);
    const timestamp = store.now();
    const record = Object.assign({}, existing || {}, {
      token,
      reference: store.text(body.reference || body.shipmentRef || (existing && existing.reference)),
      shipmentId: store.text(body.shipmentId || (existing && existing.shipmentId)),
      customer: store.text(body.customerName || body.customer || body.recipientCustomerName || (existing && existing.customer)),
      recipient: store.text(body.recipient || body.recipientName || (existing && existing.recipient)),
      address: store.text(body.recipientAddress || body.deliveryAddress || body.shipToAddress || body.address || (existing && existing.address)),
      locationName: store.text(body.locationName || (existing && existing.locationName)),
      palletOut: Math.max(0, Number(body.palletOut || body.euroPallets || (existing && existing.palletOut) || 0) || 0),
      disabled: Boolean(body.disabled === true || body.active === false || (existing && existing.disabled)),
      createdAt: (existing && existing.createdAt) || timestamp,
      updatedAt: timestamp,
      expiresAt: (existing && existing.expiresAt) || new Date(Date.now() + 180 * 86400000).toISOString(),
      registrationVersion: 'RC470'
    });

    await store.writeRecord(token, record);
    context.res = store.json(200, Object.assign({ registered: true }, store.publicRecord(record)));
  } catch (err) {
    context.log.error('pickup-init', err);
    context.res = store.error(err.statusCode || 500, err.code || 'INIT_FAILED', err.message || 'QR-Code konnte nicht registriert werden.');
  }
};
