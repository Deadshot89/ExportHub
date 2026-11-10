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
    style.textContent='[data-pack-notifications-nav]{position:relative}[data-pack-notifications-nav].pack-notification-nav-entry{cursor:pointer;opacity:1!important;filter:none!important;visibility:visible!important}.pack-notification-nav-entry .pack-notification-nav-label{opacity:1!important;color:currentColor!important}.pack-notification-nav-entry.pack-notification-nav-fallback .pack-notification-nav-icon{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;font-size:16px;line-height:1;opacity:1!important}.pack-notification-nav-entry.pack-notification-nav-fallback{display:inline-flex;align-items:center;justify-content:flex-start;gap:8px;min-height:40px;padding:8px 12px;border:1px solid var(--rc990-card-border,#dbe4ee);border-radius:12px;background:var(--rc990-card-bg,#fff);color:var(--rc990-text,#172033);font:800 13px/1.2 Inter,ui-sans-serif,system-ui,sans-serif;box-shadow:0 4px 14px rgba(15,23,42,.08)}#nav.nav[data-index305-authoritative="1"]>button[data-pack-notifications-nav]:not([hidden]){display:flex!important;align-items:center!important;gap:9px!important;width:100%!important}#nav.nav[data-index305-authoritative="1"]>button[data-pack-notifications-nav]>span:first-child{width:20px;text-align:center;flex:0 0 20px}#nav.nav[data-index305-authoritative="1"]>button[data-pack-notifications-nav]>span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pack-notification-nav-entry.is-active,.pack-notification-nav-entry[aria-current="page"]{outline:none;box-shadow:inset 3px 0 0 #2563eb;background:rgba(37,99,235,.08)}';
    (doc.head||doc.documentElement).appendChild(style);
  }
  // Same icon tile and label classes as the regular menu entries (index308/index321), so every design styles Packmeldungen like Aufgaben.
  const PACK_NAV_ACCENT='#f97316';
  const PACK_NAV_ICON_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5z"></path><path d="m3 8 9 5 9-5M12 13v8"></path></svg>';
  function setPackNavLabel(node){if(!node)return;let label=node.querySelector&&node.querySelector('.pack-notification-nav-label');if(!label){label=doc.createElement('span');node.appendChild(label);}label.className='index308-nav-label pack-notification-nav-label';label.textContent='Packmeldungen';}
  function setPackNavIcon(node){if(!node)return false;let icon=node.querySelector&&node.querySelector('[data-pack-notifications-icon]');if(!icon){icon=doc.createElement('span');icon.setAttribute('data-pack-notifications-icon','');icon.setAttribute('aria-hidden','true');if(typeof node.insertBefore==='function')node.insertBefore(icon,node.firstChild||null);else node.appendChild(icon);}icon.className='index308-nav-icon pack-notification-nav-icon';icon.setAttribute('data-menu-accent',PACK_NAV_ACCENT);if(icon.style&&typeof icon.style.setProperty==='function')icon.style.setProperty('--menu-accent',PACK_NAV_ACCENT);if(!(icon.querySelector&&icon.querySelector('svg')))icon.innerHTML=PACK_NAV_ICON_SVG;if(node.setAttribute)node.setAttribute('data-menu-accent',PACK_NAV_ACCENT);if(node.style&&typeof node.style.setProperty==='function')node.style.setProperty('--menu-accent',PACK_NAV_ACCENT);return true;}
  function createEntry(anchor){
    injectStyle();const node=doc.createElement('button');node.type='button';node.className='pack-notification-nav-entry';
    if(anchor&&typeof anchor.className==='string'&&anchor.className.trim())node.className+=' '+anchor.className.trim();
    node.removeAttribute&&node.removeAttribute('id');node.disabled=false;node.removeAttribute&&node.removeAttribute('disabled');node.removeAttribute&&node.removeAttribute('aria-disabled');node.setAttribute('data-pack-notifications-nav','');node.setAttribute('data-pack-notifications-nav-owner','nav-runtime');node.setAttribute('data-index321-view','packnotifications');node.setAttribute('data-view','packnotifications');node.setAttribute('aria-label','Packmeldungen');node.setAttribute('title','Packmeldungen');
    setPackNavIcon(node);setPackNavLabel(node);return node;
  }
  function ensureEntry(){
    const existing=doc.querySelector('[data-pack-notifications-nav]');if(existing){setPackNavIcon(existing);setPackNavLabel(existing);return existing;}
    const anchor=taskAnchor();const node=createEntry(anchor);
    if(anchor&&anchor.parentNode){anchor.parentNode.insertBefore(node,anchor.nextSibling);return node;}
    node.classList&&node.classList.add('pack-notification-nav-fallback');
    const host=doc.querySelector('nav,[role="navigation"],.sidebar,.side-nav,.navigation')||doc.body;host.appendChild(node);return node;
  }
  function setActive(active){
    const node=doc.querySelector('[data-pack-notifications-nav]');if(!node)return;
    // the shared nav marker can leave 'active' on this entry while another view is open
    if(node.classList){node.classList.toggle('is-active',!!active);node.classList.toggle('active',!!active);}if(active)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');
  }
  function ensureStationAdmin(){
    if(root.ExportHUBPackStationAdmin)return Promise.resolve(root.ExportHUBPackStationAdmin);
    return new Promise(resolve=>{
      let script=doc.getElementById('exporthub-pack-station-admin');
      if(script){script.addEventListener&&script.addEventListener('load',()=>resolve(root.ExportHUBPackStationAdmin||null),{once:true});root.setTimeout&&root.setTimeout(()=>resolve(root.ExportHUBPackStationAdmin||null),1500);return;}
      script=doc.createElement('script');script.id='exporthub-pack-station-admin';script.src='/assets/pack-station-admin.js?v=1811';script.defer=true;script.onload=()=>resolve(root.ExportHUBPackStationAdmin||null);script.onerror=()=>resolve(null);(doc.head||doc.documentElement).appendChild(script);
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
      const view=currentView(),inbox=view==='packnotifications',detail=view==='packnotification';setActive(inbox||detail);if(inbox){const api=runtime();if(api&&typeof api.renderPackInbox==='function'&&!doc.getElementById('packNotificationInbox'))api.renderPackInbox();decorateAdmins();}else if(detail){ensureStationAdmin().then(admin=>{if(admin&&typeof admin.decorateDetail==='function')admin.decorateDetail();});}},30);}
  function install(){
    if(doc.__exporthubPackNavInstalled)return true;doc.__exporthubPackNavInstalled=true;ensureEntry();doc.addEventListener('click',click,true);
    // The core router renders a view through window[view]; without one it drew the legacy dashboard first and the
    // inbox replaced it only afterwards (visible flash). Rendering the inbox here makes the router draw it directly.
    if(typeof root.packnotifications!=='function')root.packnotifications=function(){openInbox();};
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



/* Internal modules remain in ExportHUB360's working area instead of navigating the browser away.
   Only the two explicitly allowlisted SAME-ORIGIN pages can be embedded. Packmeldungen already
   renders natively via renderPackInbox and must stay untouched. */
(function(w){
 'use strict';
 if(!w||!w.document||w.ExportHUBEmbeddedModules)return;
 var d=w.document;
 var MODULES={
  urgentorders:{path:'/assets/urgent-orders.html?embedded=1',title:'Urgent Order',pathname:'/assets/urgent-orders.html'},
  quality:{path:'/qualitaet.html?embedded=1',title:'Fehler & Verbesserungen',pathname:'/qualitaet.html'}
 };
 function open(view){
  var cfg=MODULES[view],host=d.getElementById('content');
  if(!cfg||!host)return false;
  var section=d.createElement('section');
  section.className='exporthub-embedded-module';
  section.setAttribute('data-exporthub-embedded',view);
  var frame=d.createElement('iframe');
  frame.className='exporthub-embedded-frame';
  frame.title=cfg.title;
  frame.src=cfg.path;
  frame.setAttribute('referrerpolicy','same-origin');
  frame.setAttribute('loading','eager');
  frame.addEventListener('load',function(){
   // Standalone pages have their own back-to-home links. In the embedded
   // workspace the permanent ExportHUB sidebar is already the navigation.
   try{
    var inner=frame.contentDocument;
    if(!inner||!frame.contentWindow||frame.contentWindow.location.pathname!==cfg.pathname)return;
    var style=inner.createElement('style');
    style.textContent='header.top,body>header{display:none!important}main{padding-top:16px!important}';
    (inner.head||inner.documentElement).appendChild(style);
   }catch(_){}
  });
  section.appendChild(frame);
  host.replaceChildren(section);
  d.body&&d.body.setAttribute('data-exporthub-view',view);
  var style=d.getElementById('exporthub-embedded-module-style');
  if(!style){
   style=d.createElement('style');style.id='exporthub-embedded-module-style';
   style.textContent='.exporthub-embedded-module{width:100%;min-width:0}.exporthub-embedded-frame{display:block;width:100%;height:max(680px,calc(100dvh - 170px));min-height:680px;border:0;border-radius:14px;background:#fff}#nav [data-exporthub-urgent-nav][aria-current="page"],#nav [data-rc1579-proxy="quality"][aria-current="page"]{box-shadow:inset 3px 0 0 #2563eb!important;background:rgba(37,99,235,.12)!important}@media(max-width:760px){.exporthub-embedded-frame{height:max(620px,calc(100dvh - 125px));min-height:620px;border-radius:9px}}';
   (d.head||d.documentElement).appendChild(style);
  }
  ['[data-exporthub-urgent-nav]','[data-rc1579-proxy="quality"]'].forEach(function(selector){
   var node=d.querySelector(selector);if(!node)return;
   var active=(view==='urgentorders'&&selector==='[data-exporthub-urgent-nav]')||
              (view==='quality'&&selector==='[data-rc1579-proxy="quality"]');
   if(active)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');
  });
  try{if(w.ExportHUBMobileMenu&&w.ExportHUBMobileMenu.isOpen())w.ExportHUBMobileMenu.close()}catch(_){}
  return true;
 }
 // Capture at document level so existing/reused menu buttons cannot keep stale
 // redirect handlers after a sidebar rebuild or an in-place application update.
 // A listener on newly created buttons alone does not cover reused nodes.
 if(typeof d.addEventListener==='function')d.addEventListener('click',function(e){
  var target=e&&e.target;
  if(!target||typeof target.closest!=='function')return;
  var urgent=target.closest('[data-exporthub-urgent-nav]');
  var quality=urgent?null:target.closest('[data-rc1579-proxy="quality"]');
  var entry=urgent||quality;
  if(!entry||!d.getElementById('content'))return;
  e.preventDefault();
  if(typeof e.stopImmediatePropagation==='function')e.stopImmediatePropagation();
  else if(typeof e.stopPropagation==='function')e.stopPropagation();
  // A hidden QM entry must neither open the module nor fall through to an
  // obsolete page-navigation listener on the reused element.
  if(entry.hidden||entry.getAttribute&&entry.getAttribute('aria-hidden')==='true')return;
  open(urgent?'urgentorders':'quality');
 },true);
 w.ExportHUBEmbeddedModules=Object.freeze({open:open});
})(typeof window!=='undefined'?window:globalThis);

/* Urgent Order: sidebar add-on immediately below Packmeldungen, never above Dashboard.
   Do not alter the normal ExportHUB navigation, Packmeldungen or any other domain. */
(function(w){
 'use strict';
 if(!w||!w.document||w.__EXPORT_HUB_URGENT_NAV__)return;
 w.__EXPORT_HUB_URGENT_NAV__=true;
 var d=w.document;
 var URGENT_ACCENT='#dc7226';
 var URGENT_ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m13 2-9 12h7l-1 8 10-12h-7l1-8z"></path></svg>';
 function ensure(){
  // Wait for the real application sidebar. A startup fallback must not appear above Dashboard.
  var nav=d.querySelector('#nav');
  if(!nav)return null;
  var pack=nav.querySelector('[data-pack-notifications-nav]');
  var tasks=nav.querySelector('[data-view="tasks"],[data-page="tasks"],[data-nav="tasks"]');
  var anchor=pack&&pack.parentNode===nav?pack:tasks&&tasks.parentNode===nav?tasks:null;
  if(!anchor)return null;
  var node=d.querySelector('[data-exporthub-urgent-nav]');
  // Apply the same style even when a previous runtime created the button.
  injectStyle();
  if(!node){
   node=d.createElement('button');
   node.type='button';
   // Reuse native sidebar typography and sizing, never inherit Packmeldungen-specific classes.
   var nativeEntry=tasks&&tasks.parentNode===nav?tasks:anchor;
   var inherited=String(nativeEntry.className||'').replace(/\b(?:active|is-active|pack-notification-nav-entry|pack-notification-nav-fallback|urgent-orders-nav-entry)\b/g,'').trim();
   node.className=(inherited?inherited+' ':'')+'urgent-orders-nav-entry';
   node.setAttribute('data-exporthub-urgent-nav','');
   node.setAttribute('aria-label','Urgent Order');
   node.setAttribute('title','Urgent Order');
   node.setAttribute('data-menu-accent',URGENT_ACCENT);
   node.style.setProperty('--menu-accent',URGENT_ACCENT);
   node.innerHTML='<span class="index308-nav-icon urgent-orders-nav-icon" aria-hidden="true">'+URGENT_ICON+'</span><span class="index308-nav-label urgent-orders-nav-label">Urgent Order</span>';
   node.setAttribute('data-urgent-nav-design','2');
   node.addEventListener('click',function(e){
    e.preventDefault();e.stopImmediatePropagation();
    w.ExportHUBEmbeddedModules.open('urgentorders');
   },true);
  }else if(!node.getAttribute||node.getAttribute('data-urgent-nav-design')!=='2'){
   // Upgrade old menu buttons in place; retain the live counter node and its state.
   var badge=node.querySelector&&node.querySelector('[data-urgent-open-count]');
   var previousLabel=node.getAttribute&&String(node.getAttribute('aria-label')||'');
   var reference=tasks&&tasks.parentNode===nav?tasks:anchor;
   var classes=String(reference.className||'').replace(/\b(?:active|is-active|pack-notification-nav-entry|pack-notification-nav-fallback|urgent-orders-nav-entry)\b/g,'').trim();
   node.className=(classes?classes+' ':'')+'urgent-orders-nav-entry';
   node.setAttribute('aria-label',badge&&/^Urgent Order: [0-9]+ offene Anfragen$/.test(previousLabel)?previousLabel:'Urgent Order');
   node.setAttribute('title','Urgent Order');
   node.setAttribute('data-menu-accent',URGENT_ACCENT);
   node.style.setProperty('--menu-accent',URGENT_ACCENT);
   node.innerHTML='<span class="index308-nav-icon urgent-orders-nav-icon" aria-hidden="true">'+URGENT_ICON+'</span><span class="index308-nav-label urgent-orders-nav-label">Urgent Order</span>';
   if(badge)node.appendChild(badge);
   node.setAttribute('data-urgent-nav-design','2');
  }
  // Re-home older/stale buttons and move again when the menu gets rebuilt.
  if(node.parentNode!==nav||anchor.nextSibling!==node)nav.insertBefore(node,anchor.nextSibling);
  return node;
 }
 function injectStyle(){
  if(d.getElementById('exporthub-urgent-nav-style'))return;
  var style=d.createElement('style');style.id='exporthub-urgent-nav-style';
  style.textContent=
   '#nav.nav[data-index305-authoritative="1"]>button[data-exporthub-urgent-nav]:not([hidden]){display:flex!important;align-items:center!important;gap:9px!important;width:100%!important;cursor:pointer}'+
   '#nav.nav[data-index305-authoritative="1"]>button[data-exporthub-urgent-nav]>span:first-child{width:20px;text-align:center;flex:0 0 20px}'+
   '#nav [data-exporthub-urgent-nav] .urgent-orders-nav-icon{display:inline-flex;align-items:center;justify-content:center;color:var(--menu-accent,#dc7226)}'+
   '#nav [data-exporthub-urgent-nav] .urgent-orders-nav-icon svg{width:20px;height:20px;display:block}'+
   '#nav [data-exporthub-urgent-nav] .urgent-orders-nav-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'+
   // Klassisch hat eine helle Seitenleiste: Text wie die übrigen Menüpunkte statt hellblau (vorher kaum lesbar)
   'html[data-eh-design="classic"] #nav>button[data-exporthub-urgent-nav],html[data-eh-design="classic"] #nav>button[data-exporthub-urgent-nav] .urgent-orders-nav-label{color:var(--pc-side-text,#24435b)!important}'+
   'html[data-eh-design="classic"] #nav>button[data-exporthub-urgent-nav] .index308-nav-icon{color:var(--menu-accent,#dc7226)!important}'+
   'html[data-eh-design]:not([data-eh-design="classic"]) #nav>button[data-exporthub-urgent-nav]{min-height:43px!important;border:1px solid transparent!important;color:#dbe7f5!important;background:transparent!important}'+
   'html[data-eh-design]:not([data-eh-design="classic"]) #nav>button[data-exporthub-urgent-nav]:hover{color:#fff!important;border-color:rgba(255,255,255,.08)!important;background:rgba(255,255,255,.07)!important}'+
   'html[data-eh-design]:not([data-eh-design="classic"]) #nav>button[data-exporthub-urgent-nav] .index308-nav-icon{background:rgba(255,255,255,.08)!important;border-color:rgba(255,255,255,.10)!important;color:var(--menu-accent,#dc7226)!important}'+
   'html[data-eh-design="modern"] #nav>button[data-exporthub-urgent-nav]{display:grid!important;grid-template-columns:34px minmax(0,1fr) 18px!important;align-items:center!important;min-height:46px!important;padding:6px 9px!important;border-radius:12px!important}'+
   'html[data-eh-design="modern"] #nav>button[data-exporthub-urgent-nav]::after{content:"›";opacity:.35;font-size:17px;justify-self:end}'+
   'html[data-eh-design="glass"] #nav>button[data-exporthub-urgent-nav]{min-height:44px!important;padding:6px 9px!important;border-radius:15px!important}'+
   'html[data-eh-design="neon"] #nav>button[data-exporthub-urgent-nav]{grid-template-columns:30px 1fr!important;min-height:38px!important;padding:4px 7px!important;border-radius:8px!important;font-size:12px!important}'+
   '@media(max-width:760px){html[data-eh-design]:not([data-eh-design="classic"]) #nav>button[data-exporthub-urgent-nav]{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:3px!important;min-width:62px!important;min-height:54px!important;padding:4px!important;border-radius:10px!important}html[data-eh-design]:not([data-eh-design="classic"]) #nav.nav[data-index305-authoritative="1"]>button[data-exporthub-urgent-nav]:not([hidden]){width:auto!important;flex:0 0 auto!important}html[data-eh-design]:not([data-eh-design="classic"]) #nav>button[data-exporthub-urgent-nav]::after{display:none!important}html[data-eh-design]:not([data-eh-design="classic"]) #nav>button[data-exporthub-urgent-nav] .urgent-orders-nav-label{max-width:64px!important}}';
  (d.head||d.documentElement).appendChild(style);
 }
 if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',ensure,{once:true});else ensure();
 if(w.setInterval)w.setInterval(function(){if(!d.hidden)ensure()},1500);
 if(w.addEventListener)['exporthub:viewchange','exporthub:rendered','exporthub:ready','exporthub:language-changed'].forEach(function(type){w.addEventListener(type,ensure)});
})(typeof window!=='undefined'?window:globalThis);


/* Urgent Order: a lightweight, permission-scoped open-request count beside the nav tab.
   Do not change existing Packmeldungen navigation, routing or inbox counters. */
(function(w){
 'use strict';
 if(!w||!w.document||w.__EXPORT_HUB_URGENT_NAV_COUNTER__)return;
 w.__EXPORT_HUB_URGENT_NAV_COUNTER__=true;
 const d=w.document;
 let lastRefresh=0,inFlight=false,sessionEpoch=0,loggedOut=false,authBackoffUntil=0;
 const AUTH_BACKOFF_MS=5*60*1000;
 function ensureBadge(){
  const node=d.querySelector('[data-exporthub-urgent-nav]');
  if(!node)return null;
  if(!d.getElementById('exporthub-urgent-nav-counter-style')){
   const style=d.createElement('style');style.id='exporthub-urgent-nav-counter-style';
   style.textContent='[data-exporthub-urgent-nav] .urgent-nav-count{display:inline-flex;align-items:center;justify-content:center;min-width:25px;height:23px;padding:0 7px;margin-left:auto;border-radius:999px;background:#e8edf3;border:1px solid #d2dce7;color:#465366;font:800 12px/1 system-ui,sans-serif;font-variant-numeric:tabular-nums}[data-exporthub-urgent-nav] .urgent-nav-count[data-has-open="true"]{background:#fff0da;color:#8e4705;border-color:#edc08a}[data-exporthub-urgent-nav] .urgent-nav-count[hidden]{display:none!important}@media(prefers-color-scheme:dark){[data-exporthub-urgent-nav] .urgent-nav-count{background:#354960;color:#e6eefc;border-color:#516785}[data-exporthub-urgent-nav] .urgent-nav-count[data-has-open="true"]{background:#5b442b;color:#ffe1b4;border-color:#90704a}}';
   (d.head||d.documentElement).appendChild(style);
  }
  let badge=node.querySelector('[data-urgent-open-count]');
  if(!badge){badge=d.createElement('span');badge.setAttribute('data-urgent-open-count','');badge.className='urgent-nav-count';badge.setAttribute('aria-hidden','true');badge.hidden=true;node.appendChild(badge);}
  return {node,badge};
 }
 function token(){
  try{const runtime=w.ExportHUBClean&&w.ExportHUBClean.runtime||{};if(runtime.authToken||runtime.token||runtime.sessionToken)return String(runtime.authToken||runtime.token||runtime.sessionToken);}catch(_){}
  try{const tab=JSON.parse(w.sessionStorage.getItem('exporthub_rc301_tab_session')||'{}');return String(tab.token||'');}catch(_){return'';}
 }
 function hideBadge(){
  const current=ensureBadge();
  if(current){current.badge.hidden=true;current.node.setAttribute('aria-label','Urgent Order');}
 }
 async function refresh(force){
  const ui=ensureBadge();
  if(!ui||inFlight||d.hidden||loggedOut)return;
  const epoch=sessionEpoch;
  const authToken=token();
  // The protected eh_session cookie may authenticate the same-origin API without
  // exposing any readable token to JavaScript. Never mistake that for logged out.
  const now=Date.now();
  // A 401/403 count request is not a reason to retry on every focus, state event or 45s tick.
  // Keep the badge hidden until the next bounded retry or a verified login event.
  if(now<authBackoffUntil)return;
  if(!force&&now-lastRefresh<45000)return;
  lastRefresh=now;inFlight=true;
  try{
   const headers={'Content-Type':'application/json','Accept':'application/json'};
   if(authToken)headers['X-ExportHUB-Token']=authToken;
   const response=await w.fetch('/api/urgent-orders',{method:'POST',credentials:'same-origin',cache:'no-store',
    headers,body:JSON.stringify({action:'counts'})});
   if(!response.ok){
    if((response.status===401||response.status===403)&&epoch===sessionEpoch){
     authBackoffUntil=Date.now()+AUTH_BACKOFF_MS;
    }
    throw new Error('URGENT_COUNT_UNAVAILABLE');
   }
   const data=await response.json();
   // A previous login's asynchronous response must not overwrite a newer session.
   if(epoch!==sessionEpoch)return;
   if(data.ok!==true||!Number.isSafeInteger(data.open)||data.open<0)throw new Error('URGENT_COUNT_INVALID');
   authBackoffUntil=0;
   const count=data.open;
   // Only authorized aggregate counts cross the network: no order/customer data.
   const current=ensureBadge();if(!current)return;
   current.badge.textContent=String(count);
   current.badge.dataset.hasOpen=count>0?'true':'false';
   current.badge.hidden=false;
   current.node.setAttribute('aria-label','Urgent Order: '+count+' offene Anfragen');
  }catch(_){
   if(epoch===sessionEpoch)hideBadge();
  }finally{
   inFlight=false;
   if(epoch!==sessionEpoch&&!loggedOut)refresh(true);
  }
 }
 function register(){
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',()=>refresh(true),{once:true});else refresh(true);
  if(w.addEventListener){
   ['exporthub:login','exporthub:authenticated','exporthub:user-changed'].forEach(name=>w.addEventListener(name,()=>{
    sessionEpoch++;loggedOut=false;lastRefresh=0;authBackoffUntil=0;hideBadge();refresh(true);
   }));
   ['exporthub:logout','exporthub:logged-out','exporthub:session-ended'].forEach(name=>w.addEventListener(name,()=>{
    sessionEpoch++;loggedOut=true;lastRefresh=0;authBackoffUntil=0;hideBadge();
   }));
   w.addEventListener('exporthub:state-loaded',()=>refresh(true));
   w.addEventListener('focus',()=>refresh(true));
  }
  if(d.addEventListener)d.addEventListener('visibilitychange',()=>{if(!d.hidden)refresh(true)});
  if(typeof w.setInterval==='function')w.setInterval(()=>refresh(false),45000);
 }
 register();
})(typeof window!=='undefined'?window:globalThis);
