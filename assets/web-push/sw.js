/* ExportHUB Web Push service worker (scope /assets/web-push/).
   Shows pushed reminders with the browser closed and without a website login. Every message is
   also kept on the device (IndexedDB) so the detail page inbox.html can show it without login. */
'use strict';

try { importScripts('/assets/i18n/web-push.js?v=1701'); } catch (_) {}
var i18n = self.ExportHUBWebPushI18n;
function tt(key,lang){return i18n&&i18n.t?i18n.t(key,null,lang):key}
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
      body: msg.body,
      icon: ICON,
      badge: BADGE,
      tag: String(data.tag || id),
      renotify: true,
      timestamp: Date.parse(msg.createdAt) || Date.now(),
      data: { id: id, url: msg.url, open: msg.open },
      actions: [{ action: 'details', title: tt('swDetails',msg.language) }, { action: 'open', title: tt('swOpen',msg.language) }]
    });
  }));
});

self.addEventListener('notificationclick', function (event) {
  var data = event.notification && event.notification.data || {};
  event.notification.close();
  var target = event.action === 'open' ? (data.open || '/') : (data.url || '/assets/web-push/inbox.html');
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      try {
        var path = new URL(c.url).pathname;
        if (path === new URL(target).pathname && 'focus' in c) return c.navigate ? c.navigate(target).then(function (w) { return w && w.focus(); }) : c.focus();
      } catch (_) {}
    }
    return self.clients.openWindow(target);
  }));
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
