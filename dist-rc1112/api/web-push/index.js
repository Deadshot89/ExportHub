'use strict';

// Web Push for phones and desktops: a device subscribes once while logged in; afterwards the
// server sends task reminders and new pack notifications to it, with the browser closed and
// without a website login. The reminder schedule runs in the GitHub workflow
// web-push-reminders.yml (GitHub OIDC, no extra secret), the same way as the state backups.
//
// Actions (POST): config, subscribe, status, update, unsubscribe, resubscribe, test, dispatch-reminders.
// Only subscribe and test need a session; status/update/unsubscribe/resubscribe prove the device
// by its secret endpoint URL, so a device can be switched off without logging in.

const auth = require('../shared/auth-store');
const { isAdmin } = require('../shared/user-policy');
const webPush = require('../shared/web-push');
const storeLib = require('../shared/web-push-store');
const reminders = require('../shared/web-push-reminders');
const { helpers } = require('../diagnostic-autofix/index.js');

const WORKFLOW = process.env.EXPORTHUB_WEB_PUSH_WORKFLOW || 'web-push-reminders.yml';
const OIDC_AUDIENCE = 'exporthub-web-push';
const SUBJECT = process.env.EXPORTHUB_WEB_PUSH_SUBJECT || 'https://www.exporthub360.de';
const SEND_CONCURRENCY = 8;

function text(v) { return String(v == null ? '' : v).trim(); }
function lower(v) { return text(v).toLowerCase(); }
function json(status, body) { return { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, body: JSON.stringify(body) }; }
function error(code, message, status = 400) { const e = new Error(message); e.code = code; e.status = status; return e; }
function body(req) { if (req && req.body && typeof req.body === 'object') return req.body; try { return JSON.parse(req && req.body || '{}'); } catch (_) { return {}; } }
function enabled() { return !/^(0|false|no|off)$/i.test(text(process.env.EXPORTHUB_WEB_PUSH_ENABLED)); }
function packAllowed(user) { return isAdmin(user) || auth.hasAnyEditRight(user); }
function endpointOf(payload) { return text(payload && (payload.endpoint || payload.subscription && payload.subscription.endpoint)); }

function defaultDeps() {
  const container = () => helpers.service().getContainerClient(helpers.TEAM_CONTAINER);
  return {
    store: storeLib.createStore({ container, readJson: helpers.readJson, uploadJson: helpers.uploadJson }),
    validateSession: (req) => auth.validateSession(req),
    readTeam: async (environment) => {
      const c = await auth.clientsForEnvironment(environment);
      const r = await auth.readJson(c.team, auth.emptyTeam());
      return r.value && typeof r.value === 'object' ? r.value : {};
    },
    oidcAuthorized: (req) => helpers.githubOidcAuthorized(req, WORKFLOW, ['schedule', 'workflow_dispatch'], OIDC_AUDIENCE),
    send: webPush.sendNotification,
    now: () => new Date()
  };
}

async function sendAll(deps, jobs, vapid) {
  const results = [];
  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const job = jobs[next++];
      const r = await deps.send(job.subscription, job.payload, { vapid, subject: SUBJECT, ttl: job.ttl, urgency: job.urgency, topic: job.topic });
      results.push(Object.assign({ id: job.subscription.id, messageIndex: job.messageIndex }, r));
    }
  }
  await Promise.all(Array.from({ length: Math.min(SEND_CONCURRENCY, jobs.length) }, worker));
  return results;
}

function createHandler(overrides = {}) {
  let base = null;
  const deps = () => base || (base = Object.assign(defaultDeps(), overrides));

  async function config(env) {
    const vapid = await deps().store.vapid();
    return { ok: true, enabled: enabled(), environment: env, publicKey: vapid.publicKey };
  }
  async function subscribe(req, payload, env) {
    const { user } = await deps().validateSession(req);
    const nowIso = deps().now().toISOString();
    const record = await deps().store.mutate(env, (doc) => storeLib.upsertSubscription(doc, { subscription: payload.subscription, user, categories: payload.categories, deviceLabel: payload.deviceLabel, language: payload.language, packAllowed: packAllowed(user) }, nowIso));
    return { ok: true, subscribed: true, subscription: storeLib.publicSubscription(record) };
  }
  async function status(payload, env) {
    const endpoint = endpointOf(payload);
    if (!endpoint) return { ok: true, subscribed: false };
    const doc = await deps().store.read(env), hit = storeLib.findByEndpoint(doc, endpoint);
    return { ok: true, subscribed: !!hit, subscription: storeLib.publicSubscription(hit) };
  }
  async function update(payload, env) {
    const endpoint = endpointOf(payload);
    const result = await deps().store.mutate(env, (doc) => {
      const hit = storeLib.findByEndpoint(doc, endpoint);
      if (!hit) throw error('WEB_PUSH_NOT_SUBSCRIBED', 'Dieses Gerät ist nicht angemeldet.', 404);
      for (const key of storeLib.CATEGORIES) if (payload.categories && payload.categories[key] !== undefined) hit.categories[key] = payload.categories[key] !== false;
      hit.updatedAt = deps().now().toISOString();
      return hit;
    });
    return { ok: true, subscribed: true, subscription: storeLib.publicSubscription(result) };
  }
  async function unsubscribe(payload, env) {
    const endpoint = endpointOf(payload);
    if (!endpoint) throw error('WEB_PUSH_ENDPOINT_REQUIRED', 'Gerät fehlt.', 400);
    const removed = await deps().store.mutate(env, (doc) => { const r = storeLib.removeByEndpoint(doc, endpoint); return r ? { removed: true } : { removed: false, unchanged: true }; });
    return { ok: true, subscribed: false, removed: removed.removed === true };
  }
  // Browsers rotate subscriptions (pushsubscriptionchange); the service worker re-registers the
  // new endpoint without a login because it knows the old one.
  async function resubscribe(payload, env) {
    const oldEndpoint = text(payload.oldEndpoint);
    const next = webPush.normalizeSubscription(payload.subscription);
    const nowIso = deps().now().toISOString();
    const record = await deps().store.mutate(env, (doc) => {
      const old = storeLib.findByEndpoint(doc, oldEndpoint);
      if (!old) throw error('WEB_PUSH_NOT_SUBSCRIBED', 'Dieses Gerät ist nicht angemeldet.', 404);
      storeLib.removeByEndpoint(doc, oldEndpoint);
      return storeLib.upsertSubscription(doc, { subscription: next, user: { id: old.userId, username: old.username, name: old.displayName }, categories: old.categories, deviceLabel: old.deviceLabel, language: old.language, packAllowed: old.packAllowed === true }, nowIso);
    });
    return { ok: true, subscribed: true, subscription: storeLib.publicSubscription(record) };
  }
  async function test(req, payload, env) {
    const { user } = await deps().validateSession(req);
    const doc = await deps().store.read(env), hit = storeLib.findByEndpoint(doc, endpointOf(payload));
    if (!hit || hit.userId !== text(user.id)) throw error('WEB_PUSH_NOT_SUBSCRIBED', 'Dieses Gerät ist nicht angemeldet.', 404);
    const vapid = await deps().store.vapid();
    const results = await sendAll(deps(), [{ subscription: hit, payload: reminders.testPayload(env, deps().now().toISOString(), hit.language), ttl: 600, urgency: 'high' }], vapid);
    await deps().store.mutate(env, (d) => { storeLib.recordResults(d, results, deps().now().toISOString()); });
    const r = results[0] || {};
    if (!r.ok) throw error(r.gone ? 'WEB_PUSH_GONE' : 'WEB_PUSH_SEND_FAILED', r.gone ? 'Das Gerät ist beim Push-Dienst nicht mehr angemeldet. Bitte erneut aktivieren.' : 'Der Push-Dienst hat die Testnachricht nicht angenommen (' + (r.status || r.detail || 'keine Antwort') + ').', r.gone ? 410 : 502);
    return { ok: true, sent: true };
  }
  async function dispatchReminders(req, env) {
    if (!(await deps().oidcAuthorized(req))) throw error('WEB_PUSH_DISPATCH_UNAUTHORIZED', 'Nicht autorisierter Workflow-Aufruf.', 401);
    if (!enabled()) return { ok: true, environment: env, enabled: false, sent: 0 };
    const now = deps().now(), nowIso = now.toISOString();
    const doc = await deps().store.read(env);
    if (!doc.subscriptions.length) return { ok: true, environment: env, subscriptions: 0, messages: 0, sent: 0 };
    const team = await deps().readTeam(env);
    const users = Array.isArray(team.users) ? team.users : [];
    const due = reminders.dueTaskMessages({ state: team.state, users, subscriptions: doc.subscriptions, ledger: doc.ledger, environment: env, nowIso: reminders.berlinNowIso(now) });
    const vapid = due.messages.length ? await deps().store.vapid() : null;
    const jobs = [];
    due.messages.forEach((m, messageIndex) => m.subscriptions.forEach((subscription) => jobs.push({ subscription, payload: reminders.taskPayload(m.rows, env, due.nowIso, subscription.language, m.payload.id), messageIndex, ttl: 6 * 3600, urgency: 'normal', topic: 'tasks' })));
    const results = jobs.length ? await sendAll(deps(), jobs, vapid) : [];
    const delivered = new Set(results.filter((r) => r.ok).map((r) => r.messageIndex));
    const outcome = await deps().store.mutate(env, (d) => {
      due.messages.forEach((m, i) => { if (delivered.has(i)) for (const key of m.ledgerKeys) d.ledger[key] = nowIso; });
      const removed = storeLib.recordResults(d, results, nowIso) + storeLib.removeIds(d, due.inactiveSubscriptionIds);
      // keep the pack right in line with the current user rights
      for (const s of d.subscriptions) { const u = users.find((x) => text(x && x.id) === s.userId); if (u) s.packAllowed = packAllowed(u); }
      storeLib.pruneLedger(d, nowIso);
      return { removed };
    });
    return { ok: true, environment: env, at: due.nowIso, subscriptions: doc.subscriptions.length, messages: due.messages.length, sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok && !r.gone).length, removed: outcome.removed };
  }

  return async function handle(req) {
    const method = String(req && req.method || 'GET').toUpperCase();
    if (method === 'OPTIONS') return { status: 204, headers: { 'Cache-Control': 'no-store', Allow: 'GET, POST, OPTIONS' }, body: '' };
    try {
      const payload = body(req), env = helpers.environmentOf(req, payload);
      if (method === 'GET') return json(200, await config(env));
      if (method !== 'POST') throw error('METHOD_NOT_ALLOWED', 'Methode nicht erlaubt.', 405);
      const action = lower(payload.action || 'config');
      let result;
      if (action === 'config') result = await config(env);
      else if (!enabled() && action !== 'unsubscribe' && action !== 'status' && action !== 'dispatch-reminders') throw error('WEB_PUSH_DISABLED', 'Handy-Benachrichtigungen sind abgeschaltet.', 503);
      else if (action === 'subscribe') result = await subscribe(req, payload, env);
      else if (action === 'status') result = await status(payload, env);
      else if (action === 'update') result = await update(payload, env);
      else if (action === 'unsubscribe') result = await unsubscribe(payload, env);
      else if (action === 'resubscribe') result = await resubscribe(payload, env);
      else if (action === 'test') result = await test(req, payload, env);
      else if (action === 'dispatch-reminders') result = await dispatchReminders(req, env);
      else throw error('WEB_PUSH_ACTION_INVALID', 'Unbekannte Aktion.', 400);
      return json(200, result);
    } catch (e) {
      const status = Number(e && (e.status || e.statusCode)) || 500;
      const raw = text(e && e.message);
      return json(status, { ok: false, code: text(e && e.code) || 'WEB_PUSH_FAILED', message: /^api\./.test(raw) ? raw : (raw || 'Handy-Benachrichtigung fehlgeschlagen.') });
    }
  };
}

// Called by pack-notification after a new pack notification was saved. Best effort: a push
// failure never fails the pack notification itself.
function createPackNotifier(overrides = {}) {
  let base = null;
  const deps = () => base || (base = Object.assign(defaultDeps(), overrides));
  return async function notifyPack(environment, notification) {
    if (!enabled()) return { sent: 0 };
    const env = lower(environment) === 'testservice' ? 'testservice' : 'production';
    const doc = await deps().store.read(env);
    const targets = doc.subscriptions.filter((s) => s && s.packAllowed === true && !(s.categories && s.categories.pack === false));
    if (!targets.length) return { sent: 0 };
    const vapid = await deps().store.vapid(), nowIso = deps().now().toISOString();
    const payload = reminders.packPayload(notification, env, nowIso);
    const results = await sendAll(deps(), targets.map((subscription) => ({ subscription, payload: reminders.packPayload(notification, env, nowIso, subscription.language, payload.id), ttl: 24 * 3600, urgency: 'high' })), vapid);
    await deps().store.mutate(env, (d) => { storeLib.recordResults(d, results, nowIso); });
    return { sent: results.filter((r) => r.ok).length };
  };
}

let defaultHandler = null;
module.exports = async function (context, req) {
  if (!defaultHandler) defaultHandler = createHandler();
  const res = await defaultHandler(req);
  if (res.status >= 500 && context.log && context.log.error) context.log.error('web-push', res.body);
  context.res = res;
};
module.exports.createHandler = createHandler;
module.exports.createPackNotifier = createPackNotifier;
