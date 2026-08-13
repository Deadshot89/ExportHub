'use strict';
const pins = require('../shared/loader-pin-store');
const confirmPickup = require('../pickup-confirm/index');
function json(status, body) { return { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate', 'X-Content-Type-Options': 'nosniff' }, body: JSON.stringify(body) }; }
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
    Object.assign(body,{pin:bridge,loaderPin:bridge,personalLoaderPin:bridge,loaderName:loader.name,loadedBy:loader.name,loader:loader.name,verlader:loader.name,pickupLoaderName:loader.name,pickupConfirmedByLoader:loader.name,loaderId:loader.id});
    const innerContext = { log: context.log || console, res: null };
    const innerReq = Object.assign({}, req, { method: 'POST', body });
    await confirmPickup(innerContext, innerReq);
    const result = innerContext.res || json(500,{ok:false,code:'CONFIRM_NO_RESPONSE',message:'Abholung lieferte keine Serverantwort.'});
    if (Number(result.status||500) >= 400) { context.res = result; return; }
    let data={}; try { data = typeof result.body==='string' ? JSON.parse(result.body||'{}') : (result.body||{}); } catch (_) { data={ok:true}; }
    try { await pins.patchPickupIdentity(body.token, loader); } catch (e) { if(context.log&&context.log.warn)context.log.warn('loader identity patch failed', e && e.message); }
    Object.assign(data,{loaderName:loader.name,loadedBy:loader.name,loader:loader.name,verlader:loader.name,loaderId:loader.id,personalPinValidated:true,version:'RC644'});
    context.res = json(Number(result.status||200), data);
  } catch (e) {
    if(context.log&&context.log.error)context.log.error('pickup-confirm-v2 RC644', e && e.code, e && e.message);
    context.res = json(e.status || e.statusCode || 500, { ok: false, code: e.code || 'SERVER_ERROR', message: e.message || 'Abholung konnte nicht bestätigt werden.' });
  }
};
