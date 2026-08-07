'use strict';
const https = require('https');
const http = require('http');
const pins = require('../shared/loader-pin-store');

function json(status, body) { return { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate', 'X-Content-Type-Options': 'nosniff' }, body: JSON.stringify(body) }; }
function header(req, name) { const h = req && req.headers || {}; return h[name.toLowerCase()] || h[name] || ''; }
function token(req, body) { const auth = String(header(req, 'authorization') || '').replace(/^Bearer\s+/i, ''); return pins.text(header(req, 'x-exporthub-token') || header(req, 'x-exporthub-session') || body.sessionToken || body.authToken || auth); }
function origin(req) { const host = header(req, 'x-forwarded-host') || header(req, 'host'); const proto = header(req, 'x-forwarded-proto') || (/localhost|127\.0\.0\.1/.test(host) ? 'http' : 'https'); if (!host) throw pins.error('HOST_MISSING', 'Serveradresse konnte nicht ermittelt werden.', 500); return proto + '://' + host; }
function request(url, options, body) { if (typeof fetch === 'function') return fetch(url, Object.assign({}, options, { body })).then(async r => ({ status: r.status, ok: r.ok, text: await r.text() })); return new Promise((resolve, reject) => { const u = new URL(url), lib = u.protocol === 'http:' ? http : https, req = lib.request({ method: options.method || 'POST', hostname: u.hostname, port: u.port || undefined, path: u.pathname + u.search, headers: options.headers || {} }, res => { const chunks = []; res.on('data', c => chunks.push(Buffer.from(c))); res.on('end', () => resolve({ status: res.statusCode || 500, ok: (res.statusCode || 500) < 400, text: Buffer.concat(chunks).toString('utf8') })); }); req.on('error', reject); if (body) req.write(body); req.end(); }); }
async function requireGlobalAdmin(req, body) {
  const t = token(req, body); if (!t) throw pins.error('AUTH_REQUIRED', 'ExportHUB-Admin-Anmeldung erforderlich.', 401);
  const payload = JSON.stringify({ action: 'admin-list', sessionToken: t, authToken: t });
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-ExportHUB-Token': t, 'X-ExportHUB-Session': t, 'Authorization': 'Bearer ' + t };
  for (const name of ['cookie', 'x-ms-client-principal']) { const v = header(req, name); if (v) headers[name] = v; }
  const res = await request(origin(req) + '/api/exporthub-auth', { method: 'POST', headers }, payload);
  let data = {}; try { data = res.text ? JSON.parse(res.text) : {}; } catch (_) {}
  if (!res.ok || data.ok === false) throw pins.error('GLOBAL_ADMIN_REQUIRED', data.message || 'Nur globale Administratoren dürfen Verlader-PINs verwalten.', res.status === 401 ? 401 : 403);
  return true;
}

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') { context.res = { status: 204, headers: { 'Cache-Control': 'no-store', 'Allow': 'POST, OPTIONS' }, body: '' }; return; }
  if (req.method !== 'POST') { context.res = json(405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Nur POST ist erlaubt.' }); return; }
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    await requireGlobalAdmin(req, body);
    const action = pins.text(body.action || 'list').toLowerCase();
    let list;
    if (action === 'list') list = await pins.list();
    else if (action === 'create') list = await pins.create(body);
    else if (action === 'update') list = await pins.update(body);
    else if (action === 'toggle') list = await pins.toggle(body);
    else if (action === 'delete') list = await pins.remove(body);
    else throw pins.error('INVALID_ACTION', 'Unbekannte PIN-Aktion.', 400);
    context.res = json(200, { ok: true, pins: list, count: list.length, serverStored: true, version: 'RC500' });
  } catch (e) {
    context.log.error('loader-pins-admin', e && e.code, e && e.message);
    context.res = json(e.status || 500, { ok: false, code: e.code || 'SERVER_ERROR', message: e.message || 'Verlader-PINs konnten nicht verwaltet werden.' });
  }
};
