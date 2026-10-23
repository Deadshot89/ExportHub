/* ExportHUB Web Push service worker (scope /assets/web-push/).
   Shows pushed reminders with the browser closed and without a website login. Every message is
   also kept on the device (IndexedDB) so the detail page inbox.html can show it without login. */
'use strict';

try { importScripts('/assets/i18n/web-push.js?v=1701'); } catch (_) {}
var i18n = self.ExportHUBWebPushI18n;
function tt(key,lang,vars){return i18n&&i18n.t?i18n.t(key,vars||null,lang):key}
var DB_NAME = 'exporthub-web-push';
var STORE = 'messages';
var KEEP = 60;
var ICON = '/assets/web-push/icon-192.png';
var BADGE = '/assets/web-push/badge-96.png';

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });

function openDb() {
  return new Promise(function (resolve, reject) {
    var req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = function () { var db = req.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' }); };
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { reject(req.error); };
  });
}
function saveMessage(msg) {
  return openDb().then(function (db) {
    return new Promise(function (resolve) {
      var tx = db.transaction(STORE, 'readwrite'), store = tx.objectStore(STORE);
      store.put(msg);
      var all = store.getAll();
      all.onsuccess = function () {
        var list = (all.result || []).sort(function (a, b) { return String(b.receivedAt).localeCompare(String(a.receivedAt)); });
        list.slice(KEEP).forEach(function (old) { store.delete(old.id); });
      };
      tx.oncomplete = function () { db.close(); resolve(); };
      tx.onerror = function () { db.close(); resolve(); };
    });
  }).catch(function () {});
}
function sameOrigin(url, fallback) {
  try { var u = new URL(url || fallback, self.location.origin); return u.origin === self.location.origin ? u.href : new URL(fallback, self.location.origin).href; } catch (_) { return new URL(fallback, self.location.origin).href; }
}

// Every item in its own line, so the expanded notification shows the complete content.
function fullBody(msg) {
  if (!msg.items.length || msg.kind !== 'tasks') return msg.body;
  var lines = msg.items.map(function (i) { return (msg.items.length > 1 ? '• ' : '') + String(i.title || '') + (i.meta ? ' · ' + i.meta : ''); });
  if (msg.total > msg.items.length) lines.push(tt('serverMore', msg.language, { count: msg.total - msg.items.length }));
  return lines.join('\n');
}

self.addEventListener('push', function (event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { body: event.data ? event.data.text() : '' }; }
  var id = String(data.id || ('push-' + Date.now()));
  var msg = {
    id: id,
    kind: String(data.kind || 'info'),
    language: String(data.language || 'de'),
    title: String(data.title || 'ExportHUB'),
    body: String(data.body || ''),
    items: Array.isArray(data.items) ? data.items.slice(0, 20) : [],
    total: Number(data.total || 0),
    environment: String(data.environment || ''),
    createdAt: String(data.createdAt || new Date().toISOString()),
    receivedAt: new Date().toISOString(),
    url: sameOrigin(data.url, '/assets/web-push/inbox.html?m=' + encodeURIComponent(id)),
    open: sameOrigin(data.open, '/')
  };
  event.waitUntil(saveMessage(msg).then(function () {
    return self.registration.showNotification(msg.title, {
      body: fullBody(msg),
      icon: ICON,
      badge: BADGE,
      tag: String(data.tag || id),
      renotify: true,
      timestamp: Date.parse(msg.createdAt) || Date.now(),
      // read-only: the notification shows everything and stays until it is swiped away; no buttons
      requireInteraction: true,
      data: { id: id }
    });
  }));
});

// Tapping only closes the notification: it is for reading, not for editing, and it never opens the website.
self.addEventListener('notificationclick', function (event) {
  if (event.notification) event.notification.close();
});

// The push service rotated the subscription: register the new one with the old endpoint as proof.
self.addEventListener('pushsubscriptionchange', function (event) {
  var oldEndpoint = event.oldSubscription && event.oldSubscription.endpoint;
  event.waitUntil(fetch('/api/web-push', { method: 'GET', cache: 'no-store', credentials: 'same-origin' })
    .then(function (r) { return r.json(); })
    .then(function (cfg) {
      if (!cfg || !cfg.publicKey || !oldEndpoint) return null;
      var raw = atob(cfg.publicKey.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((cfg.publicKey.length + 3) % 4)), key = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) key[i] = raw.charCodeAt(i);
      return self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }).then(function (sub) {
        return fetch('/api/web-push', { method: 'POST', cache: 'no-store', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'resubscribe', oldEndpoint: oldEndpoint, subscription: sub.toJSON(), environment: cfg.environment }) });
      });
    }).catch(function () {}));
});
