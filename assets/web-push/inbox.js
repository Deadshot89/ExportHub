/* Detail page for pushed messages. Reads what the service worker stored on this device, so the
   content is visible without an ExportHUB login. Switching the device off needs no login either. */
(function () {
  'use strict';
  var DB_NAME = 'exporthub-web-push', STORE = 'messages', SCOPE = '/assets/web-push/';
  var KIND = { tasks: 'Aufgaben-Erinnerung', pack: 'Packmeldung', test: 'Test' };
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function when(iso) { var t = Date.parse(iso); return t ? new Date(t).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''; }
  function current() { try { return new URLSearchParams(location.search).get('m') || ''; } catch (_) { return ''; } }
  function environment() { return /-testservice\./i.test(location.hostname) ? 'testservice' : 'production'; }

  function readAll() {
    return new Promise(function (resolve) {
      if (!('indexedDB' in window)) return resolve([]);
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' }); };
      req.onerror = function () { resolve([]); };
      req.onsuccess = function () {
        var db = req.result;
        try {
          var all = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
          all.onsuccess = function () { db.close(); resolve((all.result || []).sort(function (a, b) { return String(b.receivedAt).localeCompare(String(a.receivedAt)); })); };
          all.onerror = function () { db.close(); resolve([]); };
        } catch (_) { db.close(); resolve([]); }
      };
    });
  }
  function card(m, isCurrent) {
    var items = (m.items || []).map(function (i) { return '<li><b>' + esc(i.title) + '</b>' + (i.meta ? '<span>' + esc(i.meta) + '</span>' : '') + '</li>'; }).join('');
    var more = m.total > (m.items || []).length ? '<p class="time">+' + (m.total - m.items.length) + ' weitere in ExportHUB</p>' : '';
    return '<article class="card' + (isCurrent ? ' is-current' : '') + '" id="m-' + esc(m.id) + '"><div class="kind">' + esc(KIND[m.kind] || 'Hinweis') + '</div><h2>' + esc(m.title) + '</h2><div class="time">' + esc(when(m.createdAt || m.receivedAt)) + '</div>' +
      (items ? '<ul>' + items + '</ul>' + more : '<p class="body">' + esc(m.body) + '</p>') +
      '<div class="actions"><a class="btn" href="' + esc(m.open || '/') + '">In ExportHUB öffnen</a></div></article>';
  }
  function render(list) {
    var id = current(), host = document.getElementById('list');
    if (!list.length) { host.innerHTML = '<p class="empty">Noch keine Benachrichtigungen auf diesem Gerät empfangen.</p>'; return; }
    host.innerHTML = list.map(function (m) { return card(m, m.id === id); }).join('');
    var el = id && document.getElementById('m-' + id); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' });
  }
  function device() {
    var status = document.getElementById('deviceStatus'), off = document.getElementById('disable');
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { status.innerHTML = '<span class="off">Push wird von diesem Browser nicht unterstützt</span>'; return; }
    navigator.serviceWorker.getRegistration(SCOPE).then(function (reg) { return reg ? reg.pushManager.getSubscription() : null; }).then(function (sub) {
      if (!sub) { status.innerHTML = '<span class="off">nicht aktiv</span> · in ExportHUB unter „Benachrichtigungen“ aktivieren'; return; }
      status.innerHTML = '<span class="on">aktiv</span>';
      off.hidden = false;
      off.onclick = function () {
        off.disabled = true;
        fetch('/api/web-push', { method: 'POST', cache: 'no-store', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unsubscribe', endpoint: sub.endpoint, environment: environment() }) })
          .catch(function () {}).then(function () { return sub.unsubscribe(); })
          .then(function () { status.innerHTML = '<span class="off">ausgeschaltet</span>'; off.hidden = true; })
          .catch(function () { off.disabled = false; });
      };
    }).catch(function () { status.textContent = 'unbekannt'; });
  }
  readAll().then(render);
  device();
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener && navigator.serviceWorker.addEventListener('message', function () { readAll().then(render); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) readAll().then(render); });
})();
