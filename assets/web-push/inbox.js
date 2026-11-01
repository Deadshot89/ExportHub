/* Web Push inbox: local on-device messages remain readable without a website login.
   All interface strings are translated independently of ExportHUB's authenticated SPA. */
(function(){
'use strict';
var DB_NAME='exporthub-web-push',STORE='messages',SCOPE='/assets/web-push/';
var ui=window.ExportHUBWebPushI18n;
var records=[];
function t(k,vars){return ui&&ui.t?ui.t(k,vars):k}
function lang(){return ui&&ui.language?ui.language():'de'}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function when(iso){var at=Date.parse(iso);return at?new Date(at).toLocaleString(ui&&ui.locales&&ui.locales[lang()]||'de-DE',{weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):''}
function current(){try{return new URLSearchParams(location.search).get('m')||''}catch(_){return''}}
function environment(){return /-testservice\./i.test(location.hostname)?'testservice':'production'}
function readAll(){
 return new Promise(function(resolve){
  if(!('indexedDB' in window))return resolve([]);
  var req=indexedDB.open(DB_NAME,1);
  req.onupgradeneeded=function(){if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'})};
  req.onerror=function(){resolve([])};
  req.onsuccess=function(){
   var db=req.result;
   try{
    var all=db.transaction(STORE,'readonly').objectStore(STORE).getAll();
    all.onsuccess=function(){db.close();resolve((all.result||[]).sort(function(a,b){return String(b.receivedAt).localeCompare(String(a.receivedAt))}))};
    all.onerror=function(){db.close();resolve([])};
   }catch(_){db.close();resolve([])}
  };
 });
}
function kindText(kind){return t(({tasks:'kindTasks',pack:'kindPack',test:'kindTest'})[kind]||'kindNotice')}
function card(m,selected){
 var items=(m.items||[]).map(function(i){return '<li><b>'+esc(i.title)+'</b>'+(i.meta?'<span>'+esc(i.meta)+'</span>':'')+'</li>'}).join('');
 var extra=m.total>(m.items||[]).length?'<p class="time">'+esc(t('moreItems',{count:m.total-m.items.length}))+'</p>':'';
 return '<article class="card'+(selected?' is-current':'')+'" id="m-'+esc(m.id)+'"><div class="kind">'+esc(kindText(m.kind))+'</div><h2>'+esc(m.title)+'</h2><div class="time">'+esc(when(m.createdAt||m.receivedAt))+'</div>'+
   (items?'<ul>'+items+'</ul>'+extra:'<p class="body">'+esc(m.body)+'</p>')+'</article>';
}
function render(){
 var id=current(),host=document.getElementById('list');if(!host)return;
 if(!records.length){host.innerHTML='<p class="empty">'+esc(t('emptyInbox'))+'</p>';return}
 host.innerHTML=records.map(function(m){return card(m,m.id===id)}).join('');
 var el=id&&document.getElementById('m-'+id);if(el&&el.scrollIntoView)el.scrollIntoView({block:'start'});
}
function translateStatic(){
 document.documentElement.lang=lang();
 document.querySelectorAll('[data-wp-text]').forEach(function(el){el.textContent=t(el.getAttribute('data-wp-text'))});
 var sel=document.getElementById('language');if(sel)sel.value=lang();
 var label=document.querySelector('label[for="language"]');if(label)label.textContent=t('languageLabel');
}
function device(){
 var status=document.getElementById('deviceStatus'),off=document.getElementById('disable');if(!status||!off)return;
 off.hidden=true;off.disabled=false;
 if(!('serviceWorker' in navigator)||!('PushManager' in window)){status.innerHTML='<span class="off">'+esc(t('inboxUnsupported'))+'</span>';return}
 navigator.serviceWorker.getRegistration(SCOPE).then(function(reg){if(reg&&reg.update)reg.update().catch(function(){});return reg?reg.pushManager.getSubscription():null}).then(function(sub){
  if(!sub){status.innerHTML='<span class="off">'+esc(t('statusInactive'))+'</span> · '+esc(t('inboxEnableHelp'));return}
  status.innerHTML='<span class="on">'+esc(t('statusActive'))+'</span>';
  off.hidden=false;
  off.onclick=function(){
   off.disabled=true;
   fetch('/api/web-push',{method:'POST',cache:'no-store',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'unsubscribe',endpoint:sub.endpoint,environment:environment()})})
    .catch(function(){}).then(function(){return sub.unsubscribe()})
    .then(function(){status.innerHTML='<span class="off">'+esc(t('statusOff'))+'</span>';off.hidden=true})
    .catch(function(){off.disabled=false});
  };
 }).catch(function(){status.textContent=t('statusUnknown')});
}
function refresh(){translateStatic();render();device()}
function load(){readAll().then(function(list){records=list;render()})}
var selector=document.getElementById('language');
if(selector)selector.addEventListener('change',function(){if(ui&&ui.setLanguage)ui.setLanguage(selector.value);refresh()});
window.addEventListener('exporthub:webpush-language-changed',refresh);
refresh();load();
// The tap already landed here: drop the hand-off so a later ExportHUB start is not redirected.
try{if(window.caches)caches.open('exporthub-web-push-open').then(function(c){return c.delete('/assets/web-push/__open')}).catch(function(){})}catch(_){}
if('serviceWorker' in navigator&&navigator.serviceWorker.addEventListener)navigator.serviceWorker.addEventListener('message',load);
document.addEventListener('visibilitychange',function(){if(!document.hidden)load()});
})();
