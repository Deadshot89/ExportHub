'use strict';
const https = require('https');
const http = require('http');
const pins = require('../shared/loader-pin-store');

function json(status, body) { return { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate', 'X-Content-Type-Options': 'nosniff' }, body: JSON.stringify(body) }; }
function header(req, name) { const h = req && req.headers || {}; return h[name.toLowerCase()] || h[name] || ''; }
function origin(req) { const host = header(req, 'x-forwarded-host') || header(req, 'host'); const proto = header(req, 'x-forwarded-proto') || (/localhost|127\.0\.0\.1/.test(host) ? 'http' : 'https'); if (!host) throw pins.error('HOST_MISSING', 'Serveradresse konnte nicht ermittelt werden.', 500); return proto + '://' + host; }
function proxy(url, headers, raw) { if (typeof fetch === 'function') return fetch(url, { method: 'POST', cache: 'no-store', headers, body: raw }).then(async r => ({ status: r.status, ok: r.ok, text: await r.text(), contentType: r.headers.get('content-type') || 'application/json; charset=utf-8' })); return new Promise((resolve, reject) => { const u = new URL(url), lib = u.protocol === 'http:' ? http : https, r = lib.request({ method: 'POST', hostname: u.hostname, port: u.port || undefined, path: u.pathname + u.search, headers }, res => { const chunks = []; res.on('data', c => chunks.push(Buffer.from(c))); res.on('end', () => resolve({ status: res.statusCode || 500, ok: (res.statusCode || 500) < 400, text: Buffer.concat(chunks).toString('utf8'), contentType: res.headers['content-type'] || 'application/json; charset=utf-8' })); }); r.on('error', reject); r.write(raw); r.end(); }); }

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') { context.res = { status: 204, headers: { 'Cache-Control': 'no-store', 'Allow': 'POST, OPTIONS' }, body: '' }; return; }
  if (req.method !== 'POST') { context.res = json(405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Nur POST ist erlaubt.' }); return; }
  try {
    const body = req.body && typeof req.body === 'object' ? Object.assign({}, req.body) : {};
    const personalPin = pins.text(body.pin || body.loaderPin || body.personalLoaderPin);
    if (!pins.validPin(personalPin)) throw pins.error('INVALID_PIN', 'Bitte die vierstellige persönliche Verlader-PIN eingeben.', 400);
    const loader = await pins.findByPin(personalPin);
    if (!loader) throw pins.error('INVALID_PIN', 'Verlader-PIN ist nicht korrekt oder deaktiviert.', 401);

    const bridge = pins.bridgePin();
    body.pin = bridge;
    body.loaderPin = bridge;
    body.personalLoaderPin = bridge;
    body.loaderName = loader.name;
    body.loadedBy = loader.name;
    body.loader = loader.name;
    body.verlader = loader.name;
    body.pickupLoaderName = loader.name;
    body.pickupConfirmedByLoader = loader.name;
    body.loaderId = loader.id;

    const raw = JSON.stringify(body);
    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    for (const name of ['cookie', 'x-ms-client-principal']) { const v = header(req, name); if (v) headers[name] = v; }
    const res = await proxy(origin(req) + '/api/pickup-confirm', headers, raw);
    let data = null; try { data = res.text ? JSON.parse(res.text) : {}; } catch (_) {}
    if (!res.ok) {
      context.res = { status: res.status, headers: { 'Content-Type': res.contentType, 'Cache-Control': 'no-store' }, body: res.text };
      return;
    }

    try { await pins.patchPickupIdentity(body.token, loader); } catch (e) { context.log.warn('loader identity patch failed', e && e.message); }
    if (data && typeof data === 'object') {
      data.loaderName = loader.name; data.loadedBy = loader.name; data.loader = loader.name; data.verlader = loader.name; data.loaderId = loader.id; data.personalPinValidated = true; data.version = 'RC500';
      context.res = json(res.status || 200, data);
    } else {
      context.res = { status: res.status || 200, headers: { 'Content-Type': res.contentType, 'Cache-Control': 'no-store' }, body: res.text };
    }
  } catch (e) {
    context.log.error('pickup-confirm-v2', e && e.code, e && e.message);
    context.res = json(e.status || 500, { ok: false, code: e.code || 'SERVER_ERROR', message: e.message || 'Abholung konnte nicht bestätigt werden.' });
  }
};
