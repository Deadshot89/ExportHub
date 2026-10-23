/* ExportHUB Web Push client: subscribes this device once (while logged in) so the server can send
   task reminders and new pack notifications to it later, with the browser closed and no login.
   UI: a card in "Benachrichtigungen"; the existing browser notifications action
   now also subscribes the device. Server: api/web-push. */
(function (w) {
  'use strict';
  if (w.ExportHUBWebPush) return;
  var d = w.document;
  var SW_URL = '/assets/web-push/sw.js';
  var SW_SCOPE = '/assets/web-push/';
  var API = '/api/web-push';
  var INBOX = '/assets/web-push/inbox.html';
  var CARD_ID = 'ehWebPushCard';
  var info = { busy: false, message: '', error: '', subscription: null, checked: false };

  function q(v) { return String(v == null ? '' : v).trim(); }
  function ui() { return w.ExportHUBWebPushI18n || null; }
  function tt(k,vars) { var lang=ui(); return lang&&lang.t?lang.t(k,vars):k; }
  function uiLang() { var lang=ui(); return lang&&lang.language?lang.language():'de'; }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function isDemo() { try { return /demo/i.test(String(w.location.pathname || '')); } catch (_) { return false; } }
  function environment() { try { return /-testservice\./i.test(String(w.location.hostname || '')) ? 'testservice' : 'production'; } catch (_) { return 'production'; } }
  function supported() { return !isDemo() && 'serviceWorker' in navigator && 'PushManager' in w && 'Notification' in w && w.isSecureContext !== false; }
  function isIos() { var ua = String(navigator.userAgent || ''); return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1); }
  function standalone() { try { return navigator.standalone === true || w.matchMedia('(display-mode: standalone)').matches; } catch (_) { return false; } }
  function permission() { return 'Notification' in w ? Notification.permission : 'unsupported'; }
  function sessionToken() {
    try { var rt = w.ExportHUBClean && w.ExportHUBClean.runtime || {}, direct = q(rt.authToken || rt.token || rt.sessionToken); if (direct) return direct; } catch (_) {}
    try { var raw = w.sessionStorage && w.sessionStorage.getItem('exporthub_rc301_tab_session'); if (raw) { var x = JSON.parse(raw), tk = q(x && x.token); if (tk) return tk; } } catch (_) {}
    return '';
  }
  function currentUserId() { try { var u = typeof w.__EXPORTHUB_GET_CURRENT_USER__ === 'function' ? w.__EXPORTHUB_GET_CURRENT_USER__() : null; return q(u && (u.id || u.userId)); } catch (_) { return ''; } }
  function deviceLabel() {
    var ua = String(navigator.userAgent || ''), os = /Android/i.test(ua) ? 'Android' : isIos() ? 'iPhone/iPad' : /Windows/i.test(ua) ? 'Windows' : /Mac OS X/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : 'Gerät';
    var br = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    return os + ' · ' + br;
  }
  function keyBytes(b64) {
    var s = String(b64).replace(/-/g, '+').replace(/_/g, '/'); s += '==='.slice((s.length + 3) % 4);
    var raw = atob(s), out = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out;
  }
  function call(payload, withToken) {
    var headers = { 'Content-Type': 'application/json', Accept: 'application/json' }, token = withToken ? sessionToken() : '';
    if (token) { headers['X-ExportHUB-Token'] = token; headers.Authorization = 'Bearer ' + token; }
    return w.fetch(API, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: headers, body: JSON.stringify(Object.assign({ environment: environment() }, payload || {})) })
      .then(function (r) { return r.text().then(function (raw) { var data = {}; try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = { message: raw }; } if (!r.ok || data.ok === false) { var e = new Error(q(data.message) || ('HTTP ' + r.status)); e.code = q(data.code); throw e; } return data; }); });
  }
  function registration() {
    return navigator.serviceWorker.getRegistration(SW_SCOPE).then(function (reg) { return reg || navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE }); });
  }
  function readyRegistration() {
    return registration().then(function (reg) {
      if (reg.active) return reg;
      return new Promise(function (resolve) {
        var sw = reg.installing || reg.waiting; if (!sw) return resolve(reg);
        var done = false, finish = function () { if (!done) { done = true; resolve(reg); } };
        sw.addEventListener('statechange', function () { if (sw.state === 'activated') finish(); });
        setTimeout(finish, 8000);
      });
    });
  }
  function existingSubscription() {
    if (!supported()) return Promise.resolve(null);
    return navigator.serviceWorker.getRegistration(SW_SCOPE).then(function (reg) { return reg ? reg.pushManager.getSubscription() : null; }).catch(function () { return null; });
  }
  function refreshStatus() {
    return existingSubscription().then(function (sub) {
      if (!sub) { info.subscription = null; info.checked = true; return null; }
      return call({ action: 'status', endpoint: sub.endpoint }, false).then(function (r) { info.subscription = r.subscribed ? Object.assign({ endpoint: sub.endpoint }, r.subscription) : null; info.checked = true; return info.subscription; });
    }).catch(function (e) { info.checked = true; info.error = e.message; return null; });
  }

  function enable() {
    if (!supported()) return Promise.reject(new Error(isIos() && !standalone() ? tt('unsupportedIos') : tt('unsupported')));
    if (!sessionToken()) return Promise.reject(new Error(tt('needLogin')));
    return Notification.requestPermission().then(function (p) {
      if (p !== 'granted') throw new Error(p === 'denied' ? tt('permissionDenied') : tt('permissionNotGranted'));
      return Promise.all([readyRegistration(), w.fetch(API, { method: 'GET', cache: 'no-store', credentials: 'same-origin', headers: { 'x-exporthub-environment': environment() } }).then(function (r) { return r.json(); })]);
    }).then(function (res) {
      var reg = res[0], cfg = res[1] || {};
      if (!cfg.publicKey) throw new Error(q(cfg.message) || tt('pushUnavailable'));
      if (cfg.enabled === false) throw new Error(tt('pushDisabled'));
      var key = keyBytes(cfg.publicKey);
      return reg.pushManager.getSubscription().then(function (sub) {
        if (!sub) return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        var current = sub.options && sub.options.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey) : null;
        if (current && current.length === key.length && current.every(function (b, i) { return b === key[i]; })) return sub;
        return sub.unsubscribe().then(function () { return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }); });
      });
    }).then(function (sub) {
      return call({ action: 'subscribe', subscription: sub.toJSON(), deviceLabel: deviceLabel(), language: uiLang() }, true).then(function (r) { info.subscription = Object.assign({ endpoint: sub.endpoint }, r.subscription); try { w.localStorage.setItem('exporthub.webpush.user', currentUserId()); } catch (_) {} return info.subscription; });
    });
  }
  function disable() {
    return existingSubscription().then(function (sub) {
      if (!sub) { info.subscription = null; return null; }
      return call({ action: 'unsubscribe', endpoint: sub.endpoint }, false).catch(function () {}).then(function () { return sub.unsubscribe(); }).then(function () { info.subscription = null; });
    });
  }
  function test() {
    return existingSubscription().then(function (sub) { if (!sub) throw new Error(tt('notSubscribed')); return call({ action: 'test', endpoint: sub.endpoint }, true); });
  }
  function setCategory(key, value) {
    return existingSubscription().then(function (sub) {
      if (!sub) throw new Error(tt('notSubscribed'));
      var categories = {}; categories[key] = !!value;
      return call({ action: 'update', endpoint: sub.endpoint, categories: categories }, false).then(function (r) { info.subscription = Object.assign({ endpoint: sub.endpoint }, r.subscription); });
    });
  }
  // Another user logged in on this device: move the device to that user (server checks the session).
  function rebindIfUserChanged() {
    var uid = currentUserId(), last = ''; try { last = w.localStorage.getItem('exporthub.webpush.user') || ''; } catch (_) {}
    if (!uid || !sessionToken() || uid === last || permission() !== 'granted') return;
    existingSubscription().then(function (sub) {
      if (!sub) return;
      return call({ action: 'subscribe', subscription: sub.toJSON(), deviceLabel: deviceLabel(), language: uiLang() }, true).then(function (r) { info.subscription = Object.assign({ endpoint: sub.endpoint }, r.subscription); try { w.localStorage.setItem('exporthub.webpush.user', uid); } catch (_) {} render(); });
    }).catch(function () {});
  }

  function statusText() {
    if(isDemo())return tt('demo');
    if(!supported())return isIos()&&!standalone()?tt('installFirst'):tt('browserNoPush');
    if(permission()==='denied')return tt('browserBlocked');
    if(!info.checked)return tt('checking');
    return info.subscription?tt('activeDevice'):tt('inactiveDevice');
  }
  function cardHtml() {
    var sub=info.subscription,cats=sub&&sub.categories||{},ok=supported()&&permission()!=='denied';
    var hint='';
    if(isIos()&&!standalone())hint='<p class="eh-webpush-hint">'+esc(tt('iosHint'))+'</p>';
    else if(permission()==='denied')hint='<p class="eh-webpush-hint">'+esc(tt('permissionHint'))+'</p>';
    var buttons=sub
      ? '<button type="button" class="btn" data-eh-webpush="test"'+(info.busy?' disabled':'')+'>'+esc(tt('testButton'))+'</button><button type="button" class="ghost" data-eh-webpush="disable"'+(info.busy?' disabled':'')+'>'+esc(tt('disableButton'))+'</button>'
      : '<button type="button" class="btn" data-eh-webpush="enable"'+(ok&&!info.busy?'':' disabled')+'>'+esc(tt('enableButton'))+'</button>';
    var toggles=sub?'<div class="eh-webpush-toggles"><label><input type="checkbox" data-eh-webpush-category="tasks"'+(cats.tasks!==false?' checked':'')+'> '+esc(tt('tasksToggle'))+'</label>'+(sub.packAllowed?'<label><input type="checkbox" data-eh-webpush-category="pack"'+(cats.pack!==false?' checked':'')+'> '+esc(tt('packToggle'))+'</label>':'')+'</div>':'';
    var note=info.error?'<p class="eh-webpush-error" role="alert">'+esc(info.error)+'</p>':info.message?'<p class="eh-webpush-ok" role="status">'+esc(info.message)+'</p>':'';
    return '<section class="card" id="'+CARD_ID+'"><div class="index236-section-head"><div><h3>'+esc(tt('cardTitle'))+'</h3><p>'+esc(tt('cardIntro'))+'</p></div><strong class="eh-webpush-status'+(sub?' is-on':'')+'">'+esc(statusText())+'</strong></div>'+hint+toggles+'<div class="actions">'+buttons+'<a class="soft" href="'+INBOX+'" target="_blank" rel="noopener">'+esc(tt('openInbox'))+'</a></div>'+note+'</section>';
  }
  function ensureStyle() {
    if (d.getElementById('ehWebPushStyle')) return;
    var st = d.createElement('style'); st.id = 'ehWebPushStyle';
    st.textContent = '#' + CARD_ID + '{margin-top:14px}#' + CARD_ID + ' .eh-webpush-status{white-space:nowrap;padding:4px 10px;border-radius:999px;background:rgba(148,163,184,.18);font-size:.85em}#' + CARD_ID + ' .eh-webpush-status.is-on{background:rgba(34,197,94,.18);color:#15803d}#' + CARD_ID + ' .eh-webpush-hint{margin:8px 0;padding:8px 10px;border-radius:8px;background:rgba(59,130,246,.10)}#' + CARD_ID + ' .eh-webpush-toggles{display:flex;flex-wrap:wrap;gap:14px;margin:8px 0}#' + CARD_ID + ' .eh-webpush-toggles label{display:flex;gap:6px;align-items:center}#' + CARD_ID + ' .eh-webpush-error{color:#b91c1c;margin:8px 0 0}#' + CARD_ID + ' .eh-webpush-ok{color:#15803d;margin:8px 0 0}#' + CARD_ID + ' .actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}';
    d.head.appendChild(st);
  }
  function render() {
    var center = d.getElementById('index236NotificationCenter');
    if (!center) return false;
    ensureStyle();
    var html = cardHtml(), card = d.getElementById(CARD_ID);
    if (card) { if (card.outerHTML !== html) card.outerHTML = html; return true; }
    var anchor = center.querySelector('.index236-statusbar');
    if (anchor) anchor.insertAdjacentHTML('afterend', html); else center.insertAdjacentHTML('afterbegin', html);
    if (!info.checked) refreshStatus().then(render);
    return true;
  }
  function readableError(e){
    var code=q(e&&e.code);
    var known={WEB_PUSH_NOT_SUBSCRIBED:'notSubscribed',WEB_PUSH_DISABLED:'pushDisabled',
      WEB_PUSH_VAPID_UNAVAILABLE:'pushUnavailable',SESSION_INVALID:'needLogin',
      WEB_PUSH_GONE:'notSubscribed',WEB_PUSH_USER_REQUIRED:'needLogin'};
    if(known[code])return tt(known[code]);
    if(code)return tt('genericFailure')+' ('+code+')';
    return q(e&&e.message)||tt('genericFailure');
  }
  function run(task, success) {
    info.busy = true; info.error = ''; info.message = ''; render();
    return task().then(function () { info.message = success || ''; }).catch(function (e) { info.error = readableError(e); }).then(function () { info.busy = false; render(); });
  }

  // Window capture runs before the notification center's document capture handler.
  w.addEventListener('click', function (e) {
    var el = e.target && e.target.closest && e.target.closest('[data-eh-webpush],[data-index236-action="enable-browser"]');
    if (!el) return;
    var action = el.getAttribute('data-eh-webpush') || (supported() ? 'enable' : '');
    if (!action) return;
    e.preventDefault(); e.stopPropagation();
    if (action === 'enable') run(enable, tt('enabledSuccess'));
    else if (action === 'disable') run(disable, tt('disabledSuccess'));
    else if (action === 'test') run(test, tt('testSuccess'));
  }, true);
  w.addEventListener('change', function (e) {
    var el = e.target && e.target.closest && e.target.closest('[data-eh-webpush-category]');
    if (!el) return;
    run(function () { return setCategory(el.getAttribute('data-eh-webpush-category'), el.checked); }, tt('savedSuccess'));
  }, true);

  function watchContent() {
    var host = d.getElementById('content');
    if (!host || host.__ehWebPushObserved || typeof MutationObserver !== 'function') return;
    host.__ehWebPushObserved = true;
    new MutationObserver(function () { if (d.getElementById('index236NotificationCenter') && !d.getElementById(CARD_ID)) render(); }).observe(host, { childList: true });
  }
  function boot() { watchContent(); render(); rebindIfUserChanged(); }
  function syncPushLanguage(){
    if(!sessionToken()||permission()!=='granted')return;
    existingSubscription().then(function(sub){if(!sub)return null;return call({action:'subscribe',subscription:sub.toJSON(),deviceLabel:deviceLabel(),language:uiLang()},true)})
      .then(function(r){if(r&&r.subscription)info.subscription=Object.assign({},info.subscription||{},r.subscription)})
      .catch(function(){});
  }
  w.addEventListener('exporthub:language-changed',function(){render();syncPushLanguage()});
  w.addEventListener('exporthub:webpush-language-changed',function(){render();syncPushLanguage()});
  ['exporthub:ready', 'exporthub:viewchange', 'exporthub:sync'].forEach(function (name) { w.addEventListener(name, function () { setTimeout(boot, 0); }); });
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();

  w.ExportHUBWebPush = Object.freeze({ supported: supported, enable: enable, disable: disable, test: test, setCategory: setCategory, refresh: refreshStatus, render: render, state: function () { return { supported: supported(), permission: permission(), subscribed: !!info.subscription, ios: isIos(), standalone: standalone() }; } });
})(window);
