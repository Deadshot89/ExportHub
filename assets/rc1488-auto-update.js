(function(root){
  'use strict';

  var CHECK_INTERVAL_MS=300000;
  var INITIAL_CHECK_DELAY_MS=15000;
  var RELOAD_LOCK_TTL_MS=60000;
  var MANIFEST_URL='/production-version.js';
  var RELOAD_LOCK_KEY='exporthub:rc1488:reload-lock';
  var script=root.document&&root.document.currentScript||null;
  var currentBuild=String(root.__EXPORTHUB_BUILD_ID__||(script&&script.dataset&&script.dataset.buildId)||'').trim();
  var visibleRelease=String(root.__EXPORTHUB_VISIBLE_RELEASE__||(script&&script.dataset&&script.dataset.visibleRelease)||'').trim();
  var installed=false;
  var inFlight=null;
  var intervalId=null;
  var pendingBuild='';

  function q(value){return String(value==null?'':value).trim();}

  function tr(key){
    try{
      var i18n=root.ExportHUBAutoUpdateI18n;
      if(i18n&&typeof i18n.t==='function')return i18n.t(key)||key;
    }catch(_){}
    return key;
  }

  function isDirty(){
    try{
      if(typeof root.__EXPORTHUB_UPDATE_DIRTY__==='function'&&root.__EXPORTHUB_UPDATE_DIRTY__())return true;
    }catch(_){}
    try{
      var clean=root.ExportHUBClean,runtime=clean&&clean.runtime;
      if(runtime){
        if(runtime.saving===true)return true;
        var changed=Number(runtime.changeGeneration||0),saved=Number(runtime.lastSavedGeneration||0);
        if(changed>saved)return true;
      }
    }catch(_){}
    return false;
  }

  function readLock(){
    try{
      var raw=root.sessionStorage&&root.sessionStorage.getItem(RELOAD_LOCK_KEY);
      if(!raw)return null;
      var lock=JSON.parse(raw);
      return lock&&typeof lock==='object'?lock:null;
    }catch(_){return null;}
  }

  function writeLock(nextBuild){
    try{
      if(root.sessionStorage)root.sessionStorage.setItem(RELOAD_LOCK_KEY,JSON.stringify({from:currentBuild,to:q(nextBuild),at:Date.now()}));
    }catch(_){}
  }

  function clearResolvedLock(){
    var lock=readLock();
    if(lock&&q(lock.to)===currentBuild){
      try{root.sessionStorage&&root.sessionStorage.removeItem(RELOAD_LOCK_KEY);}catch(_){}
    }
  }

  function reloadLocked(nextBuild){
    var lock=readLock();
    if(!lock)return false;
    return q(lock.from)===currentBuild&&q(lock.to)===q(nextBuild)&&Date.now()-Number(lock.at||0)<RELOAD_LOCK_TTL_MS;
  }

  function styleBanner(banner){
    if(!banner||!banner.style)return;
    banner.style.position='fixed';
    banner.style.top='12px';
    banner.style.left='50%';
    banner.style.transform='translateX(-50%)';
    banner.style.zIndex='2147483000';
    banner.style.maxWidth='min(720px,calc(100vw - 24px))';
    banner.style.padding='12px 14px';
    banner.style.borderRadius='12px';
    banner.style.boxShadow='0 12px 30px rgba(15,23,42,.22)';
    banner.style.background='#0f172a';
    banner.style.color='#fff';
    banner.style.font='600 14px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
  }

  function showBanner(nextBuild,reason){
    var doc=root.document;
    if(!doc||!doc.body||typeof doc.createElement!=='function')return null;
    pendingBuild=q(nextBuild)||pendingBuild;
    var banner=doc.getElementById&&doc.getElementById('exporthub-rc1488-update-banner');
    if(!banner){
      banner=doc.createElement('div');
      banner.id='exporthub-rc1488-update-banner';
      banner.setAttribute&&banner.setAttribute('role','status');
      banner.setAttribute&&banner.setAttribute('aria-live','polite');
      styleBanner(banner);
      var text=doc.createElement('span');
      text.id='exporthub-rc1488-update-text';
      banner.appendChild(text);
      var button=doc.createElement('button');
      button.type='button';
      button.id='exporthub-rc1488-update-button';
      button.textContent=tr('updateNow');
      if(button.style){
        button.style.marginLeft='12px';
        button.style.padding='7px 10px';
        button.style.border='0';
        button.style.borderRadius='8px';
        button.style.cursor='pointer';
        button.style.font='inherit';
      }
      button.addEventListener&&button.addEventListener('click',function(){
        if(isDirty()){
          var note=doc.getElementById&&doc.getElementById('exporthub-rc1488-update-text');
          if(note)note.textContent=tr('saveFirst');
          return;
        }
        reloadTo(pendingBuild);
      });
      banner.appendChild(button);
      doc.body.appendChild(banner);
    }
    var message=doc.getElementById&&doc.getElementById('exporthub-rc1488-update-text');
    if(message){
      message.textContent=reason==='reload-locked'
        ?tr('reloadLocked')
        :tr('available');
    }
    return banner;
  }

  function reloadTo(nextBuild){
    var next=q(nextBuild);
    if(!next||next===currentBuild)return {status:'current',buildId:currentBuild};
    if(isDirty()){
      showBanner(next,'dirty');
      return {status:'blocked-dirty',buildId:next};
    }
    if(reloadLocked(next)){
      showBanner(next,'reload-locked');
      return {status:'reload-locked',buildId:next};
    }
    writeLock(next);
    if(root.location&&typeof root.location.reload==='function')root.location.reload();
    return {status:'reloading',buildId:next};
  }

  async function performCheck(){
    if(!currentBuild)return {status:'no-current-build'};
    var response=await root.fetch(MANIFEST_URL+'?_='+Date.now(),{cache:'no-store',credentials:'same-origin',headers:{'Cache-Control':'no-cache'}});
    if(!response||!response.ok)return {status:'unavailable'};
    var probe=await response.text();
    var buildMatch=String(probe||'').match(/__EXPORTHUB_UPDATE_BUILD__\s*=\s*['"]([0-9a-f]{7,40})['"]/i);
    if(!buildMatch)return {status:'invalid-manifest'};
    var next=q(buildMatch[1]).toLowerCase();
    var releaseMatch=String(probe||'').match(/__EXPORTHUB_UPDATE_RELEASE__\s*=\s*['"](RC\d+)['"]/i);
    var remoteRelease=releaseMatch?q(releaseMatch[1]).toUpperCase():visibleRelease;
    if(next===currentBuild){
      clearResolvedLock();
      return {status:'current',buildId:currentBuild,visibleRelease:remoteRelease};
    }
    return reloadTo(next);
  }

  function check(){
    if(inFlight)return inFlight;
    inFlight=Promise.resolve().then(performCheck).catch(function(error){
      try{root.console&&root.console.warn&&root.console.warn('RC1488 Auto-Update Check fehlgeschlagen',error&&error.message||error);}catch(_){}
      return {status:'unavailable'};
    }).finally(function(){inFlight=null;});
    return inFlight;
  }

  function install(){
    if(installed)return false;
    installed=true;
    if(typeof root.setInterval==='function')intervalId=root.setInterval(function(){check();},CHECK_INTERVAL_MS);
    if(typeof root.addEventListener==='function'){
      root.addEventListener('focus',function(){check();});
      root.addEventListener('online',function(){check();});
    }
    if(root.document&&typeof root.document.addEventListener==='function'){
      root.document.addEventListener('visibilitychange',function(){if(root.document.visibilityState==='visible')check();});
    }
    if(typeof root.setTimeout==='function')root.setTimeout(function(){check();},INITIAL_CHECK_DELAY_MS);
    return true;
  }

  root.ExportHUBAutoUpdate=Object.freeze({
    check:check,
    install:install,
    isDirty:isDirty,
    reloadTo:reloadTo,
    currentBuild:function(){return currentBuild;},
    intervalMs:CHECK_INTERVAL_MS,
    manifestUrl:MANIFEST_URL
  });

  if(!root.__EXPORTHUB_AUTO_UPDATE_DISABLE_AUTO_INSTALL__)install();
})(typeof window!=='undefined'?window:globalThis);
