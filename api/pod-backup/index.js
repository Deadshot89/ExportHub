'use strict';
const https = require('https');
const crypto = require('crypto');
const store = require('../shared/pickup-store');

function text(v) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
}
function json(status, body) {
  return store.json ? store.json(status, body) : {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body)
  };
}
function request(url, opt, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const r = https.request({
      method: opt.method || 'GET',
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: opt.headers || {}
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(Buffer.from(c)));
      res.on('end', () => resolve({ status: res.statusCode || 500, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    r.on('error', reject);
    r.setTimeout(60000, () => r.destroy(new Error('GRAPH_TIMEOUT')));
    if (body) r.write(body);
    r.end();
  });
}
async function token() {
  const tenant = text(process.env.EXPORTHUB_GRAPH_TENANT_ID);
  const client = text(process.env.EXPORTHUB_GRAPH_CLIENT_ID);
  const secret = text(process.env.EXPORTHUB_GRAPH_CLIENT_SECRET);
  if (!tenant || !client || !secret) {
    const e = new Error('Microsoft-Graph-Zugangsdaten für die POD-Sicherung sind nicht vollständig konfiguriert.');
    e.code = 'GRAPH_NOT_CONFIGURED';
    e.status = 503;
    throw e;
  }
  const form = new URLSearchParams({
    client_id: client,
    client_secret: secret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  }).toString();
  const r = await request(
    'https://login.microsoftonline.com/' + encodeURIComponent(tenant) + '/oauth2/v2.0/token',
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(form) } },
    Buffer.from(form)
  );
  let d = {};
  try { d = JSON.parse(r.body.toString('utf8')); } catch (_) {}
  if (r.status < 200 || r.status >= 300 || !d.access_token) {
    const e = new Error(d.error_description || d.error || ('Microsoft-Graph-Anmeldung HTTP ' + r.status));
    e.code = 'GRAPH_AUTH_FAILED';
    e.status = 502;
    throw e;
  }
  return d.access_token;
}
function safeName(v) {
  return (text(v) || 'POD.pdf').replace(/[\\/:*?"<>|#%]/g, '_').replace(/\s+/g, ' ').slice(0, 150);
}
function encodedPath(folder, name) {
  return String(folder || '').split('/').filter(Boolean).map(encodeURIComponent).concat([encodeURIComponent(name)]).join('/');
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
    const b = req.body && typeof req.body === 'object' ? req.body : {};
    const pickupToken = text(b.token).toLowerCase();
    if (!store.validToken(pickupToken)) throw store.err('INVALID_TOKEN', 'Ungültiger QR-/POD-Token.', 400);
    const got = await store.getRecord(pickupToken);
    const rec = got.record || {};
    if (!rec.confirmedAt) throw store.err('PICKUP_NOT_CONFIRMED', 'Die Abholung ist serverseitig noch nicht bestätigt.', 409);
    if (!rec.signatureBlobName) throw store.err('SIGNATURE_NOT_FOUND', 'Es ist keine echte Fahrerunterschrift für die POD-Sicherung gespeichert.', 409);
    const reference = text(b.reference).toUpperCase();
    if (reference && text(rec.reference).toUpperCase() && reference !== text(rec.reference).toUpperCase()) {
      throw store.err('REFERENCE_MISMATCH', 'Referenz stimmt nicht mit dem bestätigten Abholdatensatz überein.', 409);
    }
    const raw = String(b.pdfBase64 || '').replace(/\s+/g, '');
    if (!raw) throw store.err('PDF_REQUIRED', 'POD-PDF fehlt.', 400);
    let pdf;
    try { pdf = Buffer.from(raw, 'base64'); } catch (_) { throw store.err('PDF_INVALID', 'POD-PDF ist ungültig.', 400); }
    if (pdf.length < 1000 || pdf.slice(0, 5).toString('ascii') !== '%PDF-') throw store.err('PDF_INVALID', 'Nur ein vollständiges PDF kann gesichert werden.', 400);
    if (pdf.length > 20 * 1024 * 1024) throw store.err('PDF_TOO_LARGE', 'POD-PDF ist größer als 20 MB.', 413);

    // RC929: gleiche Standard-Zielablage wie der vorhandene zentrale Graph-Drive-Helfer.
    // Die App-Setting-Variable bleibt vorrangig; fehlt sie, bricht die POD-Sicherung nicht mehr allein deshalb ab.
    const driveUser = text(process.env.EXPORTHUB_POD_DRIVE_USER) || 'tobiaslimberg@essentra.com';
    const folder = text(process.env.EXPORTHUB_POD_FOLDER || '003 Export/ExportHub/Abliefernachweise');
    const fileName = safeName(b.fileName || ('POD_' + (reference || text(rec.reference) || 'Sendung') + '_Ladeliste_mit_Unterschrift.pdf'));
    const access = await token();
    const url = 'https://graph.microsoft.com/v1.0/users/' + encodeURIComponent(driveUser) + '/drive/root:/' + encodedPath(folder, fileName) + ':/content';
    const r = await request(url, {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + access, 'Content-Type': 'application/pdf', 'Content-Length': pdf.length }
    }, pdf);
    let d = {};
    try { d = JSON.parse(r.body.toString('utf8')); } catch (_) {}
    if (r.status < 200 || r.status >= 300) {
      const detail = d && d.error && (d.error.message || d.error.code);
      const e = new Error(detail || ('Microsoft-Graph-Dateiupload HTTP ' + r.status));
      e.code = 'GRAPH_UPLOAD_FAILED';
      e.status = 502;
      throw e;
    }
    context.res = json(200, {
      ok: true,
      saved: true,
      savedAt: new Date().toISOString(),
      fileName: d.name || fileName,
      webUrl: d.webUrl || '',
      driveItemId: d.id || '',
      hash: crypto.createHash('sha256').update(pdf).digest('hex'),
      version: 'RC929'
    });
  } catch (e) {
    context.log && context.log.error && context.log.error('pod-backup RC929', e && e.code, e && e.message);
    context.res = json(e.status || e.statusCode || 500, { ok: false, code: e.code || 'SERVER_ERROR', message: e.message || 'POD-Sicherung ist fehlgeschlagen.' });
  }
};
