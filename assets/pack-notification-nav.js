(function(root){
  'use strict';
  const doc=root.document;if(!doc)return;
  let timer=0,packViewActive=false;

  function runtime(){return root.ExportHUBPackNotifications||null;}
  function taskAnchor(){
    const direct=doc.querySelector('[data-view="tasks"],[data-page="tasks"],[data-nav="tasks"]');
    if(direct)return direct;
    const candidates=Array.from(doc.querySelectorAll('nav a,nav button,[role="navigation"] a,[role="navigation"] button,.sidebar a,.sidebar button'));
    return candidates.find(node=>String(node.textContent||'').trim()==='Aufgaben')||null;
  }
  function injectStyle(){
    if(doc.getElementById('exporthub-pack-nav-style'))return;
    const style=doc.createElement('style');style.id='exporthub-pack-nav-style';
    style.textContent='[data-pack-notifications-nav]{position:relative}[data-pack-notifications-nav].pack-notification-nav-entry{cursor:pointer;opacity:1!important;filter:none!important;visibility:visible!important}.pack-notification-nav-entry .pack-notification-nav-label{opacity:1!important;color:currentColor!important}.pack-notification-nav-entry .pack-notification-nav-icon{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;font-size:16px;line-height:1;opacity:1!important}.pack-notification-nav-entry.pack-notification-nav-fallback{display:inline-flex;align-items:center;justify-content:flex-start;gap:8px;min-height:40px;padding:8px 12px;border:1px solid var(--rc990-card-border,#dbe4ee);border-radius:12px;background:var(--rc990-card-bg,#fff);color:var(--rc990-text,#172033);font:800 13px/1.2 Inter,ui-sans-serif,system-ui,sans-serif;box-shadow:0 4px 14px rgba(15,23,42,.08)}.pack-notification-nav-entry.is-active,.pack-notification-nav-entry[aria-current="page"]{outline:none;box-shadow:inset 3px 0 0 #2563eb;background:rgba(37,99,235,.08)}';
    (doc.head||doc.documentElement).appendChild(style);
  }
  function setPackNavLabel(node){if(!node)return;let label=node.querySelector&&node.querySelector('.pack-notification-nav-label');if(!label){label=doc.createElement('span');label.className='pack-notification-nav-label';node.appendChild(label);}label.textContent='Packmeldungen';}
  function setPackNavIcon(node){if(!node)return false;let icon=node.querySelector&&node.querySelector('[data-pack-notifications-icon]');if(!icon){icon=doc.createElement('span');icon.className='pack-notification-nav-icon';icon.setAttribute('data-pack-notifications-icon','');icon.setAttribute('aria-hidden','true');if(typeof node.insertBefore==='function')node.insertBefore(icon,node.firstChild||null);else node.appendChild(icon);}icon.textContent='▣';return true;}
  function createEntry(anchor){
    injectStyle();const node=doc.createElement('button');node.type='button';node.className='pack-notification-nav-entry';
    if(anchor&&typeof anchor.className==='string'&&anchor.className.trim())node.className+=' '+anchor.className.trim();
    node.removeAttribute&&node.removeAttribute('id');node.disabled=false;node.removeAttribute&&node.removeAttribute('disabled');node.removeAttribute&&node.removeAttribute('aria-disabled');node.setAttribute('data-pack-notifications-nav','');node.setAttribute('data-pack-notifications-nav-owner','nav-runtime');node.setAttribute('data-index321-view','packnotifications');node.setAttribute('data-view','packnotifications');node.setAttribute('aria-label','Packmeldungen');node.setAttribute('title','Packmeldungen');
    setPackNavIcon(node);setPackNavLabel(node);return node;
  }
  function ensureEntry(){
    const existing=doc.querySelector('[data-pack-notifications-nav]');if(existing)return existing;
    const anchor=taskAnchor();const node=createEntry(anchor);
    if(anchor&&anchor.parentNode){anchor.parentNode.insertBefore(node,anchor.nextSibling);return node;}
    node.classList&&node.classList.add('pack-notification-nav-fallback');
    const host=doc.querySelector('nav,[role="navigation"],.sidebar,.side-nav,.navigation')||doc.body;host.appendChild(node);return node;
  }
  function setActive(active){
    const node=doc.querySelector('[data-pack-notifications-nav]');if(!node)return;
    node.classList&&node.classList.toggle('is-active',!!active);if(active)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');
  }
  function ensureStationAdmin(){
    if(root.ExportHUBPackStationAdmin)return Promise.resolve(root.ExportHUBPackStationAdmin);
    return new Promise(resolve=>{
      let script=doc.getElementById('exporthub-pack-station-admin');
      if(script){script.addEventListener&&script.addEventListener('load',()=>resolve(root.ExportHUBPackStationAdmin||null),{once:true});root.setTimeout&&root.setTimeout(()=>resolve(root.ExportHUBPackStationAdmin||null),1500);return;}
      script=doc.createElement('script');script.id='exporthub-pack-station-admin';script.src='/assets/pack-station-admin.js?v=1501';script.defer=true;script.onload=()=>resolve(root.ExportHUBPackStationAdmin||null);script.onerror=()=>resolve(null);(doc.head||doc.documentElement).appendChild(script);
    });
  }
  function ensurePackagingAdmin(){
    if(root.ExportHUBPackagingAdmin)return Promise.resolve(root.ExportHUBPackagingAdmin);
    return new Promise(resolve=>{
      let script=doc.getElementById('exporthub-packaging-admin');
      if(script){script.addEventListener&&script.addEventListener('load',()=>resolve(root.ExportHUBPackagingAdmin||null),{once:true});root.setTimeout&&root.setTimeout(()=>resolve(root.ExportHUBPackagingAdmin||null),1500);return;}
      script=doc.createElement('script');script.id='exporthub-packaging-admin';script.src='/assets/packaging-admin.js?v=1554';script.defer=true;script.onload=()=>resolve(root.ExportHUBPackagingAdmin||null);script.onerror=()=>resolve(null);(doc.head||doc.documentElement).appendChild(script);
    });
  }
  function notifyInboxOpened(){try{if(typeof root.CustomEvent==='function'&&typeof root.dispatchEvent==='function')root.dispatchEvent(new root.CustomEvent('exporthub:pack-inbox-opened'));}catch(_){} }
  function decorateAdmins(){return Promise.all([ensureStationAdmin(),ensurePackagingAdmin()]).then(([stationAdmin,packagingAdmin])=>{if(stationAdmin&&typeof stationAdmin.decorateInbox==='function')stationAdmin.decorateInbox();if(packagingAdmin&&typeof packagingAdmin.decorate==='function')packagingAdmin.decorate();notifyInboxOpened();return true;});}
  function openInbox(){
    const api=runtime();if(!(api&&typeof api.renderPackInbox==='function'))return false;
    packViewActive=true;const rendered=!!api.renderPackInbox();try{doc.body&&doc.body.setAttribute('data-exporthub-view','packnotifications');}catch(_){}setActive(rendered);
    if(rendered)decorateAdmins();
    return rendered;
  }
  function click(event){const node=event.target&&event.target.closest&&event.target.closest('[data-pack-notifications-nav]');if(!node)return;event.preventDefault();event.stopPropagation();if(typeof event.stopImmediatePropagation==='function')event.stopImmediatePropagation();openInbox();}
  function currentView(){try{return String(doc.body&&doc.body.getAttribute('data-exporthub-view')||'').toLowerCase();}catch(_){return'';}}
  function repairAfterViewChange(){clearTimeout(timer);timer=setTimeout(()=>{const node=ensureEntry();// RC1572: the app's own nav handler may switch to packnotifications before our click handler runs
      const active=currentView()==='packnotifications';setActive(active);if(active){const api=runtime();if(api&&typeof api.renderPackInbox==='function'&&!doc.getElementById('packNotificationInbox'))api.renderPackInbox();decorateAdmins();}},30);}
  function install(){
    if(doc.__exporthubPackNavInstalled)return true;doc.__exporthubPackNavInstalled=true;ensureEntry();doc.addEventListener('click',click,true);
    if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',repairAfterViewChange,{once:true});
    if(typeof root.addEventListener==='function'){
      root.addEventListener('exporthub:view-changed',()=>{if(currentView()!=='packnotifications')packViewActive=false;repairAfterViewChange();});
      root.addEventListener('exporthub:pack-language-changed',repairAfterViewChange);
      // RC1572: the app fires exporthub:viewchange/rendered (not view-changed); the sidebar is re-rendered on
      // navigation and the entry was only restored as a side effect of repeated language events (gone since RC1571)
      ['exporthub:viewchange','exporthub:rendered','exporthub:ready','exporthub:language-changed','exporthub:state-loaded'].forEach(name=>root.addEventListener(name,repairAfterViewChange));
    }
    // safety net for re-renders without any event: restore the entry if it is missing (cheap querySelector)
    if(typeof root.setInterval==='function')root.setInterval(()=>{if(!doc.hidden&&!doc.querySelector('[data-pack-notifications-nav]'))repairAfterViewChange()},1500);
    // the app re-renders #content for its own state view right after the inbox opened; put the inbox back
    // (polling, no DOM observer: two cheap lookups, and it only acts while the pack view is active)
    if(typeof root.setInterval==='function')root.setInterval(()=>{if(!doc.hidden&&currentView()==='packnotifications'&&!doc.getElementById('packNotificationInbox'))repairAfterViewChange()},400);
    ensureStationAdmin();ensurePackagingAdmin();return true;
  }
  root.ExportHUBPackNotificationNav=Object.freeze({ensureEntry,openInbox,repairAfterViewChange,install,setPackNavLabel,setPackNavIcon});
  install();
})(typeof window!=='undefined'?window:globalThis);
